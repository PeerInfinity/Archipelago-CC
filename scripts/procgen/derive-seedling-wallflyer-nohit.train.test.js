/**
 * TRAIN TIER — the wallflyer no-hit cross-check: `derive-seedling-wallflyer-nohit.mjs --check --quick`, spawned.
 *
 * ⚖ Robert 2026-11-17 ("Train tier + nightly"): it runs on the train (js-land/** and main pushes, `train_only` /
 * `train` dispatches) and in the nightly (test-substrates-nightly.yml's `seedling-checks` job runs THIS file),
 * NEVER on an ordinary slice push (vitest.config.js excludes *.train.test.js).
 *
 * The script derives every wallflyer room's gated / free crossings (and each gated pair's table arms) and compares them with
 * the gate table, frontend/modules/flashPanel/seedlingNoHitDirectionalGates.json. A CROSS-CHECK, not a rule source:
 * it sees flyers only and is knife-edge, so a red here is a question for the rules owner, never a reason to edit the
 * table to match. The failure message quotes each disagreeing crossing as the script's `FAIL:` lines do.
 *
 * Its pure parts are pinned in the default tier (deriveSeedlingWallflyerNohit.test.js); this is the whole derivation.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ⛓ SPAWNED, not imported: the derivation is a hot synchronous loop, and in-process under vitest's module
// transform it MEASURED ~3x slower than the bare CLI (CC/docs/nightly-wallflyer-nohit-check.md). The child is
// the exact command the script documents as its CI mode, so a red here reproduces with that command.
const TOOL = join(dirname(fileURLToPath(import.meta.url)), 'derive-seedling-wallflyer-nohit.mjs');

// From the measured CI time (train-shard-costs.json carries its row) with headroom for a slower runner.
const TIMEOUT_MS = 900000;

describe('wallflyer no-hit cross-check (derivation vs gate table, --quick)', () => {
    it('the gate table agrees with the derivation on every wallflyer crossing', () => {
        const r = spawnSync(process.execPath, [TOOL, '--check', '--quick'], { encoding: 'utf8', timeout: TIMEOUT_MS - 30000, maxBuffer: 64 << 20 });
        const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
        const lines = out.split('\n');
        const verdict = lines.find((l) => /^PASS: |DISAGREEMENT\(S\)/.test(l)) ?? '(no verdict line)';
        console.log(verdict);
        for (const l of lines.filter((x) => /^\s*INFO /.test(x))) console.log(l);
        const fails = lines.filter((l) => l.startsWith('FAIL: '));
        expect(r.error, `the check did not finish: ${r.error?.message}\n${out.slice(-2000)}`).toBeUndefined();
        expect(fails, `the gate table DISAGREES with the derivation:\n${fails.map((x) => `  ${x}`).join('\n')}`).toEqual([]);
        // Not vacuous: the rooms are found from the map, so a run that derived nothing would also print no FAIL.
        expect(verdict, `no PASS line:\n${out.slice(-2000)}`).toMatch(/^PASS: .*\((\d+) crossings/);
        expect(Number(/\((\d+) crossings/.exec(verdict)[1]), 'no wallflyer crossing was derived at all').toBeGreaterThan(0);
        expect(r.status, out.slice(-2000)).toBe(0);
    }, TIMEOUT_MS);
});
