/**
 * ⛓ CONTENT SETS R2b — a pack can supply the maze's tiles (`mazeRoom/mazeTileArt.js`). One row, in the real panel:
 *
 *   maze-tile-art-from-pack-stack — loads a plain (non-Seedling) maze world, points the panel's tile-art load at a
 *   FIXTURE stack of two packs (in-memory `readJson`; sheets painted on an OffscreenCanvas, so no image file is
 *   committed), and reads the canvas pixels (the pack stack's `mergeKeyed`: a later pack wins per key):
 *     · a WALL cell — the later pack's sprite over the earlier pack's sprite;
 *     · a FLOOR cell — the later pack's SHAPE over the earlier pack's sprite (part 2: rasterised in the page by
 *       `artLibrary.browserRasteriser`, the panel's own rasteriser);
 *     · the PLAYER — a key only the earlier pack carries, so it falls through to it;
 *     · an EXIT cell — a key neither pack carries — the maze's own `COLORS.exit`.
 *   Then it restores the browser's load.
 *
 * The draw-op pins (no art → today's ops, the fallbacks) are in node: `mazeRoom/mazeTileArt.test.js`.
 */
import { registerTest } from '../testRegistry.js';
import { getPanelInstance } from '../../mazeRoom/index.js';
import { COLORS, TILE_PX } from '../../mazeRoom/mazeRoomRender.js';
import { MAZE_ART_KEYS } from '../../mazeRoom/mazeTileArt.js';
import { browserRasteriser } from '../../artLibrary/artLibrary.js';
import { browserPackIo } from '../../procgenPipeline/worldContent.js';

const PRESET = './presets/procgen_maze/AP_1/AP_1_rules.json';
const FIX_BASE = 'https://fixture.invalid/packs/';
const EARLY = 'r2b-fixture-early';
const LATE = 'r2b-fixture-late';
/** One flat colour per sheet: what the pixels must show. */
const SHEET_COLOUR = Object.freeze({
    [`${EARLY}/art/sheets/wall.png`]: [200, 30, 200],
    [`${EARLY}/art/sheets/floor.png`]: [30, 200, 60],
    [`${EARLY}/art/sheets/player.png`]: [240, 240, 40],
    [`${LATE}/art/sheets/wall.png`]: [250, 140, 0],
});
/** The later pack's floor SHAPE: one rect over the whole tile, so its centre pixel is this colour. */
const FLOOR_SHAPE_RGB = [20, 90, 220];
const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

const pack = (id) => ({ schema_version: 1, id, title: id, licence: 'in-app test fixture', layers: { art: 'art/manifest.json' } });
const sheet = { file: 'sheets/wall.png', w: 16, h: 16 };
const FIXTURE = Object.freeze({
    [`${EARLY}/pack.json`]: pack(EARLY),
    [`${EARLY}/art/manifest.json`]: {
        schema_version: 1,
        sheets: { wall: sheet, floor: { ...sheet, file: 'sheets/floor.png' }, player: { ...sheet, file: 'sheets/player.png' } },
        sprites: {
            [MAZE_ART_KEYS.wall.key]: { sheet: 'wall', fw: 16, fh: 16 },
            [MAZE_ART_KEYS.floor.key]: { sheet: 'floor', fw: 16, fh: 16 },
            [MAZE_ART_KEYS.player.key]: { sheet: 'player', fw: 16, fh: 16 },
        },
    },
    [`${LATE}/pack.json`]: pack(LATE),
    [`${LATE}/art/manifest.json`]: {
        schema_version: 1,
        sheets: { wall: sheet },
        sprites: { [MAZE_ART_KEYS.wall.key]: { sheet: 'wall', fw: 16, fh: 16 } },
        shapes: { [MAZE_ART_KEYS.floor.key]: { w: 16, h: 16, draw: [{ rect: [0, 0, 16, 16], fill: toHex(FLOOR_SHAPE_RGB) }] } },
    },
});

const fixtureIo = () => ({
    base: FIX_BASE,
    // A path the fixture does not hold is a REAL pack the world's stack names ahead of the fixture (the maze's
    // own `defaultContentPack`), read from the served packs directory as play reads it.
    readJson: async (url) => {
        const rest = url.slice(FIX_BASE.length);
        const hit = FIXTURE[rest];
        if (!hit) {
            const real = browserPackIo();
            return real.readJson(new URL(rest, real.base).href);
        }
        return JSON.parse(JSON.stringify(hit));
    },
    decode: async (url) => {
        const rgb = SHEET_COLOUR[url.slice(FIX_BASE.length)];
        if (!rgb) throw new Error(`no fixture sheet at ${url}`);
        const c = new OffscreenCanvas(16, 16);
        const g = c.getContext('2d');
        g.fillStyle = `rgb(${rgb.join(',')})`;
        g.fillRect(0, 0, 16, 16);
        return createImageBitmap(c);
    },
    rasterise: browserRasteriser(),
});

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** A cell of `world` by predicate, away from the player, the entrance and anything drawn on top. */
function cellWhere(panel, pred) {
    const w = panel.world;
    const busy = new Set([...(w.items?.keys() ?? []), ...(w.obstacles?.keys() ?? []), `${w.entrance.x},${w.entrance.y}`]);
    for (const e of w.exits.values()) busy.add(`${e.x},${e.y}`);
    const p = panel.state?.player_pos;
    if (p) busy.add(`${p.x},${p.y}`);
    for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
            if (!busy.has(`${x},${y}`) && pred(x, y)) return { x, y };
        }
    }
    return null;
}

async function tileArtFromPackStack(testController) {
    await testController.loadRulesFromFile(PRESET);
    await testController.stateManager.pingWorker('after-rules-load', 5000);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });
    const panel = await testController.pollForValue(
        () => { const p = getPanelInstance(); return (p?.world && p.state) ? p : null; },
        'maze panel mounted with a world', 20000, 250);
    testController.reportCondition('the maze panel holds a world', !!panel);
    if (!panel) return testController.getOverallResult();
    testController.reportCondition('a plain maze world (no Seedling skin)', panel._seedlingSkin() === null);

    // The row sets its own view state: fog off, so every cell it reads is drawn (restored after).
    const fogWas = panel.fogEnabled;
    panel.fogEnabled = false;
    try {
        panel.setTileArtSourceForTests(fixtureIo(), { content: [EARLY, LATE] });
        const status = await testController.pollForValue(() => {
            const s = getPanelInstance()?.getTileArtStatus?.();
            return (s && (s.status === 'ready' || s.status === 'failed')) ? s : null;
        }, 'the fixture tile art loaded', 15000, 100);
        testController.log(`tile art: ${JSON.stringify(status)}`);
        testController.reportCondition('the tile art loaded', status?.status === 'ready');
        testController.reportCondition('the stack is the fixture\'s, in order', JSON.stringify(status?.stack?.slice(-2)) === JSON.stringify([EARLY, LATE]));
        testController.reportCondition('wall keyed by the LATER pack', status?.keyed?.wall === LATE);
        testController.reportCondition('floor keyed by the LATER pack (its shape)', status?.keyed?.floor === LATE);
        testController.reportCondition('player keyed by the earlier pack (falls through)', status?.keyed?.player === EARLY);
        testController.reportCondition('no sheet failed', status?.failedSheets === 0);

        panel.render();
        const canvas = panel.rootElement?.querySelector('.maze-room-canvas');
        testController.reportCondition('the canvas is drawn', !!canvas);
        if (!canvas) return testController.getOverallResult();
        const ctx = canvas.getContext('2d');
        const px = canvas.width / panel.world.width;
        testController.reportCondition('a cell is TILE_PX wide (no Seedling scale)', px === TILE_PX);
        const centre = ({ x, y }) => [...ctx.getImageData(Math.floor(x * px + px / 2), Math.floor(y * px + px / 2), 1, 1).data.slice(0, 3)];
        const isWall = (x, y) => panel.world.tiles[y * panel.world.width + x] !== 0;
        const wall = cellWhere(panel, isWall);
        const floor = cellWhere(panel, (x, y) => !isWall(x, y));
        const exit = [...panel.world.exits.values()].find((e) => !(panel.state.player_pos.x === e.x && panel.state.player_pos.y === e.y)
            && !panel.world.obstacles?.has(`${e.x},${e.y}`));
        testController.reportCondition('the world has a wall, a floor and an exit cell to read', !!(wall && floor && exit));
        if (!(wall && floor && exit)) return testController.getOverallResult();
        const seen = { wall: centre(wall), floor: centre(floor), exit: centre(exit), player: centre(panel.state.player_pos) };
        testController.log(`pixels: ${JSON.stringify(seen)} at ${JSON.stringify({ wall, floor, exit: { x: exit.x, y: exit.y } })}`);
        testController.reportCondition('the wall shows the LATER pack\'s image',
            JSON.stringify(seen.wall) === JSON.stringify(SHEET_COLOUR[`${LATE}/art/sheets/wall.png`]));
        testController.reportCondition('the floor shows the LATER pack\'s shape (rasterised in the page)',
            JSON.stringify(seen.floor) === JSON.stringify(FLOOR_SHAPE_RGB));
        testController.reportCondition('the player shows the earlier pack\'s image (no later pack keys it)',
            JSON.stringify(seen.player) === JSON.stringify(SHEET_COLOUR[`${EARLY}/art/sheets/player.png`]));
        testController.reportCondition('the un-keyed exit shows COLORS.exit',
            JSON.stringify(seen.exit) === JSON.stringify(hexRgb(COLORS.exit)));
    } finally {
        panel.fogEnabled = fogWas;
        panel.setTileArtSourceForTests(null);
    }
    const restored = panel.getTileArtStatus();
    testController.reportCondition('restored: the world\'s own stack again, without the fixture packs',
        !restored.stack.includes(EARLY) && !restored.stack.includes(LATE));
    return testController.getOverallResult();
}

registerTest({
    id: 'maze-tile-art-from-pack-stack',
    name: 'Maze tile art: a pack stack supplies the tiles (images and shapes), a later pack wins, the rest falls back',
    description: 'Points the maze panel\'s play-time tile-art load at a fixture stack of two packs and reads the canvas: '
        + 'the wall is the later pack\'s sprite, the floor the later pack\'s shape, the player the earlier pack\'s '
        + 'sprite, the un-keyed exit COLORS.exit.',
    testFunction: tileArtFromPackStack,
    category: 'Maze tile art',
    enabled: false, // off by default — runs only in the test-substrates mode
});
