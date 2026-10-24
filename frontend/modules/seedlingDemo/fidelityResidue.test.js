/**
 * seedling-fidelity-residue (wave 28) — TIMEDPASS's PASS TO THE EXIT (D-A, `CONTACT_FIDELITY.drillTimedPassExit`, OFF).
 *
 * D-A. With `drillTimedPass` ON, Fire alone cuts L28's rope hit-free, and the rope's `FallRock` ceremony releases the
 * drill parked under the stance ONTO it (TIMEDPASS D1): the `reach-exit` that follows refused at its first gate ("the
 * danger map forbids (151.87,55.81) — enemy:drill@128,96"), and from that state every continuation is hit (measured:
 * 81 of 81 two-tick key sequences, each held 10 ticks more). ON:
 *   (1) the exit is a TIMED PASS to the crossing (`execDrillTimedPassExit`): `searchDrillTimedPass` with the goal the
 *       stepper's transition through that door, certified on a fork, then played;
 *   (2) the pass to the cut's stance, when the segment's next goal is a `reach-exit`, is certified only with that
 *       crossing's pass behind the cut (`accept`): the first stand that holds is passed over when the cut leaves no way
 *       out, and the search runs on (L25: 2 passed over, 59 → 60 t to the stance).
 * Measured: from the L25 arrival both doors SOLVE hit-free (L26 door 182 t, L25 door 134 t); from the L26 arrival the
 * only stand that holds in the search's window ((152,56), t121) leaves no way out, so the clear-tag refuses by name.
 * (Its forced-hit reading, measured and not built: the hit at the stance knocks the player 9.3 px west, into
 * `drill@80,96`'s box when the 20-tick i-frame ends — steering is blocked for all of it — so the exit costs two hits.)
 * OFF: byte-identical — the gate's refusal.
 *
 * Mutants (predicted first; copy + edit + run + restore), the results in the report:
 *   a1  `execDrillTimedPassExit` not called                     → the two ON exit rows red (the gate refusal returns)
 *                                                                  (measured: those two + both witnesses' re-plans, 4 red)
 *   a2  the cut's certificate ignores the way out (`accept` null) → the L25 rows red: the first stand (59 t) is the one
 *                                                                  the release dooms, so the exit refuses (measured: 6
 *                                                                  red — those, the re-plans, and both L26 wordings)
 *   a3  the search's crossing accepts any teleporter              → predicted the L25-door row red; MEASURED: SURVIVES —
 *                                                                  no L28 pass reaches another door first, and the fork's
 *                                                                  certificate checks the level anyway (named)
 *
 * D-B — WHIRLPOOLS IN THE WALK (`CONTACT_FIDELITY.whirlpoolDrown`, OFF). `Whirlpool.as:61-83`: a LIVE whirlpool (timer in
 * [dies, live + dies) after its decrement) writes the player's position whenever the player's box overlaps its 32x32
 * box with the player's point inside the radius 16 — r = int(d), then int(r * 0.999), a 20° turn — and once r <= 1 it
 * calls `Player.drown()` on EVERY update (`Player.as:1431`: the timer −0.5 mod 10, the spiral `v`, `dying`, and
 * `die()` on the twentieth). OFF the model threw a plain `Error` at the first call, and nothing priced the pull. ON:
 *   (1) the call is transcribed (`levelRun.stepTentacleRuntimeNow` → `state.drown.dying`, `drownStep`; the player's
 *       step stands still while `dying`, `playerPhysicsV2.step`) and the twentieth is a `playerDeaths` row (source
 *       `whirlpool`) and the room's reboot;
 *   (2) a walk that drowned is refused by name (`obstacle: {kind: 'whirlpool', id}`), never re-planned from the
 *       respawn; the Tentacled Beast verb's plays count the drown as a death;
 *   (3) `dangerMap.whirlpoolDanger` prices the pull (WAIT: any update to the question's tick; TRANSIT: the ETA's own),
 *       `dangerVolumes` a row per whirlpool not yet dying, and the DODGE rung's WHIRLPOOL arm answers a corridor whose
 *       every reason is a whirlpool with one stall at the walk's start that outlasts them.
 * Measured (the HITLESS seed sweep, 1..40, door + s2 stagings): with `tentacleHitlessFirst` OFF every seed whose walk
 * threw the drown now SOLVES with no death; at the defaults (HITLESS ON, the settle) nothing moves.
 *
 * Mutants (D-B): b1 the drown throws again (the transcription dropped) → predicted the ON witness row and the seed-15
 * solve red; MEASURED: the witness row alone (the priced walk never meets the pull); b2 `whirlpoolDanger` returns
 * nothing → seed 15 REFUSES "DROWNED in whirlpool#78" (the walk's refusal by name, no re-plan; as predicted, with the
 * pricing row: 2 red); b3 the DODGE arm's stall one tick short → seed 15 refused (as predicted, 1 red).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment, SolverRefusal } from './solverBot.js';
import { compareDrillKillWitness, drillKillModelSamples } from './fidelityDrillKill.js';
import { TIMEDPASS_EXIT_WITNESSES, TIMEDPASS_WITNESS_DIR, timedPassTape } from './fidelityTimedPass.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { dangerAt, dangerVolumes } from './dangerMap.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const SRC = atlasLevelSource();
const L28_CUT = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });
const ARRIVALS = Object.freeze({ L25: { level: 28, x: 96, y: 16 }, L26: { level: 28, x: 16, y: 96 } });
const DOORS = Object.freeze({ L26: { x: 0, y: 96 }, L25: { x: 96, y: 0 } });

function solve(arrival, goals) {
    const boot = ARRIVALS[arrival];
    const staging = arrivalStaging(boot, { items: ['hasFire'] });
    const run = createRunForStaging(staging, SRC);
    try {
        const out = solveSegment({ run, goals, name: 'residue', boot, forkRun: () => createRunForStaging(staging, SRC) });
        const rec = (k) => (out.records ?? []).find((r) => r.goal === k) ?? null;
        return { run, out, refusal: null, cut: rec('clear-tag'), exit: rec('reach-exit') };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { run, out: null, refusal: e, cut: null, exit: null };
    }
}
const cutThenExit = (door) => [{ ...L28_CUT }, { kind: 'reach-exit', exit: { ...DOORS[door] } }];
const ON = (fn) => withContactFidelity({ drillTimedPass: true, drillTimedPassExit: true }, fn);
const OFF = (fn) => withContactFidelity({ drillTimedPass: true, drillTimedPassExit: false }, fn);
const keys = (out) => out.perTick.map((h) => [...h].sort().join('+'));

describe('fidelity RESIDUE D-A — the switch', () => {
    // ⛓ planning-11's flip (⚖ user "Harvest + flip both ON", 2026-10-23).
    it('is ON by default (flipped), behind `drillTimedPass` (ON)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.drillTimedPassExit).toBe(true);
        expect(CONTACT_FIDELITY.drillTimedPassExit).toBe(true);
        expect(CONTACT_FIDELITY_DEFAULTS.drillTimedPass).toBe(true);
    });
});

describe('fidelity RESIDUE D-A — Fire alone: the cut, then the way out (L28)', () => {
    it.each([['L26', 182, 111], ['L25', 134, 63]])('ON: from the L25 arrival to the %s door — SOLVED %i t, 0 hits, the '
        + 'exit a certified pass of %i t', (door, ticks, exitTicks) => ON(() => {
        const r = solve('L25', cutThenExit(door));
        expect(r.refusal).toBeNull();
        expect(r.out.perTick.length).toBe(ticks);
        expect(r.run.level).toBe(door === 'L26' ? 26 : 25);
        expect((r.run.ledger('playerHits') ?? []).length).toBe(0);
        expect(r.cut.drillPass).toMatchObject({ verb: 'drill-pass', drills: ['drill@128,96'], stance: { x: 152, y: 56 },
            ticks: 60, certified: true, exitAfter: { passedOver: 2 } });
        expect(r.exit.drillPass).toMatchObject({ verb: 'drill-pass-exit', to: door === 'L26' ? 26 : 25,
            ticks: exitTicks, certified: true });
    }), 180000);
    it.each([['L26'], ['L25']])('ON: from the L26 arrival to the %s door — REFUSED at the cut by name: the one stand that '
        + 'holds leaves no way out', (door) => ON(() => {
        const r = solve('L26', cutThenExit(door));
        expect(r.refusal).not.toBeNull();
        expect(r.refusal.obstacle).toMatchObject({ kind: 'drill', id: 'drill@80,96' });
        expect(r.refusal.message).toMatch(/\(152,56\): walks arrive from search tick 107, and none in 45 ticks stands 14 /);
        expect(r.refusal.message).toMatch(/with a way out \(1 passed over: after the cut, no pass to the crossing to /);
    }), 240000);
    it('OFF (byte-identical): the exit after the cut refuses at its first gate — the residue TIMEDPASS named', () => OFF(() => {
        const r = solve('L25', cutThenExit('L26'));
        expect(r.refusal.message).toMatch(/reach-exit \(0,96\)->L26: the danger map forbids \(152\.17\d*,56\.36\d*\) — enemy:drill@128,96/);
    }), 120000);
    it('ON: a cut with no exit after it plans what OFF plans (no way out is asked) — L25, 70 t', () => {
        const off = OFF(() => solve('L25', [{ ...L28_CUT }]));
        const on = ON(() => solve('L25', [{ ...L28_CUT }]));
        expect(on.out.perTick.length).toBe(70);
        expect(keys(on.out)).toEqual(keys(off.out));
        expect(on.cut.drillPass.exitAfter).toBeUndefined();
    }, 120000);
    it('ON: a Sword run is untouched — the exit walk after the kill and the cut is OFF\'s, tick for tick', () => {
        const run = (items) => {
            const boot = ARRIVALS.L26;
            const staging = arrivalStaging(boot, { items });
            return solveSegment({ run: createRunForStaging(staging, SRC), goals: cutThenExit('L25'), name: 'residue',
                boot, forkRun: () => createRunForStaging(staging, SRC) });
        };
        const off = OFF(() => run(['hasSword']));
        const on = ON(() => run(['hasSword']));
        expect(keys(on)).toEqual(keys(off));
        expect((on.records ?? []).find((r) => r.goal === 'reach-exit').drillPass).toBeUndefined();
    }, 180000);
});

describe('fidelity RESIDUE D-A — the game witnesses (p4g), replayed against the model at 0 px', () => {
    const path = (name) => join(TIMEDPASS_WITNESS_DIR, `${name}.json`);
    const load = (name) => JSON.parse(readFileSync(path(name), 'utf8'));
    it.each(TIMEDPASS_EXIT_WITNESSES.map((w) => [w.name]))('%s: recorded on the default build, hit-free, and across the '
        + 'door', (name) => {
        const rec = load(name);
        const w = TIMEDPASS_EXIT_WITNESSES.find((x) => x.name === name);
        expect(rec.page).toBe('seedling_bot_ap_p4g');
        expect(rec.samples.every((g) => g.hits === 0)).toBe(true);
        expect(rec.end.level).toBe(w.goals[1].exit.x === 0 ? 26 : 25);
    });
    it.each(TIMEDPASS_EXIT_WITNESSES.map((w) => [w.name]))('%s: the model (both keys ON) reproduces the game on every '
        + 'sampled tick', async (name) => {
        const rec = load(name);
        const w = TIMEDPASS_EXIT_WITNESSES.find((x) => x.name === name);
        const m = await drillKillModelSamples(rec.tape, w.switches);
        expect(m.error).toBeNull();
        expect(compareDrillKillWitness(rec.samples, m.samples, rec.tape.boot.level)).toEqual([]);
        expect(m.pulls.map((p) => p.id)).toEqual(['rope@160,64']);
    }, 120000);
    it.each(TIMEDPASS_EXIT_WITNESSES.map((w) => [w.name]))('%s: the solver still plans the recorded tape', async (name) => {
        const rec = load(name);
        const { tape } = await timedPassTape(TIMEDPASS_EXIT_WITNESSES.find((w) => w.name === name));
        expect(tape.inputs).toEqual(rec.tape.inputs);
    }, 180000);
    it('every exit witness file exists', () => {
        for (const w of TIMEDPASS_EXIT_WITNESSES) expect(existsSync(path(w.name))).toBe(true);
    });
});

// ── D-B ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const HERE = new URL('.', import.meta.url).pathname;
const DOOR_TAPE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tentaclebeast-witness', 'tb-hitless-door.json'), 'utf8')).tape;
const L57_FIGHT = Object.freeze({ kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 },
    obstacle: 'tentaclebeast@80,48' });
const L57_MOUTH = Object.freeze({ kind: 'reach-exit', exit: { x: 96, y: 64 } });
const doorStaging = (seed) => stagingFromTape(parseTape(JSON.stringify({ ...DOOR_TAPE, rng: { ...DOOR_TAPE.rng, seed },
    inputs: [], tick_count: 0 })));
/** The L57 solve at the door's staging, `seed`, with HITLESS (`tentacleHitlessFirst`) and this key as asked. */
function solve57(seed, { hitless, drown, goals = [L57_FIGHT, L57_MOUTH] }) {
    return withContactFidelity({ tentacleHitlessFirst: hitless, whirlpoolDrown: drown }, () => {
        const staging = doorStaging(seed);
        const run = createRunForStaging(staging, SRC);
        try {
            const out = solveSegment({ run, goals, name: `residue-s${seed}`, boot: staging.boot,
                forkRun: () => createRunForStaging(staging, SRC) });
            return { run, out, error: null };
        } catch (e) {
            return { run, out: null, error: e };
        }
    });
}

describe('fidelity RESIDUE D-B — the switch', () => {
    // ⛓ planning-11's flip (⚖ user "Harvest + flip both ON", 2026-10-23).
    it('is ON by default (flipped)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.whirlpoolDrown).toBe(true);
        expect(CONTACT_FIDELITY.whirlpoolDrown).toBe(true);
    });
});

describe('fidelity RESIDUE D-B — the pull, priced (door staging, seed 15, HITLESS OFF: the fight leaves three alive)', () => {
    const fight = () => solve57(15, { hitless: false, drown: true, goals: [L57_FIGHT] });
    it('the fight ends with whirlpool#78 at (107,116), timer 174 — growing for 84 updates more, then live for 60', () => {
        const { run, error } = fight();
        expect(error).toBeNull();
        expect(run.entities('tentacleBeastFight').whirlpools).toEqual([
            { id: 'whirlpool#78', x: 107, y: 116, timer: 174 }, { id: 'whirlpool#77', x: 165, y: 153, timer: 132 },
            { id: 'whirlpool#76', x: 50, y: 174, timer: 86 }]);
    }, 120000);
    it('WAIT prices the disc from the update it is live; TRANSIT the ETA\'s own; the box is a volume; OFF nothing', () => {
        const { run } = fight();
        const now = run.ticksCompleted;
        const at = (x, y, tick, mode) => withContactFidelity({ whirlpoolDrown: true }, () => dangerAt(run, now + tick,
            playerBoxAt(x, y), { mode }).sources.filter((s) => s.kind === 'whirlpool').map((s) => s.id));
        expect(at(107, 116, 0, 'wait')).toEqual([]);           // the next update reads 173: still growing
        expect(at(107, 116, 84, 'wait')).toEqual([]);          // …and update +84 reads 90
        expect(at(107, 116, 85, 'wait')).toEqual(['whirlpool#78']);
        expect(at(107, 116, 104, 'transit')).toEqual(['whirlpool#78']);
        expect(at(107, 116, 145, 'transit')).toEqual([]);      // +145 reads 29: dying, no pull
        expect(at(107, 132.5, 104, 'transit')).toEqual([]);    // 16.5 px off: the box overlaps, the point is out
        expect(at(107, 131.5, 104, 'transit')).toEqual(['whirlpool#78']);   // 15.5 px: inside the radius
        const vols = withContactFidelity({ whirlpoolDrown: true }, () => dangerVolumes(run, 0))
            .filter((v) => /^whirlpool#/.test(v.id)).map((v) => [v.id, v.rect.x, v.rect.y, v.rect.right, v.rect.bottom]);
        expect(vols).toEqual([['whirlpool#78', 91, 100, 123, 132], ['whirlpool#77', 149, 137, 181, 169],
            ['whirlpool#76', 34, 158, 66, 190]]);
        expect(withContactFidelity({ whirlpoolDrown: false }, () => dangerVolumes(run, 0))
            .filter((v) => /^whirlpool#/.test(v.id))).toEqual([]);
        expect(withContactFidelity({ whirlpoolDrown: false }, () => dangerAt(run, now + 104, playerBoxAt(107, 116),
            { mode: 'transit' }).sources.filter((s) => s.kind === 'whirlpool'))).toEqual([]);
    }, 120000);
});

describe('fidelity RESIDUE D-B — the solver (HITLESS OFF: the walk to the mouth meets a live whirlpool)', () => {
    it('OFF: seed 15 THROWS the drown as a plain Error (bosskills D3) — not a refusal', () => {
        const r = solve57(15, { hitless: false, drown: false });
        expect(r.error).not.toBeNull();
        expect(r.error).not.toBeInstanceOf(SolverRefusal);
        expect(r.error.message).toMatch(/whirlpool#78 pulls the player to its centre at tick 2188 .*not transcribed/);
    }, 120000);
    it('ON: seed 15 SOLVES — the walk stalls out whirlpool#78 (DODGE\'s whirlpool arm), no death, into L58', () => {
        const r = solve57(15, { hitless: false, drown: true });
        expect(r.error).toBeNull();
        expect([r.run.level, r.out.perTick.length, r.run.ledger('playerDeaths').length]).toEqual([58, 2416, 0]);
    }, 180000);
    it('at the defaults (HITLESS ON, its settle) seed 15 plans what OFF plans, tick for tick', () => {
        const off = solve57(15, { hitless: true, drown: false });
        const on = solve57(15, { hitless: true, drown: true });
        expect(off.error).toBeNull();
        expect(on.error).toBeNull();
        expect(keys(on.out)).toEqual(keys(off.out));
    }, 240000);
});

describe('fidelity RESIDUE D-B — the game witness (p4g): a walk into a live whirlpool, drowned, at 0 px', () => {
    // `whirlpool-drown-s15`: the door staging at seed 15, the HITLESS-OFF fight (variant 0), then a bang-bang walk at
    // whirlpool#78's centre until the game kills the player (`probe-seedling-bosskills.mjs --record --dir=whirlpool-witness`).
    const w = JSON.parse(readFileSync(join(HERE, 'fixtures', 'whirlpool-witness', 'whirlpool-drown-s15.json'), 'utf8'));
    const model = (drown) => {
        const out = [];
        let error = null;
        let deaths = [];
        withContactFidelity({ whirlpoolDrown: drown }, () => {
            let run = null;
            const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource: SRC,
                onTick: (t, s, h, rn) => { run = rn; } });
            try {
                for (let r = st.next(); !r.done; r = st.next()) {
                    const o = r.value.observation;
                    const v = run.tentacleBeastFight;
                    out[o.t] = { x: o.x, y: o.y, level: run.level, hits: run.damage.hits, beast: v ? v.beast.anim : null,
                        tentacles: (v?.tentacles ?? []).map((q) => [q.x, q.y, q.anim, q.index, q.alpha]).map((p) => p.join(','))
                            .sort().join('|'),
                        rngState: v ? v.rngState : null, dead: v ? v.beast.dead === true : false };
                }
            } catch (e) {
                error = e.message;
            }
            deaths = run.ledger('playerDeaths');
        });
        return { out, error, deaths };
    };
    it('is recorded on the default build; the game holds the player still for the drown and kills it at t2202', () => {
        expect(w.page).toBe('seedling_bot_ap_p4g');
        const at = (t) => w.samples.find((g) => g.t === t);
        expect([at(2184).x, at(2184).y]).toEqual([106.96743277070284, 115.89532353711422]);
        expect([at(2201).x, at(2201).y, at(2201).hits]).toEqual([106.96743277070284, 115.89532353711422, 1]);
        expect([at(2202).x, at(2202).y, at(2202).hits, at(2202).level]).toEqual([104, 72, 0, 57]);
    });
    it('ON: the model reproduces the game on every sampled tick, and the death is a `playerDeaths` row', () => {
        const m = model(true);
        expect(m.error).toBeNull();
        const bad = [];
        for (const g of w.samples) {
            const s = m.out[g.t];
            if (!s) { bad.push(`t ${g.t}: no model tick`); continue; }
            if (s.x !== g.x || s.y !== g.y) bad.push(`t ${g.t}: player game (${g.x}, ${g.y}) model (${s.x}, ${s.y})`);
            if (s.level !== g.level || s.hits !== g.hits) bad.push(`t ${g.t}: level/hits game ${g.level}/${g.hits}`);
            if (g.level !== 57) continue;
            if ((g.boss?.anim ?? null) !== s.beast) bad.push(`t ${g.t}: beast game ${g.boss?.anim} model ${s.beast}`);
            if (g.tentacleRows.map((p) => p.join(',')).sort().join('|') !== s.tentacles) bad.push(`t ${g.t}: tentacles`);
            if (s.rngState === null && s.dead) continue;
            if (g.rngState !== s.rngState) bad.push(`t ${g.t}: rng game ${g.rngState} model ${s.rngState}`);
        }
        expect(bad.slice(0, 6)).toEqual([]);
        expect(m.deaths).toEqual([{ t: 2202, level: 57, source: 'whirlpool', id: 'whirlpool#78', hits: 1,
            respawn: { x: 104, y: 72 } }]);
    }, 120000);
    it('OFF: the model refuses the first `drown()` call by name (t2183) — the residue HITLESS named', () => {
        const m = model(false);
        expect(m.error).toMatch(/^levelRun: whirlpool#78 pulls the player to its centre at tick 2183 .*not transcribed/);
        expect(m.deaths).toEqual([]);
    }, 120000);
});
