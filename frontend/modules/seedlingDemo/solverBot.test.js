/**
 * solverBot.test — the live solver policy's own strata. R8 slice 2.
 *
 * Three strata, per the kickoff's G1 line for this slice:
 *
 *   1. THE FULL-BAG PATH — `run.liveGeometryOpts()` and `plannerObstacleAt`'s
 *      `liveBag` entry shape (⚖ the ruled resolution of §8.3.1: the solver
 *      gets all fourteen families; the legacy 8-key forwarding is preserved
 *      and separately asserted by `r8Acceptance`).
 *   2. THE REFUSAL SHAPES — no corridor, no strategy, absent placement,
 *      danger: every dead end is a `SolverRefusal` naming the obstacle in
 *      census vocabulary, never a silent stall.
 *   3. THE TRACE PRODUCER — the first real producer of the slice-0 schema:
 *      produced traces validate, agree with their own tape's `heldKeysAt`
 *      per row, and carry `rejected` (empty allowed, absent refused).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 drop `collect` from STRATEGY_EXECUTORS
 *        -> 'solves segment 10' reds ("selected but not registered")
 *   m2 hand `plannerObstacleAt` an UNBRANDED liveBag
 *        -> 'refuses an unbranded liveBag by name' reds
 *   m3 drop the frontier's tile filter in `identifyAndSelect`
 *        -> 'L4: names the button' reds (a `tile:Stone` outranks the button)
 *   m4 stop filling row `keys` from `perTick`
 *        -> 'trace agrees with the tape' reds (heldKeysAt disagreement)
 *   m5 drop the reachability probe from `deriveStance`
 *        -> 'solves segment 10' reds (walkable-but-unreachable ring cell —
 *           the first smoke run's own defect, kept as a regression)
 *
 * The danger-refusal arm fires IN ANGER on L6 (the census-on corridor
 * crosses two sandtrap volumes), which is also the regression for the
 * slice's own two-part defect: a combat-blind run solved L6 as if empty
 * and the recording refuted it (kickoff §10). Both halves are pinned:
 * the blind run is REFUSED at the door, and the census-on corridor is
 * REFUSED with the sandtrap named.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseTape } from './tapeFormat.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { buildTape } from './botDriverV1.js';
import { plannerObstacleAt } from './botDriverV2.js';
import {
    LIVE_GEOMETRY_KEYS, ROLES, isNormalizedLiveOpts, normalizeLiveOpts,
} from './levelWorld.js';
import {
    OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, SolverRefusal, solveSegment,
} from './solverBot.js';
import {
    deathJumpFindings, parseDecisionTrace, traceTapeAgreementFindings,
} from './decisionTrace.js';
// ⛓ R8 slice 3: the staging counts are the modules' own derivations, never
// numbers typed in a test.
import { deathTicks } from './chasers.js';
import { MOBILE_DEATH_FADE } from './enemyDamage.js';

const DEATH_ANIM_TICKS = deathTicks('bob');

const HERE = dirname(fileURLToPath(import.meta.url));
const TAPES = join(HERE, 'fixtures', 'tapes');
const levelSource = atlasLevelSource();

/**
 * A live run booted from a committed segment's own v8 boot block —
 * ⛔ with the REPLAY's own census (`roles: ROLES`, what `tapeRunner` gives
 * an honest tape). The builder's default is a combat-blind world and
 * `solveSegment` refuses one by name; see the guard's comment for the
 * defect this slice paid to learn it.
 */
function runFromCommitted(name, roles = ROLES) {
    const t = parseTape(JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8')));
    const run = createLevelRun({
        levelSource, boot: t.boot, noclip: false, noHazards: t.noHazards,
        noDamage: false, grants: t.grants, persistence: t.persistence, despawn: [],
        equips: t.equips, pins: t.pins ?? [], save: t.save ?? null,
        rng: t.rng ?? null, seam: t.seam ?? null, roles,
    });
    return { run, committed: t };
}

describe('the full-bag path (⚖ §8.3.1 ruled resolution)', () => {
    it('run.liveGeometryOpts() is BRANDED and covers all fourteen families', () => {
        const { run } = runFromCommitted('r7-act2-2');
        const bag = run.liveGeometryOpts();
        expect(isNormalizedLiveOpts(bag)).toBe(true);
        for (const k of LIVE_GEOMETRY_KEYS) expect(k in bag, `missing ${k}`).toBe(true);
    });

    it('refuses liveGeometryOpts on a noclip run BY NAME', () => {
        const run = createLevelRun({
            levelSource, boot: { level: 0, x: 80, y: 128 }, noclip: true,
        });
        expect(() => run.liveGeometryOpts()).toThrow(/noclip/);
    });

    /**
     * ⛓ DERIVED, NOT DECLARED (trap 97): the same fourteen-sentinel drive
     * the legacy partition test uses, through the `liveBag` entry — and ALL
     * FOURTEEN arrive. The legacy shape's 8-of-14 partition is asserted by
     * `r8Acceptance.test.js` unchanged; the two tests together are the two
     * entry shapes' claims, each measured on the running code.
     */
    it('liveBag forwards ALL FOURTEEN families — derived with sentinels', () => {
        const seen = [];
        const stubLevel = {
            plannerBlockerAt: (box, probeRect, o) => { seen.push(o); return null; },
            teleporterHit: () => [],
            tiles: [],
        };
        const sentinels = normalizeLiveOpts(Object.fromEntries(
            LIVE_GEOMETRY_KEYS.map((k) => [k, `SENTINEL:${k}`])));
        try {
            plannerObstacleAt(stubLevel, 100, 100, null,
                { liveBag: sentinels, noclip: false });
        } catch { /* the stub cannot answer the terrain arms */ }
        expect(seen.length).toBeGreaterThan(0);
        const arrived = seen[0];
        const forwarded = LIVE_GEOMETRY_KEYS
            .filter((k) => arrived[k] === `SENTINEL:${k}`).sort();
        expect(forwarded).toEqual([...LIVE_GEOMETRY_KEYS].sort());
        // The policy keys still ride beside the bag.
        expect('noclip' in arrived).toBe(true);
    });

    it('refuses an unbranded liveBag by name', () => {
        const stubLevel = { plannerBlockerAt: () => null, teleporterHit: () => [], tiles: [] };
        const bare = Object.fromEntries(LIVE_GEOMETRY_KEYS.map((k) => [k, null]));
        expect(() => plannerObstacleAt(stubLevel, 100, 100, null,
            { liveBag: bare, noclip: false }))
            .toThrow(/brand/);
    });
});

describe('the battery rooms, in-model (the differential is the game-side gate)', () => {
    it('solves segment 2 (L2) and the transition is the tape\'s end', () => {
        const { run, committed } = runFromCommitted('r7-act2-2');
        const out = solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { x: 48, y: 96 } }],
            name: 'r8-solve-2', boot: committed.boot,
        });
        expect(out.transitions).toEqual([{ t: out.perTick.length, from_level: 2, to_level: 3 }]);
        // ⚠ INFORMATION, NOT A GATE: the solver happens to match the
        // hand-authored tick count here. Asserted so a drift is REPORTED —
        // a controller or planner change that moves it should be seen, and
        // the assertion names what moved.
        expect(out.perTick.length).toBe(committed.tick_count);
    });

    it('solves segment 10 (L10, the SWORD collect) — strategy selection is real', () => {
        const { run, committed } = runFromCommitted('r7-act2-10');
        const out = solveSegment({
            run,
            goals: [
                { kind: 'collect-placement', placement: { x: 48, y: 48 } },
                { kind: 'reach-exit', exit: { x: 48, y: 16 } },
            ],
            name: 'r8-solve-10', boot: committed.boot,
        });
        // The pickup really was collected, and the collect row REJECTED the
        // chest strategy with a reason — selection, not dispatch.
        const collectRow = out.trace.rows.find((r) => r.strategy.verb === 'collect');
        expect(collectRow).toBeTruthy();
        expect(collectRow.rejected.length).toBeGreaterThan(0);
        expect(collectRow.rejected[0].option).toBe('chest');
        expect(run.collected.length).toBe(1);
        expect(run.inventory.hasSword).toBe(true);
        expect(out.transitions[out.transitions.length - 1].to_level).toBe(11);
    });

    it('solves segment 11 (L11, the chest) — the other selection arm', () => {
        const { run, committed } = runFromCommitted('r7-act2-11');
        const out = solveSegment({
            run,
            goals: [
                { kind: 'collect-placement', placement: { x: 32, y: 48 } },
                { kind: 'reach-exit', exit: { x: 32, y: 80 } },
            ],
            name: 'r8-solve-11', boot: committed.boot,
        });
        const chestRow = out.trace.rows.find((r) => r.strategy.verb === 'chest');
        expect(chestRow).toBeTruthy();
        expect(chestRow.rejected[0].option).toBe('collect');
        // ⚠ NOT `run.openChests` — that getter is PER LEVEL and the run ends
        // in L10. The verb's own record carries the opened chest's identity
        // and the collection tick, which is the claim.
        const rec = out.records.find((r) => r.strategy === 'chest');
        expect(rec.chest.id).toMatch(/chest@32,48/);
        expect(rec.collectedAt).toBeGreaterThan(0);
        expect(out.transitions[out.transitions.length - 1].to_level).toBe(10);
    });
});

describe('the trace producer — the first real producer of the slice-0 schema', () => {
    it('the produced trace validates, agrees with its own tape per row, and is sparse', () => {
        const { run, committed } = runFromCommitted('r7-act2-10');
        const out = solveSegment({
            run,
            goals: [
                { kind: 'collect-placement', placement: { x: 48, y: 48 } },
                { kind: 'reach-exit', exit: { x: 48, y: 16 } },
            ],
            name: 'r8-solve-10', boot: committed.boot,
        });
        // The envelope re-validates from JSON (the builder validated it once;
        // a round trip is what the sidecar file will actually do).
        const trace = parseDecisionTrace(JSON.stringify(out.trace));
        // ⛓ THE ROW THAT MAKES IT A MEASUREMENT: every row's keys are the
        // TAPE's keys on that tick, through `heldKeysAt` itself.
        // A v2 tape: v1 refuses a staged boot (the v1-era build read neither
        // boot.x nor boot.y), and `heldKeysAt` — the half this test consumes
        // — is version-independent.
        const tape = parseTape(buildTape(out.perTick, committed.boot, 'r8-solve-10',
            { noclip: false, noDamage: false, noHazards: [], grants: [] }));
        const agreement = traceTapeAgreementFindings(trace, tape);
        for (const row of agreement) expect(row.ok, `${row.name}: ${row.detail}`).toBe(true);
        // Trap 142's query runs and reports nothing.
        for (const row of deathJumpFindings(trace)) {
            expect(row.ok, `${row.name}: ${row.detail}`).toBe(true);
        }
        // SPARSE: decisions, not ticks.
        expect(trace.rows.length).toBeLessThan(out.perTick.length / 4);
        // `rejected` is REQUIRED on every row (empty allowed) — assumption 4,
        // confirmed by the producer rather than overturned.
        for (const row of trace.rows) expect(Array.isArray(row.rejected)).toBe(true);
    });
});

describe('the refusal shapes — never a silent stall', () => {
    /**
     * ⛓⛓⛓ R8 SLICE 3 DISCHARGED THIS WORK ORDER, and the test is re-aimed
     * rather than deleted. Slice 2 asserted that L4 refuses naming
     * `proximity-hazard:button` with `hold` unregistered; `hold` is
     * registered now, so what this room proves is the NEXT link: the policy
     * clears the button and the frontier ADVANCES to the block. The refusal
     * SHAPE — never a silent stall — is what both versions are really about,
     * and it still holds one obstacle further in.
     */
    it('L4: the button is CLEARED by `hold`, and the refusal advances to the block', () => {
        const { run, committed } = runFromCommitted('r7-act2-4');
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }],
                name: 'probe-l4', boot: committed.boot,
            });
        } catch (e) { refusal = e; }
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.obstacle).toMatchObject({ kind: 'solid', tag: 'pushableblock' });
        expect(refusal.considered).toEqual([{
            option: 'shove',
            why: expect.stringMatching(/NOT REGISTERED/),
        }]);
        expect(refusal.message).toMatch(/pushableblock@32,64/);
        // …and the trace carries the hold as a DECISION, with the option it
        // rejected — a strategy applied silently would leave the reader with
        // a walk that skipped a room's whole first half.
        expect(refusal.rows.some((r) => r.strategy?.verb === 'hold')).toBe(true);
    });

    it('L8: names the PUSHABLE BLOCK (the block is the door) and selects `shove`, unregistered', () => {
        const { run, committed } = runFromCommitted('r7-act2-8');
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
                name: 'probe-l8', boot: committed.boot,
            });
        } catch (e) { refusal = e; }
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.obstacle).toMatchObject({ kind: 'solid', tag: 'pushableblock' });
        expect(refusal.considered[0].option).toBe('shove');
        expect(refusal.message).toMatch(/pushableblock@112,48/);
    });

    it('a collect-placement with nothing standing there refuses as a MACRO-layer error', () => {
        const { run, committed } = runFromCommitted('r7-act2-2');
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'collect-placement', placement: { x: 999, y: 999 } }],
                name: 'probe-absent', boot: committed.boot,
            });
        } catch (e) { refusal = e; }
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.obstacle.kind).toBe('absent-placement');
        // The rows so far ride on the error — a refused segment is reviewable.
        expect(Array.isArray(refusal.rows)).toBe(true);
    });

    it('an unknown goal kind is refused at the door (the solver\'s vocabulary is closed)', () => {
        const { run, committed } = runFromCommitted('r7-act2-2');
        expect(() => solveSegment({
            run, goals: [{ kind: 'kill-everything' }],
            name: 'probe-goal', boot: committed.boot,
        })).toThrow(/unknown goal kind/);
    });

    it('L6: the census-on corridor is refused WITH THE THREAT NAMED (danger, not a stall)', () => {
        // The blind solve walked this corridor and the game refuted it with
        // seven sandtrap contacts and two deaths (kickoff §10, the withdrawn
        // r8-solve-6). With the census on, the segment-sampled danger probe
        // names a live threat BEFORE a tick is spent — the NEAREST one on
        // the corridor is `bob@96,16` inside its own leash (the sandtraps
        // are the next samples along; the first named threat is the claim).
        const { run, committed } = runFromCommitted('r7-act2-6');
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }],
                name: 'probe-l6', boot: committed.boot,
            });
        } catch (e) { refusal = e; }
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.obstacle.kind).toBe('danger');
        expect(refusal.message).toMatch(/chaser:bob@96,16/);
        expect(refusal.considered.map((c) => c.option)).toContain('dodge');
    });

    it('a COMBAT-BLIND run is refused at the door — the slice\'s own defect, institutionalised', () => {
        // The builder's DEFAULT roles (no `roles` key at all): a world with
        // no combat census. The first battery was solved against exactly
        // this — identical in every room without enemies, blind in the one
        // with them.
        const t = parseTape(JSON.parse(
            readFileSync(join(TAPES, 'r7-act2-2.json'), 'utf8')));
        const run = createLevelRun({
            levelSource, boot: t.boot, noclip: false, noHazards: t.noHazards,
            noDamage: false, grants: t.grants, persistence: t.persistence, despawn: [],
            equips: t.equips, pins: t.pins ?? [], save: t.save ?? null,
            rng: t.rng ?? null, seam: t.seam ?? null,
        });
        expect(() => solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { x: 48, y: 96 } }],
            name: 'probe-blind', boot: t.boot,
        })).toThrow(/NO COMBAT CENSUS/);
    });
});

describe('the strategy catalog seam (slice 3 extends, never restructures)', () => {
    it('every registered executor answers a selector row; unregistered rows are the work orders', () => {
        const selected = new Set(Object.values(OBSTACLE_STRATEGIES));
        for (const verb of Object.keys(STRATEGY_EXECUTORS)) {
            expect(selected.has(verb) || verb === 'collect',
                `executor '${verb}' is reachable by no selector row`).toBe(true);
        }
        // The pending work orders, as data: selected and not yet registered.
        // ⛓ R8 slice 3 took `hold` off this list — which is the whole of the
        // "adds rows, never restructures" contract, asserted rather than
        // asserted about. The three that remain are the next slice's, and
        // they are COMPUTED (each is a live frontier's own answer in a named
        // room) rather than guessed.
        const pending = [...selected].filter((v) => !STRATEGY_EXECUTORS[v]).sort();
        expect(pending).toEqual(['kill', 'shove', 'touch']);
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 3 — THE FIRST STRATEGY EXECUTOR WHOSE PARAMETERS ARE DERIVED.
 *
 * `collect` and `chest` bind a PLACEMENT the goal already named. `hold` is
 * the first row where the leg spec's own arguments — which presser, from
 * which stance, for how many ticks — all have to come out of live state, and
 * where the answer to "how long" is a CONDITION rather than a number.
 *
 * L4 is the room slice 2's frontier computed as this executor's work order
 * ("proximity-hazard:button → 'hold', not registered this slice").
 */
describe('R8 slice 3: `hold` registered — the derived-parameter executor', () => {
    it('⛓ the executor is registered, and the frontier still selects it', () => {
        expect(typeof STRATEGY_EXECUTORS.hold).toBe('function');
        expect(OBSTACLE_STRATEGIES['proximity-hazard:button']).toBe('hold');
    });

    /**
     * ⛔⛔⛔ THE WORK ORDER, DISCHARGED — AND THE NEXT ONE, COMPUTED.
     *
     * Slice 2's L4 refusal named the BUTTON because the button's own volume
     * bounds the reachable component (trap 147: A* will not route onto a
     * proximity-hazard cell, and a hold is what adds its presser to the
     * exemptions). With `hold` registered the policy stands on it, holds, and
     * re-plans — and the frontier MOVES: the obstacle is now
     * `pushableblock@32,64`, which is L4's real door. A registration that
     * changed nothing would leave the same obstacle in the message.
     */
    it('⛔ the frontier ADVANCES from the button to the block', () => {
        const { run, committed } = runFromCommitted('r7-act2-4');
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }],
                name: 'r8-solve-4', boot: committed.boot,
            });
        } catch (e) {
            if (!(e instanceof SolverRefusal)) throw e;
            refusal = e;
        }
        expect(refusal).toBeTruthy();
        expect(refusal.obstacle.id).toBe('pushableblock@32,64');
        expect(refusal.considered.map((c) => c.option)).toContain('shove');
    });

    /**
     * ⛓⛓⛓ AND THE HOLD'S LENGTH IS AN OBSERVATION, NOT A MARGIN.
     *
     * The hand-authored leg says `ticks: 200` and the 200 is a number
     * somebody measured. The policy holds until the room's own ceiling has
     * REMOVED the body — an observable that did not exist before this slice's
     * Arrow × Enemy family — and the tick it stops on is the staging
     * arithmetic: the kill, then the "die" animation, then the fade.
     */
    it('⛓⛓ the hold stops on its OBSERVED condition — the body being gone', () => {
        const { run, committed } = runFromCommitted('r7-act2-4');
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }],
                name: 'r8-solve-4', boot: committed.boot,
            });
        } catch (e) {
            if (!(e instanceof SolverRefusal)) throw e;
        }
        // The room's ceiling did the killing, and the policy pressed nothing.
        expect(run.chaserKills).toHaveLength(1);
        expect(run.chaserKills[0].by).toBe('arrow');
        expect(run.chasers).toEqual([]);
        // ⛔ ZERO HITS, ZERO DEATHS — the standing policy, on a walk that
        // stands still for a hundred ticks under a ceiling that is firing.
        expect(run.playerHits).toEqual([]);
        expect(run.playerDeaths).toEqual([]);
        // …and the hold ended exactly when the body left the world rather
        // than when a number ran out: the kill plus the death staging.
        expect(run.ticksCompleted).toBe(run.chaserKills[0].t + DEATH_ANIM_TICKS - 1
            + MOBILE_DEATH_FADE.ticks);
    });
});
