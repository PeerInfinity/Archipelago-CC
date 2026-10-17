/**
 * ciDocsOnly — **A DOCS-ONLY PUSH RUNS NO BROWSER GATE** (ci-skip-rules rule 2,
 * ⚖ user 2026-10-17; `ci-skip-review` §3 R2, fallback ②).
 *
 * `ci-skip-review` counted 94 JSUT pushes in 7 days that touched no code. Every
 * one of their 12 reds came from the Vitest job (docs ARE pinned: 10 of 65
 * `docs/` pushes went red there), so Vitest always runs. The review's first
 * sketch also skipped the HEADLESS gates. ⛔ Measured here, that is wrong:
 * `gate: procgen-help` is CI-sourced and its derived inputs include every
 * `docs/json/developer/procgen/*.md` and a `CC/` file, so a docs-only head
 * would leave that bank row unanswerable. ⇒ only the BROWSER shards skip (the
 * review's fallback ②, ≈ 27 job-min of a run's ≈ 72).
 *
 * ⛓ WHY THAT IS SAFE, AND HOW IT STAYS SAFE: no browser arm whose bank row
 * is CI-SOURCED has a derived input (`rowInputKey.inputPopulations`, the same
 * derivation the bank keys its rows on) under `SKIPPABLE_PREFIXES`. A docs-only
 * push therefore cannot move a bank value that CI answers, and the line at the
 * last code head still holds. `ciDocsOnly.test.js` re-derives that on every
 * Vitest run, so an arm that starts reading `docs/` (or a docs-reading row that
 * is adopted into CI) reds a test instead of silently skipping on the push that
 * moved its subject (the F1 KEEP-list lesson).
 *
 * ⚠ MEASURED 2026-10-17: ONE browser arm does read docs — `gate:
 * procgen-reference` (the generated regions of `docs/json/developer/procgen/`).
 * Its row is box-measured, not CI-sourced, and Vitest's `generated.test.js`
 * runs the same `--check` on every push, so a docs-only push loses only its CI
 * LINE at that head, never its verdict.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The trees a push may touch and still skip the browser shards. */
export const SKIPPABLE_PREFIXES = Object.freeze(['docs/', 'CC/', 'NewDocs/']);

/** True iff `files` is non-empty and every path is under a skippable prefix. */
export function docsOnly(files) {
    const list = (files ?? []).map((f) => f.trim()).filter(Boolean);
    return list.length > 0 && list.every((f) => SKIPPABLE_PREFIXES.some((p) => f.startsWith(p)));
}

/** The browser shard job's name prefix — what a reader looks for in a run. */
export const BROWSER_SHARD_JOB = /^Browser gate shard — /;

/** Did any browser shard run in this run's jobs? */
export const browserShardsRan = (jobs) =>
    (jobs ?? []).some((j) => BROWSER_SHARD_JOB.test(j.name ?? '') && j.conclusion !== 'skipped');

/**
 * Every browser arm whose derived inputs reach a skippable path — `[]` is the
 * premise rule 2 rests on. Network-free; ~10 s (one key context).
 *
 * @returns {{key: string, entry: string, reach: string[], ciSourced: boolean}[]}
 */
export async function browserArmsReadingDocs({ repo }) {
    const { readStandingValues } = await import('./standingValues.js');
    const bank = readStandingValues({ repo })?.rows ?? {};
    const { ciGateArms } = await import('./ciGatePlan.js');
    const { inputPopulations, keyContext, keyInputsIn } = await import('./rowInputKey.js');
    const ctx = keyContext({ repo });
    const out = [];
    const seen = new Map();
    for (const arm of ciGateArms({ repo, set: 'browser' })) {
        const entry = arm.gate ? `scripts/procgen/${arm.gate.file}`
            : (/scripts\/procgen\/[\w.-]+\.(?:mjs|js|py)/.exec(arm.row?.command ?? '') ?? [])[0];
        if (!entry) throw new Error(`browser arm ${arm.key} names no entry script`);
        if (!seen.has(entry)) {
            const declared = keyInputsIn(readFileSync(join(repo, entry), 'utf8'), { file: entry });
            const pops = inputPopulations({ entry, declared, ctx });
            const members = Object.values(pops)
                .flatMap((v) => (v instanceof Set || Array.isArray(v) ? [...v] : []));
            seen.set(entry, members.filter((p) => SKIPPABLE_PREFIXES.some((x) => String(p).startsWith(x))));
        }
        const reach = seen.get(entry);
        if (reach.length) {
            out.push({ key: arm.key, entry, reach,
                ciSourced: Boolean(bank[arm.bankKey ?? arm.key]?.ciSourced) });
        }
    }
    return out;
}
