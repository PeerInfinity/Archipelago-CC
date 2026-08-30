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
    // runnerDemo's slow battery WAS back (test-strategy rebalance §1,
    // 2026-07-12): the heavy 13×4 sweep + full-graph agreement were demoted to
    // the manual calibration tier (*.calib.test.js, run via
    // `npm run test:unit:calib`), and the remaining suites trimmed, so the
    // battery fit the CI slow job again. Spread the defaults: a bare `exclude`
    // would drop node_modules/dist.
    //
    // ⛔ THE RUNNER SUBSTRATE IS OUT AGAIN (⚖ user, 2026-08-20), AHEAD OF A
    // MAJOR REDESIGN THAT WILL MAKE THESE TESTS IRRELEVANT. They are DISABLED,
    // not deleted: the files stay on disk as the record of what the current
    // generator/solver/oracle were held to, and the redesign's own suite
    // replaces them. Reverting is deleting the two patterns below.
    //
    // WHAT IT COSTS AND WHAT IT BUYS, measured on this machine immediately
    // before the change (`npm run test:unit:slow`, 20 files / 364 tests /
    // 2569 s wall, serial):
    //
    //   runnerDemo/generator.slow.test.js          1470 s  ⛔ 1 FAILED (300 s
    //                                                      test timeout on
    //                                                      [blue+doubleJump+
    //                                                      glide+spring] × 1,2)
    //   runnerDemo/canRun.slow.test.js              379 s
    //   runnerDemo/generatorFeatures.slow.test.js   177 s
    //   runnerDemo/specGenerator.slow.test.js       125 s
    //   runnerDemo/presetBot.slow.test.js           110 s
    //   procgenPipeline/runnerSphereGrowth.slow…     72 s
    //   runnerDemo/deriveRules.slow.test.js          36 s
    //   runnerDemo/zoneRules.slow.test.js            10 s
    //                                        ───────────
    //                                             2380 s = 92.6% of the suite
    //
    // ⇒ MEASURED AFTER, same machine, same command: 12 files / 217 tests /
    // **178 s**, ALL GREEN — a 93.1% cut, and the CI slow job stops carrying a
    // red it cannot act on. ⛓ AND ON CI, WHICH IS THE NUMBER THAT MATTERS:
    // the `JavaScript Unit Tests` workflow (it runs `test:unit` then
    // `test:unit:slow`) went **15m52s → 3m20s** across this one commit
    // (`f82bc84b9` → `991db346c`).
    //
    // ⚠ THE PATTERNS ARE DELIBERATELY BROAD. A NEW `runnerDemo/*.slow.test.js`
    // written before the redesign lands would also be excluded — which is the
    // intent here, and is the opposite of the usual rule (testBatches.js's
    // default batch exists so a new category still RUNS). Said out loud
    // because a silent exclusion is how a suite stops gating without anybody
    // noticing.
    //
    // ⛓ NOT TOUCHED, and each still runs: runnerDemo's DEFAULT-tier
    // `*.test.js` (apRules, botDriver, canRun, deriveRules, gameCore,
    // generator, level, parity, physics, runnerDemoLibrary, zoneRules) in
    // `npm run test:unit`; `runnerDemo/generator.calib.test.js` in the manual
    // calibration tier; the in-app runner substrate tests
    // (`npm test -- --mode=test-substrates`); and the Playwright instruments
    // `scripts/procgen/verify-runner-*.mjs`.
    exclude: [
        ...configDefaults.exclude,
        'frontend/modules/runnerDemo/**/*.slow.test.js',
        'frontend/modules/procgenPipeline/runnerSphereGrowth.slow.test.js',
    ],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    // Serial across files: no CPU contention -> no contention-induced timeouts.
    fileParallelism: false,
    // Generous ceiling for the heaviest single tests on a slow/clean runner.
    testTimeout: 120000,
  },
});
