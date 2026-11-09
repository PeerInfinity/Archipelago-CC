import { defineConfig, configDefaults } from 'vitest/config';

// TRAIN tier (⚖ Robert 2026-11-02, CI manual-only review: P1, P2, P3, P5).
//
// Home for the heavy pins that do not need to run on every slice push but must
// run before main: the Seedling solver behaviour pins (hammer / fidelity), the
// generator-capacity census, the maze certifier's SCRIPTED sample, and two heavy
// default-tier hammer pins. They were the slow tier's critical path.
//
// WHERE IT RUNS — the `Train-tier Vitest (shard k/N)` jobs in unittests_frontend.yml
// (⚖ Robert 2026-11-08: planned shards, scripts/test/trainShardPlan.js; each serial):
//   - on every push to js-land/** (the landing train), so main never takes a
//     head this tier has not passed;
//   - on `workflow_dispatch` with `-f train_only=true` (the train shards alone,
//     which is how a slice that touches the solver bot, hammer, fidelity, the
//     generator or tileStep owes its packet a run at its tip: js-16's landing
//     rule) or `-f train=true` (the train shards plus everything else);
//   - NOT on a slice-branch push (the job SKIPS there), and NOT in
//     `npm run test:unit` (vitest.config.js excludes *.train.test.js).
//   Locally: `npm run test:unit:train [-- <paths>]` — bounded paths only (⚖ 52).
//
// ⛔ NOT the calib tier. calib (vitest.calib.config.js) stays manual-only and
// never in CI; this tier is IN CI, at the train.
//
// Serial across files (fileParallelism:false), like the slow config: the work is
// synchronous and CPU-bound, so a contended worker would flake with
// STACK_TRACE_ERROR rather than a clean timeout.
export default defineConfig({
  test: {
    include: ['frontend/**/*.train.test.js'],
    exclude: [...configDefaults.exclude],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    fileParallelism: false,
    // The heaviest single cases (the maze certifier's scripted sample) carry
    // their own 900 s timeout; this is the ceiling for the rest.
    testTimeout: 300000,
  },
});
