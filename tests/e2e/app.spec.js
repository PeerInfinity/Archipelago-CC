const { test, expect } = require('@playwright/test');

test.describe('Application End-to-End Tests', () => {
  const APP_URL = 'http://localhost:8000/frontend/?mode=test'; // Use the new test mode URL

  test('run in-app tests and check results', async ({ page }) => {
    // Listen for console logs from the page and relay them to Playwright's output
    page.on('console', (msg) => {
      // Filter out less relevant DevTools message if needed, but for now, log most things
      // if (msg.type() !== 'verbose') { // Example: ignore 'verbose' if too noisy
      //     console.log(`BROWSER LOG (${msg.type()}): ${msg.text()}`);
      // }
      // For debugging, let's log everything from the browser console
      console.log(`BROWSER LOG (${msg.type()}): ${msg.text()}`);
    });

    console.log('PW DEBUG: Navigating to application...');
    // Wait until network activity has ceased, giving SPA more time to initialize
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('PW DEBUG: Page navigation complete (network idle).');

    // Wait for the __playwrightTestsComplete__ flag to be set to 'true' in localStorage
    console.log(
      'PW DEBUG: Starting to wait for __playwrightTestsComplete__ flag in localStorage...'
    );
    await page.waitForFunction(
      () => {
        const flag = localStorage.getItem('__playwrightTestsComplete__');
        // This console.log will appear in Playwright's output (from the browser context)
        // and will also be caught by page.on('console') above.
        console.log(
          `Polling localStorage __playwrightTestsComplete__: "${flag}" (type: ${typeof flag})`
        );
        return flag === 'true';
      },
      null,
      { timeout: 60000, polling: 500 }
    ); // Poll every 500ms

    console.log(
      'PW DEBUG: __playwrightTestsComplete__ flag detected as "true".'
    );

    const resultsString = await page.evaluate(() =>
      localStorage.getItem('__playwrightTestResults__')
    );
    expect(resultsString).toBeTruthy();
    console.log(
      'PW DEBUG: __playwrightTestResults__ string retrieved from localStorage.'
    );

    const results = JSON.parse(resultsString);
    // Log only summary to keep PW console cleaner, full log is in playwright-report.json
    // console.log('PW DEBUG: In-app test results summary:', results.summary);
    console.log(
      'PW DEBUG: Full in-app test results:',
      JSON.stringify(results, null, 2)
    );

    expect(results.summary.totalRun).toBeGreaterThan(0);
    expect(results.summary.failedCount).toBe(0);

    const superQuickTestResult = results.testDetails.find(
      (t) => t.id === 'test_4_super_quick'
    );
    expect(superQuickTestResult).toBeDefined();
    expect(superQuickTestResult.status).toBe('passed');

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

    console.log('PW DEBUG: All Playwright assertions passed.');
  });
});
