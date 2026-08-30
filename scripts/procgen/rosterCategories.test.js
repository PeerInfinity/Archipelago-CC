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
