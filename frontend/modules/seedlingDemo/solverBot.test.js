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
import { plannerObstacleAt, planWaypoints } from './botDriverV2.js';
import {
    LIVE_GEOMETRY_KEYS, ROLES, isNormalizedLiveOpts, normalizeLiveOpts, rect,
} from './levelWorld.js';
import { assertEscalationIsOrdered } from './r8Acceptance.js';
import {
    ESCALATION_LADDER,
    OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, STRATEGY_REFINEMENTS, SolverRefusal,
    FACING_KEYS, facingToward,
    deriveKillByChaser, interceptOrder,
    previewWalk, resolveKillStrategy, solveSegment, strikePolicyFor,
    ALLOW_DASH_ROSTER_WIDE, DASH_CHAIN_PATTERN, DASH_CHAIN_PREFIXES,
    PREVIEW_AGREEMENT_BOUND, planSwordDash,
} from './solverBot.js';
// ⛓ R9 slice 12b — ⚖ ruling 30(c)'s equality is between these two exact
// functions, so the row calls both rather than a stand-in for either.
import { drive, runDwell } from './botDriverV2.js';
// ⛓ R9 slice 12b′: the dash-refusal row builds BOTH arms of the policy, so it
// needs the constructor and the swing period the refusal is measured in.
import { createStrikePolicy } from './strikePolicy.js';
import {
    DASH_CHAIN, DASH_DISPLACEMENT, INITIAL_SLASH_STATE, ORDINARY_SWING_PERIOD,
    SLASH_DASH_FORCE, slashPressForecast,
} from './combatVerbs.js';
// ⛓ R9 slice 12c — the certification the `allowDash: true` arm is gated on.
// ⛓ R9 slice 12c″ — and the harmless-window arithmetic it now asks with.
import {
    CONTACT_READING_LAG, DASH_HARMLESS_TIMER, certifyDash, harmlessThroughDash,
    projectedHitsTimer, strikeCandidates,
} from './strikePolicy.js';
// ⛓ R9 slice 12c‴, ⚖ ruling 45(a) — the shake writers a room can reach without
// the player, DERIVED from the table rather than listed beside it.
import { BOSS_CLASS_SHAKE_WRITERS, SHAKE_WRITERS } from './camera.js';
import { killWindowTicks } from './chasers.js';
import { ENEMY_CLASSES, enemyHitPlayerFires, plannerContactFree } from './combat.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
// ⛓ R9 slice 12d″ — the touch lean is the responder OWN probe, so the row that
// measures it reads the same table `execTouch` reads.
import { RESPONDERS, opensOnTick, touchApproachKey } from './activators.js';
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
     * ⛓⛓⛓ R9 SLICE 12c′ — **THE TWO FLAG STATES NO LONGER DIFFER, AND THAT
     * IS THE RETIREMENT.**
     *
     * 12b′ enforced `allowDash: false` and this row measured the two arms
     * disagreeing on L14's own boot: permitted, the policy pressed at gaps
     * 19/2/2/2 and the run was HIT once; refused, it pressed at 20/20/39 and
     * was not. §27.7 then priced the permitted arm through the producer —
     * `r9-solve-14` 145 t → 400 t — and 12c′ RETIRED it. A body-gated press
     * that would dash is refused under BOTH states now, so the two arms spend
     * the same keys and the row asserts exactly that.
     *
     * ⛓ WHAT DIFFERS IS A **PLAN**. The third arm here is the same policy
     * handed `planSwordDash`'s schedule, and its presses land at
     * `DASH_CHAIN`'s own spacing — the swing, then its dashes — which no
     * body-gated arm can produce at all.
     *
     * ⛓ NON-VACUOUS, AND IT IS L14 THAT MAKES IT SO: every committed corridor
     * emits zero presses (§23.8), so no roster tape can distinguish any of
     * these arms.
     */
    it('⛓⛓ the two flag states spend the SAME keys — only a PLAN dashes', () => {
        const l14 = () => createLevelRun({
            levelSource, boot: { level: 14, x: 160, y: 64 }, noclip: false, noHazards: [],
            noDamage: false, grants: [], despawn: [], persistence: [], equips: [],
            pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        /**
         * ⛓⛓⛓ R9 SLICE 12c″ — **THE DASHING STAND'S HORIZON IS A MEASUREMENT
         * NOW, AND IT IS SHORTER THAN IT WAS.**
         *
         * A raw chain plan has no chooser and no corridor certification — it
         * presses every window the schedule names. Under 12c's blanket i-frame
         * refusal that walk stayed near its stance and took no hit in 260
         * ticks. Under ⚖ ruling 44's harmless window it dashes far more, and
         * the row below PINS where it stops being a valid subject: **0 hits
         * through 120, hit by 130**. The horizon is not a tuning knob, it is
         * that number minus a margin, and the pin is what stops it decaying
         * quietly (trap 574).
         */
        const DASHING_STAND_TICKS = 120;
        const standStill = (allowDash, dashPlan = null, withSlash = false,
            ticks = 260) => {
            const run = l14();
            const policy = createStrikePolicy({
                facingToward, facingKeys: FACING_KEYS, hasSword: true, allowDash, dashPlan,
            });
            const at = [];
            for (let t = 0; t < ticks; t += 1) {
                const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                    new Set(), withSlash ? { slash: run.slashInfo } : {});
                if (d.decision === 'press') at.push(run.ticksCompleted);
                run.advance(d.held);
            }
            return { run, policy, at, gaps: at.slice(1).map((v, i) => v - at[i]) };
        };

        const refused = standStill(false);
        const permitted = standStill(true);
        // ⛔ THE RETIREMENT, AS AN EQUALITY: the flag alone changes nothing.
        expect(permitted.at).toEqual(refused.at);
        expect(refused.gaps).toEqual([57, 34, 26, 20, 20, 39]);
        expect(Math.min(...refused.gaps)).toBeGreaterThanOrEqual(ORDINARY_SWING_PERIOD);
        expect(refused.run.playerHits).toHaveLength(0);
        expect(permitted.run.playerHits).toHaveLength(0);

        // ⛓ AND THE REFUSAL IS BY NAME ON BOTH SIDES, with the press it is
        // measured against and what was in reach — "no strike this tick" with
        // no reason is the shape a reader cannot audit.
        for (const arm of [refused, permitted]) {
            const rows = arm.policy.trace.filter((r) => r.dashRefused);
            expect(rows).toHaveLength(4);
            for (const r of rows) {
                expect(r.dashRefused.wouldPressAt - r.dashRefused.lastPressAt)
                    .toBeLessThan(ORDINARY_SWING_PERIOD);
                expect(r.dashRefused.inReach.length).toBeGreaterThan(0);
                expect(r.dashRefused.why).toMatch(/DASH/);
            }
        }

        // ⛓⛓ THE THIRD ARM: a PLAN, and its gaps are `DASH_CHAIN`'s own.
        const at = new Set();
        for (let base = 0; base < 300; base += ORDINARY_SWING_PERIOD) {
            for (const d of DASH_CHAIN_PATTERN) at.add(base + d);
        }
        const planned = standStill(true, { ticks: at, why: 'the row\'s own chain' }, true,
            DASHING_STAND_TICKS);
        expect(planned.gaps.slice(0, 8)).toEqual([2, 6, 6, 6, 2, 6, 6, 6]);
        expect(planned.policy.plannedPresses.filter((r) => r.dash).length).toBeGreaterThan(0);
        expect(planned.run.playerHits).toHaveLength(0);
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
    /**
     * ⛓⛓⛓ R9 SLICE 12c′ — **THE DASHES ARE SCHEDULED NOW, NOT OPPORTUNISTIC.**
     *
     * 12c's rows built `allowDash: true` and let the policy dash at whatever
     * body was in reach. §27.7 measured what that buys — `r9-solve-14` 145 t →
     * 400 t — and 12c′ RETIRED that arm: a body-gated press that would dash is
     * refused under both flag states, and what `true` permits is a press
     * `planSwordDash` SCHEDULED. So every row below that exercises the dash
     * model hands the policy a plan, and the claims are unchanged in substance:
     * the model steps the impulse, the policy knows what its press will do, the
     * certification bites, and the preview and the drive agree.
     *
     * ⛓ THE SCHEDULE IS `DASH_CHAIN`'s OWN, repeated — an ordinary swing to
     * open the window then its dashes, every `ORDINARY_SWING_PERIOD` ticks.
     * Nothing here is a hand-picked tick list.
     */
    const dashChainPlan = (ticks) => {
        const at = new Set();
        for (let base = 0; base < ticks; base += ORDINARY_SWING_PERIOD) {
            for (const d of DASH_CHAIN_PATTERN) at.add(base + d);
        }
        return { ticks: at, why: 'the fixture\'s own sustained chain' };
    };
    const policyFor = (allowDash, dashPlan = null) => createStrikePolicy({
        facingToward, facingKeys: FACING_KEYS, hasSword: true, allowDash, dashPlan,
    });
    const key = (h) => [...h].sort().join('+') || '-';
    /**
     * A STAND, driven by the arc's own two consumers. `wps: []` with a
     * `standFor` tail is `previewWalk`'s whole dwell; `runDwell` is the
     * driver's. Neither is a re-implementation of the other, which is the
     * only reason an equality between them says anything (⚖ ruling 30(c)).
     */
    const standBoth = (mk, ticks, allowDash, plan = null) => {
        const a = mk();
        const pa = policyFor(allowDash, plan);
        // ⛓ ONE TICK MORE THAN THE DRIVE, so `samples[ticks]` is the PRE-MOVE
        // box of tick `ticks + 1` — i.e. where the player stands after the
        // drive's own last tick, which is what the position claim compares.
        const pv = previewWalk(a, [], 0, { strike: pa, standFor: ticks + 1 });
        const b = mk();
        const perTick = [];
        const pb = policyFor(allowDash, plan);
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
    it('⛓⛓⛓ the PREVIEW and the DRIVE spend the same keys over a stand that DASHES — '
        + 'over the WHOLE STAND — the parting is CURED', () => {
        const r = standBoth(l14, 110, true, dashChainPlan(160));
        /**
         * ⛓⛓⛓⛓ **R9 SLICE 12c‴ — THIS ROW WAS AN EQUALITY WITH AN INDEX ON IT
         * AND IT IS AN EQUALITY AGAIN.**
         *
         * 12c″ left it parting at 79. ⚖ Ruling 44's harmless window is a
         * THRESHOLD on `hitsTimer` and the two sides read that value ONE TICK
         * APART, so one press per i-frame was spent by one side and yielded by
         * the other — a blanket refusal is skew-PROOF and a threshold is not
         * (trap 595). ⛔ THE GAME SETTLED WHICH SIDE WAS WRONG rather than the
         * model arguing with itself: `probe-seedling-r9-harmless-window-mobiles`
         * inverts a struck body's own `hits_timer` out of `botMobiles` and puts
         * the landed hit at PRESS + 1, three independent samples agreeing.
         *
         * ⛔⛔ AND THE CURE HAS TWO COMPONENTS, WHICH IS WHY THE NAIVE ONE
         * FAILED. (1) `previewWalk` steps `presses.swordWindowStep` — the same
         * function `advance` steps — in the run's own intra-tick order, so a
         * press fires at T+1..T+5 with the rect re-aimed each tick instead of
         * once at T. (2) its policy reading is taken from the forecast AS IT
         * STANDS after that window, not from the array `step` handed back
         * BEFORE it. Without (2) the parting went to 62 — WORSE than the
         * uncured 79, and exactly the number 12c″ measured for a one-tick
         * deferral. The second component is invisible to a held-set until a
         * threshold reads the value it moves.
         */
        expect(r.drive).toHaveLength(110);
        expect(firstDiff(r.preview, r.drive)).toBe(110);
        expect(r.preview.slice(0, 110)).toEqual(r.drive);
        // ⚠ AND NOT VACUOUSLY. A stand where nothing dashed would pass this
        // row with the `false` arm's own sequence.
        expect(r.pa.dashes).toBe(15);
        expect(r.pb.dashes).toBe(15);
        expect(r.pa.strikes).toBe(21);
        expect(r.pb.strikes).toBe(21);
        /**
         * ⛔⛔⛔ **AND THE PREVIEWED PLAYER ENDS ON THE DRIVEN ONE'S PIXEL** —
         * the half of ⚖ ruling 30(c) a held-set sequence cannot see, and the
         * sharpest statement of the cure there is. 12c″ measured 127.85 against
         * 99.75 at tick 110, twenty-eight pixels apart and a corridor about a
         * different journey. It is now the same number to the last digit.
         *
         * ⚠ MEASURED, NOT FORESEEN: mutant (a) — the preview stepper's
         * `dashImpulse` dropped — leaves this fixture's KEY sequence completely
         * intact, so the position is what makes the row bite (trap 570).
         */
        expect(r.at(110).x).toBe(r.run.state.x);
        expect(r.at(110).y).toBe(r.run.state.y);
        expect(r.at(110).x).toBeCloseTo(99.75, 2);
        // ⛓ AND THE STAND MOVED — the dashes carry the player off the stance
        // they started on, which is what makes the position half of this claim
        // a claim about a corridor rather than about a point.
        expect(r.run.state.x).not.toBeCloseTo(160, 1);
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
        const r = standBoth(l14, 110, true, dashChainPlan(160));
        const policyDashTicks = r.pb.trace
            .filter((t) => t.decision === 'press' && t.dash).map((t) => t.tick);
        const runDashTicks = r.run.dashes.map((d) => d.t);
        expect(runDashTicks).toEqual(policyDashTicks);
        // ⛓ R9 slice 12c″ — 19 over 130 ticks became 15 over 110: the horizon
        // moved (the stand is only a valid subject to 120 now), not the claim.
        expect(policyDashTicks).toHaveLength(15);
        // ⛓ AND THE SCHEDULE IS `DASH_CHAIN`'s, not a list somebody typed:
        // the first window's dashes land at its own offsets.
        expect(policyDashTicks.slice(0, 3)).toEqual(DASH_CHAIN_PATTERN.slice(1));
    });

    /**
     * ⛔⛔ **A POLICY WITH A PLAN AND NO SLASH STATE PRESSES NOTHING**, and
     * that inverts 12b's own finding rather than dropping it.
     *
     * 12b's policy dashed WITHOUT KNOWING IT: withhold the slash state and it
     * could not tell a swing from a dash, so it pressed anyway and the RUN
     * dashed three times and took a hit at t=252 — `set slashing`'s dash
     * branch has no `!slashing` term. That is why 12b′ enforced `allowDash`
     * OFF.
     *
     * ⛔ 12c′ CLOSES IT FROM THE OTHER SIDE. The PLANNED arm requires the
     * slash state by construction — it is what `slashPressForecast` ages — and
     * the body-gated arm refuses any press that could dash. So a policy handed
     * a schedule and denied the state to model it takes **no press at all**:
     * zero planned presses, zero dashes in the run, zero hits. A model that
     * cannot see what its press will do does not get to press.
     */
    it('⛔⛔ a PLAN with no slash state presses NOTHING — a blind dash is impossible now', () => {
        const run = l14();
        const policy = policyFor(true, dashChainPlan(300));
        for (let t = 0; t < 260; t += 1) {
            // ⚠ NO `slash` KEY — 12b's own call, verbatim.
            const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted, new Set());
            run.advance(d.held);
        }
        expect(policy.plannedPresses).toHaveLength(0);
        expect(policy.dashes).toBe(0);
        expect(run.dashes.length).toBe(0);
        expect(run.playerHits).toHaveLength(0);
    });

    /**
     * ⛔⛔⛔ **THE SAFETY ROW** (⚖ ruling 35). Same stance, same bound, same
     * `allowDash: true` — the only difference is that the policy can now see
     * what its press will do and CERTIFY the ground the dash adds.
     *
     * ⛓ THE DIRECTION IS THE FINDING, AND §23b.3 GOT IT HALF RIGHT. 12b′
     * recorded "dashes are safer at the forecast stance, more dangerous at the
     * boot" and concluded the sign is not uniform. It is not — but the cure is
     * not to pick a side: a MODELLED dash is safe at BOTH.
     *
     * ⛔⛔ **AND MUTANT (c) SAYS WHICH HALF DID IT, WHICH IS NOT THE HALF I
     * PREDICTED** (trap 570). I predicted that removing the certification term
     * would bring the t=252 hit back. IT DOES NOT: with the certification gone
     * but the FORECAST kept, this fixture takes 3 dashes and STILL ZERO HITS.
     * The hit is removed by (ii) — the policy knowing which rect its press
     * swings and declining to spend an aim tick on a `gated`/`swallowed` one —
     * and NOT by the certification.
     *
     * ⇒ what the certification is measured to contribute here is WHICH dashes
     * are taken (4 against 3), the swallowed census (20 against 16), and the
     * tick the preview/drive equality parts (144 against 116). On §23b.3's
     * stance its contribution is sharper still: without it that walk drifts
     * into a state the RUN ITSELF refuses to step, `bob@32,32`'s on-screen
     * answer at tick 101 depending on where inside `Game.shake`'s jiggle the
     * camera landed. A dash the certification would have refused walks the
     * player somewhere the model cannot answer about at all.
     */
    it('⛔⛔ a PLANNED dash chain takes L14\'s boot to ZERO hits THROUGH 120 — and is HIT '
        + 'by 130, which is the horizon this slice measured', () => {
        const stand = (ticks) => {
            const run = l14();
            const policy = policyFor(true, dashChainPlan(ticks + 40));
            for (let t = 0; t < ticks; t += 1) {
                const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                    new Set(), { slash: run.slashInfo });
                run.advance(d.held);
            }
            return { run, policy };
        };
        const r = stand(120);
        expect(r.run.playerHits).toHaveLength(0);
        /**
         * ⛔⛔⛔ **R9 SLICE 12c″ — THE ZERO IS BOUNDED NOW, AND THE BOUND IS
         * PINNED RATHER THAN CHOSEN.** 12c′ ran this stand for 260 ticks and
         * took no hit, under a policy that refused every dash near a body it
         * had just struck. ⚖ Ruling 44 says the game does not: a struck body
         * cannot damage for its whole 30-tick i-frame, so those dashes are
         * certified and the walk goes much further. This fixture has NO
         * chooser and NO corridor certification — it presses every window the
         * schedule names — so it eventually walks into a body whose window has
         * CLOSED. Measured: clean through 120, hit by 130.
         *
         * ⚠ THIS IS NOT THE PLANNER'S BEHAVIOUR and must not be read as it.
         * `planSwordDash` certifies each candidate corridor through
         * `probeSamples` and takes only windows that shorten the walk. What
         * the pin says is that a RAW schedule is a valid subject only inside
         * this horizon — which is why the rows above stand at 110 and 120.
         */
        expect(stand(130).run.playerHits).toHaveLength(1);
        // ⛓ NOT BY REFUSING EVERYTHING. A certification that never certified
        // would also report zero hits, and would be a rename of `false`.
        expect(r.policy.dashes).toBe(16);
        expect(r.run.dashes.length).toBe(16);
        expect(r.policy.plannedPresses).toHaveLength(21);
        // ⛓ AND IT YIELDED BY NAME where the ground could not be priced —
        // ⚖ ruling 35's safety half, on a schedule rather than on an
        // opportunity.
        const yielded = r.policy.plannedSkipped;
        expect(yielded).toHaveLength(2);
        for (const row of yielded) expect(row.plannedSkipped.why).toMatch(/NOT CERTIFIED/);
        // ⛓ …and the BODY-GATED arm still refuses every dash it is offered,
        // which is the retirement being non-vacuous on the same fixture.
        expect(r.policy.dashRefusals).toHaveLength(11);
        for (const row of r.policy.dashRefusals) {
            expect(row.dashRefused.opportunistic).toBe(true);
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
     * t=169 here.
     *
     * ⛔⛔ **R9 SLICE 12c″ — AND THIS STAND IS NO LONGER 0-HIT EITHER.** 12c′
     * measured 53 dashes and zero hits over 400 ticks; with ⚖ ruling 44's
     * harmless window it takes 44 dashes and is hit ONCE. Fewer dashes and a
     * hit is not a contradiction: the arm certifies dashes 12c refused, the
     * walk therefore goes somewhere else entirely, and 400 ticks of a raw
     * chain plan with no corridor certification is long enough to meet a body
     * whose i-frame has CLOSED. `certifyDash` prices the eight ticks the
     * impulse is live; nothing in a schedule without a chooser prices the
     * thirty after it. Recorded as the measurement it is — the row's own claim
     * (the certification is not a blanket refusal wearing a `why`) is what it
     * still proves.
     */
    it('⛓ …and at §23b.3\'s stance the certification still TAKES dashes — it is not a blanket '
        + 'no, and the stand is HIT ONCE in 400 ticks', () => {
        const run = stance();
        expect({ x: run.state.x, y: run.state.y }).toEqual({ x: 88, y: 72 });
        const policy = policyFor(true, dashChainPlan(430));
        for (let t = 0; t < 400; t += 1) {
            const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                new Set(), { slash: run.slashInfo });
            run.advance(d.held);
        }
        expect(policy.dashes).toBe(44);
        expect(run.dashes.length).toBe(44);
        expect(policy.plannedPresses).toHaveLength(62);
        expect(policy.plannedSkipped).toHaveLength(15);
        expect(run.playerHits).toHaveLength(1);
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
        const policy = policyFor(true, dashChainPlan(160));
        // ⛓ R9 slice 12c″ — 120 ticks, not 400: past ~120 a raw chain plan on
        // this boot walks into a body whose i-frame has closed (the pin above),
        // and a census taken past that is a census of a stand nobody would
        // drive. The branch is still reached fifty-odd times.
        for (let t = 0; t < 120; t += 1) {
            const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                new Set(), { slash: run.slashInfo });
            run.advance(d.held);
        }
        const swallowed = policy.trace.filter((r) => r.pressWouldBe === 'swallowed');
        // ⛓ NON-VACUOUS: the branch is reached, and reached often.
        expect(swallowed.length).toBe(64);
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
     * ⛓⛓⛓ **THE ROW THAT TIES (ii) TO (iii).** The `slashRepeats` replacement
     * is a claim about two presses inside `SLASH_HIT_TICKS`; whether the
     * POLICY can ever produce such a pair is a different question, and it is
     * answered here rather than assumed either way.
     *
     * ⛓ AT `false` IT CANNOT, and that is 12b′'s enforcement: every press is
     * at least `ORDINARY_SWING_PERIOD` after the last, which refuses a pair
     * inside 5 a fortiori.
     *
     * ⛓ AT `true` IT PRESSES INSIDE THE SWING WINDOW — that is the whole
     * point of the dash — so the mechanism the replacement repairs is LIVE for
     * the policy.
     *
     * ⚠ **AND ON THESE TWO FIXTURES IT STILL DOES NOT REACH THE DOUBLE-COUNT,
     * MEASURED**: the tightest pair either produces is exactly
     * `SLASH_HIT_TICKS` apart, which lands the tick AFTER the last repeat. The
     * reason is the certification: my own press's hit arms a 30-tick i-frame
     * on the body it landed on, and a body inside its i-frame makes the next
     * dash unpriceable. A press that MISSES leaves the timer at 0, which is
     * why 5 is reachable at all.
     *
     * ⇒ the replacement's own witness is a DRIVEN TAPE, not a policy walk —
     * `levelRun.test.js`'s `DASH_CHAIN` fixture, whose first two presses are
     * two ticks apart. Said here so a reader does not take these two fixtures
     * as coverage of (iii).
     */
    it('⛓⛓ a PLAN presses INSIDE the swing window; neither flag state alone can', () => {
        const gapsFor = (mk, ticks, allowDash, dashPlan = null) => {
            const run = mk();
            const policy = policyFor(allowDash, dashPlan);
            const at = [];
            for (let t = 0; t < ticks; t += 1) {
                const d = policy.decide(run.state, run.strikeBodies, run.ticksCompleted,
                    new Set(), { slash: run.slashInfo });
                if (d.decision === 'press') at.push(run.ticksCompleted);
                run.advance(d.held);
            }
            return at.slice(1).map((v, i) => v - at[i]);
        };
        // ⛔ BOTH FLAG STATES, and neither reaches the window: the
        // opportunistic dash is retired, so `true` alone spends `false`'s keys.
        for (const allowDash of [false, true]) {
            const gaps = gapsFor(l14, 260, allowDash);
            expect(Math.min(...gaps)).toBeGreaterThanOrEqual(ORDINARY_SWING_PERIOD);
        }
        // ⛓⛓ A PLAN reaches it, and that is the only thing that does now.
        // ⛓ R9 slice 12c″ — 120, the measured horizon of a raw chain plan on
        // this boot (see the pin above); the gap claim is about the SCHEDULE
        // and needs no more ticks than the schedule's own period.
        const dashing = gapsFor(l14, 120, true, dashChainPlan(160));
        expect(dashing.filter((g) => g < ORDINARY_SWING_PERIOD).length).toBeGreaterThan(0);
        // ⚠ …and never inside the REPEAT window: the schedule is
        // `DASH_CHAIN`'s own, which is derived under the rule that
        // `slashEnd` fires BELOW the press, so a press on the animation's
        // last tick would be swallowed.
        expect(Math.min(...dashing)).toBe(2);
        expect(Math.min(...gapsFor(stance, 400, true, dashChainPlan(430)))).toBe(2);
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
     * ⛓⛓⛓ R9 SLICE 12c″, ⚖ RULING 44 — **A KNOCKED BODY IS THE SAFEST THING
     * IN THE ROOM, AND 12c PRICED IT AS THE MOST DANGEROUS.**
     *
     * ⛔ THIS ROW IS A REWRITE AND THE OLD CLAIM IS THE DEFECT. 12c asserted
     * that `hitsTimer: 12` made the dash UNPRICEABLE — true of the ENVELOPE
     * (a knocked chase takes the `pushed` branch and its step bound is not
     * `moveSpeed`) and false of the QUESTION, because `Enemy.hitPlayer`
     * (`Enemies/Enemy.as:211`) gates the player-damaging contact on the
     * ENEMY's own `hitsTimer` and the player is not blocked by one either
     * (`"Enemy"` is not in `Mobile.solids`). Where the body MOVES stops
     * mattering when it cannot damage from anywhere it lands. §28.6's
     * "the strike and the dash compete for the same room" was a fact about
     * that arithmetic, never about the game.
     */
    it('⛓⛓ a body inside an i-frame that COVERS the dash is CONTACT-FREE — certified, '
        + 'and the row quotes the predicate that said so', () => {
        const run = l14();
        const knocked = run.strikeBodies.map((b, i) => (i === 0
            ? { ...b, hitsTimer: DASH_HARMLESS_TIMER } : b));
        const v = certifyDash(run.state, knocked, { dvx: -SLASH_DASH_FORCE, dvy: 0 });
        expect(v.certified).toBe(true);
        // ⛓ NOT "it certified" — WHICH body was skipped and on whose authority.
        expect(v.contactFree).toEqual([{ id: knocked[0].id,
            hitsTimer: DASH_HARMLESS_TIMER, refusedAt: 'enemy hitsTimer' }]);
    });

    /**
     * ⛔⛔ **THE THRESHOLD IS ASSERTED FROM BOTH SIDES, BECAUSE A BOOLEAN
     * SITTING ON ITS OWN BOUND IS NOT A DISCRIMINATOR** (trap 588). One tick
     * below the derived reading the window does NOT cover the path and the
     * dash is refused; at it, certified. And the number is `DASH_DISPLACEMENT`
     * and the two lags, not a 10 typed beside a comment.
     */
    it('⛔ the harmless reading is EXACTLY `DASH_HARMLESS_TIMER` — one below it refuses', () => {
        expect(DASH_HARMLESS_TIMER).toBe(DASH_DISPLACEMENT.ticks + CONTACT_READING_LAG + 1);
        expect(projectedHitsTimer(DASH_HARMLESS_TIMER, DASH_DISPLACEMENT.ticks - 1))
            .toBeGreaterThan(0);
        expect(projectedHitsTimer(DASH_HARMLESS_TIMER - 1, DASH_DISPLACEMENT.ticks - 1))
            .toBe(0);
        const run = l14();
        const at = (t) => certifyDash(run.state,
            run.strikeBodies.map((b, i) => (i === 0 ? { ...b, hitsTimer: t } : b)),
            { dvx: -SLASH_DASH_FORCE, dvy: 0 });
        expect(at(DASH_HARMLESS_TIMER).certified).toBe(true);
        const under = at(DASH_HARMLESS_TIMER - 1);
        expect(under.certified).toBe(false);
        expect(under.why).toMatch(/EXPIRES MID-DASH/);
        expect(under.why).toMatch(
            new RegExp(`offset ${DASH_DISPLACEMENT.ticks - 1} of ${DASH_DISPLACEMENT.ticks}`));
    });

    /**
     * ⛔⛔⛔ **A WINDOW THAT EXPIRES MID-DASH IS REFUSED, AND IT NAMES THE
     * OFFSET IT REFUSES FROM.** The body is harmless up to `firesAt` and
     * dangerous after it, and pricing the remainder needs its POSITION at
     * those offsets — which neither side of ⚖ ruling 30(c) holds (trap 567).
     * ⇒ the refusal is narrow now instead of wide, and it is a MECHANISM
     * rather than a verdict.
     */
    it('⛔ `hitsTimer` 3 against an 8-tick window refuses AT THE EXPIRY OFFSET', () => {
        const run = l14();
        const short = run.strikeBodies.map((b, i) => (i === 0 ? { ...b, hitsTimer: 3 } : b));
        const v = certifyDash(run.state, short, { dvx: -SLASH_DASH_FORCE, dvy: 0 });
        expect(v.certified).toBe(false);
        expect(v.why).toMatch(/EXPIRES MID-DASH/);
        // 3 - (LAG + 1 + j) > 0 fails first at j = 1.
        expect(harmlessThroughDash({ hitsTimer: 3 })).toEqual(
            { coversWindow: false, firesAt: 1, refusedAt: 'enemy hitsTimer' });
        expect(v.why).toMatch(new RegExp(`offset 1 of ${DASH_DISPLACEMENT.ticks}`));
    });

    /**
     * ⛔⛔ **WHICH PREDICATE IS CONSULTED — THE ROW A RE-SPELLING CANNOT
     * PASS** (⚖ ruling 17, trap 566). A body playing its death animation has
     * `hitsTimer` 0 and cannot damage: `Enemy.hitPlayer`'s gate is
     * `!destroy && currentAnim != "die" && hitsTimer <= 0`, three terms, and a
     * local `hitsTimer > 0` sees only one of them. So a dying body is
     * CONTACT-FREE for the whole window on the strength of a term the timer
     * knows nothing about.
     */
    it('⛔⛔ a DYING body with `hitsTimer` 0 is contact-free — the `die anim` term, not '
        + 'the timer', () => {
        const run = l14();
        const dying = run.strikeBodies.map((b, i) => (i === 0
            ? { ...b, hitsTimer: 0, dying: true } : b));
        const v = certifyDash(run.state, dying, { dvx: -SLASH_DASH_FORCE, dvy: 0 });
        expect(v.contactFree).toEqual([{ id: dying[0].id, hitsTimer: 0,
            refusedAt: 'die anim' }]);
        expect(harmlessThroughDash({ hitsTimer: 0, destroy: true }))
            .toEqual({ coversWindow: true, firesAt: null, refusedAt: 'destroy' });
    });

    /**
     * ⛔⛔⛔ **THE WRAPPER'S ONE DELIBERATE DISAGREEMENT WITH THE PREDICATE IT
     * WRAPS**, and it is the whole of design point (ii).
     *
     * `enemyHitPlayerFires` answers `fires: false` for an UNCERTAIN on-screen
     * verdict, because a verdict the run cannot compute is one it must not act
     * on. In PLANNING the same answer read as safety would certify a corridor
     * the drive refuses to step at all (12c′'s trap 592: the drive threw at
     * L14 tick 73 over exactly this). So `contactFree` must be FALSE where
     * `fires` is false — the two functions disagree here on purpose.
     *
     * ⚠ **NOT A REACH CLAIM** (trap 568): `chaserForecast` THROWS on an
     * uncertain verdict before any body reaches the policy, so today neither
     * call site can be handed one. This is a CONTRACT row, and the day a
     * caller with a camera appears it is what stops the optimistic reading.
     */
    it('⛔⛔ `uncertain` and `off` price as DANGER — where `enemyHitPlayerFires` says '
        + '"does not fire"', () => {
        const body = { hitsTimer: 0, destroy: false, dying: false };
        for (const verdict of ['uncertain', 'off']) {
            expect(enemyHitPlayerFires(body, verdict).fires).toBe(false);
            expect(plannerContactFree(body, verdict).contactFree).toBe(false);
        }
        // ⛓ AND THE VERDICT IS REQUIRED — a default is how the optimistic
        // reading gets in silently.
        expect(() => plannerContactFree(body)).toThrow(/is not an on-screen verdict/);
        expect(() => plannerContactFree(body, 'yes')).toThrow(/REQUIRED rather than/);
    });

    /**
     * ⛓⛓⛓ **THE READING LAG, CALIBRATED AGAINST THE PREVIEW ITSELF** rather
     * than argued from `previewWalk`'s comments (trap 566: a warning quoted in
     * a header is not a check).
     *
     * `projectedHitsTimer` rests on ONE fact that is not arithmetic: the
     * policy is handed the bodies the PREVIOUS forecast step returned. A stub
     * policy records what it was actually handed, and the samples carry what
     * the forecast actually returned — so the claim is checked against the two
     * streams it is about, tick by tick.
     */
    it('⛓⛓ the policy is handed the bodies of tick `t - CONTACT_READING_LAG`, measured', () => {
        const run = l14();
        const handed = [];
        const stub = {
            decide(state, bodies, tick, walkHeld) {
                handed.push(bodies.map((b) => `${b.id}@${b.hitsTimer}`));
                return { held: walkHeld, decision: 'none' };
            },
        };
        const walk = previewWalk(run, [{ x: run.state.x, y: run.state.y - 48 }], 0,
            { strike: stub });
        expect(walk.samples.length).toBeGreaterThan(12);
        const returned = walk.samples.map((s) =>
            (s.chasers ?? []).map((b) => `${b.id}@${b.hitsTimer}`));
        expect(handed).toHaveLength(walk.samples.length);
        for (let i = CONTACT_READING_LAG; i < handed.length; i += 1) {
            expect(handed[i]).toEqual(returned[i - CONTACT_READING_LAG]);
        }
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
    it('⛓⛓⛓⛓ R9 slice 12c‴: the KEYS no longer part at all — 207 → the whole stand '
        + 'refused, 79 → the whole stand dashing — and the BOUND is what the BODIES '
        + 'still measure', () => {
        const refusedPair = standBoth(l14, 260, false);
        const refused = firstDiff(refusedPair.preview, refusedPair.drive);
        const dashPair = standBoth(l14, 120, true, dashChainPlan(170));
        const dashing = firstDiff(dashPair.preview, dashPair.drive);
        /**
         * ⛓⛓⛓ **THE CURE, MEASURED.** `previewWalk` steps
         * `presses.swordWindowStep` — the same function `levelRun.advance` steps
         * — in the run's own intra-tick order, and takes its policy reading from
         * the forecast AS IT STANDS after that window. ⛔ THE GAME SETTLED WHICH
         * SIDE WAS WRONG: `probe-seedling-r9-harmless-window-mobiles.mjs`
         * inverts a struck body's `hits_timer` out of `botMobiles` and puts the
         * landed hit at PRESS + 1, three samples agreeing.
         *
         * ⛔ THE CURE IS THE ORDER AND THE REPEATS, NOT A LAG. 12c″ measured a
         * scratch build that merely DEFERRED the single previewed hit by one
         * tick and it was WORSE — the parting fell 79 → 62. Mutant (e) is that
         * shape from the other side: move the window BELOW the player's step and
         * this row returns to a parting inside the fixture.
         *
         * ⚠ `-1` IS THE ANSWER, not a large number: `firstDiff` returns it when
         * the two sequences agree for their whole common length. The preview is
         * one sample longer by construction (`standFor: ticks + 1`), so the
         * common length IS the drive's stand.
         */
        expect(refusedPair.drive).toHaveLength(260);
        expect(refused).toBe(260);
        expect(dashPair.drive).toHaveLength(120);
        expect(dashing).toBe(120);
        /**
         * ⛔⛔ **AND A SECOND STREAM STILL PARTS, BY A DIFFERENT MECHANISM** —
         * which is why the constant is re-derived rather than retired. The
         * bodies the POLICY is handed first differ at 195, and the difference is
         * a DEATH REMOVAL (`bob@128,64`, killed at tick 169, leaves the drive's
         * roster one tick before it leaves the preview's), not the hit skew. It
         * changes no key here; a body list is what the next scan reads, so it
         * could elsewhere.
         */
        const handed = { preview: [], drive: [] };
        const recorded = (side) => {
            const inner = policyFor(false);
            return {
                get trace() { return inner.trace; },
                get strikes() { return inner.strikes; },
                get dashes() { return inner.dashes; },
                get dashRefusals() { return inner.dashRefusals; },
                get plannedPresses() { return inner.plannedPresses; },
                get plannedSkipped() { return inner.plannedSkipped; },
                get allowDash() { return inner.allowDash; },
                get lastPressAt() { return inner.lastPressAt; },
                get aimed() { return inner.aimed; },
                decide(state, bodies, tick, walkHeld, opts) {
                    handed[side].push(bodies.map((b) => `${b.id}@${b.hitsTimer}`).sort().join(' '));
                    return inner.decide(state, bodies, tick, walkHeld, opts);
                },
            };
        };
        const pa = recorded('preview');
        previewWalk(l14(), [], 0, { strike: pa, standFor: 261 });
        const pb = recorded('drive');
        runDwell(l14(), [], {
            ticks: 260, strike: pb, why: 'the bound\'s own fixture',
            until: { why: 'the stand has run', test: (r) => r.ticksCompleted >= 260 },
        }, 'the bound\'s own fixture');
        const bodiesPart = firstDiff(handed.preview, handed.drive);
        expect(bodiesPart).toBe(195);
        /**
         * ⛔⛔ **THE BOUND IS PINNED TO A MEASUREMENT, NOT TYPED BESIDE ONE**
         * (trap 574). It is at or below the earliest divergence of ANY stream
         * these fixtures measure, so a model change that brings one down reds
         * this row rather than quietly loosening a filter nobody re-measured.
         */
        expect(PREVIEW_AGREEMENT_BOUND).toBe(bodiesPart);
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
        // ⛓ R9 slice 12c‴ — (40,24) at 12c′'s head, (56,40) at 12c″'s.
        // ⚖ Ruling 44's harmless window opened corridors this rung used to
        // price as danger and 12c‴'s cured preview re-scored them again, so the
        // SCORE picks a different cell; the claim below — out of leash from
        // the walk, inside it from the stance — is what the row is about and
        // is untouched.
        expect(stance).toEqual({ x: 40, y: 56 });
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
        // ⛓ R9 slice 12c‴ — 109/202 at 12c″'s head; the cured preview re-scored
        // the scan and the stance moved with it (see the note above).
        expect(ticks).toBe(115);
        expect(why).toMatch(/dies at tick 193/);
    });

    /**
     * ⛔ MUTANT (b)'s ROW — THE DURATION, not the instant. `deriveBaitStance`'s
     * trap-154 lesson one rung up: a cell can be danger-free when the walk
     * arrives and lethal forty ticks later, because a chaser spends those
     * forty ticks walking.
     *
     * ⛓⛓⛓ **R9 SLICE 12c″ — AND THIS REFUSAL IS RETIRED, WHICH IS THE
     * MEASUREMENT AND NOT A REGRESSION.** At 12c′'s head `bob@64,64` refused
     * by name: 64 cells inside its leash, 49 reachable, **49 of those 49
     * refused by the forecast**, the WAIT going bad at a tick with
     * `chaser:bob@128,64` on it. ⚖ Ruling 44 says the forecast was wrong about
     * that: `Enemy.hitPlayer` gates the contact on the ENEMY's own
     * `hitsTimer`, and the rung's own presses put those bodies inside their
     * i-frames, so the map was pricing the safest window in the game as
     * danger. With the harmless arm the derivation SUCCEEDS — and every one of
     * L14's six bodies now derives a stance where five did before.
     *
     * ⚠ THE ROW KEEPS ITS TEETH by asserting the whole shape it used to
     * refuse on: the stance, its leash arithmetic, the death it waits for, and
     * that NO body reaches the player at any sample of either half — which is
     * the same forecast that used to say the opposite.
     */
    it('⛓⛓ the WAIT refusal for `bob@64,64` is RETIRED by the harmless window — it derives '
        + 'a stance now, and says why', () => {
        const { run, stance, why, ticks } = derive('bob@64,64');
        // ⛓ R9 slice 12c‴ — (56,88)/115/182 at 12c″'s head. The cured preview
        // re-scored the scan; the CLAIM is the shape below, not the cell.
        expect(stance).toEqual({ x: 72, y: 88 });
        expect(ticks).toBe(109);
        expect(why).toMatch(/16.0 px away, inside its 80 px leash, so it CHASES/);
        expect(why).toMatch(/dies at tick 170/);
        expect(why).toMatch(/NO body reaches the player at any tick of either half/);
        // ⛓ AND IT IS THE SAME BODY THAT REFUSED: out of press reach from the
        // walk, which is why a stance was needed at all.
        const body = run.strikeBodies.find((b) => b.id === 'bob@64,64');
        const centre = {
            x: (body.rect.x + body.rect.right) / 2,
            y: (body.rect.y + body.rect.bottom) / 2,
        };
        expect(dist(run.state, centre)).toBeGreaterThan(dist(stance, centre));
    });

    /**
     * ⛔ MUTANT (e)'s ROW — NOT FIRST-VIABLE. The scan's own order is
     * nearest-approach-first, so a first-viable pick would take the closest
     * qualifying cell. The score is soonest-kill-first, and where they disagree
     * the winner is FARTHER than a cell that also qualified.
     *
     * ⛓⛓ **R9 SLICE 12c‴ MOVED THE SUBJECT, AND SAYING WHY IS THE POINT.**
     * This row asked `bob@96,80` for four slices. With the preview cured the
     * winner on THAT body is also the nearest of its candidates — zero nearer
     * runners-up — so the row would have gone on passing while demonstrating
     * NOTHING, which is the vacuity trap 570 is about from the other side. It is
     * re-pointed at `bob@176,112`, where the disagreement is now sharpest and
     * MEASURED: the winner is 48.0 px away and ALL THREE runners-up are nearer
     * (32.0, 35.8, 45.3). The claim is unchanged; the witness moved because the
     * measurement moved.
     */
    it('⛓ takes the BEST stance, not the first viable one — and carries the runners-up', () => {
        const { run, stance, runnersUp, clears, ticks } = derive('bob@176,112');
        expect(stance).toEqual({ x: 168, y: 120 });
        expect(runnersUp.length).toBeGreaterThan(0);
        const nearer = runnersUp.filter((r) => dist(run.state, r) < dist(run.state, stance));
        // ⛔ EVERY runner-up is nearer, so a first-viable pick could not have
        // produced this winner under any tie-break.
        expect(nearer.length).toBe(runnersUp.length);
        // …and every runner-up's kill is LATER than the winner's whole dwell,
        // which is what the score says and what a distance order cannot.
        for (const r of runnersUp) expect(r.deathAt).toBeGreaterThan(ticks);
        // ⛓ The record carries every body the wait removes, not only the one
        // asked for — the reason the NEXT climb finds a different room. Here it
        // is exactly the one, which is itself a measurement: this stance's wait
        // clears nothing else.
        expect(clears).toEqual(['bob@176,112']);
    });

    /**
     * ⛔ THE BOUND IS MEASURED, NOT COMPUTED FROM A FORMULA. §23.10 named
     * `killWindowTicks(tag) * 3 + HOLD_SLACK`, which on a bob is 108 for every
     * body in every room — it has no term for how long the body takes to WALK
     * to the stance, and that term dominates. The four bounds this room
     * derives are 109, 148, 102 and 116: two above the formula and two below,
     * so the difference is not a margin anybody could have added. ⛓ R9 slice
     * 12c″ moved exactly ONE of the four (106 → 109, `bob@32,32`, whose stance
     * the harmless window re-scored); the other three are unmoved, which is
     * what says the bound is the forecast's and not a constant.
     */
    it('⛔ the dwell bound is the forecast\'s own death tick, not a per-class constant', () => {
        const formula = killWindowTicks('bob') * 3 + 30;
        expect(formula).toBe(108);
        // ⛓ R9 slice 12c‴ — 109/148/102/116 at 12c″'s head; the cured preview
        // re-scored every one of them. THREE are above the formula and one is
        // below, so the difference is still not a margin anybody could have
        // added — which is the row's actual claim.
        const bounds = {
            'bob@32,32': 115, 'bob@128,64': 126, 'bob@96,48': 105, 'bob@176,112': 120,
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

/**
 * ⛓⛓⛓ R9 SLICE 12c′ — **`planSwordDash`: A PRESS TAKEN AS A MOVE.**
 *
 * ⚖ Ruling 35, the user's own: *"Safety is a higher priority than speed, but I
 * would still like the solver to dash to save time whenever there isn't a
 * reason not to."* §27.7 measured what the FLAG alone buys — `r9-solve-14`
 * 145 t → 400 t — so the flag is not the answer; the CHOOSER is. These rows
 * are the chooser.
 */
describe('R9 slice 12c′: the PLANNER dashes toward the exit', () => {
    const tapeOf = (name) => parseTape(JSON.parse(readFileSync(
        join(TAPES, `${name}.json`), 'utf8')));
    const runOf = (name) => {
        const t = tapeOf(name);
        return createLevelRun({
            levelSource, boot: t.boot, noclip: false, noHazards: [], noDamage: false,
            grants: [], despawn: [], persistence: t.persistence, equips: t.equips,
            pins: t.pins ?? [], save: t.save ?? null, rng: t.rng ?? null,
            seam: t.seam ?? null, roles: ROLES,
        });
    };

    /**
     * ⛓⛓⛓ **THE POSITIVE WITNESS, ON A COMMITTED ARTIFACT.** `r9-solve-2`'s
     * own boot, its own room, its own exit: the committed walk takes 47 ticks
     * and a single dash window takes it in 23 — **2.04×**, which is §23.11's
     * measured 2.15× distance-per-tick arriving where it was predicted to.
     *
     * ⛔ NOTHING HERE IS HAND-PICKED: the boot is the committed tape's, the
     * corridor is `planWaypoints`' own, and the schedule is `DASH_CHAIN`'s.
     */
    it('⛓⛓⛓ it PLANS — `r9-solve-2`\'s own room, on ONE dash window, and the walk gets shorter', () => {
        const run = runOf('r9-solve-2');
        expect(run.inventory.hasSword).toBe(true);
        const tele = (run.world.teleporters ?? []).find((t) => t.to === 0);
        const aim = { x: tele.rect.x + 8, y: tele.rect.y + 8 };
        const wps = planWaypoints(run.world, run.state, aim,
            (run.world.teleporters ?? []).indexOf(tele), {});
        const r = planSwordDash(run, wps, { tolerance: 0 });
        expect(r.baseline).toBe(47);
        expect(r.plan).not.toBeNull();
        expect(r.ticks).toBe(23);
        expect(r.saved).toBe(24);
        // ⛓⛓ R9 slice 12c‴, ⚖ ruling 45(b): a window carries its PREFIX now.
        // The room still wants the WHOLE chain — which is the measurement, not
        // the assumption: all four prefixes were previewed at this start tick
        // and the full one walked shortest.
        expect(r.windows).toEqual([{ at: 0, prefix: [...DASH_CHAIN_PATTERN] }]);
        // ⛓ the schedule is the window's own shape, not a typed list
        expect([...r.plan.ticks].sort((a, b) => a - b))
            .toEqual(DASH_CHAIN_PATTERN.map((d) => run.ticksCompleted + d));
    });

    /**
     * ⛓⛓ **THE SURVEY IS SCORED, AND EVERY REJECTION CARRIES A REASON** —
     * trap 588's law one question over: a refusal that says only "no" cannot
     * be audited, so the scan reports how many start ticks it asked about
     * (`scanned`, which is what makes it a BOUNDED sweep that names what it
     * bounded) and gives every rejected one a `kind` and a `why`.
     *
     * ⚠ **THE L14 NULL IS NOT THIS ROW'S CLAIM, AND SAYING SO IS THE POINT.**
     * On the corridor the LADDER plans — the AVOID rung's, routed around the
     * bobs, certified through `walkTo`'s own danger predicate — the planner
     * refuses L14 outright: 145 start ticks scanned, **116 not-faster · 16
     * would-hit · 13 danger**, because L14's own strikes knock bobs into their
     * 30-tick i-frames and `certifyDash` cannot price a dash against a body in
     * knockback (§27.5 named that shape in advance). That measurement belongs
     * to the producer and is recorded in §28; a unit row cannot reach the
     * ladder's corridor or its `except` set, and a row that quietly used a
     * DIFFERENT corridor while claiming the ladder's answer would be a true
     * sentence about the wrong subject.
     */
    it('⛓⛓ the scan is BOUNDED and every rejected window carries a kind and a why', () => {
        const run = runOf('r9-solve-14');
        const tele = (run.world.teleporters ?? []).find((t) => t.to === 15);
        const wps = planWaypoints(run.world, run.state,
            { x: tele.rect.x + 8, y: tele.rect.y + 8 },
            (run.world.teleporters ?? []).indexOf(tele), {});
        const r = planSwordDash(run, wps, { tolerance: 0 });
        expect(r.scanned).toBe(r.candidates.length);
        expect(r.scanned).toBeGreaterThan(0);
        const rejected = r.candidates.filter((c) => !c.certified);
        expect(rejected.length).toBeGreaterThan(0);
        for (const c of rejected) {
            expect(typeof c.kind).toBe('string');
            expect(c.kind.length).toBeGreaterThan(0);
            expect(typeof c.why).toBe('string');
            expect(c.why.length).toBeGreaterThan(0);
            expect(Number.isInteger(c.at)).toBe(true);
        }
        // ⛓ AND THE MECHANISM RIDES ON THE ROW: what the schedule pressed,
        // what dashed, and what `certifyDash` made it YIELD — so "not faster"
        // can be read as a cause rather than a verdict.
        for (const c of r.candidates) {
            expect(Number.isInteger(c.pressed)).toBe(true);
            expect(Number.isInteger(c.dashed)).toBe(true);
            expect(Number.isInteger(c.yielded)).toBe(true);
        }
    });

    /**
     * ⛓⛓⛓ R9 SLICE 12c‴, ⚖ RULING 45(b) — **EVERY PREFIX IS ENUMERATED AT
     * EVERY START TICK**, and the cost is visible rather than absorbed.
     *
     * ⛔ MUTANT (d)'s ROW. Drop `[0,2]` from `DASH_CHAIN_PREFIXES` and this
     * reds by counting: the scan asks `DASH_CHAIN_PREFIXES.length` questions per
     * start tick, so `scanned` is a MULTIPLE of it and every prefix length
     * appears the same number of times. A pass that quietly skipped one would
     * still certify something and still look like a scan.
     */
    it('⛓⛓ ⚖ ruling 45(b): EVERY prefix is previewed at every start tick, and '
        + '`scanned` says so', () => {
        const run = runOf('r9-solve-2');
        const tele = (run.world.teleporters ?? []).find((t) => t.to === 0);
        const wps = planWaypoints(run.world, run.state,
            { x: tele.rect.x + 8, y: tele.rect.y + 8 },
            (run.world.teleporters ?? []).indexOf(tele), {});
        const r = planSwordDash(run, wps, { tolerance: 0 });
        expect(DASH_CHAIN_PREFIXES.map((p) => [...p]))
            .toEqual([[0], [0, 2], [0, 2, 8], [0, 2, 8, 14]]);
        expect(r.scanned % DASH_CHAIN_PREFIXES.length).toBe(0);
        const byLength = new Map();
        for (const c of r.candidates) byLength.set(c.presses, (byLength.get(c.presses) ?? 0) + 1);
        expect([...byLength.keys()].sort((a, b) => a - b))
            .toEqual(DASH_CHAIN_PREFIXES.map((p) => p.length));
        // …and every prefix was asked the SAME number of times, which is what
        // makes the multiple above a partition rather than a coincidence.
        expect(new Set(byLength.values()).size).toBe(1);
        // ⛓ every row carries WHICH prefix it was, so a report can tell two
        // schedules at one start tick apart.
        for (const c of r.candidates) {
            expect(Array.isArray(c.prefix)).toBe(true);
            expect(c.prefix.length).toBe(c.presses);
            expect(DASH_CHAIN_PREFIXES.some((pre) =>
                pre.length === c.prefix.length && pre.every((d, i) => d === c.prefix[i])))
                .toBe(true);
        }
    });

    /**
     * ⛓⛓⛓ R9 SLICE 12c‴, ⚖ RULING 45(a) — **THE `would-hit` REFUSAL IS GONE,
     * AND WHAT REPLACED IT IS TWO NAMED CASES.**
     *
     * ⛔ MUTANT (c)'s ROW. `r9-solve-14` is the six-bob room and its planned
     * presses DO cover bodies — 12c′ refused 16 of its 145 start ticks for
     * exactly that. This asserts no candidate is refused for covering one any
     * more, on a room that holds no boss-class shake writer: the dealt-hit
     * effects are modelled and the preview applies them.
     */
    it('⛓⛓⛓ ⚖ ruling 45(a): a covered body is MODELLED, not refused — no `would-hit` '
        + 'row survives in a room with no boss-class shake writer', () => {
        const run = runOf('r9-solve-14');
        expect(run.shakeWritersHere).toEqual([]);
        const tele = (run.world.teleporters ?? []).find((t) => t.to === 15);
        const wps = planWaypoints(run.world, run.state,
            { x: tele.rect.x + 8, y: tele.rect.y + 8 },
            (run.world.teleporters ?? []).indexOf(tele), {});
        const r = planSwordDash(run, wps, { tolerance: 0 });
        const kinds = new Set(r.candidates.filter((c) => !c.certified).map((c) => c.kind));
        expect(kinds.has('would-hit')).toBe(false);
        expect(kinds.has('shake-room')).toBe(false);
        expect(kinds.has('unpriced-hit')).toBe(false);
        expect(r.plan).not.toBeNull();
    });

    /**
     * ⛓⛓ **THE ROOM PREDICATE IS NOT VACUOUS**, which is the half a refusal
     * that never fires cannot show on its own. `camera.BOSS_CLASS_SHAKE_WRITERS`
     * is the writers table MINUS `playerHit` — derived, never re-listed — and
     * `run.shakeWritersHere` names which of them a room holds a body for.
     */
    it('⛓⛓ the boss-class shake roster is DERIVED from the table, and the room '
        + 'predicate names writers where they exist and none where they do not', () => {
        expect(BOSS_CLASS_SHAKE_WRITERS).toEqual(
            Object.keys(SHAKE_WRITERS).filter((k) => k !== 'playerHit'));
        expect(BOSS_CLASS_SHAKE_WRITERS).not.toContain('playerHit');
        const at = (level) => createLevelRun({
            levelSource, boot: { level, x: 80, y: 48 }, noclip: false, noHazards: [],
            noDamage: false, grants: [], persistence: [], despawn: [], equips: [],
            pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        }).shakeWritersHere;
        // ⛔ THE NEGATIVE AND THE POSITIVE, because either alone is a vacuity:
        // L14 and L6 are the rooms the dash planner actually works in, and the
        // totem's room and the Owl's are where the refusal must survive.
        expect(at(14)).toEqual([]);
        expect(at(6)).toEqual([]);
        expect(at(43)).toEqual(['totemLaser', 'totemDeath']);
        expect(at(112)).toEqual(['rockFallLanding']);
    });

    /**
     * ⛓⛓⛓ **THE STRIKE-THEN-DASH SEAM, AND IT IS THE SCAN'S OWN FIRST GATE.**
     *
     * ⚖ Ruling 44 said strike-then-dash is the L14 combination the user
     * expected, and ⚖ ruling 45(a) removes the refusal that forbade the second
     * half. What makes the pair COMPOSE is that a swing over a body the walk has
     * just knocked is not a hit at all: `strikeCandidates` rejects an i-framed
     * TARGET before anything downstream sees it — `Enemy.hit`'s own first gate,
     * transcribed. So the press that MOVES cannot re-strike the body the press
     * that STRUCK left harmless, and the two rulings do not fight.
     */
    it('⛓⛓⛓ a swing over a body I have just knocked is NOT a hit — `strikeCandidates` '
        + 'rejects an i-framed target by name', () => {
        const player = { x: 100, y: 100 };
        const body = (hitsTimer) => ({
            id: 'bob@100,100', as3: 'Enemy', enemyClass: 'Bob', hitsTimer,
            rect: { x: 96, y: 96, right: 112, bottom: 112 },
        });
        const opts = { facingToward, owed: new Map(), tick: 0 };
        const fresh = strikeCandidates(player, [body(0)], opts);
        expect(fresh.chosen.map((c) => c.id)).toEqual(['bob@100,100']);
        const knocked = strikeCandidates(player, [body(30)], opts);
        expect(knocked.chosen).toEqual([]);
        expect(knocked.rejected[0].why).toMatch(/hitsTimer 30/);
        // ⛓ …and it is the ENEMY's gate that is being quoted, not a local rule.
        expect(knocked.rejected[0].why).toMatch(/`Enemy\.hit` refuses while it is up/);
    });

    it('⛔ no sword is refused FIRST and by name — twelve of the chain\'s segments are', () => {
        const run = runOf('r8-solve-5');
        expect(run.inventory.hasSword).toBe(false);
        const r = planSwordDash(run, [{ x: run.state.x + 32, y: run.state.y }], {});
        expect(r.plan).toBeNull();
        expect(r.why).toMatch(/holds no sword/);
        expect(r.scanned).toBe(0);
    });

    /**
     * ⛔⛔⛔ **THE POLICY IS ASKED ON EVERY TICK IT IS ARMED FOR — AND THE
     * FIRST CUT ASKED IT ONLY WHERE THERE WERE BODIES.**
     *
     * `previewWalk` consulted the strike policy while its body list was
     * truthy, and `chasers.step` returns `null` in a room with no chaser
     * forecast at all — so after the FIRST tick the policy was never asked
     * again. Invisible for as long as every press needed a body in reach.
     * MEASURED the moment one did not: a four-press dash chain in a body-free
     * room took exactly ONE press, with zero yields and zero refusals to
     * explain the other three — a null that looked exactly like a planner
     * finding nothing. **This row is what that cost.**
     */
    it('⛔⛔⛔ a body-free room takes the WHOLE schedule, not just its first press', () => {
        const run = runOf('r9-solve-13');
        expect((run.strikeBodies ?? []).length).toBe(0);
        const ticks = new Set(DASH_CHAIN_PATTERN.map((d) => run.ticksCompleted + d));
        const strike = strikePolicyFor(run, { dashPlan: { ticks, why: 'the row\'s own window' } });
        expect(strike).not.toBeNull();
        previewWalk(run, [{ x: run.state.x - 64, y: run.state.y }], 0, { strike });
        // ⛓ THE WHOLE TICK LIST, not its size — a count would pass on the
        // right NUMBER of the wrong presses.
        expect(strike.plannedPresses.map((p) => p.tick))
            .toEqual(DASH_CHAIN_PATTERN.map((d) => run.ticksCompleted + d));
        expect(strike.plannedPresses.filter((p) => p.dash).map((p) => p.tick))
            .toEqual(DASH_CHAIN.at.map((d) => run.ticksCompleted + d));
        expect(strike.plannedSkipped).toEqual([]);
    });

    /**
     * ⛔ **A PLAN IS THE PERMISSION, SO A REFUSING POLICY MAY NOT CARRY ONE.**
     * A schedule on an `allowDash: false` policy would be a corridor certified
     * for presses that will never be taken — the exact preview/drive gap ⚖
     * ruling 30(c) exists to close.
     */
    it('⛔ a dashPlan on a REFUSING policy is refused by name', () => {
        expect(() => createStrikePolicy({
            facingToward, facingKeys: FACING_KEYS, hasSword: true, allowDash: false,
            dashPlan: { ticks: [0], why: 'x' },
        })).toThrow(/dashPlan was given with `allowDash: false`/);
    });

    /**
     * ⛓⛓ **THE TWO ARMS NAME DIFFERENT HIT SETS, AND THE ROW PROVES IT CAN
     * FIRE BEFORE IT MEASURES THAT IT DOES NOT** (trap 250).
     *
     * A STRIKE press names ONE aimed target — which is what every committed
     * corridor was priced with, and widening it would re-price them. A PLANNED
     * press swings along the player's own travel and hands back the WHOLE
     * covered set, because it presses mid-corridor where a second body is
     * possible and the game hits every body the rect covers.
     *
     * ⛔ THE SYNTHETIC HALF IS THE NON-VACUITY: two bobs inside one ordinary
     * swing rect, and the planned press names both.
     * ⛓ THE MEASURED HALF is that no committed press can tell them apart —
     * L14 is the ONLY room on the roster that presses at all (§23.8), and over
     * a 400-tick stand on its own boot every aim's `alsoInReach` is EMPTY.
     */
    it('⛓⛓ a PLANNED press names every body its rect covers — and no committed press covers two', () => {
        const body = (id, x, y) => ({
            id, as3: 'Enemy', enemyClass: 'Bob', tag: 'bob', x, y, hitsTimer: 0,
            rect: rect(x - 4, y - 4, 8, 8),
        });
        const st = { x: 100, y: 100, vx: 1, vy: 0, direction: 0, fall: false };
        const gate = {
            hasSword: true, hasGhostSword: false, wanding: false, firing: false,
            deathRaying: false, spearing: false,
        };
        const planned = createStrikePolicy({
            facingToward, facingKeys: FACING_KEYS, hasSword: true, allowDash: true,
            dashPlan: { ticks: [0], why: 'the row\'s own press' },
        });
        const d = planned.decide(st, [body('bob@a', 106, 96), body('bob@b', 108, 108)], 0,
            new Set(['right']),
            { slash: { state: INITIAL_SLASH_STATE, endsAt: null, gate } });
        expect(d.decision).toBe('press');
        expect(d.planned).toBe(true);
        expect(d.targets).toEqual(['bob@a', 'bob@b']);
        // ⛓ …and it kept the walk's own key, which is what makes it a MOVE.
        expect([...d.held].sort()).toEqual(['primary', 'right']);

        // ── the measured half: the committed roster's one pressing room ──
        const run = createLevelRun({
            levelSource, boot: { level: 14, x: 160, y: 64 }, noclip: false, noHazards: [],
            noDamage: false, grants: [], despawn: [], persistence: [], equips: [],
            pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        const committed = createStrikePolicy({
            facingToward, facingKeys: FACING_KEYS, hasSword: true,
        });
        for (let t = 0; t < 400; t += 1) {
            const step = committed.decide(run.state, run.strikeBodies, run.ticksCompleted,
                new Set(), { slash: run.slashInfo });
            run.advance(step.held);
        }
        const aims = committed.trace.filter((r) => r.decision === 'aim');
        expect(aims.length).toBe(9);
        for (const a of aims) expect(a.alsoInReach).toEqual([]);
    });

    /**
     * ⛓ **A CROSSING IS NOT A STALL**, and `previewWalk` says which it is.
     * Every `reach-exit` corridor ends by crossing; a planner that read any
     * `truncated` as "no length to compare" would refuse the whole class it
     * exists for, which is exactly what the first cut of `planSwordDash` did.
     */
    it('⛓ `previewWalk` NAMES its truncation — a crossing and a stall are not one field', () => {
        const run = runOf('r9-solve-2');
        const tele = (run.world.teleporters ?? []).find((t) => t.to === 0);
        const wps = planWaypoints(run.world, run.state,
            { x: tele.rect.x + 8, y: tele.rect.y + 8 },
            (run.world.teleporters ?? []).indexOf(tele), {});
        const crossed = previewWalk(run, wps, 0, { strike: strikePolicyFor(run) });
        expect(crossed.truncated.kind).toBe('crossed');
        expect(crossed.truncated.why).toMatch(/crossed to level 0/);
    });

    /** ⛓ The roster-wide default is still `false` — the flip is 12c″'s. */
    it('⛓ the roster-wide dash permission is still OFF at this head', () => {
        expect(ALLOW_DASH_ROSTER_WIDE).toBe(false);
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12d″ — **THE L20 TOUCH, AT THE PIXEL THAT WAS FATAL.**
 *
 * R9 §31.7 measured `execTouch` choosing its lean by `|dx| >= |dy|` against
 * the lock CENTRE, and the derived stance `(168,24)` against the target
 * `(176,16)` makes that comparison `|+8.00| - |-8.00| = 0.00` — an EXACT tie
 * that the `>=` alone decides, underneath `DEFAULT_TOLERANCE = 1.0`. Six
 * measured builds scattered across it; three leaned `right` and solved and
 * two leaned `up`, which is not slow but FATAL.
 *
 * ⛔ THESE ROWS DO NOT NEED THE CHAIN, THE FLIP, OR EITHER ECONOMY. The
 * defect reproduces from a bare boot at the arrival pixel the flip column
 * measured, which is what makes it a fixture rather than a re-run: the whole
 * mechanism is two coordinates and one comparison.
 */
describe('R9 12d″: the touch lean is the mechanism OWN probe', () => {
    const LOCK = 'shieldlocknorm@176,16';
    /** The derived stance `deriveTouchStance` returns for L20 — cell (10,1). */
    const STANCE = Object.freeze({ x: 168, y: 24 });
    /**
     * ⛓ §31.7's six measured touch-start pixels, one per build. Literals
     * whose provenance is that table; nothing here re-derives them, and the
     * row below is about their DISTANCE from `STANCE`, not their values.
     */
    const COLUMNS = Object.freeze([
        { col: '(A) false', x: 167.26, y: 24.22, lean: 'right', solved: true },
        { col: '(B) flip', x: 168.12, y: 24.44, lean: 'up', solved: false },
        { col: '(C) flip+46', x: 168.09, y: 23.17, lean: 'right', solved: true },
        { col: '(D) flip+47', x: 168.12, y: 24.44, lean: 'up', solved: false },
        { col: '(E) flip+46+47', x: 168.09, y: 23.17, lean: 'right', solved: true },
        { col: '(E0) economies', x: 167.99, y: 23.89, lean: 'right', solved: true },
    ]);

    /**
     * A live L20 run standing at (x, y) with the plain shield. ⛔ The boot
     * block is in PLACEMENT coordinates and the entity centre is placement +
     * 8 on both axes, so the caller names the pixel it means and the offset
     * is undone here — a row that booted `x` directly would sit 8 px east of
     * the stance it claimed and prove nothing about either lean.
     */
    const at = (x, y) => createLevelRun({
        levelSource, boot: { level: 20, x: x - 8, y: y - 8 }, noclip: false,
        noHazards: [], noDamage: false, grants: [], persistence: [], despawn: [],
        equips: [], pins: [], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null, seam: { items: { hasShield: true } }, roles: ROLES,
    });

    /** The work order `execTouch` is handed, built from the row the world has. */
    const order = (run, over = {}) => {
        const row = run.world.activators.find((a) => a.id === LOCK);
        return {
            strategy: 'touch', postCondition: 'open', held: true, lock: row.id,
            target: { x: row.x, y: row.y }, tag: row.tag, need: row.shield,
            window: opensOnTick(RESPONDERS[row.tag].fade), ...over,
        };
    };

    it('⛓ the pixel that was FATAL under the dominant axis now snaps', () => {
        const run = at(168.12, 24.44);
        expect(run.state.x).toBeCloseTo(168.12, 6);
        expect(run.state.y).toBeCloseTo(24.44, 6);
        // ⛔ THE TWO RULES DISAGREE HERE, which is the whole reason this pixel
        // is the fixture. Against the target the dominant axis is VERTICAL...
        const dx = 176 - run.state.x;
        const dy = 16 - run.state.y;
        expect(Math.abs(dx) - Math.abs(dy)).toBeCloseTo(-0.56, 6);
        expect(Math.abs(dx) >= Math.abs(dy)).toBe(false);
        // ...and the probe says WEST, so the lean is `right` whatever the
        // arithmetic to the centre says.
        expect(touchApproachKey('shieldlocknorm')).toBe('right');
        const out = STRATEGY_EXECUTORS.touch(run, [], order(run), { what: 'fixture' });
        expect(out.snappedAt).not.toBeNull();
        expect(out.ticks).toBe(105);
    });

    it('⛓ ...and the stance it is scattered around gives the SAME answer', () => {
        // The tie itself. Under the old rule this one passed on the `>=`
        // alone; under the derivation there is no comparison left to pass.
        const run = at(STANCE.x, STANCE.y);
        expect(Math.abs(176 - STANCE.x) - Math.abs(16 - STANCE.y)).toBe(0);
        const out = STRATEGY_EXECUTORS.touch(run, [], order(run), { what: 'fixture' });
        expect(out.snappedAt).not.toBeNull();
        expect(out.ticks).toBe(105);
    });

    /**
     * ⛓⛓⛓ ⚖ RULING 48, TESTED AND NOT THE MECHANISM — the user hypothesis
     * (2026-08-24): *"I suspect that the fix is to limit dashes to paths that
     * are long enough to complete at least one dash segment."*
     *
     * ⛔ THAT WOULD GATE THE WRONG QUANTITY, and this row is the arithmetic
     * that says so. A dash overshoot would have to show as a displacement the
     * drive does not permit; every one of §31.7's six measured touch-start
     * pixels is inside `DEFAULT_TOLERANCE` of the derived stance on BOTH axes,
     * so what separates a solving column from a fatal one is the drive OWN
     * arrival scatter — 0.86 px at the very widest — landing either side of a
     * comparison whose margin at that stance is EXACTLY ZERO. No leg length
     * makes 1.0 px of allowed scatter smaller than a 0.00 px margin. ⇒ the
     * cure is to remove the comparison, which is what this slice did.
     */
    it('⚖ 48: every measured arrival is inside the drive OWN tolerance', () => {
        for (const c of COLUMNS) {
            expect(Math.abs(c.x - STANCE.x), c.col).toBeLessThanOrEqual(DEFAULT_TOLERANCE);
            expect(Math.abs(c.y - STANCE.y), c.col).toBeLessThanOrEqual(DEFAULT_TOLERANCE);
        }
        // ⛔ AND THE MARGIN THE SCATTER IS LANDING ON IS ZERO. At the stance
        // the old rule compared `|+8.00|` with `|-8.00|`, so `>=` was the
        // whole decision — an order of magnitude inside the tolerance above.
        expect(Math.abs(176 - STANCE.x) - Math.abs(16 - STANCE.y)).toBe(0);
        // The columns whose OLD lean was fatal are the ones whose scatter
        // pushed `|dx| - |dy|` negative; the derivation gives all six `right`.
        const fatal = COLUMNS.filter((c) => !c.solved);
        expect(fatal.map((c) => c.col)).toEqual(['(B) flip', '(D) flip+47']);
        for (const c of fatal) {
            expect(Math.abs(176 - c.x) - Math.abs(16 - c.y), c.col).toBeLessThan(0);
            expect(c.lean, c.col).toBe('up');
        }
        expect(touchApproachKey('shieldlocknorm')).toBe('right');
    });

    it('⛔ a responder with NO transcribed probe REFUSES BY NAME', () => {
        // ⛔ The fallback IS the defect. A class nobody has read is the
        // population least able to survive a guessed lean, so the verb says
        // which class and what the work order is instead of picking an axis.
        const run = at(168.12, 24.44);
        expect(() => STRATEGY_EXECUTORS.touch(run, [], order(run, { tag: 'lock' }),
            { what: 'fixture' })).toThrow(/is a `lock`, and .*carries no PROBE for that class/s);
    });
});
