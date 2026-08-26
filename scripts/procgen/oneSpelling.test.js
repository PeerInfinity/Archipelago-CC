/**
 * oneSpelling — **THE ONE-SPELLING LAW, AS A FILE GATE.** R9 slice P3 (E),
 * trap 729.
 *
 * ⛔⛔ THE ROWS BELOW RUN AGAINST THE REAL TREE, and the mutant is applied to a
 * REAL FILE'S BYTES rather than to a fixture built to agree with the checker.
 * A lint calibrated against its own toy input is the shape §42.8 dissolved
 * four claims of.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
    ALLOWED_SITES, FORBIDDEN, TRANSCRIPTIONS, definitionsOf, liveSites,
    outsideTheBound, secondSpellings, stripInert, transcriptionSubject,
} from './oneSpelling.js';

const REPO = process.cwd();
const V1 = 'frontend/modules/seedlingDemo/playerPhysicsV1.js';

describe('R9 P3 (E): one transcription of `Point.length`, and one spelling in its reach', () => {
    /**
     * ⛓⛓⛓ THE LAW'S FIRST HALF. `finalBossFight.js` used to define its own
     * `export const pointLength = (x, y) => Math.sqrt(x * x + y * y)` — the
     * same three tokens `playerPhysicsV1.js` had already transcribed, in a
     * second file. Two spellings of one runtime primitive agree until one
     * moves, and the whole reason this primitive is transcribed at all is that
     * a LAST BIT decided an arm (R6 slice 6h, trap 118).
     */
    it('⛓⛓⛓ each transcription is defined EXACTLY ONCE in the model', () => {
        const defs = definitionsOf({ repo: REPO });
        for (const name of TRANSCRIPTIONS) {
            expect(defs.get(name), `${name} is defined in ${defs.get(name)?.join(' and ')}`)
                .toHaveLength(1);
        }
        // …and both live in the same file, which is what makes it THE home
        expect(new Set([...defs.values()].flat()).size).toBe(1);
    });

    /**
     * ⛔⛔ THE LAW'S SECOND HALF, WITH AN **EMPTY** ALLOW-LIST. A new spelling
     * inside the subject is a red line, never an allow entry: the subject is
     * precisely the set where the last bit is the answer. If a site genuinely
     * needs the accurate function it does not belong in a transcription module
     * — move the site, not the law.
     */
    it('⛔⛔ no live second spelling anywhere in the transcription\'s reach', () => {
        expect(ALLOWED_SITES).toEqual([]);
        const rows = secondSpellings({ repo: REPO });
        expect(rows.map((r) => `${r.file}:${r.line} ${r.token}`)).toEqual([]);
    });

    /**
     * ⛓ THE SUBJECT IS AN IMPORT-GRAPH ANSWER, NOT A GREP. `r6Acceptance.js`
     * MENTIONS `pointLength` in a comment and is NOT a member — a lint that
     * grepped for the name would have let prose decide its own subject, which
     * is the very thing ⚖ ruling 17 forbids.
     */
    it('⛓ the subject is derived from imports, and prose does not join it', () => {
        const subject = transcriptionSubject({ repo: REPO });
        expect(subject).toContain(V1);
        expect(subject).toContain('frontend/modules/seedlingDemo/finalBossFight.js');
        expect(subject).toContain('frontend/modules/seedlingDemo/sealCeremony.js');
        expect(subject).not.toContain('frontend/modules/seedlingDemo/r6Acceptance.js');
        // …and that file really does spell the name, so the row is not vacuous
        expect(readFileSync(join(REPO, 'frontend/modules/seedlingDemo/r6Acceptance.js'), 'utf8'))
            .toContain('pointLength');
    });

    /**
     * ⛓⛓ **THE BOUND NAMES WHAT IT EXCLUDES.** `Math.hypot` is not wrong
     * everywhere — it is wrong where the answer must be the RUNTIME's double.
     * A "0 findings" line that did not print this list would read as a claim
     * about the whole tree (trap 771's family).
     */
    it('⛓⛓ the excluded population is enumerated, not implied', () => {
        const outside = outsideTheBound({ repo: REPO });
        expect(outside.length).toBeGreaterThan(0);
        const byFile = new Map(outside.map((r) => [r.file, r.sites]));
        // the planner's distances never reach a tape — the largest exclusion
        expect(byFile.get('frontend/modules/seedlingDemo/solverBot.js'))
            .toBeGreaterThan(20);
        // …and a zero-test, where every monotone length gives the same boolean
        expect(byFile.get('frontend/modules/seedlingDemo/playerPhysicsV2.js')).toBe(1);
        for (const r of outside) {
            expect(transcriptionSubject({ repo: REPO })).not.toContain(r.file);
        }
    });
});

describe('R9 P3 (E): the reader tells a WARNING from a USE', () => {
    /**
     * ⛔⛔⛔ **THIS IS THE WHOLE DIFFERENCE BETWEEN A LINT AND A GREP.**
     * `Math.hypot` appears six times in the subject today and every one of
     * them is inside a docblock explaining why it must not be used. A grep
     * would report six violations, a reader would learn to ignore the lint,
     * and the seventh — a real one — would ride in behind them.
     */
    it('⛔⛔⛔ the subject really does spell the forbidden token in prose', () => {
        const text = readFileSync(join(REPO, V1), 'utf8');
        expect(text.split('Math.hypot').length - 1).toBeGreaterThanOrEqual(3);
        expect(liveSites(text)).toEqual([]);
    });

    it('⛓ strings and template literals are inert too', () => {
        expect(liveSites("const s = 'Math.hypot(a, b)';")).toEqual([]);
        expect(liveSites('const s = `use Math.hypot here`;')).toEqual([]);
        expect(liveSites('// Math.hypot\nconst x = 1;')).toEqual([]);
        expect(liveSites('/* Math.hypot */\nconst x = 1;')).toEqual([]);
    });

    it('⛓ …and a real use is found, with its line', () => {
        const rows = liveSites('const a = 1;\nconst b = Math.hypot(a, a);\n');
        expect(rows).toEqual([{ token: 'Math.hypot', line: 2 }]);
    });

    it('⛓ stripInert preserves line numbering', () => {
        const text = 'a\n/* two\nlines */\nMath.hypot(1, 2)\n';
        expect(stripInert(text).split('\n')).toHaveLength(text.split('\n').length);
        expect(liveSites(text)).toEqual([{ token: 'Math.hypot', line: 4 }]);
    });
});

describe('R9 P3 (E): (m5) — the mutant, on the real file\'s bytes', () => {
    /**
     * ⛓⛓⛓ **THE MUTANT IS THE DEFECT 12e⁗ ACTUALLY FIXED.** `knockbackImpulse`
     * used to read `Math.hypot(cx, cy)` with `cx / length` below it, while
     * `pointNormalize` twenty lines up spelled the SAME runtime function
     * `sqrt(x*x + y*y)` with `x * (thickness / length)`. Both are
     * `Point.normalize`; only one of them is the game's, and the difference
     * was 21 % of diagonals.
     *
     * ⛔ IT IS APPLIED TO THE REAL FILE'S BYTES, through the SAME function the
     * tree-level row runs — not to a fixture written to agree with the checker
     * ([[feedback_fixture_must_discriminate_two_builds]]).
     */
    it('⛔⛔ re-introducing `Math.hypot(cx, cy)` at `knockbackImpulse` REDS BY NAME', () => {
        const text = readFileSync(join(REPO, V1), 'utf8');
        const anchor = '    const n = pointNormalize(cx, cy, 1);';
        expect(text.split(anchor).length - 1,
            'the mutant\'s anchor must be UNIQUE, or it patches the wrong site').toBe(1);

        // the cured build: no live site anywhere in this file
        expect(liveSites(text)).toEqual([]);

        // (m5) the refuted spelling, put back exactly where it used to live
        const mutant = text.replace(anchor,
            '    const length = Math.hypot(cx, cy);\n'
            + '    const n = { x: cx / length, y: cy / length };');
        const rows = liveSites(mutant);
        expect(rows).toHaveLength(1);
        expect(rows[0].token).toBe('Math.hypot');

        // …and the line it names is `knockbackImpulse`'s, not some other file's
        const mutantLine = mutant.split('\n')[rows[0].line - 1];
        expect(mutantLine).toContain('Math.hypot(cx, cy)');
        const before = mutant.slice(0, mutant.indexOf(mutantLine));
        expect(before).toContain('export function knockbackImpulse(');
    });

    /**
     * ⛔ AND THE POSITIVE CONTROL FOR THE MUTANT ITSELF: the same edit made
     * OUTSIDE the subject is NOT a finding, so the row is discriminating the
     * subject and not merely the token.
     */
    it('⛓ the same spelling outside the subject is not a finding', () => {
        const outside = outsideTheBound({ repo: REPO })
            .map((r) => r.file);
        expect(outside.length).toBeGreaterThan(0);
        // those files carry live sites…
        for (const f of outside.slice(0, 3)) {
            expect(liveSites(readFileSync(join(REPO, f), 'utf8')).length).toBeGreaterThan(0);
        }
        // …and the law reports none, because they are not in its reach
        expect(secondSpellings({ repo: REPO })).toEqual([]);
    });

    it('⛓ FORBIDDEN is the doc\'s own second spelling, spelled once', () => {
        expect(FORBIDDEN).toEqual(['Math.hypot']);
    });
});
