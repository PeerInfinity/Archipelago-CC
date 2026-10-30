/**
 * maze-seedling-art-3 (S3) — the maze's LIVE things in the plain (art-off) view, and the pull in the census.
 * S2's review found the panel never drew a pushable block or a button at all (art on or off: `drawWorld` had no
 * marker for either), and sphere-order-9's PULLS (LavaTrap) reached neither the census nor the picture. In node,
 * over the committed preset and map (no pixels — the recorded draw-op log, `drawOpRecorder.js`):
 *
 *   1. The plain view draws the block WHERE THE MAZE HAS IT (`view.blocks` = `state.blocks`; null = the world's own
 *      layout) and the button DOWN under the player or a block, read from real states walked by the engine's `step`.
 *   2. A pull: its disc tinted (live with the gate held, grey without) and its trap cell marked.
 *   3. With the art on, a cell the sprites own draws no marker (the block's, the button's, the lava trap's).
 *   4. The census claims every pull's LavaTrap (zero refusals) and refuses a pull on no lava trap by name; the live
 *      sprites draw the lava trap at frame 0.
 *   5. GOLDEN marker logs (`drawLiveMarkers` alone) at those states. Re-record:
 *      `UPDATE_MAZE_MARKER_GOLDENS=1 npx vitest run <this file>`.
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
import { INPUT_E, INPUT_S, createState, deserializeMazeWorld, step } from './mazeRoomEngine.js';
import { COLORS, drawLiveMarkers, drawWorld, plainView } from './mazeRoomRender.js';
import { mazeModelledCells } from './mazeSeedlingSkin.js';
import { seedlingCensus, seedlingSprites } from './mazeSeedlingSprites.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/maze-marker-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECORDS = new Map(patchedMapDocument(MAP).levels.map((r) => [r.level, r]));
const PLAYTHROUGH = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const PAYLOADS = Object.entries(PLAYTHROUGH.preset_sidecars['1']).filter(([, v]) => v.playable_payload)
    .map(([k, v]) => [k, v.playable_payload]);
const worldOf = (payload) => deserializeMazeWorld(JSON.parse(JSON.stringify(payload)));
const regionWorld = (id) => worldOf(PLAYTHROUGH.preset_sidecars['1'][id].playable_payload);
/** L80's two pulls (sphere-order-9). Named, so a re-record that ADDS a pull level (L77, L78 at sphere 9.10) moves no
 *  golden; section 4 walks every pull of the preset. */
const PULL_REGION = 'level_80__r0c2';

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

const walk = (world, ...inputs) => inputs.reduce((s, input) => {
    const next = step(world, s, input);
    if (!next) throw new Error(`the engine refused ${input} at ${JSON.stringify(s.player_pos)}`);
    return next;
}, createState(world));
const viewOf = (state, extra = {}) => plainView({
    tilePx: 8, playerPos: state?.player_pos ?? null, inventory: state?.inventory ?? new Set(),
    broken: state?.broken ?? null, facing: state?.facing ?? null, blocks: state?.blocks ?? null, ...extra,
});
const markerLog = (world, view, spriteCells = null) => {
    const ctx = recordingContext();
    drawLiveMarkers(ctx, world, view, spriteCells);
    return ctx.__log;
};
const fillsAt = (log, colour, x, y, px = 8) => {
    const out = [];
    let style = null;
    for (const op of log) {
        if (op.startsWith('fillStyle=')) style = op;
        if (style === `fillStyle=${JSON.stringify(colour)}` && op.startsWith(`fillRect(${x * px + px * 0.15},${y * px + px * 0.15},`)) out.push(op);
    }
    return out;
};
const cellsOf = (m) => [...(m?.keys() ?? [])].map((k) => k.split(',').map(Number));

const L4 = () => regionWorld('level_4');
const STATES = {
    'L4-start': () => { const w = L4(); return [w, createState(w)]; },
    'L4-on-button': () => { const w = L4(); return [w, walk(w, INPUT_S, INPUT_S, INPUT_S)]; },
    'L4-block-pushed': () => { const w = L4(); return [w, walk(w, INPUT_S, INPUT_S, INPUT_S, INPUT_E)]; },
    'L4-pre-play': () => [L4(), null],
    'pull-start': () => { const w = regionWorld(PULL_REGION); return [w, createState(w)]; },
    'pull-dark-suit': () => {
        const w = regionWorld(PULL_REGION);
        const s = createState(w);
        return [w, { ...s, inventory: new Set([...s.inventory, 'Dark Suit']) }];
    },
};

describe('1. the plain view draws blocks and buttons at the maze\'s live state', () => {
    it('L4 at the start: a block marker on every block cell, every button UP (a ring, not filled)', () => {
        const [w, s] = STATES['L4-start']();
        expect(w.blocks?.size).toBeGreaterThan(0);
        expect(w.buttons?.size).toBeGreaterThan(0);
        const log = markerLog(w, viewOf(s));
        for (const [x, y] of cellsOf(w.blocks)) expect(fillsAt(log, COLORS.block, x, y), `block ${x},${y}`).toHaveLength(1);
        expect(log.filter((op) => op === 'fill()')).toHaveLength(0);
    });

    it('on the button: it is DOWN (filled); after the push the block is drawn where the maze has it, not where it began', () => {
        const [w, on] = STATES['L4-on-button']();
        expect(markerLog(w, viewOf(on)).filter((op) => op === 'fill()')).toHaveLength(1);
        const [w2, pushed] = STATES['L4-block-pushed']();
        const start = new Set(w2.blocks.keys());
        const moved = pushed.blocks.filter((k) => !start.has(k));
        expect(moved).toHaveLength(1);
        const log = markerLog(w2, viewOf(pushed));
        const [mx, my] = moved[0].split(',').map(Number);
        expect(fillsAt(log, COLORS.block, mx, my)).toHaveLength(1);
        for (const k of start) {
            if (pushed.blocks.includes(k)) continue;
            const [x, y] = k.split(',').map(Number);
            expect(fillsAt(log, COLORS.block, x, y), `the block left ${k}`).toHaveLength(0);
        }
    });

    it('`blocks: null` is the world\'s own layout (the pre-play view), and drawWorld carries the marker log verbatim', () => {
        const [w] = STATES['L4-pre-play']();
        const view = viewOf(null);
        const markers = markerLog(w, view);
        expect(markers).toEqual(markerLog(w, viewOf(createState(w), { playerPos: null })));
        const ctx = recordingContext();
        drawWorld(ctx, w, view);
        expect(ctx.__log.join('\n')).toContain(markers.join('\n'));
    });

    it('a world with no blocks, buttons or pulls draws no marker op at all', () => {
        const w = regionWorld('level_0__r1c6');
        expect(w.blocks?.size ?? 0).toBe(0);
        expect(markerLog(w, viewOf(createState(w)))).toEqual([]);
    });

    it('refuses a malformed `blocks` by name', () => {
        const [w, s] = STATES['L4-start']();
        expect(() => drawWorld(recordingContext(), w, { ...viewOf(s), blocks: new Set(s.blocks) }))
            .toThrow(/view\.blocks must be null or an array/);
    });
});

describe('2. a pull: its disc tinted, its trap cell marked', () => {
    it(`${PULL_REGION}: the disc is grey without the gate and live with it; the trap cell is marked either way`, () => {
        expect(PULL_REGION, 'the preset carries a pull').toBeTruthy();
        const [w, s] = STATES['pull-start']();
        const [, suit] = STATES['pull-dark-suit']();
        const off = markerLog(w, viewOf(s));
        const on = markerLog(w, viewOf(suit));
        expect(off).toContain(`fillStyle=${JSON.stringify(COLORS.pullInert)}`);
        expect(off).not.toContain(`fillStyle=${JSON.stringify(COLORS.pullLive)}`);
        expect(on).toContain(`fillStyle=${JSON.stringify(COLORS.pullLive)}`);
        for (const p of w.pulls) {
            expect(off.some((op) => op.startsWith(`arc(${p.x * 8 + 4},${p.y * 8 + 4},`)), `trap ${p.x},${p.y}`).toBe(true);
        }
        // every disc cell but the trap's, plus one mouth per trap
        const rects = off.filter((op) => op.startsWith('fillRect(')).length;
        expect(rects).toBe(w.pulls.reduce((n, p) => n + p.disc.size - 1, 0) + w.pulls.length);
    });
});

describe('3. with the art on, the art owns its cells', () => {
    it('a block, a button or a lava trap the sprites own draws no marker; the pull disc keeps its tint', () => {
        for (const name of ['L4-start', 'L4-block-pushed', 'pull-start']) {
            const [w, s] = STATES[name]();
            const census = seedlingCensus(w, RECORDS.get(w.atlas.level));
            const view = viewOf(s);
            const { cells } = seedlingSprites(census, art, { mazeWorld: w, view, blocks: s.blocks ?? null });
            const log = markerLog(w, view, cells);
            expect(log.filter((op) => op === 'fill()' || op === 'stroke()'), name).toEqual([]);
            expect(log.some((op) => op === `fillStyle=${JSON.stringify(COLORS.block)}`), name).toBe(false);
            if (w.pulls) expect(log).toContain(`fillStyle=${JSON.stringify(COLORS.pullInert)}`);
        }
    });
});

describe('4. the pull in the census', () => {
    it('every pull of the playthrough preset is claimed by exactly one LavaTrap, zero refusals; its sprite is drawn', () => {
        let pulls = 0;
        for (const [k, p] of PAYLOADS) {
            if (!p.pulls?.length) continue;
            const w = worldOf(p);
            const census = seedlingCensus(w, RECORDS.get(p.level));
            expect(census.refusals, k).toEqual([]);
            const rows = census.rows.filter((r) => r.what === 'pull');
            expect(rows.map((r) => r.cls), k).toEqual(w.pulls.map(() => 'LavaTrap'));
            expect(rows.map((r) => r.cells[0]).sort(), k).toEqual(w.pulls.map((t) => `${t.x},${t.y}`).sort());
            for (const t of w.pulls) expect(mazeModelledCells(w).has(`${t.x},${t.y}`), k).toBe(true);
            const { ops, cells } = seedlingSprites(census, art, { mazeWorld: w, view: viewOf(createState(w)) });
            for (const t of w.pulls) expect(cells.has(`${t.x},${t.y}`)).toBe(true);
            expect(ops.filter((op) => formatOp(op).includes('LavaTrap'))).toHaveLength(w.pulls.length);
            pulls += w.pulls.length;
        }
        expect(pulls).toBeGreaterThan(0);
    });

    it('refuses by name a pull on no lava trap, and one whose gate names a different lava trap', () => {
        const [w] = STATES['pull-start']();
        const [a, b] = w.pulls;
        const moved = { ...w, pulls: [{ ...a, x: a.x + 1 }] };
        expect(seedlingCensus(moved, RECORDS.get(w.atlas.level)).refusals.join('\n'))
            .toMatch(new RegExp(`pull ${a.gate} at ${a.x + 1},${a.y}: no entity of LavaTrap`));
        if (b) {
            const swapped = { ...w, pulls: [{ ...a, gate: b.gate }] };
            expect(seedlingCensus(swapped, RECORDS.get(w.atlas.level)).refusals.join('\n'))
                .toMatch(new RegExp(`pull ${b.gate} at ${a.x},${a.y}: names lavatrap@`));
        }
    });
});

describe('5. golden marker logs (a change detector of the marker draw)', () => {
    for (const [name, make] of Object.entries(STATES)) {
        it(name, () => {
            const [world, state] = make();
            const got = markerLog(world, viewOf(state));
            const path = join(GOLDENS, `${name}.txt`);
            if (process.env.UPDATE_MAZE_MARKER_GOLDENS) {
                mkdirSync(GOLDENS, { recursive: true });
                writeFileSync(path, `${got.join('\n')}\n`);
            }
            expect(existsSync(path), `${path} (record with UPDATE_MAZE_MARKER_GOLDENS=1)`).toBe(true);
            expect(got).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n'));
        });
    }
});
