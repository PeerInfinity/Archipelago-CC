/**
 * seedlingDemo/procgenCountableClock.test — **THE COUNTABLE CLOCK**, driven
 * from both ends.
 *
 * Seedling PROCGEN PoC arc, slice 4e (kickoff §4.4e — ⚖ the USER's own catch).
 * A generated boot declared no `save.time`, so `run.gameTimeAt` answered `null`
 * and `dangerMap.spinnerDanger` fell back to the 13 px union over all 45 hammer
 * phases — in every generated solve this arc has ever run.
 *
 * ── THE CHAIN, AND EVERY LINK IS ASSERTED HERE ────────────────────────
 *
 *   `bootStaging`      declares `seam.time`                       (case 2)
 *   `createLevelRun`   `seamBoot['save.time']` present ⇒ a clock  (case 3)
 *   `spinnerDanger`    a countable clock ⇒ the exact `collideLine` (case 4)
 *
 * ⛔ **THE ASSERTION IS ON `arm`, THE ENGINE'S OWN VOCABULARY**, never on the
 * why-string. `spinnerDanger` stamps `arm: 'disc' | 'body' | 'hammer'` on every
 * entry it emits, so "did the fallback fire" is a field and not a sentence —
 * and a test that grepped the sentence would be pinned to prose the engine is
 * free to reword ([[feedback_report_channel_borrows_gate_vocabulary]], the
 * avoidable side).
 *
 * ── ⚠ RED AT THE PARENT, AND WHICH CASES ARE NOT ──────────────────────
 *
 * Cases 3 and 4 are the flip and are RED at `ea181607a` (measured by revert,
 * not predicted). Case 1's format bound and case 5's `time: null` control are
 * GREEN at both ends ON PURPOSE: the bound is a fact this slice DISCOVERED and
 * did not change, and the control asserts the parent's own behaviour, which
 * would be a strange thing to have broken.
 *
 * ⛔ THE `time: null` CONTROL IS WHY THE FLIP IS DRIVEN RATHER THAN CLAIMED.
 * Both arms run through ONE code path with one argument different, so "the disc
 * is gone" and "the disc was never reachable from here" cannot print the same
 * thing ([[feedback_bounded_sweep_must_name_what_it_bounded]]).
 */

import { describe, expect, it } from 'vitest';

import {
    atlasOf, bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain,
} from './procgenLevel.js';
import {
    DEFAULT_BUDGET, GENERATED_BOOT_TIME, VERDICT, bootStaging, collectGoal, solve,
} from './procgenOracle.js';
import { createRunForStaging, solveStaging } from './tapeRunner.js';
import { POST_SWORD_ITEMS } from './procgenPalette.js';
import { SPINNER } from './spinner.js';
import { buildStagedTape } from './botDriverV1.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { parseTape } from './tapeFormat.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { spinnerDanger } from './dangerMap.js';

const LEVEL = 900;
const START = { tx: 1, ty: 1 };

/**
 * The kill-lock sweep's own room (`scripts/procgen/sweep-seedling-killlock.mjs`
 * bounds: wall `ty=5`, gap `tx=5`, goal (7,8), lock tag 1, goal tag 0) with the
 * spinner at (3,3). ⛓ The geometry is the sweep's rather than a new one so the
 * module proof and the instrument are talking about the same room.
 */
function spinnerRoom(spinnerTx = 3, spinnerTy = 3) {
    let record = emptyLevel({ level: LEVEL });
    const wall = [];
    for (let tx = 1; tx <= 8; tx += 1) {
        if (tx !== 5) wall.push({ tx, ty: 5, terrain: 'wall' });
    }
    record = withTerrain(record, wall);
    return withEntities(record, [
        { type: 'torchpickup', ...oelAtTile(7, 8), attrs: { tag: '0' } },
        { type: 'lock', ...oelAtTile(5, 5), attrs: { tset: '-1', tag: '1' } },
        { type: 'spinner', ...oelAtTile(spinnerTx, spinnerTy), attrs: { tag: '-1' } },
    ]);
}

/** A run over that room, staged the way `procgenOracle` stages one. */
function runFor(record, { time } = {}) {
    const staging = bootStaging({
        boot: bootAtTile(record, START.tx, START.ty),
        items: POST_SWORD_ITEMS,
        pins: ['dead_frames'],
        ...(time === undefined ? {} : { time }),
    });
    return createRunForStaging(
        solveStaging(staging), levelSourceFromAtlas(atlasOf(record)),
        { scratchPersistence: true },
    );
}

/** Every `arm` the danger map reports for a box, at a forecast horizon. */
const armsAt = (run, box, horizon) => spinnerDanger(run, box, horizon).map((d) => d.arm);

describe('procgen — the countable clock (slice 4e)', () => {
    /**
     * ⛔⛔ CASE 1 — THE VALUE IS `dayLength / 2`, AND ZERO IS NOT AVAILABLE.
     *
     * ⚖ The slice's charge named `save.time: 0`. The format refuses it, and its
     * own why-string is the reason: `Main.as:158` is
     * `get time() { if (!SAVE_FILE.data.time) return Game.dayLength / 2; … }`,
     * so a stored 0 would be APPLIED as a DIFFERENT state than declared —
     * `SEAM_BOOT_SPEC`'s `time` row is `exclusiveMin` at 0 for exactly that.
     *
     * ⛓ [[feedback_declared_bound_excludes_generated_ids]], the arc's SECOND
     * arrival: slice 4b (§13.4) found `persistence[].level` bounded to 0..115
     * while `boot.level` was not, so a generated level could be booted by a tape
     * and never declared about by one. Same shape, one field over.
     */
    it('declares `dayLength / 2`, the value a stored 0 would have MEANT', () => {
        // `Game.as:460` — `dayLength = 160 * Main.FPS`; `Main.as:27` — FPS 60.
        expect(GENERATED_BOOT_TIME).toBe((160 * 60) / 2);
        expect(GENERATED_BOOT_TIME).toBe(4800);
    });

    it('the tape format REFUSES 0 and ACCEPTS the declared value', () => {
        const record = spinnerRoom();
        const staging = solveStaging(bootStaging({
            boot: bootAtTile(record, START.tx, START.ty), items: POST_SWORD_ITEMS,
        }));
        const tape = buildStagedTape({ staging, perTick: [], name: 'clock-bound' });
        // The value this slice declares survives the round trip.
        expect(parseTape(tape).seam.time).toBe(GENERATED_BOOT_TIME);
        // ⛔ VERBATIM — the format's own sentence, which is the finding.
        expect(() => parseTape({ ...tape, seam: { ...tape.seam, time: 0 } }))
            .toThrow(/seam\.time is 0, which must be > 0/);
        expect(() => parseTape({ ...tape, seam: { ...tape.seam, time: 0 } }))
            .toThrow(/0 is `Main\.time`'s falsy arm \(Game\.dayLength \/ 2\)/);
    });

    /** CASE 2 — the boot block, and its `null` escape. */
    it('`bootStaging` declares `seam.time`; `time: null` declares none', () => {
        const boot = bootAtTile(emptyLevel({ level: LEVEL }), START.tx, START.ty);
        expect(bootStaging({ boot }).seam.time).toBe(GENERATED_BOOT_TIME);
        expect(bootStaging({ boot, items: POST_SWORD_ITEMS }).seam)
            .toEqual({ items: { ...POST_SWORD_ITEMS }, time: GENERATED_BOOT_TIME });
        // ⛔ `null` is the PARENT — a seam with items but no clock…
        expect(bootStaging({ boot, items: POST_SWORD_ITEMS, time: null }).seam)
            .toEqual({ items: { ...POST_SWORD_ITEMS } });
        // …and a wholly empty block is still `null`, which is what
        // `parseSeam` reads as "declares no boot state".
        expect(bootStaging({ boot, time: null }).seam).toBeNull();
    });

    it('refuses a time the format could not carry, by name', () => {
        const boot = bootAtTile(emptyLevel({ level: LEVEL }), START.tx, START.ty);
        expect(() => bootStaging({ boot, time: 0 }))
            .toThrow(/must be a positive number or null/);
        expect(() => bootStaging({ boot, time: -1 })).toThrow(/`Main\.time`/);
    });

    /**
     * ⛔ CASE 3 — THE FLIP AT THE RUN. **RED AT THE PARENT**, where the refusal
     * is `levelRun`'s own *"the boot block declares no `save.time`"*.
     */
    it('a generated room\'s run COUNTS `Game.time`', () => {
        const run = runFor(spinnerRoom());
        expect(run.gameTimeRefusal).toBeNull();
        expect(run.gameTime).toEqual(expect.any(Number));
        // ⛓ The horizon arithmetic is the clock's own: `now + horizon`.
        expect(run.gameTimeAt(2)).toBe(run.gameTime + 2);
        // The pin the clock gates on is the one this staging declares.
        expect(run.gameTimeAt(0)).toBeGreaterThan(GENERATED_BOOT_TIME);
    });

    it('the CONTROL — with no declared time the run refuses, by name', () => {
        const run = runFor(spinnerRoom(), { time: null });
        expect(run.gameTimeRefusal).toBe('the boot block declares no `save.time`');
        expect(run.gameTime).toBeNull();
        expect(run.gameTimeAt(2)).toBeNull();
    });

    /**
     * ⛔⛔ CASE 4 — THE ARM. **RED AT THE PARENT.**
     *
     * The subject is a box one hammer-length off the spinner's own point: inside
     * the all-phases disc by construction, and inside the exact line only at the
     * phases whose angle points at it. So the parent MUST answer `disc` and the
     * child must answer something else — `hammer` when the phase happens to
     * point there, nothing at all when it does not, and never `disc`.
     */
    it('prices a spinner by the exact hammer LINE, never the all-phases disc', () => {
        const record = spinnerRoom();
        const withClock = runFor(record);
        const parent = runFor(record, { time: null });
        const body = (withClock.spinnerBodies ?? [])[0];
        expect(body).toBeTruthy();
        // Eight boxes on the disc's own rim — every one of them inside the
        // 13 px union, so the parent has no clear answer to give.
        const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
            .map(([sx, sy]) => [sx * (SPINNER.hammerLength - 2), sy * (SPINNER.hammerLength - 2)]);
        const boxes = offsets.map(([dx, dy]) => playerBoxAt(body.x + dx, body.y + dy));

        // THE PARENT: the fallback fires on every one of them.
        for (const box of boxes) expect(armsAt(parent, box, 2)).toEqual(['disc']);

        // THE CHILD: the fallback fires on NONE of them…
        const armsWithClock = boxes.map((box) => armsAt(withClock, box, 2));
        expect(armsWithClock.flat()).not.toContain('disc');
        // …and the wall it does draw is strictly narrower — at least one of the
        // eight is now CLEAR, which is the whole value of the exact line.
        expect(armsWithClock.filter((a) => a.length === 0).length).toBeGreaterThan(0);
        // ⛓ NOT VACUOUS: the map still prices the body itself. A run that had
        // simply stopped answering would pass the two assertions above.
        expect(armsAt(withClock, playerBoxAt(body.x, body.y), 2)).toEqual(['body']);
    });

    /**
     * ⛓ CASE 5 — THE ARMS THE CLOCK MAKES AVAILABLE ARE THE ENGINE'S, and this
     * asserts the population rather than a count (trap 202): with a clock the
     * only arms `spinnerDanger` can emit are `body` and `hammer`, and the phase
     * it names is the run's own clock modulo the hammer period.
     */
    it('names the phase it priced, from the run\'s own clock', () => {
        const record = spinnerRoom();
        const run = runFor(record);
        const body = (run.spinnerBodies ?? [])[0];
        const at = run.gameTimeAt(2);
        const hits = [];
        for (let a = 0; a < 360; a += 5) {
            const r = SPINNER.hammerLength - 2;
            const box = playerBoxAt(body.x + r * Math.cos(a * Math.PI / 180),
                body.y + r * Math.sin(a * Math.PI / 180));
            hits.push(...spinnerDanger(run, box, 2));
        }
        expect(hits.length).toBeGreaterThan(0);
        for (const h of hits) expect(['body', 'hammer']).toContain(h.arm);
        const hammers = hits.filter((h) => h.arm === 'hammer');
        expect(hammers.length).toBeGreaterThan(0);
        for (const h of hammers) {
            expect(h.why).toContain(`Game.time ${at} (phase ${at % SPINNER.hammerPeriod}/`);
        }
    });
});

/**
 * ⛓⛓⛓ THE ONE NAMED WIDENING — slice 4e step 3, DECIDED ON THE RE-MEASUREMENT.
 *
 * The clock retired 19 of the sweep's 26 hammer-transit throws, and the seven it
 * left are what forced this: a family whose failure mode ABORTS the run cannot
 * be offered to the loop (§13.7.iv). So `procgenOracle` now carries exactly the
 * hammer-SAFETY class as a REFUSAL — and NOTHING else, which is the half that
 * has to be driven, because traps 171/173 forbid the casual widening and not the
 * measured one.
 */
describe('procgen — the hammer-safety refusal is classifiable (slice 4e)', () => {
    const START = { tx: 1, ty: 1 };
    const GOAL = { tx: 7, ty: 8 };
    const goal = () => collectGoal(GOAL.tx * 16, GOAL.ty * 16);

    /** The kill-lock sweep's room, with the spinner where it is UNBEATABLE. */
    function room(entity) {
        let record = emptyLevel({ level: LEVEL });
        const wall = [];
        for (let tx = 1; tx <= 8; tx += 1) if (tx !== 5) wall.push({ tx, ty: 5, terrain: 'wall' });
        record = withTerrain(record, wall);
        return withEntities(record, [
            { type: 'torchpickup', ...oelAtTile(GOAL.tx, GOAL.ty), attrs: { tag: '0' } },
            ...entity,
        ]);
    }

    const solveRoom = (record) => solve(
        record,
        bootStaging({
            boot: bootAtTile(record, START.tx, START.ty),
            items: POST_SWORD_ITEMS,
            pins: ['dead_frames'],
        }),
        [goal()], DEFAULT_BUDGET,
        // ⛔ THE CLOCK IS INJECTED — §13.8's flake, not repeated: the wall-clock
        // budget is POST-HOC, so a loaded machine would otherwise turn this
        // verdict into a BUDGET_EXHAUSTED about the machine.
        { now: () => 0, name: 'hammer-safety' },
    );

    /**
     * ⛔ THE SUBJECT: cell (2,1), one of the seven the clock did NOT rescue.
     * A REFUSAL rather than a throw is the whole change — the candidate reverts
     * and the run lives.
     */
    it('a hammer-safety `SolverBotError` becomes REFUSED, text carried VERBATIM', () => {
        const out = solveRoom(room([
            { type: 'lock', ...oelAtTile(5, 5), attrs: { tset: '-1', tag: '1' } },
            { type: 'spinner', ...oelAtTile(2, 1), attrs: { tag: '-1' } },
        ]));
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.errorName).toBe('SolverBotError');
        expect(out.reasonText).toMatch(/hammer disc/);
        expect(out.classifiedBy).toMatch(/HAMMER SAFETY/);
        // ⛓ It is NOT a budget exhaustion: the refusal names no tick budget.
        expect(out.budgetKind).toBeUndefined();
    });

    /**
     * ⛔⛔ THE NEGATIVE, AND IT IS THE HALF THAT KEEPS THE CATCH NARROW.
     *
     * `bosslock` with no key throws `SolverBotError` too (§12.3's key+keylock
     * row) and says nothing about a hammer. It must still PROPAGATE — a loop
     * that reverted it would hide the undiagnosed keylock family behind "that
     * candidate didn't work out".
     */
    it('a NON-hammer `SolverBotError` still propagates', () => {
        let thrown = null;
        try {
            solveRoom(room([
                { type: 'bosslock', ...oelAtTile(5, 5), attrs: { keyType: '0' } },
            ]));
        } catch (e) { thrown = e; }
        expect(thrown).toBeTruthy();
        expect(thrown.name).toBe('SolverBotError');
        expect(thrown.message).not.toMatch(/hammer disc/);
    });
});
