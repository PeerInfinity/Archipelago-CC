# Tests module — discipline for new test cases

This module is an in-app scenario test harness. It registers test cases via
`registerTest(...)`, runs them inside the live frontend, and reports pass/fail
per condition in the Tests panel.

The historical pattern routed every test action through a giant
`testController.performAction({ type: 'X', ... })` dispatch table. That method
has been **removed** — the controller now exposes a small set of primitives
and a couple of convenience methods (`loadALTTPRules` etc.), and tests call
module APIs directly when they need more. The guidance below is the discipline
new tests should follow.

## TL;DR

1. **Use primitives + direct module APIs.** No central dispatch table to extend.
2. **Assert on state, not DOM.**
3. **Use `assertEqual` / `reportCondition`** for assertions.
4. **Put domain-specific helpers in the domain module**, not in
   `testController.js`.

## 1. Use primitives + direct module APIs

`testController.performAction(...)` used to be a legacy dispatch table that
accreted domain-specific cases (`LOAD_ALTTP_RULES`, `LOOP_HARD_RESET`, etc.)
over time. The controller ended up importing half the project, and the switch
was the single biggest source of harness-level bugs. It's gone now — tests
call primitives or module APIs directly.

What to write today:

| What you want | How to do it |
|---|---|
| Publish an event | `testController.eventBus.publish('foo', { ... })` |
| Read inventory | `testController.stateManager.getSnapshot().inventory.X` |
| Change a setting | `import settingsManager from '.../settingsManager.js'; await settingsManager.updateSetting('k', v)` |
| Drive a loop reset | `import gameState from '.../gameState/index.js'; gameState.triggerLoopReset()` |
| Load rules from a file | `await testController.loadRulesFromFile(path)` (kept as a convenience) |
| Load the ALTTP preset | `await testController.loadALTTPRules()` |

The primitives you actually need:

- **`testController.eventBus.publish(name, payload)`** — fire an event.
- **`testController.eventBus.subscribe(name, handler)`** — observe events.
  Pair with manual `unsubscribe`, OR use `waitForEvent` (auto-cleans up).
- **`testController.waitForEvent(name, timeoutMs)`** — promise that resolves
  with the payload, or rejects on timeout. Use this for "do X, then wait
  for the resulting event."
- **`testController.pollForCondition(checkFn, description, timeoutMs, intervalMs)`**
  — promise that resolves true when `checkFn()` returns truthy.
- **`testController.stateManager.pingWorker(token, timeoutMs)`** — wait for
  the worker's snapshot cache to be current before reading it. Necessary
  after any state-change event before reading `getSnapshot()`.
- Direct module imports (e.g. `import gameState from '.../gameState/index.js'`)
  — read or drive any module's public API.

## 2. Assert on state, not DOM

DOM rendering is async and throttled. Polling
`document.querySelector('.some-class')` waits on the *render*, not the state
change, and is the most common source of timing flakes in the existing tests.

Prefer:

```js
// Drive a state change.
testController.eventBus.publish('user:regionMove', { region: 'StartRegion', fromReset: true });

// Wait for the state to settle, not for pixels to render.
await testController.stateManager.pingWorker('after-region-move', 2000);

// Read state directly.
const snapshot = testController.stateManager.getSnapshot();
testController.assertEqual('current region', 'StartRegion', snapshot.currentRegion);
```

DOM polling has its place — for UI-specific tests that verify rendering — but
shouldn't be the default.

## 3. Use `assertEqual` / `reportCondition` / `getOverallResult`

- **`assertEqual(description, expected, actual)`** — preferred. On mismatch,
  logs both values automatically so failures are diagnosable from the log
  alone. Returns the boolean result.
- **`reportCondition(description, passed)`** — takes a precomputed boolean.
  Use when the predicate isn't a simple equality.
- **`getOverallResult()`** — returns true iff every `assertEqual` /
  `reportCondition` so far has passed. Return it from your test function and
  the runner will auto-complete with that boolean.

```js
async function myScenarioTest(testController) {
  const mana = gs.getCurrentMana();
  testController.assertEqual('mana refilled after reset', gs.getMaxMana(), mana);

  const resetCount = gs.getLoopResetCount();
  testController.reportCondition('reset count advanced', resetCount > startCount);

  return testController.getOverallResult();
}
```

**Gotcha:** the runner only auto-completes if the test function returns a
boolean. If you return nothing and never call `completeTest(...)` explicitly,
the test will hang. Returning `getOverallResult()` is the simplest pattern.

## 4. Co-locate domain-specific helpers

The controller stays domain-agnostic. If your tests need a non-trivial helper
that knows about a specific feature ("drain the JtA energy to zero",
"complete every task in the current zone"), put it in a `test-helpers.js`
file *inside the feature module* and import it from your test case:

```
frontend/modules/jtaSubstrateWrapper/test-helpers.js
frontend/modules/tests/testCases/jtaSubstrateWrapperTests.js  // imports the helpers
```

This keeps the controller small and means each module owns its testability
surface (the right place to maintain it).

## Test case file shape

```js
import { registerTest } from '../testRegistry.js';

async function myScenarioTest(testController) {
  // 1. Set up.
  // 2. Drive a state change.
  // 3. Wait for it to land (waitForEvent / pingWorker / pollForCondition).
  // 4. Assert on state via assertEqual / reportCondition.
  // 5. return testController.getOverallResult();
}

registerTest({
  id: 'jta-out-of-mana-loop-reset',
  name: 'JtA: out-of-mana triggers loop reset and teleport',
  description: 'Drains mana to 0 in a JtA region; verifies loop reset fires '
             + 'and procgenPlayer transitions to the start region.',
  testFunction: myScenarioTest,
  category: 'JtA substrate',
  enabled: false, // default-off; user toggles in the panel
});
```

Don't forget to add the file path to `TEST_CASE_FILES` in
`./testDiscovery.js` — that's the one piece of manual wiring discovery still
needs.
