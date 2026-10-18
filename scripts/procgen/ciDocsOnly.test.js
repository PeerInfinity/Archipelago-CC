/**
 * ciDocsOnly — ci-skip-rules RULE 2: a non-main push that touches only docs/
 * or CC/ skips the BROWSER gate shards. The rule is safe only while
 * no CI-sourced browser row reads those trees, and that premise is re-derived
 * here on every run rather than trusted.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ciGateArms } from './ciGatePlan.js';
import { BROWSER_SHARD_JOB, SKIPPABLE_PREFIXES, browserShardsRan, docsOnly } from './ciDocsOnly.js';
import { inputPopulations, keyContext, keyInputsIn } from './rowInputKey.js';
import { readStandingValues } from './standingValues.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Every browser arm whose DERIVED inputs (`rowInputKey.inputPopulations`, the
 * derivation the bank keys its rows on) reach a skippable path, with whether
 * its bank row is CI-sourced. Kept in the test: it parses docblocks, and the
 * production module is imported by the suite row's instrument.
 */
function browserArmsReadingDocs() {
    const bank = readStandingValues({ repo: REPO })?.rows ?? {};
    const ctx = keyContext({ repo: REPO });
    const reachOf = new Map();
    const out = [];
    for (const arm of ciGateArms({ repo: REPO, set: 'browser' })) {
        const entry = arm.gate ? `scripts/procgen/${arm.gate.file}`
            : (/scripts\/procgen\/[\w.-]+\.(?:mjs|js|py)/.exec(arm.row?.command ?? '') ?? [])[0];
        expect(entry, `browser arm ${arm.key} names an entry script`).toBeTruthy();
        if (!reachOf.has(entry)) {
            const declared = keyInputsIn(readFileSync(join(REPO, entry), 'utf8'), { file: entry });
            const members = Object.values(inputPopulations({ entry, declared, ctx }))
                .flatMap((v) => (v instanceof Set || Array.isArray(v) ? [...v] : []));
            reachOf.set(entry, members.filter((m) => SKIPPABLE_PREFIXES.some((x) => String(m).startsWith(x))));
        }
        if (reachOf.get(entry).length) {
            out.push({ key: arm.key, ciSourced: Boolean(bank[arm.bankKey ?? arm.key]?.ciSourced) });
        }
    }
    return out;
}

describe('docsOnly — the push class rule 2 skips the browser shards on', () => {
    it('is true only when EVERY path is under a skippable prefix', () => {
        expect(docsOnly(['docs/json/x.md', 'CC/docs/r.md'])).toBe(true);
        expect(docsOnly(['docs/json/x.md', 'scripts/procgen/a.mjs'])).toBe(false);
        /** ⛔ generated JS beside the docs is CODE (the reference pages load it) */
        expect(docsOnly(['frontend/modules/procgenDocs/generated/docsIndex.js'])).toBe(false);
        /** ⛔ a README outside the three trees is not a docs-only change */
        expect(docsOnly(['scripts/procgen/README.md'])).toBe(false);
    });

    it('an empty or blank list is NOT docs-only (fail-open)', () => {
        expect(docsOnly([])).toBe(false);
        expect(docsOnly(['', '  '])).toBe(false);
    });
});

describe('⛔ THE PREMISE — no CI-sourced browser row reads a skippable path', () => {
    it('every browser arm reaching docs/ or CC/ is box-measured, not CI-sourced', () => {
        const reach = browserArmsReadingDocs();
        expect(reach.filter((a) => a.ciSourced).map((a) => a.key)).toEqual([]);
        /**
         * ⛓ The one that reads docs today (measured 2026-10-17) — its verdict is
         * Vitest's `generated.test.js` `--check`, which runs on every push.
         */
        expect(reach.map((a) => a.key)).toEqual(['gate: procgen-reference']);
    }, 60_000);
});

describe('unittests_frontend.yml wires rule 2 to this module', () => {
    const wf = readFileSync(join(REPO, '.github/workflows/unittests_frontend.yml'), 'utf8');

    it('the plan job decides with docsOnly, and only the shard matrix is gated on it', () => {
        expect(wf).toContain("import { docsOnly } from './scripts/procgen/ciDocsOnly.js'");
        const gated = [...wf.matchAll(/needs\.browser-gate-plan\.outputs\.needed == 'true'/g)];
        expect(gated).toHaveLength(1);
        expect(wf).toMatch(/ {2}browser-gates:\n[\s\S]*?if: \$\{\{ !cancelled\(\) && needs\.browser-gate-plan\.result == 'success' && needs\.browser-gate-plan\.outputs\.needed == 'true' \}\}/);
    });

    it('BROWSER_SHARD_JOB names the shard job, and browserShardsRan reads a skip as not run', () => {
        expect(BROWSER_SHARD_JOB.test('Browser gate shard — ${{ matrix.shard.name }}')).toBe(true);
        expect(wf).toContain('name: Browser gate shard — ${{ matrix.shard.name }}');
        expect(browserShardsRan([{ name: 'Browser gate shard — x', conclusion: 'skipped' }])).toBe(false);
        expect(browserShardsRan([{ name: 'Browser gate shard — x', conclusion: 'success' }])).toBe(true);
        expect(SKIPPABLE_PREFIXES).toEqual(['docs/', 'CC/']);
    });
});
