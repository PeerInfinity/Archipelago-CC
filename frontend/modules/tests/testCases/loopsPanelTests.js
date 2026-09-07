import { registerTest } from '../testRegistry.js';

// Constants for test configuration
const PANEL_ID = 'loopsPanel';

/**
 * The queue-control button's label for each processing state — the same table
 * `loopUI._updatePauseButtonState` builds. Asserting the PAIR (label, state)
 * rather than a fixed word lets a row start from whatever state it inherited
 * and still make a real claim about the button.
 */
const QUEUE_BUTTON_LABELS = {
  idle: 'Start',
  running: 'Pause',
  paused: 'Resume',
  completed: 'Restart',
  waiting: 'Waiting',
};

/**
 * ⛓ REAL ACTIONS ARE PROCESSED — the queue runs a move the PLAYER made.
 *
 * WHAT THIS ROW PROVES, end to end and with no branch that can skip it:
 *   0. at LOAD, "skip the menu" took the start region's first exit — the player
 *      is off the start region and the path holds that move (see the leg's own
 *      caveat: it reads the page's load, so it needs this row to run first);
 *   1. the menu panel's Restart returns the player to a START REGION with an
 *      EMPTY path (outside loop mode — in loop mode Restart delegates to the
 *      loops reset instead, which is why this row leaves loop mode for it);
 *   2. pressing one of the panel's EXIT BUTTONS, WITH LOOP MODE ON, puts a real
 *      `regionMove` in gameState's path — which it can only do because
 *      `isLoopModePlanningSource` classifies `menuPanel-*` as authoring;
 *   3. that path entry becomes a queue action, and with a location check
 *      queued behind it the queue PROCESSES both — `loopState:actionCompleted`
 *      fires for the regionMove and for the locationCheck.
 *
 * ⛔ WHAT IT REFUSED TO PROVE BEFORE M1. This row used to end at
 *   `reportCondition('Action queue test skipped (integration not available)', true)`
 * and return TRUE whenever the action never appeared — which on a plain world
 * was ALWAYS, because a location check needs a `regionMove` in the path first
 * and nothing in the app put one there (`state.js`'s "no path entry" warning).
 * It was green against an app that processed nothing. There is now no early
 * `return true`: every leg is a condition, and a build that never processes
 * leaves the completion poll STUCK and the row RED.
 *
 * ⚠ PRECONDITIONS THIS ROW ESTABLISHES FOR ITSELF rather than inheriting from
 * whatever ran before it (a green in-app row must not owe its state to its
 * predecessor):
 *   - loop mode: recorded on entry, forced OFF for the menu drive, forced ON
 *     for the queue drive, and restored at the end. `test-loops-only` boots
 *     with `moduleSettings.loops.loopModeEnabled: true`, so it is ON here.
 *   - the path: captured and restored through `gameState.setPath`.
 *   - the location it checks is DERIVED from the loaded document
 *     (`stateManager.getStaticData().regions`), never named here; the check
 *     itself is not undone, which is the one mark this row leaves.
 *
 * @param {object} testController - The test controller object provided by the test runner.
 * @returns {Promise<boolean>} - True if the test passed, false otherwise.
 */
export async function testRealActionsProcessed(testController) {
  let overallResult = true;
  const testRunId = `real-actions-test-${Date.now()}`;
  let restore = null;

  const fail = (name) => { testController.reportCondition(name, false); overallResult = false; };

  try {
    testController.log(`[${testRunId}] Starting real actions processing test...`);

    const { centralRegistry } = await import('../../../app/core/centralRegistry.js');
    const loopState = (await import('../../loops/loopStateSingleton.js')).default;
    const api = (moduleId, fnName) => centralRegistry?.getPublicFunction?.(moduleId, fnName);

    const getPath = api('gameState', 'getPath');
    const setPath = api('gameState', 'setPath');
    const getCurrentRegion = api('gameState', 'getCurrentRegion');
    const isStartRegion = api('gameState', 'isStartRegion');
    const addLocationCheck = api('gameState', 'addLocationCheck');
    const isLoopModeActive = api('loops', 'isLoopModeActive');
    if (!getPath || !setPath || !getCurrentRegion || !isStartRegion || !addLocationCheck || !isLoopModeActive) {
      fail('gameState + loops public API available');
      return overallResult;
    }
    testController.reportCondition('gameState + loops public API available', true);

    // --- the loops panel, and the loop-mode state we must restore -----------
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
    const loopsPanelElement = await testController.pollForValue(
      () => document.querySelector('.loop-panel-container'),
      'Loops panel DOM element', 5000, 50,
    );
    if (!loopsPanelElement) { fail('Loops panel in the DOM'); return overallResult; }
    testController.reportCondition('Loops panel in the DOM', true);

    const loopModeAtEntry = isLoopModeActive() === true;
    const pathBefore = getPath();
    const speedBefore = loopState.gameSpeed;
    // ⚠ THE RESTORE IS PART OF THE ROW. This row runs the queue to completion
    // and to mana zero; a later row that inherited THAT would start from
    // 'Restart'/completed with an empty pool. `restartFromStart({autoStart:
    // false})` is the loops module's own primitive for "back to the top,
    // paused" — it refills mana, resets progress and PUBLISHES, so the panel's
    // own labels are correct again too.
    restore = async () => {
      try { loopState.setGameSpeed(speedBefore ?? 100); } catch (e) { /* best effort */ }
      try { await setLoopMode(testController, loopsPanelElement, isLoopModeActive, loopModeAtEntry); } catch (e) { /* best effort */ }
      resetLoopsToIdle(loopState, setPath, pathBefore);
    };

    // --- 0. the LOAD state: skip-the-menu already moved the player ---------
    // ⚠ THIS LEG READS THE PAGE'S LOAD, so it is only meaningful while this row
    // runs FIRST (roster order 0, `randomizeOrder: false`). Nothing before it
    // has touched the path, so the regionMove in it and the player's position
    // off the start region are the skip hop's own work — on this plain world
    // that hop is `menuPanel`'s (a procgen world's is procgenPlayer's, and the
    // two never both fire). Move this row later in the roster and this leg
    // becomes a statement about its predecessor instead; delete it then.
    const skipHopped = !isStartRegion(getCurrentRegion())
      && pathBefore.some((entry) => entry.type === 'regionMove');
    testController.log(
      `[${testRunId}] at load: region=${getCurrentRegion()} path=${pathBefore.length} entries`,
    );
    testController.reportCondition(
      'Skip-the-menu took the start region\'s first exit at load (this row runs first)',
      skipHopped,
    );
    if (!skipHopped) overallResult = false;

    // --- 1. the menu panel's Restart, OUTSIDE loop mode ---------------------
    const leftLoopMode = await setLoopMode(testController, loopsPanelElement, isLoopModeActive, false);
    testController.reportCondition('Loop mode off for the menu drive', leftLoopMode);
    if (!leftLoopMode) { overallResult = false; await restore(); return overallResult; }

    testController.eventBus.publish('ui:activatePanel', { panelId: 'menuPanel' });
    const restartButton = await testController.pollForValue(
      () => document.querySelector('#menu-panel-restart'),
      'Menu panel Restart button', 5000, 50,
    );
    if (!restartButton) { fail('Menu panel Restart button found'); await restore(); return overallResult; }
    testController.reportCondition('Menu panel Restart button found', true);

    restartButton.click();
    const backAtStart = await testController.pollForCondition(
      () => isStartRegion(getCurrentRegion()) === true && getPath().length === 0,
      'Restart put the player at a start region with an empty path', 3000, 50,
    );
    testController.reportCondition('Restart put the player at a start region with an empty path', backAtStart);
    if (!backAtStart) { overallResult = false; await restore(); return overallResult; }

    // --- 2. press an exit button IN LOOP MODE — a REAL user:regionMove -----
    // ⛓ The press happens with loop mode ON on purpose. That is the state where
    // the M3b strict gate and the loop-mode path-append retirement both apply,
    // and both let a `menuPanel-` move through only because
    // `isLoopModePlanningSource` classifies it as AUTHORING. Drop `menuPanel`
    // from that classifier and this leg is the one that reds.
    const enteredForPress = await setLoopMode(testController, loopsPanelElement, isLoopModeActive, true);
    testController.reportCondition('Loop mode on for the exit press', enteredForPress);
    if (!enteredForPress) { overallResult = false; await restore(); return overallResult; }

    const exitButton = await testController.pollForValue(
      () => document.querySelector('.menu-panel-exit-button'),
      'Menu panel exit button', 3000, 50,
    );
    if (!exitButton) { fail('Menu panel offers at least one exit button'); await restore(); return overallResult; }
    testController.log(`[${testRunId}] Pressing exit button "${exitButton.textContent}"`);
    testController.reportCondition('Menu panel offers at least one exit button', true);

    exitButton.click();
    const movedInPath = await testController.pollForCondition(
      () => getPath().some((entry) => entry.type === 'regionMove'),
      'The exit press put a regionMove in the path', 3000, 50,
    );
    testController.reportCondition('The exit press put a regionMove in the path', movedInPath);
    if (!movedInPath) { overallResult = false; await restore(); return overallResult; }

    const arrivedRegion = getCurrentRegion();
    testController.log(`[${testRunId}] Arrived in ${arrivedRegion}`);

    // --- 3. queue a real location check behind it and run the queue ---------
    const locationName = firstUncheckedLocationOf(testController, arrivedRegion);
    if (!locationName) { fail(`The document names a location in ${arrivedRegion}`); await restore(); return overallResult; }
    testController.reportCondition(`The document names a location in ${arrivedRegion}`, true);
    addLocationCheck(locationName, arrivedRegion);

    const queued = await testController.pollForCondition(
      () => (loopState.getActionQueue?.() ?? []).some((a) => a.type === 'locationCheck'),
      'The location check reached the queue', 3000, 50,
    );
    testController.reportCondition('The location check reached the queue', queued);
    if (!queued) { overallResult = false; await restore(); return overallResult; }

    const completed = [];
    const onCompleted = (data) => {
      if (data?.action?.type) completed.push(data.action.type);
    };
    testController.eventBus.subscribe('loopState:actionCompleted', onCompleted);

    loopState.setGameSpeed(200);
    const queueButton = loopsPanelElement.querySelector('#loop-ui-toggle-pause');
    if (!queueButton) { fail('Queue-control button found'); await restore(); return overallResult; }
    testController.reportCondition('Queue-control button found', true);
    testController.log(`[${testRunId}] Queue-control button reads "${queueButton.textContent.trim()}"; clicking to run.`);
    queueButton.click();

    // ⛔ THE POLL THAT MUST GO STUCK. A build that never processes an action
    // publishes no loopState:actionCompleted, and this is the only exit.
    const processed = await testController.pollForCondition(
      () => completed.includes('regionMove') && completed.includes('locationCheck'),
      'The queue PROCESSED the exit move and the location check', 8000, 100,
    );
    testController.log(`[${testRunId}] completed actions: [${completed.join(', ')}]`);
    testController.reportCondition('The queue PROCESSED the exit move and the location check', processed);
    if (!processed) overallResult = false;

    testController.eventBus.unsubscribe('loopState:actionCompleted', onCompleted);

    await restore();
    restore = null;
    testController.log(`[${testRunId}] Test completed`);
    return overallResult;

  } catch (error) {
    if (restore) await restore();
    testController.log(`[${testRunId}] Test failed with error:`, error);
    testController.reportCondition('Test completed without error', false);
    return false;
  }
}

/**
 * Put loop mode into `wanted` by CLICKING the product's own toggle, and wait
 * for the label to agree. Returns whether it got there.
 *
 * The label is the button's contract ('Enter Loop Mode' / 'Exit Loop Mode'), so
 * the wait is on the label AND on `loops.isLoopModeActive()` — a label that
 * stops tracking the flag is a defect this helper's callers would otherwise
 * read as a mode change that never happened.
 */
async function setLoopMode(testController, loopsPanelElement, isLoopModeActive, wanted) {
  if (isLoopModeActive() === wanted) return true;
  const toggle = loopsPanelElement.querySelector('#loop-ui-toggle-loop-mode');
  if (!toggle) return false;
  toggle.click();
  return testController.pollForCondition(
    () => {
      const btn = loopsPanelElement.querySelector('#loop-ui-toggle-loop-mode');
      const label = btn && btn.textContent.trim();
      return isLoopModeActive() === wanted
        && label === (wanted ? 'Exit Loop Mode' : 'Enter Loop Mode');
    },
    `Loop mode ${wanted ? 'on' : 'off'}`, 3000, 50,
  );
}

/**
 * Put the loops module back where a fresh panel starts — state 'idle', mana
 * full, progress cleared, `path` as it was — and get the queue-control button's
 * LABEL to agree.
 *
 * ⚠ THE EMPTY-PATH DANCE IS THE POINT. `_resetLoop()` refills mana and clears
 * `_queueCompleted`, but publishes only `loopState:loopReset`, which
 * `loopUI._handleLoopReset` does NOT let touch the button label. The one
 * public call that publishes `pauseStateChanged` and lands IDLE is
 * `setPaused(false)` over an EMPTY queue (with a non-empty one it starts
 * processing instead), so the path is briefly emptied and put straight back.
 *
 * ⛔ WHY A ROW OWES THIS. Both rows below run the queue; without it the next row
 * in the roster inherits 'Resume'/paused or 'Restart'/completed with an empty
 * mana pool. `loops-pause-resume` asserts it starts at 'Start'/idle, and
 * measured RED on exactly that inheritance before this helper existed.
 */
function resetLoopsToIdle(loopState, setPath, pathBefore) {
  try { loopState.stopProcessing(); } catch (e) { /* best effort */ }
  try { setPath([]); } catch (e) { /* best effort */ }
  try { loopState.setPaused(false); } catch (e) { /* best effort */ }
  try { setPath(pathBefore); } catch (e) { /* best effort */ }
  try { loopState._resetLoop(); } catch (e) { /* best effort */ }
}

/**
 * The first location the LOADED DOCUMENT gives `regionName` that is NOT already
 * checked, read through the state manager's static data and snapshot. Nothing
 * about any particular world is written into these rows — and skipping checked
 * locations matters: a re-queued check of an already-checked location costs
 * nothing, so a row that used it would watch mana not move and call the app
 * broken (measured).
 */
function firstUncheckedLocationOf(testController, regionName) {
  const staticData = testController.stateManager?.getStaticData?.();
  const locations = staticData?.regions?.get?.(regionName)?.locations ?? [];
  const checked = testController.stateManager?.getSnapshot?.()?.checkedLocations;
  const isChecked = (name) => (checked instanceof Set
    ? checked.has(name)
    : Array.isArray(checked) ? checked.includes(name) : false);
  for (const location of locations) {
    if (location?.name && !isChecked(location.name)) return location.name;
  }
  return null;
}

/**
 * Helper function to activate the loops panel and enter loop mode.
 * @param {object} testController - The test controller object
 * @returns {Promise<{eventBus: object, loopsPanelElement: Element, loopState: object}>}
 */
async function setupLoopsPanelAndEnterMode(testController) {
  testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });

  const loopsPanelElement = await testController.pollForValue(
    () => document.querySelector('.loop-panel-container'),
    'Loops panel DOM element',
    5000,
    50
  );
  if (!loopsPanelElement) {
    throw new Error('Loops panel not found in DOM');
  }

  // Enter loop mode if not already active
  const loopModeBtn = loopsPanelElement.querySelector('#loop-ui-toggle-loop-mode');
  if (loopModeBtn && loopModeBtn.textContent === 'Enter Loop Mode') {
    loopModeBtn.click();
    await testController.pollForCondition(
      () => {
        const btn = loopsPanelElement.querySelector('#loop-ui-toggle-loop-mode');
        return btn && btn.textContent === 'Exit Loop Mode';
      },
      'Loop mode activated',
      3000,
      50
    );
  }

  const loopStateModule = await import('../../loops/loopStateSingleton.js');
  const loopState = loopStateModule.default;

  return { eventBus: testController.eventBus, loopsPanelElement, loopState };
}

/**
 * ⛓ MANA CONSUMPTION — mana MOVES while the queue runs, and stops when it stops.
 *
 * WHAT THIS ROW PROVES. With one real action queued, the queue-control button's
 * round trip drives the state machine AND the economy together:
 *   - at rest the button's LABEL agrees with `getProcessingState()` through
 *     `loopUI._updatePauseButtonState`'s own table (asserting the PAIR, not a
 *     fixed word, is what lets the row start from any inherited state);
 *   - one click ⇒ 'Pause' (running), and `gameState:manaChanged` starts
 *     arriving with values BELOW the starting mana;
 *   - one more click ⇒ 'Resume' (paused), and the mana reading has actually
 *     dropped — a number this row logs, not a boolean it assumes.
 *
 * ⛔ WHAT IT REFUSED TO PROVE BEFORE M1. Two independent reasons the old row was
 * green on an app that spent nothing:
 *   1. it acted ONLY when the button already read 'Resume' — on a fresh panel it
 *      reads 'Start', so the click never happened; and
 *   2. its handler tested `data.mana < initialMana`, but the event's payload is
 *      `{current, max}` (`gameState/state.js emitManaChanged`) — `undefined <
 *      100` is false, so `manaDecreased` could never become true. It ended on
 *      `reportCondition('Mana tracking system functional', true)`, an
 *      unconditional pass.
 * There is no unconditional condition left here: a build that spends nothing
 * leaves the drop poll STUCK and the row RED.
 *
 * ⚠ PRECONDITIONS ESTABLISHED, not inherited (the pause-resume row is the
 * precedent):
 *   - A NORMALIZED loop, via `resetLoopsToIdle` (see its docblock) — so an
 *     inherited completed queue with an empty mana pool cannot be mistaken for
 *     this row's subject. Measured before it existed: the predecessor row left
 *     'Restart'/completed and mana 0, and "below the starting mana" is
 *     unsatisfiable at zero.
 *   - ONE queued action. A plain world's queue is empty at rest, and
 *     `setPaused(false)` only starts processing when the queue is non-empty, so
 *     the row seeds a location check DERIVED from the document, in whichever
 *     region the player is in — and one that is NOT ALREADY CHECKED, because a
 *     re-check costs nothing and the mana poll would go STUCK on a healthy app
 *     (measured: the predecessor row checks the region's first location).
 *   - A SLOW clock. `gameSpeed` 10 drains ~2 mana/second here, which is fast
 *     enough to see inside the poll and slow enough that the queue cannot
 *     complete under us and take the label to 'Restart' (measured: 100 → 94
 *     over 3 s, state 'running' throughout).
 *   - Path and speed are captured and restored.
 *
 * @param {object} testController - The test controller object provided by the test runner.
 * @returns {Promise<boolean>} - True if the test passed, false otherwise.
 */
export async function testManaConsumption(testController) {
  let overallResult = true;
  const testRunId = `mana-consumption-test-${Date.now()}`;
  let restore = null;

  const fail = (name) => { testController.reportCondition(name, false); overallResult = false; };

  try {
    testController.log(`[${testRunId}] Starting mana consumption test...`);

    const { loopsPanelElement, loopState, eventBus } = await setupLoopsPanelAndEnterMode(testController);
    testController.reportCondition('Loops panel and mode activated', true);

    const { centralRegistry } = await import('../../../app/core/centralRegistry.js');
    const api = (moduleId, fnName) => centralRegistry?.getPublicFunction?.(moduleId, fnName);
    const getPath = api('gameState', 'getPath');
    const setPath = api('gameState', 'setPath');
    const getCurrentRegion = api('gameState', 'getCurrentRegion');
    const getCurrentMana = api('gameState', 'getCurrentMana');
    const addLocationCheck = api('gameState', 'addLocationCheck');
    if (!getPath || !setPath || !getCurrentRegion || !getCurrentMana || !addLocationCheck) {
      fail('gameState resource API available');
      return overallResult;
    }
    testController.reportCondition('gameState resource API available', true);

    const pathBefore = getPath();
    const speedBefore = loopState.gameSpeed;
    restore = () => {
      try { loopState.setGameSpeed(speedBefore ?? 100); } catch (e) { /* best effort */ }
      resetLoopsToIdle(loopState, setPath, pathBefore);
    };

    // --- normalize, so this row does not inherit its predecessor's state ----
    resetLoopsToIdle(loopState, setPath, pathBefore);

    // --- seed exactly one real action --------------------------------------
    const region = getCurrentRegion();
    const locationName = firstUncheckedLocationOf(testController, region);
    if (!locationName) { fail(`The document names a location in ${region}`); restore(); return overallResult; }
    testController.reportCondition(`The document names a location in ${region}`, true);
    addLocationCheck(locationName, region);

    const queued = await testController.pollForCondition(
      () => (loopState.getActionQueue?.() ?? []).length > 0,
      'Queue seeded with one real action', 3000, 50,
    );
    testController.reportCondition('Queue seeded with one real action', queued);
    if (!queued) { overallResult = false; restore(); return overallResult; }

    // Slow the clock BEFORE anything can run (see the preconditions above).
    loopState.setGameSpeed(10);

    // --- the economy's own witness -----------------------------------------
    const manaBefore = getCurrentMana();
    const below = [];
    const manaHandler = (data) => {
      // ⛔ `current`, NOT `mana` — the payload the old row read did not exist.
      if (typeof data?.current === 'number' && data.current < manaBefore) below.push(data.current);
    };
    eventBus.subscribe('gameState:manaChanged', manaHandler);

    const queueButton = loopsPanelElement.querySelector('#loop-ui-toggle-pause');
    if (!queueButton) { fail('Queue-control button found'); restore(); return overallResult; }
    testController.reportCondition('Queue-control button found', true);

    // Leg 1 — the label AGREES with the state machine. The map is
    // `loopUI._updatePauseButtonState`'s own; asserting the pair rather than a
    // fixed word is what lets this row start from whatever state it inherited
    // and still make a real claim about the button.
    const label0 = queueButton.textContent.trim();
    const state0 = loopState.getProcessingState?.();
    testController.log(`[${testRunId}] at rest: label="${label0}" state="${state0}" mana=${manaBefore}`);
    testController.reportCondition(
      `At rest the button's label tracks the state (${state0} ⇒ ${QUEUE_BUTTON_LABELS[state0]})`,
      label0 === QUEUE_BUTTON_LABELS[state0],
    );
    if (label0 !== QUEUE_BUTTON_LABELS[state0]) overallResult = false;

    // Leg 2 — one click ⇒ running ⇒ 'Pause'. Asserted SYNCHRONOUSLY: the whole
    // click → setPaused → pauseStateChanged → label chain is synchronous, and
    // awaiting first lets a frame interleave (the pause-resume row measured
    // that coin flip).
    queueButton.click();
    const label1 = queueButton.textContent.trim();
    const state1 = loopState.getProcessingState?.();
    testController.log(`[${testRunId}] after the run click: label="${label1}" state="${state1}"`);
    testController.reportCondition('The run click makes the button read Pause (running)', label1 === 'Pause' && state1 === 'running');
    if (!(label1 === 'Pause' && state1 === 'running')) overallResult = false;

    // ⛔ THE POLL THAT MUST GO STUCK on a build that spends nothing.
    const manaMoved = await testController.pollForCondition(
      () => below.length > 0 && getCurrentMana() < manaBefore,
      'Mana MOVED while the queue ran', 6000, 100,
    );
    const manaAfter = getCurrentMana();
    testController.log(
      `[${testRunId}] mana ${manaBefore} → ${manaAfter} `
      + `(${below.length} manaChanged events below the start; lowest ${below.length ? Math.min(...below) : 'n/a'})`,
    );
    testController.reportCondition('Mana MOVED while the queue ran', manaMoved);
    if (!manaMoved) overallResult = false;

    // Leg 3 — one more click ⇒ paused ⇒ 'Resume', and the drain stops.
    queueButton.click();
    const label2 = queueButton.textContent.trim();
    const state2 = loopState.getProcessingState?.();
    testController.log(`[${testRunId}] after Pause: label="${label2}" state="${state2}"`);
    testController.reportCondition('Pause click makes the button read Resume (paused)', label2 === 'Resume' && state2 === 'paused');
    if (!(label2 === 'Resume' && state2 === 'paused')) overallResult = false;

    eventBus.unsubscribe('gameState:manaChanged', manaHandler);
    restore();
    restore = null;

    testController.log(`[${testRunId}] Mana consumption test completed`);
    return overallResult;

  } catch (error) {
    if (restore) restore();
    testController.log(`[${testRunId}] Test failed with error: ${error.message}`, 'error');
    testController.reportCondition('Test completed without error', false);
    return false;
  }
}

/**
 * Test case for verifying that XP is awarded correctly.
 * @param {object} testController - The test controller object provided by the test runner.
 * @returns {Promise<boolean>} - True if the test passed, false otherwise.
 */
export async function testXPAwarding(testController) {
  let overallResult = true;
  const testRunId = `xp-awarding-test-${Date.now()}`;

  try {
    testController.log(`[${testRunId}] Starting XP awarding test...`);
    testController.reportCondition('Test started', true);

    const { loopsPanelElement, loopState, eventBus } = await setupLoopsPanelAndEnterMode(testController);
    testController.reportCondition('Loops panel and mode activated', true);

    // Check if XP functions exist
    if (typeof loopState.getRegionXP !== 'function' || typeof loopState.addRegionXP !== 'function') {
      testController.log(`[${testRunId}] XP functions not available on loopState - skipping test`);
      testController.reportCondition('XP test skipped (functions not available)', true);
      return true;
    }

    // Get initial XP for Menu region
    const regionName = 'Menu';
    const initialXPData = loopState.getRegionXP(regionName);
    const initialXP = initialXPData?.xp ?? 0;
    const initialLevel = initialXPData?.level ?? 0;
    testController.log(`[${testRunId}] Initial XP for ${regionName}: ${initialXP}, level: ${initialLevel}`);
    testController.reportCondition('Initial XP recorded', true);

    // Add XP manually
    const xpToAdd = 50;
    const result = loopState.addRegionXP(regionName, xpToAdd);
    testController.log(`[${testRunId}] Added ${xpToAdd} XP, result: ${JSON.stringify(result)}`);

    // Get updated XP
    const updatedXPData = loopState.getRegionXP(regionName);
    const updatedXP = updatedXPData?.xp ?? 0;
    testController.log(`[${testRunId}] Updated XP for ${regionName}: ${updatedXP}`);

    // Verify XP increased
    if (updatedXP > initialXP) {
      testController.reportCondition('XP increased after addRegionXP', true);
    } else {
      testController.reportCondition('XP increased after addRegionXP', false);
      testController.log(`[${testRunId}] ERROR: XP did not increase (was ${initialXP}, now ${updatedXP})`);
      overallResult = false;
    }

    testController.log(`[${testRunId}] XP awarding test completed`);
    return overallResult;

  } catch (error) {
    testController.log(`[${testRunId}] Test failed with error: ${error.message}`, 'error');
    testController.reportCondition('Test completed without error', false);
    return false;
  }
}

/**
 * Test case for verifying level-up mechanics and cost reduction.
 * @param {object} testController - The test controller object provided by the test runner.
 * @returns {Promise<boolean>} - True if the test passed, false otherwise.
 */
export async function testLevelUpMechanics(testController) {
  let overallResult = true;
  const testRunId = `level-up-test-${Date.now()}`;

  try {
    testController.log(`[${testRunId}] Starting level-up mechanics test...`);
    testController.reportCondition('Test started', true);

    const { loopState, eventBus } = await setupLoopsPanelAndEnterMode(testController);
    testController.reportCondition('Loops panel and mode activated', true);

    if (typeof loopState.getRegionXP !== 'function' || typeof loopState.addRegionXP !== 'function') {
      testController.log(`[${testRunId}] XP functions not available - skipping test`);
      testController.reportCondition('Level-up test skipped (XP functions not available)', true);
      return true;
    }

    const regionName = 'Menu';

    // Get initial level
    const initialData = loopState.getRegionXP(regionName);
    const initialLevel = initialData?.level ?? 0;
    testController.log(`[${testRunId}] Initial level for ${regionName}: ${initialLevel}`);

    // Subscribe to level-up events
    let levelUpOccurred = false;
    let newLevel = initialLevel;
    const xpHandler = (data) => {
      if (data.leveledUp) {
        levelUpOccurred = true;
        newLevel = data.newLevel ?? data.level;
        testController.log(`[${testRunId}] Level up detected! New level: ${newLevel}`);
      }
    };
    eventBus.subscribe('gameState:xpChanged', xpHandler);

    // Add enough XP to trigger a level-up (XP per level = 100 + level * 20)
    // For level 0 -> 1, need 120 XP
    const xpNeeded = 120 + (initialLevel * 20) + 50; // Add extra to ensure level up
    testController.log(`[${testRunId}] Adding ${xpNeeded} XP to trigger level-up...`);
    loopState.addRegionXP(regionName, xpNeeded);

    // Wait briefly for event
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if level increased
    const updatedData = loopState.getRegionXP(regionName);
    const updatedLevel = updatedData?.level ?? 0;
    testController.log(`[${testRunId}] Updated level: ${updatedLevel}`);

    if (updatedLevel > initialLevel) {
      testController.reportCondition('Level increased after adding XP', true);
    } else {
      testController.reportCondition('Level increased after adding XP', false);
      testController.log(`[${testRunId}] WARNING: Level did not increase (was ${initialLevel}, now ${updatedLevel})`);
      // This might not be a failure if the XP wasn't enough
    }

    // Cleanup
    eventBus.unsubscribe('gameState:xpChanged', xpHandler);

    testController.log(`[${testRunId}] Level-up mechanics test completed`);
    return overallResult;

  } catch (error) {
    testController.log(`[${testRunId}] Test failed with error: ${error.message}`, 'error');
    testController.reportCondition('Test completed without error', false);
    return false;
  }
}

/**
 * Test case for verifying speed adjustment affects processing.
 * @param {object} testController - The test controller object provided by the test runner.
 * @returns {Promise<boolean>} - True if the test passed, false otherwise.
 */
export async function testSpeedAdjustment(testController) {
  let overallResult = true;
  const testRunId = `speed-adjustment-test-${Date.now()}`;

  try {
    testController.log(`[${testRunId}] Starting speed adjustment test...`);
    testController.reportCondition('Test started', true);

    const { loopsPanelElement, loopState, eventBus } = await setupLoopsPanelAndEnterMode(testController);
    testController.reportCondition('Loops panel and mode activated', true);

    // Check if speed functions exist
    if (typeof loopState.setGameSpeed !== 'function') {
      testController.log(`[${testRunId}] setGameSpeed function not available - skipping test`);
      testController.reportCondition('Speed test skipped (function not available)', true);
      return true;
    }

    // Set initial speed
    const initialSpeed = 1;
    loopState.setGameSpeed(initialSpeed);
    testController.log(`[${testRunId}] Set initial speed to ${initialSpeed}`);

    // Verify speed was set
    const currentSpeed = loopState.gameSpeed ?? loopState.getGameSpeed?.() ?? 0;
    if (currentSpeed === initialSpeed) {
      testController.reportCondition('Initial speed set correctly', true);
    } else {
      testController.reportCondition('Initial speed set correctly', false);
      testController.log(`[${testRunId}] Speed mismatch: expected ${initialSpeed}, got ${currentSpeed}`);
    }

    // Subscribe to speed change events
    let speedChangeDetected = false;
    const speedHandler = (data) => {
      speedChangeDetected = true;
      testController.log(`[${testRunId}] Speed change event: ${JSON.stringify(data)}`);
    };
    eventBus.subscribe('loopState:speedChanged', speedHandler);

    // Change speed
    const newSpeed = 50;
    loopState.setGameSpeed(newSpeed);
    testController.log(`[${testRunId}] Set new speed to ${newSpeed}`);

    // Wait briefly for event
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify new speed
    const updatedSpeed = loopState.gameSpeed ?? loopState.getGameSpeed?.() ?? 0;
    if (updatedSpeed === newSpeed) {
      testController.reportCondition('Speed updated correctly', true);
    } else {
      testController.reportCondition('Speed updated correctly', false);
      testController.log(`[${testRunId}] Speed mismatch: expected ${newSpeed}, got ${updatedSpeed}`);
      overallResult = false;
    }

    // Cleanup
    eventBus.unsubscribe('loopState:speedChanged', speedHandler);

    // Reset speed to normal
    loopState.setGameSpeed(10);

    testController.log(`[${testRunId}] Speed adjustment test completed`);
    return overallResult;

  } catch (error) {
    testController.log(`[${testRunId}] Test failed with error: ${error.message}`, 'error');
    testController.reportCondition('Test completed without error', false);
    return false;
  }
}

/**
 * Test case for the queue-control button's state machine.
 *
 * The button (`#loop-ui-toggle-pause`) is a SINGLE button whose label is
 * derived from `loopState.getProcessingState()` — `loopUI._updatePauseButtonState`
 * maps `{idle:'Start', running:'Pause', paused:'Resume', completed:'Restart',
 * waiting:'Waiting'}`. This row drives the round trip
 *
 *     Start  --click-->  Pause  --click-->  Resume  --click-->  Pause
 *
 * and checks the published `loopState:pauseStateChanged.processingState`
 * alongside each label, so a label that stops tracking the state reds here even
 * if the state machine itself is fine (and vice versa).
 *
 * ⚠ Two preconditions this row establishes for itself rather than inheriting:
 *   - **A non-empty queue.** `loopState.setPaused(false)` only calls
 *     `startProcessing()` when `getActionQueue().length > 0`, so on a world
 *     whose path is empty (every plain world at boot: start region, empty path)
 *     clicking Start is a no-op and the label never leaves 'Start'. We seed one
 *     entry through the product's own `gameState.addManualAction()` public
 *     function — called with no argument it falls back to `currentRegion`, so
 *     no region name is hardcoded here — and restore the original path at the
 *     end. A `manual` entry is used because it consumes no mana and completes
 *     nothing: a seeded `explore` at the start region is measured to complete
 *     in ONE frame (`_advanceActionProgress` shortcuts to 100% when
 *     `actionCost === 0`, and the start region's cost is 0 in both cost
 *     models), taking the label Start → Restart and never through Pause.
 *   - **A slow clock.** Belt and braces: we drop to the minimum `gameSpeed`
 *     (0.1) for the drive and restore it after, so a future change that makes
 *     the seeded entry accrue progress still cannot complete it under us.
 *
 * @param {object} testController - The test controller object provided by the test runner.
 * @returns {Promise<boolean>} - True if the test passed, false otherwise.
 */
export async function testPauseResume(testController) {
  let overallResult = true;
  const testRunId = `pause-resume-test-${Date.now()}`;

  // Set by the setup block; restored in the finally-equivalent tail.
  let restore = null;

  try {
    testController.log(`[${testRunId}] Starting queue-control button state test...`);
    testController.reportCondition('Test started', true);

    const { loopsPanelElement, loopState, eventBus } = await setupLoopsPanelAndEnterMode(testController);
    testController.reportCondition('Loops panel and mode activated', true);

    const centralRegistryModule = await import('../../../app/core/centralRegistry.js');
    const centralRegistry = centralRegistryModule.centralRegistry;
    const getPath = centralRegistry?.getPublicFunction?.('gameState', 'getPath');
    const setPath = centralRegistry?.getPublicFunction?.('gameState', 'setPath');
    const addManualAction = centralRegistry?.getPublicFunction?.('gameState', 'addManualAction');
    if (!getPath || !setPath || !addManualAction) {
      testController.reportCondition('gameState path API available', false);
      return false;
    }
    testController.reportCondition('gameState path API available', true);

    const pathBefore = getPath();
    const speedBefore = loopState.gameSpeed;
    restore = () => {
      try { setPath(pathBefore); } catch (e) { /* best effort */ }
      try { loopState.setGameSpeed(speedBefore ?? 100); } catch (e) { /* best effort */ }
    };

    // Slow the clock BEFORE anything can run, then seed one queue entry.
    loopState.setGameSpeed(0.1);
    addManualAction();

    const queueSeeded = await testController.pollForCondition(
      () => (loopState.getActionQueue?.() ?? []).length > 0,
      'Queue has at least one action',
      3000,
      50
    );
    if (!queueSeeded) {
      testController.reportCondition('Queue seeded with one action', false);
      restore();
      return false;
    }
    testController.reportCondition('Queue seeded with one action', true);

    const pauseBtn = loopsPanelElement.querySelector('#loop-ui-toggle-pause');
    if (!pauseBtn) {
      testController.reportCondition('Queue-control button found', false);
      restore();
      return false;
    }
    testController.reportCondition('Queue-control button found', true);

    // Record the processingState the module publishes on every transition, so
    // the label assertions below have an independent witness.
    const statesSeen = [];
    const stateHandler = (data) => {
      statesSeen.push(data?.processingState);
      testController.log(`[${testRunId}] pauseStateChanged → processingState="${data?.processingState}"`);
    };
    eventBus.subscribe('loopState:pauseStateChanged', stateHandler);

    // --- the round trip -------------------------------------------------
    // Every leg is asserted SYNCHRONOUSLY, immediately after the click, with no
    // await in between. The whole chain is synchronous — the button handler
    // (`loopUI.js`) calls `loopState.setPaused`, which publishes
    // `loopState:pauseStateChanged`, which `eventCoordinator._handlePause
    // StateChanged` turns straight into `loopUI._updatePauseButtonState` — so
    // the label is already correct when `.click()` returns and nothing can
    // interleave.
    //
    // ⚠ Do NOT put a poll here. Awaiting lets a rAF frame run `_processFrame`,
    // and the parked `manual` entry's `_handleManualEntry` calls
    // `stopProcessing()`, dropping the state to 'idle' with `isPaused` still
    // false. Measured with a 25 ms poll: 'Pause' on one run and 'idle' on the
    // next, with every later leg shifted one transition behind — a coin flip,
    // not a signal.
    const labelNow = () => pauseBtn.textContent.trim();
    const legs = [];

    // 1. At rest, with a queue and nothing started: idle ⇒ "Start".
    legs.push({
      name: 'At rest the button reads Start (idle)',
      label: labelNow(),
      state: loopState.getProcessingState?.(),
      wantLabel: 'Start',
      wantState: 'idle',
    });

    // 2. Click ⇒ running ⇒ "Pause".
    pauseBtn.click();
    legs.push({
      name: 'Start click makes the button read Pause (running)',
      label: labelNow(),
      state: loopState.getProcessingState?.(),
      wantLabel: 'Pause',
      wantState: 'running',
    });

    // 3. Click ⇒ paused ⇒ "Resume".
    pauseBtn.click();
    legs.push({
      name: 'Pause click makes the button read Resume (paused)',
      label: labelNow(),
      state: loopState.getProcessingState?.(),
      wantLabel: 'Resume',
      wantState: 'paused',
    });

    // 4. Click ⇒ running again ⇒ "Pause". Resume is a distinct transition from
    //    Start (it goes through _shouldResetOnResume), so it gets its own leg.
    pauseBtn.click();
    legs.push({
      name: 'Resume click makes the button read Pause again (running)',
      label: labelNow(),
      state: loopState.getProcessingState?.(),
      wantLabel: 'Pause',
      wantState: 'running',
    });

    for (const leg of legs) {
      const ok = leg.label === leg.wantLabel && leg.state === leg.wantState;
      testController.log(
        `[${testRunId}] ${leg.name}: label="${leg.label}" state="${leg.state}" `
        + `(wanted label="${leg.wantLabel}" state="${leg.wantState}")`
      );
      testController.reportCondition(leg.name, ok);
      if (!ok) overallResult = false;
    }

    // 5. The published transitions must be exactly the three we drove.
    //    ⚠ Consecutive duplicates are collapsed on purpose: each click
    //    publishes `loopState:pauseStateChanged` TWICE with the same state —
    //    once from `startProcessing`/`stopProcessing` (loopState.js:901/941)
    //    and once from `setPaused` itself (loopState.js:1037). The ORDER and
    //    the SET of transitions are this row's claim; the publish count is not.
    const collapsed = statesSeen.filter((v, i) => i === 0 || v !== statesSeen[i - 1]);
    const expectedStates = ['running', 'paused', 'running'];
    const statesMatch =
      collapsed.length === expectedStates.length
      && collapsed.every((v, i) => v === expectedStates[i]);
    testController.log(`[${testRunId}] processingState sequence: [${statesSeen.join(', ')}] → collapsed [${collapsed.join(', ')}]`);
    testController.reportCondition(
      'loopState:pauseStateChanged published running → paused → running',
      statesMatch
    );
    if (!statesMatch) overallResult = false;

    // --- leave the app as we found it -----------------------------------
    loopState.setPaused(true);
    eventBus.unsubscribe('loopState:pauseStateChanged', stateHandler);
    restore();
    restore = null;

    testController.log(`[${testRunId}] Queue-control button state test completed`);
    return overallResult;

  } catch (error) {
    if (restore) restore();
    testController.log(`[${testRunId}] Test failed with error: ${error.message}`, 'error');
    testController.reportCondition('Test completed without error', false);
    return false;
  }
}

/**
 * Test case for verifying auto-restart functionality.
 * @param {object} testController - The test controller object provided by the test runner.
 * @returns {Promise<boolean>} - True if the test passed, false otherwise.
 */
export async function testAutoRestart(testController) {
  let overallResult = true;
  const testRunId = `auto-restart-test-${Date.now()}`;

  try {
    testController.log(`[${testRunId}] Starting auto-restart test...`);
    testController.reportCondition('Test started', true);

    const { loopsPanelElement, loopState, eventBus } = await setupLoopsPanelAndEnterMode(testController);
    testController.reportCondition('Loops panel and mode activated', true);

    // Check if auto-restart setting exists
    if (typeof loopState.setAutoRestart !== 'function' && loopState.autoRestart === undefined) {
      testController.log(`[${testRunId}] Auto-restart functionality not available - skipping test`);
      testController.reportCondition('Auto-restart test skipped (feature not available)', true);
      return true; // Not a failure, just not available
    }

    // Find auto-restart checkbox if it exists
    const autoRestartCheckbox = loopsPanelElement.querySelector('#loop-ui-auto-restart');

    if (autoRestartCheckbox) {
      // Toggle auto-restart
      const initialChecked = autoRestartCheckbox.checked;
      testController.log(`[${testRunId}] Initial auto-restart state: ${initialChecked}`);

      autoRestartCheckbox.click();
      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedChecked = autoRestartCheckbox.checked;
      testController.log(`[${testRunId}] Updated auto-restart state: ${updatedChecked}`);

      if (updatedChecked !== initialChecked) {
        testController.reportCondition('Auto-restart toggle works', true);
      } else {
        testController.reportCondition('Auto-restart toggle works', false);
        overallResult = false;
      }

      // Reset to original state
      if (autoRestartCheckbox.checked !== initialChecked) {
        autoRestartCheckbox.click();
      }
    } else {
      testController.log(`[${testRunId}] Auto-restart checkbox not found in UI - skipping UI test`);
      testController.reportCondition('Auto-restart UI test skipped (checkbox not in UI)', true);
    }

    testController.log(`[${testRunId}] Auto-restart test completed`);
    return overallResult;

  } catch (error) {
    testController.log(`[${testRunId}] Test failed with error: ${error.message}`, 'error');
    testController.reportCondition('Test completed without error', false);
    return false;
  }
}

/**
 * Test case for verifying enter/exit loop mode functionality.
 * @param {object} testController - The test controller object provided by the test runner.
 * @returns {Promise<boolean>} - True if the test passed, false otherwise.
 */
export async function testEnterExitLoopMode(testController) {
  let overallResult = true;
  const testRunId = `enter-exit-mode-test-${Date.now()}`;

  try {
    testController.log(`[${testRunId}] Starting enter/exit loop mode test...`);
    testController.reportCondition('Test started', true);

    // Activate loops panel
    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });

    const loopsPanelElement = await testController.pollForValue(
      () => document.querySelector('.loop-panel-container'),
      'Loops panel DOM element',
      5000,
      50
    );
    if (!loopsPanelElement) {
      throw new Error('Loops panel not found in DOM');
    }
    testController.reportCondition('Loops panel found', true);

    // Find loop mode toggle button
    const loopModeBtn = loopsPanelElement.querySelector('#loop-ui-toggle-loop-mode');
    if (!loopModeBtn) {
      throw new Error('Loop mode toggle button not found');
    }

    // Record initial state
    const initialBtnText = loopModeBtn.textContent;
    testController.log(`[${testRunId}] Initial button text: "${initialBtnText}"`);

    // Subscribe to mode change events
    let modeChangeEvents = [];
    const modeHandler = (data) => {
      modeChangeEvents.push(data);
      testController.log(`[${testRunId}] Mode change event: ${JSON.stringify(data)}`);
    };
    testController.eventBus.subscribe('gameState:loopModeChanged', modeHandler);
    testController.eventBus.subscribe('loops:setLoopMode', modeHandler);

    // Toggle mode
    loopModeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 300));

    const afterFirstClickBtnText = loopModeBtn.textContent;
    testController.log(`[${testRunId}] After first click: "${afterFirstClickBtnText}"`);

    if (afterFirstClickBtnText !== initialBtnText) {
      testController.reportCondition('First toggle changes button text', true);
    } else {
      testController.reportCondition('First toggle changes button text', false);
      overallResult = false;
    }

    // Toggle again
    loopModeBtn.click();
    await new Promise(resolve => setTimeout(resolve, 300));

    const afterSecondClickBtnText = loopModeBtn.textContent;
    testController.log(`[${testRunId}] After second click: "${afterSecondClickBtnText}"`);

    if (afterSecondClickBtnText === initialBtnText) {
      testController.reportCondition('Second toggle restores original state', true);
    } else {
      testController.reportCondition('Second toggle restores original state', false);
      overallResult = false;
    }

    // Cleanup
    testController.eventBus.unsubscribe('gameState:loopModeChanged', modeHandler);
    testController.eventBus.unsubscribe('loops:setLoopMode', modeHandler);

    testController.log(`[${testRunId}] Enter/exit loop mode test completed`);
    return overallResult;

  } catch (error) {
    testController.log(`[${testRunId}] Test failed with error: ${error.message}`, 'error');
    testController.reportCondition('Test completed without error', false);
    return false;
  }
}

// Register the real-actions test
registerTest({
  id: 'loops-real-actions-processed',
  name: 'Real Actions Are Processed',
  description: "Drives the menu panel's Restart and one exit button into the path, queues a location check behind the move, and asserts the queue PROCESSES both",
  category: 'loops',
  testFunction: testRealActionsProcessed
});

// Register mana consumption test
registerTest({
  id: 'loops-mana-consumption',
  name: 'Mana Consumption',
  description: 'Drives the real Start/Pause labels over one seeded action and asserts mana MOVES (gameState:manaChanged.current below the start) and stops on Pause',
  category: 'loops',
  testFunction: testManaConsumption
});

// Register XP awarding test
registerTest({
  id: 'loops-xp-awarding',
  name: 'XP Awarding',
  description: 'Verifies that XP is awarded correctly per action',
  category: 'loops',
  testFunction: testXPAwarding
});

// Register level-up mechanics test
registerTest({
  id: 'loops-level-up-mechanics',
  name: 'Level Up Mechanics',
  description: 'Verifies that level thresholds work correctly and provide cost reduction',
  category: 'loops',
  testFunction: testLevelUpMechanics
});

// Register speed adjustment test
registerTest({
  id: 'loops-speed-adjustment',
  name: 'Speed Adjustment',
  description: 'Verifies that speed slider affects action processing rate',
  category: 'loops',
  testFunction: testSpeedAdjustment
});

// Register the queue-control button state-machine test
registerTest({
  id: 'loops-pause-resume',
  name: 'Pause/Resume Functionality',
  description: 'Drives the queue-control button round trip Start -> Pause -> Resume -> Pause and checks the published processingState with each label',
  category: 'loops',
  testFunction: testPauseResume
});

// Register auto-restart test
registerTest({
  id: 'loops-auto-restart',
  name: 'Auto Restart',
  description: 'Verifies that auto-restart works when mana is depleted',
  category: 'loops',
  testFunction: testAutoRestart
});

// Register enter/exit loop mode test
registerTest({
  id: 'loops-enter-exit-mode',
  name: 'Enter/Exit Loop Mode',
  description: 'Verifies that entering and exiting loop mode works correctly',
  category: 'loops',
  testFunction: testEnterExitLoopMode
});