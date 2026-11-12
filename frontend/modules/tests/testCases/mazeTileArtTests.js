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
 *
 * ⛓ CONTENT SETS R4 — a second row, on a COMMITTED theme and a committed world, with no test seam:
 *
 *   meta-trial-maze-tile-art — loads the committed `meta_trial` preset (its slot records `content: ['meta']`, ⚠ a
 *   per-player map), stands in its maze region with the water gate, and lets the panel's own play-time load read the
 *   world's stack from the document. Every expectation is read from the data (the document, the theme pack's art
 *   manifest, the maze default pack's water concept), never spelled here:
 *     · the stack is the maze default pack then the theme, and every maze thing the theme's manifest carries is keyed
 *       by the theme (the rest by nobody);
 *     · a repaint draws the floor, wall and player from the theme's own sheets (`"<theme>#<key>"`: each shape is
 *       rasterised once into a sheet of its own), read off the canvas's `drawImage` calls;
 *     · a floor cell's centre pixel is the floor recipe's paper colour;
 *     · the water gate (the theme presents no water) keeps the maze default pack's look: its definition is that
 *       concept's name, colour and symbol, and its cell's fill pixel is that colour.
 *   Pins of the recipes themselves (inside their box, states apart, every carried key through the seam) are in node:
 *   `mazeRoom/mazeMetaArt.test.js`.
 */
import { registerTest } from '../testRegistry.js';
import { getPanelInstance } from '../../mazeRoom/index.js';
import { COLORS, TILE_PX } from '../../mazeRoom/mazeRoomRender.js';
import { MAZE_ART_KEYS } from '../../mazeRoom/mazeTileArt.js';
import { browserRasteriser } from '../../artLibrary/artLibrary.js';
import { browserPackIo } from '../../procgenPipeline/worldContent.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';

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

// ── CONTENT SETS R4: the committed meta theme on the committed meta_trial world ──────────────────────────────────
const META_TRIAL_PRESET = './presets/meta_trial/AP_1/AP_1_rules.json';
const readPack = async (id) => {
    const pack = await (await fetch(`./packs/${id}/pack.json`, { cache: 'no-store' })).json();
    const layer = async (name) => (pack.layers?.[name]
        ? (await fetch(`./packs/${id}/${pack.layers[name]}`, { cache: 'no-store' })).json() : null);
    return { art: await layer('art'), concepts: (await layer('concepts'))?.concepts ?? {} };
};

async function metaTrialMazeTileArt(testController) {
    const doc = await (await fetch(META_TRIAL_PRESET, { cache: 'no-store' })).json();
    const slot = '1';
    const theme = doc.procgen_metadata?.[slot]?.content?.[0] ?? null;
    const mazePackId = substrateRegistry.get('maze')?.defaultContentPack ?? null;
    testController.reportCondition(`⛓ premise: ${META_TRIAL_PRESET} records a content set for player ${slot} (${theme}); the maze's default pack is ${mazePackId}`,
        !!theme && !!mazePackId);
    if (!theme || !mazePackId) return testController.getOverallResult();
    const themePack = await readPack(theme);
    const shapes = themePack.art?.shapes ?? {};
    const carried = Object.keys(MAZE_ART_KEYS).filter((t) => MAZE_ART_KEYS[t].key in shapes);
    testController.reportCondition(`⛓ premise: the pack "${theme}" has an art layer of shapes keying the floor, wall and player (${carried.length} of the maze's things)`,
        ['floor', 'wall', 'player'].every((t) => carried.includes(t)));
    const mazeWater = Object.values((await readPack(mazePackId)).concepts).find((c) => c.presents === 'water') ?? null;
    const sidecars = doc.preset_sidecars?.[slot] ?? {};
    const waterRegion = Object.entries(sidecars).find(([, sc]) => sc.substrate === 'maze'
        && Object.values(sc.playable_payload?.obstacleLib ?? {}).some((d) => d.concept === 'water'))?.[0] ?? null;
    const [waterId] = Object.entries(sidecars[waterRegion]?.playable_payload?.obstacleLib ?? {})
        .find(([, d]) => d.concept === 'water') ?? [];
    testController.reportCondition(`⛓ premise: ${waterRegion} is a maze with the water gate ${waterId}; the theme presents no water; the maze pack does`,
        !!waterId && !!mazeWater && !Object.values(themePack.concepts).some((c) => c.presents === 'water'));
    if (!waterId || !mazeWater || !carried.includes('floor')) return testController.getOverallResult();

    const { getGameStateSingleton } = await import('../../gameState/singleton.js');
    const gs = getGameStateSingleton();
    if (gs?.isLoopModeActive) gs.setLoopModeActive(false);
    const rulesLoaded = testController.waitForEvent('stateManager:rulesLoaded', 10000);
    testController.eventBus.publish('files:jsonLoaded', { jsonData: doc, selectedPlayerId: slot, sourceName: 'meta-trial-maze-tile-art' });
    await rulesLoaded;
    await testController.stateManager.pingWorker('after-rules-load', 3000);
    testController.eventBus.publish('ui:activatePanel', { panelId: 'mazeRoomPanel' });
    window.eventDispatcher?.publish('meta-trial-maze-tile-art', 'user:regionMove',
        { sourceRegion: gs.getCurrentRegion?.() ?? null, targetRegion: waterRegion, exitName: null }, { initialTarget: 'bottom' });
    // ⛔ IDENTITY (trap 1302): the panel must hold THIS document's water region, and the art load must be for this
    //   document's stack — concept_trial has the same maze payloads, so the stack is what tells them apart.
    const panel = await testController.pollForValue(() => {
        const p = getPanelInstance();
        return (p?.currentRegionId === waterRegion && p.world?.obstacleLib?.[waterId] && p.state) ? p : null;
    }, `the maze panel stands in ${waterRegion} with ${waterId}`, 20000, 250);
    testController.reportCondition(`the maze panel stands in ${waterRegion} with ${waterId}`, !!panel);
    if (!panel) return testController.getOverallResult();
    testController.reportCondition('a plain maze world (no Seedling skin)', panel._seedlingSkin() === null);

    const fogWas = panel.fogEnabled;
    panel.fogEnabled = false;
    const realDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    try {
        panel.render();
        const status = await testController.pollForValue(() => {
            const st = getPanelInstance()?.getTileArtStatus?.();
            return (st && st.stack.includes(theme) && (st.status === 'ready' || st.status === 'failed')) ? st : null;
        }, `the tile art of the world's stack loaded (${mazePackId}, ${theme})`, 15000, 100);
        testController.log(`tile art: ${JSON.stringify(status)}`);
        testController.reportCondition('the tile art loaded', status?.status === 'ready' && status.failedSheets === 0);
        testController.assertEqual('the stack is the maze default pack, then the theme the document records',
            JSON.stringify([mazePackId, theme]), JSON.stringify(status?.stack ?? null));
        testController.assertEqual(`every maze thing the "${theme}" manifest carries is keyed by "${theme}", and nothing else is keyed`,
            JSON.stringify(Object.fromEntries(carried.map((t) => [t, theme]))), JSON.stringify(status?.keyed ?? null));

        // Which sheets a repaint draws from: the panel's decoded images, by identity, off the canvas's drawImage calls.
        const images = panel._tileArt?.tileArt?.images ?? new Map();
        const sheetOf = new Map([...images].map(([ref, img]) => [img, ref]));
        const drawn = new Set();
        CanvasRenderingContext2D.prototype.drawImage = function drawImageSpy(img, ...rest) {
            if (sheetOf.has(img)) drawn.add(sheetOf.get(img));
            return realDrawImage.call(this, img, ...rest);
        };
        panel.render();
        CanvasRenderingContext2D.prototype.drawImage = realDrawImage;
        testController.log(`sheets drawn: ${JSON.stringify([...drawn].sort())}`);
        for (const thing of ['floor', 'wall', 'player']) {
            const ref = `${theme}#${MAZE_ART_KEYS[thing].key}`;
            testController.reportCondition(`the ${thing} was drawn from the "${theme}" pack's sheet ${ref}`, drawn.has(ref));
        }

        const canvas = panel.rootElement?.querySelector('.maze-room-canvas');
        testController.reportCondition('the canvas is drawn', !!canvas);
        if (!canvas) return testController.getOverallResult();
        const ctx = canvas.getContext('2d');
        const px = canvas.width / panel.world.width;
        testController.reportCondition('a cell is TILE_PX wide (no Seedling scale)', px === TILE_PX);
        const pixel = (x, y) => [...ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data.slice(0, 3)];
        const isWall = (x, y) => panel.world.tiles[y * panel.world.width + x] !== 0;
        const floor = cellWhere(panel, (x, y) => !isWall(x, y));
        const paper = shapes[MAZE_ART_KEYS.floor.key].draw[0].fill;
        testController.reportCondition('the world has a free floor cell to read', !!floor);
        if (floor) {
            testController.assertEqual(`a floor cell's centre is the "${theme}" floor recipe's fill ${paper}`,
                JSON.stringify(hexRgb(paper)), JSON.stringify(pixel(floor.x * px + px / 2, floor.y * px + px / 2)));
        }

        // The water gate keeps the maze default pack's look.
        const def = panel.world.obstacleLib[waterId];
        testController.assertEqual(`${waterId} is the maze default pack's water (name, colour, symbol)`,
            JSON.stringify({ name: mazeWater.name, color: mazeWater.look?.color, symbol: mazeWater.look?.symbol }),
            JSON.stringify({ name: def.name, color: def.color, symbol: def.symbol }));
        const gateKey = [...panel.world.obstacles].find(([, id]) => id === waterId)?.[0] ?? null;
        testController.reportCondition(`${waterId} stands in the world`, !!gateKey);
        if (gateKey) {
            const [gx, gy] = gateKey.split(',').map(Number);
            // inside the gate's fill (x0+2 … x0+px-2), clear of its symbol in the middle and of the grid line
            testController.assertEqual(`${waterId}'s cell is filled in its own colour ${def.color}, drawn by the maze, not the theme`,
                JSON.stringify(hexRgb(def.color)), JSON.stringify(pixel(gx * px + 4, gy * px + 4)));
        }
    } finally {
        CanvasRenderingContext2D.prototype.drawImage = realDrawImage;
        panel.fogEnabled = fogWas;
        panel.render();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'meta-trial-maze-tile-art',
    name: 'Meta theme trial: the maze is drawn from the theme\'s shapes; the water gate keeps the default look',
    description: 'Loads the committed meta_trial preset (content sets R4), stands in its maze region with the water gate, '
        + 'and lets the panel load the art of the stack the document records. Asserts the stack is the maze default pack '
        + 'then the theme, every thing the theme\'s art manifest carries is keyed by it, a repaint draws the floor, wall '
        + 'and player from "<theme>#<key>" sheets, a floor pixel is the recipe\'s paper colour, and the water gate is the '
        + 'maze default pack\'s water in name, colour, symbol and pixel.',
    testFunction: metaTrialMazeTileArt,
    category: 'Maze tile art',
    enabled: false, // off by default — runs only in the test-substrates mode
});
