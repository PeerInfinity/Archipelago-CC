/**
 * seedlingRoomBodySkin — G3b's proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. ONE REAL TAPE PER FAMILY: committed fixture tapes through the model
 *      (`tapeRunner.runTape`) where one exists for the class (wallflyer, ice
 *      turret, turret, the Bob Boss), and a key tape through the JS runtime
 *      for the drill (L88, the one room `drillLive` steps). Every tick's ops
 *      are a golden line plus each body's state.
 *   2. SYNTHETIC VIEWS for what the tapes do not reach.
 *      ⚠ (1) and (2) are CHANGE DETECTORS recorded from this renderer.
 *      Re-record after a deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   3. THE INDEPENDENT STRATUM: frames, angles, fades and tints by hand from the AS3.
 *   4. ONE MUTANT PER RULE (`ROOM_BODY_RULES`): each turns a golden red.
 *   5. THE ADAPTER reads the run and writes nothing, and never asks a getter the sim's stepper would not.
 *   6. ⛔ STATE IDENTITY: each tape's observation stream, final state, ledgers
 *      and `stateLog` byte-identical with the adapter, the reducer and the ops
 *      running every tick, and without — the LAZY getters included.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { md5 } from './md5.js';
import { runTape as runFixtureTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { formatOp } from './seedlingSkinRenderer.js';
import { formatPlayerOp } from './seedlingPlayerSkin.js';
import { ENEMY_ART, ENEMY_COVERAGE, ENEMY_HIT_TINT } from './seedlingEnemySkin.js';
import {
    BOB_BOSS_RATE, KEYS, ROOM_BODY_COVERAGE, ROOM_BODY_RULES, roomBodyOps, roomBodySkinView, stepRoomBodySkin,
} from './seedlingRoomBodySkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/** Step up twice, swing up, wait out the i-frame: the drill hops toward the player and is struck. */
const UP_SWING = ['up', 'up', 'up+primary', ...Array(30).fill('')];

/**
 * THE TAPES. `fixture` names a committed tape (run through the model);
 * otherwise `level`/`at`/`keys`/`n` drive the JS runtime. `want` is what the
 * tape must really reach (by body state tag, see `tagsOf`).
 */
export const TAPES = Object.freeze([
    { name: 'wallflyer-L22', fixture: 'r2-wallflyer-contact', family: 'WallFlyer', want: ['w:jump', 'w:jumping', 'w:rest'] },
    { name: 'wallflyer-kill', fixture: 'wallflyer-kill', family: 'WallFlyer', want: ['w:die', 'w:tint'] },
    { name: 'drill-L88', level: 88, at: [136, 232], n: 300, keys: UP_SWING, family: 'Drill', want: ['d:sit', 'd:drill', 'd:undrill', 'd:hit', 'd:die', 'd:hidden', 'd:shown'] },
    { name: 'iceturret-L40', fixture: 'prox-l40-turret-volley', family: 'IceTurret', want: ['i:startshot', 'i:finishshot', 'blast'] },
    { name: 'turret-spit', fixture: 'u15-turret-spit', family: 'Turret', want: ['t:startshot', 't:finishshot', 'spit'] },
    // ⛓ a `noDamage` tape: the arm under which the wallflyer/drill getters must NOT be asked (the boss's are).
    { name: 'bobboss-L32', fixture: 'r5-bobboss-fire', family: 'BobBoss', want: ['b0:forming', 'b0:walk', 'b1:walk', 'b2:walk', 'b:squash', 'b:tint'] },
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

/**
 * Drive a tape; `each(tick, run)` after every tick. Returns what the state
 * identity compares: the per-tick stream, the end state, the ledgers and the
 * reports (both arms read exactly these, and only after the last tick).
 */
function drive(tape, each = () => {}) {
    const reports = [];
    if (tape.fixture) {
        let last = null;
        const stream = [];
        const out = runFixtureTape(fixture(tape.fixture), {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => { last = run; stream.push(JSON.stringify([t, run.level, now])); each(t, run); },
        });
        return { stream, end: JSON.stringify([out.ticks, out.final, ledgersOf(last)]), stateLog: '' };
    }
    const rt = boot(tape.level, tape.at, (n, v) => reports.push([n, v]));
    const stream = [];
    for (const held of keysOf(tape)) {
        rt.tick(held);
        stream.push(JSON.stringify([rt.ticks, rt.run?.level, rt.run?.state, rt.game.readState()]));
        each(rt.ticks, rt.run);
    }
    return { stream, end: JSON.stringify(ledgersOf(rt.run)), stateLog: JSON.stringify(reports) };
}
/** Every ledger these families write, read once at the end (in both arms). */
const LEDGERS = ['wallFlyers', 'drills', 'turretKills', 'volleys', 'spitEvents', 'bobBossEvents', 'playerHits', 'transitions'];
const ledgersOf = (run) => (run ? LEDGERS.map((n) => {
    const v = run[n];
    return v instanceof Map ? [...v] : v;
}) : null);

/** Run a tape with the renderer; per tick: the view, the skin and the ops. */
function runTape(tape, opts = {}) {
    const rows = [];
    let skin = null;
    drive(tape, (tick, run) => {
        const view = roomBodySkinView(run);
        skin = stepRoomBodySkin(skin, view, tick, opts);
        rows.push({ tick, view, skin, ops: roomBodyOps(view, art, { skin }) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    for (const [k, st] of r.skin.bodies) {
        const kind = k[0];
        if (kind === 'w') {
            const b = r.view.wallFlyers.find((w) => `w:${w.id}` === k);
            out.push(`w:${st.sprite.anim || (b && b.vx === 0 && b.vy === 0 ? 'rest' : '-')}`);
            if (st.tint) out.push('w:tint');
        } else if (kind === 'd') {
            const b = r.view.drills.find((d) => `d:${d.id}` === k);
            out.push(`d:${b?.anim ?? '-'}`, st.visible ? 'd:shown' : 'd:hidden');
        } else if (kind === 'i') {
            const t = r.view.iceTurrets.find((x) => `i:${x.id}` === k);
            out.push(`i:${t?.dead ? 'dead' : (t?.anim || 'idle')}`);
        } else if (kind === 't') {
            const t = r.view.shooters.find((x) => `t:${x.id}` === k);
            out.push(`t:${t?.anim || 'idle'}`);
        } else if (kind === 'b') {
            const b = r.view.bobBoss;
            out.push(`b${b.form}:${b.formingTimer > 0 ? 'forming' : (st.sprite.anim || 'stand')}`);
            if (st.scaleX !== 1) out.push('b:squash');
            if (st.tint === ENEMY_HIT_TINT) out.push('b:tint');
        }
    }
    if (r.view.blasts.length) out.push('blast');
    if (r.view.spits.length) out.push('spit');
    return out;
}
const lineOf = (r) => `t=${r.tick} [${tagsOf(r).join(',')}] | ${r.ops.map((o) => formatPlayerOp(o, formatOp)).join(' ; ')}`.trimEnd();

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
const V = (over = {}) => ({
    epoch: { run: RUN, key: 'syn' }, level: 9, gameTime: 900, player: { x: 300, y: 300 },
    wallFlyers: [], drills: [], iceTurrets: [], blasts: [], shooters: [], spits: [], bobBoss: null, probe: () => false,
    ...over,
});
const boss = (over = {}) => ({ id: 'bobboss#0', form: 0, x: 80, y: 80, hitsTimer: 0, formingTimer: 0, destroy: false, nextBossTimer: 120,
    swords: 1, swordSpin: [Math.PI * 3 / 2], ...over });
const turret = (over = {}) => ({ id: 'iceturret@0', x: 80, y: 80, dead: false, dying: false, hitsTimer: 0, anim: '', angle: 0, ...over });

/** Step `views` from a null skin; returns each tick's row. */
function stepAll(views, opts = {}) {
    let skin = null;
    return views.map((view, i) => {
        skin = stepRoomBodySkin(skin, view, 5000 + i, opts);
        return { tick: 5000 + i, view, skin, ops: roomBodyOps(view, art, { skin }) };
    });
}

export function syntheticViews() {
    const v = [];
    // a boss forming 60 → 0, then a kill and the squash
    for (let ft = 59; ft >= 55; ft -= 1) v.push(V({ gameTime: 900 + (60 - ft), bobBoss: boss({ formingTimer: ft }) }));
    for (let k = 0; k < 3; k += 1) v.push(V({ gameTime: 910 + k, bobBoss: boss({ destroy: true, swords: 0, nextBossTimer: 119 - k }) }));
    // an ice turret dying, then its corpse turning
    v.push(V({ gameTime: 920, iceTurrets: [turret({ angle: 180, dying: true })] }));
    for (let k = 0; k < 4; k += 1) v.push(V({ gameTime: 921 + k, iceTurrets: [turret({ angle: 180, dying: true, dead: true })] }));
    return v;
}

describe('1–2. golden body ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} tape: every tick's ${tape.family} ops`, () => {
            const rows = runTape(tape);
            const lines = rows.map(lineOf);
            expect(lines).toEqual(golden(`roombody-${tape.name}.txt`, lines));
            // not vacuous: the tape really reached each state it is named for
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops);
            expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        }, 120_000);
    }

    it('the synthetic views: a boss forming and squashed, an ice turret dying and turning', () => {
        const lines = stepAll(syntheticViews()).map(lineOf);
        expect(lines).toEqual(golden('roombody-synthetic.txt', lines));
    });

    it('the coverage tables: G3b\'s classes are drawn, each art row reached the pack, nothing is counted twice', () => {
        for (const k of [KEYS.wallFlyer, KEYS.drill, KEYS.iceTurret, KEYS.iceBlast, KEYS.turret, KEYS.spit, KEYS.bobBoss(0), KEYS.bobBoss(1),
            KEYS.bobBoss(2), KEYS.bobBossWeapons]) expect(art.has(k), k).toBe(true);
        for (const r of ENEMY_ART) expect(art.has(r.key), r.key).toBe(true);
        const g3 = new Set([...ENEMY_COVERAGE.drawn]);
        for (const c of ROOM_BODY_COVERAGE.drawn) {
            expect(g3.has(c), `${c} is G3b's, not G3's`).toBe(false);
            expect(ENEMY_COVERAGE.modelled.includes(c) || ENEMY_COVERAGE.remaining.includes(c), `${c} left G3's not-drawn lists`).toBe(false);
        }
    });
});

describe('3. the independent stratum (by hand from the AS3)', () => {
    it('the Bob Boss forming (BobBoss.as:102-109): alpha 1 − ft/60, scale 1 + ft/60, colour (v, 255, v) with v = int(255·(1 − ft/60))', () => {
        const [r] = stepAll([V({ bobBoss: boss({ formingTimer: 45 }) })]);
        const [body, blade] = r.ops;
        expect(body.key).toBe(KEYS.bobBoss(0));
        expect(body.alpha).toBeCloseTo(0.25, 12);
        expect([body.scaleX, body.scaleY]).toEqual([1.75, 1.75]);
        expect(body.tint).toBe(`#3fff3f`);                // int(255 · 0.25) = 63 = 0x3f
        expect(blade.key).toBe(KEYS.bobBossWeapons);
        expect(blade.frame).toBe(0);                        // `sprBobBossWeapons.frame = _st`
        expect(blade.alpha).toBeCloseTo(0.25, 12);          // `weapon.alpha = graphic.alpha`
        expect(blade.rot).toBeCloseTo(-270, 10);            // swordSpin 3π/2 → 270° CCW = canvas −270
        expect(blade.scaleX).toBeUndefined();               // the blade is not scaled
    });

    it('the Bob Boss walk at the form\'s rate (BobBoss.as:66,72): fps 10 × 1/4 holds each of 0,1,2,1 for 12 ticks; × 1/2 for 6', () => {
        const walk = (form, n) => stepAll(Array.from({ length: n }, (_, k) => V({ gameTime: 1000 + k, player: { x: 100, y: 80 },
            bobBoss: boss({ form, id: `bobboss#${form}` }) }))).map((r) => r.ops[0].frame);
        expect(BOB_BOSS_RATE).toEqual([0.25, 0.5, 1]);
        const f0 = walk(0, 48);
        expect(f0.slice(0, 12).every((f) => f === 0) && f0.slice(12, 24).every((f) => f === 1) && f0.slice(24, 36).every((f) => f === 2)).toBe(true);
        expect(walk(1, 12)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    });

    it('the Bob Boss death (BobBoss.as:205-209): one squash per nextBossTimer spent — scaleX /= 1.1, scaleY += 0.1; no blades (swords = 0)', () => {
        const rows = stepAll([V({ bobBoss: boss() }), V({ bobBoss: boss({ destroy: true, swords: 0, nextBossTimer: 119 }) }),
            V({ bobBoss: boss({ destroy: true, swords: 0, nextBossTimer: 118 }) })]);
        expect(rows[2].ops).toHaveLength(1);
        expect(rows[2].ops[0].scaleX).toBeCloseTo(1 / 1.21, 12);
        expect(rows[2].ops[0].scaleY).toBeCloseTo(1.2, 12);
    });

    it('a dead ice turret (IceTurret.as:42,205-210): frame 6; turns toward FP −90° by a tenth a tick from the tick AFTER "dead" started', () => {
        const rows = stepAll(syntheticViews()).slice(8);
        expect(rows.slice(1).map((r) => r.ops[0].frame)).toEqual([6, 6, 6, 6]);
        // FP angle 180: angle_difference(π/2, −π) = 3π/2 → wrapped −π/2, so a −= −90/10 → 189, then 197.1 (the gap 90 → 81 → 72.9)
        const fp = rows.map((r) => -r.ops[0].rot);
        expect(fp[0]).toBe(180);
        expect(fp[1]).toBe(180);                            // "dead" plays this tick (death() runs after input())
        expect(fp[2]).toBeCloseTo(189, 10);
        expect(fp[3]).toBeCloseTo(197.1, 10);
    });

    it('the ice turret draws at the ROUNDED point (IceTurret.as:99-107) with origin (12, 16); its layer is −(y + 16) alive', () => {
        const [r] = stepAll([V({ iceTurrets: [turret({ x: 80.5, y: 79.6 })] })]);
        const op = r.ops[0];
        expect([op.dx, op.dy, op.pivotX, op.pivotY]).toEqual([81 - 12, 80 - 16, 12, 16]);
        expect(op.layer).toBeCloseTo(-(79.6 + 16), 10);
    });

    it('the ice turret\'s frames (IceTurret.as:39-41): "" → 0, startshot → 0; finishshot [1..5] on its own fps-10 clock from 0 (the 4th update wraps 0.333×3)', () => {
        const fr = (anims) => stepAll(anims.map((anim) => V({ iceTurrets: [turret({ anim })] }))).map((r) => r.ops[0].frame);
        expect(fr(['', 'startshot', 'startshot'])).toEqual([0, 0, 0]);
        expect(fr(Array(9).fill('finishshot'))).toEqual([1, 1, 1, 1, 2, 2, 2, 3, 3]);
    });

    it('the turret (Turret.as:30-31,37): "" → 0, startshot [1,2], finishshot [2,1]; turned by its angle; layer −(y − 8 + 12.8)', () => {
        const op = (anim, index, angle = 0) => stepAll([V({ shooters: [{ id: 't', x: 40, y: 40, anim, index, angle, hitsTimer: 0 }] })])[0].ops[0];
        expect([op('', 0).frame, op('startshot', 1).frame, op('finishshot', 0).frame, op('finishshot', 1).frame]).toEqual([0, 2, 2, 1]);
        expect(op('', 0, 30).rot).toBe(-30);
        expect(op('', 0).layer).toBeCloseTo(-44.8, 10);
    });

    it('blasts and spits (IceTurretBlast.as:34,44; TurretSpit.as:74): angle atan2(−v.y, v.x), origin (8, 4)', () => {
        const [r] = stepAll([V({ blasts: [{ id: 'b', x: 10, y: 10, vx: 0, vy: 6 }], spits: [{ id: 's', x: 20, y: 20, vx: -3, vy: 0 }] })]);
        const [blast, spit] = r.ops;
        expect([blast.key, Math.round(blast.rot), blast.pivotX, blast.pivotY]).toEqual([KEYS.iceBlast, 90, 8, 4]);
        // `atan2(-0, -3)` is −π: ±180° are one angle
        expect([spit.key, Math.abs(Math.round(spit.rot))]).toEqual([KEYS.spit, 180]);
    });

    it('the wallflyer (WallFlyer.as:79-97): at rest the world clock\'s 2 frames, turned AWAY from its wall (vTriggered)', () => {
        // a wall to the WEST (d = 4): decideMotion → angle 0, vTriggered (+4, 0); FP angle −atan2(0, 4) = 0.
        const west = (rect) => rect.right <= 80 - 7 + 1 && rect.x < 80 - 7;
        const wf = { id: 'w', x: 80, y: 80, vx: 0, vy: 0, hitsTimer: 0, alpha: 1, destroy: false, fallInPit: false, die: null };
        const rows = stepAll([0, 22, 23, 44].map((t) => V({ gameTime: t, wallFlyers: [wf], probe: west })));
        expect(rows.map((r) => r.ops[0].frame)).toEqual([0, 0, 1, 1]);
        expect(rows[0].ops[0].rot === 0 || Object.is(rows[0].ops[0].rot, -0)).toBe(true);
        expect([rows[0].ops[0].pivotX, rows[0].ops[0].pivotY]).toEqual([12, 8]);
    });

    it('the wallflyer\'s jump (WallFlyer.as:32-33,99-104): the player on its ray plays "jump" 0,1,2,3 at fps 15, then "jumping" 3,4 at fps 7', () => {
        const west = (rect) => rect.x < 80 - 7;
        const views = [];
        for (let k = 0; k < 12; k += 1) {
            views.push(V({ gameTime: 100 + k, player: { x: 140, y: 80 }, probe: west,
                wallFlyers: [{ id: 'w', x: 80 + 4 * k, y: 80, vx: 4, vy: 0, hitsTimer: 0, alpha: 1, destroy: false, fallInPit: false, die: null }] }));
        }
        const rows = stepAll(views);
        expect(rows.map((r) => r.skin.bodies.get('w:w').sprite.anim)).toEqual([...Array(8).fill('jump'), ...Array(4).fill('jumping')]);
        expect(rows.map((r) => r.ops[0].frame)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3]);
    });

    it('a drill (Drill.as:26,33,73-80): invisible while it sits; the hop tick still hidden (the latch reads the anim BEFORE the hop); shown the tick after', () => {
        const d = (anim, index = 0) => ({ id: 'd', x: 80, y: 80, hitsTimer: 0, alpha: 1, destroy: false, anim, index });
        const rows = stepAll([V({ drills: [d('sit')] }), V({ drills: [d('drill', 0)] }), V({ drills: [d('drill', 1)] }), V({ drills: [d('undrill', 3)] })]);
        expect(rows.map((r) => r.ops.length)).toEqual([0, 0, 1, 1]);
        expect(rows[2].ops[0].frame).toBe(1);
        expect(rows[3].ops[0].frame).toBe(0);              // undrill [3,2,1,0] index 3
    });
});

describe('4. one mutant per rule turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `roombody-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        return runTape(tape, opts).map(lineOf).filter((l, i) => l !== want[i]).length;
    };
    const MUTANTS = [
        ['decideMotion: the probe sees no wall (no vTriggered)', 'wallflyer-L22', { rules: { decideMotion: (p, s) => ROOM_BODY_RULES.decideMotion(p, s, () => false) } }],
        ['worldFrame: one frame late', 'wallflyer-L22', { rules: { worldFrame: (t, n, l) => ROOM_BODY_RULES.worldFrame(t + 23, n, l) } }],
        ['updateSprite: the boss walk at rate 1 every form', 'bobboss-L32', { rules: { updateSprite: (sp, a, e) => ROOM_BODY_RULES.updateSprite(sp, a, e, 1) } }],
        ['hitTint: never toggles', 'bobboss-L32', { rules: { hitTint: (tint) => tint } }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(5), 120_000);
});

describe('5. the adapter reads the run, writes nothing, and asks nothing first', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('roomBodySkinView wrote to the run'); }, defineProperty: () => { throw new Error('roomBodySkinView defined on the run'); } });

    it('maps every family; a write anywhere throws', () => {
        const run = frozen({
            level: 22, gameTime: 50, transitions: [], playerDeaths: [], noDamage: false, state: frozen({ x: 1, y: 2 }),
            world: frozen({ collidesSolid: () => null }),
            wallFlyers: frozen({ bodies: [frozen({ id: 'w', x: 8, y: 9, vx: 4, vy: 0, hitsTimer: 3, alpha: 1, destroy: false, fallInPit: false, removed: false, dieAnim: null })], events: [] }),
            drills: frozen({ bodies: [frozen({ id: 'd', x: 3, y: 4, hitsTimer: 0, alpha: 1, destroy: false, removed: false, anim: 'drill', sprite: frozen({ index: 2 }) })], events: [] }),
            turrets: new Map([['i', frozen({ id: 'i', x: 5, y: 6, dead: false, removed: false })]]),
            turretDamage: [frozen({ id: 'i', anim: 'finishshot', animIndex: 1, angle: 30, hitsTimer: 0, dying: false, dead: false })],
            blastsInFlight: [frozen({ id: 'b', x: 1, y: 1, vx: 6, vy: 0 })],
            shooters: [frozen({ id: 't', x: 7, y: 7, angle: 10, anim: '', animIndex: 0, hitsTimer: 0, spits: [frozen({ id: 't#1', x: 2, y: 2, v: frozen({ x: 3, y: 0 }) })] })],
            bobBoss: new Map([['boss', frozen({ id: 'bobboss#1', form: 1, x: 80, y: 80, hitsTimer: 0, formingTimer: 0, destroy: false, nextBossTimer: 120, swords: 2, swordSpin: [1, 2] })],
                ['dialogue', { open: true }]]),
        });
        const v = roomBodySkinView(run);
        expect(v.epoch).toEqual({ run, key: '22|0|0' });
        expect(v.wallFlyers).toEqual([{ id: 'w', x: 8, y: 9, vx: 4, vy: 0, hitsTimer: 3, alpha: 1, destroy: false, fallInPit: false, die: null }]);
        expect(v.drills).toEqual([{ id: 'd', x: 3, y: 4, hitsTimer: 0, alpha: 1, destroy: false, anim: 'drill', index: 2 }]);
        expect(v.iceTurrets).toEqual([{ id: 'i', x: 5, y: 6, dead: false, dying: false, hitsTimer: 0, anim: 'finishshot', angle: 30 }]);
        expect(v.blasts).toEqual([{ id: 'b', x: 1, y: 1, vx: 6, vy: 0 }]);
        expect(v.shooters).toEqual([{ id: 't', x: 7, y: 7, angle: 10, anim: '', index: 0, hitsTimer: 0 }]);
        expect(v.spits).toEqual([{ id: 't#1', x: 2, y: 2, vx: 3, vy: 0 }]);
        expect(v.bobBoss).toMatchObject({ id: 'bobboss#1', form: 1, swords: 2, swordSpin: [1, 2] });
        expect(roomBodySkinView(null)).toBe(null);
    });

    it('⛔ under noDamage it never asks the wallflyers or the drills (their steppers do not run, so their state is not built)', () => {
        const run = { level: 22, state: { x: 0, y: 0 }, noDamage: true,
            get wallFlyers() { throw new Error('asked the wallflyers under noDamage'); },
            get drills() { throw new Error('asked the drills under noDamage'); } };
        const v = roomBodySkinView(run);
        expect([v.wallFlyers, v.drills]).toEqual([[], []]);
    });
});

describe('6. ⛔ STATE IDENTITY — the room-body renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers and the stateLog byte-identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const view = roomBodySkinView(run);
                skin = stepRoomBodySkin(skin, view, tick);
                drawn += roomBodyOps(view, art, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);              // not vacuous: it drew bodies
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
        }, 240_000);
    }
});
