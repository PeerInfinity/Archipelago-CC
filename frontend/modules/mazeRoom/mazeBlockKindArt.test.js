/**
 * maze-seedling-art-4 (S4) — the BLOCK KINDS tile-mechanisms-m1 added (`block_lib`: walk / struck_by / pulsed / wake;
 * `state.blockKinds`), and its PULSERS, in the maze's picture — art on and off — so that tile-mechanisms-m2-l40 can lay
 * L40's kinds without the census refusing them. In node (no pixels — the recorded draw-op log, `drawOpRecorder.js`):
 *
 *   1. ART OFF, on m1's own gadget rooms (`mazeBlockKinds.test.js`' pictures, walked by the engine's `step`): a block
 *      is drawn BY KIND from its `block_lib` entry (`blockLook`: walked = S3's square, struck = the struck square, a
 *      dormant turret = a disc); a WOKEN block switches look; a pulser's reach is an armed lane while its token is
 *      held (`livePulsers`) and silent otherwise, its wall cell marked. A world without a `block_lib` draws S3's ops.
 *   2. ART ON, over L40's own record (the entities m2 will lay, at their cells): the census claims every new id —
 *      turret (IceTurret), its corpse (the woken kind), fire block (PushableBlockFire), pulser (Pulser) and the
 *      wandlocks (WandLock under a `door`) — with zero refusals, one world mixing classes by kind; the sprites draw
 *      each live block in its kind's class, the woken turret as the "dead" frame; the bake leaves them out.
 *   3. Refusals by name: a kind standing on two classes, a woken kind whose class has no woken look, a pulser on no
 *      Pulser.
 *   4. GOLDEN logs: the marker log (`drawLiveMarkers` alone) on the gadget rooms, the sprite list on the L40 fixture.
 *      Re-record: `UPDATE_MAZE_KIND_GOLDENS=1 npx vitest run <this file>`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { formatOp } from '../seedlingDemo/seedlingSkinRenderer.js';
import { patchedMapDocument } from '../seedlingDemo/seedlingSetPatches.js';
import { recordingContext } from './drawOpRecorder.js';
import { createState, deserializeMazeWorld, step, turnInput, useInput } from './mazeRoomEngine.js';
import { COLORS, blockLook, drawLiveMarkers, drawWorld, livePulsers, plainView } from './mazeRoomRender.js';
import { levelWorldFor, mazeModelledCells, staticOps } from './mazeSeedlingSkin.js';
import { seedlingCensus, seedlingSprites } from './mazeSeedlingSprites.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/maze-kind-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const L40 = patchedMapDocument(MAP).levels.find((r) => r.level === 40);

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

// ── m1's gadget rooms (`mazeBlockKinds.test.js`: the same pictures, the same libs) ─────────────────────────────
const SWORD = 'Progressive Sword';
const FIRE = 'Fire';
const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const ACTIONS = {
    sword: { item: SWORD, primitive: 'strike', condition: 'strikes', key: 'z' },
    fire: {
        item: FIRE, primitive: 'strike', condition: 'strikes', key: 'c', push: 'away',
        footprint: Object.fromEntries(['N', 'E', 'S', 'W'].map((f) => [f, NEIGHBOURS])),
    },
};
const KINDS = {
    plain: { walk: true },
    fire: { walk: false, struck_by: ['fire'], pulsed: true },
    turret: { walk: false, wake: { struck_by: ['sword'], becomes: 'corpse' } },
    corpse: { walk: false, struck_by: ['fire'], pulsed: true },
};
/** `#` wall · P entrance · X exit · B plain · F fire · T turret · C corpse · o button sw_0 · D door sw_0 · q button sw_1 · Q pulser sw_1 */
function gadget(rows) {
    const height = rows.length;
    const width = rows[0].length;
    const at = (ch) => {
        const out = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rows[y][x] === ch) out.push({ x, y });
        return out;
    };
    const KIND_OF = { B: 'plain', F: 'fire', T: 'turret', C: 'corpse' };
    const inGrid = ({ x, y }) => x >= 0 && y >= 0 && x < width && y < height;
    const buttons = [...at('o').map((c) => ({ ...c, id: 'button_0' })), ...at('q').map((c) => ({ ...c, id: 'button_1' }))];
    return deserializeMazeWorld({
        width,
        height,
        tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' || c === 'Q' ? 1 : 0))),
        entrance: at('P')[0],
        exits: at('X').map((c) => ({ exit_id: 'exit', ...c })),
        obstacles: at('D').map((c) => ({ ...c, id: 'door' })),
        items: [],
        obstacleLib: { door: { id: 'door', name: 'door', clear_set: [['sw_0']] } },
        blocks: Object.keys(KIND_OF).flatMap((ch) => at(ch).map((c) => ({ ...c, kind: KIND_OF[ch] }))),
        block_lib: KINDS,
        ...(buttons.length > 0 ? {
            buttons,
            buttonLib: { button_0: { kind: 'button', holds: 'sw_0' }, button_1: { kind: 'button', holds: 'sw_1' } },
        } : {}),
        action_lib: ACTIONS,
        ...(at('Q').length > 0 ? {
            pulsers: at('Q').map((c) => ({
                ...c, token: 'sw_1', reach: NEIGHBOURS.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).filter(inGrid),
            })),
        } : {}),
    });
}
const CORPSE_CHAIN = ['#########', '#P......#', '#..T....#', '#.......#', '#...o...#', '#######D#', '#######X#', '#########'];
const PULSE_GATE = ['########', '#PB.q..#', '#......#', '#.#Q####', '#..F..X#', '###.####', '########'];

const holding = (w, items) => {
    const s = createState(w);
    s.inventory = new Set(items);
    return s;
};
const walk = (w, s, inputs) => inputs.reduce((acc, input) => {
    const n = step(w, acc, input);
    if (n === null) throw new Error(`the engine refused ${input} at ${JSON.stringify(acc.player_pos)}`);
    return n;
}, s);
const viewOf = (w, s, extra = {}) => plainView({
    tilePx: 8, playerPos: s?.player_pos ?? null, inventory: s?.inventory ?? new Set(), broken: s?.broken ?? null,
    facing: s?.facing ?? null, blocks: s?.blocks ?? null, blockKinds: s?.blockKinds ?? null,
    livePulsers: s ? livePulsers(w, s) : null, ...extra,
});
const markerLog = (w, view, spriteCells = null) => {
    const ctx = recordingContext();
    drawLiveMarkers(ctx, w, view, spriteCells);
    return ctx.__log;
};
const PX = 8;
const squareAt = (x, y) => `fillRect(${x * PX + PX * 0.15},${y * PX + PX * 0.15},${PX * 0.7},${PX * 0.7})`;
const discAt = (x, y) => `arc(${x * PX + PX / 2},${y * PX + PX / 2},${PX * 0.36},0,${Math.PI * 2})`;
/** The fillStyle in force at each op of the log. */
const styleOf = (log, op) => {
    let style = null;
    for (const o of log) {
        if (o.startsWith('fillStyle=')) style = JSON.parse(o.slice('fillStyle='.length));
        if (o === op) return style;
    }
    return undefined;
};

const STATES = {
    // the turret as laid, then struck by the sword: the same cell, kind turret → corpse
    'corpse-start': () => { const w = gadget(CORPSE_CHAIN); return [w, holding(w, [SWORD, FIRE])]; },
    'corpse-woken': () => {
        const w = gadget(CORPSE_CHAIN);
        // P (1,1) → (3,1), facing S onto the turret at (3,2); the sword wakes it
        return [w, walk(w, holding(w, [SWORD, FIRE]), ['E', 'E', turnInput('S'), useInput('sword')])];
    },
    'corpse-burnt': () => {
        const w = gadget(CORPSE_CHAIN);
        // woken, then Fire from the north shoves the corpse one cell south (away)
        return [w, walk(w, holding(w, [SWORD, FIRE]), ['E', 'E', turnInput('S'), useInput('sword'), useInput('fire')])];
    },
    'pulse-idle': () => { const w = gadget(PULSE_GATE); return [w, holding(w, [])]; },
    // the plain block pushed onto q holds sw_1: the pulser is live, its reach armed, the fire block shoved south
    'pulse-live': () => { const w = gadget(PULSE_GATE); return [w, walk(w, holding(w, []), ['E', 'E'])]; },
};

describe('1. art off: blocks by kind, the woken switch, the pulser\'s lane', () => {
    it('`blockLook` reads the block_lib entry, never the kind\'s name', () => {
        const w = gadget(CORPSE_CHAIN);
        expect(['plain', 'fire', 'turret', 'corpse'].map((k) => blockLook(w, k))).toEqual(['walk', 'struck', 'dormant', 'struck']);
        const renamed = { ...w, blockLib: { a: w.blockLib.turret, b: w.blockLib.fire } };
        expect([blockLook(renamed, 'a'), blockLook(renamed, 'b')]).toEqual(['dormant', 'struck']);
        expect(blockLook({ blockLib: undefined }, 'anything')).toBe('walk');
    });

    it('the turret is a dormant disc; the sword wakes it in place and it is a struck square; Fire moves it', () => {
        const [w, s0] = STATES['corpse-start']();
        const start = markerLog(w, viewOf(w, s0));
        expect(start).toContain(discAt(3, 2));
        expect(styleOf(start, discAt(3, 2))).toBe(COLORS.blockDormant);
        expect(start).not.toContain(squareAt(3, 2));

        const [, woken] = STATES['corpse-woken']();
        expect(woken.blockKinds).toEqual({ '3,2': 'corpse' });
        const after = markerLog(w, viewOf(w, woken));
        expect(after).not.toContain(discAt(3, 2));
        expect(styleOf(after, squareAt(3, 2))).toBe(COLORS.blockStruck);

        const [, burnt] = STATES['corpse-burnt']();
        expect(burnt.blocks).toEqual(['3,3']);
        const moved = markerLog(w, viewOf(w, burnt));
        expect(styleOf(moved, squareAt(3, 3))).toBe(COLORS.blockStruck);
        expect(moved).not.toContain(squareAt(3, 2));
    });

    it('`blockKinds: null` is the kinds the world lays (the pre-play view)', () => {
        const [w, s0] = STATES['corpse-start']();
        expect(markerLog(w, viewOf(w, null))).toEqual(markerLog(w, viewOf(w, s0, { playerPos: null, blockKinds: null })));
        expect(markerLog(w, viewOf(w, null))).toContain(discAt(3, 2));
    });

    it('the pulser: reach silent while its token is free, ARMED (the arrow lane\'s colour) while held; its wall cell marked', () => {
        const [w, idle] = STATES['pulse-idle']();
        expect(livePulsers(w, idle)).toEqual([false]);
        const quiet = markerLog(w, viewOf(w, idle));
        expect(quiet).toContain(`fillStyle=${JSON.stringify(COLORS.laneSilent)}`);
        expect(quiet).not.toContain(`fillStyle=${JSON.stringify(COLORS.laneArmed)}`);
        expect(quiet).toContain(`arc(${3 * PX + PX / 2},${3 * PX + PX / 2},${PX * 0.25},0,${Math.PI * 2})`);
        // the fire block in the reach is a struck square; the plain block is S3's square
        expect(styleOf(quiet, squareAt(3, 4))).toBe(COLORS.blockStruck);
        expect(styleOf(quiet, squareAt(2, 1))).toBe(COLORS.block);

        const [, live] = STATES['pulse-live']();
        expect(livePulsers(w, live)).toEqual([true]);
        expect(live.blocks.sort()).toEqual(['3,5', '4,1']);
        const loud = markerLog(w, viewOf(w, live));
        const reach = w.pulsers[0].reach;
        expect(loud.filter((op) => op === `fillStyle=${JSON.stringify(COLORS.laneArmed)}`)).toHaveLength(1);
        for (const key of reach) {
            const [x, y] = key.split(',').map(Number);
            expect(loud, key).toContain(`fillRect(${x * PX},${y * PX},${PX},${PX})`);
        }
        expect(styleOf(loud, squareAt(3, 5))).toBe(COLORS.blockStruck);
    });

    it('a world with no block_lib and no pulser draws exactly S3\'s ops (the walked square), and drawWorld carries the log', () => {
        const [w, s] = STATES['pulse-idle']();
        const bare = { ...w, blockLib: undefined, pulsers: undefined };
        const kindless = markerLog(bare, viewOf(bare, s, { blockKinds: null, livePulsers: null }));
        expect(kindless.filter((op) => op.startsWith('fillStyle='))).toEqual([
            `fillStyle=${JSON.stringify(COLORS.button)}`, `fillStyle=${JSON.stringify(COLORS.block)}`,
        ]);
        const ctx = recordingContext();
        drawWorld(ctx, w, viewOf(w, s));
        expect(ctx.__log.join('\n')).toContain(markerLog(w, viewOf(w, s)).join('\n'));
    });

    it('refuses a malformed `blockKinds` or `livePulsers` by name', () => {
        const [w, s] = STATES['pulse-idle']();
        expect(() => drawWorld(recordingContext(), w, { ...viewOf(w, s), blockKinds: ['3,4'] }))
            .toThrow(/view\.blockKinds must be null or an object/);
        expect(() => drawWorld(recordingContext(), w, { ...viewOf(w, s), livePulsers: true }))
            .toThrow(/view\.livePulsers must be null or one boolean per/);
        const { blockKinds: _, ...missing } = viewOf(w, s);
        expect(() => drawWorld(recordingContext(), w, missing)).toThrow(/the view is missing "blockKinds"/);
    });
});

// ── L40 as m2 will lay it: the entities' own cells, the kinds, the pulser, the wandlocks as doors ─────────────
const cellOf = (e) => ({ x: Math.floor(e.x / 16), y: Math.floor(e.y / 16) });
const ents = (type) => L40.entities.filter((e) => e.type === type);
const KIND_FOR = { pushableblock: 'plain', pushableblockfire: 'fire', iceturret: 'turret' };
/** `pulser@592,576` (37,36), group 4; its reach = its 8 neighbours, as the gadget rooms (m2 derives its own). */
function l40Sidecar(overrides = {}) {
    const { width, height } = L40;
    const pulser = cellOf(ents('pulser')[0]);
    const tiles = new Array(width * height).fill(0);
    tiles[pulser.y * width + pulser.x] = 1;
    const doors = ents('wandlock').map((e) => ({ ...cellOf(e), id: `lock_${e.attrs.tset}` }));
    return {
        width,
        height,
        tiles,
        entrance: { x: 1, y: 1 },
        exits: [],
        items: [],
        obstacles: doors,
        obstacleLib: Object.fromEntries([...new Set(doors.map((d) => d.id))].map((id) => [id, {
            id, name: `lock (group ${id.slice(5)})`, kind: 'door', clear_set: [[`sw_${id.slice(5)}`]],
        }])),
        blocks: Object.keys(KIND_FOR).flatMap((t) => ents(t).map((e) => ({ ...cellOf(e), kind: KIND_FOR[t] }))),
        block_lib: KINDS,
        action_lib: ACTIONS,
        buttons: ents('button').map((e) => ({ ...cellOf(e), id: `button_${e.attrs.tset}` })),
        buttonLib: Object.fromEntries(ents('button').map((e) => [`button_${e.attrs.tset}`, { kind: 'button', holds: `sw_${e.attrs.tset}` }])),
        pulsers: [{
            ...pulser, token: 'sw_4',
            reach: NEIGHBOURS.map(([dx, dy]) => ({ x: pulser.x + dx, y: pulser.y + dy })),
        }],
        level: 40,
        tile_size: 16,
        origin: { x: 0, y: 0 },
        ...overrides,
    };
}
const l40 = (overrides) => deserializeMazeWorld(l40Sidecar(overrides));
const lines = ({ ops, player }) => [...ops.map(formatOp), ...(player ?? []).map((op) => `player ${formatOp(op)}`)];
const TURRET_CELL = '29,25';

describe('2. art on: the census claims the new ids over L40, and the sprites draw them by kind', () => {
    it('zero refusals; turret / corpse / fire / plain / pulser / wandlock are each claimed by their class', () => {
        const w = l40();
        expect(w.atlas?.level).toBe(40);
        const census = seedlingCensus(w, L40);
        expect(census.refusals).toEqual([]);
        const byWhat = (what) => census.rows.filter((r) => r.what === what).map((r) => `${r.cls}@${r.cells.join(' ')}`).sort();
        expect(byWhat('block')).toEqual(['IceTurret@29,25', 'PushableBlock@36,35', 'PushableBlockFire@30,30', 'PushableBlockFire@36,36']);
        expect(byWhat('pulser')).toEqual(['Pulser@37,36']);
        expect(census.rows.filter((r) => r.what === 'obstacle').map((r) => r.cls)).toEqual(ents('wandlock').map(() => 'WandLock'));
        expect([...census.kinds].map(([k, v]) => `${k}=${v.row.cls}${v.woken ? ' (woken)' : ''}`).sort())
            .toEqual(['corpse=IceTurret (woken)', 'fire=PushableBlockFire', 'plain=PushableBlock', 'turret=IceTurret']);
        expect(mazeModelledCells(w).has('37,36')).toBe(true);
    });

    it('each live block is drawn in its kind\'s class; the woken turret is the "dead" frame; the pulser is its sprite', () => {
        const w = l40();
        const census = seedlingCensus(w, L40);
        const s = createState(w);
        const draw = (state) => seedlingSprites(census, art, { mazeWorld: w, view: viewOf(w, state), blocks: state.blocks, blockKinds: state.blockKinds });
        const start = draw(s);
        const turret = start.ops.filter((op) => op.key === 'seedling:enemy/iceturret');
        expect(turret.map((op) => [op.frame, op.rot])).toEqual([[0, 0]]);
        expect(start.ops.filter((op) => op.key === 'seedling:puzzlement/pushableblockfire')).toHaveLength(2);
        expect(start.ops.filter((op) => op.key === 'seedling:puzzlement/pushableblock')).toHaveLength(1);
        expect(start.ops.filter((op) => op.key === 'seedling:machine/pulser')).toHaveLength(1);
        expect(start.ops.filter((op) => op.key === 'seedling:puzzlement/wandlock')).toHaveLength(ents('wandlock').length);
        for (const c of ['29,25', '30,30', '36,36', '36,35', '37,36']) expect(start.cells.has(c), c).toBe(true);

        // woken: the same cell, the corpse's frame; then moved: drawn where the maze has it
        const woken = { ...s, blockKinds: { ...s.blockKinds, [TURRET_CELL]: 'corpse' } };
        expect(draw(woken).ops.filter((op) => op.key === 'seedling:enemy/iceturret').map((op) => [op.frame, op.rot])).toEqual([[6, 90]]);
        const moved = { ...woken, blocks: woken.blocks.map((k) => (k === TURRET_CELL ? '29,24' : k)),
            blockKinds: Object.fromEntries(Object.entries(woken.blockKinds).map(([k, v]) => [k === TURRET_CELL ? '29,24' : k, v])) };
        const corpse = draw(moved).ops.filter((op) => op.key === 'seedling:enemy/iceturret');
        expect(corpse).toHaveLength(1);
        expect([corpse[0].dx + corpse[0].pivotX, corpse[0].dy + corpse[0].pivotY]).toEqual([29 * 16 + 8, 24 * 16 + 8]);
    });

    it('the bake leaves the claimed turret and pulser out (the live sprites draw them)', () => {
        const w = l40();
        const { record, world } = levelWorldFor(MAP, 40, w);
        const census = seedlingCensus(w, record);
        const claimed = staticOps(world, art, { level: 40, record, mazeWorld: w, census }).length;
        const without = { ...census, rows: census.rows.filter((r) => r.what !== 'pulser' && r.cls !== 'IceTurret') };
        expect(staticOps(world, art, { level: 40, record, mazeWorld: w, census: without }).length).toBeGreaterThan(claimed);
    });

    it('art on, the art owns the kinds\' cells: no block or pulser marker; the reach tint stays (like a lane)', () => {
        const w = l40();
        const census = seedlingCensus(w, L40);
        const s = createState(w);
        const view = viewOf(w, s);
        const { cells } = seedlingSprites(census, art, { mazeWorld: w, view, blocks: s.blocks, blockKinds: s.blockKinds });
        const log = markerLog(w, view, cells);
        for (const c of [COLORS.block, COLORS.blockStruck, COLORS.blockDormant, COLORS.pulser]) {
            expect(log, c).not.toContain(`fillStyle=${JSON.stringify(c)}`);
        }
        expect(log).toContain(`fillStyle=${JSON.stringify(COLORS.laneSilent)}`);
    });
});

describe('3. refusals by name', () => {
    it('a kind on two classes; a woken kind whose class has no woken look; a pulser on no Pulser', () => {
        const sc = l40Sidecar();
        const twoClasses = deserializeMazeWorld({ ...sc, blocks: sc.blocks.map((b) => ({ ...b, kind: b.kind === 'plain' ? 'fire' : b.kind })) });
        expect(seedlingCensus(twoClasses, L40).refusals.join('\n'))
            .toMatch(/L40: block kind "fire" stands on 2 classes \((pushableblockfire, pushableblock|pushableblock, pushableblockfire)\)/);
        const fireWakes = deserializeMazeWorld({
            ...sc,
            block_lib: { ...KINDS, fire: { walk: false, wake: { struck_by: ['sword'], becomes: 'ash' } }, ash: { walk: false, struck_by: ['fire'] } },
        });
        expect(seedlingCensus(fireWakes, L40).refusals.join('\n'))
            .toMatch(/block kind "ash" \(woken from "fire", PushableBlockFire\) — PushableBlockFire has no woken look in the art/);
        const off = deserializeMazeWorld({ ...sc, tiles: sc.tiles.map((t, i) => (i === 36 * L40.width + 38 ? 1 : t)),
            pulsers: [{ x: 38, y: 36, token: 'sw_4', reach: [{ x: 38, y: 37 }] }] });
        expect(seedlingCensus(off, L40).refusals.join('\n')).toMatch(/L40 pulser at 38,36: no entity of Pulser/);
    });

    it('without a block_lib the S2 "blocks of N classes" refusal still stands (the live blocks carry no kind)', () => {
        const sc = l40Sidecar();
        const { block_lib: _, ...bare } = sc;
        const w = deserializeMazeWorld({ ...bare, blocks: sc.blocks.filter((b) => b.kind !== 'turret').map(({ kind: __, ...b }) => b), pulsers: undefined });
        expect(seedlingCensus(w, L40).refusals.join('\n')).toMatch(/blocks of 2 classes/);
    });
});

describe('4. golden logs (a change detector of the kind draws)', () => {
    const golden = (name, got) => {
        const path = join(GOLDENS, `${name}.txt`);
        if (process.env.UPDATE_MAZE_KIND_GOLDENS) {
            mkdirSync(GOLDENS, { recursive: true });
            writeFileSync(path, `${got.join('\n')}\n`);
        }
        expect(existsSync(path), `${path} (record with UPDATE_MAZE_KIND_GOLDENS=1)`).toBe(true);
        expect(got).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n'));
    };
    for (const name of Object.keys(STATES)) {
        it(`markers ${name}`, () => {
            const [w, s] = STATES[name]();
            golden(`markers-${name}`, markerLog(w, viewOf(w, s)));
        });
    }
    it('sprites L40-start and L40-woken-moved', () => {
        const w = l40();
        const census = seedlingCensus(w, L40);
        const s = createState(w);
        const draw = (state) => lines(seedlingSprites(census, art, { mazeWorld: w, view: viewOf(w, state), blocks: state.blocks, blockKinds: state.blockKinds }));
        golden('sprites-L40-start', draw(s));
        const woken = { ...s, blocks: s.blocks.map((k) => (k === TURRET_CELL ? '29,24' : k)),
            blockKinds: Object.fromEntries(Object.entries(s.blockKinds).map(([k, v]) => (k === TURRET_CELL ? ['29,24', 'corpse'] : [k, v]))) };
        golden('sprites-L40-woken-moved', draw(woken));
    });
});
