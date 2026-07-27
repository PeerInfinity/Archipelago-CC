import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    // Test file patterns
    // scripts/**: pure logic that backs a scripts/procgen CLI (the Seedling
    // .oel / level-table parsers) — node-only build tooling, so it has no home
    // in the bundled frontend graph, but it is exactly the kind of code unit
    // tests are for.
    include: ['frontend/**/*.test.js', 'test_json/unit/**/*.test.js', 'scripts/**/*.test.js'],

    // Heavy, CPU-bound generate-and-test property suites (*.slow.test.js) are
    // excluded from the default run — they're synchronous and, under parallel
    // CPU contention, stretch past vitest's (non-interruptible) timeout and
    // flake with STACK_TRACE_ERROR. Run them serially via `npm run test:unit:slow`
    // (vitest.slow.config.js). Keep the vitest defaults (node_modules, etc.).
    //
    // runnerDemo's PURE unit tests are back in the default run (test-strategy
    // rebalance §1, 2026-07-12): they were disabled wholesale 2026-07-09 because
    // generation-invoking tests (generateLevel/generateZoneSet) flaked under
    // parallel CPU contention. Those are now split out into *.slow.test.js
    // files (generatorFeatures, zoneRules.slow, …), so what remains here is
    // sub-second fixture/unit work. The **/*.slow.test.js rule keeps the
    // generation-backed suites in the serial slow battery.
    exclude: [
      ...configDefaults.exclude,
      '**/*.slow.test.js',
      // Calibration tier (vitest.calib.config.js) — demoted heavy sweeps,
      // run manually via `npm run test:unit:calib`, never in the default run.
      '**/*.calib.test.js',
    ],

    // Environment settings
    environment: 'node',

    // Reporter configuration
    reporters: ['default'],

    // Coverage configuration (run with: npm run test:unit:coverage)
    coverage: {
      provider: 'v8',
      include: ['frontend/modules/shared/ruleEngine.js'],
      exclude: ['**/*.test.js', '**/test-*.js'],
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      // Thresholds can be enabled once baseline is established
      // thresholds: {
      //   lines: 80,
      //   functions: 80,
      //   branches: 80,
      //   statements: 80,
      // },
    },

    // Global test settings
    globals: false,

    // Timeout for tests
    testTimeout: 10000,

    // Benchmark configuration
    benchmark: {
      include: ['frontend/**/*.bench.js'],
      reporters: ['default'],
      outputJson: './benchmark-results.json',
    },
  },
});
