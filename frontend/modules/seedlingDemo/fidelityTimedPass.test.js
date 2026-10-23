/**
 * seedling-fidelity-timedpass (wave 27) — THE SOLVER WALKS PAST A HOPPING DRILL IT CANNOT KILL
 * (`CONTACT_FIDELITY.drillTimedPass`, OFF; `solverBot.execDrillTimedPass`).
 *
 * ⚖ The user (2026-10-23): *"Keep Fire; timed pass."* L28's rope rule stays Sword | Spear | Fire; Fire cannot kill a
 * drill (DRILLKILL W0), so Fire alone from the L26 arrival needs a no-hit walk past `drill@80,96` and `drill@128,96`.
 *
 * W0 (the game, `drillkill-l28-fire-l26`, p4g): an awake drill hops every 15 ticks — "drill" 7, "undrill" 7, then the
 * "sit" check — not the 27 the brief quoted; and a player 8-9 px off on the hop's axis is jumped over (8.05 in front,
 * then 7.95 behind) with no contact. The contact (`Enemy.hitPlayer`) is the 10x10 box against the player's 4x5 on
 * every tick, so a pass is a position question at each hop: it is SEARCHED on the run's forecast (`corridorBodyForecast`
 * asked with `drillPass`, `previewStepper`), certified on a fork with the cut, then played.
 *
 * D1 (the game, p4g, `probe-seedling-timed-pass.mjs --record` → `fixtures/timedpass-witness/`): both plans play hit-free
 * through the cut, and the model reproduces them at 0 px ONLY with the D1 transcription the witnesses found — a
 * `FallRock`'s frozen span (L28's rope publishes its group to `fallrock@112,240`) steps the drills' GRAPHICS (their
 * entity update is frozen, their anim is not, so each reaches "sit") and the CAMERA (it pans to the rock and holds,
 * `Game.shake = 30` on the landing, and returns after the release), and the release frame runs the drills live (a
 * drill in "sit" hops — onto the stance). Its contact lands when the returning camera brings it on screen: 2 ticks
 * after the goal at L26 (t134), 1 at L25 (t71). OFF the model kept the anims and the camera: a 1-tick divergence.
 *
 * ON: Fire from L26 SOLVES (pass to (152,56), 121 t, then the cut: 132 t, 0 hits); Fire from L25 plans a pass too
 * (its walk wakes `drill@128,96`: 89 → 70 t, 0 hits — a measured mover); every Sword and Spear plan is the kill's,
 * tick-identical to OFF. OFF: byte-identical (DRILLKILL's own refusal for Fire from L26).
 *
 * Mutants (predicted first; copy + edit + run + restore), the results in the report:
 *   p1  `execDrillTimedPass` is not called (the `drillTimedPass` branch dropped)   → the Fire L26 / L25 ON rows red
 *                                                                                    (measured: as predicted, 3 red)
 *   p2  the search's tail 0 (no standing ticks asked at the stance)               → Fire L26's pass is found at an
 *                                                                                    earlier arrival and the fork's cut
 *                                                                                    is hit: the certificate refuses it
 *                                                                                    (measured: as predicted — all three
 *                                                                                    stances found, each hit on the
 *                                                                                    fork by `drill@128,96`; 3 red)
 *   p3  the forecast's `fork()` shares its drill map with the original           → the search corrupts its own
 *                                                                                    forecast: the fork row red, the pass
 *                                                                                    not found or not certified
 *                                                                                    (measured: 4 red, L25's row too)
 *   p4  no certificate (a found pass played as found) with tail 0                 → predicted: Fire L26 HIT on the run,
 *                                                                                    refused by name. MEASURED: the pass
 *                                                                                    (to (152,88), 107 t) is hit-free and
 *                                                                                    the CUT is hit — and the segment
 *                                                                                    still SOLVES, 118 t with 1 hit: the
 *                                                                                    clear-tag does not refuse a hit
 *                                                                                    during the fire cut, so the stand
 *                                                                                    and the certificate are the guard
 *                                                                                    (4 red, on the 0-hit asserts)
 *   d1a the frozen span steps no drill graphic                                    → both 0-px replays red (the parked
 *                                                                                    drill never reaches "sit"; as
 *                                                                                    predicted, 2 red)
 *   d1b the span's camera stepped AFTER the rock's target write                   → both 0-px replays red (the camera
 *                                                                                    returns a frame early, the contact a
 *                                                                                    tick early; as predicted, 2 red)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment, SolverRefusal, DRILL_TIMED_PASS } from './solverBot.js';
import { DRILLKILL_WITNESS_DIR, compareDrillKillWitness, drillKillModelSamples } from './fidelityDrillKill.js';
import { TIMEDPASS_SWITCHES, TIMEDPASS_WITNESS_DIR, TIMEDPASS_WITNESSES, timedPassTape } from './fidelityTimedPass.js';

const SRC = atlasLevelSource();
const L28_CUT = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });
const ARRIVALS = Object.freeze({ L25: { level: 28, x: 96, y: 16 }, L26: { level: 28, x: 16, y: 96 } });

function solve(arrival, items, { fork = true } = {}) {
    const boot = ARRIVALS[arrival];
    const staging = arrivalStaging(boot, { items });
    const run = createRunForStaging(staging, SRC);
    try {
        const out = solveSegment({ run, goals: [{ ...L28_CUT }], name: 'timedpass', boot,
            ...(fork ? { forkRun: () => createRunForStaging(staging, SRC) } : {}) });
        const rec = (out.records ?? []).find((r) => r.goal === 'clear-tag') ?? null;
        return { run, out, refusal: null, rec, pass: rec?.drillPass ?? null, kills: rec?.drillKills ?? [] };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { run, out: null, refusal: e, rec: null, pass: null, kills: [] };
    }
}
const ON = (fn) => withContactFidelity({ drillTimedPass: true }, fn);
const OFF = (fn) => withContactFidelity({ drillTimedPass: false }, fn);
const keys = (out) => out.perTick.map((h) => [...h].sort().join('+'));
const pulled = (run) => (run.ledger('ropePulls') ?? []).some((p) => p.id === 'rope@160,64');

describe('fidelity TIMEDPASS — the switch', () => {
    it('is OFF by default, and its prerequisites are ON (the kill first, every drill stepped)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.drillTimedPass).toBe(false);
        expect(CONTACT_FIDELITY.drillTimedPass).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS).toMatchObject({ drillLive: true, drillMixedRooms: true, drillKillFirst: true,
            ropeCutAnyWeapon: true, corridorBodyPricing: false });
    });
    it('the search asks a stand long enough for the fire cut (11 ticks from arrival to its end at L26)', () => {
        expect(DRILL_TIMED_PASS.tail).toBeGreaterThanOrEqual(11);
        expect(DRILL_TIMED_PASS.arrivalStall).toBe(45);
    });
});

describe('fidelity TIMEDPASS — W0: the drill\'s hop cycle and the jump-over band, on the game', () => {
    const rec = JSON.parse(readFileSync(join(DRILLKILL_WITNESS_DIR, 'drillkill-l28-fire-l26.json'), 'utf8'));
    const west = (s) => (s.drills ?? []).find((d) => d.x <= 120);
    it('an awake drill hops every 15 ticks: "drill" 7, "undrill" 7, then the "sit" check (p4g)', () => {
        const hops = [];
        let prev = null;
        for (const s of rec.samples) {
            if (!s) continue;
            const d = west(s);
            if (prev && d && (d.x !== prev.x || d.y !== prev.y)) hops.push(s.t);
            if (d && prev && d.anim !== prev.anim && d.anim === 'undrill') {
                // the drill anim's length: from the hop to "undrill"
                expect(s.t - hops.at(-1)).toBe(7);
            }
            prev = d;
        }
        expect(hops).toEqual([15, 30, 45]);
    });
    it('a player 8-9 px off on the axis is jumped over with no contact: 8.05 in front, then 7.95 behind', () => {
        const at = (t) => rec.samples.find((s) => s && s.t === t);
        expect(at(30).x - west(at(30)).x).toBeCloseTo(-8.05, 5);
        expect(at(45).x - west(at(45)).x).toBeCloseTo(7.95, 5);
        expect(rec.samples.filter((s) => s && s.t <= 59).every((s) => s.hits === 0)).toBe(true);
    });
});

describe('fidelity TIMEDPASS — the drill forecast (`corridorBodyForecast`, asked with `drillPass`)', () => {
    const run0 = () => createRunForStaging(arrivalStaging(ARRIVALS.L26, { items: ['hasFire'] }), SRC);
    it('is null with `corridorBodyPricing` OFF unless asked with `drillPass` (every other caller unchanged)', () => {
        const run = run0();
        expect(run.corridorBodyForecast()).toBeNull();
        expect(run.corridorBodyForecast({ drillPass: true })).not.toBeNull();
    });
    it('`fork()` is independent: stepping the fork leaves the original where it was', () => {
        const run = run0();
        const fc = run.corridorBodyForecast({ drillPass: true });
        const stepper = run.previewStepper();
        let st = { ...run.state };
        for (let i = 0; i < 12; i += 1) { fc.step(st); st = stepper(st, new Set(['right'])); }
        const before = JSON.stringify(fc.drills().map((d) => [d.id, d.x, d.y, d.anim]));
        const f = fc.fork();
        let s2 = st;
        for (let i = 0; i < 20; i += 1) { f.step(s2); s2 = stepper(s2, new Set(['right'])); }
        expect(JSON.stringify(f.drills().map((d) => [d.id, d.x, d.y, d.anim]))).not.toEqual(before);
        expect(JSON.stringify(fc.drills().map((d) => [d.id, d.x, d.y, d.anim]))).toEqual(before);
    });
    it('agrees with the run tick by tick on a walk that wakes `drill@80,96` (positions and anims)', () => {
        const run = run0();
        const fc = run.corridorBodyForecast({ drillPass: true });
        for (let i = 0; i < 40; i += 1) {
            const rows = fc.step({ ...run.state });
            run.advance(new Set(i < 25 ? ['right'] : []));
            const live = run.drills.bodies.filter((d) => !d.removed).map((d) => [d.id, d.x, d.y]).sort();
            expect(rows.filter((r) => r.kind === 'drill').map((r) => [r.id, r.x, r.y]).sort()).toEqual(live);
        }
    });
});

describe('fidelity TIMEDPASS — D2: the pass (L28 rope cut `{28,0}`)', () => {
    it('ON: Fire alone from L26 SOLVES — a certified pass to (152,56) past both drills, then the cut, 0 hits', () => ON(() => {
        const { run, out, refusal, pass, kills } = solve('L26', ['hasFire']);
        expect(refusal).toBeNull();
        expect(kills).toEqual([]);
        expect(pass).toMatchObject({ verb: 'drill-pass', drills: ['drill@80,96', 'drill@128,96'],
            stance: { x: 152, y: 56 }, ticks: 121, certified: true });
        expect(pass.skipped.map((s) => [s.stance.x, s.stance.y])).toEqual([[152, 88], [152, 72]]);
        expect(out.perTick.length).toBe(132);
        expect(run.damage.hits).toBe(0);
        expect((run.ledger('playerHits') ?? []).length).toBe(0);
        expect(pulled(run)).toBe(true);
    }), 180000);
    it('ON, without a fork: the same pass, played as found (uncertified), the same plan', () => ON(() => {
        const a = solve('L26', ['hasFire']);
        const b = solve('L26', ['hasFire'], { fork: false });
        expect(b.refusal).toBeNull();
        expect(b.pass.certified).toBe(false);
        expect(keys(b.out)).toEqual(keys(a.out));
        expect(b.run.damage.hits).toBe(0);
    }), 240000);
    it('ON: Fire from L25 plans a pass too — its walk wakes `drill@128,96` (89 → 70 t, 0 hits; a mover)', () => {
        const off = OFF(() => solve('L25', ['hasFire']));
        const on = ON(() => solve('L25', ['hasFire']));
        expect(off.out.perTick.length).toBe(89);
        expect(off.pass).toBeNull();
        expect(on.pass).toMatchObject({ drills: ['drill@128,96'], stance: { x: 152, y: 56 }, ticks: 59, certified: true });
        expect(on.out.perTick.length).toBe(70);
        expect(on.run.damage.hits).toBe(0);
        expect(pulled(on.run)).toBe(true);
    }, 120000);
    it.each([
        ['L25', ['hasSword']], ['L25', ['hasSpear']], ['L26', ['hasSword']], ['L26', ['hasSpear']],
        ['L26', ['hasFire', 'hasSpear']],
    ])('ON: from %s with %j the kill stays first — the plan is OFF\'s, tick for tick, and no pass', (arrival, items) => {
        const off = OFF(() => solve(arrival, items));
        const on = ON(() => solve(arrival, items));
        expect(off.refusal).toBeNull();
        expect(on.refusal).toBeNull();
        expect(on.pass).toBeNull();
        expect(on.kills.length).toBeGreaterThan(0);
        expect(keys(on.out)).toEqual(keys(off.out));
    }, 120000);
    it('OFF (byte-identical): Fire from L26 keeps DRILLKILL\'s named refusal', () => OFF(() => {
        const { refusal } = solve('L26', ['hasFire']);
        expect(refusal.obstacle).toMatchObject({ kind: 'solid', id: 'rope@160,64', drill: 'drill@80,96' });
        expect(refusal.message).toMatch(/drill@80,96 hopped onto the player at run tick 31 .*FIRE CANNOT/);
    }), 120000);
});

describe('fidelity TIMEDPASS — D1: the game witnesses (p4g), replayed against the model at 0 px', () => {
    const load = (name) => JSON.parse(readFileSync(join(TIMEDPASS_WITNESS_DIR, `${name}.json`), 'utf8'));
    it('every witness is recorded, on the default build, and plays hit-free through the cut', () => {
        for (const w of TIMEDPASS_WITNESSES) {
            const rec = load(w.name);
            expect(rec.page).toBe('seedling_bot_ap_p4g');
            const cutEnd = { 'timedpass-l28-fire-l26': 132, 'timedpass-l28-fire-l25': 70 }[w.name];
            expect(rec.samples.filter((g) => g.t <= cutEnd).every((g) => g.hits === 0)).toBe(true);
        }
    });
    it.each(TIMEDPASS_WITNESSES.map((w) => [w.name]))('%s: the model (key ON) reproduces the game on every sampled tick',
        async (name) => {
            const rec = load(name);
            const m = await drillKillModelSamples(rec.tape, TIMEDPASS_SWITCHES);
            expect(m.error).toBeNull();
            expect(compareDrillKillWitness(rec.samples, m.samples, rec.tape.boot.level)).toEqual([]);
            expect(m.pulls.map((p) => p.id)).toEqual(['rope@160,64']);
        }, 120000);
    it.each([['timedpass-l28-fire-l26', 126, 133], ['timedpass-l28-fire-l25', 64, 71]])(
        '%s: OFF the model misses the frozen span — the parked drill does not hop at t%i, and the contact lands at t%i',
        async (name, hopAt, offHitAt) => {
            const rec = load(name);
            const game = rec.samples.find((g) => g.t === hopAt);
            expect(game.drills.some((d) => d.x === 152 && d.y === 56)).toBe(true);
            const m = await drillKillModelSamples(rec.tape, { drillTimedPass: false });
            const bad = compareDrillKillWitness(rec.samples, m.samples, rec.tape.boot.level);
            expect(bad.length).toBeGreaterThan(0);
            expect(bad[0]).toMatch(new RegExp(`^t ${hopAt} drill@128,96: game \\(152, 56\\) model \\(152, 72\\)`));
            const firstHit = rec.samples.find((g) => g.hits > 0);
            expect(firstHit.t).toBe(offHitAt + 1);
        }, 120000);
    it.each(TIMEDPASS_WITNESSES.map((w) => [w.name]))('%s: the solver still plans the recorded tape', async (name) => {
        const rec = load(name);
        const { tape } = await timedPassTape(TIMEDPASS_WITNESSES.find((w) => w.name === name));
        expect(tape.inputs).toEqual(rec.tape.inputs);
    }, 180000);
});
