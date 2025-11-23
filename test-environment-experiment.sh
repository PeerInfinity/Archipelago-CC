#!/bin/bash
# Experiment with cloud environment settings for Playwright

set -e

echo "=== Cloud Environment Settings Experiment ==="
echo "Testing different Chrome launch flags to understand their necessity"
echo ""

# Backup original config
cp playwright.config.js playwright.config.js.backup

# Activate virtual environment
source .venv/bin/activate

# Test 1: Baseline (all flags, with --single-process)
echo "Test 1: Baseline (all cloud flags + --single-process)"
echo "Flags: --disable-dev-shm-usage, --no-sandbox, --disable-setuid-sandbox, --disable-gpu, --single-process"
python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml" > /tmp/test1_baseline.log 2>&1 || true
RESULT1=$(grep "Single Seed Test Summary" /tmp/test1_baseline.log || echo "Test crashed")
TIME1=$(grep "Total batch processing time" /tmp/test1_baseline.log | grep -oP '\d+\.\d+ seconds' || echo "N/A")
echo "Result: $RESULT1"
echo "Time: $TIME1"
echo ""

# Test 2: Remove --disable-dev-shm-usage
echo "Test 2: Without --disable-dev-shm-usage"
echo "Flags: --no-sandbox, --disable-setuid-sandbox, --disable-gpu, --single-process"
cat > playwright.config.js << 'EOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 150000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'playwright-report.json' }],
  ],
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        // '--disable-dev-shm-usage',  // REMOVED
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        ...(process.env.TEST_GAME && !process.env.DISABLE_SINGLE_PROCESS ? ['--single-process'] : []),
      ],
    },
  },
  webServer: {
    command: 'python -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
EOF
python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml" > /tmp/test2_no_shm.log 2>&1 || true
RESULT2=$(grep "Single Seed Test Summary" /tmp/test2_no_shm.log || echo "Test crashed")
TIME2=$(grep "Total batch processing time" /tmp/test2_no_shm.log | grep -oP '\d+\.\d+ seconds' || echo "N/A")
echo "Result: $RESULT2"
echo "Time: $TIME2"
echo ""

# Test 3: Remove --no-sandbox (restore others)
echo "Test 3: Without --no-sandbox"
echo "Flags: --disable-dev-shm-usage, --disable-setuid-sandbox, --disable-gpu, --single-process"
cat > playwright.config.js << 'EOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 150000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'playwright-report.json' }],
  ],
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        '--disable-dev-shm-usage',
        // '--no-sandbox',  // REMOVED
        '--disable-setuid-sandbox',
        '--disable-gpu',
        ...(process.env.TEST_GAME && !process.env.DISABLE_SINGLE_PROCESS ? ['--single-process'] : []),
      ],
    },
  },
  webServer: {
    command: 'python -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
EOF
python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml" > /tmp/test3_no_sandbox.log 2>&1 || true
RESULT3=$(grep "Single Seed Test Summary" /tmp/test3_no_sandbox.log || echo "Test crashed")
TIME3=$(grep "Total batch processing time" /tmp/test3_no_sandbox.log | grep -oP '\d+\.\d+ seconds' || echo "N/A")
echo "Result: $RESULT3"
echo "Time: $TIME3"
echo ""

# Test 4: Remove --disable-gpu
echo "Test 4: Without --disable-gpu"
echo "Flags: --disable-dev-shm-usage, --no-sandbox, --disable-setuid-sandbox, --single-process"
cat > playwright.config.js << 'EOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 150000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'playwright-report.json' }],
  ],
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // '--disable-gpu',  // REMOVED
        ...(process.env.TEST_GAME && !process.env.DISABLE_SINGLE_PROCESS ? ['--single-process'] : []),
      ],
    },
  },
  webServer: {
    command: 'python -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
EOF
python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml" > /tmp/test4_no_gpu.log 2>&1 || true
RESULT4=$(grep "Single Seed Test Summary" /tmp/test4_no_gpu.log || echo "Test crashed")
TIME4=$(grep "Total batch processing time" /tmp/test4_no_gpu.log | grep -oP '\d+\.\d+ seconds' || echo "N/A")
echo "Result: $RESULT4"
echo "Time: $TIME4"
echo ""

# Test 5: Only --single-process (remove all cloud flags)
echo "Test 5: Only --single-process (all cloud flags removed)"
echo "Flags: --single-process only"
cat > playwright.config.js << 'EOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 150000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'playwright-report.json' }],
  ],
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      args: [
        // All cloud flags removed
        ...(process.env.TEST_GAME && !process.env.DISABLE_SINGLE_PROCESS ? ['--single-process'] : []),
      ],
    },
  },
  webServer: {
    command: 'python -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
EOF
python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml" > /tmp/test5_single_only.log 2>&1 || true
RESULT5=$(grep "Single Seed Test Summary" /tmp/test5_single_only.log || echo "Test crashed")
TIME5=$(grep "Total batch processing time" /tmp/test5_single_only.log | grep -oP '\d+\.\d+ seconds' || echo "N/A")
echo "Result: $RESULT5"
echo "Time: $TIME5"
echo ""

# Restore original config
cp playwright.config.js.backup playwright.config.js

echo "=== Experiment Complete ==="
echo ""
echo "Summary:"
echo "Test 1 (Baseline): $RESULT1 ($TIME1)"
echo "Test 2 (No --disable-dev-shm-usage): $RESULT2 ($TIME2)"
echo "Test 3 (No --no-sandbox): $RESULT3 ($TIME3)"
echo "Test 4 (No --disable-gpu): $RESULT4 ($TIME4)"
echo "Test 5 (Only --single-process): $RESULT5 ($TIME5)"
echo ""
echo "Full logs available in /tmp/test*.log"
