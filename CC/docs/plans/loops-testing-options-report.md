# Loops Module Testing Options Report

## Executive Summary

This report analyzes four approaches for testing the Loops module in the frontend, evaluating feasibility, advantages, and disadvantages of each. The report also includes recommendations for improving the existing test infrastructure.

---

## Current State Analysis

### Loops Module Overview
- **Location**: `frontend/modules/loops/`
- **Size**: ~5,571 lines across 13 files
- **Core Components**: loopState.js (game logic), loopUI.js (UI layer), actionQueueManager.js, loopRenderer.js
- **Key Features**: Mana system, XP/leveling, action queue processing, auto-restart, speed control

### Existing Test Coverage
- **File**: `frontend/modules/tests/testCases/loopsPanelTests.js`
- **Current Tests**: 2 tests (both disabled by default)
  1. `loops-initial-menu-not-processed` - Verifies initial Menu handling
  2. `loops-real-actions-processed` - Verifies action processing
- **Test Mode**: `test-loops` mode exists in `modes.json` with `loopModeEnabled: true`

### Existing Test Infrastructure
1. **In-App Test Framework** (`frontend/modules/tests/`)
   - Self-registering tests via `testRegistry.js`
   - TestController provides actions: `performAction()`, `waitForEvent()`, `pollForCondition()`
   - Playwright integration via `window.__playwrightTestsComplete__`

2. **Playwright E2E** (`tests/e2e/`)
   - `app.spec.js` - Standard in-app test runner
   - `multiclient.spec.js` - Server-based multiclient coordination

3. **Vitest Unit Tests** (`frontend/**/*.test.js`)
   - Currently only covers rule engine

---

## Option 1: Extend Existing Test Framework

### Approach
Add new test cases to `loopsPanelTests.js` using the existing test framework architecture.

### Implementation
1. Create comprehensive test functions in `loopsPanelTests.js`
2. Use TestController's existing actions and polling utilities
3. Run via `npm test -- --mode=test-loops`

### Feasibility: **HIGH**

The infrastructure is already in place. Tests can:
- Import loopState, loopUI directly
- Use eventBus to subscribe to loop events
- Use pollForCondition/pollForValue for async state checks
- Use performAction for simulating interactions

### Advantages
- **Zero infrastructure work** - Framework already exists
- **Consistent patterns** - Follows existing test conventions
- **DOM access** - Can query and interact with UI elements
- **Event system access** - Can subscribe to all loop events
- **CI integration** - Already works with Playwright/GitHub Actions

### Disadvantages
- **Limited interaction capabilities** - TestController actions are predefined
- **Debugging difficulty** - Tests run in browser context, hard to step through
- **No real-time feedback** - Must run full test suite to see results
- **State isolation concerns** - Tests may affect each other

### Suggested Tests to Add
```javascript
// Core functionality
testManaConsumption()           // Verify mana decreases correctly
testXPAwarding()                // Verify XP is awarded per action
testLevelUpMechanics()          // Verify level thresholds and cost reduction
testAutoRestart()               // Verify auto-restart on mana depletion

// Action management
testAddActionToQueue()          // Verify action addition
testRemoveActionFromQueue()     // Verify action removal
testClearAllActions()           // Verify queue clearing
testActionChainRemoval()        // Verify cascading removal

// Speed controls
testSpeedAdjustment()           // Verify speed slider affects processing
testPauseResume()               // Verify pause/resume functionality

// State persistence
testSaveLoadState()             // Verify save/load roundtrip
testHardReset()                 // Verify complete state clearing
```

---

## Option 2: Advanced Playwright Features (Interactive Testing)

### Approach
Use Playwright's CDP (Chrome DevTools Protocol) and advanced page interaction features to create an interactive testing interface.

### Implementation Options

#### 2a. Playwright REPL Mode
```javascript
// Use playwright --debug or custom script
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://localhost:8000/frontend/?mode=loops');

// Interactive console access
await page.evaluate(() => {
  // Access loopState, eventBus, etc.
  window.testAPI = {
    loopState: window.loopState,
    addAction: (type, data) => { /* ... */ }
  };
});
```

#### 2b. Playwright Inspector Integration
```javascript
// playwright.config.js addition
use: {
  trace: 'on',
  video: 'on',
}

// Custom test that pauses for inspection
test('interactive loop debugging', async ({ page }) => {
  await page.goto('http://localhost:8000/frontend/?mode=loops');
  await page.pause(); // Opens Playwright Inspector
});
```

#### 2c. Custom Test Server with WebSocket Bridge
```javascript
// Create bidirectional communication channel
const ws = new WebSocket('ws://localhost:9999');
ws.onmessage = (event) => {
  const cmd = JSON.parse(event.data);
  // Execute commands in browser context
  page.evaluate((cmd) => window.executeTestCommand(cmd), cmd);
};
```

### Feasibility: **MEDIUM**

Playwright supports these features, but integration requires custom development.

### Advantages
- **Real-time interaction** - Can send commands and see immediate results
- **Visual debugging** - See the UI while testing
- **Flexible commands** - Can execute arbitrary JavaScript
- **Recording capability** - Can record sessions for replay

### Disadvantages
- **Development effort** - Need to build custom tooling
- **Not integrated with CI** - Interactive sessions don't fit automated testing
- **Requires running browser** - Not headless-compatible
- **Manual orchestration** - Need to manage browser lifecycle

---

## Option 3: Archipelago Server Command Channel

### Approach
Leverage the existing WebSocket connection to the Archipelago server to send test commands and receive results.

### Architecture Overview
```
CLI Tool → Archipelago Server → WebSocket → Frontend Client
                                    ↓
                              Test Command Handler
                                    ↓
                              Execute & Report Back
```

### Implementation

#### 3a. Using Bounce Messages (No Server Changes)
```javascript
// CLI sends Bounce message via server
// frontend/modules/loops/testCommandHandler.js
eventBus.subscribe('game:bouncedMessage', (data) => {
  if (data.data?.type === 'LOOP_TEST_COMMAND') {
    const result = executeTestCommand(data.data.command);
    // Send result back via Bounce
    messageHandler.sendBounce({
      type: 'LOOP_TEST_RESULT',
      result: result
    }, { slots: [data.data.replySlot] });
  }
}, 'loops');
```

#### 3b. Using Say Messages (Server Parsing Required)
```javascript
// CLI sends: !looptest verify-mana 100
// Server-side handler needed in MultiServer.py
// More complex but allows non-client CLI tools
```

### Feasibility: **MEDIUM-LOW**

Requires coordination between multiple processes and potential server modifications.

### Advantages
- **True distributed testing** - Can test from any connected client
- **Multi-client scenarios** - Natural fit for testing sync between clients
- **Existing infrastructure** - Uses proven WebSocket/message handling
- **Real network conditions** - Tests actual network behavior

### Disadvantages
- **Complexity** - Many moving parts (CLI, server, client)
- **Server dependency** - Requires running Archipelago server
- **Latency** - Network round-trips add delay
- **State management** - Hard to guarantee consistent starting state
- **Limited to connected scenarios** - Can't test offline behavior

---

## Option 4: CLI via Archipelago Server Architecture

### Approach
Build a full CLI tool that communicates through the Archipelago server to control tests.

### Architecture
```
┌─────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  CLI Tool   │────▶│ Archipelago Server │────▶│ Frontend Client │
│ (Python)    │◀────│   (MultiServer)    │◀────│   (Browser)     │
└─────────────┘     └───────────────────┘     └─────────────────┘
      │                                               │
      │  !loop-test start-queue                      │
      │  !loop-test verify-mana 50                   │
      │  !loop-test add-action explore Region1       │
      └───────────────────────────────────────────────┘
```

### Implementation Components

1. **CLI Tool** (`scripts/test/loop-test-cli.py`):
```python
class LoopTestCLI:
    def __init__(self, server_address):
        self.client = ArchipelagoClient(server_address)

    def send_command(self, cmd, args):
        self.client.send_message(f"!looptest {cmd} {' '.join(args)}")
        return self.client.wait_for_response(timeout=10)
```

2. **Server Handler** (modifications to `MultiServer.py`):
```python
# Parse !looptest commands and route to connected clients
async def handle_test_command(ctx, client, cmd):
    await ctx.send_msgs(client, [{"cmd": "Bounce", "data": cmd}])
```

3. **Client Handler** (`frontend/modules/loops/cliTestHandler.js`):
```javascript
const commandHandlers = {
  'start-queue': () => loopState.startProcessing(),
  'stop-queue': () => loopState.stopProcessing(),
  'verify-mana': (expected) => loopState.getCurrentMana() === expected,
  'add-action': (type, region) => addActionToQueue(type, region),
};
```

### Feasibility: **LOW**

This is the most complex option requiring work across multiple layers.

### Advantages
- **Claude-friendly interface** - CLI commands are easy to generate/parse
- **Scriptable** - Can automate complex test scenarios
- **Real integration testing** - Tests full client-server stack
- **Persistent sessions** - Can maintain state across commands

### Disadvantages
- **High development cost** - Significant work across Python/JS/Server
- **Maintenance burden** - Three codebases to keep in sync
- **Testing the test infrastructure** - Meta-level complexity
- **Overkill for unit testing** - This is integration-level tooling

---

## Recommendations

### Primary Recommendation: Option 1 (Extend Existing Framework)

**Rationale**: Maximum benefit with minimum effort. The infrastructure already exists and works well.

**Implementation Plan**:
1. Enable existing tests in `loopsPanelTests.js`
2. Add comprehensive test coverage for core loop functionality
3. Add loop-specific TestController actions if needed
4. Create `playwright_tests_config-loops.json` for loop-focused test runs

### Secondary Recommendation: Option 2a (Playwright Debug Mode)

**Rationale**: For interactive debugging during development, not automated testing.

**Use Case**: When investigating test failures or developing new features, use:
```bash
npx playwright test --debug tests/e2e/app.spec.js
```

### Future Consideration: Option 3 (Bounce Messages)

**Rationale**: Worth implementing for integration testing scenarios, but not the first priority.

**When to Implement**: When multi-client loop synchronization is needed.

---

## Improvements to Existing Test Infrastructure

### 1. Add Loop-Specific TestController Actions

Add to `testController.js`:
```javascript
case 'GET_LOOP_STATE':
  const loopState = (await import('../../loops/loopStateSingleton.js')).default;
  return {
    mana: loopState.getCurrentMana(),
    maxMana: loopState.getMaxMana(),
    isPaused: loopState.isPaused,
    queueLength: loopState.getQueueLength()
  };

case 'SET_LOOP_SPEED':
  const loopState = (await import('../../loops/loopStateSingleton.js')).default;
  loopState.setGameSpeed(actionDetails.speed);
  return true;

case 'WAIT_FOR_LOOP_ACTION_COMPLETE':
  return await this.waitForEvent('loopState:actionCompleted', actionDetails.timeout || 10000);
```

### 2. Create Loop Test Configuration

Create `frontend/playwright_tests_config-loops.json`:
```json
{
  "autoStart": true,
  "hideDisabled": true,
  "randomizeOrder": false,
  "enabledCategories": ["loops"],
  "timeout": 60000
}
```

Update `modes.json` to add dedicated test mode:
```json
"test-loops-only": {
  "userSettings": {
    "paths": ["./settings.json", "./settings-loops.json"],
    "enabled": true
  },
  "testsConfig": {
    "path": "./playwright_tests_config-loops.json",
    "enabled": true
  }
}
```

### 3. Add Test Isolation Utilities

Create helper for resetting loop state between tests:
```javascript
// In loopsPanelTests.js
async function resetLoopState(testController) {
  const loopState = (await import('../../loops/loopStateSingleton.js')).default;
  await loopState.hardReset();
  await testController.pollForCondition(
    () => loopState.getCurrentMana() === loopState.getMaxMana(),
    'Loop state reset',
    3000, 50
  );
}
```

### 4. Add Vitest Unit Tests for Pure Logic

Create `frontend/modules/loops/xpFormulas.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { calculateXPForLevel, calculateCostReduction } from './xpFormulas.js';

describe('XP Formulas', () => {
  it('calculates correct XP threshold for level 1', () => {
    expect(calculateXPForLevel(1)).toBe(120); // 100 + 1*20
  });

  it('calculates 5% cost reduction per level', () => {
    expect(calculateCostReduction(10, 0)).toBe(10);
    expect(calculateCostReduction(10, 1)).toBeCloseTo(9.52, 2);
  });
});
```

### 5. Add Test Result Visualization

Enhance test output with loop-specific metrics:
```javascript
// In testLogic.js or a new loopTestReporter.js
function generateLoopTestReport(results) {
  return {
    ...results,
    loopMetrics: {
      manaConsumptionTests: results.filter(r => r.id.includes('mana')),
      xpTests: results.filter(r => r.id.includes('xp')),
      uiTests: results.filter(r => r.id.includes('ui')),
    }
  };
}
```

---

## Appendix: Test Coverage Matrix

| Feature | Unit Test | Integration Test | E2E Test |
|---------|-----------|------------------|----------|
| XP formulas | Vitest | - | - |
| Cost reduction | Vitest | - | - |
| Mana tracking | - | In-App | - |
| Action processing | - | In-App | - |
| Queue management | - | In-App | - |
| UI rendering | - | In-App | Playwright |
| Speed controls | - | In-App | - |
| Save/Load | - | In-App | - |
| Multi-client sync | - | - | Multiclient |

---

## Conclusion

The most practical path forward is to **expand the existing in-app test framework** with comprehensive loop-specific tests. This approach:

1. Leverages proven infrastructure
2. Requires minimal setup
3. Integrates with CI/CD
4. Provides immediate value

Advanced options (Playwright interactive, server-based CLI) should be considered for future integration testing needs but are not necessary for comprehensive unit and component testing of the Loops module.
