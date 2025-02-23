import stateManager from './stateManagerSingleton.js';

export class TestCaseManager {
  constructor(gameUI) {
    this.gameUI = gameUI;
    this.testCases = null;
    this.testRules = null;
    this.currentTest = null;
  }

  async initialize() {
    try {
      const [testCasesResponse, testRulesResponse] = await Promise.all([
        fetch('./test_cases.json'),
        fetch('./test_output_rules.json'),
      ]);
      this.testCases = await testCasesResponse.json();
      this.testRules = await testRulesResponse.json();

      // Render the test cases list once during initialization
      this.renderTestCasesList();
      return true;
    } catch (error) {
      console.error('Error loading test data:', error);
      return false;
    }
  }

  async loadTestCase(testData, statusElement) {
    try {
      statusElement.textContent = 'Loading test...';
      const [location, expectedResult, requiredItems = [], excludedItems = []] =
        testData;

      // Initialize inventory for test case
      stateManager.initializeInventoryForTest(
        requiredItems,
        excludedItems,
        this.testRules.progression_mapping['1'],
        this.testRules.items['1']
      );

      // Force UI sync
      this.gameUI.inventoryUI.syncWithState();
      this.gameUI.locationUI.syncWithState();

      // Check if location is accessible
      const locationAccessible = stateManager.isLocationAccessible(
        { name: location },
        stateManager.inventory
      );
      const passed = locationAccessible === expectedResult;

      // Format status message
      statusElement.innerHTML = `<div class="${
        passed ? 'test-success' : 'test-failure'
      }">${passed ? '✓ PASS' : '❌ FAIL'}</div>`;

      return true;
    } catch (error) {
      console.error('Error loading test case:', error);
      statusElement.innerHTML = `<div class="test-error">Error: ${this.escapeHtml(
        error.message
      )}</div>`;
      return false;
    }
  }

  async runAllTests() {
    if (!this.testCases?.location_tests) return;

    // Disable the Run All Tests button while tests are running
    const runAllButton = document.getElementById('run-all-tests');
    if (runAllButton) {
      runAllButton.disabled = true;
      runAllButton.textContent = 'Running Tests...';
    }

    try {
      // Run each test with minimal delay to allow UI updates
      for (const [index, testCase] of this.testCases.location_tests.entries()) {
        const statusElement = document.getElementById(`test-status-${index}`);
        if (statusElement) {
          await this.loadTestCase(testCase, statusElement);
          // Small delay to allow UI to update and prevent freezing
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    } finally {
      // Re-enable the button when done
      if (runAllButton) {
        runAllButton.disabled = false;
        runAllButton.textContent = 'Run All Tests';
      }
    }
  }

  renderTestCasesList() {
    const container = document.getElementById('test-cases-list');

    let html = `
        <div class="test-header">
            <h3>Available Test Cases</h3>
            <button id="run-all-tests" class="button">Run All Tests</button>
        </div>
        <table class="results-table">
            <tr>
                <th>Location</th>
                <th>Expected Access</th>
                <th>Required Items</th>
                <th>Excluded Items</th>
                <th>Actions</th>
                <th style="min-width: 100px;">Result</th>
            </tr>
    `;

    if (!this.testCases?.location_tests) {
      container.innerHTML = '<p>Error: Test cases not loaded</p>';
      return;
    }

    // Create table rows for each test case
    this.testCases.location_tests.forEach((testCase, index) => {
      const [location, expectedResult, requiredItems = [], excludedItems = []] =
        testCase;
      // Fix: Use simple numeric ID
      const statusId = `test-status-${index}`; // Removed 'test-case-' prefix

      html += `
            <tr class="test-case-row">
                <td>${this.escapeHtml(location)}</td>
                <td>${
                  expectedResult
                    ? 'Should be accessible'
                    : 'Should not be accessible'
                }</td>
                <td>${
                  requiredItems.length
                    ? this.escapeHtml(requiredItems.join(', '))
                    : 'None'
                }</td>
                <td>${
                  excludedItems.length
                    ? this.escapeHtml(excludedItems.join(', '))
                    : 'None'
                }</td>
                <td>
                    <button class="button run-test" data-test-index="${index}">
                        Run Test
                    </button>
                </td>
                <td>
                    <div class="test-status" id="${statusId}"></div>
                </td>
            </tr>
        `;
    });

    html += `</table>`;

    // Add styles
    html += `
        <style>
            .test-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }
            .test-header h3 {
                margin: 0;
            }
            .results-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            .results-table th, .results-table td {
                border: 1px solid #444;
                padding: 8px;
                text-align: left;
            }
            .results-table th {
                background-color: #333;
                color: #cecece;
            }
            .test-case-row:nth-child(even) {
                background-color: rgba(0, 0, 0, 0.2);
            }
            .test-case-row:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            .test-status {
                white-space: nowrap;
                font-size: 0.9em;
            }
            .test-success, .test-failure, .test-error {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .test-success {
                color: #4caf50;
            }
            .test-failure {
                color: #f44336;
            }
            .test-error {
                color: #ff9800;
            }
        </style>
    `;

    container.innerHTML = html;

    // Attach event listeners with matching ID format
    container.querySelectorAll('.run-test').forEach((button) => {
      const index = parseInt(button.dataset.testIndex, 10);
      const testCase = this.testCases.location_tests[index];
      const statusElement = document.getElementById(`test-status-${index}`); // Match ID format
      if (testCase && statusElement) {
        button.onclick = () => this.loadTestCase(testCase, statusElement);
      }
    });

    // Add Run All Tests button listener
    document
      .getElementById('run-all-tests')
      ?.addEventListener('click', () => this.runAllTests());
  }

  escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
