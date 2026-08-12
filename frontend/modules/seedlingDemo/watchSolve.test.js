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
    harvestPresets, itemFlagsOf, ITEM_FORM_FIELDS, parseGoalsParam, readSolveParams,
    solveForPage, stagingFromJson, TRUE_START_CHAIN, TRUE_START_SEGMENT, withItemFlag,
} from './watchSolve.js';
import { parseTape, requiredTapeVersion, SEAM_BOOT_SPEC } from './tapeFormat.js';
import {
    createRunForStaging, createTapeStepper, solveStaging, stagingFromTape,
} from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { DEFAULT_MAX_TICKS_PER_TARGET } from './botDriverV1.js';
import { PLAYTHROUGH_CHAINS } from './playthroughWalk.js';
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

    /**
     * ⛓⛓⛓ SLICE 5 — EVERY COMMITTED BOOT SURVIVES THE TEXTAREA, and six of
     * them did not before.
     *
     * The bare arm completed the block with `{tape_version: 8, tick_count:
     * 0}` — two literals that are properties of the WRAPPER and that
     * `parseTape` reads as claims about the BLOCK. v8 means "no
     * `persistence[].at`" and tick_count 0 bounds every declared `at` to
     * `[0, 0]`, so a v9 boot and the v10 despawn pair could not round-trip
     * through the page's own editor at all.
     *
     * ⚠ IT MATTERED THE MOMENT ANYTHING READ THE BOX. The MANUAL arm has
     * re-read it at START since slice 3 and the SOLVE arm now does at press
     * time, so this was a live refusal on both — found by the CLI's
     * acceptance row on the first run after the re-read landed, not by
     * inspection.
     */
    it('⛓⛓⛓ EVERY COMMITTED BOOT ROUND-TRIPS THROUGH THE TEXTAREA', () => {
        const cases = [
            ['r7-act2-4', 8], ['r8-solve-18', 9], ['r7-act2-6', 10], ['r7-act2-full', 10],
        ];
        for (const [name, version] of cases) {
            const staging = stagingFromJson(readTape(name));
            // What the page puts in the box, and what it reads back out.
            const back = stagingFromJson(JSON.parse(JSON.stringify(staging)));
            expect(back).toEqual(staging);
            // ⛓ And the version really is DERIVED — a v10 block completed as
            // a v8 tape was the failure, so the row names the number.
            expect(requiredTapeVersion(back, 8)).toBe(version);
        }
    });

    it('⛔ an explicitly DECLARED version is honoured, not overridden', () => {
        // A caller who types `tape_version` means it; deriving over the top
        // would silently accept a block the declared version forbids.
        expect(() => stagingFromJson({ ...stagingOf('r8-solve-18'), tape_version: 8 }))
            .toThrow(/tape_version 8 has no mid-run clear/);
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

    /**
     * ⛓⛓ PROCGEN PoC SLICE 1 — the `maxTicksPerTarget` pass-through, DRIVEN
     * IN BOTH DIRECTIONS.
     *
     * An optional parameter tested only when it is present proves nothing
     * about the case every existing caller is in, and one tested only when it
     * is absent proves nothing at all. So: absent must still reach
     * `solveSegment`'s own default (the row above pins that derivation at 255
     * ticks — this asserts the DEFAULT is what produces it), and present must
     * actually bound the walk.
     */
    it('maxTicksPerTarget ABSENT still reaches the solver\'s own default', () => {
        const staging = stagingOf('r7-act2-4');
        const goals = parseGoalsParam('exit:64,16');
        const absent = solveForPage({ levelSource, staging, goals, name: 'r8-solve-4' });
        const explicit = solveForPage({
            levelSource, staging, goals, name: 'r8-solve-4',
            maxTicksPerTarget: DEFAULT_MAX_TICKS_PER_TARGET,
        });
        expect(absent.out.perTick).toHaveLength(255);
        // ⛔ Passing the default EXPLICITLY must be the same solve, key for
        // key — which is what "the absence forwards `undefined`" means.
        expect(explicit.out.perTick).toEqual(absent.out.perTick);
    });

    it('maxTicksPerTarget PRESENT bounds the walk, and the refusal names it', () => {
        const staging = stagingOf('r7-act2-4');
        const goals = parseGoalsParam('exit:64,16');
        expect(() => solveForPage({
            levelSource, staging, goals, name: 'r8-solve-4', maxTicksPerTarget: 10,
        })).toThrow(/within 10 ticks/);
    });
});

// ── slice 5: the true-start default, and the boot form ───────────────────

describe('⛓⛓⛓ THE DEFAULT BOOT IS THE TRUE GAME START (slice 5)', () => {
    /**
     * ⛔ THE CROSS-BOUNDARY ASSERTION, and it is the whole reason the page
     * may hold a NAME rather than eleven fields.
     *
     * `playthroughWalk` imports `fixtures/index.js` and therefore `node:fs`,
     * so `watch.html` cannot read `PLAYTHROUGH_CHAINS` at all — one such
     * import made the entire page unloadable for two rungs (slice 1 §8.4).
     * This file runs in node, where it can, so the constant is CHECKED
     * against the chain instead of being a second list nobody compares.
     */
    it('names the honest chain\'s own SEGMENT 1, checked against the chain', () => {
        const chain = PLAYTHROUGH_CHAINS.find((c) => c.id === TRUE_START_CHAIN);
        expect(chain).toBeTruthy();
        expect(TRUE_START_SEGMENT).toBe(chain.segments[0]);
    });

    it('⛓ and that block really is a NEW GAME — not the atlas\'s door convention', () => {
        /**
         * The literal it replaced was `{level: 0, x: 16, y: 16}`, everything
         * else empty. This row is what makes the change a claim: the real
         * boot is elsewhere in the room, and it pins the fields the literal
         * got silently wrong.
         */
        const staging = stagingFromJson(readTape(TRUE_START_SEGMENT));
        expect(staging.boot).toEqual({ level: 0, x: 80, y: 128 });
        expect(staging.boot).not.toEqual({ level: 0, x: 16, y: 16 });
        // ⚠ …and the fields a hand-typed default had no way to know:
        expect(staging.pins).toEqual(['dead_frames']);
        expect(staging.rng).not.toBeNull();
        expect(staging.noclip).toBe(false);
        expect(staging.noDamage).toBe(false);
        // A start is a start: nothing cleared, nothing carried.
        expect(staging.persistence).toEqual([]);
        expect(staging.grants).toEqual([]);
        expect(staging.despawn).toEqual([]);
    });

    it('validates through the SAME parser path a pasted block takes', () => {
        // The page fetches the tape and hands it to `stagingFromJson` — the
        // `?boot=` path, unchanged — so this is that call, not a stand-in.
        expect(() => stagingFromJson(readTape(TRUE_START_SEGMENT))).not.toThrow();
        expect(stagingFromJson(readTape(TRUE_START_SEGMENT)))
            .toEqual(stagingOf(TRUE_START_SEGMENT));
    });
});

describe('⛓⛓⛓ THE BOOT FORM v1 — sword and shield (slice 5)', () => {
    /**
     * ⛔⛔ THE FIELD THE RULING NAMES DOES NOT EXIST WHERE IT SOUNDS LIKE IT
     * DOES. §12.4 says `save.hasSword`; a tape's version-6 `save` block is
     * `{totem_parts, keys, seal_parts}` and `parseSave` refuses any other
     * key BY NAME. `save.hasSword` is `SEAM_BOOT_SPEC[].field` — the GAME's
     * property path — and the wire key is `seam.items.hasSword`. This row
     * pins the translation so the form cannot drift onto the other space.
     */
    it('the form\'s two fields ARE seam spec rows, both key spaces', () => {
        for (const f of ITEM_FORM_FIELDS) {
            const row = SEAM_BOOT_SPEC.find((s) => s.key === f.key);
            expect(row).toBeTruthy();
            expect(row.field).toBe(f.field);
            expect(row.type).toBe('boolean');
            expect(row.modelled).toBe(true);
        }
        expect(ITEM_FORM_FIELDS.map((f) => f.id)).toEqual(['sword', 'shield']);
    });

    it('⚠ reads THREE states — declared true, declared false, and undeclared', () => {
        // `r7-act2-11` declares the sword true and the shield false; the
        // page's own default declares no seam at all.
        expect(itemFlagsOf(stagingOf('r7-act2-11'))).toEqual({ sword: true, shield: false });
        expect(stagingOf(TRUE_START_SEGMENT).seam).toBeNull();
        expect(itemFlagsOf(stagingOf(TRUE_START_SEGMENT)))
            .toEqual({ sword: null, shield: null });
    });

    it('⛓ a tick WRITES a real declaration, and the block still PARSES', () => {
        const before = stagingOf(TRUE_START_SEGMENT);
        const after = withItemFlag(before, 'sword', true);
        expect(itemFlagsOf(after)).toEqual({ sword: true, shield: null });
        // ⛔ THE ROUND TRIP IS THE ROW. The page serialises the edited block
        // into the textarea and re-parses it on the next keystroke, so a
        // write the parser then refuses would disable the form it came from.
        const back = stagingFromJson(JSON.parse(JSON.stringify(after)));
        expect(itemFlagsOf(back)).toEqual({ sword: true, shield: null });
        expect(back.seam).toEqual({ items: { hasSword: true } });
    });

    it('⚠ writes ONLY the flag it was given — a partial seam stays partial', () => {
        /**
         * A form that filled in the other twelve item flags would make the
         * page claim state nobody measured — `seamToBlock`'s own law: "not
         * declared" and "declared at the fresh-page value" are different
         * segments and only one can be checked against a predecessor.
         */
        const both = withItemFlag(withItemFlag(stagingOf(TRUE_START_SEGMENT), 'sword', true),
            'shield', false);
        expect(both.seam).toEqual({ items: { hasSword: true, hasShield: false } });
    });

    it('⛓ and it edits a DECLARED block in place, leaving the other twelve alone', () => {
        const before = stagingOf('r7-act2-11');
        const after = withItemFlag(before, 'shield', true);
        expect(after.seam.items.hasShield).toBe(true);
        expect(after.seam.items.hasSword).toBe(before.seam.items.hasSword);
        expect(Object.keys(after.seam).sort()).toEqual(Object.keys(before.seam).sort());
        expect(after.boot).toEqual(before.boot);
        expect(after.rng).toEqual(before.rng);
    });

    it('⛔ an unknown field is a NAMED refusal, not a silently ignored tick', () => {
        expect(() => withItemFlag(stagingOf(TRUE_START_SEGMENT), 'hasDarkSuit', true))
            .toThrow(/is not a boot-form field/);
    });

    it('⛓⛓ THE FLAG REACHES THE RUN — a ticked sword really arms the player', () => {
        /**
         * ⛔ THE CONSUMER, ASSERTED IN THE DRIVEN SYSTEM (the graceful-
         * fallback law). A checkbox that edited JSON nobody built a world
         * from would pass every row above and change nothing — which is
         * exactly what the SOLVE arm did with its whole textarea until this
         * slice re-read it at press time.
         */
        const runFor = (staging) => createRunForStaging(solveStaging(staging), levelSource);
        const off = runFor(stagingOf(TRUE_START_SEGMENT));
        const on = runFor(withItemFlag(stagingOf(TRUE_START_SEGMENT), 'sword', true));
        // ⚠ MEASURED AT `run.inventory` — the layer the seam block is APPLIED
        // to, not at the world the census reads. The sword changes no
        // placement in L0, so a census check would have been green either way
        // and proved nothing about whether the flag arrived.
        expect(off.inventory.hasSword).toBe(false);
        expect(on.inventory.hasSword).toBe(true);
        // …and only that flag: a form write is not a fresh inventory.
        expect({ ...on.inventory, hasSword: false }).toEqual(off.inventory);
    });
});
