import { defineConfig, configDefaults } from 'vitest/config';

// Calibration tier (runner test-strategy rebalance §3). Home for the DEMOTED
// proofs that define gate windows but do not need to run every battery: the
// full requirement×seed generate-and-verify sweep, the full-graph-vs-layered
// agreement, and the bounded-budget gate-window exclusivity runs. These are
// EXPENSIVE and only meaningful when the things they calibrate change —
// gate vocabulary, a physics profile / deriveGeometry / sweep code, solver
// internals (canRun.js), or the oracle (witnessSearch.js).
//
// NOT in CI and NOT in the routine slow battery. Run manually with
// `npm run test:unit:calib` on such a change. Semantics for negative-direction
// (no-unintended-solution) runs follow the ruling: a found counterexample
// FAILS; an exhausted budget with none PASSES; a non-exhausted budget with
// none passes with a logged `[budget] …` note, never a failure.
//
// Serial across files (fileParallelism:false), like the slow config: the work
// is synchronous and CPU-bound, so a contended worker would flake with
// STACK_TRACE_ERROR rather than a clean timeout.
export default defineConfig({
  test: {
    include: ['frontend/**/*.calib.test.js'],
    exclude: [...configDefaults.exclude],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    fileParallelism: false,
    // Generous ceiling: the full sweeps are the heaviest tests in the repo.
    testTimeout: 900000,
  },
});
