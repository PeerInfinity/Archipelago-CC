/**
 * surveyFamily — the classifier's rows. R9 slice 12b″.
 *
 * ⛔ THE SLICE'S SUBJECT IS THE `playerHits` ARM (⚖ kickoff §23.15, mutant
 * (f)): a run that took damage before it refused is a HIT row, whatever its
 * message went on to say. Everything else here is the table as it stood, kept
 * so the extraction out of `survey-seedling-route.mjs` is asserted to have
 * moved the rules rather than rewritten them.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { FAMILY_RULES, familyOf } from './surveyFamily.js';

/** L14's own refusal at R9 slice 12's head — the sentence the arm is about. */
const CAMERA_BAND = 'levelRun: whether bob bob@32,32 is on screen at tick 44 depends on '
    + "where inside `Game.shake`'s jiggle the camera landed, and the two draws that "
    + 'decide it are not indexable (camera.js, "THE SHAKE, AND WHY IT IS A BAND").';

describe('familyOf — the text arm, unchanged by the extraction', () => {
    it('⛓ classifies the refusals the committed route produces', () => {
        expect(familyOf(CAMERA_BAND)).toMatch(/^CAMERA BAND/);
        expect(familyOf("solverBot: Strategy 'shove' failed to apply to the obstacle"))
            .toBe("VERB-APPLY — the 'shove' strategy IS registered and did not apply here");
        expect(familyOf('twoPassSolve: this clear needs a GAME-sourced tick'))
            .toMatch(/^ORACLE/);
        expect(familyOf('ladder: the combat ladder is EXHAUSTED after four rungs'))
            .toMatch(/^LADDER/);
    });

    it('⛓ a refusal matching nothing is NAMED as unclassified, never swallowed', () => {
        expect(familyOf('something nobody has a rule for')).toBe(
            'unclassified — see the refusal text');
    });

    it('⛓ no refusal at all is `null` — a SOLVED row has no family', () => {
        expect(familyOf(null)).toBeNull();
        // ⛔ and it stays null even with a hit-bearing run: the arm below is
        //   about a refusal that FOLLOWED damage, not about damage alone. A
        //   SOLVED row that took a hit is a different finding and this
        //   classifier is not the place it gets made.
        expect(familyOf(null, { playerHits: [{ t: 44 }] })).toBeNull();
    });
});

/**
 * ⛓⛓⛓ MUTANT (f) — the arm this slice owed.
 */
describe('familyOf — the `playerHits` arm (R9 slice 12b″, kickoff §23.15)', () => {
    it('⛔ a run that took a hit BEFORE refusing is the HIT family, by name', () => {
        const run = { playerHits: [{ t: 44 }] };
        const family = familyOf(CAMERA_BAND, run);
        expect(family).toMatch(/^HIT — the run took 1 hit\(s\), the first at tick 44/);
        // ⛓ THE POINT, ASSERTED: the same refusal without the run is the
        //   camera-band row. One text, two families, decided by the RUN.
        expect(familyOf(CAMERA_BAND)).toMatch(/^CAMERA BAND/);
        expect(family).not.toMatch(/^CAMERA BAND/);
    });

    it('⛓ it counts what it found and does not invent a tick it was not given', () => {
        expect(familyOf(CAMERA_BAND, { playerHits: [{ t: 44 }, { t: 91 }] }))
            .toMatch(/took 2 hit\(s\), the first at tick 44/);
        // a hit record with no `t` is reported as a COUNT and nothing more
        expect(familyOf(CAMERA_BAND, { playerHits: [{}] }))
            .toMatch(/^HIT — the run took 1 hit\(s\) BEFORE it refused/);
    });

    it('⛓ an EMPTY hit list is not a hit — the text arm still answers', () => {
        expect(familyOf(CAMERA_BAND, { playerHits: [] })).toMatch(/^CAMERA BAND/);
        expect(familyOf(CAMERA_BAND, {})).toMatch(/^CAMERA BAND/);
        expect(familyOf(CAMERA_BAND, null)).toMatch(/^CAMERA BAND/);
    });

    /**
     * ⛔⛔ MUTANT (e) — THE ORDER IS THE CLAIM, and the row proves the order
     * rather than trusting the source. Every refusal this survey has ever
     * seen matches one of `FAMILY_RULES`, so a text loop asked FIRST returns
     * before the hits are ever looked at: the arm would be dead code that
     * reads as covered.
     */
    it('⛔ asked AFTER the text loop the arm is DEAD — the mutant, built here', () => {
        const mutant = (refusal, run) => {
            for (const [re, family] of FAMILY_RULES) {
                const m = re.exec(refusal);
                if (m) return typeof family === 'function' ? family(m) : family;
            }
            const hits = run?.playerHits;
            if (Array.isArray(hits) && hits.length) return 'HIT';
            return 'unclassified — see the refusal text';
        };
        expect(mutant(CAMERA_BAND, { playerHits: [{ t: 44 }] })).toMatch(/^CAMERA BAND/);
        expect(familyOf(CAMERA_BAND, { playerHits: [{ t: 44 }] })).toMatch(/^HIT/);
    });
});

/**
 * ⛔⛔ THE ARM REACHES NOTHING ON TODAY'S ROUTE, AND THE ROW SAYS SO OUT LOUD
 * (trap 475: a declared axis that reaches nothing prints a complete-looking
 * table; trap 568: an INPUT scan is not REACH).
 *
 * The survey builds `replay` only for a step that SOLVED, and a SOLVED step
 * has no refusal — so at the one call site the run argument is null wherever
 * a family is actually computed. This is asserted against the SOURCE, because
 * the claim is about the call site rather than about the classifier.
 */
describe('the arm\'s reach, named rather than assumed', () => {
    it('⚠ the survey\'s only call site passes `res.replay`, which a REFUSED row lacks', () => {
        const src = readFileSync(
            new URL('./survey-seedling-route.mjs', import.meta.url), 'utf8');
        const calls = [...src.matchAll(/familyOf\([^)]*\)/g)].map((m) => m[0]);
        expect(calls).toEqual(['familyOf(res.refusal, res.replay)']);
        // …and `replay` is null unless the step solved — the survey's own line
        expect(src).toMatch(/let replay = null;/);
        expect(src).toMatch(/if \(solved\) \{\n\s+const run = makeRun\(solved\.persistence\);/);
    });
});
