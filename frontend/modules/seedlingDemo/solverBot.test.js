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
    resolveKillStrategy, solveSegment,
} from './solverBot.js';
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
        const { run, committed } = runFromCommitted('r7-act2-4');
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
        const { run, committed } = runFromCommitted('r7-act2-8');
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
        const { run, committed } = runFromCommitted('r7-act2-8', {
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
            ['r7-act2-4', { x: 64, y: 16 }],
            ['r7-act2-6', { x: 224, y: 32 }],
            ['r7-act2-8', { x: 96, y: 192 }],
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
     *  reported as a room with no ceiling. */
    it('⛓ an un-modelled body\'s own sentence survives the fallthrough', () => {
        const run = roomWithNoTrap();
        run.world.combat.enemies = [{ tag: 'bob', x: 5, y: 5, counted: true }];
        run.spinnerBodies = [{ id: 'bob@5,5', x: 5, y: 5 }];
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
        const { run, committed } = runFromCommitted('r7-act2-4');
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
        const { run, committed } = runFromCommitted('r7-act2-4');
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
        const { run } = runFromCommitted('r7-act2-8');
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
        const { run, committed } = runFromCommitted('r7-act2-8', {
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
        const { run, committed } = runFromCommitted('r7-act2-11');
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
        const a = runFromCommitted('r7-act2-11');
        const obstacleSide = solveSegment({
            run: a.run, goals: [{ kind: 'reach-exit', exit: { ...L11_EXIT } }],
            name: 'slice10-l11-obstacle', boot: a.committed.boot,
        });
        const b = runFromCommitted('r7-act2-11');
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
        const a = runFromCommitted('r7-act2-11');
        const obstacleSide = solveSegment({
            run: a.run, goals: [{ kind: 'reach-exit', exit: { ...L11_EXIT } }],
            name: 'slice10-l11-obstacle', boot: a.committed.boot,
        });
        const b = runFromCommitted('r7-act2-11');
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
        const { run } = runFromCommitted('r7-act2-11', { boot: { ...L16_BOOT } });
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
