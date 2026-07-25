import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Directory where your test files are located
  testDir: './test_json/e2e',

  // Timeout for each test (in milliseconds)
  // Default is 900s (15 minutes) to accommodate games with many events (e.g.,
  // Yu-Gi-Oh! 2006) and, since arc D2, in-app legs that drive a substrate's
  // game loop in REAL TIME. The omsi bridge steps its fork at 50 ticks/s of
  // wall clock, so a single ~350-mana fork loop is ~7 seconds and a bot walk
  // is a chain of them separated by host loop resets — `omsi-bot-*` costs
  // minutes by construction, not because anything is stalling.
  //
  // This is a CEILING, not a cost: a suite that finishes in 90s still
  // finishes in 90s. It was raised from 300s when the whole test-substrates
  // run (one Playwright test wrapping every in-app leg) began to exceed it.
  // Use TEST_TIMEOUT env var to override, or pass --timeout flag to playwright.
  timeout: parseInt(process.env.TEST_TIMEOUT) || 900000,

  // Expectations timeout (how long to wait for expect() conditions to be met)
  expect: {
    timeout: 10000,
  },

  // Whether to run tests in parallel. Default is true.
  // Set to false if your tests have interdependencies or modify shared state in a way that parallel execution would break.
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI only.
  retries: process.env.CI ? 2 : 0,

  // Number of worker threads to run tests with. Defaults to half of CPU cores.
  // workers: process.env.CI ? 1 : undefined, // Can be adjusted

  // Reporter to use. See https://playwright.dev/docs/test-reporters
  // We'll use the JSON reporter and output to a file.
  reporter: [
    ['list'], // Standard list reporter for console output
    ['json', { outputFile: 'playwright-report.json' }], // JSON reporter
  ],

  use: {
    // Base URL to use in actions like `await page.goto('/')`
    // baseURL: 'http://localhost:8000', // If you set this, your APP_URL in app.spec.js could be relative

    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: 'on-first-retry',

    // Viewport size for the browser
    // viewport: { width: 1280, height: 720 },

    // headless: false, // Uncomment to run tests with a visible browser for debugging
    launchOptions: {
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        // Only use --single-process for non-multiclient tests (it's incompatible with multi-context tests)
        ...(process.env.TEST_GAME && !process.env.DISABLE_SINGLE_PROCESS ? ['--single-process'] : []),
      ],
    },
  },

  /* Configure projects for major browsers - useful if you want to test across multiple browsers */
  // projects: [
  //   {
  //     name: 'chromium',
  //     use: { ...devices['Desktop Chrome'] },
  //   },
  //   {
  //     name: 'firefox',
  //     use: { ...devices['Desktop Firefox'] },
  //   },
  //   {
  //     name: 'webkit',
  //     use: { ...devices['Desktop Safari'] },
  //   },
  // ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc.
   * Playwright CLEARS this directory at the start of every run. It must
   * therefore NOT be the bare `test-results/`, because the in-app suite
   * writes its per-run JSON to `test-results/in-app-tests/` — with the
   * default, every run wiped the previous runs' results and left only
   * the newest, so run-to-run comparison was impossible (documented as
   * known issue #9 in CC/cloud-environment-issues.md). Scoping the
   * cleanup to a subdirectory keeps Playwright's own artifact hygiene
   * while leaving sibling directories alone. */
  outputDir: 'test-results/playwright',

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'python -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true, // Always reuse existing server (workflow starts it before tests)
    timeout: 120 * 1000, // Timeout for web server to start
  },
});
