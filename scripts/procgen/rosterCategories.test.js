/**
 * rosterCategories — the SCRIPT-side rows for the three derived categories
 * (R9 slice CAT, ⚖ 69 (c) / ⚖ 70).
 *
 * ⛔⛔ WHY THESE SPAWN THE REAL INSTRUMENT. The category selection itself is
 * pinned in `fixtures/tiers.test.js`, against the derivation. What THIS file
 * pins is the wiring a unit test cannot see: that
 * `verify-seedling-bot-differential.mjs` refuses an unknown `--tier=` BY NAME
 * **without taking the box**, and that the owed gate's per-category verdict is
 * the one the tree implies.
 *
 * ⛓ NO ROW HERE MAY TAKE THE BOX. Every spawn is either an argument error
 * (which exits above the lock) or a headless gate that declares it takes no
 * lock. A test that queued for a GPU would make the suite unrunnable beside a
 * live measurement — which is the state this slice was written in.
 */

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ROSTER_CATEGORIES, tapesInTier, tapesInTiers } from
    '../../frontend/modules/seedlingDemo/fixtures/tiers.js';
import { fixtureNames } from '../../frontend/modules/seedlingDemo/fixtures/index.js';
import {
    ROSTER_ROW_KEY, compositeParts, compositeValue, compositeWhy, oldestPartHead,
    readStandingValues, withCategoryQuote,
} from './standingValues.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const DIFFERENTIAL = join(HERE, 'verify-seedling-bot-differential.mjs');

/** Run a script and hand back `{code, out}` rather than throwing on non-zero. */
const run = (file, args) => {
    try {
        const out = execFileSync(process.execPath, [file, ...args],
            { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
        return { code: 0, out };
    } catch (e) {
        return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
};

describe('--tier=<category> on the differential (⚖ 70 (b))', () => {
    const roster = fixtureNames();

    it('an unknown tier is refused BY NAME, and BEFORE the box lock', () => {
        // ⛔ THE MEASUREMENT THIS ROW EXISTS FOR. The lock was taken twenty
        // lines above the parse, so with the box held by another session a
        // misspelling printed "⛔ THE BOX IS TAKEN" and exited 1 — an
        // argument error that queues for a GPU and never says what was wrong.
        const r = run(DIFFERENTIAL, ['--tier=mechnic']);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/--tier must be one of/);
        expect(r.out).toMatch(/unknown: mechnic/);
        expect(r.out).not.toMatch(/THE BOX IS TAKEN/);
    });

    it('a comma list refuses on the ONE bad name, not on the whole list', () => {
        const r = run(DIFFERENTIAL, ['--tier=campaign,mechnic']);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/unknown: mechnic/);
        expect(r.out).not.toMatch(/unknown: campaign/);
    });

    it('the refusal NAMES every tier the flag answers for, categories included', () => {
        const r = run(DIFFERENTIAL, ['--tier=nope']);
        for (const t of ['fast', 'gate', 'legacy', 'full', ...ROSTER_CATEGORIES]) {
            expect(r.out).toContain(t);
        }
    });

    it('the selection a category asks for is the category, and a list is their union', () => {
        // The selection the differential makes is `tapesInTiers` — asserted
        // here against the same roster the run would sweep, so the flag and
        // the derivation cannot come apart without a red row.
        for (const c of ROSTER_CATEGORIES) {
            expect(tapesInTiers(c, roster)).toEqual(tapesInTier(c, roster));
        }
        expect(tapesInTiers(ROSTER_CATEGORIES.join(','), roster).length).toBe(roster.length);
        expect(tapesInTiers('campaign,campaign', roster))
            .toEqual(tapesInTier('campaign', roster));
    });
});

const OWED_GATE = join(HERE, 'check-seedling-full-tier-owed.mjs');

/** A composite row with the three parts, two inherited and one measured. */
const rowWith = (parts) => ({ value: 'typed', why: 'typed', quoted: true, categories: parts });

describe('the COMPOSITE checkpoint row (⚖ 70 (c))', () => {
    it('a row with every part separable is a PURE SUM', () => {
        const row = rowWith({
            campaign: { tapes: 26, value: '900/0/10', measuredAt: 'aaa' },
            'map-walk': { tapes: 21, value: '800/0/5', measuredAt: 'bbb' },
            mechanic: { tapes: 103, value: '2000/1/20', measuredAt: 'ccc' },
        });
        expect(compositeValue(row, ROSTER_CATEGORIES)).toBe('150 tapes 3700/1/35');
    });

    it('an INHERITED part is named with its head, never summed into the total', () => {
        // ⛔ ⚖ 69 (a) banked the complement as ONE number over 120 tapes.
        // Splitting it by category after the fact would be inventing a
        // measurement, so a part may have no separable value — and the
        // rendering has to say so rather than quietly dropping its tapes.
        const row = rowWith({
            campaign: { tapes: 26, value: '900/0/10', measuredAt: 'aaa' },
            'map-walk': { tapes: 21, value: null, measuredAt: 'bbb' },
            mechanic: { tapes: 103, value: null, measuredAt: 'bbb' },
        });
        const v = compositeValue(row, ROSTER_CATEGORIES);
        expect(v).toContain('150 tapes');
        expect(v).toContain('campaign 26 900/0/10 @aaa');
        expect(v).toContain('map-walk 21 + mechanic 103 @bbb, not separately banked');
        expect(v).not.toMatch(/\b900\/0\/10\b.*\b900\/0\/10\b/);
    });

    it('`why` is DERIVED, states every part with its head, and says `coveredBy` ONCE', () => {
        const row = rowWith({
            campaign: { tapes: 26, value: null, measuredAt: 'aaa', coveredBy: 'the X tier' },
            'map-walk': { tapes: 21, value: null, measuredAt: 'aaa', coveredBy: 'the X tier' },
        });
        const w = compositeWhy(row, ROSTER_CATEGORIES);
        expect(w).toContain('campaign 26 tape(s) @aaa, not separately banked');
        expect(w).toContain('map-walk 21 tape(s) @aaa');
        expect(w.match(/the X tier/g)).toHaveLength(1);
    });

    it('a HAND-EDITED `value`/`why` does not survive a quote — ⚖ 17', () => {
        const row = rowWith({ campaign: { tapes: 26, value: null, measuredAt: 'aaa' } });
        row.why = 'everything is fine, trust me';
        row.value = '150 tapes 9999/0/0';
        const next = withCategoryQuote(row, {
            category: 'campaign', tapes: 26, value: '912/0/40', measuredAt: 'bbb',
        }, { categories: ROSTER_CATEGORIES });
        expect(next.why).not.toContain('trust me');
        expect(next.value).toBe('26 tapes 912/0/40');
        expect(next.why).toBe(compositeWhy(next, ROSTER_CATEGORIES));
    });

    it('the row\'s own head is the OLDEST part\'s, by injected ancestry', () => {
        // ⛔ A consumer that knows nothing about categories reads `measuredAt`
        // as "the head this value is about". Answering with the NEWEST part
        // would claim the row is fresher than its oldest measurement.
        const row = rowWith({
            campaign: { tapes: 26, value: '1/0/0', measuredAt: 'new' },
            'map-walk': { tapes: 21, value: null, measuredAt: 'old' },
        });
        const isAncestor = (a, b) => a === 'old' && b === 'new';
        expect(oldestPartHead(row, { categories: ROSTER_CATEGORIES, isAncestor })).toBe('old');
        // With no ancestry predicate nothing is invented: the first part stands.
        expect(oldestPartHead(row, { categories: ROSTER_CATEGORIES })).toBe('new');
    });

    it('a row with no parts is not a composite, and every reader branches on that', () => {
        expect(compositeParts({ value: '150 tapes 3641/0/120' })).toEqual([]);
        expect(compositeValue({ value: 'kept' })).toBe('kept');
        expect(compositeWhy({ why: 'kept' })).toBe('kept');
    });

    it('the LIVE row carries one part per derived category, each with its own head', () => {
        const row = readStandingValues()?.rows?.[ROSTER_ROW_KEY];
        expect(row).toBeTruthy();
        expect(Object.keys(row.categories ?? {}).sort()).toEqual([...ROSTER_CATEGORIES].sort());
        for (const p of compositeParts(row, ROSTER_CATEGORIES)) {
            expect(p.measuredAt, `${p.category} has no head`).toBeTruthy();
            expect(p.tapes).toBe(tapesInTier(p.category, fixtureNames()).length);
        }
        expect(row.value).toBe(compositeValue(row, ROSTER_CATEGORIES));
        expect(row.why).toBe(compositeWhy(row, ROSTER_CATEGORIES));
    });
});

describe('the owed gate, per category (⚖ 70 (d))', () => {
    it('judges EACH category against its OWN head, and prices only what is owed', () => {
        // ⛓ The gate is headless and takes NO box lock — which is why this row
        // can run beside a live GPU measurement, and why the ⚖ 17 guard on the
        // row lives in the gate rather than in `standing-values --check`.
        const r = run(OWED_GATE, []);
        expect(r.out).not.toMatch(/THE BOX IS TAKEN/);
        for (const c of ROSTER_CATEGORIES) {
            expect(r.out).toMatch(new RegExp(`the \`${c}\` category is still about THIS tree`));
        }
        expect(r.out).toMatch(/judged against its OWN head/);
        // The row-shape guards run before any verdict.
        expect(r.out).toMatch(/one part per DERIVED category/);
        expect(r.out).toMatch(/are DERIVED from its parts, not typed/);
        // ⛔ Whatever the tree says, the gate never prices the whole roster as
        // the debt when only part of it is owed.
        if (/CHECK\(S\) FAILED/.test(r.out)) {
            expect(r.out).toMatch(/## WHAT IS ACTUALLY OWED HERE/);
        }
    });
});
