# Testing Guide: Multiclient Timer Test

This guide explains how to debug and fix failures in the multiclient timer test, which validates that the frontend can correctly check all locations and communicate with the Archipelago server in a real multiplayer session.

## Testing Philosophy

The multiclient test validates **end-to-end functionality**. Unlike the spoiler test which validates logic equivalence with Python, the multiclient test validates that:
1. The frontend can connect to an Archipelago server
2. The timer can successfully check all accessible locations
3. Location checks are properly communicated between clients via the server

## The Data Flow: How the Multiclient Test Works

```
┌──────────────────┐   1. Starts   ┌────────────────────────┐
│ Python           ├──────────────►│   Archipelago Server   │
│ MultiServer.py   │               │   (localhost:38281)    │
└──────────────────┘               └───────────┬────────────┘
                                               │
                                   ┌───────────┴────────────┐
                                   │                        │
                           2. Connects             2. Connects
                                   │                        │
                                   ▼                        ▼
                        ┌──────────────────┐    ┌──────────────────┐
                        │  Client 1        │    │  Client 2        │
                        │  (Timer Send)    │    │  (Timer Receive) │
                        │  - Checks locs   │    │  - Monitors locs │
                        │  - Sends to srv  │    │  - Verifies all  │
                        └──────────────────┘    └──────────────────┘
```

### Stage 1: Server Startup

The test starts a Python Archipelago server using the `.archipelago` file generated for the seed:
- **MultiServer.py** is launched with the seed's `.archipelago` file
- Server listens on `localhost:38281`

### Stage 2: Two Browser Clients Connect

Two browser contexts are created, simulating two separate clients connecting to the same server:
- **Client 1 (timerSendTest)**: Initiates the timer and checks all locations
- **Client 2 (timerReceiveTest)**: Monitors and verifies that all location checks are received

Both clients connect to the same player slot (this is valid for single-player seeds).

### Stage 3: Synchronization via Bounce Messages

The clients use Archipelago's Bounce message protocol to synchronize:
1. Client 1 sends `CLIENT1_READY` message
2. Client 2 waits for `CLIENT1_READY`, then sends `CLIENT2_READY`
3. Both clients are now synchronized and the timer test begins

### Stage 4: Timer Execution

Client 1 executes the timer which:
1. Identifies all "manually-checkable" locations (locations with ID > 0)
2. Rapidly checks each location using the configured timer delay
3. Sends location checks to the server
4. Server broadcasts to all connected clients

### Stage 5: Verification

- **Client 1** verifies: All manually-checkable locations were checked
- **Client 2** verifies: All location checks were received from the server
- Test passes only if both clients report success

## Running the Multiclient Test

### Prerequisites

**⚠️ IMPORTANT:** First complete the development environment setup in `../getting-started.md`, including:
- Setting up a Python virtual environment (`.venv`)
- Installing required dependencies (`pip install -r requirements.txt`)
- Ensuring `npm install` has been run in the project root

### Running for a Single Game

```bash
# Activate virtual environment
source .venv/bin/activate

# Run for a specific game
python scripts/test/test-all-templates.py --include-list "Adventure.yaml" --multiclient

# Run with visible browser windows (helpful for debugging)
python scripts/test/test-all-templates.py --include-list "Adventure.yaml" --multiclient --headed

# Run test-only mode (skip generation, use existing rules file)
python scripts/test/test-all-templates.py --include-list "Adventure.yaml" --multiclient --test-only
```

### Understanding the Command Output

A successful test looks like:
```
=== Testing Adventure.yaml ===
Running Generate.py for Adventure.yaml...
Running multiclient timer test (dual-client mode)...
  Command: npx playwright test tests/e2e/multiclient.spec.js -g multiclient timer test
  Environment: TEST_GAME=adventure TEST_SEED=1
Completed Adventure.yaml: Generation=[PASS], Test=[PASS], Gen Errors=0, Locations Checked=25/25
```

A failing test shows:
```
=== Testing Bomb Rush Cyberfunk.yaml ===
Running multiclient timer test (dual-client mode)...
Multiclient test failed: None
Test return code: 1
Errors in output: 3
First error: CLIENT2 (error): [18:41:12.730] [ERROR] Test appears to be stalled - no progress for 10 seconds (116 location checks received)
Completed Bomb Rush Cyberfunk.yaml: Generation=[PASS], Test=[FAIL], Gen Errors=0, Locations Checked=0/252
```

## Understanding Test Results

### Test Results Files

The multiclient test generates detailed JSON result files in `test_results/multiclient/`:

```
test_results/multiclient/
├── client1-timer-send-2025-11-26T18-40-37-969Z.json
└── client2-timer-receive-2025-11-26T18-40-37-969Z.json
```

Each file contains:
- **summary**: Overall pass/fail counts
- **testDetails**: Array with detailed test information
  - **conditions**: Step-by-step pass/fail for each test phase
  - **logs**: Detailed log messages with timestamps

### Aggregated Results

The script aggregates results to `scripts/output/multiclient/test-results.json`:

```json
{
  "multiclient_test": {
    "success": true,
    "client1_passed": true,
    "client2_passed": true,
    "client1_locations_checked": 25,
    "client1_manually_checkable": 24,
    "client2_locations_received": 25,
    "client2_total_locations": 25,
    "processing_time_seconds": 18.81
  }
}
```

**Key fields:**
- `success`: Overall test passed
- `client1_locations_checked`: Total locations Client 1 checked
- `client1_manually_checkable`: Locations that can be timer-checked (ID > 0)
- `client2_locations_received`: Locations Client 2 received via server
- `client2_total_locations`: Total expected locations

## Common Failure Patterns

### Pattern 1: Stall at Partial Completion

**Symptom:**
```
Test appears to be stalled - no progress for 10 seconds (116 location checks received)
Only 116/247 manually-checkable locations were checked - TEST FAILED
```

**Root Cause:** The timer stops making progress because some locations cannot be reached. This typically means:
1. The rule engine doesn't correctly identify accessible locations
2. Item requirements aren't being satisfied
3. Region accessibility calculations are incorrect

**Debugging Steps:**
1. Run the spoiler test first to see if the game passes basic logic validation:
   ```bash
   python scripts/test/test-all-templates.py --include-list "YourGame.yaml"
   ```

2. If spoiler test passes but multiclient fails, the issue may be:
   - Timer logic not correctly iterating through locations
   - Event locations not being auto-collected
   - Race conditions in state updates

3. Run headed mode to watch the timer in action:
   ```bash
   python scripts/test/test-all-templates.py --include-list "YourGame.yaml" --multiclient --headed
   ```

### Pattern 2: Connection Timeout

**Symptom:**
```
Failed to connect to server within timeout period
```

**Root Cause:** The Archipelago server failed to start or crashed.

**Debugging Steps:**
1. Check if `.archipelago` file exists:
   ```bash
   ls frontend/presets/[game]/AP_14089154938208861744/
   ```

2. Try starting the server manually:
   ```bash
   python3 MultiServer.py --host localhost --port 38281 \
     ./frontend/presets/[game]/AP_14089154938208861744/AP_14089154938208861744.archipelago
   ```

3. Check `server_log.txt` for server errors

### Pattern 3: Client Synchronization Failure

**Symptom:**
```
Timeout waiting for CLIENT2_READY message
Failed to receive Client 2 confirmation
```

**Root Cause:** One client isn't receiving Bounce messages from the other.

**Debugging Steps:**
1. This usually indicates a deeper connection issue
2. Run with `--headed` to see both browser windows
3. Check browser console logs for WebSocket errors

### Pattern 4: Event Locations Not Collected

**Symptom:**
```
Only 116/120 locations checked - 4 event locations missing - TEST FAILED
```

**Root Cause:** Event locations (ID = 0) are not being auto-collected after their requirements are met.

**Understanding Events:**
- Event locations have `id: 0` in the rules file
- They should be automatically checked when their access rules become true
- The timer doesn't check events - the state manager should handle them

**Debugging Steps:**
1. Check the rules file for event locations:
   ```bash
   grep -c '"id": 0' frontend/presets/[game]/AP_*/AP_*_rules.json
   ```

2. Verify event locations have proper access rules in the exporter

## Comparing with Spoiler Test

| Aspect | Spoiler Test | Multiclient Test |
|--------|--------------|------------------|
| **Purpose** | Validate logic matches Python | Validate end-to-end functionality |
| **Server** | Not used | Requires MultiServer.py |
| **Clients** | Single browser | Two browser contexts |
| **Timing** | Sphere-by-sphere | Real-time timer |
| **Events** | Part of sphere data | Must auto-trigger |
| **Output** | Sphere match/mismatch | Locations checked count |

**When to use each:**
- Start with **spoiler test** to validate your rule engine implementation
- Move to **multiclient test** once spoiler test passes to validate server integration

## Debugging Workflow

1. **Run spoiler test first:**
   ```bash
   python scripts/test/test-all-templates.py --include-list "YourGame.yaml"
   ```
   If this fails, fix the rule engine issues first (see `game-debugging.md`).

2. **Run multiclient test:**
   ```bash
   python scripts/test/test-all-templates.py --include-list "YourGame.yaml" --multiclient
   ```

3. **If multiclient fails, check the detailed results:**
   ```bash
   # Find the most recent test result files
   ls -lt test_results/multiclient/ | head -5

   # Examine client1 logs for what locations were checked
   cat test_results/multiclient/client1-timer-send-*.json | jq '.testDetails[0].logs'

   # Examine client2 logs for what was received
   cat test_results/multiclient/client2-timer-receive-*.json | jq '.testDetails[0].logs'
   ```

4. **Run in headed mode:**
   ```bash
   python scripts/test/test-all-templates.py --include-list "YourGame.yaml" --multiclient --headed
   ```
   Watch the browser to see where the timer stalls.

5. **Check browser console in headed mode:**
   - Open DevTools (F12) in each browser window
   - Look for errors in the Console tab
   - Check Network tab for WebSocket messages

## Advanced Debugging

### Running Single-Client Mode

For isolating client-specific issues, you can run a single-client test:

```bash
python scripts/test/test-all-templates.py --include-list "YourGame.yaml" --multiclient --single-client
```

This runs only Client 1 (timer send) without requiring Client 2.

### Manual Server Testing

Start server manually and connect with the web client:

```bash
# Terminal 1: Start server
python3 MultiServer.py --host localhost --port 38281 \
  ./frontend/presets/[game]/AP_14089154938208861744/AP_14089154938208861744.archipelago

# Terminal 2: Start web server
python -m http.server 8000

# Browser: Open the client
http://localhost:8000/frontend/?mode=test-multiclient-client1&autoConnect=true&server=ws://localhost:38281&playerName=Player1&game=[game]&seed=1
```

### Checking Timer Behavior

The timer settings used during the test:
- `minCheckDelay = 0.0` seconds
- `maxCheckDelay = 0.0` seconds

This means the timer checks locations as fast as possible. If locations aren't being checked, it's because the state manager isn't marking them as reachable.

## Key Files for Multiclient Testing

| File | Purpose |
|------|---------|
| `tests/e2e/multiclient.spec.js` | Playwright test specification |
| `frontend/modules/tests/testCases/multiclientTests.js` | Client-side test logic |
| `scripts/test/test-all-templates.py` | Test runner script |
| `scripts/lib/test_runner.py` | Test execution functions |
| `scripts/lib/test_utils.py` | Result parsing utilities |
| `test_results/multiclient/*.json` | Detailed per-client results |
| `scripts/output/multiclient/test-results.json` | Aggregated test results |

## Common Issues and Solutions

### Issue: Timer completes but not all locations checked

**Cause:** Some locations aren't being marked as reachable by the state manager.

**Solution:**
1. Compare the number of manually-checkable locations in the rules file vs. what was checked
2. Enable verbose logging in the state manager to see which locations are being skipped
3. Check if there are item requirements that aren't being satisfied

### Issue: Test passes locally but fails in CI

**Cause:** Timing-related race conditions.

**Solution:**
1. The test includes stall detection (10 seconds without progress)
2. If legitimate progress is slow, the test may fail prematurely
3. Consider if the game has a very large number of locations

### Issue: Server crashes during test

**Cause:** Invalid game data or server bug.

**Solution:**
1. Check `server_log.txt` for the error
2. Verify the `.archipelago` file is valid
3. Try regenerating the seed with `--seed 1`

## Next Steps

Once your game passes both the spoiler test and multiclient test:
1. The game is considered fully functional for single-player use
2. Proceed to multiworld testing for multi-player validation
3. See `game-debugging.md` for the spoiler test debugging guide
