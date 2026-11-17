/**
 * TRAIN TIER — the wallflyer no-hit cross-check: `derive-seedling-wallflyer-nohit.mjs --check --quick`, in-process.
 *
 * ⚖ Robert 2026-11-17 ("Train tier + nightly"): it runs on the train (js-land/** and main pushes, `train_only` /
 * `train` dispatches) and in the nightly (test-substrates-nightly.yml's `seedling-checks` job runs THIS file),
 * NEVER on an ordinary slice push (vitest.config.js excludes *.train.test.js).
 *
 * It derives every wallflyer room's gated / free crossings (and each gated pair's table arms) and compares them with
 * the gate table, frontend/modules/flashPanel/seedlingNoHitDirectionalGates.json. A CROSS-CHECK, not a rule source:
 * it sees flyers only and is knife-edge, so a red here is a question for the rules owner, never a reason to edit the
 * table to match. The failure message quotes each disagreeing crossing as the script's `FAIL:` lines do.
 *
 * Its pure parts are pinned in the default tier (deriveSeedlingWallflyerNohit.test.js); this is the whole derivation.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkTable, readMap, GATES_FILE, PLANS_FILE } from './derive-seedling-wallflyer-nohit.mjs';

// Measured locally (`--check --quick` in-process): see CC/docs/nightly-wallflyer-nohit-check.md. CI's train job
// measured more (train-shard-costs.json carries its row); the headroom covers a slower runner.
const TIMEOUT_MS = 900000;

describe('wallflyer no-hit cross-check (derivation vs gate table, --quick)', () => {
    it('the gate table agrees with the derivation on every wallflyer crossing', () => {
        const table = JSON.parse(readFileSync(GATES_FILE, 'utf8'));
        const plans = JSON.parse(readFileSync(PLANS_FILE, 'utf8'));
        const t0 = Date.now();
        const r = checkTable(readMap(), table, plans, { quick: true });
        const wall = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`no-hit cross-check: ${r.rows.length} crossings, ${r.info.length} info, ${r.disagreements.length} disagreement(s) — wall ${wall} s`);
        for (const x of r.info) console.log(`  INFO ${x}`);
        // Not vacuous: the rooms are found from the map, so an empty result would pass silently.
        expect(r.rows.length, 'no wallflyer crossing was derived at all').toBeGreaterThan(0);
        expect(r.disagreements, `the gate table DISAGREES with the derivation:\n${r.disagreements.map((x) => `  FAIL: ${x}`).join('\n')}`)
            .toEqual([]);
    }, TIMEOUT_MS);
});
