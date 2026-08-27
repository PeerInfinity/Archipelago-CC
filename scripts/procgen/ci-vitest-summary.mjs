#!/usr/bin/env node
/**
 * ci-vitest-summary.mjs — **A SHIM. The implementation is `ci-summary.mjs`.**
 * (R9 slice P3b (g); the reader was generalised to `--gate=` by ⚖ 54 (6).)
 *
 * ⛔⛔ WHY THE FILE STAYS. `standing-values.json`'s `suite: vitest
 * (unfiltered)` row carries `node scripts/procgen/ci-vitest-summary.mjs
 * --json` as its committed `command`, and `standingValues.missingScript`
 * refuses a row whose instrument has left the disk. ⚖ ruling 8 publishes
 * command strings as identity: renaming an instrument out from under a
 * standing row would move that row's SUBJECT while its VALUE sat still, which
 * is the quietest way to make a measurement wrong.
 *
 * ⛓ It re-execs rather than re-implements, so there is ONE reader. Its stdout,
 * stderr and exit code are the delegate's, unaltered — measured byte-identical
 * against the pre-shim file's output at the same SHA.
 *
 *   node scripts/procgen/ci-vitest-summary.mjs [<sha>] [--wait] [--json]
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** ⛔ `--gate=` is NOT forwarded: this name means the suite, and always did. */
const argv = process.argv.slice(2).filter((a) => !a.startsWith('--gate='));
const r = spawnSync(process.execPath, [join(HERE, 'ci-summary.mjs'), ...argv],
    { stdio: 'inherit' });
process.exit(r.status ?? 1);
