/**
 * ⛓⛓ SEEDLING FIDELITY CEREMONYTOWER (wave 54) — the one update a family takes on a freeze's edge frames
 * (`CONTACT_FIDELITY.freezeEdgeFrames`, OFF byte-identical).
 *
 * (1) A texted pickup's later frames. `Pickup.update` calls `pick_up()` on every frame after T (`Pickups/Pickup.as:57-60`)
 * and re-raises `Game.freezeObjects` (`:95`) until its text NPC is gone; the pickups (`Game.as:2330-2351`) update before
 * the beam tower (`:2297`), so the tower's one update there is frozen. The model stepped it twice (the main slot, then
 * `runFrozenTick`); ON the main slot skips on a tick whose ceremony holds through.
 * (2) A falling rock's release frame. `FallRock.update` lowers the flag (`Scenery/FallRock.as:92-96`) before every family
 * added above it (`:2353` vs the turrets `:2295`, the drills `:2290`, the chasers `:2276-2301`): ONE UNFROZEN update on a
 * dead frame. The model stepped only the player (`pendingFreeSteps`); ON it steps the turrets (and their span's frozen
 * frames, whose anim runs), the drills and the chasers there, in that order.
 *
 * Every family row is STAGED or replays a committed tape with `.oel` rows appended (no shipped tower room holds a special
 * pickup; L28's rope room holds no chaser in range at the release). One row is SHIPPED: L29's turrets, ON one spit early.
 * ⚠ Not game-witnessed: every ON row (the pieces are the AS3 lines above and the families' own transcriptions).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { ROCKBUTTON_WITNESS_DIR } from './fidelityRockButton.js';

const KEY = 'freezeEdgeFrames';
const ALL = { [KEY]: true, frozenTickUngated: true, pickupTickFreeze: true, dialogueFrameFreeze: true,
    turretSuitRetaliation: true };
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const SUIT = (level) => [{ level, items: ['darksuit', 'health', 'health', 'health'] }];
const TOWER = (x, y) => ({ type: 'beamtower', x, y, attrs: { direction: '0', rate: '1', speed: '1' } });

function stagedSource(level, inject) {
    if (inject.length === 0) return atlasLevelSource();
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === level);
    L.entities = L.entities.concat(inject);
    return levelSourceFromAtlas(atlas);
}

const snap = (run, k) => ({
    frozen: null,
    player: [run.state.x, run.state.y],
    bodies: run.entities('chasers').map((c) => [c.id, c.x, c.y, c.vx, c.vy, c.hits, c.hitsTimer]),
    turrets: [...run.shooters.values()].map((s) => [s.id, s.shootTimer, s.anim]),
    beam: run.beamTowerTrace.filter((r) => r.t === k + 1).map((r) => r.frozen),
});
const ledgers = (run) => ({
    hits: run.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
    starts: run.ceremonyStarts.map((s) => [s.t, s.tag]),
    collected: run.collected.map((c) => c.t),
    falls: run.rockFalls.map((r) => [r.t, r.id, r.deadFrames]),
    spits: run.spitEvents.filter((e) => e.what === 'spawn').map((e) => [e.t, e.id]),
});

/** Boot, hold `keys(k)` on tick index `k`, `ticks` ticks; the whole observable result per tick (or the throw). */
function stage({ level, x, y, inject = [], ticks, keys, grants = [] }, over = {}) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({
            levelSource: stagedSource(level, inject), boot: { level, x, y },
            pins: ['sound', 'dead_frames'], roles: ROLES, ...(grants.length > 0 ? { grants } : {}),
        });
        let thrown = null;
        const frames = [];
        try {
            for (let k = 0; k < ticks; k += 1) {
                const a = run.advance(new Set(keys(k)));
                frames.push({ ...snap(run, k), frozen: a.frozen === true });
            }
        } catch (e) {
            thrown = e.message;
        }
        return { thrown, frames, ...ledgers(run) };
    });
}

/** Replay a committed tape with `.oel` rows appended to one level; the same observables per tape tick. */
function replay(tapeJson, { level, inject }, over = {}) {
    return withContactFidelity(over, () => {
        let run = null;
        let thrown = null;
        const frames = [];
        try {
            const st = createTapeStepper(parseTape(JSON.stringify(tapeJson)), {
                levelSource: stagedSource(level, inject), onTick: (t, s, h, rn) => { run = rn; },
            });
            let r = st.next();
            while (!r.done) {
                if (run) frames.push(snap(run, frames.length));
                r = st.next();
            }
        } catch (e) {
            thrown = e.message;
        }
        return { thrown, frames, ...(run ? ledgers(run) : {}) };
    });
}

const bodyOf = (r, id) => r.frames.map((f) => f.bodies.find((b) => b[0] === id));
const r3 = (v) => Math.round(v * 1000) / 1000;
const at3 = (b) => [r3(b[1]), r3(b[2])];
const turretOf = (r, id) => r.frames.map((f) => f.turrets.find((t) => t[0] === id));

describe('CEREMONYTOWER — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_FREEZE_EDGE_FRAMES)(
        'ships OFF, appended after frozenTickUngated, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 55: RELEASETICK `freezeReleaseTick` was appended after this key.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['freezeReleaseTick', 'freezeSpanUpdates', 'nestedRockCeremony', 'plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter', 'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies', 'wandShotEnemyBodies', 'freezeFramesStepResponders', 'pulserDeadFrameUpdate', 'blockPressesFallRockButtonSameFrame']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FREEZE_EDGE_FRAMES');
        });
});

describe('CEREMONYTOWER — the beam tower through a texted pickup\'s ceremony (L29, `beamtower@112,40`, a feather underfoot)', () => {
    // the feather is collected at the boot (T = t1); the talk key is tapped from t10 until the dialogue closes
    const s = { level: 29, x: 144, y: 48, inject: [TOWER(112, 40), { type: 'feather', x: 144, y: 48, attrs: { tag: '5' } }],
        ticks: 60, keys: (k) => (k > 8 && k % 2 === 1 ? ['primary'] : []) };
    const rows = (r) => {
        const close = r.collected[0];
        return { T: r.frames[0].beam, later: r.frames.slice(1, close - 1).map((f) => f.beam),
            closing: r.frames[close - 1].beam, after: r.frames[close].beam, frozenLater: r.frames.slice(1, close - 1)
                .every((f) => f.frozen), closingFrozen: r.frames[close - 1].frozen };
    };
    it('OFF the dialogue ticks step it twice, frozen; ON once (`runFrozenTick`\'s); the closing tick once either way', () => {
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(on.starts).toEqual(off.starts);
        expect(on.collected).toEqual(off.collected);
        const ro = rows(off);
        const rn = rows(on);
        expect(ro.later.length).toBeGreaterThan(8);
        expect([ro.frozenLater, rn.frozenLater, ro.closingFrozen, rn.closingFrozen]).toEqual([true, true, false, false]);
        expect(new Set(ro.later.map((b) => JSON.stringify(b)))).toEqual(new Set([JSON.stringify([true, true])]));
        expect(new Set(rn.later.map((b) => JSON.stringify(b)))).toEqual(new Set([JSON.stringify([true])]));
        // ⚠ the closing tick is ONE step either way (it falls through: no `runFrozenTick`), and it is frozen — the game's
        // release frame steps the tower UNFROZEN (`pick_up`'s `!myText` arm lowers the flag first): named, not changed
        expect([ro.closing, rn.closing]).toEqual([[true], [true]]);
        expect([ro.after, rn.after]).toEqual([[false], [false]]);
        // T is wave 51's (`pickupTickFreeze` OFF here)
        expect([ro.T, rn.T]).toEqual([[false, true], [false, true]]);
    });
    it('composed with every wave-51..53 key ON: T, the dialogue ticks and the closing tick each one step', () => {
        const all = rows(stage(s, ALL));
        expect([all.T, all.closing, all.after]).toEqual([[true], [true], [false]]);
        expect(new Set(all.later.map((b) => JSON.stringify(b)))).toEqual(new Set([JSON.stringify([true])]));
        // and this key OFF under the others: the dialogue ticks are still stepped twice
        const rest = rows(stage(s, { ...ALL, [KEY]: false }));
        expect(new Set(rest.later.map((b) => JSON.stringify(b)))).toEqual(new Set([JSON.stringify([true, true])]));
    });
});

describe('CEREMONYTOWER — a rope-dropped rock\'s release frame (L28\'s livefall tape, `jellyfish@144,176` staged)', () => {
    const tape = JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, 'rockbutton-l28-livefall.json'), 'utf8')).tape;
    const J = 'jellyfish@144,176';
    const s = { level: 28, inject: [{ type: 'jellyfish', x: 144, y: 176 }] };
    it('OFF the jellyfish takes no update there; ON it takes its one unfrozen move, and leads OFF by it after', () => {
        const off = replay(tape, s, { [KEY]: false });
        const on = replay(tape, s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(on.falls).toEqual(off.falls);
        expect(off.falls).toEqual([[155, 'fallrock@112,240', 181]]);
        const jo = bodyOf(off, J).map(at3);
        const jn = bodyOf(on, J).map(at3);
        const first = jn.findIndex((p, k) => p.join() !== jo[k].join());
        expect(first).toBeGreaterThan(150);
        expect(jn.slice(0, first)).toEqual(jo.slice(0, first));
        expect([jo[first], jn[first]]).toEqual([[152, 184], [152.18, 183.48]]);
        // OFF reaches ON's position one tape tick later: the release frame's move, not a different path
        expect(jo[first + 1]).toEqual(jn[first]);
        expect(off.frames.map((f) => f.player)).toEqual(on.frames.map((f) => f.player));
    });
    it('composed with every wave-51..53 key ON: no throw, the same release-frame lead', () => {
        const all = replay(tape, s, ALL);
        const rest = replay(tape, s, { ...ALL, [KEY]: false });
        expect([all.thrown, rest.thrown]).toEqual([null, null]);
        const ja = bodyOf(all, J).map(at3);
        const jr = bodyOf(rest, J).map(at3);
        const first = ja.findIndex((p, k) => p.join() !== jr[k].join());
        expect(first).toBeGreaterThan(150);
        expect(jr[first + 1]).toEqual(ja[first]);
    });
});

describe('CEREMONYTOWER — a button-dropped rock\'s release frame (L29 as shipped: `button@112,128`, its turrets)', () => {
    const s = { level: 29, x: 112, y: 144, ticks: 80, keys: () => ['up'] };
    const T = 'turret@80,176';
    it('OFF the turrets leave the span mid-shot with `shootTimer` 40; ON the anim ran out and the release frame counted one', () => {
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(on.falls).toEqual(off.falls);
        expect(off.falls).toEqual([[11, 'fallrock@112,112', 172]]);
        const F = off.falls[0][0];
        expect(turretOf(on, T).slice(0, F - 1)).toEqual(turretOf(off, T).slice(0, F - 1));
        expect([turretOf(off, T)[F - 1], turretOf(on, T)[F - 1]]).toEqual([[T, 40, 'finishshot'], [T, 39, '']]);
        // the next spit: five ticks earlier ON
        const next = (r) => r.spits.filter(([, id]) => id.startsWith(T)).map(([t]) => t)[1];
        expect([next(off), next(on)]).toEqual([62, 57]);
        expect(off.frames.map((f) => f.player)).toEqual(on.frames.map((f) => f.player));
    });
    it('with a suited bob staged under the player (`bob@112,150`): ON its one unfrozen move and `hitsTimer` drain', () => {
        const b = { ...s, x: 112, y: 144, inject: [{ type: 'bob', x: 112, y: 150 }], grants: SUIT(29), ticks: 12 };
        const B = 'bob@112,150';
        const off = stage(b, { [KEY]: false });
        const on = stage(b, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        const F = off.falls[0][0];
        expect(F).toBe(6);
        const bo = bodyOf(off, B);
        const bn = bodyOf(on, B);
        expect(bn.slice(0, F - 1)).toEqual(bo.slice(0, F - 1));
        expect([bo[F - 1][6], bn[F - 1][6]]).toEqual([26, 25]);
        expect([at3(bo[F - 1]), at3(bn[F - 1])]).toEqual([[119.746, 157.921], [119.865, 157.701]]);
        // OFF takes that move a tick later
        expect(bo[F].slice(1, 3)).toEqual(bn[F - 1].slice(1, 3));
        // with `frozenTickUngated` ON too the span drained the i-frames already; the release move is still this key's
        const allOn = stage(b, ALL);
        const allRest = stage(b, { ...ALL, [KEY]: false });
        expect([allOn.thrown, allRest.thrown]).toEqual([null, null]);
        expect([bodyOf(allRest, B)[F - 1][6], bodyOf(allOn, B)[F - 1][6]]).toEqual([0, 0]);
        expect(bodyOf(allOn, B)[F - 1].slice(1, 3)).toEqual(bn[F - 1].slice(1, 3));
        expect(bodyOf(allRest, B)[F - 1].slice(1, 3)).toEqual(bo[F - 1].slice(1, 3));
    });
    it('a rock room holding a beam tower is refused by name ON at the release frame (OFF as before)', () => {
        const t = { ...s, inject: [TOWER(240, 40)], ticks: 14 };
        const off = stage(t, { [KEY]: false });
        const on = stage(t, { [KEY]: true });
        expect(off.thrown).toBe(null);
        expect(on.thrown).toMatch(/release frame .* meets a BeamTower.*fidelity CEREMONYTOWER/);
    });
});

describe('CEREMONYTOWER — where it changes nothing', () => {
    it('no freeze (L88, a suited bob and a Puncher, no X, no rock): ON = OFF, the whole result', () => {
        const s = { level: 88, x: 56, y: 112, inject: [{ type: 'bob', x: 60, y: 112 }, { type: 'puncher', x: 88, y: 112 }],
            grants: SUIT(88), ticks: 60, keys: (k) => (k >= 20 ? ['right'] : []) };
        expect(stage(s, { [KEY]: true })).toEqual(stage(s, { [KEY]: false }));
    });
    it('L74 as shipped (the arrival presses `button@288,128`; the bulb and runners take no move there): ON = OFF', () => {
        const s = { level: 74, x: 288, y: 144, ticks: 60, keys: (k) => (k < 60 ? ['up'] : []) };
        const off = stage(s, { [KEY]: false });
        expect(off.falls.length).toBe(1);
        expect(stage(s, { [KEY]: true })).toEqual(off);
    });
    it('L28\'s livefall tape as shipped (`bobsoldier@264,168` does not move at the release): ON = OFF', () => {
        const tape = JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, 'rockbutton-l28-livefall.json'), 'utf8')).tape;
        const off = replay(tape, { level: 28, inject: [] }, { [KEY]: false });
        expect(off.falls.length).toBe(1);
        expect(replay(tape, { level: 28, inject: [] }, { [KEY]: true })).toEqual(off);
    });
});
