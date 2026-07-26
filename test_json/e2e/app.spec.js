import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Machine load, sampled at run start and again when a test fails.
 * Several in-app legs are long polls against a live game, and under
 * contention they time out without being broken — the poll-level
 * evidence in testController tells STARVED from STUCK per condition,
 * and this gives the run-level context for that reading.
 */
function loadSnapshot() {
  const [oneMin] = os.loadavg();
  return `load ${oneMin.toFixed(2)} across ${os.cpus().length} cpus`;
}

test.describe('Application End-to-End Tests', () => {
  const testMode = process.env.TEST_MODE || 'test'; // Default to 'test' if not specified
  const testGame = process.env.TEST_GAME; // Optional game parameter
  const testSeed = process.env.TEST_SEED; // Optional seed parameter
  const testPlayer = process.env.TEST_PLAYER; // Optional player parameter for multiworld
  const rulesOverride = process.env.RULES_OVERRIDE; // Optional rules file override
  const testLayout = process.env.TEST_LAYOUT; // Optional layout parameter (mobile/desktop)
  const testOrderSeed = process.env.TEST_ORDER_SEED; // Optional test order seed for reproducible randomization
  const testProfiling = process.env.TEST_PROFILING; // Optional profiling flag (1 to enable)
  const testBatch = process.env.TEST_BATCH; // Optional roster subset (see modules/tests/testBatches.js)

  // Build URL with all optional parameters
  let APP_URL = `http://localhost:8000/frontend/?mode=${testMode}`;
  if (testGame) {
    APP_URL += `&game=${encodeURIComponent(testGame)}`;
  }
  if (testSeed) {
    APP_URL += `&seed=${encodeURIComponent(testSeed)}`;
  }
  if (testPlayer) {
    APP_URL += `&player=${encodeURIComponent(testPlayer)}`;
  }
  if (rulesOverride) {
    APP_URL += `&rules=${encodeURIComponent(rulesOverride)}`;
  }
  if (testLayout) {
    APP_URL += `&layout=${encodeURIComponent(testLayout)}`;
  }
  if (testOrderSeed) {
    APP_URL += `&testOrderSeed=${encodeURIComponent(testOrderSeed)}`;
  }
  if (testProfiling) {
    APP_URL += `&profiling=${encodeURIComponent(testProfiling)}`;
  }
  if (testBatch) {
    APP_URL += `&testBatch=${encodeURIComponent(testBatch)}`;
  }

  test('run in-app tests and check results', async ({ page }) => {
    // Listen for console logs from the page and relay them to Playwright's output
    page.on('console', (msg) => {
      const text = msg.text();
      // The in-app runner's per-case heartbeat (testLogic.js). Relayed
      // bare, so a run in flight can be read at a glance — without it
      // the only per-case signal in the log is buried in thousands of
      // browser lines, and a finished run looks exactly like a hung one.
      if (text.startsWith('[PROGRESS ')) {
        console.log(text);
        return;
      }
      // Filter out less relevant DevTools message if needed, but for now, log most things
      // if (msg.type() !== 'verbose') { // Example: ignore 'verbose' if too noisy
      //     console.log(`BROWSER LOG (${msg.type()}): ${msg.text()}`);
      // }
      // For debugging, let's log everything from the browser console
      console.log(`BROWSER LOG (${msg.type()}): ${text}`);
    });

    console.log(`PW DEBUG: Navigating to application with parameters:`);
    console.log(`  - machine: ${loadSnapshot()}`);
    console.log(`  - mode: ${testMode}`);
    if (testGame) {
      console.log(`  - game: ${testGame}`);
    }
    if (testSeed) {
      console.log(`  - seed: ${testSeed}`);
    }
    if (testPlayer) {
      console.log(`  - player: ${testPlayer}`);
    }
    if (rulesOverride) {
      console.log(`  - rules: ${rulesOverride}`);
    }
    if (testLayout) {
      console.log(`  - layout: ${testLayout}`);
    }
    if (testOrderSeed) {
      console.log(`  - testOrderSeed: ${testOrderSeed}`);
    }
    if (testProfiling) {
      console.log(`  - profiling: ${testProfiling}`);
    }
    console.log(`PW DEBUG: URL: ${APP_URL}`);
    // waitUntil 'load', not 'networkidle': modes that auto-start their
    // tests on load (test-substrates) generate continuous network from
    // the moment the app boots, so a 500ms network gap may never occur
    // and the networkidle gate times out while the in-app suite passes
    // (observed 4x). Phase 1 below already polls the
    // __playwrightTestsStarted__ flag, which is the real readiness
    // signal.
    await page.goto(APP_URL, { waitUntil: 'load', timeout: 60000 });
    console.log('PW DEBUG: Page navigation complete (load).');

    // Phase 1: Wait for tests to START (short timeout - fail fast if page doesn't load)
    console.log(
      'PW DEBUG: Waiting for tests to start (__playwrightTestsStarted__ flag)...'
    );
    try {
      await page.waitForFunction(
        () => {
          // Tests started
          if (window.__playwrightTestsStarted__ === true) {
            return true;
          }
          // Or tests already complete (edge case)
          if (window.__playwrightTestsComplete__ === true) {
            return true;
          }
          // Or error occurred
          if (window.__playwrightTestsError__ === true) {
            return true;
          }
          return false;
        },
        null,
        { timeout: 30000, polling: 500 }
      );
      console.log('PW DEBUG: Tests started (or already complete/errored).');
    } catch (e) {
      console.error('PW DEBUG: Timeout waiting for tests to start. Page may have failed to load.');
      // Set error flag and results so the test can report properly
      await page.evaluate(() => {
        window.__playwrightTestsError__ = true;
        window.__playwrightTestResults__ = {
          summary: {
            totalRun: 0,
            passedCount: 0,
            failedCount: 1,
            failedConditionsCount: 0,
            skippedCount: 0,
            totalExpected: 0,
            error: 'Timeout waiting for tests to start - page may have failed to load'
          },
          testDetails: [{
            name: 'Page Load',
            category: 'System',
            status: 'failed',
            message: 'Timeout waiting for tests to start'
          }]
        };
        window.__playwrightTestsComplete__ = true;
      });
    }

    // Phase 2: Wait for tests to COMPLETE (longer timeout for actual test execution)
    console.log(
      'PW DEBUG: Waiting for tests to complete (__playwrightTestsComplete__ flag)...'
    );
    await page.waitForFunction(
      () => {
        const flag = window.__playwrightTestsComplete__;
        const errorFlag = window.__playwrightTestsError__;
        const results = window.__playwrightTestResults__;

        // If there's an error flag, exit early
        if (errorFlag === true) {
          console.log('PW DEBUG: Early termination due to test error detected');
          return true;
        }

        // If we have results and they indicate all tests are done (even with failures), exit
        if (results && results.summary) {
          if (results.summary.totalExpected === (results.summary.totalRun + results.summary.skippedCount)) {
            console.log('PW DEBUG: All expected tests completed (with possible failures)');
            return true;
          }
        }

        return flag === true;
      },
      null,
      { timeout: parseInt(process.env.TEST_TIMEOUT) || 900000, polling: 500 }
    ); // Poll every 500ms. Timeout can be overridden via TEST_TIMEOUT env var.

    console.log(
      'PW DEBUG: __playwrightTestsComplete__ flag detected as true.'
    );

    const results = await page.evaluate(() => window.__playwrightTestResults__);
    expect(results).toBeTruthy();
    console.log(
      'PW DEBUG: __playwrightTestResults__ retrieved from window object.'
    );

    // Results are already parsed from window object (no need for JSON.parse)
    // Log only summary to keep PW console cleaner, full log is in playwright-report.json
    // console.log('PW DEBUG: In-app test results summary:', results.summary);
    console.log(
      'PW DEBUG: Full in-app test results:',
      JSON.stringify(results, null, 2)
    );

    // Save the test results to a file
    try {
      const outputDir = path.join(process.cwd(), 'test-results', 'in-app-tests');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const outputFile = path.join(outputDir, `test-results-${timestamp}.json`);

      // Stamp the mode: without it, comparing "the last two runs" can
      // silently pit a substrates run against a regression one and
      // report the entire roster as changed. The batch is stamped for
      // exactly the same reason — a `fast` batch and a full run of the
      // same mode have deliberately different rosters, so comparing
      // across them would report every quarantined test as REMOVED.
      fs.writeFileSync(
        outputFile,
        JSON.stringify({ mode: testMode, batch: testBatch || null, ...results }, null, 2)
      );
      console.log(`PW DEBUG: Test results saved to: ${outputFile}`);

      // These files now survive across runs (see outputDir in
      // playwright.config.js), so keep the directory bounded.
      const KEEP_RUNS = 30;
      const stale = fs.readdirSync(outputDir)
        .filter((f) => f.startsWith('test-results-') && f.endsWith('.json'))
        .sort()                      // ISO timestamps sort chronologically
        .slice(0, -KEEP_RUNS);
      for (const f of stale) fs.unlinkSync(path.join(outputDir, f));
      if (stale.length > 0) {
        console.log(`PW DEBUG: Pruned ${stale.length} result file(s) older than the last ${KEEP_RUNS} runs.`);
      }
    } catch (error) {
      console.error('PW DEBUG: Failed to save test results to file:', error);
    }

    // Failure summary. Printed BEFORE the assertions below, which throw
    // on the first failure: without this, a red run reports only
    // Playwright's own "1 failed" and the actual in-app leg — and the
    // condition it died on — is visible only by digging through the
    // saved JSON.
    const failedTests = (results.testDetails || []).filter((t) => t.status === 'failed');
    if (failedTests.length > 0) {
      console.log(`\nPW DEBUG: ===== ${failedTests.length} IN-APP TEST(S) FAILED =====`);
      console.log(`  machine at failure: ${loadSnapshot()}`);
      for (const t of failedTests) {
        const secs = t.durationMs != null ? ` after ${(t.durationMs / 1000).toFixed(1)}s` : '';
        console.log(`  FAILED: ${t.id}${secs}`);
        const failedConditions = (t.conditions || []).filter((c) => c.status === 'failed');
        for (const c of failedConditions) {
          console.log(`    condition: ${c.description}`);
        }
        if (failedConditions.length === 0) {
          console.log('    (no failed condition recorded — the test died before asserting)');
        }
      }
      console.log('PW DEBUG: =========================================\n');
    }

    // Truncation guard. The in-app runner races the whole suite against a
    // wall-clock budget (testLogic.js AUTO_START_TIMEOUT_MS); when it expires
    // the catch path still publishes completion flags, so a run that never
    // reached the end of its roster used to satisfy every assertion below and
    // print "All Playwright assertions passed". Silence is not success: assert
    // the roster was FINISHED, not merely that what ran was green.
    //
    // Three independent signals, because each can appear alone: summary.error
    // (the runner recorded why it stopped), a test left in 'running' (cut off
    // mid-test), and notRunCount (enabled tests the runner never reached —
    // these are absent from testDetails entirely, so they are invisible to
    // every other check here).
    const stillRunning = (results.testDetails || []).filter((t) => t.status === 'running');
    const notRunCount = results.summary.notRunCount ?? null;
    const truncated =
      !!results.summary.error || stillRunning.length > 0 || (notRunCount ?? 0) > 0;

    if (truncated) {
      console.log('\nPW DEBUG: ===== IN-APP RUN DID NOT FINISH ITS ROSTER =====');
      if (results.summary.error) {
        console.log(`  runner stopped because: ${results.summary.error}`);
      }
      if (results.summary.timedOut) {
        console.log(
          `  cause: the suite's wall-clock budget (${results.summary.timeoutMs / 1000}s) expired`
          + ' — split the roster or raise AUTO_START_TIMEOUT_MS in testLogic.js'
        );
      }
      if (results.summary.enabledCount != null) {
        console.log(
          `  roster: ${results.summary.totalRun}/${results.summary.enabledCount} enabled tests completed`
          + (notRunCount ? ` — ${notRunCount} did not` : '')
        );
      }
      for (const t of stillRunning) {
        const secs = t.durationMs != null ? ` (${(t.durationMs / 1000).toFixed(1)}s in)` : '';
        console.log(`  CUT OFF MID-TEST: ${t.id}${secs}`);
      }
      const neverStarted = (results.summary.notRunIds || [])
        .filter((id) => !stillRunning.some((t) => t.id === id));
      if (neverStarted.length > 0) {
        console.log(`  NEVER STARTED (${neverStarted.length}): ${neverStarted.join(', ')}`);
      }
      console.log(`  machine at truncation: ${loadSnapshot()}`);
      console.log('  NOTE: the tests that did run may all be green — that is not a pass.');
      console.log('PW DEBUG: ================================================\n');
    }

    // The test system should complete successfully regardless of whether tests run
    expect(results.summary.failedCount).toBe(0);

    // Fail the run when the roster was not finished. Kept after failedCount so
    // a genuinely-failing test still reports as a test failure first.
    expect(
      results.summary.error ?? null,
      'in-app runner stopped early (see "DID NOT FINISH ITS ROSTER" above)'
    ).toBeNull();
    expect(
      stillRunning.map((t) => t.id),
      'in-app run was cut off mid-test'
    ).toEqual([]);
    if (notRunCount != null) {
      expect(
        results.summary.notRunIds ?? [],
        'enabled tests that did not complete'
      ).toEqual([]);
    }
    
    // If tests actually ran, they should pass
    if (results.summary.totalRun > 0) {
      expect(results.summary.passedCount).toBeGreaterThan(0);
      
      // Look for any core tests that might have run
      const coreTests = results.testDetails.filter(t => 
        t.category === 'Core' && t.status === 'passed'
      );
      if (coreTests.length > 0) {
        console.log('PW DEBUG: Found passing core tests:', coreTests.map(t => t.name));
      }
    } else {
      // If no tests ran, make sure all tests are disabled (which is a valid state)
      const enabledTests = results.testDetails.filter(t => t.status !== 'disabled');
      console.log('PW DEBUG: No tests ran. Enabled tests found:', enabledTests.length);
      // This is acceptable - the system should handle no enabled tests gracefully
    }

    // Check for test case results from testCasePanelRunAll
    const testCaseResultsString = await page.evaluate(() =>
      localStorage.getItem('__testCaseResults__')
    );

    if (testCaseResultsString) {
      console.log('PW DEBUG: Test case results found in localStorage.');
      const testCaseResults = JSON.parse(testCaseResultsString);

      console.log(
        'PW DEBUG: Test Case Results Summary:',
        `Total: ${testCaseResults.total}, ` +
          `Passed: ${testCaseResults.passed}, ` +
          `Failed: ${testCaseResults.failed}, ` +
          `Cancelled: ${testCaseResults.cancelled}`
      );

      // Log failed tests for debugging
      if (testCaseResults.failed > 0) {
        console.log('PW DEBUG: Failed test cases:');
        testCaseResults.details.forEach((test) => {
          if (test.status === 'failed' || test.status === 'error') {
            console.log(`  - ${test.locationName}: ${test.message}`);
          }
        });
      }

      // Report test case results (but don't fail the Playwright test if some test cases fail)
      // This allows us to see the results even if there are failing test cases
      console.log(
        `PW DEBUG: Test case validation completed. ${testCaseResults.passed}/${testCaseResults.total} test cases passed.`
      );

      // Optionally, you can uncomment the line below to make Playwright fail if any test cases fail:
      // expect(testCaseResults.failed).toBe(0);
    } else {
      console.log('PW DEBUG: No test case results found in localStorage.');
    }

    // Check for detailed spoiler test results
    const spoilerTestResults = await page.evaluate(() => {
      const windowResults = typeof window !== 'undefined' && window.__spoilerTestResults__ ? window.__spoilerTestResults__ : null;
      const localStorageResults = localStorage.getItem('__spoilerTestResults__');
      return {
        windowResults,
        localStorageResults: localStorageResults ? JSON.parse(localStorageResults) : null
      };
    });

    if (spoilerTestResults.windowResults) {
      const results = spoilerTestResults.windowResults;
      console.log(`PW DEBUG: Spoiler test overview: passed=${results.passed}, processed=${results.processedEvents}/${results.totalEvents}`);
      
      if (results.mismatchDetails && results.mismatchDetails.length > 0) {
        console.log(`PW DEBUG: MISMATCH DETAILS (${results.mismatchDetails.length} mismatches):`);
        results.mismatchDetails.forEach((mismatch, index) => {
          console.log(`PW DEBUG: Mismatch ${index + 1}:`);
          console.log(`  - Context: ${mismatch.context}`);
          console.log(`  - Event: ${mismatch.eventIndex}, Sphere: ${mismatch.sphereIndex}`);
          console.log(`  - Missing from state: ${JSON.stringify(mismatch.missingFromState)}`);
          console.log(`  - Extra in state: ${JSON.stringify(mismatch.extraInState)}`);
          console.log(`  - Log accessible count: ${mismatch.logAccessibleCount}`);
          console.log(`  - State accessible count: ${mismatch.stateAccessibleCount}`);
        });
      } else {
        console.log('PW DEBUG: No mismatch details found.');
      }
      
      if (results.errorMessages && results.errorMessages.length > 0) {
        console.log(`PW DEBUG: ERROR MESSAGES:`);
        results.errorMessages.forEach((msg, index) => {
          console.log(`  ${index + 1}: ${msg}`);
        });
      }
    } else {
      console.log('PW DEBUG: No detailed spoiler test results found in window.__spoilerTestResults__.');
    }

    if (spoilerTestResults.localStorageResults) {
      console.log(`PW DEBUG: Detailed spoiler test results from localStorage: ${JSON.stringify(spoilerTestResults.localStorageResults, null, 2)}`);
    } else {
      console.log('PW DEBUG: No detailed spoiler test results found in localStorage.__spoilerTestResults__.');
    }

    // Capture and log profiling data if available
    const profilingData = await page.evaluate(() => {
      return typeof window !== 'undefined' && window.__profilingData__ ? window.__profilingData__ : null;
    });
    if (profilingData) {
      console.log('PW DEBUG: Profiling data captured:');
      console.log(JSON.stringify(profilingData, null, 2));
    }

    console.log('PW DEBUG: All Playwright assertions passed.');
  });
});
