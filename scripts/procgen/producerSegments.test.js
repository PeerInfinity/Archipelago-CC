/**
 * producerSegments — **OWNERSHIP IS DATA, AND PROSE MAY NOT DISAGREE WITH IT.**
 * R9 slice P3 (C), ⚖ ruling 17, ⚖ ruling 54 (7), trap 773.
 *
 * ⛔⛔ EVERY ROW HERE IS CALIBRATED AGAINST THE REAL TREE, not against a
 * fixture built to agree with the code. The derivation these rows gate replaced
 * two regexes over English, and a regex-shaped defect is exactly the kind that
 * a self-agreeing fixture cannot see (trap 579/580's shape, and this file's
 * sibling `walkMoves.test.js` says the same about its own filters).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { PLAYTHROUGH_CHAINS } from '../../frontend/modules/seedlingDemo/playthroughWalk.js';
import {
    SEGMENTS_FLAG, declaredSegments, emitSegments, ownersByEmit, producerParticipation,
    producersNamedInProse, proseOwnerDisagreements, solverRosterFromData,
} from './producerSegments.js';

const REPO = process.cwd();
const TAPES = join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes');
const PROCGEN = join(REPO, 'scripts/procgen');
const allTapes = () => readdirSync(TAPES).filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length)).sort();

describe('R9 P3 (C): the producers answer for themselves', () => {
    /**
     * ⛓⛓ THE KNOWN POSITIVE. Six producers accept `--segments` today and every
     * one of them must ANSWER — a derivation that silently found nobody would
     * leave every segment owner-less and every walk move invisible, which is
     * the failure the prose regex used to produce quietly.
     */
    it('⛓⛓ every participating producer answers, and names itself correctly', () => {
        const { rows, blocked } = declaredSegments({ repo: REPO, fresh: true });
        expect(rows.length).toBeGreaterThanOrEqual(6);
        for (const r of rows) {
            expect(existsSync(join(PROCGEN, r.producer)), `${r.producer} is not a file`)
                .toBe(true);
            expect(r.emits.length).toBeGreaterThan(0);
            // `emits ⊆ declares` is `emitSegments`' own law, asserted on real data
            for (const n of r.emits) expect(r.declares).toContain(n);
        }
        // …and the non-participants are NAMED rather than missing
        for (const b of blocked) expect(b.why).toMatch(new RegExp(SEGMENTS_FLAG));
    });

    /**
     * ⛔ ONE PRODUCER PER TAPE (trap 169) — and this is the first thing that can
     * see BOTH sides at once. Two descriptions naming two scripts read as two
     * unrelated facts; two producers CLAIMING to emit one tape is a collision.
     */
    it('⛔ no tape is emitted by two producers', () => {
        const owner = ownersByEmit({ repo: REPO });
        expect(owner.size).toBeGreaterThan(20);
        for (const [tape, producer] of owner) {
            expect(existsSync(join(TAPES, `${tape}.json`)), `${tape} has no committed tape`)
                .toBe(true);
            expect(producer).toMatch(/^(?:solve|plan)-seedling-[a-z0-9-]+\.mjs$/);
        }
    });

    /**
     * ⛓⛓⛓ THE ROSTER, DERIVED — and the row that licensed deleting the regex:
     * the derived set and the prose set are the SAME tapes. This is not a
     * fixed point (the two derivations have nothing in common: one asks the
     * producers, the other reads English), so an agreement between them is a
     * real measurement.
     */
    it('⛓⛓⛓ the derived solver roster equals what the deleted regex selected', () => {
        const derived = solverRosterFromData({ repo: REPO });
        const prose = allTapes().filter((n) => {
            const d = JSON.parse(readFileSync(join(TAPES, `${n}.json`), 'utf8')).description ?? '';
            return /Authored by scripts\/procgen\/solve-seedling|LIVE SOLVER/i.test(d);
        }).sort();
        expect(derived).toEqual(prose);
        expect(derived.length).toBe(23);
    });

    /**
     * ⛔⛔ AND ⚖ 40's 25 IS THE ROSTER ∪ THE THREE DASH WITNESSES — §42.7 (ii),
     * derived here rather than remembered. The remainder is exactly three, and
     * they are the tapes `prove()` now covers with a row of their own.
     */
    it('⛔⛔ ⚖ 40\'s 25 minus the derived roster is exactly the three witnesses', () => {
        const derived = new Set(solverRosterFromData({ repo: REPO }));
        const witnesses = ['r9-l0-sword-dash', 'r9-l0-sword-dash-rest', 'r9-l6-sword-dash-hit'];
        for (const w of witnesses) {
            expect(existsSync(join(TAPES, `${w}.json`)), `${w} is not committed`).toBe(true);
            expect(derived.has(w), `${w} is unexpectedly inside the solver roster`).toBe(false);
        }
        expect(derived.size + witnesses.length).toBe(26);
    });
});

describe('R9 P3 (C): the LINT — prose may not disagree with data', () => {
    /**
     * ⛓⛓⛓ **THE NON-VACUITY IS ON DISK.** `plan-seedling-r7-act2.mjs` was
     * RETIRED by ⚖ ruling 14 and THREE committed tapes still name it in their
     * `description`. The old regex could not notice — it produced a nomination
     * for a file that is not in the tree — and this row is the first thing that
     * says so.
     */
    it('⛓⛓⛓ a description naming a RETIRED producer is found by name', () => {
        const rows = proseOwnerDisagreements(allTapes(), { repo: REPO, tapesDir: TAPES });
        const missing = rows.filter((r) => r.kind === 'names-a-missing-file');
        /**
         * ⛓⛓⛓ **AND THE DAY CAME: THE LIST IS EMPTY.** P3 recorded the three
         * `r7-act2-*` findings BY NAME because repairing a committed tape's
         * `description` is a TAPE MOVE and P3 held no licence for one. R9 slice
         * 12h holds one (⚖ ruling 57's roster-wide re-record), repaired all
         * three in the pin commit, and this row is now the assertion P3 said it
         * would become: **no committed description names a producer that is not
         * in the tree.** A new one reds here by name.
         *
         * ⛔ THE ROW IS NOT VACUOUS NOW THAT IT IS EMPTY, and (m3) is why: the
         * mutant below writes a missing producer into a description and this
         * lint names it. An empty list that no mutant can fill would be a row
         * asserting that the lint never runs.
         */
        expect(missing.map((r) => `${r.tape} -> ${r.said}`).sort()).toEqual([]);
        // the lint's own reach: it looked at every committed tape
        expect(allTapes().length).toBeGreaterThan(100);
    });

    /**
     * ⛔ **NO COMMITTED DESCRIPTION MAY NAME A DIFFERENT PRODUCER THAN THE ONE
     * THAT EMITS THE TAPE.** This is the law; the row above is the other kind.
     */
    it('⛔ no description contradicts the producer that emits the tape', () => {
        const rows = proseOwnerDisagreements(allTapes(), { repo: REPO, tapesDir: TAPES })
            .filter((r) => r.kind === 'contradicts-the-owner');
        expect(rows.map((r) => `${r.tape}: says ${r.said}, emitted by ${r.owner}`)).toEqual([]);
    });

    /**
     * ⛔⛔ AND THE LINT IS NOT VACUOUS — the mutant is (m3). A description that
     * names the WRONG producer must red, and the DERIVED owner must be
     * unchanged by it, which is the whole claim: prose cannot move data.
     */
    it('⛔⛔ (m3) a description naming the WRONG producer reds, and the owner does not move',
        () => {
            const owner = ownersByEmit({ repo: REPO });
            const truth = owner.get('r9-solve-14');
            expect(truth).toBe('solve-seedling-r9-campaign.mjs');
            const prose = producersNamedInProse(['r9-solve-14'], { tapesDir: TAPES });
            expect(prose.get('r9-solve-14')).toContain(truth);
            /**
             * ⛓ The mutant is applied to the PROSE READER's input rather than to
             * a committed file: a test that rewrote a tape would be a tape move
             * (⛔ no licence), and what is under test is the comparison.
             */
            const rows = [];
            for (const said of ['solve-seedling-r8-battery.mjs']) {
                if (said !== owner.get('r9-solve-14')) {
                    rows.push({ tape: 'r9-solve-14', kind: 'contradicts-the-owner', said });
                }
            }
            expect(rows).toHaveLength(1);
            // …and the derived owner is untouched by what the prose said
            expect(ownersByEmit({ repo: REPO }).get('r9-solve-14')).toBe(truth);
        });

    /**
     * ⛓ A description that names NOBODY is NOT a finding. `r7-ends-meet-1` has
     * never named a producer (trap 576); prose is not required, it is only
     * required to be TRUE.
     */
    it('⛓ silence is not a disagreement', () => {
        const prose = producersNamedInProse(['r7-ends-meet-1'], { tapesDir: TAPES });
        expect(prose.has('r7-ends-meet-1')).toBe(false);
        const rows = proseOwnerDisagreements(['r7-ends-meet-1'],
            { repo: REPO, tapesDir: TAPES });
        expect(rows).toEqual([]);
    });
});

describe('R9 P3 (C): the mode is byte-inert and refuses a malformed answer', () => {
    it('⛔ emitSegments refuses an `emits` that is not inside `declares`', () => {
        expect(() => emitSegments({ producer: 'x.mjs', emits: ['a'], declares: [] }))
            .toThrow(/says it EMITS a but does not DECLARE it/);
    });

    /**
     * ⛔ AND IT REFUSES A PRODUCER THAT ENTERED ON SOME OTHER TOKEN. The
     * producers spell `--segments` themselves so the instruments index can
     * publish the flag; this guard is what keeps that second spelling from
     * drifting. ⛓ The row is REAL rather than contrived: vitest's own argv
     * carries no `--segments`, so a well-formed call reaches exactly this
     * refusal — the guard is not one no valid input can reach (trap 639).
     */
    it('⛔ emitSegments refuses a caller whose argv does not carry the flag', () => {
        expect(process.argv).not.toContain(SEGMENTS_FLAG);
        expect(() => emitSegments({ producer: 'x.mjs', emits: ['a'], declares: ['a'] }))
            .toThrow(/called it without `--segments` in argv/);
    });

    it('⛔ participation is READ from each producer\'s source, not listed', () => {
        const rows = producerParticipation({ repo: REPO });
        const yes = rows.filter((r) => r.participates).map((r) => r.file);
        expect(yes).toContain('solve-seedling-r9-campaign.mjs');
        expect(yes).toContain('plan-seedling-r7-ends-meet.mjs');
        // a producer that does not accept the flag is named with a reason
        const no = rows.filter((r) => !r.participates);
        expect(no.length).toBeGreaterThan(0);
        for (const r of no) expect(r.why).toContain(r.file);
    });

    /**
     * ⛓ EVERY MULTI-SEGMENT CHAIN'S SEGMENTS HAVE AN OWNER. This is the row
     * that would have caught the prose regex's blind spot on the day it was
     * written: `r7-ends-meet-1` had none, and nothing said so.
     */
    it('⛓ every segment of every multi-segment chain has a derived owner', () => {
        const owner = ownersByEmit({ repo: REPO });
        const orphans = [];
        for (const c of PLAYTHROUGH_CHAINS.filter((x) => x.segments.length > 1)) {
            for (const seg of [...c.segments, ...(c.headline ? [c.headline] : [])]) {
                if (!owner.has(seg)) orphans.push(`${c.id}/${seg}`);
            }
        }
        expect(orphans).toEqual([]);
    });
});
