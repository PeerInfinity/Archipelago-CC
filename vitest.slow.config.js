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
    // runnerDemo is TEMPORARILY DISABLED (user request 2026-07-09) — see the
    // matching note in vitest.config.js. Re-enable by deleting the runnerDemo
    // entry. Spread the defaults: a bare `exclude` would drop node_modules/dist.
    exclude: [...configDefaults.exclude, 'frontend/modules/runnerDemo/**'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    // Serial across files: no CPU contention -> no contention-induced timeouts.
    fileParallelism: false,
    // Generous ceiling for the heaviest single tests on a slow/clean runner.
    testTimeout: 120000,
  },
});
