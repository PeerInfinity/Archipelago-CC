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
import { assertEscalationIsOrdered } from './r8Acceptance.js';
import {
    ESCALATION_LADDER,
    OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, STRATEGY_REFINEMENTS, SolverRefusal,
    FACING_KEYS, facingToward,
    deriveKillByChaser, interceptOrder,
    previewWalk, resolveKillStrategy, solveSegment, strikePolicyFor,
} from './solverBot.js';
// ⛓ R9 slice 12b — ⚖ ruling 30(c)'s equality is between these two exact
// functions, so the row calls both rather than a stand-in for either.
import { drive, runDwell } from './botDriverV2.js';
// ⛓ R9 slice 12b′: the dash-refusal row builds BOTH arms of the policy, so it
// needs the constructor and the swing period the refusal is measured in.
import { createStrikePolicy } from './strikePolicy.js';
import {
    DASH_DISPLACEMENT, ORDINARY_SWING_PERIOD, SLASH_DASH_FORCE, slashPressForecast,
} from './combatVerbs.js';
// ⛓ R9 slice 12c — the certification the `allowDash: true` arm is gated on.
import { certifyDash } from './strikePolicy.js';
import { killWindowTicks } from './chasers.js';
import { ENEMY_CLASSES } from './combat.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { SLASH_HIT_TICKS } from './presses.js';
// ⛓ R9 slice 1 (A3) — the kill lock's own tset, read from the module that owns it.
import { KILL_LOCK_TSET } from './combat.js';
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
function runFromCommitted(name, over = {}) {
    const { roles = ROLES, ...rest } = over;
    const t = parseTape(JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8')));
    const run = createLevelRun({
        levelSource, boot: t.boot, noclip: false, noHazards: t.noHazards,
        noDamage: false, grants: t.grants, persistence: t.persistence, despawn: [],
        equips: t.equips, pins: t.pins ?? [], save: t.save ?? null,
        rng: t.rng ?? null, seam: t.seam ?? null, roles, ...rest,
    });
    return { run, committed: t };
}

describe('the full-bag path (⚖ §8.3.1 ruled resolution)', () => {
    it('run.liveGeometryOpts() is BRANDED and covers all fourteen families', () => {
        const { run } = runFromCommitted('r8-solve-2');
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
        const { run, committed } = runFromCommitted('r8-solve-2');
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
        const { run, committed } = runFromCommitted('r8-solve-10');
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
        const { run, committed } = runFromCommitted('r8-solve-11');
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
        const { run, committed } = runFromCommitted('r8-solve-10');
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
     * ⛓⛓⛓ TWO SLICES HAVE NOW DISCHARGED THIS ROOM'S WORK ORDERS, and the
     * test is re-aimed rather than deleted each time. Slice 2 asserted that
     * L4 refuses naming `proximity-hazard:button` with `hold` unregistered;
     * slice 3 registered `hold` and the assertion moved one obstacle in, to
     * `pushableblock@32,64` with `shove` unregistered; R8 slice 3b registers
     * `shove` and **the room SOLVES**, so what is left to assert here is that
     * both strategies really ran and that neither was applied silently.
     *
     * ⛔ The refusal SHAPE this describe block is about has not gone
     * anywhere — it is asserted in the rooms that still refuse (L5, L6, L8
     * below) and by the danger and absent-placement rows. A room that starts
     * passing is not a stratum that stopped checking.
     */
    it('L4: `hold` then `shove` — the room SOLVES, and both decisions are traced', () => {
        const { run, committed } = runFromCommitted('r8-solve-4');
        const out = solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }],
            name: 'probe-l4', boot: committed.boot,
        });
        expect(run.level).toBe(5);
        expect(run.playerHits).toEqual([]);
        expect(run.playerDeaths).toEqual([]);
        const verbs = out.trace.rows.map((r) => r.strategy.verb);
        expect(verbs).toContain('hold');
        expect(verbs).toContain('shove');
        // ⛓ AND THE SHOVE'S OWN DERIVATION IS IN THE ROW, not in a log: the
        // `k` it chose and the post-condition it chose it for.
        const shove = out.trace.rows.find((r) => r.strategy.verb === 'shove');
        expect(shove.strategy).toMatchObject({
            k: 2, dir: 'E', to: { tx: 4, ty: 4 }, destroys: false,
            postCondition: 'clear-path',
        });
    });

    /**
     * ⛓⛓⛓ L8 IS THIS SLICE'S armB, AND THE REFUSAL IS THE DELIVERABLE.
     *
     * Slice 2 asserted the frontier names `pushableblock@112,48` with `shove`
     * unregistered. `shove` is registered now and ⚖ the ruled reading (b)
     * gives it a destination, so the room gets FURTHER — both shoves are
     * selected and the first is driven — and then stops on the body this rung
     * refuses by name: `sandtrap@96,80`, whose own arrow death §11.4 declines
     * to compute because its clear is the tape's DECLARED v9 `at` row and a
     * second writer of one persistence slot is two cost models.
     *
     * ⛔ THE POINT OF THE ROW IS THAT THE WALL HAS A RUNG NUMBER ON IT. A
     * stall and a refusal look identical from the outside; this one names
     * every rung of the ladder and what each said.
     */
    it('⛓ L8: both shoves DERIVED and the room CROSSES, once its clears are declared', () => {
        const { run, committed } = runFromCommitted('r8-solve-8');
        const out = solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
            name: 'probe-l8', boot: committed.boot,
        });
        expect(run.level).toBe(9);
        expect(run.playerHits).toEqual([]);
        expect(run.playerDeaths).toEqual([]);

        // The east pocket's door is shoved where ⚖ ruling 1(a) puts it —
        // k=2, the hand answer's cell.
        const shoves = out.trace.rows.filter((r) => r.strategy.verb === 'shove');
        expect(shoves.map((r) => r.obstacle.id)).toEqual(['pushableblock@112,48']);
        expect(shoves[0].strategy).toMatchObject({ k: 2, dir: 'W', to: { tx: 5, ty: 3 } });

        // ⛓ AND ITS DESTINATION NAMES THE HYPOTHESIS IT RESTS ON — guard (i)
        // of the ruled reading (b). Without hypothesising the OTHER pending
        // order discharged there is no k at all: the second block stands in
        // column 6, which is the room's only way south.
        expect(shoves[0].rejected.some((j) => /hypothesising/.test(j.option)
            && /pushableblock@96,112/.test(j.option))).toBe(true);

        /**
         * ⛓⛓⛓ AND BOTH KILL CLIMBS RAN — one per sandtrap, each its OWN
         * climb starting at the bottom of the ladder (§12.6's numbered
         * climbs). ⚠ THE SECOND BLOCK IS NEVER A FRONTIER OBSTACLE ON THIS
         * ARM, and the reason is the tape it was booted from: `r7-act2-8`
         * declares both clears at the HAND walk's own late ticks (380, 932),
         * so by the time the corridor south is asked for, the bodies are
         * already gone and the block is pushed along by the walk itself. The
         * DERIVED second shove — and its last-resort sink — belong to the
         * pass that has no declarations, which is the test below.
         */
        const kills = out.trace.rows.filter((r) => r.strategy.verb === 'kill');
        expect(kills.map((r) => r.obstacle.id))
            .toEqual(['sandtrap@96,80', 'sandtrap@96,128']);
        expect(kills.map((r) => r.strategy.climb)).toEqual([1, 2]);
    });

    /**
     * ⛓⛓⛓ R8 SLICE 4 — AND WITH ITS CLEARS **UNDECLARED**, L8 RAISES THE
     * DECLARATION IT NEEDS INSTEAD OF STALLING.
     *
     * This is the state the two-pass loop's first pass is in on purpose. The
     * ladder still climbs every rung and still names each one's reason; what
     * changed is the top rung's answer for a STATIC body: the room's own
     * ceiling is held for the mechanism's bound, and then the tick is asked
     * of the GAME rather than invented (§11.4 unweakened — the model computes
     * nothing about a `SandTrap`'s death).
     */
    it('⛔ L8 with its clears UNDECLARED raises a GAME-sourced pending declaration', () => {
        const { run, committed } = runFromCommitted('r8-solve-8', {
            persistence: [{ level: 5, tag: 0 }],
        });
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
                name: 'probe-l8-pending', boot: committed.boot,
            });
        } catch (e) { refusal = e; }
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.name).toBe('PendingDeclaration');
        expect(refusal.pending).toMatchObject({ level: 8, tag: 0, source: 'game' });
        expect(refusal.pending.body).toBe('sandtrap@96,80');
        // ⛔ The refusal carries the TICKS IT SPENT — the prefix the game is
        // handed. A pending declaration whose walk nobody kept could not be
        // measured against anything.
        expect(refusal.perTick.length).toBeGreaterThan(300);
        expect(refusal.message).toMatch(/§11\.4 refuses/);
        // ⛓ And the FIRST shove is derived on this arm too — the ladder's
        // kill rung fires on the way to the SECOND shove's stance, which is
        // §12.10.2's measured wall, now answered rather than reported.
        const shoves = refusal.rows.filter((r) => r.strategy.verb === 'shove');
        expect(shoves.map((r) => r.obstacle.id))
            .toEqual(['pushableblock@112,48', 'pushableblock@96,112']);
        expect(shoves[0].strategy).toMatchObject({ k: 2, dir: 'W', to: { tx: 5, ty: 3 } });
        /**
         * ⛓⛓⛓ AND THE SECOND BLOCK IS SUNK — BY EXHAUSTION, NOT BY
         * PREFERENCE. ⚖ Ruling 1(a) reserves a destructive resting cell for
         * an explicit LAST RESORT, and L8 is the arc's first room to reach
         * one: column 6 is the only way south, so every non-destructive cell
         * in every direction leaves the block in the corridor, and the one
         * direction that would park it clear (E, to `(7,7)`) has its
         * near-side stance in the water. `(5,7)` is what is left — which is
         * also the hand answer's cell.
         *
         * ⛔ AND THE OFF-THE-MAP REJECTION IS WHAT MAKES THE LAST RESORT
         * REACHABLE. Before slice 4 the guard compared a TILE index to a
         * PIXEL width, so the southward scan ran out of the room and returned
         * a `k` the block cannot physically reach.
         */
        expect(shoves[1].strategy).toMatchObject({ dir: 'W', destroys: true });
    });

    it('a collect-placement with nothing standing there refuses as a MACRO-layer error', () => {
        const { run, committed } = runFromCommitted('r8-solve-2');
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
        const { run, committed } = runFromCommitted('r8-solve-2');
        expect(() => solveSegment({
            run, goals: [{ kind: 'kill-everything' }],
            name: 'probe-goal', boot: committed.boot,
        })).toThrow(/unknown goal kind/);
    });

    /**
     * ⛓⛓⛓ R8 SLICE 3b — L6 IS THE LADDER'S PROVING ROOM, AND IT SOLVES.
     *
     * Slice 2 asserted a REFUSAL here, naming the threat: the blind solve had
     * walked this corridor and the game refuted it with seven sandtrap
     * contacts and two deaths (the withdrawn `r8-solve-6`, kickoff §10). ⚖
     * §11.8a ruling 2's ladder is the registered answer to that refusal, so
     * the assertion moves to what the ladder DID — and the refusal shape is
     * still asserted, one room over, by the ladder-exhausted row below.
     *
     * ⛓ THE KNOWN-ANSWER EXHIBIT. The bait stance is DERIVED from mechanism
     * — the leash, the body-kill regions, `presserSafety`, reachability — and
     * it lands on (56,24), which is `L6_BOB_DROWN.endsAt` (48,16) in boot
     * form: **row 1, column 3**, the hand answer's one-tile solve. Nobody
     * handed it over; the four conditions computed it.
     */
    it('L6: the ladder climbs AVOID -> TIME -> BAIT and the room SOLVES', () => {
        const { run, committed } = runFromCommitted('r7-act2-6');
        const out = solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }],
            name: 'probe-l6', boot: committed.boot,
        });
        expect(run.level).toBe(7);
        expect(run.playerHits).toEqual([]);
        expect(run.playerDeaths).toEqual([]);

        // ⛔ THE ESCALATION IS ORDERED AND EACH RUNG NAMES THE CHEAPER ONE IT
        // REFUSED — asserted against the RUNNING ladder, via r8Acceptance.
        const rungs = out.trace.rows.filter((r) => r.strategy.rung);
        /**
         * ⛓⛓⛓ ONE ROW PER CLIMB, AND THE ROW CARRIES THE WHOLE CHAIN. Every
         * rung of a climb is decided before a tick is spent, so they share a
         * tick index — and a trace is strictly increasing by contract, so the
         * producer merges them into the rung that ACTED, whose `rejected`
         * lists every cheaper rung it refused, in order.
         *
         * ⇒ the climb is RECONSTRUCTED from that list and handed to the
         * running ladder's own checker. This is a stronger assertion than one
         * row per rung would be: it says the acting rung refused EXACTLY the
         * rungs below it, in order, with a reason for each.
         */
        const climbs = rungs.map((r) => {
            const chain = r.rejected
                .filter((j) => ESCALATION_LADDER.includes(j.option))
                .map((j, i, all) => ({
                    rung: j.option,
                    refused: i === 0 ? undefined
                        : { rung: all[i - 1].option, why: all[i - 1].why },
                }));
            const below = r.rejected.filter((j) => ESCALATION_LADDER.includes(j.option));
            return [...chain, {
                rung: r.strategy.rung,
                refused: below.length
                    ? { rung: below[below.length - 1].option, why: below[below.length - 1].why }
                    : undefined,
            }];
        });
        const deepest = climbs.map((c) => assertEscalationIsOrdered(c).deepest);
        expect(deepest).toEqual(['bait', 'avoid']);
        // ⛔ AND EVERY CLIMB STARTS AT THE BOTTOM. A policy that resumed at
        // the rung that worked last time would stop being cheapest-first.
        for (const c of climbs) expect(c[0].rung).toBe(ESCALATION_LADDER[0]);
        // The first climb really did refuse two cheaper rungs, by name.
        expect(climbs[0].map((c) => c.rung)).toEqual(['avoid', 'time', 'bait']);

        // AVOID refused because the room really has no corridor with both
        // bodies standing in the two cells the weave needs — `L6_BOB_DROWN`'s
        // own docblock, measured here rather than quoted.
        const bait = rungs.find((r) => r.strategy.rung === 'bait');
        expect(bait.strategy.target).toBe('bob@112,48');
        expect(bait.strategy.stance).toEqual({ x: 56, y: 24 });
        // …and it names BOTH cheaper rungs, in ladder order, with a reason
        // each — the chain, not just the rung below.
        expect(bait.rejected.map((j) => j.option)).toEqual(['avoid', 'time']);
        expect(bait.rejected[0].why).toMatch(/no admissible corridor/);
        expect(bait.rejected[1].why).toMatch(/MOVER_RANGE/);

        // ⛓ AND THE ROOM DID THE KILLING. Both bodies drown — the baited one
        // reaching the player, the other following during the crossing —
        // which is exactly what the hand block declares and what its `removes`
        // row carries as a v10 despawn.
        expect(run.chaserTerrainDeaths.map((d) => d.id))
            .toEqual(['bob@112,48', 'bob@96,16']);
        for (const d of run.chaserTerrainDeaths) expect(d.cause).toBe('water');
        // The kill-lock scan RAN and found nothing — a measurement, not an
        // absence (the IceTurret arm's law: "there were no kill locks" and
        // "nobody looked" print the same thing).
        expect(run.chaserKillLockOpens.every((o) => o.nil)).toBe(true);
    });

    /**
     * ⛔ AND THE REFUSAL SHAPE THIS DESCRIBE BLOCK IS ABOUT IS STILL
     * ASSERTED: when the ladder runs out, it says so with a rung on it.
     */
    /**
     * ⛔⛔⛔ R8 SLICE 4 — THE EXHAUSTED LADDER IS NOW A **BOUNDED VACUITY**,
     * AND THE BOUND IS MEASURED RATHER THAN ASSERTED AWAY.
     *
     * Slice 3b drove this shape in L8, where the top rung had no answer for a
     * static `"Enemy"` body. The static KILL arm answers it now, so no room on
     * the battery reaches the exhausted branch any more — which is a RESULT,
     * not a reason to delete the row (trap 62: a control that has stopped
     * being able to fail is not a weak control, it is not a control).
     *
     * ⇒ so the row measures the bound instead of pretending to exercise it:
     * every battery room is driven and NONE of them exhausts. The day a room
     * does, this goes red BY NAME and the shape gets its driven arm back.
     * "There was no exhausted ladder" and "nobody looked" print the same
     * thing otherwise.
     */
    it('⚠ BOUNDED VACUITY, MEASURED: no battery room exhausts the ladder any more', () => {
        const exhausted = [];
        for (const [tape, exit] of [
            ['r8-solve-4', { x: 64, y: 16 }],
            ['r7-act2-6', { x: 224, y: 32 }],
            ['r8-solve-8', { x: 96, y: 192 }],
        ]) {
            const { run, committed } = runFromCommitted(tape);
            try {
                solveSegment({
                    run, goals: [{ kind: 'reach-exit', exit }],
                    name: `probe-exhaust-${tape}`, boot: committed.boot,
                });
            } catch (e) {
                if (/combat ladder is EXHAUSTED/.test(e.message)) exhausted.push(tape);
            }
        }
        expect(exhausted).toEqual([]);
    });

    /**
     * ⛓⛓⛓ R8 SLICE 3b — L5's WORK ORDER IS NOW THE RIGHT ONE, and that is a
     * finding rather than a registration.
     *
     * ⛔ A `lock` AND A KILL-LOCK ARE THE SAME TAG AND OPPOSITE PROBLEMS. The
     * selector table is keyed on the census tag, so it named `hold` for
     * `lock@48,112` — and L5's lock is `tset == -1`, for which NO BUTTON
     * EXISTS ANYWHERE IN THE GAME: `checkEnemies()` opens it when
     * `Game.totalEnemies()` reaches zero. The policy went looking for a
     * presser, found none, and reported the obstacle unresolvable — a
     * diagnosis that named the right entity and the wrong mechanism.
     *
     * Live state refines the table now (`KILL_LOCK_TSET`, the
     * transcription's own sentinel), so the room's computed work order is
     * `kill` — which is what the next slice registers.
     */
    it('L5: a `tset -1` lock is refined from `hold` to `kill` by LIVE STATE', () => {
        const { run, committed } = runFromCommitted('r7-act2-5');
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 48, y: 112 } }],
                name: 'probe-l5', boot: committed.boot,
            });
        } catch (e) { refusal = e; }
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.obstacle.id).toBe('lock@48,112');
        // The refinement: `solid:lock` maps to `hold` in the TABLE...
        expect(OBSTACLE_STRATEGIES['solid:lock']).toBe('hold');
        // ...and the room's live activator roster says otherwise.
        expect(run.world.activators.find((a) => a.id === 'lock@48,112').t).toBe(-1);
        /**
         * ⛓⛓⛓ R8 SLICE 4 — AND THE WORK ORDER IS NOW EXECUTED. Slice 3b
         * recorded this as a refusal naming `kill` as SELECTED AND
         * UNREGISTERED; the executor exists, so what comes back is the
         * MODEL-SOURCED declaration the room's own mechanism computes: the
         * ceiling kills all three bodies, `Game.totalEnemies()` reaches zero,
         * and `lock@48,112` needs its own 101-step fade before `turnOff()`
         * writes `{5,0}`.
         *
         * ⚠ A DEBT'S RECORD IS AN ASSERTION THAT MUST FLIP — R6 debt 2's own
         * lesson, one slice over. This one could only ever have gone red on
         * the slice that discharged it.
         */
        expect(refusal.name).toBe('PendingDeclaration');
        expect(refusal.pending).toMatchObject({ level: 5, tag: 0, source: 'model' });
        expect(refusal.pending.at).toBe(refusal.pending.removedAt + refusal.pending.fade);
        expect(refusal.pending.fade).toBe(101);
        // ⛔ Every counted body really is gone — the declaration is about the
        // FADE, not about a room the policy gave up on.
        expect(run.chaserKills.length + run.chaserTerrainDeaths.length).toBe(3);
        // ⛔ AND THE CONTROL: L4's `button@16,64` group is an ORDINARY one, so
        // the same table row still means `hold` there — a refinement that
        // fired on every lock would be a rename, not a refinement.
        expect(OBSTACLE_STRATEGIES['proximity-hazard:button']).toBe('hold');
    });

    it('a COMBAT-BLIND run is refused at the door — the slice\'s own defect, institutionalised', () => {
        // The builder's DEFAULT roles (no `roles` key at all): a world with
        // no combat census. The first battery was solved against exactly
        // this — identical in every room without enemies, blind in the one
        // with them.
        // ⛓ R9 slice 7b: `r8-solve-2` — the solver twin of the retired
        // `r7-act2-2`, byte-equal over all eleven boot fields and the same 47
        // ticks. This row needs only a real L2 boot to build a world from.
        const t = parseTape(JSON.parse(
            readFileSync(join(TAPES, 'r8-solve-2.json'), 'utf8')));
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SEEDLING BOT R9, SLICE 1 — **A3: `derivePressKill` REPORTS ITS OWN
 * WHY.** The press arm is asked FIRST and needs nothing from the room; the
 * ceiling arm is the fallback. Until this slice `derivePressKill` accumulated
 * three sentences and DISCARDED them at every `return null`, so a room that
 * refused in the press arm reported *"level N has NO arrow trap"* — an answer
 * about the arm nobody asked for, and the reason probe 2b's 23 corridor
 * reverts all read that way (`procgenOracle.js` § the fourth-that-is-not-one).
 * ══════════════════════════════════════════════════════════════════════ */

describe('A3 — a kill refusal names the PRESS arm, on a room with no arrow trap', () => {
    /** ⛓ The smallest room that reaches both arms: a `tset == -1` lock, one
     *  counted body, and NO arrow trap — so neither arm can answer. */
    const roomWithNoTrap = () => ({
        level: 7,
        world: {
            activators: [{ id: 'lock@3,4', t: KILL_LOCK_TSET, x: 3, y: 4 }],
            combat: { enemies: [{ tag: 'spinner', x: 5, y: 5, counted: true }] },
            arrowTraps: [],
            pressers: [],
        },
        spinnerBodies: [],
        chasers: [],
        chaserRoomVerdict: () => ({ stepped: false }),
    });

    it('⛔ reports BOTH arms, the PRESS arm FIRST', () => {
        const out = resolveKillStrategy(roomWithNoTrap(), { id: 'lock@3,4' }, []);
        expect(out.weapon).toBe(null);
        expect(out.rejected).toHaveLength(2);
        /** ⛓⛓ THE ORDER IS THE CLAIM: the arm that was tried first is the one
         *  a reader needs first. */
        expect(out.rejected[0].option).toBe('press a body');
        expect(out.rejected[0].why).toMatch(/tracks NO live spinner bodies/);
        expect(out.rejected[1].option).toBe('kill-by-ceiling');
        expect(out.rejected[1].why).toMatch(/has NO arrow trap/);
    });

    /** ⛔⛔ THE REGRESSION, SAID AS AN ABSENCE: the ceiling sentence must not be
     *  the ONLY thing this room says. That is the defect exactly — it was true,
     *  it was alone, and it named the wrong arm. */
    it('⛔ the ceiling sentence is never the ONLY why the room gives', () => {
        const { rejected } = resolveKillStrategy(roomWithNoTrap(), { id: 'lock@3,4' }, []);
        const ceilingOnly = rejected.length === 1 && /arrow trap/.test(rejected[0].why);
        expect(ceilingOnly).toBe(false);
        expect(rejected.some((r) => /press/i.test(r.option))).toBe(true);
    });

    /** ⛓ …and the OTHER press-arm refusal reaches the reader too: a body whose
     *  `KILL_ARM_POLICY` row is not `modelled` says SO, rather than being
     *  reported as a room with no ceiling.
     *
     *  ⛓⛓ R9 SLICE 12: the exemplar WAS `bob`, whose row is `modelled` now —
     *  the press arm paid its refusal. Repointed rather than deleted (trap 62)
     *  to `jellyfish`, a chaser transcribed to the same depth in the same
     *  module and deliberately unconverted, so the claim keeps a live subject
     *  instead of quietly becoming vacuous. */
    it('⛓ an un-modelled body\'s own sentence survives the fallthrough', () => {
        const run = roomWithNoTrap();
        run.world.combat.enemies = [{ tag: 'jellyfish', x: 5, y: 5, counted: true }];
        run.spinnerBodies = [{ id: 'jellyfish@5,5', x: 5, y: 5 }];
        const { rejected } = resolveKillStrategy(run, { id: 'lock@3,4' }, []);
        expect(rejected[0].option).toMatch(/^press /);
        expect(rejected[0].why).toMatch(/KILL_ARM_POLICY/);
        expect(rejected.at(-1).option).toBe('kill-by-ceiling');
    });
});

describe('the strategy catalog seam (slice 3 extends, never restructures)', () => {
    it('every registered executor answers a selector row; unregistered rows are the work orders', () => {
        /**
         * ⛓⛓⛓ PROCGEN PoC SLICE 3b — **A VERB CAN BE SELECTED TWO WAYS**, and
         * until this slice the invariant only knew one of them.
         *
         * `refineStrategy` turns one table answer into another by asking the
         * LEVEL a question the table cannot ask, and it has done so since R8
         * slice 3b. This assertion computed "selected" from
         * `OBSTACLE_STRATEGIES` alone — so `kill` satisfied it only because
         * `solid:magicallock` happens to name `kill` directly, i.e. for a
         * reason unrelated to the claim being made. `weigh` is the first
         * refined verb with no table row of its own, and it is what surfaced
         * the gap. The refinements are now data (`STRATEGY_REFINEMENTS`) and
         * this reads them; `procgenWeigh.test.js` DRIVES every row, so the
         * table cannot silently drift from the function it describes.
         */
        const selected = new Set([
            ...Object.values(OBSTACLE_STRATEGIES),
            ...STRATEGY_REFINEMENTS.map((r) => r.to),
        ]);
        for (const verb of Object.keys(STRATEGY_EXECUTORS)) {
            expect(selected.has(verb) || verb === 'collect',
                `executor '${verb}' is reachable by no selector row`).toBe(true);
        }
        // ⛔ AND EVERY REFINEMENT MUST REFINE SOMETHING THE TABLE REALLY SAYS.
        // A row whose `from` no obstacle selects would be a refinement of a
        // verb nobody reaches — the arm-nobody-built shape, one layer up.
        for (const r of STRATEGY_REFINEMENTS) {
            expect(Object.values(OBSTACLE_STRATEGIES),
                `refinement ${r.from} -> ${r.to} refines a verb no row selects`)
                .toContain(r.from);
        }
        // The pending work orders, as data: selected and not yet registered.
        // ⛓ R8 slice 3 took `hold` off this list and slice 3b took `shove`,
        // which is the whole of the "adds rows, never restructures" contract,
        // asserted rather than asserted about.
        //
        // ⛔ R8 SLICE 4 TOOK `kill` OFF THE LIST — it is reached BOTH ways
        // now, as a table row (L5's refined `solid:lock`) and as the ladder's
        // top rung (L8's static body), which is one executor with two
        // entries rather than two policies.
        //
        // ⛓⛓⛓ R8 SLICE 7 TOOK `touch` OFF IT, and added `fight` and
        // `keylock` registered from the start — D2's last three rooms. The
        // trap-62 CONTROL is therefore REPLACED rather than deleted: `wand`
        // is selected for `solid:wandlock` (L40's, a real obstacle with a
        // real verb — `botDriverV2.runFire` — and no solver executor), so the
        // claim "a strategy may be named by the table and absent from the
        // registry" still has something that can make it false.
        const pending = [...selected].filter((v) => !STRATEGY_EXECUTORS[v]).sort();
        expect(pending).toEqual(['wand']);
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
    it('⛔ the frontier ADVANCED from the button to the block, and the block MOVED', () => {
        const { run, committed } = runFromCommitted('r8-solve-4');
        const out = solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }],
            name: 'r8-solve-4', boot: committed.boot,
        });
        // The two work orders, in the order the frontier computed them: the
        // button (a proximity hazard on the frontier) and then the block,
        // which is L4's real door.
        const obstacles = out.trace.rows.map((r) => r.obstacle?.id).filter(Boolean);
        expect(obstacles).toEqual(['button@16,64', 'pushableblock@32,64']);
        /**
         * …and the block is where the derivation put it — read off the
         * VERB'S OWN RECORD, which is `runShove`'s answer at the tick it
         * finished.
         *
         * ⛔ NOT off `run.pushables`. The room SOLVES now, so by the end of
         * the segment the run is in L5 and `run.pushables` is L5's roster —
         * a getter that would have answered this question one slice ago and
         * silently answers a different one today. Measure at the layer that
         * did the thing (`feedback_wrong_witness_fork_effective_time`).
         */
        const record = out.records.find((r) => r.kind === 'shove');
        expect(record).toMatchObject({
            id: 'pushableblock@32,64', dir: 'E',
            from: { tx: 2, ty: 4 }, to: { tx: 4, ty: 4 }, destroys: false,
        });
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
        const { run, committed } = runFromCommitted('r8-solve-4');
        const out = solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }],
            name: 'r8-solve-4', boot: committed.boot,
        });
        // The room's ceiling did the killing, and the policy pressed nothing.
        expect(run.chaserKills).toHaveLength(1);
        expect(run.chaserKills[0]).toMatchObject({ level: 4, id: 'bob@64,64', by: 'arrow' });
        // ⚠ `run.chasers` is NOT asserted empty any more, and the reason is
        // the room solving: the segment now ENDS IN L5, whose own roster is
        // three live bobs. "The body this hold was waiting for is gone" is
        // the claim, and `chaserKills` is where it is true; the live roster
        // stopped being about L4 the moment the walk crossed.
        // ⛔ ZERO HITS, ZERO DEATHS — the standing policy, on a walk that
        // stands still for a hundred ticks under a ceiling that is firing.
        expect(run.playerHits).toEqual([]);
        expect(run.playerDeaths).toEqual([]);
        // …and the hold ended exactly when the body left the world rather
        // than when a number ran out: the kill plus the death staging.
        //
        // ⛓ MEASURED AT THE HOLD'S OWN END, which since slice 3b is the tick
        // the NEXT decision was taken on rather than the end of the run — the
        // room does not stop at the hold any more. Reading `ticksCompleted`
        // here would now be measuring the shove and the walk as well, which
        // is the wrong-witness shape (a segment's own progress counter is not
        // a witness that a particular step ended when you think it did).
        const shove = out.trace.rows.find((r) => r.strategy.verb === 'shove');
        expect(shove.tick).toBe(run.chaserKills[0].t + DEATH_ANIM_TICKS - 1
            + MOBILE_DEATH_FADE.ticks);
    });
});

/**
 * ⛔⛔⛔ R8 SLICE 4 — THE OFF-THE-MAP GUARD, WHICH HAD BEEN VACUOUS SINCE THE
 * DAY IT WAS WRITTEN.
 *
 * `deriveShove`'s scan bounded `k` with `world.world.width/height` — the room
 * in PIXELS (192 x 208 for L8) — and compared it to a TILE index, so no `k`
 * inside a twelve-tile room could ever trip it. L8 is the first room where it
 * mattered: push-until-path scanned column 6 southward, found every in-room
 * cell still blocking the only way south, walked out through the floor, and
 * returned a `k` whose cell the block cannot physically reach. The shove then
 * leaned for 240 ticks and reported the block had never left its cell.
 *
 * ⇒ the row measures the UNITS rather than the outcome, because the outcome
 * (a sunk block) is reachable by more than one wrong derivation.
 * [[feedback_units_must_survive_the_round_trip]]
 */
describe('the shove scan\'s off-the-map bound — units, measured', () => {
    it('⛔ `world.width/height` are TILES and `world.world.*` are PIXELS', () => {
        const { run } = runFromCommitted('r8-solve-8');
        expect(run.world.width).toBe(12);
        expect(run.world.height).toBe(13);
        expect(run.world.world.width).toBe(12 * 16);
        expect(run.world.world.height).toBe(13 * 16);
        // ⛓ AND THE TWO ARE NOT INTERCHANGEABLE, which is the whole defect:
        // a tile index compared against the pixel extent is a guard that
        // cannot fire in any room this game has.
        expect(run.world.world.height).toBeGreaterThan(run.world.height);
    });

    it('⛓ the derived second shove SINKS the block — the last resort, reached by exhaustion', () => {
        const { run, committed } = runFromCommitted('r8-solve-8', {
            persistence: [{ level: 5, tag: 0 }],
        });
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
                name: 'probe-l8-sink', boot: committed.boot,
            });
        } catch (e) { refusal = e; }
        const shoves = refusal.rows.filter((r) => r.strategy.verb === 'shove');
        const second = shoves.find((r) => r.obstacle.id === 'pushableblock@96,112');
        // ⛔ Before the units fix this read `{ dir: 'S', k: 6, destroys: false }`
        // — a destination six tiles below a block that never moved.
        expect(second.strategy).toMatchObject({ dir: 'W', destroys: true });
        expect(second.strategy.to).toEqual({ tx: 5, ty: 7 });
    });
});

/**
 * ⛓⛓⛓ ⚖ EDITOR ARC SLICE 10 (§12d item 11, the USER's ruling — which
 * SUPERSEDES §12c's deferral) — A CHEST IN THE CORRIDOR IS A CLEARABLE
 * OBSTACLE.
 *
 * L11's only corridor is a one-tile vertical shaft between two bodies of
 * water and `chest@32,48` stands across it (the route survey's step 11,
 * §15.4a). Before this row the frontier said *"No strategy row exists for
 * this obstacle"* and priced a `Chest` — a `Solid` only until `open()` flips
 * its type — as fixed level geometry.
 *
 * ⛓⛓⛓ AND THE BINDING TEST IS A DIFFERENTIAL, not a "it solves now". The
 * SAME room, from the SAME boot, is solved two ways:
 *
 *   · the OBSTACLE side — one `reach-exit` goal; the chest is discovered on
 *     the frontier and discharged by the verb,
 *   · the GOAL side — `collect-placement` then `reach-exit`, which is how
 *     the campaign's own sphere-0.2 route reaches it,
 *
 * and the two produce the SAME WALK, key set for key set. That is the claim
 * worth pinning: the obstacle row does not invent a second way to open a
 * chest, it reaches the one that was already there. The two differ in
 * exactly one place — the TRACE — and that difference is asserted too.
 */
describe('⚖ slice 10: `solid:chest` — the corridor-blocking chest is COLLECTED', () => {
    const L11_EXIT = { x: 32, y: 0 };
    const L11_CHEST = { x: 32, y: 48 };
    const keysOf = (out) => out.perTick.map((s) => [...s].sort().join('+')).join('|');

    it('⛓ the selector row names the verb that was ALREADY registered', () => {
        expect(OBSTACLE_STRATEGIES['solid:chest']).toBe('chest');
        expect(typeof STRATEGY_EXECUTORS.chest).toBe('function');
        // ⛔ The row points at the SAME verb the goal side selects — one
        // mechanism, one executor. A second "remove" verb would be two cost
        // models for one `Chest.open()`.
        expect(OBSTACLE_STRATEGIES['proximity-hazard:chest'])
            .toBe(OBSTACLE_STRATEGIES['solid:chest']);
    });

    it('⛔ the frontier names the chest as a SOLID and the trace says which verb', () => {
        const { run, committed } = runFromCommitted('r8-solve-11');
        const out = solveSegment({
            run, goals: [{ kind: 'reach-exit', exit: { ...L11_EXIT } }],
            name: 'slice10-l11-obstacle', boot: committed.boot,
        });
        const row = out.trace.rows.find((r) => r.obstacle?.id === 'chest@32,48');
        expect(row, 'no trace row names the chest as an obstacle').toBeTruthy();
        expect(row.obstacle.kind).toBe('solid');
        expect(row.strategy.verb).toBe('chest');
        // ⛔ AND THE REJECTED OPTION IS THE ONE A READER WOULD ASK ABOUT.
        expect(row.rejected.map((r) => r.option)).toContain('route-around');
    });

    it('⛓⛓⛓ …and the walk it earns is the GOAL-DIRECTED collect\'s, key for key', () => {
        const a = runFromCommitted('r8-solve-11');
        const obstacleSide = solveSegment({
            run: a.run, goals: [{ kind: 'reach-exit', exit: { ...L11_EXIT } }],
            name: 'slice10-l11-obstacle', boot: a.committed.boot,
        });
        const b = runFromCommitted('r8-solve-11');
        const goalSide = solveSegment({
            run: b.run,
            goals: [
                { kind: 'collect-placement', placement: { ...L11_CHEST } },
                { kind: 'reach-exit', exit: { ...L11_EXIT } },
            ],
            name: 'slice10-l11-goal', boot: b.committed.boot,
        });
        expect(keysOf(obstacleSide)).toBe(keysOf(goalSide));
        // ⛓ The verb's own record is the same record, `openedAt` and all —
        // which is what makes "the same walk" a claim about the MECHANISM
        // rather than about two coincidentally equal key streams.
        // ⚠ MINUS `goal`, which is the one field that MUST differ — the
        // record says which errand it served, and the whole point is that the
        // two errands share the mechanism.
        const chestRecord = (out) => {
            const { goal, ...rest } = out.records.find((r) => r.strategy === 'chest');
            return rest;
        };
        expect(chestRecord(obstacleSide)).toEqual(chestRecord(goalSide));
        expect(obstacleSide.records.find((r) => r.strategy === 'chest').goal)
            .toBe('reach-exit');
        expect(goalSide.records.find((r) => r.strategy === 'chest').goal)
            .toBe('collect-placement');
        // ⛔ THE PERSISTENCE-VISIBLE ACT, in the run's own ledgers.
        expect(a.run.chestOpens.map((c) => c.id)).toEqual(['chest@32,48']);
        expect(a.run.sealCollections.map((c) => c.from)).toEqual(['chest@32,48']);
        expect(a.run.chestOpens).toEqual(b.run.chestOpens);
        expect(a.run.sealCollections).toEqual(b.run.sealCollections);
    });

    it('⚠ …and the two differ in exactly ONE thing — the decision they record', () => {
        const a = runFromCommitted('r8-solve-11');
        const obstacleSide = solveSegment({
            run: a.run, goals: [{ kind: 'reach-exit', exit: { ...L11_EXIT } }],
            name: 'slice10-l11-obstacle', boot: a.committed.boot,
        });
        const b = runFromCommitted('r8-solve-11');
        const goalSide = solveSegment({
            run: b.run,
            goals: [
                { kind: 'collect-placement', placement: { ...L11_CHEST } },
                { kind: 'reach-exit', exit: { ...L11_EXIT } },
            ],
            name: 'slice10-l11-goal', boot: b.committed.boot,
        });
        // The obstacle side names an OBSTACLE; the goal side names a GOAL.
        expect(obstacleSide.trace.rows.some((r) => r.obstacle?.id === 'chest@32,48')).toBe(true);
        expect(goalSide.trace.rows.some((r) => r.obstacle?.id === 'chest@32,48')).toBe(false);
        expect(goalSide.trace.rows.some(
            (r) => r.goal?.kind === 'collect-placement' && r.strategy.verb === 'chest')).toBe(true);
    });

    /**
     * ⛔ THE TRAP-62 CONTROL FOR THIS ROW, and it is a REAL obstacle rather
     * than a synthetic one: the census `tag` is what selects, so a room whose
     * frontier names a solid with no row still refuses BY NAME. `sign@64,128`
     * in L19 is the measured one (§15.7a: a `Solid` at tile (4,8) with no verb
     * in the game at all) — the claim "a kind/tag with no row is a refusal
     * that says so" must still have something that can make it false.
     */
    /**
     * ⛓ R9 SLICE 4 — `solid:breakablerock` LEFT THIS ROW, and the row is
     * better for it. The rock was slice 10's second example of "a solid with no
     * verb"; it has one now (`break`), so the claim keeps the example that is
     * still true and that R8 slice 7 MEASURED: `sign@64,128` is a Solid at tile
     * (4,8) in L19 with no verb in the game at all — the obstacle whose
     * nearness to the aim once hid `bosslock@48,32`, which is why the frontier
     * sorts actionable obstacles first.
     */
    it('⛔ a solid with NO row still refuses by name — the claim is not widened', () => {
        expect(OBSTACLE_STRATEGIES['solid:sign']).toBeUndefined();
        // ⛓ and the rock is the CONTROL for the same claim from the other
        // side: a row that EXISTS resolves to a REGISTERED executor.
        expect(OBSTACLE_STRATEGIES['solid:breakablerock']).toBe('break');
        expect(STRATEGY_EXECUTORS.break).toBeTypeOf('function');
    });
});

/**
 * ⛓⛓⛓ ⚖ EDITOR ARC SLICE 10 (§12d item 10's first move, §17.10 input 1) —
 * THE DANGER RECORD RIDES ON THE REFUSAL.
 *
 * Slice 9 recorded every danger query `solveSegment` was handed and then
 * measured that across 30 solves of 9 committed blocks **not one** came back
 * with a non-empty reason list (§17.5). That is a theorem, not an accident:
 * `refuseDanger` THROWS when the union answers danger, so a segment that
 * reaches its goal cannot have had a dangerous gate. ⇒ the interesting half
 * of the channel lives only on refusals, and until this slice nothing could
 * read it.
 */
describe('⚖ slice 10: `SolverRefusal` carries the danger record', () => {
    it('⛓ the field exists and DEFAULTS to an empty list, never undefined', () => {
        const bare = new SolverRefusal('nothing happened');
        expect(bare.dangerQueries).toEqual([]);
    });

    /**
     * ⛔ NON-VACUOUS: the refusal must carry a POSITIVE population, or the
     * test would pass just as well against a field nobody ever filled. The
     * driven case is the route's own step 18 — L16, whose CLIMB reaches every
     * rung of the ladder and refuses at the top (`refuse()` inside
     * `climbLadder`, which is a closure arm and therefore one that CAN see
     * the recorder). Its boot is the survey's staged construction: the
     * campaign's own post-sword block re-pointed at the room's arrival.
     */
    const L16_BOOT = { level: 16, x: 32, y: 64 };
    const refuseInL16 = () => {
        const { run } = runFromCommitted('r8-solve-11', { boot: { ...L16_BOOT } });
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 352, y: 80 } }],
                name: 'slice10-danger-on-refusal', boot: { ...L16_BOOT },
            });
        } catch (e) { return e; }
        return null;
    };

    it('⛔ a REFUSED segment carries the queries the bot was told, with both clocks', () => {
        const refusal = refuseInL16();
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.message).toMatch(/combat ladder is EXHAUSTED/);
        expect(refusal.dangerQueries.length).toBeGreaterThan(0);
        for (const q of refusal.dangerQueries) {
            // ⚠ TWO CLOCKS ON EVERY ROW (§17.5): `tick` is the TAPE's, the one
            // a scrub cursor indexes; `runTick` is `run.ticksCompleted`. Dead
            // frames make them differ, so a reader needs both.
            expect(Number.isInteger(q.tick)).toBe(true);
            expect(Number.isInteger(q.runTick)).toBe(true);
            expect(['sense', 'gate']).toContain(q.where);
            expect(Array.isArray(q.sources)).toBe(true);
        }
    });

    /**
     * ⛓⛓⛓ AND THE MEASUREMENT SLICE 10 ADDED TO SLICE 9's, AS A ROW.
     *
     * §17.5 said the non-empty case *"lives only on REFUSALS"*. With the
     * record now riding on them, the sweep says something sharper: across all
     * 39 route-step solves of the survey's two legs — 23 SOLVED, 6 REFUSED, 4
     * engine-side — **not one recorded query came back dangerous, on either
     * outcome.** The refusals are *no corridor* and *ladder exhausted*, and
     * neither is a `refuseDanger` throw. ⇒ the non-empty case lives only on a
     * refusal **raised BY `refuseDanger`**, and no room on the route raises
     * one. L16's climb is the driven case here: it reaches every rung, so its
     * gates are the most-asked on the route — and they all answer CLEAR.
     *
     * ⛔ A row that merely tolerated the emptiness would be the finding
     * wearing a check's clothes (§17.5 consequence 1), so the POPULATION is
     * asserted before the zero.
     */
    it('⛓ …and EVERY gate this refusal reached answered CLEAR — the population, then the zero', () => {
        const refusal = refuseInL16();
        expect(refusal.dangerQueries.length).toBeGreaterThan(0);
        expect(refusal.dangerQueries.filter((q) => q.danger)).toEqual([]);
        // The union answered, and it answered with an EMPTY reason list —
        // which is a different fact from "nobody asked".
        for (const q of refusal.dangerQueries) expect(q.sources).toEqual([]);
    });

    /**
     * ⚠ THE DANGEROUS SHAPE IS PINNED SYNTHETICALLY, and it is named as such
     * — slice 9's own disposition for the ink branch no committed walk
     * exercises (§17.5 consequence 2), one channel over. The claim is about
     * the CARRIER, not about a room: a dangerous row survives the throw with
     * the union's own `why` verbatim.
     */
    it('⚠ a DANGEROUS row survives the throw verbatim — pinned synthetically, and said so', () => {
        const row = {
            where: 'gate',
            tick: 12,
            runTick: 14,
            level: 6,
            x: 64,
            y: 16,
            danger: true,
            mode: 'transit',
            horizon: 0,
            sources: [{ kind: 'arrow-lane', id: 'sandtrap@64,16', why: 'the lane is ARMED' }],
        };
        const thrown = new SolverRefusal('synthetic', { dangerQueries: [row] });
        expect(thrown.dangerQueries).toEqual([row]);
        expect(thrown.dangerQueries[0].sources[0].why).toBe('the lane is ARMED');
    });

    /**
     * ⛔⛔ AND THE SNAPSHOT IS A COPY. The recorder keeps writing into its own
     * array for as long as the closure lives, so a refusal that carried the
     * live reference would report a record that grew after it was thrown.
     */
    it('⛔ the carried list is a COPY of the recorder\'s, not the live array', () => {
        const refusal = refuseInL16();
        const carried = refusal.dangerQueries;
        expect(carried).not.toBe(refusal.rows);
        const before = carried.length;
        carried.push({ where: 'not-a-real-row' });
        expect(refusal.dangerQueries.length).toBe(before + 1);
    });

    /**
     * ⚠ THE NAMED BOUND, ASSERTED. A `SolverRefusal` raised by a MODULE-LEVEL
     * helper cannot see `solveSegment`'s recorder — the same bound `rows` and
     * `perTick` have carried since R8 slice 2 — so its list is EMPTY, and an
     * empty list means "no record", never "no danger". A reader that
     * collapsed the two would report a calm walk for a refusal nobody
     * recorded.
     */
    it('⚠ a refusal raised outside the solve loop carries an EMPTY record — a BOUND, not a verdict', () => {
        const outside = new SolverRefusal('raised by a module-level helper', {
            obstacle: { kind: 'solid', id: 'x@0,0' },
        });
        expect(outside.dangerQueries).toEqual([]);
        expect(outside.rows).toEqual([]);
        expect(outside.perTick).toEqual([]);
    });
});

describe('R9 slice 12b: the OPPORTUNISTIC STRIKE — one policy, two consumers', () => {
    /**
     * L6's two bobs, the room `r9-l6-bob-press` drives. A sword in the seam
     * and `noDamage` FALSE, because a policy that only ever runs behind a
     * shield is a policy nobody has tested.
     */
    const l6 = () => createLevelRun({
        levelSource, boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [],
        noDamage: false, grants: [], persistence: [], despawn: [], equips: [],
        pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
    });
    /** A corridor east, past `bob@112,48`. */
    const WPS = [{ x: 128, y: 56 }];
    const key = (h) => [...h].sort().join('+') || '-';

    /**
     * ⛓⛓⛓ **THE CLAIM THAT MAKES THE WHOLE POLICY SAFE** (⚖ ruling 30(c)):
     * what the PROBE certifies is what the WALK does. Asserted as a held-set
     * equality between `previewWalk` and `drive` themselves — not against a
     * re-implementation of either, which would be an assertion about the
     * re-implementation.
     *
     * ⛔ MUTANT (a): put the policy in one and not the other and this reds
     * immediately, because the corridor the danger map priced is no longer
     * the corridor the tape walks.
     */
    it('the PREVIEW and the DRIVE spend the same keys, tick for tick', () => {
        const a = l6();
        const pv = previewWalk(a, WPS, DEFAULT_TOLERANCE, { strike: strikePolicyFor(a) });
        const previewHeld = pv.samples.map((x) => key(x.held ?? new Set()));

        const b = l6();
        const perTick = [];
        const strike = strikePolicyFor(b);
        drive(b, WPS[0], perTick, {
            until: 'arrival', tolerance: DEFAULT_TOLERANCE, maxTicks: 200,
            what: 'the equality row', avoidVolumes: false, strike,
        });
        const driveHeld = perTick.map(key);

        expect(driveHeld).toEqual(previewHeld);
        // ⚠ AND NOT VACUOUSLY: a corridor where the policy never fires would
        // pass this row with both sides holding `right` throughout.
        expect(strike.strikes).toBeGreaterThan(0);
        expect(previewHeld.filter((h) => h.includes('primary')).length)
            .toBe(strike.strikes);
    });

    it('…and the walk that strikes takes NO hits where the same walk without one does', () => {
        const withStrike = l6();
        const perTick = [];
        drive(withStrike, WPS[0], perTick, {
            until: 'arrival', tolerance: DEFAULT_TOLERANCE, maxTicks: 200,
            what: 'armed', avoidVolumes: false, strike: strikePolicyFor(withStrike),
        });
        expect(withStrike.playerHits).toHaveLength(0);
        // ⛓ AND THE PRESS LANDED — a walk that took no hits because it never
        // met anything would prove nothing about the policy.
        const landed = withStrike.chaserPressHits.filter((h) => h.landed);
        expect(landed.length).toBeGreaterThan(0);
        expect(landed[0].hits).toBe(1);
    });

    it('AIMS one tick and PRESSES the next — `slashDirection` is latched, not read', () => {
        const run = l6();
        const strike = strikePolicyFor(run);
        const decisions = [];
        for (let t = 0; t < 20; t += 1) {
            const d = strike.decide(run.state, run.strikeBodies, run.ticksCompleted,
                new Set(['right']));
            decisions.push(d.decision);
            run.advance(d.held);
        }
        const aimAt = decisions.indexOf('aim');
        expect(aimAt).toBeGreaterThanOrEqual(0);
        expect(decisions[aimAt + 1]).toBe('press');
    });

    /**
     * ⛔⛔ MUTANT (b)'s ROW. `hitsTimer === 0` alone is the right question one
     * tick too early: a press's tests run `T+1 … T+SLASH_HIT_TICKS`, so on the
     * tick after a press the target's timer has not moved and a timer-only
     * rule presses again into a hit that is already on its way.
     */
    it('refuses a second press while MY OWN last press still has hit tests to run', () => {
        const run = l6();
        const strike = strikePolicyFor(run);
        let pressedAt = null;
        for (let t = 0; t < 30; t += 1) {
            const d = strike.decide(run.state, run.strikeBodies, run.ticksCompleted,
                new Set(['right']));
            if (d.decision === 'press') { pressedAt = run.ticksCompleted; }
            run.advance(d.held);
        }
        expect(pressedAt).not.toBeNull();
        const owedRows = strike.trace.filter((r) => (r.rejected ?? []).some(
            (x) => /still has hit tests to run/.test(x.why)));
        expect(owedRows.length).toBeGreaterThan(0);
        // The window is the swing's own length, not a cadence.
        const ticks = owedRows.map((r) => r.tick - pressedAt);
        expect(Math.max(...ticks)).toBeLessThanOrEqual(SLASH_HIT_TICKS);
    });

    it('is INERT where it cannot help — no sword, and no bodies', () => {
        const noSword = createLevelRun({
            levelSource, boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [],
            noDamage: false, grants: [], persistence: [], despawn: [], equips: [],
            pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: {}, roles: ROLES,
        });
        expect(strikePolicyFor(noSword)).toBeNull();
        // ⛓ And `noDamage` empties `strikeBodies` by construction — the gate
        // `stepChasersNow` opens with (trap 563), re-asked here because this
        // is a new consumer of live chaser state.
        const shielded = createLevelRun({
            levelSource, boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [],
            noDamage: true, grants: [], persistence: [], despawn: [], equips: [],
            pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        expect(shielded.strikeBodies).toEqual([]);
        expect(strikePolicyFor(shielded)).toBeNull();
    });

    /**
     * ⛔ THE ARM IS KEYED ON THE **CLASS**, NOT ON THE `genericHit` ARM — and
     * this row exists because the first cut got it wrong. `as3` is `"Enemy"`
     * for every chaser and `KILL_ARM_POLICY.Enemy` is `refused` on purpose
     * (the family's row, whose reason a lift must answer one class at a time).
     * The policy sat 5.9 px from a live bob and refused it with a TRUE
     * sentence about the wrong subject.
     */
    it('reads the per-CLASS policy row, not the family arm', () => {
        const run = l6();
        for (const b of run.strikeBodies) {
            expect(b.as3).toBe('Enemy');
            expect(b.enemyClass).toBe('Bob');
        }
    });

    /**
     * ⛓⛓⛓ R9 SLICE 12b′ — **`allowDash` IS ENFORCED**, and L14 is where the
     * two arms disagree.
     *
     * ⛔ 12b CARRIED the flag and never read it, so the policy had no model of
     * `slashTimer` and could not tell a swing from a dash. Its own per-target
     * `owed` rule does not bound the PLAYER: two bodies are two targets, so
     * two presses two ticks apart are legal by that rule and the second one
     * DASHES (`set slashing`'s dash branch has no `!slashing` term).
     *
     * ⛓ NON-VACUOUS, AND IT IS L14 THAT MAKES IT SO — every committed
     * corridor emits zero presses (§23.8), so no roster tape can distinguish
     * these two arms. Standing at L14's own boot for 260 ticks: permitted, the
     * policy presses at gaps 19/2/2/2 and the run is HIT once; refused, it
     * presses at gaps 20/20/39, records four `dashRefused` rows, and is not
     * hit at all.
     */
    it('⛔ `allowDash: false` REFUSES the press that would dash — and the arms differ', () => {
        const l14 = () => createLevelRun({
            levelSource, boot: { level: 14, x: 160, y: 64 }, noclip: false, noHazards: [],
            noDamage: false, grants: [], persistence: [], despawn: [], equips: [],
            pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        const standStill = (allowDash) => {
            const run = l14();
            const policy = createStrikePolicy({
                facingToward, facingKeys: FACING_KEYS, hasSword: true, allowDash,
            });
            const at = [];
            for (let t = 0; t < 260; t += 1) {
                const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                    new Set());
                if (d.decision === 'press') at.push(run.ticksCompleted);
                run.advance(d.held);
            }
            return { run, policy, at, gaps: at.slice(1).map((v, i) => v - at[i]) };
        };

        const permitted = standStill(true);
        expect(permitted.gaps).toEqual([57, 34, 26, 19, 2, 31, 2, 31, 2]);
        // ⛓ The refusal is the thing being tested, so the PERMITTED arm must
        // reach the branch it is being spared: presses inside the window.
        expect(permitted.gaps.filter((g) => g < ORDINARY_SWING_PERIOD).length).toBe(4);
        expect(permitted.policy.trace.filter((r) => r.dashRefused)).toHaveLength(0);
        expect(permitted.run.playerHits).toHaveLength(1);

        const refused = standStill(false);
        expect(refused.gaps).toEqual([57, 34, 26, 20, 20, 39]);
        expect(Math.min(...refused.gaps)).toBeGreaterThanOrEqual(ORDINARY_SWING_PERIOD);
        const rows = refused.policy.trace.filter((r) => r.dashRefused);
        expect(rows).toHaveLength(4);
        // The row says WHICH press it is measured against and what was in reach,
        // because "no strike this tick" with no reason is the shape a reader
        // cannot audit.
        for (const r of rows) {
            expect(r.dashRefused.wouldPressAt - r.dashRefused.lastPressAt)
                .toBeLessThan(ORDINARY_SWING_PERIOD);
            expect(r.dashRefused.inReach.length).toBeGreaterThan(0);
            expect(r.dashRefused.why).toMatch(/would DASH/);
        }
        expect(refused.run.playerHits).toHaveLength(0);
    });

    /**
     * ⛓⛓⛓ R9 SLICE 12b′ — **THE DWELL IS ARMED, AND THIS ROW FAILS WHEN IT
     * IS NOT.**
     *
     * ⛔ SLICE 12b'S LADDER HANDED `runDwell` A POLICY AND `runDwell` DROPPED
     * IT: its destructure read `{ticks, until, why}` of a four-key object, so
     * the chaser arm stood still for its whole bound holding nothing and
     * reported the policy's own untouched `strikes` — zero. An options key
     * nobody destructures is a SILENCE, not an error
     * ([[feedback_dropped_option_key_is_a_silence]]).
     *
     * ⛓ THE TWO ARMS ARE THE SAME STANCE, THE SAME BODY AND THE SAME BOUND,
     * and they end differently: armed, the bob walks in, is struck three
     * times through its own 30-tick i-frames and leaves the world at tick
     * 215 with the player untouched; unarmed, the same wait is HIT at tick
     * 119. So the row cannot pass with the policy dropped, which is the
     * property the first cut lacked.
     */
    it('⛔ an ARMED dwell kills the body that walks in; the UNARMED one is hit', () => {
        const armed = l6();
        const strike = strikePolicyFor(armed);
        const dwellFor = (run, policy) => ({
            ticks: 400,
            strike: policy,
            why: 'the chaser arm\'s own shape — stand, let the body come, let the '
                + 'one policy press',
            until: {
                why: 'bob@112,48 has left the world',
                test: (r) => !(r.strikeBodies ?? []).some((c) => c.id === 'bob@112,48'),
            },
        });

        const rec = runDwell(armed, [], dwellFor(armed, strike), 'the armed dwell');
        expect(rec.ticks).toBe(215);
        expect(rec.strikes).toBe(3);
        expect(strike.strikes).toBe(3);
        expect(armed.playerHits).toHaveLength(0);

        // ⛔ THE CONTROL, AND IT IS THE WHOLE ROW. Same stance, same body,
        // same bound, policy withheld — `runDwell`'s NO-NEW-HITS invariant
        // fires, which is what a dropped `strike` key produced in anger.
        const unarmed = l6();
        expect(() => runDwell(unarmed, [], dwellFor(unarmed, null), 'the unarmed dwell'))
            .toThrow(/the dwell was HIT at tick 119/);
    });
});
/**
 * ⛓⛓⛓ R9 SLICE 12c — **THE COMPLETE DASH MODEL IN THE ORACLE.**
 *
 * ⚖ Ruling 35, the user's own: *"the oracle and the planner BOTH model the
 * dash completely; safety over speed, dash wherever there is no reason not
 * to"*. 12b′ measured the preview/drive gap to be exactly TWO things — the
 * preview's stepper carried no `dashImpulse`, and `previewWalk` never called
 * `slashSet` — and closed it by REFUSING every press that could dash. This
 * closes it by MODELLING them.
 *
 * ⛔ THE ROSTER-WIDE DEFAULT IS STILL `false` (⚖ ruling 42). Every row here
 * that exercises the `true` arm builds the policy itself; nothing committed
 * takes a dash, and the campaign producer's digest is the proof.
 */
describe('R9 slice 12c: the DASH, MODELLED — the oracle steps it and the policy prices it', () => {
    const l14 = () => createLevelRun({
        levelSource, boot: { level: 14, x: 160, y: 64 }, noclip: false, noHazards: [],
        noDamage: false, grants: [], persistence: [], despawn: [], equips: [],
        pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
    });
    /**
     * ⛓ THE (88,72) STANCE OF §23b.3, WHICH IS A CENTRE AND NOT A BOOT. A boot
     * is a TILE and the constructor centres the player 8 px into it, so the
     * stance's own coordinates are reached from `boot: (80,64)`. Measured
     * rather than assumed: booting at (88,72) lands the player ON `bob@96,80`.
     */
    const stance = () => createLevelRun({
        levelSource, boot: { level: 14, x: 80, y: 64 }, noclip: false, noHazards: [],
        noDamage: false, grants: [], persistence: [], despawn: [], equips: [],
        pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
    });
    const policyFor = (allowDash) => createStrikePolicy({
        facingToward, facingKeys: FACING_KEYS, hasSword: true, allowDash,
    });
    const key = (h) => [...h].sort().join('+') || '-';
    /**
     * A STAND, driven by the arc's own two consumers. `wps: []` with a
     * `standFor` tail is `previewWalk`'s whole dwell; `runDwell` is the
     * driver's. Neither is a re-implementation of the other, which is the
     * only reason an equality between them says anything (⚖ ruling 30(c)).
     */
    const standBoth = (mk, ticks, allowDash) => {
        const a = mk();
        const pa = policyFor(allowDash);
        // ⛓ ONE TICK MORE THAN THE DRIVE, so `samples[ticks]` is the PRE-MOVE
        // box of tick `ticks + 1` — i.e. where the player stands after the
        // drive's own last tick, which is what the position claim compares.
        const pv = previewWalk(a, [], 0, { strike: pa, standFor: ticks + 1 });
        const b = mk();
        const perTick = [];
        const pb = policyFor(allowDash);
        runDwell(b, perTick, {
            ticks,
            strike: pb,
            why: 'the dash model\'s equality fixture — a stand, so the corridor\'s own '
                + 'waypoint arithmetic cannot be what the row is measuring',
            until: {
                why: `the stand has run its ${ticks} ticks`,
                test: (r) => r.ticksCompleted >= ticks,
            },
        }, 'the dashing stand');
        return {
            preview: pv.samples.map((x) => key(x.held ?? new Set())),
            drive: perTick.map(key),
            // ⛓ R9 slice 12c — THE POSITIONS AS WELL AS THE KEYS. A sample is
            // the PRE-MOVE box, so `samples[n]` is where the player stood
            // after n driven ticks. Held-sets alone cannot see a 9 px
            // displacement that changes no decision inside the bound —
            // measured: mutant (a) left this row's key sequence intact.
            at: (n) => pv.samples[n],
            pa,
            pb,
            run: b,
        };
    };
    const firstDiff = (x, y) => {
        for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
            if (x[i] !== y[i]) return i;
        }
        return -1;
    };

    /**
     * ⛓⛓⛓ **THE ROW THAT MAKES THE DASH MODEL SAFE**, and it is 12b's own
     * equality with a press stream that DASHES.
     *
     * ⛔ MUTANT (a): drop the preview stepper's `dashImpulse` and this reds —
     * the previewed player stops 9 px short of the driven one on the dash's
     * decay (`DASH_DISPLACEMENT.total`), the bodies chase a player who is not
     * there, and the two sides stop agreeing about which body is in reach.
     */
    it('⛓⛓⛓ the PREVIEW and the DRIVE spend the same keys over a stand that DASHES', () => {
        const r = standBoth(l14, 130, true);
        expect(r.drive).toEqual(r.preview.slice(0, r.drive.length));
        // ⚠ AND NOT VACUOUSLY. A stand where nothing dashed would pass this
        // row with the `false` arm's own sequence.
        expect(r.pa.dashes).toBe(1);
        expect(r.pb.dashes).toBe(1);
        expect(r.pa.strikes).toBe(3);
        expect(r.pb.strikes).toBe(3);
        /**
         * ⛔⛔ **AND THE PREVIEWED PLAYER ENDS WHERE THE DRIVEN ONE ENDS**,
         * which is the half of ⚖ ruling 30(c) a held-set sequence cannot see.
         *
         * ⚠ MEASURED, NOT FORESEEN: mutant (a) — the preview stepper's
         * `dashImpulse` dropped — leaves this fixture's KEY sequence
         * completely intact. The dash moves the player 9 px and no decision
         * inside 130 ticks turns on it, so the corridor the probe priced would
         * have been the wrong corridor and every row here would still be
         * green. The position is what makes the row bite (trap 570: a mutant
         * that does not red the row you aimed at is telling you which row you
         * needed).
         */
        expect(r.at(130).x).toBeCloseTo(r.run.state.x, 9);
        expect(r.at(130).y).toBeCloseTo(r.run.state.y, 9);
    });

    /**
     * ⛓⛓⛓ **THE POLICY'S FORECAST OF ITS OWN PRESS IS EXACT** — the claim
     * that (ii) rests on, asserted against the RUN rather than against a
     * second copy of the forecast.
     *
     * `slashPressForecast` ages the run's slash state by the run's own
     * primitives in the run's own order and asks `slashSet` what the press on
     * `tick + 1` will be. `run.dashes` is the run's independent ledger of what
     * `advance` actually did. The two counts agreeing is what says the ageing
     * is right; the ticks agreeing is what says it is right EVERY TIME.
     */
    it('⛓⛓⛓ every press the policy calls a DASH is a dash in the run — tick for tick', () => {
        const r = standBoth(l14, 130, true);
        const policyDashTicks = r.pb.trace
            .filter((t) => t.decision === 'press' && t.dash).map((t) => t.tick);
        const runDashTicks = r.run.dashes.map((d) => d.t);
        expect(runDashTicks).toEqual(policyDashTicks);
        expect(policyDashTicks).toHaveLength(1);
    });

    /**
     * ⛔⛔ **12b's POLICY DASHED WITHOUT KNOWING IT**, and this is the row that
     * says so. Withhold the slash state and the policy has no model at all: it
     * cannot tell a swing from a dash, so it cannot choose the rect and it
     * cannot certify — and the RUN dashes anyway, because `set slashing`'s
     * dash branch has no `!slashing` term.
     *
     * ⛓ THREE DASHES THE MODEL NEVER SAW. That is the whole reason
     * `allowDash` was enforced OFF in 12b′ rather than acted on.
     */
    it('⛔ without the slash state the policy dashes BLIND — the run dashes, the model does not', () => {
        const run = l14();
        const policy = policyFor(true);
        for (let t = 0; t < 260; t += 1) {
            // ⚠ NO `slash` KEY — 12b's own call, verbatim.
            const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted, new Set());
            run.advance(d.held);
        }
        expect(policy.dashes).toBe(0);
        expect(run.dashes.length).toBe(3);
        expect(run.playerHits).toHaveLength(1);
        expect(run.playerHits[0].t ?? run.playerHits[0].tick).toBe(252);
    });

    /**
     * ⛔⛔⛔ **THE SAFETY ROW** (⚖ ruling 35). Same stance, same bound, same
     * `allowDash: true` — the only difference is that the policy can now see
     * what its press will do and CERTIFY the ground the dash adds.
     *
     * ⛓ THE DIRECTION IS THE FINDING, AND §23b.3 GOT IT HALF RIGHT. 12b′
     * recorded "dashes are safer at the forecast stance, more dangerous at the
     * boot" and concluded the sign is not uniform. It is not — but the cure is
     * not to pick a side: a CERTIFIED dash is safe at BOTH, and this row is
     * the boot, where the uncertified arm is hit.
     *
     * ⛔ MUTANT (c): remove the certification term and the t=252 hit returns.
     */
    it('⛔⛔ `allowDash: true` WITH certification takes L14\'s boot to ZERO hits — and still dashes', () => {
        const run = l14();
        const policy = policyFor(true);
        for (let t = 0; t < 260; t += 1) {
            const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                new Set(), { slash: run.slashInfo });
            run.advance(d.held);
        }
        expect(run.playerHits).toHaveLength(0);
        // ⛓ NOT BY REFUSING EVERYTHING. A certification that never certified
        // would also report zero hits, and would be a rename of `false`.
        expect(policy.dashes).toBe(4);
        expect(run.dashes.length).toBe(4);
        // ⛓ AND IT REFUSED BY NAME, with the body and the reason on the row.
        const refused = policy.dashRefusals;
        expect(refused).toHaveLength(10);
        expect(refused.every((r) => r.dashRefused.uncertified)).toBe(true);
        for (const r of refused) {
            expect(r.dashRefused.why).toMatch(/WOULD DASH/);
            expect(r.dashRefused.why).toMatch(/NOT CERTIFIED/);
        }
    });

    /**
     * ⛓ **THE SECOND FIXTURE, AND IT IS THE NON-VACUITY ONE.** At §23b.3's
     * forecast stance neither arm is hit, so a safety claim there proves
     * nothing — what it can prove is that the certification is not a blanket
     * refusal wearing a `why`.
     *
     * ⚠ §23b.3's OWN NUMBER DOES NOT REPRODUCE AT THIS HEAD, and it is
     * recorded rather than quoted: it reports the ENFORCED arm being hit at
     * t=169 here. Driven from this stance for 400 ticks, NEITHER arm is hit —
     * measured three ways (this stand; the same stand booted at (88,72), which
     * puts the player on top of `bob@96,80`; and a fixed-player forecast).
     */
    it('⛓ …and at §23b.3\'s stance the certification still TAKES dashes — it is not a blanket no', () => {
        const run = stance();
        expect({ x: run.state.x, y: run.state.y }).toEqual({ x: 88, y: 72 });
        const policy = policyFor(true);
        for (let t = 0; t < 400; t += 1) {
            const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                new Set(), { slash: run.slashInfo });
            run.advance(d.held);
        }
        expect(policy.dashes).toBe(5);
        expect(run.dashes.length).toBe(5);
        expect(policy.dashRefusals).toHaveLength(12);
        expect(run.playerHits).toHaveLength(0);
    });

    /**
     * ⛔⛔ **MUTANT (g)'s ROW: THE POLICY READS THE OUTCOME, NOT THE FLAG.**
     *
     * `set slashing` has four arms and two of them do NOTHING — `gated` and
     * `swallowed`. A press inside a dash's own animation is swallowed whole:
     * no sound, no window, no impulse, no timer write. A policy that spent an
     * aim tick on one would spend a direction key of drift to buy a press that
     * cannot hit anything, which is 12b's model scheduling a rect for every
     * press regardless of what `set slashing` did with it.
     */
    it('⛔ a press the model says will be SWALLOWED costs no aim tick and no press', () => {
        const run = l14();
        const policy = policyFor(true);
        for (let t = 0; t < 400; t += 1) {
            const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                new Set(), { slash: run.slashInfo });
            run.advance(d.held);
        }
        const swallowed = policy.trace.filter((r) => r.pressWouldBe === 'swallowed');
        // ⛓ NON-VACUOUS: the branch is reached, and reached often.
        expect(swallowed.length).toBe(20);
        for (const r of swallowed) {
            expect(r.decision).toBe('none');
            expect(r.why).toMatch(/No window opens/);
        }
        // ⛔ AND NO AIM WAS TAKEN ON ANY OF THOSE TICKS.
        const aimTicks = new Set(policy.trace.filter((r) => r.decision === 'aim')
            .map((r) => r.tick));
        expect(swallowed.some((r) => aimTicks.has(r.tick))).toBe(false);
    });

    /**
     * ⛓⛓ **THE STEPPER, ASKED DIRECTLY.** (i)'s claim is that the preview's
     * options are still built in exactly one place and that the dash arm adds
     * exactly one key — so the no-dash arm must be the stepper it always was,
     * and the dash arm must move the player by the impulse and nothing else.
     */
    it('⛓⛓ `previewStepper` spends a dash impulse — and without one it is unchanged', () => {
        const run = l14();
        const step = run.previewStepper();
        const held = new Set(['left']);
        const plain = step({ ...run.state }, held);
        const explicitNull = step({ ...run.state }, held, { dashImpulse: null });
        expect(explicitNull).toEqual(plain);
        const dashed = step({ ...run.state }, held, {
            dashImpulse: { dvx: -SLASH_DASH_FORCE, dvy: 0 },
        });
        // ⛓ `useItem` is reached from INSIDE `input()`, so the impulse lands
        // above this tick's sweep and the tick it is spent on already moves
        // further. The claim is the velocity, which is where it is applied.
        expect(dashed.vx).toBeCloseTo(plain.vx - SLASH_DASH_FORCE, 9);
        expect(dashed.vy).toBeCloseTo(plain.vy, 9);
        expect(dashed.x).toBeLessThan(plain.x);
    });

    /**
     * ⛓⛓⛓ **THE 9 PX, DERIVED — AND IT IS §23.11's MEASURED NUMBER.**
     *
     * `DASH_DISPLACEMENT` is built from `SLASH_DASH_FORCE` and
     * `DEFAULT_FRICTION` alone. §23.11 measured "one dash adds 9 px" off
     * `r9-l0-sword-dash`'s GAME-recorded stream. The two agreeing is what
     * makes the certification's path the dash's real path (⚖ ruling 17: a
     * literal only with provenance, and this one has none because it is not a
     * literal).
     */
    it('⛓⛓⛓ the dash carries 9 px over 8 ticks, DERIVED from the two constants', () => {
        expect(DASH_DISPLACEMENT.ticks).toBe(8);
        expect(DASH_DISPLACEMENT.total).toBe(9);
        expect(DASH_DISPLACEMENT.perTick).toEqual([2, 3.75, 5.25, 6.5, 7.5, 8.25, 8.75, 9]);
    });

    /**
     * ⛔⛔ **A DASH AT REST IS CERTIFIED, AND SAYING SO IS THE POINT.**
     * `knockbackImpulse` normalises the player's velocity and
     * `point_normalize` no-ops at zero length, so a dash pressed standing
     * still carries the player NOWHERE — there is no added ground to price.
     * ⚠ Four of §22.9's eight roster candidates would have been blind to the
     * dash for exactly this reason.
     */
    it('⛔ certification of a dash AT REST is trivially true — the impulse is (0,0)', () => {
        const run = l14();
        const v = certifyDash(run.state, run.strikeBodies, { dvx: 0, dvy: 0 });
        expect(v.certified).toBe(true);
        expect(v.why).toMatch(/carries the player nowhere/);
    });

    /**
     * ⛔⛔ **A KNOCKED BODY MAKES A DASH UNPRICEABLE, AND THAT IS
     * `priceCrossing`'s OWN REFUSAL** — `Enemy.hit` applies `swordForce` and a
     * knocked chase takes the `pushed` branch, which does not re-normalize to
     * `moveSpeed`, so the step bound `chaseEnvelope` rests on does not hold.
     *
     * ⚠ IT IS THE COMMON CASE AND IT IS SUPPOSED TO BE: the dash a policy most
     * wants is the one two ticks after a press, and two ticks after a press
     * the body it struck is in flight. ⚖ Ruling 35 puts safety over speed.
     */
    it('⛔ a body inside its own i-frame makes the dash UNPRICEABLE, refused by name', () => {
        const run = l14();
        const knocked = run.strikeBodies.map((b, i) => (i === 0 ? { ...b, hitsTimer: 12 } : b));
        const v = certifyDash(run.state, knocked, { dvx: -SLASH_DASH_FORCE, dvy: 0 });
        expect(v.certified).toBe(false);
        expect(v.why).toMatch(/inside its own i-frame/);
        expect(v.why).toMatch(/does not re-normalize to `moveSpeed`/);
    });

    /**
     * ⛔⛔⛔ **THE PREVIEW CANNOT OPEN A WAND OR FIRE WINDOW**, asserted rather
     * than asserted-in-prose (trap 566: a warning quoted in a header is not a
     * check).
     *
     * The gate `slashSet` reads has six terms and two of them are windows the
     * RUN owns. A preview steps ticks the run has not run, so it must AGE
     * them — and ageing is only sound because nothing a preview does can OPEN
     * one. Both are opened by a `secondary` press; the walk holds no
     * `secondary` and the strike policy presses `primary` alone.
     */
    it('⛔⛔ no previewed tick spends `secondary`, so the two aged windows only ever CLOSE', () => {
        const r = standBoth(l14, 130, true);
        expect(r.preview.some((h) => h.includes('secondary'))).toBe(false);
        expect(r.drive.some((h) => h.includes('secondary'))).toBe(false);
        const info = r.run.slashInfo;
        expect(info.openUntil).toEqual({ wanding: -1, firing: -1 });
        expect(info.gate.wanding).toBe(false);
        expect(info.gate.firing).toBe(false);
    });

    /**
     * ⚠⚠⚠ **THE EQUALITY IS A BOUNDED CLAIM, AND IT ALREADY WAS AT HEAD.**
     *
     * `previewWalk`'s hit lands ONE TICK EARLY against the drive's — the
     * preview has no second pass, so `chasers.hit` runs at the press tick
     * where `applyThrust` runs at press+1. 12b named that skew and measured it
     * at ~0.22 px of one body's travel; ⚖ ruling 30(c)'s equality row asserts
     * the two agree on L6's 42-tick corridor, where 0.22 px never reaches a
     * held-set.
     *
     * ⛔ IT REACHES ONE ON A LONG STAND. Measured at THIS head and at
     * `f498381ca` alike, on L14's own boot: the sequences part at tick 207
     * with the roster-wide `allowDash: false`, and at 144 with `true`. So the
     * dash does NOT create the divergence — it brings it 63 ticks earlier,
     * because a dash moves the player and a moved player is chased
     * differently.
     *
     * ⇒ **12c′ inherits this**: ⚖ ruling 30(c) holds over a corridor's length,
     * not over a room's lifetime, and a re-priced walk longer than ~144 ticks
     * is certified against a preview the drive stops matching. NOT FIXED HERE:
     * the skew is named in `previewWalk` and this slice was told not to move
     * it. Recorded so the next slice cannot mistake it for its own.
     */
    it('⚠⚠ the preview/drive equality PARTS on a long stand — at 207 refused, 144 dashing', () => {
        expect(firstDiff(standBoth(l14, 260, false).preview,
            standBoth(l14, 260, false).drive)).toBe(207);
        expect(firstDiff(standBoth(l14, 260, true).preview,
            standBoth(l14, 260, true).drive)).toBe(144);
    });

    /**
     * ⛓ **THE FORECAST, ASKED IN ISOLATION.** The two-tick ageing is what (ii)
     * rests on and it is a pure function, so it gets a row that does not need
     * a room: a fresh state presses an ORDINARY SWING; the same state one tick
     * after a swing forecasts a DASH; and `SLASH_TIMER_MAX` ticks after it
     * forecasts an ordinary swing again, because a dash does NOT refresh the
     * timer (`plan-seedling-r9-l0-sword-dash`'s own discriminator).
     */
    it('⛓ `slashPressForecast` reproduces `r9-l0-sword-dash`\'s own schedule, from the state alone', () => {
        const gate = {
            hasSword: true, hasGhostSword: false, wanding: false, firing: false,
            deathRaying: false, spearing: false,
        };
        const fresh = { slashing: false, slashTimer: 0, slashDashed: false, anim: null };
        expect(slashPressForecast({ state: fresh, endsAt: null, gate },
            { tick: 0, ticksAhead: 1 }).outcome).toBe('slash');
        /**
         * ⛓ THE STATE A PRESS AT TICK 0 LEAVES: the timer at
         * `SLASH_TIMER_MAX`, the swing open, and `slashEnd` due on tick 5 —
         * `SLASH_ANIM_TICKS.slash`, which is the run's own `slashEndsAt`.
         */
        const swung = {
            slashing: true, slashTimer: ORDINARY_SWING_PERIOD, slashDashed: false,
            anim: 'slash',
        };
        // k = 2, `DASH_CHAIN`'s first dash — and k = 2 rather than 1 because
        // `Input.pressed` is a rising edge, which is the TAPE's constraint and
        // not this function's.
        const d = slashPressForecast({ state: swung, endsAt: 5, gate },
            { tick: 1, ticksAhead: 1, vx: 1, vy: 0 });
        expect(d.at).toBe(2);
        expect(d.outcome).toBe('dash');
        expect(d.impulse).toEqual({ dvx: SLASH_DASH_FORCE, dvy: 0 });
        expect(d.scale).toEqual({ x: 1.5, y: 0.65 });
        /**
         * ⛔⛔ THE DISCRIMINATOR, and it is the one claim only this tape can
         * make: a press a FULL WINDOW after the first is an ORDINARY SWING,
         * because the dash does not refresh `slashTimer` — only the `else if`
         * writes it. A model that thought otherwise would read a live window
         * here and dash, moving the player 2 px the game does not.
         *
         * ⛓ AND IT GOES THROUGH THE RELEASE. Ageing 19 whole ticks crosses
         * `endsAt`, so `slashEnd` fires inside the forecast and clears both
         * `slashing` and `slashDashed` — which is what lets the ordinary arm
         * be taken at all.
         */
        const late = slashPressForecast({ state: swung, endsAt: 5, gate },
            { tick: 1, ticksAhead: ORDINARY_SWING_PERIOD - 1, vx: 1, vy: 0 });
        expect(late.at).toBe(ORDINARY_SWING_PERIOD);
        expect(late.outcome).toBe('slash');
        expect(late.impulse).toBeNull();
        expect(late.scale).toEqual({ x: 1, y: 1 });
    });
});


/**
 * ⛓⛓⛓ R9 SLICE 12b′ — **THE DERIVED STANCE**, the kill rung's chaser arm.
 *
 * ⚠ NO IN-ANGER WITNESS, AND THAT IS SAID RATHER THAN HIDDEN. Slice 12b′ also
 * enforced `allowDash`, and with the dash refused L14's corridor certifies
 * WITH its opportunistic strikes — so the room now solves at rung 1 (⚖ ruling
 * 29(a)'s parry-walk, the user's PRIMARY) and never reaches this fallback. The
 * arm is therefore tested one layer in, by calling it on L14's own boot: a
 * real room, six real bobs, and every number below is what the forecast
 * measured there.
 */
describe('R9 slice 12b′: the DERIVED STANCE — scored, iterative, refuses by name', () => {
    const l14 = () => createLevelRun({
        levelSource, boot: { level: 14, x: 160, y: 64 }, noclip: false, noHazards: [],
        noDamage: false, grants: [], persistence: [], despawn: [], equips: [],
        pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
    });
    /** The ladder's own inputs, minus the aim — which on L14 is a teleporter
     *  tile the planner refuses, and the scan's condition 4 skips it there. */
    const derive = (id) => {
        const run = l14();
        const body = run.strikeBodies.find((b) => b.id === id);
        return { run, ...deriveKillByChaser(run, { ...body }, new Set(),
            { aim: null, allowTeleporter: null, tolerance: DEFAULT_TOLERANCE }) };
    };
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    /**
     * ⛔ MUTANT (a)'s ROW — "wherever the walk stands" against a DERIVED
     * stance, on the exact body that refused at slice 12b's head.
     *
     * `bob@32,32` is 127.1 px from L14's boot against an 80 px leash: it does
     * not chase from there, so the first cut's `{stance: run.state}` waited
     * for a body that was never coming. The derivation puts the player 16 px
     * from it — one lattice cell — and the body comes.
     */
    it('⛔ derives a stance for the body that CANNOT reach where the walk stands', () => {
        const { run, stance, why, ticks } = derive('bob@32,32');
        expect(stance).toEqual({ x: 40, y: 24 });
        expect(stance).not.toEqual({ x: run.state.x, y: run.state.y });

        const body = run.strikeBodies.find((b) => b.id === 'bob@32,32');
        const centre = {
            x: (body.rect.x + body.rect.right) / 2,
            y: (body.rect.y + body.rect.bottom) / 2,
        };
        const leash = ENEMY_CLASSES.bob.aggro.range;
        // OUT of leash from the walk — which is the whole refusal — and IN it
        // from the stance, which is the whole repair.
        expect(dist(run.state, centre)).toBeGreaterThan(leash);
        expect(dist(stance, centre)).toBeLessThanOrEqual(leash);
        expect(ticks).toBe(106);
        expect(why).toMatch(/dies at tick 234/);
    });

    /**
     * ⛔ MUTANT (b)'s ROW — THE DURATION, not the instant. `deriveBaitStance`'s
     * trap-154 lesson one rung up: a cell can be danger-free when the walk
     * arrives and lethal forty ticks later, because a chaser spends those
     * forty ticks walking. The refusal for `bob@64,64` carries both shapes of
     * failure by name, and the WAIT one is the duration condition biting.
     */
    it('⛔ refuses BY NAME with its three counts — and names the WAIT that goes bad', () => {
        const { stance, why } = derive('bob@64,64');
        expect(stance).toBeNull();
        expect(why).toMatch(/64 cell\(s\) inside its 80 px leash/);
        expect(why).toMatch(/49 of those reachable/);
        expect(why).toMatch(/49 of THOSE refused by the forecast/);
        // Both refusal shapes, and the first is the one a static-leash disc
        // could never produce.
        expect(why).toMatch(/the WAIT is dangerous at tick \d+ — chaser:bob@128,64/);
        expect(why).toMatch(/is still standing after the whole \d+-tick ceiling/);
        expect(why).toMatch(/trap 154/);
    });

    /**
     * ⛔ MUTANT (e)'s ROW — NOT FIRST-VIABLE. The scan's own order is
     * nearest-approach-first, so a first-viable pick would take the closest
     * qualifying cell. The score is soonest-kill-first, and on `bob@96,80`
     * they disagree: the winner is 57.7 px away and a runner-up is 35.8, i.e.
     * the nearer cell qualified and was passed over for a sooner kill.
     */
    it('⛓ takes the BEST stance, not the first viable one — and carries the runners-up', () => {
        const { run, stance, runnersUp, clears } = derive('bob@96,80');
        expect(stance).toEqual({ x: 120, y: 104 });
        expect(runnersUp.length).toBeGreaterThan(0);
        const nearer = runnersUp.filter((r) => dist(run.state, r) < dist(run.state, stance));
        expect(nearer.length).toBeGreaterThan(0);
        // …and every runner-up's kill is LATER, which is what the score says.
        for (const r of runnersUp) expect(r.deathAt).toBeGreaterThan(120 - 30);
        // ⛓ The record carries every body the wait removes, not only the one
        // asked for — the reason the NEXT climb finds a different room.
        expect(clears).toEqual(['bob@96,80', 'bob@128,64']);
    });

    /**
     * ⛔ THE BOUND IS MEASURED, NOT COMPUTED FROM A FORMULA. §23.10 named
     * `killWindowTicks(tag) * 3 + HOLD_SLACK`, which on a bob is 108 for every
     * body in every room — it has no term for how long the body takes to WALK
     * to the stance, and that term dominates. The four bounds this room
     * derives are 106, 148, 102 and 116: two above the formula and two below,
     * so the difference is not a margin anybody could have added.
     */
    it('⛔ the dwell bound is the forecast\'s own death tick, not a per-class constant', () => {
        const formula = killWindowTicks('bob') * 3 + 30;
        expect(formula).toBe(108);
        const bounds = {
            'bob@32,32': 106, 'bob@128,64': 148, 'bob@96,48': 102, 'bob@176,112': 116,
        };
        for (const [id, want] of Object.entries(bounds)) {
            expect(derive(id).ticks).toBe(want);
        }
        expect(Object.values(bounds).some((b) => b > formula)).toBe(true);
        expect(Object.values(bounds).some((b) => b < formula)).toBe(true);
    });

    /**
     * ⛔ MUTANT (g)'s ROW — THE TWO ORDERS DIFFER, AND THE CHOOSER'S HEAD DOES
     * NOT MOVE. `chooseBodyToRemove` orders by distance from the AIM and BAIT
     * and the ceiling arm read `[0]` of exactly that list; the chaser arm
     * re-reads it in INTERCEPT order. L14 is where the two disagree by the
     * whole room, so the row is not vacuous: aim-first is `bob@32,32` at the
     * exit, intercept-first is `bob@128,64`, the body the corridor probe met.
     */
    it('⛔ the chaser arm re-orders by INTERCEPT; the chooser\'s own head is untouched', () => {
        const run = l14();
        const aim = { x: 32, y: 64 };
        // The chooser's order, by its own rule: distance from the AIM, ties by id.
        const byAim = [...run.strikeBodies].map((b) => ({
            ...b,
            x: (b.rect.x + b.rect.right) / 2,
            y: (b.rect.y + b.rect.bottom) / 2,
        })).sort((a, b) => Math.hypot(a.x - aim.x, a.y - aim.y)
            - Math.hypot(b.x - aim.x, b.y - aim.y) || (a.id < b.id ? -1 : 1));
        expect(byAim[0].id).toBe('bob@32,32');

        // The corridor probe's own first danger on this room, verbatim from
        // the survey's committed refusal at slice 12b's head.
        const hit = { sources: [{ kind: 'chaser', id: 'bob@128,64' }] };
        const ordered = interceptOrder(byAim, hit);
        expect(ordered[0].id).toBe('bob@128,64');
        // ⛓ …and it is a RE-ORDER, not a filter: the same bodies, and the ones
        // the probe never named keep the chooser's order behind the one it did.
        expect(ordered.map((b) => b.id).sort()).toEqual(byAim.map((b) => b.id).sort());
        expect(ordered.slice(1).map((b) => b.id))
            .toEqual(byAim.filter((b) => b.id !== 'bob@128,64').map((b) => b.id));
        // The chooser's own head — what BAIT and the ceiling arm take — is
        // untouched by any of this.
        expect(byAim[0].id).toBe('bob@32,32');
    });
});
