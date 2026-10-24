/**
 * seedling-solve-progress-hook — a NODE PRELOAD (SEEDLING HAMMER-PHASE D3): every solve in the process runs under a
 * progress hook that never peeks, so any producer or instrument can be shown byte-identical under one without
 * editing it.
 *
 * It prints nothing (the identity block md5s `2>&1`). `SEEDLING_PROGRESS_HOOK_LOG=<file>` appends one line per
 * process at exit — `<pid> <hook calls> <argv[1]>` — which is the evidence that the hook was installed and called.
 * `SEEDLING_PROGRESS_HOOK_PEEK=<n>` peeks every n calls instead (the snapshot is built and dropped).
 *
 * Run:
 *   NODE_OPTIONS="--import=$PWD/scripts/procgen/seedling-solve-progress-hook.mjs" \
 *       node scripts/procgen/solve-seedling-r9-campaign.mjs --check
 *   NODE_OPTIONS="--import=$PWD/scripts/procgen/seedling-solve-progress-hook.mjs" bash scripts/procgen/identity-block.sh .
 */

import { appendFileSync } from 'node:fs';

import { argvHelp } from './argvHelp.js';
import { installSolveProgress } from '../../frontend/modules/seedlingDemo/solveProgress.js';

// ⛓ `--help` only when this file is the one run (`argvHelp` asks `isEntryPoint`): as a preload it never answers for
// the instrument it rides on
argvHelp(import.meta.url);

const every = Number(process.env.SEEDLING_PROGRESS_HOOK_PEEK ?? 0);
let calls = 0;
installSolveProgress((site, peek) => {
    calls += 1;
    if (every > 0 && calls % every === 0) peek();
});
const log = process.env.SEEDLING_PROGRESS_HOOK_LOG ?? null;
if (log) {
    process.on('exit', () => {
        try {
            appendFileSync(log, `${process.pid} ${calls} ${process.argv[1] ?? ''}\n`);
        } catch { /* the log is evidence, never a failure */ }
    });
}
