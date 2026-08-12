/**
 * seedlingDemo/procgenScratchPersistence.test — **THE SCRATCH PERSISTENCE
 * LAYER**, driven from both ends.
 *
 * Seedling PROCGEN PoC arc, slice 4b (kickoff §4.4b; ⚖ user ruling §1.13:
 * *"a temporary copy of the persistence data that can be modified and
 * reverted without changing the real save data"*). Slice 4 §12.3(ii) is the
 * driven case this file re-drives: a spinner whose death opens a `tset == -1`
 * kill lock the tape does not declare, in a room a generator can build.
 *
 * ── WHAT THIS FILE HAS TO PROVE, AND IN WHICH DIRECTION ───────────────
 *
 *  1. **The boundary** — a run built any other way is NOT in scratch mode.
 *     ⚠ MEASURED at the parent: 10 of these 13 cases are RED there and 3 are
 *     GREEN, and the three are the ones that should be — the control (the
 *     parent's own refusal, with its tick), the tape-format bound (a fact
 *     this slice discovered and did not change), and the LIVE-spinner guard
 *     (⚖ ruling condition 1: the narrowing must not touch the live case, so
 *     that case passing at BOTH ends is the proof rather than a weakness).
 *     The boundary cases themselves are red at the parent only because the
 *     getter they read is new — stated plainly rather than dressed up as a
 *     stronger claim than it is.
 *  2. **The layer** — with the flag, the model self-declares the clear it
 *     can compute, on the tick its own refusal named. RED at the parent.
 *  3. **The one writer** — a slot the staging block declares is never
 *     touched by the layer, and the run takes the parent's path there.
 *  4. **The fold, UNCHANGED — and the measurement that kept it that way.**
 *     ⚖ The orchestrator ruled (ii): emit the scratch rows so a generated
 *     tape declares what its walk turned off. `tapeFormat` bounds
 *     `persistence[].level` to the real game's 116 levels and a generated
 *     level is 900, so the emitted tape stopped PARSING — worse than one
 *     that parses and refuses. The parser's own sentence is pinned here as
 *     the residue's evidence, under the ruling's own escape valve.
 *  5. **The replay boundary** — the scratch solve's tape, replayed through
 *     the ORDINARY stepper, still refuses. Scratch mode does not travel with
 *     the artifact, which is the boundary asserted behaviourally rather than
 *     by reading a field.
 *  6. **The narrowed dialogue guard** — a room with a LIVE spinner still
 *     refuses, with its existing message; only rooms whose spinners are all
 *     removed stopped being asked.
 *
 * ⛔ THE ENGINE-LEVEL CASES BUILD A RUN AND CALL `solveSegment` DIRECTLY,
 * which production code may not do (`watchSolve`'s one-of-everything law) —
 * because the SUBJECT here is the run's own ledger, and `solveForPage`
 * returns nothing on the path where the parent throws. `watchSolve.test.js`
 * already reaches for `createRunForStaging` for the same reason. Every case
 * that asks a PRODUCT question goes through `procgenOracle.solve`.
 */

import { describe, expect, it } from 'vitest';

import {
    createRunForStaging, createTapeStepper, solveStaging, stagingFromTape,
} from './tapeRunner.js';
import {
    bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain,
} from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { atlasOf } from './procgenLevel.js';
import { buildStagedTape } from './botDriverV1.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { parseTape } from './tapeFormat.js';
import { solveForPage } from './watchSolve.js';
import { solveSegment } from './solverBot.js';

const LEVEL = 900;
const ITEMS = { hasSword: true, hasShield: false };

/**
 * ⛔ THE PROVEN GEOMETRY, and every number in it is a measurement.
 *
 * A Stone wall across the whole interior at `ty=5` with ONE gap at `tx=5`, a
 * kill lock (`tset:'-1'`) standing in that gap, the goal strictly beyond it,
 * and the spinner at (3,1) — the cell slice 4b's 32-cell sweep found solvable
 * (2 of 32; the other 30 are the hammer-transit family and four stance
 * refusals, both unchanged by this slice).
 *
 * ⛔⛔ THE LOCK'S TAG IS `'1'` AND THE GOAL'S IS `'0'`, WHICH IS A FINDING
 * RATHER THAN A DETAIL. **A clear is a FLAG, not an entity**
 * (`levelWorld.persistenceClearsFor`'s own law): with both on tag 0 the
 * scratch clear correctly removed the GOAL PICKUP along with the lock, and
 * the solve refused with *"level 900 has no pickup at (112,128); it has
 * [none]"*. A kill-lock template must not share a tag with the goal — the
 * layer working is what exposed it.
 */
const KILL_LOCK_ROOM = Object.freeze({
    wallTy: 5, gapTx: 5, lockTag: '1', spinner: { tx: 3, ty: 1 }, goal: { tx: 7, ty: 8 },
});

function killLockRoom({ lockTag = KILL_LOCK_ROOM.lockTag } = {}) {
    let record = emptyLevel({ level: LEVEL });
    const wall = [];
    for (let tx = 1; tx <= 8; tx += 1) {
        if (tx !== KILL_LOCK_ROOM.gapTx) {
            wall.push({ tx, ty: KILL_LOCK_ROOM.wallTy, terrain: 'wall' });
        }
    }
    record = withTerrain(record, wall);
    return withEntities(record, [
        {
            type: 'torchpickup',
            ...oelAtTile(KILL_LOCK_ROOM.goal.tx, KILL_LOCK_ROOM.goal.ty),
            attrs: { tag: '0' },
        },
        {
            type: 'lock',
            ...oelAtTile(KILL_LOCK_ROOM.gapTx, KILL_LOCK_ROOM.wallTy),
            attrs: { tset: '-1', tag: lockTag },
        },
        {
            type: 'spinner',
            ...oelAtTile(KILL_LOCK_ROOM.spinner.tx, KILL_LOCK_ROOM.spinner.ty),
            attrs: { tag: '-1' },
        },
    ]);
}

const roomGoal = () => collectGoal(KILL_LOCK_ROOM.goal.tx * 16, KILL_LOCK_ROOM.goal.ty * 16);

/**
 * ⛔⛔ THE CLOCK IS INJECTED, AND NOT AS A CONVENIENCE — MEASURED.
 *
 * `DEFAULT_BUDGET.wallClockMs` is 5000 and this room solves in ~1.6 s alone;
 * inside the WHOLE `seedlingDemo` suite it crossed 5 s and four cases here
 * came back `BUDGET_EXHAUSTED` instead of `SOLVED`. That is §8.3's POST-HOC
 * wall clock behaving exactly as documented — the budget bounds what the loop
 * ACCEPTS, not what it spends — so the verdict of a solve run under load is a
 * statement about the machine.
 *
 * This file's subject is the persistence layer, so the clock is frozen and
 * the wall-clock arm cannot fire. ⚠ The TICK budget (`maxTicksPerTarget`, the
 * only mid-flight bound) is untouched and still the default: nothing here
 * widens what the solver may spend, only what the stopwatch may notice.
 */
const oracleOpts = (name) => ({ name, now: () => 0 });

const stagingFor = (record, extra = {}) => ({
    ...bootStaging({ boot: bootAtTile(record, 1, 1), items: ITEMS, pins: ['dead_frames'] }),
    ...extra,
});

/** The engine-level driver — see the file docblock for why this is here. */
function driveSolve(record, staging, { scratchPersistence = false, name = 'scratch-probe' } = {}) {
    const honest = solveStaging(staging);
    const levelSource = levelSourceFromAtlas(atlasOf(record));
    const run = createRunForStaging(honest, levelSource, { scratchPersistence });
    let thrown = null;
    let out = null;
    try {
        out = solveSegment({ run, goals: [roomGoal()], name, boot: honest.boot });
    } catch (e) {
        thrown = e;
    }
    return { run, out, thrown, honest };
}

/** An empty bordered room with one goal — the cheapest run that is a run. */
function emptyRoomStaging() {
    const record = withEntities(emptyLevel({ level: LEVEL }), [{
        type: 'torchpickup', ...oelAtTile(5, 5), attrs: { tag: '0' },
    }]);
    return { record, staging: stagingFor(record) };
}

describe('the boundary — a run is in scratch mode ONLY when a caller says so', () => {
    /**
     * ⚠ GREEN AT THE PARENT TOO, and deliberately: this is the claim that
     * committed-room replay and the battery are outside the flag BY
     * CONSTRUCTION. It asserts the DEFAULT, which is the thing every existing
     * call site relies on without knowing it exists.
     */
    it('the two-argument construction — every existing call site — is NOT scratch', () => {
        const { record, staging } = emptyRoomStaging();
        const levelSource = levelSourceFromAtlas(atlasOf(record));
        const run = createRunForStaging(solveStaging(staging), levelSource);
        expect(run.scratchPersistence).toBe(false);
        expect(run.scratchClears).toEqual([]);
    });

    it('and an explicit false is the same run', () => {
        const { record, staging } = emptyRoomStaging();
        const levelSource = levelSourceFromAtlas(atlasOf(record));
        const run = createRunForStaging(solveStaging(staging), levelSource,
            { scratchPersistence: false });
        expect(run.scratchPersistence).toBe(false);
    });

    /**
     * ⛔⛔ THE NO-DATA-PATH CLAIM, DRIVEN. The flag is an ARGUMENT and not a
     * staging field precisely so that no tape, preset or hand-typed editor
     * block can switch engine behaviour on. `stagingFromTape` copies twelve
     * NAMED fields; a JSON blob carrying `scratchPersistence: true` therefore
     * loses it before any run is built.
     */
    it('a staging block CANNOT carry the flag — `stagingFromTape` drops it', () => {
        const { record, staging } = emptyRoomStaging();
        const tape = buildStagedTape({ staging: solveStaging(staging), perTick: [], name: 'x' });
        const smuggled = { ...tape, scratchPersistence: true };
        const block = stagingFromTape(parseTape(smuggled));
        expect(block.scratchPersistence).toBeUndefined();
        const levelSource = levelSourceFromAtlas(atlasOf(record));
        expect(createRunForStaging(block, levelSource).scratchPersistence).toBe(false);
    });

    /**
     * ⛓ EVERY REPLAY, ASSERTED BEHAVIOURALLY RATHER THAN BY READING A FIELD —
     * `createTapeStepper` does not expose its run, and the stronger claim is
     * available anyway: replay the SCRATCH solve's own tape (which declares
     * nothing, see the fold's docblock) and the ordinary path throws the very
     * refusal the scratch layer routed around, on the tick it names. A replay
     * that had inherited scratch mode would have replayed clean.
     */
    it('the replay path is NOT scratch — the same walk refuses there', () => {
        const record = killLockRoom();
        const out = solve(record, stagingFor(record), [roomGoal()], DEFAULT_BUDGET,
            oracleOpts('replay-boundary'));
        expect(out.verdict).toBe('SOLVED');
        expect(out.tape.persistence).toEqual([]);
        const stepper = createTapeStepper(parseTape(out.tape), {
            levelSource: levelSourceFromAtlas(atlasOf(record)),
        });
        expect(() => { for (const _ of stepper) { /* drain */ } })
            .toThrow(/two writers of one persistence slot/);
    });

    it('`solveForPage` without the parameter is NOT scratch', () => {
        const { record, staging } = emptyRoomStaging();
        const result = solveForPage({
            levelSource: levelSourceFromAtlas(atlasOf(record)),
            staging,
            goals: [collectGoal(80, 80)],
            name: 'boundary',
        });
        expect(result.run.scratchPersistence).toBe(false);
        expect(result.run.scratchClears).toEqual([]);
    });
});

describe('the layer — the model self-declares the clear its own refusal named', () => {
    /**
     * THE CONTROL, and it is the parent's behaviour verbatim. The numbers in
     * the message are the ones slice 4 recorded in the palette's exclusion
     * row for this family, from a room of the same shape.
     */
    it('WITHOUT the flag the run still refuses, and names the tick the clear lands on', () => {
        const record = killLockRoom();
        const { thrown } = driveSolve(record, stagingFor(record));
        expect(thrown).toBeTruthy();
        expect(thrown.undeclaredKillLock).toBeTruthy();
        expect(thrown.undeclaredKillLock.level).toBe(LEVEL);
        expect(thrown.undeclaredKillLock.flags).toEqual([1]);
        expect(thrown.message).toMatch(/two writers of one persistence slot/);
        expect(thrown.message).toMatch(/lands the durable clear at tick 618/);
    });

    /**
     * ⛔⛔⛔ THE SLICE, IN ONE ASSERTION: the tick the parent's refusal NAMED
     * (618) is the tick the scratch layer WRITES. Same room, same walk, same
     * arithmetic — the only difference is whether the model is allowed to be
     * the writer of a slot nobody declared.
     */
    it('WITH the flag it writes instead, on that same tick, and says what it wrote', () => {
        const record = killLockRoom();
        const { run, thrown } = driveSolve(record, stagingFor(record),
            { scratchPersistence: true });
        expect(thrown).toBeNull();
        expect(run.scratchPersistence).toBe(true);
        expect(run.scratchClears).toEqual([{
            level: LEVEL,
            tag: 1,
            at: 618,
            declaredAt: 617,
            removedAt: 517,
            by: 'spinner@48,16',
            lock: 'lock@80,80',
            cause: 'sword',
            why: '1 kill lock(s) OPEN: totalEnemies() went 1 -> 0',
        }]);
    });

    /**
     * ⛔ THE ONE-WRITER CLAIM, DRIVEN FROM THE OTHER SIDE. With the slot
     * DECLARED, the arms' `undeclared` list is empty, so there is nothing to
     * promote and nothing to throw — the run takes the parent's path and the
     * ledger stays empty even under the flag. That is what "the scratch layer
     * writes only slots the declaration channel left empty" means, and it is
     * why `assertScratchSlotIsFree` is a guard against a defect rather than a
     * branch anything reaches in normal operation.
     */
    it('a slot the staging block DECLARES is never written by the layer', () => {
        const record = killLockRoom();
        const staging = stagingFor(record, { persistence: [{ level: LEVEL, tag: 1, at: 300 }] });
        const { run, thrown } = driveSolve(record, staging, { scratchPersistence: true });
        expect(thrown).toBeNull();
        expect(run.scratchClears).toEqual([]);
    });

    /**
     * ⛓ THE SAME ROOM THROUGH THE PRODUCT PATH — the oracle, the loop's own
     * seam. This is the DISCHARGE-EXISTENCE evidence (§12.1's standard): the
     * final solve carries a `kill` record naming the body AND a scratch row
     * naming the lock. An obstacle nobody had to clear can produce neither.
     */
    it('the ORACLE solves it, certifies the collect, and carries the ledger out', () => {
        const record = killLockRoom();
        const out = solve(record, stagingFor(record), [roomGoal()], DEFAULT_BUDGET,
            oracleOpts('scratch-oracle'));
        expect(out.verdict).toBe('SOLVED');
        expect(out.certification.certified).toBe(true);
        expect(out.scratchPersistence).toBe(true);
        expect(out.scratchClears).toHaveLength(1);
        expect(out.scratchClears[0].lock).toBe('lock@80,80');
        const strategies = new Set((out.records ?? []).map((r) => r.strategy));
        expect(strategies.has('kill')).toBe(true);
        expect(strategies.has('collect')).toBe(true);
    });
});

describe('the fold — unchanged, and the MEASUREMENT that kept it that way', () => {
    /**
     * ⛔ The fold emits the staging block's own persistence array, by
     * IDENTITY. A scratch run changes nothing here — which is why every
     * committed-room and manual fold is untouched by this slice.
     */
    it('emits the staging block\'s own persistence array, scratch run or not', () => {
        const record = killLockRoom();
        const honest = solveStaging(stagingFor(record));
        expect(buildStagedTape({ staging: honest, perTick: [], name: 'x' }).persistence)
            .toBe(honest.persistence);
        const out = solve(record, stagingFor(record), [roomGoal()], DEFAULT_BUDGET,
            oracleOpts('fold-inert'));
        expect(out.scratchClears).toHaveLength(1);
        expect(out.tape.persistence).toEqual([]);
    });

    /**
     * ⛔⛔⛔ THE RESIDUE'S EVIDENCE, PINNED — why ⚖ ruling (ii) was measured
     * out rather than argued out.
     *
     * The ruling was that this fold should emit the scratch rows so a
     * generated tape declares what its walk turned off. `tapeFormat` bounds
     * `persistence[].level` to `0..115` (`Game.levels.length`) and a generated
     * level is 900 — while `boot.level` carries NO such bound. So a generated
     * level can be BOOTED by a tape and cannot be DECLARED ABOUT by one, and
     * the emitted tape stopped PARSING, which is worse than one that parses
     * and refuses on replay. This case is the parser's own sentence, kept so
     * the next slice inherits a measurement instead of a story.
     */
    it('⛔ a generated level CANNOT carry a persistence row — the format bounds it', () => {
        const record = killLockRoom();
        const honest = solveStaging(stagingFor(record));
        const tape = buildStagedTape({ staging: honest, perTick: [], name: 'x' });
        expect(() => parseTape({
            ...tape, persistence: [{ level: LEVEL, tag: 1, at: 0 }], tape_version: 9,
        })).toThrow(/persistence\[0\]\.level 900 is not a level \(0\.\.115\)/);
        // …and the SAME level number is fine as a boot, which is the asymmetry.
        expect(parseTape(tape).boot.level).toBe(LEVEL);
    });
});

describe('the narrowed dialogue guard — LIVE bodies only', () => {
    /**
     * ⛔ CONDITION 1 OF THE RULING: the live case is UNTOUCHED and proven so.
     * A spinner the walk never kills, a `torchpickup` whose ceremony carries
     * dialogue — the guard fires, with its own message. ⚠ GREEN AT BOTH ENDS
     * on purpose: the narrowing changed which rooms are ASKED, never what is
     * said when the answer is yes.
     */
    it('a LIVE spinner in a dialogued ceremony still refuses, with its message', () => {
        let record = emptyLevel({ level: LEVEL });
        record = withEntities(record, [
            { type: 'torchpickup', ...oelAtTile(3, 1), attrs: { tag: '0' } },
            { type: 'spinner', ...oelAtTile(8, 8), attrs: { tag: '-1' } },
        ]);
        let thrown = null;
        try {
            solve(record, stagingFor(record), [collectGoal(3 * 16, 1 * 16)], DEFAULT_BUDGET,
            oracleOpts('live-spinner'));
        } catch (e) { thrown = e; }
        expect(thrown).toBeTruthy();
        expect(thrown.message).toMatch(
            /holds live spinners AND a DIALOGUED ceremony \(torch\) is running/);
    });

    /**
     * ⛓ AND THE ROOM THE OLD GATE REFUSED FOR A CLAIM THAT WAS FALSE. The
     * kill-lock room's ceremony begins at tick ~733 and its only spinner was
     * REMOVED at 517 — 216 ticks earlier — so *"holds live spinners"* was not
     * true of it. The room now solves; the previous case shows the guard did
     * not lose its teeth. RED at the parent, where this room threw.
     */
    it('a room whose spinner is already REMOVED is no longer asked', () => {
        const record = killLockRoom();
        const out = solve(record, stagingFor(record), [roomGoal()], DEFAULT_BUDGET,
            oracleOpts('removed-spinner'));
        expect(out.verdict).toBe('SOLVED');
        // The removal really did precede the ceremony — the ledger's own row.
        expect(out.scratchClears[0].removedAt).toBe(517);
        expect(out.ticks).toBeGreaterThan(out.scratchClears[0].at);
    });
});
