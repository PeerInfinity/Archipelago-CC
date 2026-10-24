/**
 * ⛓ GRAPHICS G1.5 — THE STATIC TILE LAYER (`seedlingSkinRenderer.paintOps`' `tileLayer`), in node, over the
 * COMMITTED packs' manifests. Node has no canvas, so the proof runs on a COMPOSITING MODEL: a fake 2D context whose
 * every pixel keeps a hash of the SEQUENCE of writes it received (each write = the op's image, source rect,
 * orientation, alpha and device box), an opaque fill restarting it, and a blit of an offscreen model canvas copying
 * its pixels where they are opaque. Two paints whose every pixel saw the same writes in the same order give the
 * same pixels on any canvas (each write rasterises the same either way), so:
 *
 *   1. SAME PIXELS — real rooms (the four golden rooms, and L40/L12, the two biggest) at ticks that cross every
 *      tile animation's frame change: painting through ONE layer (built once, its second canvas redrawn only when
 *      an animated tile changes) gives the same per-pixel write sequence as drawing every op. Not vacuous: the
 *      layer holds most ops, hits more than it builds, and L40's water stays live.
 *   2. ⛔ THE STALE-LAYER PIN — a REAL run's tile write (L76's igneous tile turning to lava under
 *      `contactFidelity.igneousLava`, a `levelWorld.withTileWrites` overlay): the run's `world` is a NEW object
 *      from that tick, the page's key (`[run.world, art, level]`) rebuilds the layer, and every tick's pixels
 *      match. The MUTANT key without the world (the invalidation dropped) keeps the stale layer and differs.
 *   3. THE SPLIT RULE (`splitTileLayer`) on synthetic lists: a still tile over an earlier animated one stays live
 *      (and the closure carries on); a list that does not start with tiles bakes nothing; a pivoted op is
 *      "anywhere". Each painted through the layer = drawn op by op.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { buildLevelWorld } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { withContactFidelity } from './contactFidelity.js';
import { createTapeStepper } from './tapeRunner.js';
import {
    TILE_LAYER, cameraView, createTileLayer, paintOps, roomOps, splitTileLayer,
} from './seedlingSkinRenderer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const roomOf = (level) => buildLevelWorld(levelSourceFromAtlas(MAP)(level));
const BACKGROUND = '#101014';

let art;
let images;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
    images = new Map(art.sheetsInUse().map(({ sheetRef }) => [sheetRef, { name: sheetRef }]));
});

// ── the compositing model ─────────────────────────────────────────────────
const hashStr = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return h >>> 0;
};
const mix = (h, v) => (Math.imul(h ^ v, 0x9e3779b1) ^ (h >>> 13)) >>> 0;

/** A model canvas: `px[i]` = the hash of pixel i's write sequence, `opaque[i]` = an opaque write has covered it. */
function modelCanvas(width, height) {
    const px = new Uint32Array(width * height);
    const opaque = new Uint8Array(width * height);
    const canvas = { width, height, px, opaque, writes: 0 };
    let m = [1, 0, 0, 1, 0, 0];
    const stack = [];
    const state = { globalAlpha: 1, fillStyle: '#000' };
    const box = (x, y, w, h) => {
        const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([u, v]) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]]);
        const r = (v) => Math.round(v * 1e6) / 1e6;
        return { x0: Math.round(r(Math.min(...pts.map((p) => p[0])))), y0: Math.round(r(Math.min(...pts.map((p) => p[1])))),
            x1: Math.round(r(Math.max(...pts.map((p) => p[0])))), y1: Math.round(r(Math.max(...pts.map((p) => p[1])))) };
    };
    const each = (b, fn) => {
        for (let y = Math.max(0, b.y0); y < Math.min(height, b.y1); y++) {
            for (let x = Math.max(0, b.x0); x < Math.min(width, b.x1); x++) fn(y * width + x);
        }
    };
    const orient = () => m.slice(0, 4).map((v) => Math.round(v * 1000)).join(',');
    const ctx = {
        get globalAlpha() { return state.globalAlpha; },
        set globalAlpha(v) { state.globalAlpha = v; },
        get fillStyle() { return state.fillStyle; },
        set fillStyle(v) { state.fillStyle = v; },
        imageSmoothingEnabled: true,
        save() { stack.push(m.slice()); },
        restore() { m = stack.pop(); },
        translate(x, y) { m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
        scale(sx, sy) { m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]]; },
        rotate(t) {
            const c = Math.cos(t);
            const s = Math.sin(t);
            m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, -m[0] * s + m[2] * c, -m[1] * s + m[3] * c, m[4], m[5]];
        },
        fillRect(x, y, w, h) {
            const b = box(x, y, w, h);
            const sig = hashStr(`fill|${state.fillStyle}|${state.globalAlpha}|${b.x0},${b.y0},${b.x1},${b.y1}`);
            canvas.writes += 1;
            each(b, (i) => {
                if (state.globalAlpha === 1) { px[i] = sig; opaque[i] = 1; } else px[i] = mix(px[i], sig);
            });
        },
        drawImage(img, ...a) {
            canvas.writes += 1;
            if (img.px) {            // a model canvas, blitted whole at (0, 0)
                expect([a.length, a[0], a[1], img.width, img.height]).toEqual([2, 0, 0, width, height]);
                for (let i = 0; i < px.length; i++) {
                    if (img.opaque[i]) { px[i] = img.px[i]; opaque[i] = 1; } else px[i] = mix(px[i], img.px[i]);
                }
                return;
            }
            const [sx, sy, sw, sh, dx, dy, dw, dh] = a;
            const b = box(dx, dy, dw, dh);
            const sig = hashStr(`img|${img.name}|${sx},${sy},${sw},${sh}|${orient()}|${state.globalAlpha}|${b.x0},${b.y0},${b.x1},${b.y1}`);
            each(b, (i) => { px[i] = mix(px[i], sig); });
        },
    };
    canvas.getContext = () => ctx;
    return canvas;
}

/** One paint as the page does it: clear to the background, then `paintOps` (through `layer`, or op by op). */
function paint(ops, view, { layer = null, key = null, size = 480 } = {}) {
    const c = modelCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, size, size);
    const counts = paintOps(ctx, ops, images, view, c, { tileLayer: layer ? { layer, key, background: BACKGROUND } : null });
    return { px: c.px, counts, writes: c.writes };
}

/** The index of the first pixel whose write sequence differs, or -1. */
const firstDiff = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
    return -1;
};

// Every tile animation is on the world clock (45 ticks per frame span): these ticks cross each one's frame changes.
const TICKS = [0, 1, 7, 8, 9, 11, 12, 22, 23, 34, 45, 46, 67, 90, 91, 135];

describe('1. SAME PIXELS — a room painted through one layer = every op drawn', () => {
    for (const level of [0, 94, 36, 61, 40, 12]) {
        it(`level ${level}`, () => {
            const world = roomOf(level);
            const view = cameraView('room', world, { x: 0, y: 0 });
            const layer = createTileLayer((w, h) => modelCanvas(w, h));
            const player = playerBoxAt(world.world.width / 2, world.world.height / 2);
            for (const tick of TICKS) {
                const ops = roomOps(world, art, { level, tick, player });
                const plain = paint(ops, view);
                const layered = paint(ops, view, { layer, key: [world, art, level] });
                expect(firstDiff(plain.px, layered.px), `tick ${tick}`).toBe(-1);
                expect(layered.counts).toEqual(plain.counts);
            }
            expect(layer.builds).toBe(1);
            expect(layer.hits).toBe(TICKS.length - 1);
            expect(layer.bakedOps).toBeGreaterThan(50);
            expect(layer.frameBuilds).toBeLessThan(TICKS.length);
            if (level === 40) {
                // the biggest room: its water is live (redrawn only when the world clock moves it), the rest baked
                expect([layer.bakedOps, layer.liveOps]).toEqual([1658, 1278]);
                expect(layer.frameBuilds).toBeGreaterThan(1);
            }
        });
    }

    it('the cache keys on the view and the canvas: a new view or size rebuilds, the same one does not', () => {
        const world = roomOf(0);
        const layer = createTileLayer((w, h) => modelCanvas(w, h));
        const key = [world, art, 0];
        const ops = roomOps(world, art, { level: 0 });
        const room = cameraView('room', world, { x: 0, y: 0 });
        paint(ops, room, { layer, key });
        paint(ops, room, { layer, key });
        expect([layer.builds, layer.hits]).toEqual([1, 1]);
        const moved = { ...room, x: 16 };
        const a = paint(ops, moved, { layer, key });
        expect(firstDiff(a.px, paint(ops, moved).px)).toBe(-1);
        paint(ops, room, { layer, key, size: 320 });
        expect(layer.builds).toBe(3);
    });
});

describe('2. ⛔ THE STALE-LAYER PIN — a real run\'s tile write rebuilds the layer', () => {
    /**
     * Witness `igneous-l76-leg649` (`fixtures/igneous-witness/`, fidelityIgneous.test.js): the tile under the player
     * breaks and turns to lava — a write through `withTileWrites`, so `run.world` is a new object from that tick.
     */
    function walk(keyOf) {
        const tape = JSON.parse(readFileSync(join(HERE, 'fixtures/igneous-witness/igneous-l76-leg649.tape.json'), 'utf8'));
        const layer = createTileLayer((w, h) => modelCanvas(w, h));
        const worlds = new Set();
        let last = null;
        let changes = 0;
        let firstStale = null;
        let writeAt = null;
        withContactFidelity({ igneousLava: true }, () => {
            const st = createTapeStepper(tape, {
                levelSource: atlasLevelSource(),
                onTick: (t, s, h, run) => {
                    const world = run.world;
                    if (last && world !== last) { changes += 1; writeAt ??= t; }
                    last = world;
                    worlds.add(world);
                    if (firstStale !== null || (writeAt === null && t % 5 !== 0)) return;   // every write tick is checked
                    const view = cameraView('room', world, { x: 0, y: 0 });
                    const ops = roomOps(world, art, { level: run.level, tick: t, player: playerBoxAt(s.x, s.y) });
                    if (firstDiff(paint(ops, view).px, paint(ops, view, { layer, key: keyOf(world, run.level) }).px) !== -1) firstStale = t;
                },
            });
            for (let r = st.next(); !r.done; r = st.next());
        });
        return { worlds: worlds.size, changes, writeAt, firstStale, builds: layer.builds };
    }

    it('the run writes a tile mid-room (a new world object) and the layer, keyed on it, matches at every tick', () => {
        const r = walk((world, level) => [world, art, level]);
        expect(r.worlds).toBeGreaterThan(1);
        expect(r.writeAt).not.toBeNull();
        expect(r.firstStale).toBeNull();
        expect(r.builds).toBe(r.changes + 1);   // one build per world the run handed over (the death's restart is one)
    });

    it('MUTANT — the key without the world (no invalidation): the stale layer shows the old tile from the write on', () => {
        const r = walk((world, level) => [art, level]);
        expect(r.writeAt).not.toBeNull();
        expect(r.builds).toBe(1);
        expect(r.firstStale).toBe(r.writeAt);
    });
});

describe('3. the split rule (`splitTileLayer`) on synthetic lists', () => {
    const view = { x: 0, y: 0, w: 64, h: 64 };
    const pen = { view, X: (x) => x * 2, Y: (y) => y * 2 };
    const tile = (x, y, still, extra = {}) => ({
        key: 'k', sheetRef: still === false ? 'anim' : 'still', sx: 0, sy: 0, sw: 16, sh: 16, dx: x, dy: y, rot: 0, flipX: false, flipY: false,
        layer: TILE_LAYER, fallback: null, still, ...extra,
    });
    const body = (x, y) => ({ ...tile(x, y, undefined), layer: -y });
    const synthImages = () => new Map(['anim', 'still'].map((n) => [n, { name: n }]));

    it('a still tile over an EARLIER animated one stays live, and so does a still tile over that one', () => {
        const ops = [tile(0, 0, false), tile(8, 0, true), tile(20, 0, true), tile(32, 32, true)];
        expect([...splitTileLayer(ops, pen).baked]).toEqual([0, 0, 0, 1]);
    });

    it('an animated tile AFTER a still one does not unbake it (the baked one is drawn first either way)', () => {
        const ops = [tile(0, 0, true), tile(8, 0, false), body(4, 4)];
        const s = splitTileLayer(ops, pen);
        expect([s.run, ...s.baked]).toEqual([2, 1, 0]);
    });

    it('a list that does not START with tiles bakes nothing; a pivoted tile is "anywhere"', () => {
        expect(splitTileLayer([body(0, 0), tile(32, 32, true)], pen).run).toBe(0);
        const pivoted = tile(0, 0, false, { pivotX: 8, pivotY: 8, rot: 45 });
        expect([...splitTileLayer([pivoted, tile(32, 32, true)], pen).baked]).toEqual([0, 0]);
    });

    it('each list painted through the layer = drawn op by op', () => {
        const lists = [
            [tile(0, 0, false), tile(8, 0, true), tile(20, 0, true), tile(32, 32, true), body(10, 10)],
            [tile(0, 0, true), tile(8, 0, false, { rot: 90 }), body(4, 4)],
            [tile(0, 0, false, { pivotX: 8, pivotY: 8, rot: 45 }), tile(32, 32, true)],
        ];
        const saved = images;
        images = synthImages();
        try {
            for (const ops of lists) {
                const layer = createTileLayer((w, h) => modelCanvas(w, h));
                const a = paint(ops, view, { size: 128 });
                const b = paint(ops, view, { layer, key: ['synthetic'], size: 128 });
                expect(firstDiff(a.px, b.px)).toBe(-1);
            }
        } finally {
            images = saved;
        }
    });

    it('why the closure: drawn in an overlap-blind bake\'s order (the still tile first), the pixels differ', () => {
        const ops = [tile(0, 0, false), tile(8, 0, true)];
        const saved = images;
        images = synthImages();
        try {
            const a = paint(ops, view, { size: 128 });
            // reorder as an overlap-blind bake would draw it: the still tile under the animated one
            const b = paint([ops[1], ops[0]], view, { size: 128 });
            expect(firstDiff(a.px, b.px)).not.toBe(-1);
        } finally {
            images = saved;
        }
    });
});
