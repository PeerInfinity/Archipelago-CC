/**
 * seedlingEnemySkin — G3's proof, in node, over the COMMITTED seedling pack's
 * manifest (no pixels):
 *
 *   1. ONE REAL TAPE PER FAMILY through the JS runtime, in a room where that
 *      family lives (the census: `seedling-map.json`'s rooms by class), with
 *      the sword staged and swung: every tick's body ops are a golden line
 *      `(key#frame, sheet, sx, sy, dx, dy, rot, flip, scale, alpha, tint)` plus
 *      each body's playing anim.
 *   2. SYNTHETIC VIEWS for what the tapes do not reach: a pit fall, a spinner's
 *      death, every AP item look.
 *      ⚠ (1) and (2) are CHANGE DETECTORS recorded from this renderer.
 *      Re-record after a deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   3. THE INDEPENDENT STRATUM: frames, tints and turns computed BY HAND from
 *      the AS3 (`Spritemap.as`, `Enemy.as`, `Bob.as`, `Puncher.as`, …).
 *   4. ONE MUTANT PER RULE (`ENEMY_RULES`, and per family): each turns a golden red.
 *   5. THE ADAPTER reads the run and writes nothing (a run that throws on any write).
 *   6. ⛔ STATE IDENTITY: each tape's per-tick state (the bodies included),
 *      `readState()` and the `stateLog` hash byte-identical with the adapter,
 *      the reducer, the ops and `roomOps` running every tick, and without.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { md5 } from './md5.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { formatOp, roomOps } from './seedlingSkinRenderer.js';
import { formatPlayerOp } from './seedlingPlayerSkin.js';
import {
    AP_LOGO_KEY, ENEMY_ART, ENEMY_COVERAGE, ENEMY_FAMILIES, ENEMY_HIT_TINT, ENEMY_RULES, apItemOps, apLookKey,
    enemyOps, enemySkinView, familyOf, stepEnemySkin, updateSprite, worldFrame,
} from './seedlingEnemySkin.js';
import { CHASERS } from './chasers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/** Stand and swing, step left, swing right, swing down, step up — enough to draw each family's walk, hit and death. */
const FIGHT = ['primary', '', '', '', '', '', '', '', '', 'left', 'left', '', '', '', '', '', '', '', '', 'right+primary',
    '', '', '', '', '', '', '', '', '', '', '', 'down+primary', '', '', '', '', '', '', '', 'up', 'up', '', '', ''];
const CHOP = ['primary', '', '', '', '', '', '', '', '', '', '', '', '', ''];

/**
 * THE TAPES — one per family, in a room the census puts it in. `at` is the
 * `Game(level, x, y)` spawn; `want` is what the tape must really reach.
 */
export const TAPES = Object.freeze([
    { name: 'bob-L14', level: 14, at: [16, 112], n: 300, keys: FIGHT, family: 'Bob', want: { anims: ['walk', 'die'], tint: true, fade: true } },
    { name: 'lavarunner-L71', level: 71, at: [96, 200], n: 300, keys: FIGHT, family: 'LavaRunner', want: { anims: ['walk', 'die'], tint: true, mirror: true } },
    { name: 'lavarunner-L72', level: 72, at: [120, 200], n: 160, keys: CHOP, family: 'LavaRunner', want: { anims: ['swim'] } },
    { name: 'jellyfish-L98', level: 98, at: [100, 80], n: 200, keys: FIGHT, family: 'Jellyfish', want: { anims: ['walk'] } },
    { name: 'flyer-L101', level: 101, at: [120, 250], n: 120, keys: [''], family: 'Flyer', want: { anims: ['fall'] } },
    { name: 'flyer-walk-L101', level: 101, at: [112, 240], n: 120, keys: ['left'], family: 'Flyer', want: { anims: ['walk'] } },
    { name: 'bulb-L74', level: 74, at: [80, 100], n: 300, keys: FIGHT, family: 'Bulb', want: { anims: ['walk', 'drop', 'die'] } },
    { name: 'puncher-L26', level: 26, at: [48, 160], n: 300, keys: FIGHT, family: 'Puncher', want: { anims: ['walk-up', 'walk-side', 'attack-up', 'stand-up'], tint: true, mirror: true } },
    { name: 'bobsoldier-L30', level: 30, at: [80, 80], n: 200, keys: FIGHT, family: 'BobSoldier', want: { anims: ['walk'], keys: ['seedling:enemy/lameSword'], tint: true } },
    { name: 'spinner-L18', level: 18, at: [80, 80], n: 200, keys: FIGHT, family: 'Spinner', want: { keys: ['seedling:enemy/spinner'], tint: true } },
    { name: 'arrow-L67', level: 67, at: [48, 80], n: 120, keys: ['up'], family: 'Arrow', want: { keys: ['seedling:projectile/arrow'], fade: true } },
]);

function boot(level, [x, y], onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { class: 'Main', property: 'hasSword', value: true },
        { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}
const keysOf = (tape) => Array.from({ length: tape.n }, (_, i) => tape.keys[i % tape.keys.length]).map((k) => new Set(k ? k.split('+') : []));

/** Run a tape; per tick: the view, the skin and the ops (the renderer, as the page runs it). */
function runTape(tape, opts = {}) {
    const rt = boot(tape.level, tape.at);
    const rows = [];
    let skin = null;
    for (const held of keysOf(tape)) {
        rt.tick(held);
        const view = enemySkinView(rt.run);
        skin = stepEnemySkin(skin, view, rt.ticks, opts);
        rows.push({ tick: rt.ticks, view, skin, ops: enemyOps(view, art, { skin, ...opts }) });
    }
    return rows;
}
const animsOf = (skin) => [...skin.bodies.values()].map((s) => s.sprite?.anim ?? '-').join(',');
const lineOf = (r) => `t=${r.tick} [${animsOf(r.skin)}] | ${r.ops.map((o) => formatPlayerOp(o, formatOp)).join(' ; ')}`.trimEnd();

function golden(name, lines) {
    const path = join(GOLDENS, name);
    if (process.env.UPDATE_SKIN_GOLDENS) {
        mkdirSync(GOLDENS, { recursive: true });
        writeFileSync(path, `${lines.join('\n')}\n`);
    }
    expect(existsSync(path), `${path} — record it with UPDATE_SKIN_GOLDENS=1`).toBe(true);
    return readFileSync(path, 'utf8').trimEnd().split('\n');
}

// ── synthetic views ───────────────────────────────────────────────────────
const RUN = {};
const V = (over = {}) => ({ epoch: { run: RUN, key: 'syn' }, level: 9, gameTime: 900, player: { x: 300, y: 300 }, chasers: [], spinners: [], arrows: [], terrain: () => 0, ...over });
const bob = (over = {}) => ({ id: 'bob@0', tag: 'bob', x: 80, y: 80, vx: 0, vy: 0, hits: 0, hitsTimer: 0, dying: false, destroy: false, alpha: 1, ...over });
export function syntheticViews() {
    const v = [];
    for (let k = 1; k <= 8; k += 1) v.push(V({ gameTime: 900 + k, chasers: [bob({ alpha: 1 - 0.05 * k })] }));                    // a pit fall
    for (let k = 0; k < 8; k += 1) v.push(V({ gameTime: 910 + k, spinners: [{ id: 'sp@1', x: 64, y: 64, hits: k < 2 ? 2 : 3, hitsTimer: k < 2 ? 0 : 30, destroy: k >= 2, alpha: k < 2 ? 1 : 1 - 0.1 * (k - 1) }] }));
    for (const v2 of [{ vx: 2, vy: 0 }, { vx: 0, vy: -2 }, { vx: -1.5, vy: 1.5 }, { vx: 0, vy: 0 }]) {
        v.push(V({ gameTime: 930, arrows: [{ id: 'ar@1', x: 40, y: 40, ...v2, die: v2.vx === 0 && v2.vy === 0, alpha: 1 }] }));
    }
    return v;
}
function runSynthetic(opts = {}) {
    let skin = null;
    return syntheticViews().map((view, i) => {
        const tick = 2000 + i;
        skin = stepEnemySkin(skin, view, tick, opts);
        return { tick, view, skin, ops: enemyOps(view, art, { skin, ...opts }) };
    });
}
const LOOKS = ['ap', 'sword', 'shield', 'darkshield', 'conch', 'feather', 'wand', 'firewand', 'ghostspear', 'ghostsword', 'darksuit',
    'torchpickup', 'health', 'totempart', 'chest', 'seed', 'bosskey0', 'bosskey4', 'bosskey9', 'nonsense'];
const apItemsOf = () => LOOKS.map((look, i) => ({ look, x: 16 * i, y: 32, tag: i, rect: { x: 16 * i + 4, y: 36, right: 16 * i + 12, bottom: 44 } }));

describe('1–2. golden body ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} tape: every tick's ${tape.family} ops`, () => {
            const rows = runTape(tape);
            const lines = rows.map(lineOf);
            expect(lines).toEqual(golden(`enemy-${tape.name}.txt`, lines));
            // not vacuous: the tape really reached each state it is named for
            const anims = new Set(rows.flatMap((r) => [...r.skin.bodies.values()].map((s) => s.sprite?.anim)));
            for (const a of tape.want.anims ?? []) expect(anims, `${tape.name}: anim ${a}`).toContain(a);
            const ops = rows.flatMap((r) => r.ops);
            for (const k of tape.want.keys ?? []) expect(ops.some((o) => o.key === k), `${tape.name}: key ${k}`).toBe(true);
            if (tape.want.tint) expect(ops.some((o) => o.tint === ENEMY_HIT_TINT), `${tape.name}: a hit flash`).toBe(true);
            if (tape.want.fade) expect(ops.some((o) => o.alpha !== undefined && o.alpha < 1), `${tape.name}: a fade`).toBe(true);
            if (tape.want.mirror) expect(ops.some((o) => o.flipX), `${tape.name}: a mirror`).toBe(true);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        });
    }

    it('the synthetic views: a pit fall, a spinner\'s death, an arrow turning and stopping', () => {
        const lines = runSynthetic().map(lineOf);
        expect(lines).toEqual(golden('enemy-synthetic.txt', lines));
    });

    it('every AP item look', () => {
        const lines = apItemOps(apItemsOf(), art, '#e8c040').map((o) => formatPlayerOp(o, formatOp));
        expect(lines).toEqual(golden('apitem-looks.txt', lines));
    });

    it('the coverage table names every chaser class the run models, and the drawn ones each have a family + art', () => {
        for (const c of Object.values(CHASERS)) expect(ENEMY_COVERAGE.drawn, c.as3).toContain(c.as3);
        for (const cls of Object.keys(ENEMY_FAMILIES)) {
            expect(ENEMY_COVERAGE.drawn).toContain(cls);
            expect(art.has(ENEMY_FAMILIES[cls].key), cls).toBe(true);
        }
        const drawn = new Set(ENEMY_COVERAGE.drawn);
        for (const cls of [...ENEMY_COVERAGE.modelled, ...ENEMY_COVERAGE.remaining]) expect(drawn.has(cls), cls).toBe(false);
        // every art row reached the committed pack
        for (const r of ENEMY_ART) expect(art.has(r.key), r.key).toBe(true);
    });
});

describe('3. the independent stratum (by hand from the AS3)', () => {
    /** Step one synthetic bob through `n` views; return each tick's drawn frame. */
    function bobFrames(views) {
        let skin = null;
        return views.map((view, i) => {
            skin = stepEnemySkin(skin, view, 3000 + i);
            return { frame: enemyOps(view, art, { skin })[0], anim: skin.bodies.get('c:bob@0').sprite.anim };
        });
    }

    it('Bob\'s walk (Bob.as:36, fps 10 one-shot, sitFrames [0,1,2,1]): 0,0,0,1,1,1,2,2,2,1,1,1, then "" shows 0, then it restarts', () => {
        // The player is 50 px away (< runRange 80): `play("walk")` on the first update; FP.elapsed 0.0333 → +0.333 a tick.
        const views = Array.from({ length: 14 }, (_, k) => V({ gameTime: 1000 + k, player: { x: 130, y: 80 }, chasers: [bob()] }));
        const got = bobFrames(views);
        expect(got.map((g) => g.frame.frame)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 1, 1, 1, 0, 0]);
        expect(got.map((g) => g.anim)).toEqual([...Array(12).fill('walk'), '', 'walk']);
    });

    it('Bob idle (out of range): sitFrames[worldFrame(4)] — Game.time 0..44 shows 0 for t < 11.25, 1 to 22.5, 2 to 33.75, then 1', () => {
        // `time` is what the body READ: the top of its frame, i.e. the PREVIOUS step's `gameTime` (the first: gameTime − 1).
        const views = [10, 11, 12, 22, 23, 33, 34, 44, 45].map((t) => V({ gameTime: t + 1, chasers: [bob()] }));
        const got = [];
        let skin = null;
        for (const [i, view] of views.entries()) {
            skin = stepEnemySkin(i === 0 ? null : { ...skin, gameTime: view.gameTime - 1 }, view, i);
            got.push(enemyOps(view, art, { skin })[0].frame);
        }
        expect(got).toEqual([0, 0, 1, 1, 2, 2, 1, 1, 0]);
        expect([0, 11, 12, 22, 23, 33, 34, 44, 45].map((t) => worldFrame(t, 4))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 0]);
    });

    it('the hit flash (Enemy.hitUpdate): a hit at P (h = 30) → red P+1..P+10, white P+11..P+20, red P+21..P+29, white at P+30', () => {
        const views = [V({ chasers: [bob({ hitsTimer: 30 })] })];
        for (let h = 29; h >= 0; h -= 1) views.push(V({ chasers: [bob({ hitsTimer: h })] }));
        const tints = bobFrames(views).map((g) => g.frame.tint ?? null);
        expect(tints[0]).toBe(null);
        expect(tints.slice(1, 11).every((t) => t === ENEMY_HIT_TINT)).toBe(true);
        expect(tints.slice(11, 21).every((t) => t === null)).toBe(true);
        expect(tints.slice(21, 30).every((t) => t === ENEMY_HIT_TINT)).toBe(true);
        expect(tints[30]).toBe(null);
    });

    it('a kill: "die" starts on the kill tick (the player\'s update), 3 for 7 ticks then 4,5,6 for 6 each (fps 5); destroy shows frame 6 and the run\'s fade', () => {
        const views = [V({ chasers: [bob({ dying: true })] })];
        for (let k = 1; k < 25; k += 1) views.push(V({ chasers: [bob({ dying: true })] }));
        views.push(V({ chasers: [bob({ dying: true, destroy: true, alpha: 0.9 })] }));
        const got = bobFrames(views);
        expect(got.slice(0, 25).map((g) => g.frame.frame)).toEqual([...Array(7).fill(3), ...Array(6).fill(4), ...Array(6).fill(5), ...Array(6).fill(6)]);
        expect(got[25].frame.frame).toBe(6);       // Bob.png is 7 frames: `frameCount - 1`
        expect(got[25].frame.alpha).toBe(0.9);
    });

    it('a pit fall turns 8° a tick (Enemy.as:96) by the fall\'s own alpha, and fades with it', () => {
        const rows = runSynthetic().slice(0, 8);
        const turns = rows.map((r) => Math.abs(r.ops[0].rot));
        expect(turns).toEqual([8, 16, 24, 32, 40, 48, 56, 64]);
        expect(rows[3].ops[0].alpha).toBeCloseTo(0.8, 10);
    });

    it('the spinner (Spinner.as:97-121): hammer frame 1 turned by (Game.time % 45) / 45 · 360, body frame 0 unturned; a kill grows the hammer 0.1 a tick and fades it as 2 − scale', () => {
        const rows = runSynthetic().slice(8, 16);
        const [hammer, body] = rows[0].ops;
        expect([hammer.frame, body.frame]).toEqual([1, 0]);
        // the body read the clock the PREVIOUS view left (908, the pit's last) → 908 % 45 = 8 → 64°
        expect(hammer.rot).toBeCloseTo(64, 10);
        expect(body.rot).toBe(0);
        expect([hammer.pivotX, hammer.pivotY, hammer.dx, hammer.dy]).toEqual([5, 5, 59, 59]);
        expect(rows[2].ops[0].scaleX).toBeCloseTo(1.1, 10);
        expect(rows[3].ops[0].scaleX).toBeCloseTo(1.2, 10);
        expect(rows[3].ops[0].alpha).toBeCloseTo((2 - 1.2) * 0.8, 10);
    });

    it('an arrow (Arrow.as:32,41): angle atan2(−v.y, v.x) — canvas 0°, −90° (up), 135°; after a hit (v = 0) it keeps the last', () => {
        const rows = runSynthetic().slice(16, 20);
        expect(rows.map((r) => Math.round(r.ops[0].rot))).toEqual([0, -90, 135, 135]);
    });

    it('Puncher (Puncher.as:75-82): the mirror is decided from the facing BEFORE this tick re-aims it — one tick late', () => {
        const pun = (vx) => ({ id: 'p@1', tag: 'puncher', x: 80, y: 80, vx, vy: 0, hits: 0, hitsTimer: 0, dying: false, destroy: false, alpha: 1 });
        let skin = null;
        const flips = [];
        for (const [i, vx] of [-1, -1, 1, 1].entries()) {
            const view = V({ player: { x: 40, y: 80 }, chasers: [pun(vx)] });
            skin = stepEnemySkin(skin, view, 4000 + i);
            flips.push([skin.bodies.get('c:p@1').sprite.anim, enemyOps(view, art, { skin })[0].flipX]);
        }
        expect(flips).toEqual([['walk-side', false], ['walk-side', true], ['walk-side', true], ['walk-side', false]]);
    });

    it('LavaRunner in water or lava (LavaRunner.as:84-94) plays "swim"; on ground the Bob walk', () => {
        const lr = { id: 'lr@1', tag: 'lavarunner', x: 80, y: 80, vx: 1, vy: 0, hits: 0, hitsTimer: 0, dying: false, destroy: false, alpha: 1 };
        const step = (t) => stepEnemySkin(null, V({ player: { x: 120, y: 80 }, chasers: [lr], terrain: () => t }), 0).bodies.get('c:lr@1').sprite.anim;
        expect([step(1), step(17), step(0)]).toEqual(['swim', 'swim', 'walk']);
    });

    it('AP item looks (APItem.as:150-172): a look draws its own sheet, frame 0, centred; bosskeyN the shared key; unknown → the logo', () => {
        expect(apLookKey('sword')).toBe('seedling:pickup/sword');
        expect(apLookKey('bosskey3')).toBe('seedling:pickup/bosskey3');
        expect([apLookKey('ap'), apLookKey(undefined), apLookKey('bosskey7')]).toEqual([null, null, null]);
        const ops = apItemOps(apItemsOf(), art, '#e8c040');
        const byLook = Object.fromEntries(LOOKS.map((l, i) => [l, ops[i]]));
        expect(byLook.sword.key).toBe('seedling:pickup/sword');
        expect([byLook.sword.frame, byLook.sword.dx, byLook.sword.dy]).toEqual([0, 16 * 1 + 8 - 8, 40 - 8]);
        expect(byLook.nonsense.key).toBe(AP_LOGO_KEY);
        expect(byLook.bosskey9.key).toBe(AP_LOGO_KEY);
        expect(byLook.ap.key).toBe(AP_LOGO_KEY);
        expect(byLook.bosskey4.sheetRef).toMatch(/BossKey4/);
        // without art: G1's rectangle
        expect(apItemOps(apItemsOf().slice(0, 1), null, '#e8c040')[0]).toMatchObject({ colour: '#e8c040' });
    });

    it('a class with no family, or a stack without its key, is its hitbox rectangle', () => {
        const view = V({ chasers: [bob()] });
        const skin = stepEnemySkin(null, view, 0);
        const noBob = { ...art, has: (k) => k !== 'seedling:enemy/bob' && art.has(k) };
        const [op] = enemyOps(view, noBob, { skin });
        expect(op.rect).toMatchObject({ x: 76, y: 76, right: 84, bottom: 84 });
        expect(op.sheetRef).toBeUndefined();
        const [op2] = enemyOps(view, art, { skin, families: {} });
        expect(op2.rect).toBeDefined();
        expect(familyOf('bob')).toBe(ENEMY_FAMILIES.Bob);
        expect(familyOf('wallflyer')).toBe(null);
    });
});

describe('4. one mutant per rule turns a golden red', () => {
    const differs = (tape, opts) => {
        // READ the recorded golden (never re-record it from a mutant).
        const want = readFileSync(join(GOLDENS, `enemy-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        return runTape(tape, opts).map(lineOf).filter((l, i) => l !== want[i]).length;
    };
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const MUTANTS = [
        ['updateSprite: no callback at the end of a LOOPING cycle', 'lavarunner-L71', {
            rules: { updateSprite: (sp, anims, onEnd) => updateSprite(sp, Object.fromEntries(Object.entries(anims).map(([k, a]) => [k, { ...a, loop: true }])), () => {}) },
        }],
        ['hitTint: never toggles', 'bob-L14', { rules: { hitTint: (tint) => tint } }],
        ['worldFrame: one frame late', 'bob-L14', { rules: { worldFrame: (t, n, l) => worldFrame(t + 12, n, l) } }],
        ['Bob: the update drops the playing anim', 'bob-L14', { families: { ...ENEMY_FAMILIES, Bob: { ...ENEMY_FAMILIES.Bob, update: (st) => { st.sprite.anim = ''; } } } }],
        ['LavaRunner: never swims', 'lavarunner-L72', { families: { ...ENEMY_FAMILIES, LavaRunner: { ...ENEMY_FAMILIES.LavaRunner, update: (st, b, ctx) => ENEMY_FAMILIES.LavaRunner.update(st, b, { ...ctx, terrainAt: () => 0 }) } } }],
        ['Puncher: mirrors AFTER the re-aim', 'puncher-L26', { families: { ...ENEMY_FAMILIES, Puncher: { ...ENEMY_FAMILIES.Puncher, update(st, b, ctx) { ENEMY_FAMILIES.Puncher.update(st, b, ctx); st.mirrored = st.direction === 2; } } } }],
        ['Flyer: the drop point at its own centre (not 10 px below)', 'flyer-L101', { families: { ...ENEMY_FAMILIES, Flyer: { ...ENEMY_FAMILIES.Flyer, update: (st, b, ctx) => ENEMY_FAMILIES.Flyer.update(st, { ...b, y: b.y - 30 }, ctx) } } }],
        ['Bulb: a kill plays "die" at once', 'bulb-L74', { families: { ...ENEMY_FAMILIES, Bulb: { ...ENEMY_FAMILIES.Bulb, dieOnKill: true, update: (st, b, ctx) => ENEMY_FAMILIES.Bulb.update(st, { ...b, hits: 0 }, ctx) } } }],
    ];
    for (const [name, tape, opts] of MUTANTS) {
        it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(5));
    }
});

describe('5. the adapter reads the run and writes nothing', () => {
    it('maps chasers, spinners and arrows; a write anywhere throws', () => {
        const frozen = (o) => new Proxy(o, { set: () => { throw new Error('enemySkinView wrote to the run'); }, defineProperty: () => { throw new Error('enemySkinView defined on the run'); } });
        const world = frozen({ tiles: [frozen({ tx: 5, ty: 5, t: 17 })] });
        const run = frozen({
            level: 7, world, gameTime: 99, transitions: [1, 2], playerDeaths: [1],
            state: frozen({ x: 10, y: 20 }),
            chasers: [frozen({ id: 'b', tag: 'bobsoldier', x: 88, y: 88, vx: 1, vy: 0, hits: 1, hitsTimer: 4, dying: false, destroy: false, alpha: 1, swordSpin: 1.5 })],
            spinnerBodies: [frozen({ id: 's', x: 1, y: 2, hits: 0, hitsTimer: 0, destroy: false, alpha: 1, rect: {} })],
            arrowFlights: [frozen({ id: 'a', x: 3, y: 4, v: frozen({ x: 0, y: 2 }), die: false, alpha: 1, removed: false }), frozen({ id: 'z', removed: true })],
        });
        const v = enemySkinView(run);
        expect(v.epoch).toEqual({ run, key: '7|2|1' });
        expect({ ...v, epoch: null, terrain: null }).toEqual({
            epoch: null, level: 7, gameTime: 99, player: { x: 10, y: 20 }, terrain: null,
            chasers: [{ id: 'b', tag: 'bobsoldier', x: 88, y: 88, vx: 1, vy: 0, hits: 1, hitsTimer: 4, dying: false, destroy: false, alpha: 1, swordSpin: 1.5 }],
            spinners: [{ id: 's', x: 1, y: 2, hits: 0, hitsTimer: 0, destroy: false, alpha: 1 }],
            arrows: [{ id: 'a', x: 3, y: 4, vx: 0, vy: 2, die: false, alpha: 1 }],
        });
        expect([v.terrain(88, 88), v.terrain(0, 0)]).toEqual([17, 0]);
        expect(enemySkinView(null)).toBe(null);
    });

    it('a new visit (a crossing or a death\'s restart) starts every body afresh', () => {
        const view = V({ player: { x: 130, y: 80 }, chasers: [bob()] });
        const a = stepEnemySkin(null, view, 0);
        const b = stepEnemySkin(a, view, 1);
        expect(b.bodies.get('c:bob@0').sprite.timer).toBeGreaterThan(a.bodies.get('c:bob@0').sprite.timer);
        const c = stepEnemySkin(b, { ...view, epoch: { run: RUN, key: 'syn|death' } }, 2);
        expect(c.bodies.get('c:bob@0').sprite.timer).toBe(a.bodies.get('c:bob@0').sprite.timer);
    });
});

describe('6. ⛔ STATE IDENTITY — the body renderer never touches the run', () => {
    function walk(tape, render) {
        const reports = [];
        const rt = boot(tape.level, tape.at, (n, v) => reports.push([n, v]));
        const trace = [];
        let skin = null;
        let drawn = 0;
        for (const held of keysOf(tape)) {
            rt.tick(held);
            if (render) {
                const ev = enemySkinView(rt.run);
                skin = stepEnemySkin(skin, ev, rt.ticks);
                const view = rt.view();
                const entitySprites = enemyOps(ev, art, { skin });
                const apItemSprites = apItemOps(view.apItems, art, '#e8c040');
                const ops = roomOps(view.world, art, { level: view.level, tick: rt.ticks, player: playerBoxAt(view.state.x, view.state.y), apItems: view.apItems, apItemSprites, entitySprites });
                drawn += entitySprites.length + (ops.length > 0 ? 1 : 0);
            }
            const r = rt.run;
            trace.push(JSON.stringify([rt.ticks, r?.level, r?.state, r?.chasers, r?.spinnerBodies, r?.arrowFlights, rt.game.readState()]));
        }
        return { trace, stateLog: JSON.stringify(reports), drawn };
    }

    for (const tape of TAPES) {
        it(`${tape.name}: per-tick state (bodies included), readState and stateLog byte-identical with the renderer on and off`, () => {
            const off = walk(tape, false);
            const on = walk(tape, true);
            expect(on.drawn).toBeGreaterThan(tape.n);     // not vacuous: it drew bodies on the ticks
            expect(md5(on.trace.join('\n'))).toBe(md5(off.trace.join('\n')));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
        });
    }
});
