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
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { formatOp, PORTAL_KEY } from './seedlingSkinRenderer.js';
import { playerOps, stepPlayerSkin, SUIT_KEYS } from './seedlingPlayerSkin.js';
import { ENEMY_COLOUR, enemyOps, stepEnemySkin } from './seedlingEnemySkin.js';
import { generateSeedlingLevel } from './procgenSeedling.js';
import { POST_SWORD_PALETTE, PRE_SWORD_PALETTE } from './procgenPalette.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import {
    LAB_ART_TICK, _labArtRedrawForTests, _resetLabArtForTests, artParamOn, createLabArtPainter, labArt, labArtActive, labArtOps,
    labStillKey, rememberRoomRecord, roomRecordOf, setLabArtRedraw, staticBodyOps, staticPlayerOps,
    staticPlayerView, labDrawnObjects, placementBodies, placementRunOf, staticEntityOpsByFamily,
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
        // ⛓ L2b re-recorded (47/46/e43981c20c203035 → this): L4's block, button, arrow traps and torch are sprites now
        vanillaL4: { ops: 52, sprites: 52, digest: '1d35a21a5888b205' },
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

/**
 * ⛓ LAB L2b (seedling-lab-static-art-2): the room's OTHER objects — blocks, rocks, locks, buttons, traps, lamps,
 * hazards, NPCs, machines, the static enemies and the bosses — each ONE static frame through the js arc's own
 * skins, its run-only rows read off the room's tick-0 placement run (`placementRunOf`), overlaid with the sample.
 */
describe('5. L2b — the room\'s other objects, static', () => {
    const SOURCE = atlasLevelSource();
    const STAGING = Object.freeze({ boot: { level: 0, x: 0, y: 0 }, noclip: false, noHazards: [], noDamage: false,
        grants: [], persistence: [], equips: [] });
    /** A lab world as `makeWorldFor` builds it: the combat roles, the record AND the room's context. */
    const labWorld = (rec, levelSource = SOURCE) => rememberRoomRecord(buildLevelWorld(rec, { roles: ROLES }), rec,
        { levelSource, staging: { ...STAGING, boot: { ...STAGING.boot, level: rec.level } } });
    const without = (key) => ({ ...art, has: (q) => q !== key && art.has(q) });
    let guarded;
    beforeAll(() => {
        // a generated room with a pushable block, a button, a button-room and two locks (`guard;len=2`, seed 12)
        guarded = generateSeedlingLevel({
            seed: 12, palette: PRE_SWORD_PALETTE,
            skeleton: parseSkeleton('empty', { simulator: false, substrate: 'seedling' }),
            elements: parseElementSpec('guard;len=2'),
        }).record;
    }, 60000);

    /** ONE vanilla room per newly drawn family (and its golden), + the generated room. */
    const ROOMS = Object.freeze({
        L16: { level: 16, families: ['puzzle', 'solids', 'trap', 'lamp'] },   // block, rocks, lock, button, sandtraps, arrow traps
        L107: { level: 107, families: ['hazard', 'machine', 'solids'] },       // crusher, beam towers, pulser, button-room
        L34: { level: 34, families: ['npc'] },                                // the talkers
        L29: { level: 29, families: ['roomBody'] },                           // the turrets (static "Enemy" placements)
        L19: { level: 19, families: ['boss'] },                               // the shield boss
    });
    const GOLDEN = Object.freeze({
        L16: { ops: 253, sprites: 252, digest: 'f83191db9364eaa1' },
        L107: { ops: 219, sprites: 209, digest: '1717df1a32f39cec' },
        L34: { ops: 102, sprites: 102, digest: '8d786297011148f8' },
        L29: { ops: 286, sprites: 286, digest: '2646371c41d100f7' },
        L19: { ops: 129, sprites: 129, digest: 'c36b0833c03baee2' },
        guarded: { ops: 107, sprites: 107, digest: '36b4a2b5993a5aa5' },
    });
    const check = (name, ops) => {
        const got = { ops: ops.length, sprites: ops.filter((o) => o.sheetRef).length, digest: digest(ops) };
        if (process.env.PRINT_WATCH_ART_DIGESTS) console.log(name, JSON.stringify(got));
        expect(got).toEqual(GOLDEN[name]);
    };

    for (const [name, { level, families }] of Object.entries(ROOMS)) {
        it(`${name}: golden, and every family it holds (${families.join(', ')}) draws sprites, no stand-in left`, () => {
            const rec = recordOf(level);
            const world = labWorld(rec);
            expect(placementRunOf(world), 'the placement run builds').not.toBeNull();
            const by = staticEntityOpsByFamily(world, art, { record: rec, state: STATE });
            for (const f of families) expect(by[f].filter((o) => o.sheetRef).length, f).toBeGreaterThan(0);
            const ops = labArtOps(world, art, { record: rec, state: STATE, bodies: placementBodies(world) });
            const objects = [...world.objectSolids, ...world.pixelmasks].filter(labDrawnObjects(by));
            const standIns = ops.filter((o) => !o.key && o.rect && objects.some((s) => s.rect.x === o.rect.x && s.rect.y === o.rect.y));
            expect(standIns).toEqual([]);
            check(name, ops);
        });
    }

    it('the generated room (seed 12, `guard;len=2`): block, button, button-room and locks are sprites', () => {
        const world = labWorld(guarded, (n) => (n === guarded.level ? guarded : null));
        const ops = labArtOps(world, art, { record: guarded, state: { ...STATE, x: 40, y: 40 } });
        const keys = new Set(ops.map((o) => o.key).filter(Boolean));
        for (const k of ['seedling:puzzlement/pushableblock', 'seedling:puzzlement/button', 'seedling:puzzlement/buttonroom',
            'seedling:puzzlement/lock']) expect(keys.has(k), k).toBe(true);
        check('guarded', ops);
    });

    it('a world registered WITHOUT a context draws the world-derived half; a refusing build is null, not a throw', () => {
        const rec = recordOf(16);
        const bare = rememberRoomRecord(buildLevelWorld(rec, { roles: ROLES }), rec);
        expect(placementRunOf(bare)).toBeNull();
        const by = staticEntityOpsByFamily(bare, art, { record: rec });
        expect(by.puzzle.some((o) => o.key === 'seedling:puzzlement/pushableblock')).toBe(true);
        const broken = rememberRoomRecord(buildLevelWorld(rec, { roles: ROLES }), rec,
            { levelSource: () => { throw new Error('no such room'); }, staging: STAGING });
        expect(placementRunOf(broken)).toBeNull();
    });

    describe('state from the sample at the cursor (what the lab already knows)', () => {
        const rec = () => recordOf(16);
        const BLOCK = 'pushableblock@256,80';
        const ROCK = 'breakablerock@112,80';
        const LOCK = 'lock@320,112';
        /** A sample in `sampleMovers`' shape: the block's position, and the run's changes. */
        const sample = ({ block = { x: 256, y: 80 }, changes = [] } = {}) => ({
            level: 16, pushables: block ? [{ id: BLOCK, ...block, w: 16, h: 16 }] : [],
            changes, changeCounts: { placed: 6, byFamily: {}, changed: changes.length, blind: 0, families: 8 },
        });
        const opsOf = (s) => {
            const world = labWorld(rec());
            return staticEntityOpsByFamily(world, art, { record: rec(), state: STATE, sample: s });
        };
        const at = (ops, key) => ops.filter((o) => o.key === key);

        it('a PUSHED block is drawn at its sampled position; a SUNK one is gone', () => {
            const built = at(opsOf(sample()).puzzle, 'seedling:puzzlement/pushableblock');
            const pushed = at(opsOf(sample({ block: { x: 272, y: 80 } })).puzzle, 'seedling:puzzlement/pushableblock');
            expect(built).toHaveLength(1);
            expect(pushed).toHaveLength(1);
            expect(pushed[0].dx - built[0].dx).toBe(16);
            const sunk = opsOf(sample({ block: null, changes: [{ id: BLOCK, family: 'pushables', effect: 'gone', base: { x: 256, y: 80, w: 16, h: 16 } }] }));
            expect(at(sunk.puzzle, 'seedling:puzzlement/pushableblock')).toHaveLength(0);
        });

        it('a BROKEN rock is gone; an OPENED lock is gone; the others stay', () => {
            const before = opsOf(sample()).solids;
            const after = opsOf(sample({ changes: [{ id: ROCK, family: 'brokenRocks' }, { id: LOCK, family: 'openActivators' }] })).solids;
            expect(at(after, 'seedling:puzzlement/breakablerock')).toHaveLength(at(before, 'seedling:puzzlement/breakablerock').length - 1);
            expect(at(before, 'seedling:puzzlement/lock').length).toBeGreaterThan(0);
            expect(at(after, 'seedling:puzzlement/lock')).toHaveLength(0);
        });

        it('a sample of ANOTHER room, or one without a world census (`changeCounts: null`), leaves the build look', () => {
            const built = opsOf(null);
            const other = opsOf({ ...sample({ block: { x: 272, y: 80 }, changes: [{ id: ROCK, family: 'brokenRocks' }] }), level: 15 });
            const blind = opsOf({ ...sample({ changes: [{ id: ROCK, family: 'brokenRocks' }] }), changeCounts: null });
            expect(digest(other.solids)).toBe(digest(built.solids));
            expect(digest(other.puzzle)).toBe(digest(built.puzzle));
            expect(digest(blind.solids)).toBe(digest(built.solids));
        });
    });

    describe('STATIC over the new kinds — a scrub draws one frame set; the stepping MUTANT does not', () => {
        const TICKS = [0, 1, 7, 30, 59, 60, 61, 119, 240, 37, 3];
        /** Per room, the frames a scrub over `TICKS` draws, through `stepSkin`. */
        const scrub = (stepSkin) => Object.values(ROOMS).map(({ level }) => {
            const rec = recordOf(level);
            const world = labWorld(rec);
            return TICKS.map((tick) => {
                const by = staticEntityOpsByFamily(world, art, { record: rec, state: STATE, stepSkin: (step, view) => stepSkin(step, view, tick) });
                return Object.values(by).flatMap((o) => o ?? []).map((o) => `${o.key}#${o.frame}`).join(',');
            });
        });
        const real = (step, view) => step(null, view, LAB_ART_TICK);
        /** ⛔ THE MUTANT: steps every skin up to the scrub's tick (the animation the slice leaves out). */
        const mutant = (step, view, tick) => {
            let skin = null;
            for (let t = 0; t <= tick; t += 1) skin = step(skin, view, t);
            return skin;
        };
        it('the real builders: ONE frame set per room across the whole scrub', () => {
            for (const frames of scrub(real)) expect(new Set(frames).size).toBe(1);
        });
        it('⛔ the stepping MUTANT gives more than one in some room (so the check can see animation)', () => {
            expect(scrub(mutant).some((frames) => new Set(frames).size > 1)).toBe(true);
        });
    });

    describe('fallback: each new kind with its sheet missing is its rectangle', () => {
        const CASES = [
            [16, 'puzzle', 'seedling:puzzlement/pushableblock'], [16, 'puzzle', 'seedling:enemy/sandtrap'],
            [16, 'solids', 'seedling:puzzlement/lock'], [16, 'solids', 'seedling:puzzlement/breakablerock'],
            [16, 'solids', 'seedling:puzzlement/button'], [16, 'trap', 'seedling:puzzlement/arrowtrap'],
            [16, 'lamp', 'seedling:scenery/torch'], [107, 'hazard', 'seedling:puzzlement/crusher'],
            [72, 'hazard', 'seedling:puzzlement/lavachain'], [107, 'machine', 'seedling:machine/pulser'],
            [107, 'machine', 'seedling:machine/beamtower'], [113, 'machine', 'seedling:scenery/finaldoor'],
            [34, 'npc', 'seedling:npc/introchar'], [29, 'roomBody', 'seedling:enemy/turret'],
            [22, 'roomBody', 'seedling:enemy/wallflyer'], [98, 'roomBody', 'seedling:enemy/iceturret'],
            [19, 'boss', 'seedling:boss/shieldboss'], [57, 'boss', 'seedling:boss/tentaclebeast'],
            [82, 'boss', 'seedling:boss/lavaboss'],
        ];
        for (const [level, family, key] of CASES) {
            it(`L${level} ${family}: ${key}`, () => {
                const rec = recordOf(level);
                const world = labWorld(rec);
                const withArt = staticEntityOpsByFamily(world, art, { record: rec })[family];
                const missing = staticEntityOpsByFamily(world, without(key), { record: rec })[family];
                const drawn = withArt.filter((o) => o.key === key).length;
                expect(drawn).toBeGreaterThan(0);
                expect(missing.filter((o) => o.key === key)).toHaveLength(0);
                const rects = (ops) => ops.filter((o) => !o.key && o.rect).length;
                expect(rects(missing) - rects(withArt)).toBe(drawn);
            });
        }
    });
});
