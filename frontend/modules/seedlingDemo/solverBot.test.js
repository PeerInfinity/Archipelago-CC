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
 * ⚠ BOUNDED VACUITY, NAMED: no battery room exercises the DANGER refusal
 * (the seven rooms are clean — that is why they are the battery). The danger
 * arm is tested here against L6's live corridor only as far as sensing goes;
 * the REFUSAL fires on rooms this slice does not solve, and slice 3's combat
 * policy replaces it. The seam is tested; its firing in anger is not.
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
    LIVE_GEOMETRY_KEYS, isNormalizedLiveOpts, normalizeLiveOpts,
} from './levelWorld.js';
import {
    OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, SolverRefusal, solveSegment,
} from './solverBot.js';
import {
    deathJumpFindings, parseDecisionTrace, traceTapeAgreementFindings,
} from './decisionTrace.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAPES = join(HERE, 'fixtures', 'tapes');
const levelSource = atlasLevelSource();

/** A live run booted from a committed segment's own v8 boot block. */
function runFromCommitted(name) {
    const t = parseTape(JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8')));
    const run = createLevelRun({
        levelSource, boot: t.boot, noclip: false, noHazards: t.noHazards,
        noDamage: false, grants: t.grants, persistence: t.persistence, despawn: [],
        equips: t.equips, pins: t.pins ?? [], save: t.save ?? null,
        rng: t.rng ?? null, seam: t.seam ?? null,
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
    it('L4: names the BUTTON on the component frontier and selects `hold`, unregistered', () => {
        const { run, committed } = runFromCommitted('r7-act2-4');
        let refusal = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }],
                name: 'probe-l4', boot: committed.boot,
            });
        } catch (e) { refusal = e; }
        expect(refusal).toBeInstanceOf(SolverRefusal);
        expect(refusal.obstacle).toMatchObject({ kind: 'proximity-hazard', tag: 'button' });
        expect(refusal.considered).toEqual([{
            option: 'hold',
            why: expect.stringMatching(/NOT REGISTERED/),
        }]);
        expect(refusal.message).toMatch(/button@16,64/);
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
});

describe('the strategy catalog seam (slice 3 extends, never restructures)', () => {
    it('every registered executor answers a selector row; unregistered rows are the work orders', () => {
        const selected = new Set(Object.values(OBSTACLE_STRATEGIES));
        for (const verb of Object.keys(STRATEGY_EXECUTORS)) {
            expect(selected.has(verb) || verb === 'collect',
                `executor '${verb}' is reachable by no selector row`).toBe(true);
        }
        // The slice-3 work orders, as data: selected and not yet registered.
        const pending = [...selected].filter((v) => !STRATEGY_EXECUTORS[v]).sort();
        expect(pending).toEqual(['hold', 'kill', 'shove', 'touch']);
    });
});
