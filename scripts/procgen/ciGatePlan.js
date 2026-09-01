/**
 * ciGatePlan — **WHICH GATES CI CAN RUN, AND HOW THEY ARE PARTITIONED ACROSS
 * RUNNERS** (standing-values CI arc, slice S3; ⚖ ruling 72, 2026-09-01).
 *
 * ── WHY A MODULE AND NOT SIX LINES IN `ci-gates.mjs` ──────────────────
 *
 * The same reason `gateDedup.js` exists one file over: the decision is PURE
 * and the run is not. `ci-gates.mjs` takes the box and spawns twenty-four
 * browser arms; a partition rule that only a twenty-minute CI job could
 * interrogate is a rule nobody tests the edges of. Here a unit test can ask
 * it what it answers for an empty bank, for a row nobody has ever measured,
 * and for a gate that is heavier than a whole shard.
 *
 * ── ⛔⛔ WHAT CI CAN RUN, IN ONE PREDICATE ────────────────────────────
 *
 * `ciRunnable` is `!gate.windows`, and the negative is the whole content of
 * it: `ubuntu-latest` has a browser (SwiftShader, headless Chromium — the
 * bank's own 23 browser rows are all banked green from headless WSL Chromium)
 * and it has NO `/mnt/c/Windows/py.exe`. The four Windows rows hold that path
 * as a literal, so they cannot even RESOLVE their driver on a runner; ⚖ 72
 * (a) rules they stay box-measured, and `ci-gates.mjs` names them SKIPPED
 * rather than letting a run imply them green.
 *
 * ⛔ IT IS ONE PREDICATE BECAUSE THERE IS ONE QUESTION. The workflow derives
 * its jobs from it, `ci-gates.mjs` derives what it runs from it, and
 * `ci-summary.mjs` derives its REFUSAL from it. Three copies of "can CI
 * answer this?" is how a refusal outlives the thing it refused.
 *
 * ── ⛓⛓⛓ THE PARTITION IS READ OUT OF THE BANK, AT RUNTIME ───────────
 *
 * ⚖ ruling 17 refuses a hand-kept roster, and a matrix of shards typed into
 * `unittests_frontend.yml` would be exactly one — stale the day a gate is
 * added, and stale in the direction that DROPS a gate silently. So the
 * workflow's first job asks this module for the shards (`ci-gates.mjs --plan
 * --json`) and interpolates them into `strategy.matrix`; each shard job then
 * recomputes the SAME plan from the same tree and takes its slice by index.
 *
 * ⛓ THE COST OF A ROW IS ITS BANKED `ms` — the only measured number there is.
 * ⛔ AND A ROW WITH NO BANKED `ms` IS PRICED AT THE WHOLE BUDGET, so it lands
 * in a shard of its own. A brand-new gate is precisely the row whose cost is
 * unknown, and pricing an unknown at zero is how one shard silently becomes
 * the slow one. Conservative in the direction that keeps the OTHER shards
 * honest.
 *
 * ⛓ `seedling-wasm-element` (934.7 s banked) getting a job to itself is a
 * CONSEQUENCE of that rule, not a name typed into it: any arm at or above the
 * budget is its own shard.
 *
 * ⛔⛔ AND THE PARTITION IS A COVER, WHICH IS LOAD-BEARING FOR SG1's DEMOS
 * DEDUP. `check-procgen-demos` skips a `cli` row that invokes a roster gate,
 * on the licence that *"the battery runs it as its own row"* (⚖ 71 (a)).
 * Sharding splits the battery across JOBS, so that licence now rests on the
 * partition covering every arm exactly once — which `planCiShards` guarantees
 * by construction and `ciGatePlan.test.js` asserts. ⛓ The four licensed rows
 * today are `editor-generate`, `editor-sequence` (×2), `editor-arm` (×2) and
 * `maze-lab`, all five of them browser arms and all therefore in the cover;
 * the sixth catalogue row that names a roster gate is the WINDOWS ship row,
 * and it declares its own `skip:` with a reason, so it never reached the
 * licence at all.
 */

import { argvFor, gateRoster, LOCAL_HOST, REPO } from './gateRoster.js';
import { gateStandingRows, readStandingValues } from './standingValues.js';

/**
 * ⛓ ONE SHARD'S BUDGET, in banked (this-box) milliseconds — ten minutes.
 *
 * ⛔ It is NOT the twenty-minute target the plan names, and the gap is the
 * point: the bank's `ms` are this WSL box's, and a shared runner is the
 * unknown this slice exists to measure. Ten banked minutes leaves a 2× factor
 * before a shard reaches the twenty it is aiming at.
 */
export const CI_SHARD_BUDGET_MS = 600000;

/**
 * Can CI run this gate at all? See the docblock — `ubuntu-latest` has a
 * browser and no Windows GPU driver.
 */
export function ciRunnable(gate) { return !gate.windows; }

/**
 * ⛓ THE ARMS CI RUNS, in roster order, each declared arm right after the gate
 * it belongs to — the same shape `gates.mjs`'s `armsIn('local')` builds, and
 * for the same reason: an arm that is not in the list is a standing row
 * somebody re-types.
 *
 * Each arm carries BOTH keys, and they are not always the same one:
 *   `bankKey`  the STANDING row's key — what its `ms` is banked under
 *   `key`      the key its `## CI-GATE |` line is printed under, which a
 *              declared `@ci-face` REPLACES the `gate:` prefix of, so a
 *              bounded CI claim can never be read as the standing value.
 *
 * @param {object} o
 * @param {string} [o.set]  `browser` (default) · `headless` · `all`
 */
export function ciGateArms({ repo = REPO, host = LOCAL_HOST, set = 'browser' } = {}) {
    const wants = (g) => {
        if (!ciRunnable(g)) return false;
        if (set === 'all') return true;
        if (set === 'headless') return !g.browser;
        if (set === 'browser') return g.browser;
        throw new Error(`ciGatePlan: unknown set ${JSON.stringify(set)} — browser, headless or all`);
    };
    const out = [];
    for (const gate of gateRoster({ repo }).filter(wants)) {
        const base = argvFor(gate, 'local', { host });
        /** ⛔ A gate that cannot address the local world at all is NOT run —
         *  named by the caller, never run against the wrong tree. */
        if (base === null) continue;
        const rows = gateStandingRows(gate, base);
        const faced = (bankKey) => (gate.ciFace
            ? bankKey.replace(/^gate:/, `${gate.ciFace.prefix}:`) : bankKey);
        out.push({
            gate,
            label: null,
            argv: gate.ciFace ? gate.ciFace.argv : base,
            bankKey: rows[0].key,
            key: faced(rows[0].key),
        });
        (gate.variants ?? []).forEach((v, i) => {
            out.push({
                gate, label: v.label, argv: v.argv,
                bankKey: rows[i + 1].key, key: faced(rows[i + 1].key),
            });
        });
    }
    return out;
}

/** ⛓ How an arm is NAMED, everywhere — the gate, then the arm it is. */
export const armName = (arm) => `${arm.gate.file.replace(/^check-/, '').replace(/\.mjs$/, '')}`
    + `${arm.label ? ` (${arm.label})` : ''}`;

/**
 * ⛓⛓ THE PARTITION — longest-first, into bins of `budgetMs`.
 *
 * ⛔ SORTED BY COST DESCENDING AND THEN BY KEY, so the plan is a pure function
 * of the tree and the bank: the job that publishes the matrix and the job that
 * takes shard *i* out of it are two different processes at the same SHA, and
 * they must agree without talking.
 *
 * @param {object} o
 * @param {object[]} o.arms      from `ciGateArms`
 * @param {object|null} o.bank   `readStandingValues()`'s document, or `null`
 * @param {number} [o.budgetMs]
 * @returns {{id:number,name:string,ms:number,unpriced:number,keys:string[]}[]}
 */
export function planCiShards({ arms, bank, budgetMs = CI_SHARD_BUDGET_MS }) {
    const rows = bank?.rows ?? {};
    const priced = arms.map((arm) => {
        const ms = rows[arm.bankKey]?.ms;
        return {
            arm,
            name: armName(arm),
            /** ⛔ unmeasured ⇒ priced at the whole budget (see the docblock). */
            ms: Number.isFinite(ms) ? ms : budgetMs,
            unpriced: !Number.isFinite(ms),
        };
    }).sort((a, b) => (b.ms - a.ms) || a.name.localeCompare(b.name));

    const bins = [];
    for (const row of priced) {
        const fits = row.ms >= budgetMs
            ? null
            : bins.find((b) => b.ms + row.ms <= budgetMs);
        if (fits) { fits.rows.push(row); fits.ms += row.ms; } else {
            bins.push({ rows: [row], ms: row.ms });
        }
    }
    return bins.map((b, id) => ({
        id,
        /** ⛓ named for its heaviest member — the one a reader will ask about. */
        name: `${b.rows[0].name}${b.rows.length > 1 ? ` +${b.rows.length - 1}` : ''}`,
        ms: b.ms,
        unpriced: b.rows.filter((r) => r.unpriced).length,
        keys: b.rows.map((r) => r.arm.key),
    }));
}

/**
 * The whole plan for a tree — the arms, the shards, and the bank they were
 * priced from. ⛓ One call, so the `--plan` printer and the `--shard=` runner
 * cannot compute it two different ways.
 */
export function ciGatePlanFor({ repo = REPO, host = LOCAL_HOST, set = 'browser',
    budgetMs = CI_SHARD_BUDGET_MS } = {}) {
    const arms = ciGateArms({ repo, host, set });
    const bank = readStandingValues({ repo });
    const shards = planCiShards({ arms, bank, budgetMs });
    return { arms, shards, budgetMs, measuredAt: bank?.measuredAt ?? null };
}
