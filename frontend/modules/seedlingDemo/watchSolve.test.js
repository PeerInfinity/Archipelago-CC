/**
 * watchSolve — the editor page's SOLVE arm, tested where it is pure.
 *
 * ⚠ WHAT THESE TESTS ARE, AND WHAT THEY ARE NOT. Every claim here is about
 * the PAGE — does its parameter parsing, its census reading and its
 * staging extraction agree with the RUNNER's — and none of them is a claim
 * about the game. The page is TOOLING ONLY and nothing that makes a claim
 * about the game may depend on it: the game's oracle is the differential,
 * and this file's oracle is the runner the page must not disagree with.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    censusGoalOptions, censusWorld, defaultGoalsFromCensus, formatGoalsParam,
    harvestPresets, parseGoalsParam, readSolveParams, solveForPage, stagingFromJson,
} from './watchSolve.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { TAPES_DIR } from './fixtures/index.js';

const levelSource = atlasLevelSource();
const readTape = (name) => JSON.parse(readFileSync(join(TAPES_DIR, `${name}.json`), 'utf8'));
const stagingOf = (name) => stagingFromTape(parseTape(readTape(name)));

describe('the ?goals= vocabulary', () => {
    it('round-trips the solver\'s own two goal kinds', () => {
        const goals = [
            { kind: 'collect-placement', placement: { x: 120, y: 88 } },
            { kind: 'reach-exit', exit: { x: 64, y: 16 } },
        ];
        const param = formatGoalsParam(goals);
        expect(param).toBe('place:120,88;exit:64,16');
        expect(parseGoalsParam(param)).toEqual(goals);
    });

    it('keeps the ORDER, which is the order solved', () => {
        expect(parseGoalsParam('exit:1,2;place:3,4').map((g) => g.kind))
            .toEqual(['reach-exit', 'collect-placement']);
    });

    it('REFUSES a malformed entry by name instead of skipping it', () => {
        // A dropped goal would solve a different segment and say nothing.
        expect(() => parseGoalsParam('exit:64,16;reach the door'))
            .toThrow(/goals\[1\] is "reach the door"/);
        expect(() => parseGoalsParam('place:1')).toThrow(/not `exit:X,Y` or `place:X,Y`/);
    });

    it('an empty parameter is NO goals, not a malformed one', () => {
        expect(parseGoalsParam('')).toEqual([]);
        expect(parseGoalsParam(null)).toEqual([]);
    });
});

describe('the census the goal picker offers', () => {
    it('speaks the runner\'s own OEL coordinates for L4\'s two exits', () => {
        const world = censusWorld(levelSource, stagingOf('r7-act2-4'));
        const specs = censusGoalOptions(world).map((o) => o.spec);
        // (64,16) is the exit `solve-seedling-r8-battery`'s `goalsFor(4)`
        // derives from the chain's own units — the picker and the battery
        // name the same cell, which is what makes the two comparable.
        expect(specs).toContain('exit:64,16');
        expect(specs).toContain('exit:0,16');
        expect(censusGoalOptions(world).every((o) => o.usable)).toBe(true);
    });

    it('LISTS a deactivated exit rather than dropping it', () => {
        const world = {
            level: 99,
            pickups: [],
            chests: [],
            teleporters: [{ x: 8, y: 8, to: 7, deactivated: true, isStairs: false, tag: 3 }],
        };
        const [only] = censusGoalOptions(world);
        expect(only.usable).toBe(false);
        expect(only.label).toMatch(/DEACTIVATED \(tag 3 not cleared\)/);
        expect(only.why).toMatch(/STAGING change, not a goal/);
        // "one exit, shut" must not read as "no exit".
        expect(only.spec).toBe('exit:8,8');
    });
});

describe('the ?solve=1 default', () => {
    it('REFUSES L4 — two live exits is not one default', () => {
        const world = censusWorld(levelSource, stagingOf('r7-act2-4'));
        const { goals, refusal } = defaultGoalsFromCensus(world);
        expect(goals).toBeNull();
        expect(refusal).toMatch(/2 live exit\(s\)/);
        // …and it hands over the spelling that selects each candidate.
        expect(refusal).toContain('exit:64,16');
        expect(refusal).toContain('exit:0,16');
    });

    it('takes the single live exit, placements first', () => {
        const world = {
            level: 12,
            pickups: [{ tag: 'sword', x: 40, y: 40 }],
            chests: [],
            teleporters: [
                { x: 8, y: 8, to: 7, deactivated: false, isStairs: false, tag: -1 },
                { x: 9, y: 9, to: 6, deactivated: true, isStairs: false, tag: 2 },
            ],
        };
        const { goals, refusal } = defaultGoalsFromCensus(world);
        expect(refusal).toBeNull();
        expect(goals).toEqual([
            { kind: 'collect-placement', placement: { x: 40, y: 40 } },
            { kind: 'reach-exit', exit: { x: 8, y: 8 } },
        ]);
    });
});

describe('the staging block, from whatever JSON the caller has', () => {
    it('extracts a committed TAPE\'s block and drops its inputs', () => {
        const staging = stagingFromJson(readTape('r7-act2-4'));
        expect(staging.boot).toEqual({ level: 4, x: 16, y: 16 });
        expect(staging.rng.seed).toBe(2057886025);
        expect(staging).not.toHaveProperty('inputs');
        expect(staging).not.toHaveProperty('tick_count');
    });

    it('round-trips a BARE block — what the textarea holds', () => {
        const bare = stagingOf('r7-act2-4');          // no inputs, no tick_count
        expect(stagingFromJson(bare)).toEqual(bare);
    });

    it('gives a malformed block the TAPE PARSER\'s own message, not a second one', () => {
        const bad = { ...stagingOf('r7-act2-4'), boot: { level: 'four', x: 16, y: 16 } };
        expect(() => stagingFromJson(bad)).toThrow(/boot/i);
    });

    /**
     * ⚠ A PARTIAL block is REFUSED, and that is the honest arm. The v8
     * vocabulary has no defaults — `noclip` "selects which physics both
     * consumers run" and `noDamage` "selects whether Player.hit() runs" —
     * so a page that filled them in would be choosing an experiment on the
     * user's behalf and calling it their declaration. The parser names the
     * first field it is missing, which is a message you can act on.
     */
    it('REFUSES a partial block by naming the field, rather than defaulting it', () => {
        expect(() => stagingFromJson({ boot: { level: 4, x: 16, y: 16 } }))
            .toThrow(/noclip must be a boolean/);
    });
});

describe('the PRESETS harvest', () => {
    it('is the committed tape\'s OWN staging block, field for field', () => {
        const tape = readTape('r7-act2-4');
        const { presets, refused } = harvestPresets([{ name: 'r7-act2-4', tape }]);
        expect(refused).toEqual([]);
        expect(presets[0].staging).toEqual(stagingFromTape(parseTape(tape)));
        // The fields that make the seam a MEASURED equality rather than a
        // retype — nothing here could be typed by hand.
        expect(presets[0].staging.rng.seed).toBe(2057886025);
        expect(presets[0].staging.seam.time).toBe(5334);
        expect(presets[0].staging.pins).toEqual(['dead_frames']);
    });

    it('REPORTS a tape it cannot parse instead of shrinking the list', () => {
        const { presets, refused } = harvestPresets([
            { name: 'good', tape: readTape('r7-act2-4') },
            { name: 'bad', tape: { game: 'seedling', tape_version: 8 } },
        ]);
        expect(presets.map((p) => p.name)).toEqual(['good']);
        expect(refused).toHaveLength(1);
        expect(refused[0].name).toBe('bad');
        expect(refused[0].why).toBeTruthy();
    });
});

describe('SOURCE selection from the URL', () => {
    it('?tape= alone is still REPLAY — the existing URLs are untouched', () => {
        const p = readSolveParams('?tape=fixtures/tapes/x.json&side=js&speed=2');
        expect(p.source).toBe('replay');
        expect(p.level).toBeNull();
    });

    it('any SOLVE parameter selects SOLVE', () => {
        expect(readSolveParams('?level=4').source).toBe('solve');
        expect(readSolveParams('?boot=a/b.json').source).toBe('solve');
        expect(readSolveParams('?solve=1').source).toBe('solve');
        expect(readSolveParams('?level=4').level).toBe(4);
        expect(readSolveParams('?solve=1').solve).toBe(true);
    });

    it('an explicit ?source= wins', () => {
        expect(readSolveParams('?source=replay&level=4').source).toBe('replay');
    });
});

describe('the SOLVE itself', () => {
    /**
     * ⛓⛓⛓ THE SLICE'S ACCEPTANCE ROW, model side — and the tick count is
     * pinned because it came from OUTSIDE this code path.
     *
     * ⛔ 255, AND THE COMMITTED ARTIFACT SAYS 253 (trap 169). The drift is
     * real, it predates this arc, and it is NOT a tolerance: the page must
     * match TODAY's derivation exactly. A page that matched the committed
     * 253 would have built a world neither the runner nor the game has.
     * Closing the gap is a re-record, and no licence exists this arc.
     */
    it('the page\'s own path derives r8-solve-4 exactly as the runner does', () => {
        const staging = stagingOf('r7-act2-4');
        const goals = parseGoalsParam('exit:64,16');   // = `goalsFor(4)`
        const { out, tape, ms } = solveForPage({
            levelSource, staging, goals, name: 'r8-solve-4',
        });
        expect(out.perTick).toHaveLength(255);
        expect(tape.tick_count).toBe(255);
        expect(tape.tape_version).toBe(8);
        // The staging block travels through UNCHANGED. A page that re-typed
        // any of it would be solving from a room the game never handed over.
        expect(tape.rng).toEqual(staging.rng);
        expect(tape.seam).toEqual(staging.seam);
        expect(tape.pins).toEqual(staging.pins);
        expect(tape.save).toEqual(staging.save);
        expect(typeof ms).toBe('number');

        expect(readTape('r8-solve-4').tick_count).toBe(253);   // trap 169, named
    });

    it('the folded tape REPLAYS through the same stepper the viewer uses', () => {
        const staging = stagingOf('r7-act2-4');
        const { tape, out } = solveForPage({
            levelSource, staging, goals: parseGoalsParam('exit:64,16'), name: 'editor-L4',
        });
        // Solve-then-scrub: the frames the page scrubs come from the ONE
        // loop, over the tape the solve folded. An N-tick tape yields N+1
        // observations (`tapeRunner`'s own off-by-one note).
        const stepper = createTapeStepper(tape, { levelSource });
        const frames = [];
        for (let r = stepper.next(); !r.done; r = stepper.next()) frames.push(r.value);
        expect(frames).toHaveLength(out.perTick.length + 1);
        expect(frames[frames.length - 1].observation.t).toBe(255);
    });

    it('carries the solver\'s own refusals through verbatim', () => {
        const staging = stagingOf('r7-act2-4');
        expect(() => solveForPage({ levelSource, staging, goals: [], name: 'x' }))
            .toThrow(/goals must be a non-empty ordered list/);
    });
});
