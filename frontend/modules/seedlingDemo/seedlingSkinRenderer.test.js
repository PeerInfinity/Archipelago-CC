/**
 * seedlingSkinRenderer — G1's proof, in node, over the COMMITTED packs'
 * manifests (no pixels):
 *
 *   1. GOLDEN DRAW LISTS for four real rooms (L0 the start, L94, L36, L61):
 *      every `drawImage(sheet, sx, sy, dx, dy)` / `fillRect(...)` the renderer
 *      emits at tick 0, in paint order. They pin frame CHOICE, never pixels.
 *      ⚠ The goldens are a CHANGE DETECTOR recorded from this renderer
 *      (reviewed against the evidence screenshots). The independent stratum
 *      is (2): cells computed by hand from `Tile.check()` in the graphics
 *      investigation's worked example, before this renderer existed.
 *      Re-record after a deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   3. A MUTANT: one autotile neighbour bit flipped → the goldens go red.
 *   4. The painter on a recording ctx: ops → canvas calls, a missing sheet →
 *      its fallback rect.
 *   5. STATE IDENTITY: a real walk through the JS runtime gives byte-identical
 *      state and reports with the renderer running every tick and without it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { buildLevelWorld } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import {
    SCENERY, autotileMask, cameraView, cosmeticRand, formatOp, paintOps, poleFrame, roomOps, treeFrame,
} from './seedlingSkinRenderer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const roomOf = (level) => buildLevelWorld(levelSourceFromAtlas(MAP)(level));

export const GOLDEN_ROOMS = Object.freeze([0, 94, 36, 61]);

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

const goldenOf = (level, opts = {}) => roomOps(roomOf(level), art, { level, ...opts }).map(formatOp);

describe('1. golden draw lists (frame CHOICE, not pixels)', () => {
    for (const level of GOLDEN_ROOMS) {
        it(`level ${level}`, () => {
            const lines = goldenOf(level);
            const path = join(GOLDENS, `L${level}.txt`);
            if (process.env.UPDATE_SKIN_GOLDENS) {
                mkdirSync(GOLDENS, { recursive: true });
                writeFileSync(path, `${lines.join('\n')}\n`);
            }
            expect(existsSync(path), `${path} — record it with UPDATE_SKIN_GOLDENS=1`).toBe(true);
            expect(lines).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n'));
            // Not vacuous: the room is mostly SPRITES, not fallback rectangles.
            expect(lines.filter((l) => l.startsWith('drawImage(')).length).toBeGreaterThan(lines.length / 2);
        });
    }
});

describe('2. hand-computed cells (the investigation\'s worked example of level 0, `Tile.check()` by hand)', () => {
    const lines = () => goldenOf(0);
    it.each([
        ['(0,0) ground: right ground +1, down ground +8 → img 9', 'drawImage(seedling/Shore, 144, 0, 0, 0)'],
        ['(3,3) ground: all four → img 15', 'drawImage(seedling/Shore, 240, 0, 48, 48)'],
        ['(7,9) ground: up +2, left +4 (right and down are water) → img 6', 'drawImage(seedling/Shore, 96, 0, 112, 144)'],
        ['(5,9) brick: a single frame', 'drawImage(seedling/Brick, 0, 0, 80, 144)'],
        ['(14,7) cliff: a single frame', 'drawImage(seedling/Cliff, 0, 0, 224, 112)'],
    ])('%s', (_label, line) => {
        expect(lines()).toContain(line);
    });

    it('a building draws 8 px above its OEL position (Building.as:21), after the tiles', () => {
        const l = lines();
        const at = l.indexOf('drawImage(seedling/Building, 0, 0, 64, 56)');
        expect(at).toBeGreaterThan(l.lastIndexOf('drawImage(seedling/Shore, 240, 0, 48, 48)'));
    });

    it('⛓ G3c: `drawnObjects` drops the static solid a caller draws as a body (L42\'s crushers); omitted, every object is drawn', () => {
        const world = roomOf(42);
        const all = roomOps(world, art, { level: 42 });
        const crushers = world.objectSolids.filter((o) => o.tag === 'crusher');
        expect(crushers).toHaveLength(2);
        const dropped = roomOps(world, art, { level: 42, drawnObjects: (o) => o.tag === 'crusher' });
        expect(all.length - dropped.length).toBe(2);
        const rectsOf = (ops) => ops.filter((o) => o.rect && crushers.some((c) => c.rect.x === o.rect.x && c.rect.y === o.rect.y)).length;
        expect([rectsOf(all), rectsOf(dropped)]).toEqual([2, 0]);
    });

    it('Y-SORT: the player stands IN FRONT of a tree whose base is above him, BEHIND one whose base is below', () => {
        const world = roomOf(0);
        const tree = world.objectSolids.find((o) => o.tag === 'tree');
        const above = playerBoxAt(tree.x + 16, tree.y + 40);   // feet below the tree's base
        const behind = playerBoxAt(tree.x + 16, tree.y + 20);  // feet above it
        const order = (player) => {
            const ops = roomOps(world, art, { level: 0, player });
            return [ops.findIndex((o) => o.rect === player), ops.findIndex((o) => o.dx === tree.x && o.dy === tree.y && o.key === 'seedling:scenery/tree')];
        };
        const [pFront, tFront] = order(above);
        expect(pFront).toBeGreaterThan(tFront);
        const [pBack, tBack] = order(behind);
        expect(pBack).toBeLessThan(tBack);
    });
});

describe('the neighbour rules, on synthetic layouts', () => {
    it('Tile.check(): Cliff counts right/up/left but NOT below', () => {
        const grid = new Map([['1,1', 0], ['2,1', 9], ['1,0', 9], ['0,1', 9], ['1,2', 9]]);
        expect(autotileMask(grid, 1, 1, 0)).toBe(1 + 2 + 4);
        grid.set('1,2', 0);
        expect(autotileMask(grid, 1, 1, 0)).toBe(15);
    });

    it('Tree.getFrame(): a neighbour tree or the room edge; Pole: right +1, left +2, below +4', () => {
        const room = { width: 160, height: 160 };
        const a = { x: 32, y: 32 };
        const b = { x: 64, y: 32 };
        expect(treeFrame(a, [a, b], room)).toBe(1);
        expect(treeFrame(b, [a, b], room)).toBe(4);
        expect(treeFrame({ x: 0, y: 0 }, [], room)).toBe(2 + 4);
        const p = { x: 16, y: 16 };
        expect(poleFrame(p, [p, { x: 32, y: 16 }, { x: 0, y: 16 }, { x: 16, y: 32 }])).toBe(7);
    });

    it('cosmeticRand is a pure function of its arguments, in [0, 1)', () => {
        const v = cosmeticRand(94, 3, 4, 1);
        expect(cosmeticRand(94, 3, 4, 1)).toBe(v);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
        expect(cosmeticRand(94, 3, 4, 2)).not.toBe(v);
    });

    it('every SCENERY key and every tile key the renderer asks for is in the seedling pack (no silent rectangle)', () => {
        for (const spec of Object.values(SCENERY)) expect(art.has(spec.key), spec.key).toBe(true);
    });
});

describe('3. ⛔ THE MUTANT: one autotile neighbour bit flipped → the goldens go red', () => {
    it('bit 8 (below) dropped from the mask changes level 0\'s and level 94\'s lists', async () => {
        const mod = await import('./seedlingSkinRenderer.js');
        const mutant = (grid, tx, ty, t) => mod.autotileMask(grid, tx, ty, t) & ~8;
        for (const level of [0, 94]) {
            const golden = readFileSync(join(GOLDENS, `L${level}.txt`), 'utf8').trimEnd().split('\n');
            const lines = roomOps(roomOf(level), art, { level, mask: mutant }).map(formatOp);
            expect(lines).not.toEqual(golden);
            expect(lines.filter((l, i) => l !== golden[i]).length).toBeGreaterThan(10);
        }
    });
});

describe('4. the painter, on a recording ctx', () => {
    const recorder = () => {
        const calls = [];
        const ctx = new Proxy({ calls }, {
            get: (t, k) => (k === 'calls' ? calls : (...a) => calls.push([k, ...a])),
            set: (t, k, v) => { calls.push([`=${String(k)}`, v]); return true; },
        });
        return ctx;
    };
    const canvas = { width: 480, height: 480 };

    it('room mode: L0 (320 px) scales 1.5×, sprites go through drawImage with the sheet\'s image', () => {
        const world = roomOf(0);
        const ops = roomOps(world, art, { level: 0 });
        const images = new Map(art.sheetsInUse().map(({ sheetRef }) => [sheetRef, { name: sheetRef }]));
        const ctx = recorder();
        const counts = paintOps(ctx, ops, images, cameraView('room', world, { x: 0, y: 0 }), canvas);
        const draws = ctx.calls.filter((c) => c[0] === 'drawImage');
        expect(counts.sprites).toBe(draws.length);
        expect(counts.fallbacks).toBe(0);
        // the (3,3) cell: Shore frame 15 at (48, 48) → device (72, 72), 24 px square
        expect(draws).toContainEqual(['drawImage', { name: 'seedling/Shore' }, 240, 0, 16, 16, 72, 72, 24, 24]);
    });

    it('a sheet that never decoded draws its FALLBACK rectangle', () => {
        const world = roomOf(0);
        const ops = roomOps(world, art, { level: 0 });
        const ctx = recorder();
        const counts = paintOps(ctx, ops, new Map(), cameraView('room', world, { x: 0, y: 0 }), canvas);
        expect(counts.sprites).toBe(0);
        expect(counts.fallbacks).toBeGreaterThan(400);
        expect(ctx.calls.some((c) => c[0] === 'drawImage')).toBe(false);
    });

    it('follow mode: a 160×160 view at 3×, clamped like Game.view(); ops outside it are culled', () => {
        const world = roomOf(94);
        const view = cameraView('follow', world, { x: 8, y: 8 });
        expect(view).toEqual({ x: 0, y: 0, w: 160, h: 160 });
        expect(cameraView('follow', world, { x: 400, y: 400 })).toEqual({ x: 160, y: 160, w: 160, h: 160 });
        expect(cameraView('follow', roomOf(36), { x: 70, y: 70 })).toEqual({ x: -8, y: -8, w: 160, h: 160 });   // 144 px room: centred
        expect(cameraView('follow', world, { x: 0, y: 0 }, { cameraNow: { cam: { x: 37, y: 41 }, band: null } })).toEqual({ x: 37, y: 41, w: 160, h: 160 });
        const ops = roomOps(world, art, { level: 94 });
        const images = new Map(art.sheetsInUse().map(({ sheetRef }) => [sheetRef, { name: sheetRef }]));
        const counts = paintOps(recorder(), ops, images, view, canvas);
        expect(counts.sprites).toBeLessThan(ops.length / 2);
    });
});

describe('5. ⛔ STATE IDENTITY — the renderer never touches the run', () => {
    const teleportTo = (level, x, y) => ({ invocation: 'new_instance', className: 'Game', args: [level, x, y] });
    const KEYS = [...Array(40).fill(['right']), ...Array(30).fill(['down']), ...Array(50).fill(['left', 'up']),
        ...Array(30).fill(['up']), ...Array(20).fill([]), ...Array(60).fill(['right', 'down']), ...Array(200).fill(['up'])];

    /** A real walk: vanilla map, level 0 then level 94, the same keys; the per-tick state and every report. */
    function walk(render) {
        const reports = [];
        const rt = createJsRuntime({ onStateChanged: (n, v) => reports.push([n, v]), log: () => {} });
        rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
        rt.setVanilla(MAP);
        const trace = [];
        let drawn = 0;
        for (const [level, x, y] of [[0, 16, 128], [94, 152, 300]]) {
            rt.queueItems([{ class: 'game', property: 'menu', value: false }, teleportTo(level, x, y)]);
            for (const held of KEYS) {
                rt.tick(new Set(held));
                if (render) {
                    const view = rt.view();
                    if (view) {
                        const ops = roomOps(view.world, art, { level: view.level, tick: rt.ticks, player: playerBoxAt(view.state.x, view.state.y), apItems: view.apItems });
                        cameraView('follow', view.world, view.state, rt.run);
                        drawn += ops.map(formatOp).length;
                    }
                }
                trace.push(JSON.stringify([rt.ticks, rt.run?.level, rt.run?.state, rt.game.readState()]));
            }
        }
        return { trace, reports: JSON.stringify(reports), drawn };
    }

    it('state, readState and every report are byte-identical with the renderer on and off', () => {
        const off = walk(false);
        const on = walk(true);
        expect(on.drawn).toBeGreaterThan(1000);              // not vacuous: it really drew, every tick
        expect(new Set(off.trace.map((t) => JSON.parse(t)[1])).size).toBeGreaterThan(1);   // it really walked rooms
        expect(on.trace).toEqual(off.trace);
        expect(on.reports).toBe(off.reports);
    });
});
