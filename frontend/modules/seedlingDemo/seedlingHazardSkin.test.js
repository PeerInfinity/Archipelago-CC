/**
 * seedlingHazardSkin — G3c's proof, in node, over the COMMITTED seedling
 * pack's manifest (no pixels):
 *
 *   1. ONE REAL TAPE PER FAMILY: committed fixture tapes through the model
 *      (`tapeRunner.runTape`) where one reaches the class (axes, crusher, the
 *      totem's fight, kill and jump, the bomb pusher, the grenade's fuse), and
 *      a key tape through the JS runtime for the lava chain (no fixture tape
 *      sees a chain trigger: the L79 tape declares no `Game.time`). Each
 *      tick's ops for the tape's family are a golden line; a run of identical
 *      lines is one line (`t=a..b`), so a long tape stays a small file.
 *   2. SYNTHETIC VIEWS for what the tapes do not reach.
 *      ⚠ (1) and (2) are CHANGE DETECTORS recorded from this renderer.
 *      Re-record after a deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   3. THE INDEPENDENT STRATUM: angles, frames, fades and tints by hand from
 *      the AS3, and the renderer's CLOCKS against the model — the axe's count
 *      against the hits the model bills, the chain's against the chain hits,
 *      the totem's `currentFrame` / `activationStage` against `stepBossTotem`.
 *   4. ONE MUTANT PER FAMILY (`HAZARD_RULES`): each turns a golden red.
 *   5. THE ADAPTER reads the run and writes nothing.
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
import { ENEMY_COVERAGE, ENEMY_HIT_TINT } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { axeHitsPlayer } from './spinningAxe.js';
import { createLavaChainState, stepLavaChain } from './lavaChain.js';
import { createBossTotem, renderBossTotem, stepBossTotem } from './bossTotem.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import {
    HAZARD_COVERAGE, HAZARD_OBJECT_TAGS, HAZARD_RULES, KEYS, hazardOps, hazardSkinView, stepHazardSkin,
    totemActivationStage, totemLaserTint,
} from './seedlingHazardSkin.js';

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

/**
 * THE TAPES. `fixture` names a committed tape (run through the model);
 * otherwise `level`/`at`/`n` stand the JS runtime still. `keys` is the art
 * the golden lines keep (the tape's family; its other bodies are other
 * goldens'). `want` is what the tape must really reach (`tagsOf`).
 */
export const TAPES = Object.freeze([
    { name: 'axe-L61', fixture: 'axe-l61-reach-l62', family: 'SpinningAxe', keys: ['seedling:puzzlement/spinningaxe'], want: ['a:red'] },
    { name: 'axe-L48', fixture: 'axe-l48-reach-l49', family: 'SpinningAxe', keys: ['seedling:puzzlement/spinningaxe'], want: ['a:plain'] },
    // beside the chain's arm (L76 `lavachain@128,64`, dir 3: the arm runs down x 134..138), out of its reach
    { name: 'chain-L76', level: 76, at: [152, 92], n: 200, family: 'LavaChain', keys: [KEYS.chain], want: ['c:sit', 'c:extend', 'c:hit', 'c:retract'] },
    { name: 'crusher-L42', fixture: 'crusher-l42-round-trip', family: 'Crusher', keys: [KEYS.crusher], want: ['k:moving', 'k:rest'] },
    { name: 'totem-kill-L43', fixture: 'r6-totem-kill', family: 'BossTotem', keys: [KEYS.totem, KEYS.totemShot],
        want: ['t:asleep', 't:ramp', 't:rest', 't:walk', 't:attack', 't:destroy', 't:flash', 't:laser', 'shot'] },
    { name: 'totem-jump-L43', fixture: 'r6-totem-control', family: 'BossTotem', keys: [KEYS.totem, KEYS.totemShot], want: ['t:jump'] },
    { name: 'bombpusher-L40', fixture: 'l40button-l41-part0', family: 'BombPusher', keys: [KEYS.bombPusher, KEYS.bomb], want: ['p:shoot', 'p:sit', 'bomb'] },
    { name: 'grenade-L59', fixture: 'r4-walk-6-health', family: 'Grenade', keys: [KEYS.grenade], want: ['g:fall', 'g:sit', 'g:explode', 'g:hit'] },
]);

function boot(level, [x, y], onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    return rt;
}

/** Every ledger these families write, read once at the end (in both arms). */
const LEDGERS = ['crusherContacts', 'bombEvents', 'placedGrenadeEvents', 'lavaChainEnemyHits', 'bossShotsFired', 'bossHits', 'bossKills',
    'bossWalks', 'playerHits', 'playerDeaths', 'transitions'];
const ledgersOf = (run) => (run ? LEDGERS.map((n) => {
    const v = run[n];
    return v instanceof Map ? [...v] : v;
}) : null);

/**
 * Drive a tape; `each(tick, run)` after every tick. Returns what the state
 * identity compares (both arms read exactly these, and only after the last tick).
 */
function drive(tape, each = () => {}) {
    if (tape.fixture) {
        let last = null;
        const stream = [];
        const out = runFixtureTape(fixture(tape.fixture), {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => { last = run; stream.push(JSON.stringify([t, run.level, now])); each(t, run); },
        });
        return { stream, end: JSON.stringify([out.ticks, out.final, ledgersOf(last)]), stateLog: '' };
    }
    const reports = [];
    const rt = boot(tape.level, tape.at, (n, v) => reports.push([n, v]));
    const stream = [];
    for (let i = 0; i < tape.n; i += 1) {
        rt.tick(new Set());
        stream.push(JSON.stringify([rt.ticks, rt.run?.level, rt.run?.state, rt.game.readState()]));
        each(rt.ticks, rt.run);
    }
    return { stream, end: JSON.stringify(ledgersOf(rt.run)), stateLog: JSON.stringify(reports) };
}

/** Run a tape with the renderer; per tick: the view, the skin and the ops. */
function runTape(tape, opts = {}) {
    const rows = [];
    let skin = null;
    drive(tape, (tick, run) => {
        const view = hazardSkinView(run);
        skin = stepHazardSkin(skin, view, tick, opts);
        rows.push({ tick, view, skin, ops: hazardOps(view, art, { skin, ...opts }) });
    });
    return rows;
}

/** One short tag per body per tick, for the golden and the `want` list. */
function tagsOf(r) {
    const out = [];
    const v = r.view;
    for (const a of v.axes) out.push(a.red ? 'a:red' : 'a:plain');
    for (const c of v.chains) out.push(`c:${r.skin.bodies.get(`c:${c.id}`)?.anim.anim ?? 'none'}`);
    for (const c of v.crushers) out.push(r.skin.bodies.get(`k:${c.id}`)?.moving ? 'k:moving' : 'k:rest');
    for (const t of v.totems) {
        const st = r.skin.bodies.get(`t:${t.id}`);
        if (!t.activated) { out.push('t:asleep'); continue; }
        out.push(t.destroy ? 't:destroy' : (t.fullyActivated ? `t:${st.anim}` : 't:ramp'));
        if (t.hitsTimer === 19 || t.hitsTimer === 9) out.push('t:flash');
        if (totemLaserTint(t.laserWidth)) out.push('t:laser');
    }
    if (v.totemShots.length) out.push('shot');
    for (const b of v.bombPushers) out.push(`p:${b.anim || 'none'}`);
    if (v.bombs.length) out.push('bomb');
    for (const g of v.grenades) {
        if (g.y <= g.endY - 48) continue;
        out.push(g.y < g.endY ? 'g:fall' : `g:${g.anim}`);
    }
    return out;
}
/** The tape's family's ops only, and a run of identical lines as one `t=a..b` line. */
function goldenLines(rows, keys) {
    const keep = new Set(keys);
    const lines = [];
    let open = null;
    for (const r of rows) {
        const ops = r.ops.filter((o) => keep.has(o.key) || [...keep].some((k) => o.key?.startsWith(k)));
        const body = `[${[...new Set(tagsOf(r))].join(',')}] | ${ops.map((o) => formatPlayerOp(o, formatOp)).join(' ; ')}`.trimEnd();
        if (open && open.body === body) { open.to = r.tick; continue; }
        if (open) lines.push(open);
        open = { from: r.tick, to: r.tick, body };
    }
    if (open) lines.push(open);
    return lines.map((l) => `t=${l.from}${l.to !== l.from ? `..${l.to}` : ''} ${l.body}`);
}

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
    epoch: { run: RUN, key: 'syn' }, level: 9, gameTime: 900,
    axes: [], chains: [], crushers: [], totems: [], totemShots: [], bombPushers: [], bombs: [], grenades: [],
    ...over,
});
const asleep = { id: 'bosstotem@152,168', x: 152, y: 168, activated: false };
const awake = (over = {}) => ({ id: 'bosstotem@152,168', x: 152, y: 168, activated: true, sinceActivation: 400, fullyActivated: true,
    activationRestTime: 0, waitAtTopTime: 0, state: 1, anim: 'walk', rate: 1, hitsTimer: 0, laserWidth: 6, destroy: false, whiteOutRenders: 0, ...over });

/** Step `views` from a null skin; returns each tick's row. */
function stepAll(views, opts = {}) {
    let skin = null;
    return views.map((view, i) => {
        skin = stepHazardSkin(skin, view, 5000 + i, opts);
        return { tick: 5000 + i, view, skin, ops: hazardOps(view, art, { skin, ...opts }) };
    });
}

export function syntheticViews() {
    const v = [];
    // a bomb's whole flight: spawned (t 30), then its 30 updates
    for (let t = 30; t >= 1; t -= 3) v.push(V({ bombs: [{ id: 'b', x: 80, y: 80 - t, t }] }));
    // a crusher: at rest, a charge, a stop against a wall
    for (const x of [112, 112, 113, 114, 115, 115]) v.push(V({ crushers: [{ id: 'k', x, y: 160 }] }));
    // a totem asleep, then a laser charging and fired
    v.push(V({ totems: [asleep] }));
    for (const w of [6, 6.5, 9, 12, 18]) v.push(V({ totems: [awake({ laserWidth: w, sinceActivation: 400 + v.length })] }));
    return v;
}

describe('1–2. golden hazard ops (frame CHOICE, not pixels)', () => {
    for (const tape of TAPES) {
        it(`the ${tape.name} tape: every tick's ${tape.family} ops`, () => {
            const rows = runTape(tape);
            const lines = goldenLines(rows, tape.keys);
            expect(lines).toEqual(golden(`hazard-${tape.name}.txt`, lines));
            // not vacuous: the tape really reached each state it is named for
            const seen = new Set(rows.flatMap(tagsOf));
            for (const w of tape.want) expect(seen, `${tape.name}: ${w}`).toContain(w);
            const ops = rows.flatMap((r) => r.ops).filter((o) => tape.keys.some((k) => o.key?.startsWith(k)));
            expect(ops.length, `${tape.name}: it drew`).toBeGreaterThan(0);
            expect(ops.every((o) => o.sheetRef), `${tape.name}: every body has art (no rectangle)`).toBe(true);
        }, 240_000);
    }

    it('the synthetic views: a bomb\'s flight, a crusher\'s charge and stop, a totem asleep and its laser', () => {
        const lines = stepAll(syntheticViews()).map((r) => `t=${r.tick} | ${r.ops.map((o) => formatPlayerOp(o, formatOp)).join(' ; ')}`);
        expect(lines).toEqual(golden('hazard-synthetic.txt', lines));
    });

    it('the coverage tables: G3c\'s classes are drawn, every key reached the pack, nothing is counted twice', () => {
        for (const k of [KEYS.axe(false), KEYS.axe(true), KEYS.crusher, KEYS.chain, KEYS.totem, KEYS.totemShot, KEYS.bombPusher, KEYS.bomb, KEYS.grenade]) {
            expect(art.has(k), k).toBe(true);
        }
        const before = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn]);
        for (const c of HAZARD_COVERAGE.drawn) expect(before.has(c), `${c} is G3c's`).toBe(false);
        // G3b's "modelled, not drawn" list is drawn here, every one of it, and G3b's list is empty
        for (const c of ['SpinningAxe', 'Crusher', 'LavaChain', 'BossTotem', 'BombPusher', 'Grenade']) expect(HAZARD_COVERAGE.drawn, c).toContain(c);
        expect(ROOM_BODY_COVERAGE.modelled).toEqual([]);
        expect([...HAZARD_OBJECT_TAGS].sort()).toEqual(['bombpusher', 'bosstotem', 'crusher', 'lavachain', 'spinningaxe']);
    });
});

describe('3. the independent stratum (by hand from the AS3, and the clocks against the model)', () => {
    it('the axe (SpinningAxe.as:37-40,52,62): turned rate·updates CCW about (4, 10); red for _colorType 1; layer −(y + 32)', () => {
        const ax = (red) => ({ id: 'a', x: 72, y: 152, rate: 5, red });
        const rows = stepAll([V({ axes: [ax(true)] }), V({ axes: [ax(true)] }), V({ axes: [ax(false)] })]);
        expect(rows.map((r) => -r.ops[0].rot)).toEqual([5, 10, 15]);          // a run's first view has updated once
        expect(rows[0].ops[0].key).toBe(KEYS.axe(true));
        expect(rows[2].ops[0].key).toBe(KEYS.axe(false));
        expect([rows[0].ops[0].pivotX, rows[0].ops[0].pivotY, rows[0].ops[0].dx, rows[0].ops[0].dy]).toEqual([4, 10, 68, 142]);
        expect(rows[0].ops[0].layer).toBe(-184);
    });

    it('⛓ the axe\'s count is the one the model BILLS (L61, standing in the rate-7 axe\'s sweep through five death rebuilds)', () => {
        const rt = boot(61, [152, 56]);
        let skin = null;
        const rows = [];
        for (let i = 0; i < 600; i += 1) {
            const before = rt.run ? { x: rt.run.state.x, y: rt.run.state.y } : null;
            const prev = skin;
            rt.tick(new Set());
            const view = hazardSkinView(rt.run);
            skin = stepHazardSkin(skin, view, rt.ticks);
            // a death's tick billed the DYING visit (its rebuild is at the end of the tick): its count is the old skin's + 1
            const count = prev && skin.epoch.key !== prev.epoch.key ? prev.updates + 1 : skin.updates;
            rows.push({ t: rt.run.ticksCompleted, before, count, axes: view.axes.length ? view.axes : prev?.axesSeen ?? [] });
            skin.axesSeen = view.axes;
        }
        const billed = new Set(rt.run.playerHits.filter((h) => h.source === 'spinningaxe').map((h) => h.t));
        expect(billed.size).toBeGreaterThan(10);
        expect(rt.run.playerDeaths.length).toBeGreaterThan(3);
        const hitsAt = (r, d) => r.before && r.axes.some((a) => axeHitsPlayer({ cx: a.x, cy: a.y, rate: a.rate }, r.count + d, playerBoxAt(r.before.x, r.before.y)));
        const agree = (d) => rows.filter((r) => billed.has(r.t)).filter((r) => hitsAt(r, d)).length;
        expect(agree(0)).toBe(billed.size);
        // discriminating: one update either way misses some
        expect(agree(-1)).toBeLessThan(billed.size);
        expect(agree(1)).toBeLessThan(billed.size);
    }, 120_000);

    it('⛓ the chain\'s clock is the one the model bills (L76, standing in the arm through its death rebuilds)', () => {
        const rt = boot(76, [128, 92]);
        let skin = null;
        const reach = new Map();
        for (let i = 0; i < 400; i += 1) {
            const prev = skin;
            rt.tick(new Set());
            const view = hazardSkinView(rt.run);
            skin = stepHazardSkin(skin, view, rt.ticks);
            const c = view.chains[0];
            const old = prev?.bodies.get(`c:${c.id}`);
            // re-run this tick's update on the PREVIOUS picture: `stepLavaChain`'s answer is whether `reach()` ran
            const st = old && prev.epoch.key === skin.epoch.key ? structuredClone(old.anim) : null;
            if (st) reach.set(rt.run.ticksCompleted, stepLavaChain(st, view.gameTime - 1));
        }
        const billed = rt.run.playerHits.filter((h) => h.source === 'lavachain').map((h) => h.t);
        expect(billed.length).toBeGreaterThan(3);
        for (const t of billed) expect(reach.get(t), `t${t}`).toBe(true);
    }, 120_000);

    it('the chain (LavaChain.as:39-42,46,52-56): sit until Game.time % 90 < 1.5, then extend [1,2] / hit / retract at fps 15/15/25; turned 90·dir; layer −(y + 8)', () => {
        const ch = { id: 'c', x: 136, y: 72, dir: 3 };
        const rows = stepAll([89, 90, 91, 92, 93, 94, 95].map((g) => V({ gameTime: g + 1, chains: [ch] })));
        const anims = rows.map((r) => r.skin.bodies.get('c:c').anim);
        expect(anims[0].anim).toBe(null);                                     // time 89: nothing played yet
        expect(anims[1].anim).toBe('extend');                                // time 90: worldFrame 0
        // fps 15 × 0.0333 = 0.4995 a tick: extend [1, 2] holds 1 for two updates, then 2
        expect(rows.slice(1, 5).map((r) => r.ops[0].frame)).toEqual([1, 1, 2, 2]);
        expect(rows[1].ops[0].rot).toBe(-270);
        expect(rows[1].ops[0].layer).toBe(-80);
        expect([rows[1].ops[0].pivotX, rows[1].ops[0].pivotY]).toEqual([8, 8]);
    });

    it('the crusher (Crusher.as:43-85,107-113): +8° a render while it moves, 0 the tick it stops; the snap is not a move', () => {
        const at = (x, y = 160) => V({ crushers: [{ id: 'k', x, y }] });
        const rows = stepAll([at(113), at(112), at(113), at(114), at(114), at(114)]);   // off-grid → snapped to 112 at rest
        expect(rows.map((r) => r.skin.bodies.get('k:k').moving)).toEqual([false, false, true, true, false, false]);
        expect(rows.map((r) => -r.ops[0].rot || 0)).toEqual([0, 0, 8, 16, 0, 0]);
        expect([rows[0].ops[0].pivotX, rows[0].ops[0].pivotY, rows[0].ops[0].layer]).toEqual([16, 16, 0]);
        expect(HAZARD_RULES.crusherMoving({ x: 112, y: 160, moving: false }, { x: 112, y: 160 })).toBe(false);
    });

    it('the bomb (Bomb.as:89-121): unscaled and unturned on its spawn tick (t 30), then scale 0.5..1.5 by sin(t/30·π), +15° an update', () => {
        const pose = (t) => HAZARD_RULES.bombPose(t);
        expect(pose(30)).toEqual({ scale: 1, angle: 0 });
        expect(pose(29).angle).toBe(15);
        expect(pose(15).scale).toBeCloseTo(1.5, 12);                        // sin(π/2) = 1
        expect(pose(0).scale).toBeCloseTo(1, 12);
        const [r] = stepAll([V({ bombs: [{ id: 'b', x: 40, y: 40, t: 15 }] })]);
        expect([r.ops[0].scaleX, r.ops[0].rot, r.ops[0].layer]).toEqual([1.5, -225, -160]);
    });

    it('the bomb pusher (BombPusher.as:18-19,29-30): "" → 0, shoot [0,2,1,2,3], sit [0,3] at the model\'s index; layer −(y + 24)', () => {
        const op = (anim, index) => stepAll([V({ bombPushers: [{ id: 'p', x: 136, y: 152, anim, index }] })])[0].ops[0];
        expect([op('', 0).frame, op('shoot', 1).frame, op('shoot', 4).frame, op('sit', 1).frame]).toEqual([0, 2, 3, 3]);
        expect(op('', 0).layer).toBe(-176);
    });

    it('the grenade (Grenade.as:44-47,115-118): alpha (y − startY)/48; sit [0,4] at fps 5 from the ctor; explode / hit from the model\'s age', () => {
        const g = (over) => ({ id: 'g', x: 120, endY: 120, y: 120, anim: 'sit', age: null, updates: 1, ...over });
        const rows = stepAll([V({ grenades: [g({ y: 72 })] }), V({ grenades: [g({ y: 96 })] }), V({ grenades: [g({ updates: 6 })] }),
            V({ grenades: [g({ updates: 7 })] }), V({ grenades: [g({ anim: 'explode', age: 1 })] }), V({ grenades: [g({ anim: 'hit', age: 0 })] })]);
        expect(rows[0].ops).toEqual([]);                                     // dormant at startY: alpha 0
        expect(rows[1].ops[0].alpha).toBeCloseTo(0.5, 12);
        // fps 5 × 0.0333 = 0.1665 a tick: frame 4 from the 7th update
        expect([rows[2].ops[0].frame, rows[3].ops[0].frame]).toEqual([0, 4]);
        expect([rows[4].ops[0].frame, rows[5].ops[0].frame]).toEqual([0, 5]);
        expect(rows[3].ops[0].layer).toBe(-123);
    });

    it('the totem asleep (BossTotem.as:516-521,605-625): the default pose — legs ±45°+10, arms ∓45°+10, no head; layer 0', () => {
        const [r] = stepAll([V({ totems: [asleep] })]);
        expect(r.ops.map((o) => o.frame)).toEqual([2, 2, 1, 1]);
        expect(r.ops.map((o) => -o.rot)).toEqual([55, -35, -35, 55]);
        // legs at (x − 12 + 6, y − 8 + 16) and (x + 12 − 6, y + 8 + 16); arms at (x + 20 − 23, y + 4) and (x − 20 + 23, y + 4)
        expect(r.ops.map((o) => [o.dx + o.pivotX, o.dy + o.pivotY])).toEqual([[146, 176], [158, 192], [149, 172], [155, 172]]);
        expect(r.ops.map((o) => o.scaleX ?? 1)).toEqual([1, -1, 1, -1]);
        expect(r.ops.map((o) => [o.pivotX, o.pivotY])).toEqual([[0, 0], [0, 0], [23, 0], [23, 0]]);
        expect(r.ops.every((o) => o.layer === 0)).toBe(true);
    });

    it('the totem awake (BossTotem.as:629-640): the head at its origin (16, 47), faded by activationStage, tinted by the laser', () => {
        const head = (over) => stepAll([V({ totems: [awake(over)] })])[0].ops.at(-1);
        expect([head({}).frame, head({}).pivotX, head({}).pivotY]).toEqual([0, 16, 47]);
        expect(head({}).tint).toBeUndefined();                               // laserWidth 6: white
        // w 9: t = 3/6/2 + 0.5 = 0.75 → g = b = uint(255 − 255·0.75) = 63
        expect(head({ laserWidth: 9 }).tint).toBe('#ff3f3f');
        expect(head({ laserWidth: 18 }).tint).toBe('#ffff00');
        const ramp = head({ fullyActivated: false, sinceActivation: 130 });
        expect(ramp.alpha).toBeCloseTo(totemActivationStage(130), 12);
        expect(ramp.alpha).toBeGreaterThan(0);
        expect(ramp.alpha).toBeLessThan(1);
        expect(head({}).layer).toBe(-(168 + 44));
    });

    it('the totem\'s limbs flash for ONE frame (Enemy.as:223-243 + BossTotem.as:642): at hitsTimer 19 and 9 after the update, never 20', () => {
        const tints = [20, 19, 18, 10, 9, 8, 0].map((h) => stepAll([V({ totems: [awake({ hitsTimer: h })] })])[0].ops[0].tint ?? null);
        expect(tints).toEqual([null, ENEMY_HIT_TINT, null, null, ENEMY_HIT_TINT, null, null]);
    });

    it('⛓ the totem\'s clocks are the model\'s (stepBossTotem through the wake, the walk, the laser, the attack and the jump)', () => {
        const b = createBossTotem(152, 168);
        let skin = null;
        const seen = new Set();
        let compared = 0;
        for (let t = 0; t < 1400; t += 1) {
            stepBossTotem(b, { wandGone: true, freezeObjects: false, playerY: 100, playerBox: null, isSolid: () => false });
            renderBossTotem(b);                            // the run's order: update, then render (the laser reads its headY)
            const view = V({ gameTime: 1000 + t, totems: [{ id: 'bt', x: b.x, y: b.y, activated: b.activated, sinceActivation: b.sinceActivation,
                fullyActivated: b.fullyActivated, activationRestTime: b.activationRestTime, waitAtTopTime: b.waitAtTopTime, state: b.state,
                anim: b.anim, rate: b.rate, hitsTimer: b.hitsTimer, laserWidth: b.laserWidth, destroy: b.destroy, whiteOutRenders: 0 }] });
            skin = stepHazardSkin(skin, view, 1000 + t);
            const st = skin.bodies.get('t:bt');
            expect(st.anim, `t${t}`).toBe(b.anim);
            expect(st.frame, `t${t} ${b.anim}`).toBeCloseTo(b.currentFrame, 12);
            expect(st.animate, `t${t}`).toBe(b.animate);
            expect(totemActivationStage(b.sinceActivation), `t${t}`).toBe(b.activationStage);
            seen.add(b.anim);
            compared += 1;
        }
        expect(compared).toBe(1400);
        expect([...seen].sort()).toEqual(['attack', 'jump', 'rest', 'walk']);
    });

    it('a totem shot (BossTotemShot.as:27-29): "fly" [0,1,2] at fps 10 from its first sight; v.x 0 never turns it; layer −(y + 8)', () => {
        const rows = stepAll(Array.from({ length: 8 }, (_, k) => V({ totemShots: [{ id: 's', x: 182, y: 243 + 2 * k }] })));
        expect(rows.map((r) => r.ops[0].frame)).toEqual([0, 0, 0, 0, 1, 1, 1, 2]);
        expect(rows[0].ops[0].rot).toBe(0);
        expect(rows[0].ops[0].layer).toBe(-251);
    });
});

describe('4. one mutant per family turns a golden red', () => {
    const T = Object.fromEntries(TAPES.map((t) => [t.name, t]));
    const differs = (tape, opts) => {
        const want = readFileSync(join(GOLDENS, `hazard-${tape.name}.txt`), 'utf8').trimEnd().split('\n');
        const got = goldenLines(runTape(tape, opts), tape.keys);
        return got.filter((l, i) => l !== want[i]).length + Math.abs(got.length - want.length);
    };
    const MUTANTS = [
        ['SpinningAxe — axeAngle: one update late', 'axe-L61', { rules: { axeAngle: (rate, u) => rate * (u - 1) } }],
        ['LavaChain — stepLavaChain: Game.time one late', 'chain-L76', { rules: { stepLavaChain: (st, time) => stepLavaChain(st, time - 1) } }],
        ['Crusher — crusherMoving: never moves', 'crusher-L42', { rules: { crusherMoving: () => false } }],
        ['BossTotem — totemFrameStep: a state change keeps the frame', 'totem-kill-L43', { rules: { totemFrameStep: (st, p, t) => HAZARD_RULES.totemFrameStep(st, p, { ...t, anim: st.anim }) } }],
        ['BossTotem — totemLaserTint: never tinted', 'totem-kill-L43', { rules: { totemLaserTint: () => null } }],
        ['BossTotem — totemActivationStage: awake at once', 'totem-kill-L43', { rules: { totemActivationStage: () => 1 } }],
        ['BombPusher — pusherFrame: the anim\'s first frame only', 'bombpusher-L40', { rules: { pusherFrame: (anim, i) => HAZARD_RULES.pusherFrame(anim, 0) } }],
        ['Bomb — bombPose: never scaled', 'bombpusher-L40', { rules: { bombPose: (t) => ({ ...HAZARD_RULES.bombPose(t), scale: 1 }) } }],
        ['Grenade — updateSprite: twice the fps', 'grenade-L59', { rules: { updateSprite: (sp, a, e) => HAZARD_RULES.updateSprite(sp, a, e, 2) } }],
    ];
    for (const [name, tape, opts] of MUTANTS) it(name, () => expect(differs(T[tape], opts)).toBeGreaterThan(5), 240_000);
});

describe('5. the adapter reads the run and writes nothing', () => {
    const frozen = (o) => new Proxy(o, { set: () => { throw new Error('hazardSkinView wrote to the run'); }, defineProperty: () => { throw new Error('hazardSkinView defined on the run'); } });

    it('maps every family; a write anywhere throws', () => {
        const run = frozen({
            level: 43, gameTime: 50, transitions: [], playerDeaths: [], state: frozen({ x: 1, y: 2 }),
            world: frozen({
                combat: frozen({ hazards: [frozen({ tag: 'spinningaxe', x: 64, y: 144, cx: 72, cy: 152, attrs: frozen({ rate: '5', colortype: '1' }) }),
                    frozen({ tag: 'lavachain', x: 128, y: 64, cx: 136, cy: 72, attrs: frozen({ dir: '3' }) })] }),
                bossTotems: [frozen({ id: 'bosstotem@152,168', ex: 152, ey: 168 })],
            }),
            crushers: new Map([['crusher@96,144', frozen({ id: 'crusher@96,144', x: 113, y: 160, rect: {} })]]),
            bossesWoken: [frozen({ x: 152, y: 170, sinceActivation: 5, fullyActivated: false, activationRestTime: 120, waitAtTopTime: 0, state: 0,
                anim: 'rest', rate: 0, hitsTimer: 0, laserWidth: 6, destroy: false, whiteOutRenders: 0, removed: false })],
            bossShots: [frozen({ id: 's1', x: 182, y: 243, vx: 0, vy: 2, removed: false })],
            bombPushers: [frozen({ id: 'bombpusher@112,128', x: 136, y: 152, anim: 'shoot', animIndex: 2 })],
            bombs: [frozen({ id: 'b1', x: 136, y: 152, t: 29, removed: false }), frozen({ id: 'b0', x: 0, y: 0, t: 0, removed: true })],
            placedGrenades: [frozen({ id: 'grenade@112,112', x: 120, y: 72, endY: 120, anim: 'sit', animAge: null, updates: 3, removed: false })],
        });
        const v = hazardSkinView(run);
        expect(v.epoch).toEqual({ run, key: '43|0|0' });
        expect(v.axes).toEqual([{ id: 'spinningaxe@64,144', x: 72, y: 152, rate: 5, red: true }]);
        expect(v.chains).toEqual([{ id: 'lavachain@128,64', x: 136, y: 72, dir: 3 }]);
        expect(v.crushers).toEqual([{ id: 'crusher@96,144', x: 113, y: 160 }]);
        expect(v.totems).toMatchObject([{ id: 'bosstotem@152,168', x: 152, y: 170, activated: true, sinceActivation: 5, anim: 'rest' }]);
        expect(v.totemShots).toEqual([{ id: 's1', x: 182, y: 243 }]);
        expect(v.bombPushers).toEqual([{ id: 'bombpusher@112,128', x: 136, y: 152, anim: 'shoot', index: 2 }]);
        expect(v.bombs).toEqual([{ id: 'b1', x: 136, y: 152, t: 29 }]);
        expect(v.grenades).toEqual([{ id: 'grenade@112,112', x: 120, y: 72, endY: 120, anim: 'sit', age: null, updates: 3 }]);
        expect(hazardSkinView(null)).toBe(null);
    });

    it('a sleeping totem is drawn from the world\'s row (the woken list is empty until the wake)', () => {
        const v = hazardSkinView({ level: 43, state: { x: 0, y: 0 }, bossesWoken: [], world: { bossTotems: [{ id: 'bt', ex: 152, ey: 168 }] } });
        expect(v.totems).toEqual([{ id: 'bt', x: 152, y: 168, activated: false }]);
    });
});

describe('6. ⛔ STATE IDENTITY — the hazard renderer never touches the run', () => {
    for (const tape of TAPES) {
        it(`${tape.name}: the stream, the end state, the ledgers and the stateLog byte-identical with the renderer on and off`, () => {
            const off = drive(tape);
            let drawn = 0;
            let skin = null;
            const on = drive(tape, (tick, run) => {
                const view = hazardSkinView(run);
                skin = stepHazardSkin(skin, view, tick);
                drawn += hazardOps(view, art, { skin }).length;
            });
            expect(drawn).toBeGreaterThan(0);              // not vacuous: it drew bodies
            expect(md5(on.stream.join('\n'))).toBe(md5(off.stream.join('\n')));
            expect(md5(on.end)).toBe(md5(off.end));
            expect(md5(on.stateLog)).toBe(md5(off.stateLog));
        }, 240_000);
    }
});
