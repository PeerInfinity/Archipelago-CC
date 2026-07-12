import { defineConfig, configDefaults } from 'vitest/config';

// On-demand config for the heavy, CPU-bound generate-and-test property suites
// (*.slow.test.js — e.g. bounceDemo generator/specGenerator, procgen
// sphereGrowth). They run FINE in isolation but flake under the default suite's
// parallel CPU contention: the work is synchronous, so vitest's testTimeout
// can't interrupt it, and a contended worker is killed with STACK_TRACE_ERROR.
//
// Running them serially (fileParallelism:false) gives each file the full CPU,
// so they finish quickly and deterministically. Excluded from the default
// `vitest run` via vitest.config.js; run here with `npm run test:unit:slow`.
export default defineConfig({
  test: {
    include: ['frontend/**/*.slow.test.js'],
    // runnerDemo's slow battery is back (test-strategy rebalance §1, 2026-07-12):
    // the heavy 13×4 sweep + full-graph agreement were demoted to the manual
    // calibration tier (*.calib.test.js, run via `npm run test:unit:calib`),
    // and the remaining suites trimmed, so the battery fits the CI slow job
    // again. Spread the defaults: a bare `exclude` would drop node_modules/dist.
    exclude: [...configDefaults.exclude],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    // Serial across files: no CPU contention -> no contention-induced timeouts.
    fileParallelism: false,
    // Generous ceiling for the heaviest single tests on a slow/clean runner.
    testTimeout: 120000,
  },
});
