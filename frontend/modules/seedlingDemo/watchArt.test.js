/**
 * watchArt — lab arc L2 (seedling-lab-static-art): the lab viewer's STATIC original graphics, in node over the
 * COMMITTED packs and map (no pixels; a recording fake canvas where a paint is needed).
 *
 *   1. GOLDEN draw lists (`formatOp`, as a digest) for one vanilla room and one generated room — a CHANGE
 *      DETECTOR of what the lab draws. Re-record after a deliberate change: print with
 *      `PRINT_WATCH_ART_DIGESTS=1 npx vitest run <this file>` and paste.
 *   2. The cached tile layer: a repaint of the same world HITS, an edited world (a new world object, which is
 *      what every edit path builds) REBUILDS, another canvas has its own layer.
 *   3. STATIC: the frame is not a function of the tick. A scrub over many ticks draws the same frames; a MUTANT
 *      that steps the skin (the animated behaviour the slice leaves out) fails the same check.
 *   4. Fallbacks: a key the stack lacks is its rectangle; no art at all is not active; the toggle and `?art=`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { buildLevelWorld } from './levelWorld.js';
import { formatOp, PORTAL_KEY } from './seedlingSkinRenderer.js';
import { playerOps, stepPlayerSkin, SUIT_KEYS } from './seedlingPlayerSkin.js';
import { ENEMY_COLOUR, enemyOps, stepEnemySkin } from './seedlingEnemySkin.js';
import { generateSeedlingLevel } from './procgenSeedling.js';
import { POST_SWORD_PALETTE } from './procgenPalette.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import {
    LAB_ART_TICK, _labArtRedrawForTests, _resetLabArtForTests, artParamOn, createLabArtPainter, labArt, labArtActive, labArtOps,
    labStillKey, rememberRoomRecord, roomRecordOf, setLabArtRedraw, staticBodyOps, staticPlayerOps,
    staticPlayerView,
} from './watchArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const recordOf = (level) => MAP.levels.find((r) => r.level === level);
const digest = (ops) => createHash('sha256').update(ops.map(formatOp).join('\n')).digest('hex').slice(0, 16);

/** A fixed scene: the player mid-room, a bob and a spinner (the sample's body shapes). */
const STATE = Object.freeze({ x: 80, y: 88, direction: 3, terrain: 0 });
const BODIES = Object.freeze([
    Object.freeze({ id: 'c1', kind: 'chaser', tag: 'bob', x: 56, y: 60 }),
    Object.freeze({ id: 's1', kind: 'spinner', tag: 'spinner', x: 120, y: 40 }),
]);

/** A recording canvas: enough of the 2d context for `paintOps` and the tile layer. */
function fakeCanvas(w = 0, h = 0) {
    const calls = [];
    const ctx = new Proxy({ calls }, {
        get(t, k) {
            if (k in t) return t[k];
            return (...args) => { calls.push([k, ...args]); };
        },
        set(t, k, v) { t[k] = v; return true; },
    });
    return { width: w, height: h, getContext: () => ctx, ctx };
}
const IMAGES = new Map();

let art;
let generated;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
    generated = generateSeedlingLevel({
        seed: 1, palette: POST_SWORD_PALETTE,
        bounds: { obstacleTarget: 1, triesPerStep: 1, saturationK: 1 },
        defaults: { width: 8, height: 6 },
        skeleton: parseSkeleton('empty', { substrate: 'seedling' }),
        elements: parseElementSpec('none'),
    }).record;
}, 60000);

describe('1. golden draw lists (a change detector of the lab\'s picture)', () => {
    const GOLDEN = Object.freeze({
        vanillaL4: { ops: 47, sprites: 46, digest: 'e43981c20c203035' },
        generated: { ops: 50, sprites: 50, digest: '82236f89fe3ec577' },
    });
    const check = (name, ops) => {
        const got = { ops: ops.length, sprites: ops.filter((o) => o.sheetRef).length, digest: digest(ops) };
        if (process.env.PRINT_WATCH_ART_DIGESTS) console.log(name, JSON.stringify(got));
        expect(got).toEqual(GOLDEN[name]);
    };

    it('vanilla L4 with the player and two bodies', () => {
        const rec = recordOf(4);
        check('vanillaL4', labArtOps(buildLevelWorld(rec), art, { record: rec, state: STATE, bodies: BODIES }));
    });

    it('a generated room (seed 1, 8×6, post-sword) with the player', () => {
        check('generated', labArtOps(buildLevelWorld(generated), art,
            { record: generated, state: { ...STATE, x: 40, y: 40 } }));
    });

    it('the art replaces the rectangles: the room is sprites, the player is the suit, the bodies are their sheets', () => {
        const rec = recordOf(4);
        const ops = labArtOps(buildLevelWorld(rec), art, { record: rec, state: STATE, bodies: BODIES });
        const keys = new Set(ops.map((o) => o.key).filter(Boolean));
        expect(keys.has(SUIT_KEYS.blue)).toBe(true);
        expect(keys.has('seedling:enemy/bob')).toBe(true);
        expect(keys.has('seedling:enemy/spinner')).toBe(true);
        expect([...keys].some((k) => k.startsWith('seedling:tile/'))).toBe(true);
    });

    it('a SHOWN teleporter is the portal; the record rides with the world (`rememberRoomRecord`)', () => {
        const rec = MAP.levels.find((r) => (r.entities ?? []).some((e) => e.type === 'teleporter'
            && Number(e.attrs?.show ?? 0) !== 0));
        expect(rec, 'the vanilla map has a shown teleporter').toBeTruthy();
        const world = rememberRoomRecord(buildLevelWorld(rec), rec);
        expect(roomRecordOf(world)).toBe(rec);
        const ops = labArtOps(world, art, { record: roomRecordOf(world) });
        expect(ops.some((o) => o.key === PORTAL_KEY)).toBe(true);
        expect(labArtOps(world, art, {}).some((o) => o.key === PORTAL_KEY)).toBe(false);
    });
});

describe('2. the cached tile layer — invalidated by an edit, pinned', () => {
    it('same world: one build, then hits; an EDITED world (new object): a rebuild; another canvas: its own layer', () => {
        const painter = createLabArtPainter((w, h) => fakeCanvas(w, h));
        const rec = recordOf(4);
        const world = buildLevelWorld(rec);
        const canvas = fakeCanvas(world.world.width * 2, world.world.height * 2);
        const paint = (w, c = canvas) => painter.paint(c.ctx, c, w, labArtOps(w, art, { record: rec, state: STATE }), IMAGES, art);
        paint(world);
        paint(world);
        paint(world);
        const layer = painter.layerOf(canvas);
        expect({ builds: layer.builds, hits: layer.hits }).toEqual({ builds: 1, hits: 2 });

        // an edit: one tile changed type, through the record — the editor's path builds a new world from it
        const edited = structuredClone(rec);
        const tilesLayer = edited.layers.find((l) => Array.isArray(l.tiles) && l.tiles.length);
        const t0 = tilesLayer.tiles[0];
        tilesLayer.tiles[0] = [t0[0], t0[1], (t0[2] + 16) % 256, t0[3], ...t0.slice(4)];
        const editedWorld = buildLevelWorld(edited);
        expect(digest(labArtOps(editedWorld, art, {}))).not.toBe(digest(labArtOps(world, art, {})));
        paint(editedWorld);
        expect(layer.builds).toBe(2);
        paint(editedWorld);
        expect({ builds: layer.builds, hits: layer.hits }).toEqual({ builds: 2, hits: 3 });

        const other = fakeCanvas(canvas.width, canvas.height);
        paint(world, other);
        expect(painter.layerOf(other)).not.toBe(layer);
        expect(painter.layerOf(other).builds).toBe(1);
        expect(layer.builds).toBe(2);
    });

    it('the set editor\'s still key: stable per (source, mode), different across the toggle', () => {
        const source = { record: {} };
        expect(labStillKey(source, true)).toBe(labStillKey(source, true));
        expect(labStillKey(source, false)).toBe(labStillKey(source, false));
        expect(labStillKey(source, true)).not.toBe(labStillKey(source, false));
        expect(labStillKey({ record: {} }, true)).not.toBe(labStillKey(source, true));
        expect(labStillKey(null, true)).toBe(null);
    });
});

describe('3. STATIC — the frame is not a function of the tick', () => {
    /** The frames a scrub over `ticks` would draw, through `opsAt(tick, state, bodies)`. */
    const scrub = (opsAt) => [0, 1, 7, 30, 59, 60, 61, 119, 240, 37, 3].map((tick) => {
        const ops = opsAt(tick, { ...STATE, x: STATE.x + (tick % 5) }, BODIES.map((b) => ({ ...b, x: b.x + (tick % 3) })));
        return ops.map((o) => `${o.key}#${o.frame}`).join(',');
    });
    const real = (tick, state, bodies) => [...staticPlayerOps(state, art), ...staticBodyOps(bodies, art)];

    /** ⛔ THE MUTANT: steps the player's and the bodies' skins up to `tick` (the animation the slice leaves out). */
    const mutant = (tick, state, bodies) => {
        const view = staticPlayerView(state);
        let pskin = null;
        for (let t = 0; t <= tick; t += 1) pskin = stepPlayerSkin(pskin, view, t);
        const ev = { epoch: { run: 1, key: 'k' }, level: 0, gameTime: null, player: { x: state.x, y: state.y },
            chasers: bodies.filter((b) => b.kind === 'chaser').map((b) => ({ ...b, vx: 0, vy: 0, hits: 0, hitsTimer: 0,
                dying: false, destroy: false, alpha: 1 })),
            spinners: [], arrows: [], terrain: () => 0 };
        let eskin = null;
        for (let t = 0; t <= tick; t += 1) eskin = stepEnemySkin(eskin, ev, t);
        return [...playerOps(view, art, { tick, skin: pskin }), ...enemyOps(ev, art, { skin: eskin })];
    };

    it('the real builders draw ONE frame set across the whole scrub (forwards and backwards)', () => {
        const frames = scrub(real);
        expect(new Set(frames).size).toBe(1);
        expect(frames[0]).toMatch(/seedling:player\/shrum#\d+/);
    });

    it('⛔ the stepping MUTANT fails that same check (so the check can see animation)', () => {
        expect(new Set(scrub(mutant)).size).toBeGreaterThan(1);
    });

    it('the one tick is 0', () => { expect(LAB_ART_TICK).toBe(0); });

    it('a pose is still read from the state: a left-facing stand is mirrored, an up-facing one is another frame', () => {
        const down = staticPlayerOps({ ...STATE, direction: 3 }, art)[0];
        const left = staticPlayerOps({ ...STATE, direction: 2 }, art)[0];
        const right = staticPlayerOps({ ...STATE, direction: 0 }, art)[0];
        const up = staticPlayerOps({ ...STATE, direction: 1 }, art)[0];
        expect(left.flipX).toBe(true);
        expect(right.flipX).toBe(false);
        expect(left.frame).toBe(right.frame);
        expect(up.frame).not.toBe(down.frame);
    });
});

describe('4. fallbacks', () => {
    /** The library with ONE key withheld. */
    // the library's methods are closures (no `this`), so a spread copy with one `has` swapped is the library minus a key
    const without = (key) => ({ ...art, has: (q) => q !== key && art.has(q) });

    it('a body whose sheet is missing is its hitbox rectangle; the others keep their art', () => {
        const ops = staticBodyOps(BODIES, without('seedling:enemy/bob'));
        const bob = ops.find((o) => !o.sheetRef);
        expect(bob).toMatchObject({ colour: ENEMY_COLOUR });
        expect(ops.some((o) => o.key === 'seedling:enemy/spinner')).toBe(true);
    });

    it('no suit in the stack: the player is the white box (roomOps\' own fallback)', () => {
        const rec = recordOf(4);
        const ops = labArtOps(buildLevelWorld(rec), without(SUIT_KEYS.blue), { record: rec, state: STATE });
        expect(ops.some((o) => o.key === SUIT_KEYS.blue)).toBe(false);
        expect(ops.some((o) => !o.sheetRef && o.colour === '#ffffff')).toBe(true);
    });

    it('a failed or pending load is not active (the page draws its rectangles); the toggle turns it off', () => {
        _resetLabArtForTests();
        expect(labArtActive()).toBe(false);
        Object.assign(labArt, { status: 'failed', why: 'HTTP 404' });
        expect(labArtActive()).toBe(false);
        Object.assign(labArt, { status: 'ready', art, images: IMAGES });
        expect(labArtActive()).toBe(true);
        labArt.on = false;
        expect(labArtActive()).toBe(false);
        _resetLabArtForTests();
    });

    it('`?art=off|0|false` defaults the toggle off; anything else (or nothing) on', () => {
        for (const s of ['?art=off', '?art=0', '?x=1&art=false']) expect(artParamOn(s), s).toBe(false);
        for (const s of ['', '?art=on', '?art=1', '?layers=player', undefined]) expect(artParamOn(s), String(s)).toBe(true);
    });

    it('the redraw slot: a retired arm clears only its own registration', () => {
        _resetLabArtForTests();
        const retire = [];
        const lifetime = { onRetire: (fn) => retire.push(fn) };
        const a = () => {};
        const b = () => {};
        setLabArtRedraw(a, lifetime);
        expect(_labArtRedrawForTests()).toBe(a);
        setLabArtRedraw(b, null);
        retire.forEach((fn) => fn());
        expect(_labArtRedrawForTests()).toBe(b);
        setLabArtRedraw(a, lifetime);
        retire.forEach((fn) => fn());
        expect(_labArtRedrawForTests()).toBe(null);
        _resetLabArtForTests();
    });
});
