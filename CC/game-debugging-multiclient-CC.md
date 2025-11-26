# Multiclient Test Debugging Guide (Cloud Interface)

This guide explains how to run and debug the single-client multiclient timer test in the Claude Code cloud interface. This test validates end-to-end functionality by checking that the frontend can successfully check all locations via the Archipelago server.

## Cloud Environment Context

When working in the cloud interface:

- **Single-Client Mode Only**: Cloud environments cannot run the dual-client test (requires multiple browser contexts). Use `--single-client` flag.
- **Isolated Environment**: Each instance runs in its own isolated container
- **Independent Branches**: Your work is on a dedicated branch
- **Fresh Setup**: Requires initial setup before testing

## Prerequisites

**⚠️ CRITICAL: Complete Setup First**

Before following this guide, you **must** complete the cloud environment setup described in `CC/cloud-setup.md`. This includes:

1. Creating Python virtual environment (`.venv`)
2. Installing Python requirements and game-specific dependencies
3. Generating template YAML files (`Players/Templates/`)
4. Configuring `host.yaml` for testing
5. Installing Node.js dependencies and Playwright browsers

**Setup verification:**
```bash
# Quick check - all should return OK
source .venv/bin/activate
python -c "import websockets; print('Python: OK')"
test -d Players/Templates && echo "Templates: OK"
test -f host.yaml && echo "host.yaml: OK"
test -d node_modules && echo "Node.js: OK"
npx playwright --version && echo "Playwright: OK"
```

If any checks fail, return to `CC/cloud-setup.md` and complete the setup.

## Testing Philosophy

The single-client multiclient test validates **end-to-end functionality**:
1. The frontend can connect to an Archipelago server
2. The timer can successfully check all accessible locations
3. Location checks are properly communicated to the server

Unlike the spoiler test (which validates logic equivalence), this test validates the actual timer and server communication work correctly.

## How the Single-Client Test Works

```
┌──────────────────┐   1. Starts   ┌────────────────────────┐
│ Python           ├──────────────►│   Archipelago Server   │
│ MultiServer.py   │               │   (localhost:38281)    │
└──────────────────┘               └───────────┬────────────┘
                                               │
                                       2. Connects
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │  Single Client   │
                                    │  (Timer Test)    │
                                    │  - Checks locs   │
                                    │  - Sends to srv  │
                                    │  - Verifies all  │
                                    └──────────────────┘
```

The test:
1. Starts a Python Archipelago server using the `.archipelago` file
2. Opens a browser client that connects to the server
3. Runs the timer to check all manually-checkable locations
4. Verifies all locations were successfully checked

## Running the Single-Client Test

### For a Single Game

```bash
# Activate virtual environment first
source .venv/bin/activate

# Run single-client multiclient test
python scripts/test/test-all-templates.py --include-list "Adventure.yaml" --multiclient --single-client

# Skip generation (use existing rules file)
python scripts/test/test-all-templates.py --include-list "Adventure.yaml" --multiclient --single-client --test-only
```

### Understanding the Command Output

**Successful test:**
```
=== Testing Adventure.yaml ===
Running Generate.py for Adventure.yaml...
Running multiclient timer test (single-client mode)...
  Command: npx playwright test tests/e2e/multiclient.spec.js -g single client timer test
  Environment: TEST_GAME=adventure TEST_SEED=1
Completed Adventure.yaml: Generation=[PASS], Test=[PASS], Gen Errors=0, Locations Checked=25/24
```

Note: `Locations Checked=25/24` means 25 total locations checked out of 24 manually-checkable (the extra is an auto-collected event).

**Failed test:**
```
=== Testing Bomb Rush Cyberfunk.yaml ===
Running multiclient timer test (single-client mode)...
Multiclient test failed: None
Test return code: 1
Errors in output: 2
First error: Error: expect(received).toBe(expected)
Completed Bomb Rush Cyberfunk.yaml: Generation=[PASS], Test=[FAIL], Gen Errors=0, Locations Checked=116/247
```

## Understanding Test Results

### Result Files

Single-client test results are saved to `test_results/multiclient/`:
```
test_results/multiclient/
└── client1-timer-single-2025-11-26T18-52-41-424Z.json
```

**Examine the results:**
```bash
# Find the most recent single-client result
ls -lt test_results/multiclient/client1-timer-single-*.json | head -1

# View the summary
cat test_results/multiclient/client1-timer-single-*.json | jq '.summary'

# View failed conditions
cat test_results/multiclient/client1-timer-single-*.json | jq '.testDetails[0].conditions[] | select(.status == "failed")'
```

### Aggregated Results

Results are also saved to `scripts/output/multiclient/test-results.json`:

```json
{
  "multiclient_test": {
    "success": true,
    "client1_passed": true,
    "client1_locations_checked": 25,
    "client1_manually_checkable": 24,
    "single_client_mode": true,
    "locations_checked": 25,
    "total_locations": 24
  }
}
```

**Key fields:**
- `success`: Overall test passed
- `client1_locations_checked`: Total locations the timer checked
- `client1_manually_checkable`: Locations that can be timer-checked (ID > 0)
- `single_client_mode`: Confirms running in single-client mode

## Common Failure Patterns

### Pattern 1: Stall at Partial Completion

**Symptom:**
```
Test appears to be stalled - no progress for 10 seconds (116 locations checked)
Only 116/247 manually-checkable locations were checked - TEST FAILED
```

**Root Cause:** The timer stops making progress because some locations cannot be reached.

**Debugging Steps:**

1. **Run spoiler test first** to verify basic logic:
   ```bash
   python scripts/test/test-all-templates.py --include-list "YourGame.yaml"
   ```
   If spoiler test fails, fix those issues first (see `game-debugging-CC.md`).

2. **Check detailed logs** for the specific failure point:
   ```bash
   cat test_results/multiclient/client1-timer-single-*.json | jq '.testDetails[0].logs[-20:]'
   ```

3. **Compare with spoiler test results** to see if the same locations are problematic.

### Pattern 2: Connection Timeout

**Symptom:**
```
Failed to connect to server within timeout period
```

**Root Cause:** The Archipelago server failed to start.

**Debugging Steps:**

1. **Verify the .archipelago file exists:**
   ```bash
   ls frontend/presets/[game]/AP_14089154938208861744/*.archipelago
   ```

2. **Try starting the server manually:**
   ```bash
   python3 MultiServer.py --host localhost --port 38281 \
     ./frontend/presets/[game]/AP_14089154938208861744/AP_14089154938208861744.archipelago
   ```

3. **Check server log for errors:**
   ```bash
   cat server_log.txt
   ```

### Pattern 3: Event Locations Not Collected

**Symptom:**
```
Only 116/120 locations checked - 4 event locations missing - TEST FAILED
```

**Root Cause:** Event locations (ID = 0) aren't being auto-collected.

**Understanding Events:**
- Event locations have `id: 0` in the rules file
- They should auto-check when access rules become true
- The timer doesn't check events - the state manager handles them

**Debugging Steps:**

1. **Count event locations:**
   ```bash
   grep -c '"id": 0' frontend/presets/[game]/AP_*/AP_*_rules.json
   ```

2. **Verify event rules in the exporter** are correctly exported.

## Debugging Workflow

### Step 1: Verify Spoiler Test Passes First

```bash
source .venv/bin/activate
python scripts/test/test-all-templates.py --include-list "YourGame.yaml"
```

If spoiler test fails, fix those issues first using `game-debugging-CC.md`.

### Step 2: Run Single-Client Test

```bash
python scripts/test/test-all-templates.py --include-list "YourGame.yaml" --multiclient --single-client
```

### Step 3: Examine Detailed Results

```bash
# Find the latest result file
ls -lt test_results/multiclient/client1-timer-single-*.json | head -1

# Check conditions
cat test_results/multiclient/client1-timer-single-*.json | jq '.testDetails[0].conditions'

# Check final logs
cat test_results/multiclient/client1-timer-single-*.json | jq '.testDetails[0].logs | .[-10:]'
```

### Step 4: Fix Issues Iteratively

**Workflow:**
1. Identify the root cause from logs/conditions
2. Make ONE fix at a time
3. Re-run generation if you fixed the exporter
4. Re-run tests to verify the fix
5. Repeat until test passes

## Comparing Tests

| Aspect | Spoiler Test | Single-Client Multiclient |
|--------|--------------|---------------------------|
| **Purpose** | Validate logic matches Python | Validate end-to-end timer |
| **Server** | Not used | Requires MultiServer.py |
| **Timer** | Not used | Core of the test |
| **Events** | Part of sphere data | Must auto-trigger |
| **Speed** | Faster | Slower (real timer) |
| **Output** | Sphere match/mismatch | Locations checked count |

**When to use each:**
- Start with **spoiler test** to validate rule engine implementation
- Use **single-client test** once spoiler test passes to validate server integration

## Key Files

| File | Purpose |
|------|---------|
| `tests/e2e/multiclient.spec.js` | Playwright test specification |
| `frontend/modules/tests/testCases/multiclientTests.js` | Client-side test logic |
| `scripts/test/test-all-templates.py` | Test runner script |
| `test_results/multiclient/client1-timer-single-*.json` | Single-client results |
| `scripts/output/multiclient/test-results.json` | Aggregated results |

## Cloud-Specific Considerations

### Why Single-Client Only?

The dual-client test requires:
- Two separate browser contexts running simultaneously
- Synchronized communication between them via the server

Cloud environments have limitations that make this impractical. The single-client test provides the same core validation:
- Server connectivity
- Timer functionality
- Location checking logic

### Working Directory

Always run from project root:
```bash
pwd  # Should show: /home/user/Archipelago-CC
```

### Virtual Environment

**Always activate before testing:**
```bash
source .venv/bin/activate
```

### Branch Management

Your work is on a dedicated branch:
- Work is automatically committed and pushed
- Focus on fixing issues and getting tests to pass

## Test Automation

For batch testing:
```bash
# Test all games with single-client
python scripts/test/test-all-templates.py --multiclient --single-client

# Test specific game
python scripts/test/test-all-templates.py --include-list "A Hat in Time.yaml" --multiclient --single-client

# Skip generation (test-only)
python scripts/test/test-all-templates.py --include-list "YourGame.yaml" --multiclient --single-client --test-only
```

## Getting Unstuck

If you're stuck:

1. **Check spoiler test first**: Most multiclient failures have root causes detectable by the spoiler test
2. **Examine the JSON logs**: `test_results/multiclient/client1-timer-single-*.json` has detailed step-by-step logs
3. **Look at the conditions**: Failed conditions tell you exactly where the test stopped
4. **Compare locations checked vs expected**: Large gap = logic issue, small gap = event handling issue
5. **Run with different seed**: `--seed 2` may reveal if it's seed-specific

## Additional Resources

- **Cloud setup**: `CC/cloud-setup.md`
- **Spoiler test debugging**: `CC/game-debugging-CC.md`
- **Full multiclient guide**: `CC/game-debugging-multiclient.md` (includes dual-client info)
- **Main debugging guide**: `CC/game-debugging.md`

## Summary

The cloud single-client workflow:
1. ✅ Complete setup (`CC/cloud-setup.md`)
2. 🧪 Run spoiler test first (`game-debugging-CC.md`)
3. 🔌 Run single-client multiclient test
4. 📋 Examine detailed results in JSON logs
5. 🐛 Fix issues iteratively
6. 🔄 Re-test until passing
7. ✨ Push changes (handled automatically)

Focus on getting both tests to pass - spoiler test validates logic, single-client test validates server integration.
