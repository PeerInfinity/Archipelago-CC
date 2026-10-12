// Scenario tests for the playback bot. See ../README.md for the discipline.
//
// Calibration target: prove the in-app harness can drive the playback bot
// end-to-end against a real preset. If these pass, the same pattern extends
// to scenario tests for maze / text-adventure / jta substrate behaviour
// (with the bot as the deterministic driver).

import { registerTest } from '../testRegistry.js';
import { getActivePanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';
import { _testOnly_getWarehouse } from '../../procgenPlayer/index.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import { arrangeShuffledSpiral, buildRulesJson } from '../../procgenPipeline/procgenPipelineEngine.js';
import { getPanelInstance as getMazePanel } from '../../mazeRoom/index.js';
import { getJtaEmitZoneLocations, setJtaEmitZoneLocations } from '../../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';

const APCALC_RULES = './presets/apcalc/AP_14089154938208861744/AP_14089154938208861744_rules.json';
// The smallest procgen_maze tier — picked specifically because (a) it uses
// the maze substrate so the bot has a controller to dispatch to and (b) it's
// small enough to drain to completion fast. It carries its sphere log
// EMBEDDED (`sphere_log`), not as a `_sphere_log.jsonl` beside it. (Until
// APWORLD SUBSTRATE CHANGE PM1 this pointed at procgen_maze_worldgen's
// Generate.py export of the same three payloads — deleted in ccfc5bad02.)
const PROCGEN_MAZE_RULES = './presets/procgen_maze/AP_1/AP_1_rules.json';
// A plain (non-procgen) rules.json: no sidecars, no substrate, no controller — the bot plays it DIRECTLY.
const ADVENTURE_RULES = './presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json';

/**
 * Smoke test: load apcalc, activate the playback bot panel, verify the bot
 * instance is reachable and the sphere data is non-empty. No playback is
 * driven — this is purely a calibration of the harness pattern.
 */
async function playbackBotSmokeTest(testController) {
  testController.log('Loading apcalc rules...');
  await testController.loadRulesFromFile(APCALC_RULES);
  testController.reportCondition('apcalc rules loaded', true);

  // The sphere log is a separate file from the rules; the convention is to
  // derive it by swapping the suffix. loadRulesFromFile doesn't load it
  // automatically — the Presets module does that when loading via the UI.
  const sphereLogPath = APCALC_RULES.replace('_rules.json', '_sphere_log.jsonl');
  const sphereState = getSphereStateSingleton();
  await sphereState.loadSphereLog(sphereLogPath);
  const sphereData = sphereState.getSphereData();
  testController.reportCondition(
    'sphere data is an array',
    Array.isArray(sphereData)
  );
  testController.reportCondition(
    'sphere data is non-empty',
    Array.isArray(sphereData) && sphereData.length > 0
  );

  // Activate the playback bot panel so its constructor runs setActivePanel().
  testController.eventBus.publish('ui:activatePanel', {
    panelId: 'playbackBotPanel',
  });

  // The panel may already be mounted (it's in the default layout) — poll
  // until getActivePanel() resolves, then read the bot off it.
  const panel = await testController.pollForValue(
    () => getActivePanel(),
    'playback bot panel instance',
    5000,
    100
  );
  testController.reportCondition('playback bot panel mounted', !!panel);

  const bot = panel?.getBot?.();
  testController.reportCondition('bot reachable via panel.getBot()', !!bot);
  testController.assertEqual('bot initial status', 'idle', bot?.getStatus?.());

  return testController.getOverallResult();
}

registerTest({
  id: 'playback-bot-smoke',
  name: 'Playback Bot: smoke',
  description:
    'Loads apcalc, activates the playback bot panel, verifies the bot '
    + 'instance is reachable and sphere data is parsed. No playback driven.',
  testFunction: playbackBotSmokeTest,
  category: 'Playback Bot',
  enabled: false,
});

/**
 * End-to-end: drive the bot through a tiny procgen+maze preset at instant
 * speed and verify it reaches the "finished" status. Three sphere entries
 * across two regions, so this exercises the full chain:
 *   sphere queue → bot.instant() → maze controller → exit cross →
 *   procgenPlayer → maze:loadRegion → next leg.
 *
 * Each reportCondition is a semantic checkpoint — when a future regression
 * stalls the bot, the failing assertion narrows where to look (e.g. a
 * failed "procgenPlayer built a warehouse" points at the warehouse builder
 * or the rawJsonDataLoaded plumbing, not the visualizer).
 */
async function playbackBotInstantPlaybackTest(testController) {
  // Activate the bot panel BEFORE loading rules. procgenPlayer publishes
  // a synthetic user:regionMove on stateManager:rulesLoaded; the bot's
  // _currentRegion only updates if its onRegionMove handler exists when
  // that event fires (which means the panel — and its bot instance —
  // must already be mounted). If we activate after loading rules, the
  // bot never learns its starting region and gets stuck "waiting for
  // region" forever.
  testController.eventBus.publish('ui:activatePanel', {
    panelId: 'playbackBotPanel',
  });
  const panel = await testController.pollForValue(
    () => getActivePanel(),
    'playback bot panel instance',
    5000,
    100
  );
  const bot = panel?.getBot?.();
  testController.reportCondition('bot reachable', !!bot);
  if (!bot) return testController.getOverallResult();

  testController.log('Loading procgen_maze AP_1 rules + its embedded sphere log...');
  await testController.loadRulesFromFile(PROCGEN_MAZE_RULES);
  const sphereState = getSphereStateSingleton();
  // The embedded log goes in as JSONL text, the shape the Presets module's
  // embedded path hands loadSphereLog.
  const rulesDoc = await (await fetch(PROCGEN_MAZE_RULES)).json();
  await sphereState.loadSphereLog(
    `embedded:${PROCGEN_MAZE_RULES}`,
    (rulesDoc.sphere_log ?? []).map((e) => JSON.stringify(e)).join('\n'),
  );
  testController.reportCondition(
    'sphere data non-empty',
    (sphereState.getSphereData()?.length ?? 0) > 0,
  );

  // procgenPlayer's warehouse is built from preset_sidecars during
  // handleRawJsonLoaded. If this fails: loadRulesFromFile isn't getting
  // rawJsonDataLoaded to procgenPlayer, the sidecars aren't where the
  // builder expects them, or the substrate registry didn't load.
  const warehouse = _testOnly_getWarehouse();
  testController.reportCondition(
    'procgenPlayer built a warehouse',
    !!warehouse && warehouse.size() > 0,
  );

  // procgenPlayer publishes its synthetic initial user:regionMove via the
  // dispatcher; the bot's dispatcher receiver records every inbound event.
  // These two probes narrow whether a future regression broke the publish,
  // the dispatcher chain, or the bot's onRegionMove handler.
  const sawRegionMove = (bot.getDispatcherLog?.() ?? [])
    .some((e) => e.eventName === 'user:regionMove');
  testController.reportCondition('bot dispatcher receiver saw user:regionMove', sawRegionMove);
  testController.reportCondition(
    'bot picked up starting region from procgenPlayer',
    !!bot.getCurrentRegion(),
  );

  // refresh() picks up the newly-loaded sphere data so the bot's status
  // line reflects the queue (helpful for diagnostic logs on failure).
  bot.refresh();

  await bot.instant();

  // Poll until the bot reaches a terminal state. "finished — N location(s)
  // visited" is the success signal (set in playbackBotUI.js around line 618).
  // 40s is generous — the bot drives instant() synchronously as far as it
  // can, then falls back to the 4Hz clock for cross-region legs (the bot's
  // pingWorker await yields out of the synchronous loop).
  const finished = await testController.pollForCondition(
    () => (bot.getStatus() || '').startsWith('finished'),
    'bot reaches finished status',
    40000,
    250,
  );
  testController.reportCondition('bot drained queue to completion', finished);
  if (!finished) {
    testController.log(`Bot final status: "${bot.getStatus()}"`);
    testController.log(`Bot transition log (tail): ${JSON.stringify(bot.getLog?.().slice(-12) ?? [])}`);
    testController.log(`Bot dispatcher log: ${JSON.stringify(
      (bot.getDispatcherLog?.() ?? []).map((e) => ({ ev: e.eventName, tgt: e.target, disp: e.disposition }))
    )}`);
  }

  return testController.getOverallResult();
}

registerTest({
  id: 'playback-bot-instant-completion',
  name: 'Playback Bot: instant-mode completion',
  description:
    'Drives the bot at instant speed through procgen_maze AP_1 (the '
    + 'smallest tier) and asserts it reaches the "finished" status. '
    + 'Exercises the bot → substrate-controller dispatch chain.',
  testFunction: playbackBotInstantPlaybackTest,
  category: 'Playback Bot',
  enabled: false,
});

/**
 * ⛓ DIRECT PLAY (loop-mode-bot S1): the Adventure preset, loop mode OFF, no Maze panel — no region has a substrate
 * or a controller, so the bot publishes its own user:locationCheck / user:regionMove, one per tick, and counts only
 * what LANDED (the snapshot's checks, gameState's region). Done = every sphere-log location checked.
 */
async function playbackBotDirectPlayAdventureTest(testController) {
  const loopModeOn = () => centralRegistry.getPublicFunction('loops', 'isLoopModeActive')?.() === true;
  if (loopModeOn()) {
    testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false }, 'tests');
    await testController.pollForCondition(() => !loopModeOn(), 'loop mode off', 5000, 100);
  }
  testController.reportCondition('loop mode is off', !loopModeOn());

  testController.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
  const panel = await testController.pollForValue(() => getActivePanel(), 'playback bot panel instance', 5000, 100);
  const bot = panel?.getBot?.();
  testController.reportCondition('bot reachable', !!bot);
  if (!bot) return testController.getOverallResult();
  bot.reset();

  await testController.loadRulesFromFile(ADVENTURE_RULES);
  const sphereState = getSphereStateSingleton();
  await sphereState.loadSphereLog(ADVENTURE_RULES.replace('_rules.json', '_sphere_log.jsonl'));
  const sphereLocations = (sphereState.getSphereData() ?? []).flatMap((e) => e?.locations ?? []);
  testController.reportCondition('sphere log has locations', sphereLocations.length > 0);
  bot.refresh();

  await bot.instant();
  const finished = await testController.pollForCondition(
    () => (bot.getStatus() || '').startsWith('finished') || /^(error|blocked)/.test(bot.getStatus() || ''),
    'bot reaches a terminal status',
    60000,
    250,
  );
  testController.reportCondition(`bot finished (status: "${bot.getStatus()}")`,
    finished && (bot.getStatus() || '').startsWith('finished'));
  const checked = new Set(testController.stateManager.getLatestStateSnapshot()?.checkedLocations ?? []);
  const missing = sphereLocations.filter((n) => !checked.has(n));
  testController.reportCondition(`every sphere-log location checked (missing: ${missing.slice(0, 5).join(', ') || 'none'})`,
    missing.length === 0);
  if (missing.length) {
    testController.log(`Bot transition log (tail): ${JSON.stringify(bot.getLog?.().slice(-12) ?? [])}`);
  }
  bot.stop();
  return testController.getOverallResult();
}

registerTest({
  id: 'playback-bot-direct-play-adventure',
  name: 'Playback Bot: direct play (Adventure, loop mode off)',
  description:
    'Loads the Adventure preset (no procgen, no substrate) with loop mode off and drives the bot at instant speed: '
    + 'it checks locations and moves through exits itself, and every sphere-log location ends checked.',
  testFunction: playbackBotDirectPlayAdventureTest,
  category: 'Playback Bot',
  enabled: false,
});

/**
 * ⛓ LOOP MODE (loop-mode-bot S3) — ⚖ the first target: the Adventure preset in Loop mode, no procgen features. The
 * row presses the Loops panel's Generate Costs (which enters Loop mode), sets the Loops queue to Instant (⚖ tests
 * may), and presses the bot's Play: the bot plays loop after loop by writing the Loops queue itself — explore loops
 * until its target is found, then a check loop — until every sphere-log location is checked.
 */
async function playbackBotLoopModeAdventureTest(testController) {
  const api = (mod, fn) => centralRegistry.getPublicFunction(mod, fn);
  const loopModeOn = () => api('loops', 'isLoopModeActive')?.() === true;
  if (loopModeOn()) {
    testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false }, 'tests');
    await testController.pollForCondition(() => !loopModeOn(), 'loop mode off before loading', 5000, 100);
  }

  testController.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
  const panel = await testController.pollForValue(() => getActivePanel(), 'playback bot panel instance', 5000, 100);
  const bot = panel?.getBot?.();
  testController.reportCondition('bot reachable', !!bot);
  if (!bot) return testController.getOverallResult();
  bot.reset();

  await testController.loadRulesFromFile(ADVENTURE_RULES);
  const sphereState = getSphereStateSingleton();
  await sphereState.loadSphereLog(ADVENTURE_RULES.replace('_rules.json', '_sphere_log.jsonl'));
  const sphereLocations = (sphereState.getSphereData() ?? []).flatMap((e) => e?.locations ?? []);
  testController.reportCondition('sphere log has locations', sphereLocations.length > 0);
  bot.refresh();

  // Generate Costs, the Loops panel's own button (it enters Loop mode when it is done).
  testController.eventBus.publish('ui:activatePanel', { panelId: 'loopsPanel' });
  const generate = await testController.pollForValue(
    () => document.querySelector('#loop-ui-generate-costs-inline'), 'Generate Costs button', 10000, 100);
  generate?.click();
  const loopState = api('loops', 'getLoopState')?.();
  const ready = await testController.pollForCondition(
    () => loopModeOn() && loopState?.costDataManager?.isLoaded?.() === true,
    'costs generated and loop mode on', 60000, 200);
  testController.reportCondition('Generate Costs entered loop mode with costs', ready);
  if (!ready) return testController.getOverallResult();

  const instantBefore = !!loopState.instantMode;
  loopState.setInstantMode(true);
  try {
    testController.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
    await bot.play();
    const finished = await testController.pollForCondition(
      () => (bot.getStatus() || '').startsWith('finished'),
      'bot finishes in loop mode', 240000, 500);
    const runner = bot.getLoopRunner?.();
    testController.reportCondition(
      `bot finished in loop mode (status: "${bot.getStatus()}", loops: ${runner?.getLoopCount?.() ?? '?'})`, finished);
    const checked = new Set(testController.stateManager.getLatestStateSnapshot()?.checkedLocations ?? []);
    const missing = sphereLocations.filter((n) => !checked.has(n));
    testController.reportCondition(
      `every sphere-log location checked (missing: ${missing.slice(0, 5).join(', ') || 'none'})`, missing.length === 0);
    testController.reportCondition('the bot played more than one loop', (runner?.getLoopCount?.() ?? 0) > 1);
    // The loops the bot planned, for the record (each line is one loop's plan).
    testController.log(`Bot loop log: ${JSON.stringify((bot.getLog?.() ?? []).map((e) => e.text ?? e).slice(-40))}`);
    const gameState = api('gameState', 'getState')?.();
    // Mana spent through the queue earns region XP (1 per mana): the loops were played, not bypassed.
    const xpEarned = [...(gameState?.regionXP?.values?.() ?? [])].some((x) => (x?.xp ?? 0) > 0 || (x?.level ?? 0) > 0);
    testController.reportCondition('the queue spent mana (region XP earned)', xpEarned);
  } finally {
    bot.stop();
    loopState.setInstantMode(instantBefore);
    testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false }, 'tests');
  }
  return testController.getOverallResult();
}

registerTest({
  id: 'playback-bot-loop-mode-adventure',
  name: 'Playback Bot: Loop mode (Adventure, Generate Costs, Instant)',
  description:
    'Loads Adventure, presses Generate Costs (enters Loop mode), sets the Loops queue to Instant and presses the '
    + 'bot\'s Play: the bot writes the Loops queue one loop at a time until every sphere-log location is checked.',
  testFunction: playbackBotLoopModeAdventureTest,
  category: 'Playback Bot',
  enabled: false,
});

/**
 * ⛓ SUBSTRATE REGIONS IN LOOP MODE (loop-mode-bot S4) — ⚖ first target: a procgen MAZE world in Loop mode. The row
 * generates a small all-open maze-only world with loop mode ON (loop_costs + manaEnabled → maze delegation), loads
 * its embedded sphere log, sets the Loops queue to Instant and presses the bot's Play. The runner sets each maze
 * block to Bot, so Loops' own maze delegation plays the queue's entries; done = every sphere-log location checked.
 */
async function playbackBotLoopModeMazeTest(testController) {
  return playbackBotLoopModeWorld(testController, {
    quotas: { maze: 4 }, start: 'maze', seed: 7, solvers: ['delegation'], watchPanel: 'mazeRoomPanel',
    itemPool: { victory: 1, key_red: 1, key_green: 1 },
  });
}

/**
 * ⛓ loop-mode-bot S5 — a MIXED world in Loop mode: maze (Bot / delegation), text adventure (coarse → Playback) and
 * bounce (Bot / walkTo). Same contract as the maze row: every sphere-log location checked by the queue.
 */
async function playbackBotLoopModeMixedTest(testController) {
  return playbackBotLoopModeWorld(testController, {
    quotas: { maze: 2, text_adventure: 2, bounce: 1 }, start: 'maze', seed: 11, solvers: null, watchPanel: null,
    itemPool: { victory: 1, key_red: 1, key_green: 1, key_blue: 1 },
  });
}

/**
 * ⛓ loop-mode-bot S6 — JtA zones in Loop mode. JtA's queue takes moves only, so a target there is a PASS (⚖ the
 * zone's own automation takes the check on the way). The row turns JtA zone locations ON for its world and back.
 */
async function playbackBotLoopModeJtaTest(testController) {
  const before = getJtaEmitZoneLocations();
  setJtaEmitZoneLocations(true);
  try {
    return await playbackBotLoopModeWorld(testController, {
      quotas: { jta: 2, maze: 1 }, start: 'maze', seed: 5, solvers: null, watchPanel: null,
      itemPool: { victory: 1, key_red: 1 },
    });
  } finally {
    setJtaEmitZoneLocations(before);
  }
}

/**
 * ⛓ jta-loop-mode — a JtA-only world whose loops START in a JtA zone (the tutorial's shape): three zones, so a hidden
 * task a Boss unlocks (zone 2's Save the Village) is among the targets. Each loop's walk starts in the region already loaded (no loadRegion
 * resumes the clock), a loop that ends with its queue resets the run, and a task unlocked mid-game joins the zone's
 * automation priorities — without any one of them the bot never finishes (jta-loop-mode A–C, 2026-10-12).
 */
async function playbackBotLoopModeJtaStartTest(testController) {
  const before = getJtaEmitZoneLocations();
  setJtaEmitZoneLocations(true);
  try {
    return await playbackBotLoopModeWorld(testController, {
      quotas: { jta: 3 }, start: 'jta', seed: 3, solvers: null, watchPanel: null,
      itemPool: { victory: 1 }, budgetMs: 180000,
    });
  } finally {
    setJtaEmitZoneLocations(before);
  }
}

async function playbackBotLoopModeWorld(testController, { quotas, start, seed, solvers, watchPanel, itemPool, budgetMs = 120000 }) {
  const api = (mod, fn) => centralRegistry.getPublicFunction(mod, fn);
  const loopModeOn = () => api('loops', 'isLoopModeActive')?.() === true;
  testController.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
  const panel = await testController.pollForValue(() => getActivePanel(), 'playback bot panel instance', 5000, 100);
  const bot = panel?.getBot?.();
  testController.reportCondition('bot reachable', !!bot);
  if (!bot) return testController.getOverallResult();
  bot.reset();

  const { grid, startCell, stats } = arrangeShuffledSpiral({
    regionSize: { width: 7, height: 7 },
    itemPool,
    obstaclePool: {},
    seed,
    regionParams: {},
    growthParams: { substrateQuotas: quotas, maxItemsPerRegion: 2, startSubstrate: start },
    hazardOpts: {},
  });
  const rulesJson = buildRulesJson(grid, {
    startCell, seed, enableLoopMode: true, regionXpEffect: 'cost', completionConditionItem: 'victory',
    procgenMetadata: { driver: 'playback-bot-loop-mode-maze', stop_reason: stats.stopReason },
  });
  const loaded = testController.waitForEvent('stateManager:rulesLoaded', 8000);
  testController.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: 'playbackBotLoopModeMaze' });
  await loaded;
  await testController.stateManager.pingWorker('after-rules-load', 3000);
  const sphereState = getSphereStateSingleton();
  await sphereState.loadSphereLog('embedded:playbackBotLoopModeMaze',
    (rulesJson.sphere_log ?? []).map((e) => JSON.stringify(e)).join('\n'));
  const sphereLocations = (sphereState.getSphereData() ?? []).flatMap((e) => e?.locations ?? []);
  testController.reportCondition(`sphere log has locations (${sphereLocations.length})`, sphereLocations.length > 0);
  const on = await testController.pollForCondition(loopModeOn, 'loop mode on (auto-enabled by loop_costs)', 8000, 100);
  testController.reportCondition('loop mode on (auto-enabled by loop_costs)', on);
  const loopState = api('loops', 'getLoopState')?.();
  const regions = Object.keys(rulesJson.preset_sidecars?.['1'] ?? {});
  const how = regions.map((r) => `${r}:${rulesJson.preset_sidecars['1'][r].substrate}/${loopState?.getRegionCaptureShape?.(r)}/${loopState?.regionSolver?.(r)}`);
  testController.log(`regions: ${how.join(', ')}`);
  if (solvers) {
    testController.reportCondition(`every region has a ${solvers.join('/')} Bot solver (${how.join(', ')})`,
      regions.length > 0 && regions.every((r) => solvers.includes(loopState?.regionSolver?.(r))));
  }
  if (!on || !loopState) return testController.getOverallResult();
  bot.refresh();

  const instantBefore = !!loopState.instantMode;
  loopState.setInstantMode(true);
  try {
    if (watchPanel) testController.eventBus.publish('ui:activatePanel', { panelId: watchPanel });
    testController.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
    const trace = [];
    const onRC = (d) => trace.push(`RC ${d?.oldRegion}->${d?.newRegion}${d?.fromReset ? ' reset' : ''}${d?.exitName ? ` via ${d.exitName}` : ''}`);
    const onAC = (d) => trace.push(`AC ${d?.action?.type}${d?.action?.actionName ? `:${d.action.actionName}` : ''} ${d?.action?.sourceRegion}${d?.action?.destinationRegion ? `->${d.action.destinationRegion}` : ''}`);
    testController.eventBus.subscribe('gameState:regionChanged', onRC, 'tests');
    testController.eventBus.subscribe('loopState:actionCompleted', onAC, 'tests');
    trace.push(`start=${api('loops', 'getLoopStartRegion')?.()} here=${api('gameState', 'getCurrentRegion')?.()}`);
    await bot.play();
    const finished = await testController.pollForCondition(
      () => (bot.getStatus() || '').startsWith('finished'), 'bot finishes the world in loop mode', budgetMs, 500);
    testController.eventBus.unsubscribe('gameState:regionChanged', onRC, 'tests');
    testController.eventBus.unsubscribe('loopState:actionCompleted', onAC, 'tests');
    if (!finished) testController.log(`TRACE ${JSON.stringify(trace.slice(0, 60))}`);
    if (!finished) {
      const maze = getMazePanel();
      const cur = loopState.currentAction;
      testController.log(`DIAG maze panel: ${maze ? 'mounted' : 'none'} region=${maze?.currentRegionId ?? '-'} `
        + `loopsDriven=${JSON.stringify(maze?._loopsDrivenAction ?? null)}; loops: processing=${loopState.isProcessing} `
        + `paused=${loopState.isPaused} index=${loopState.currentActionIndex} current=${JSON.stringify(cur ? { type: cur.type, actionName: cur.actionName, region: cur.sourceRegion } : null)} `
        + `delegated=${!!loopState._delegatedAction} bot=${!!loopState._botExecutedAction} manual=${!!loopState._manualActionEntered} `
        + `mana=${api('gameState', 'getCurrentMana')?.()} here=${api('gameState', 'getCurrentRegion')?.()} `
        + `mode=${loopState.getBlockMode?.(cur?.sourceRegion, cur?.instanceNumber)}`);
    }
    if (!finished) {
      try {
        const { getJtaIframe } = await import('../../jtaSubstrateWrapper/test-helpers.js');
        const w = getJtaIframe()?.contentWindow;
        const fs = w?.getFullState?.();
        const qc = w?.getQueueConfigs?.();
        testController.log(`DIAG jta: paused=${w?.isGameLoopPaused?.()} auto=${w?.getAutomationMode?.()} instant=${w?.isInstantMode?.()} `
          + `energy=${fs?.currentEnergy}/${fs?.maxEnergy} latch=${fs?.isInEnergyReset} resets=${fs?.energyResetCount} zone=${fs?.currentZone} `
          + `active=${fs?.activeTaskId} perks=${JSON.stringify(fs?.perks)} tasks=${JSON.stringify(fs?.tasks)} `
          + `prios=${JSON.stringify(qc)?.slice(0, 1500)}`);
      } catch (e) { testController.log(`DIAG jta failed: ${e}`); }
    }
    const runner = bot.getLoopRunner?.();
    testController.reportCondition(
      `bot finished (status: "${bot.getStatus()}", loops: ${runner?.getLoopCount?.() ?? '?'})`, finished);
    const checked = new Set(testController.stateManager.getLatestStateSnapshot()?.checkedLocations ?? []);
    const missing = sphereLocations.filter((n) => !checked.has(n));
    testController.reportCondition(
      `every sphere-log location checked (missing: ${missing.slice(0, 5).join(', ') || 'none'})`, missing.length === 0);
    testController.log(`Bot loop log: ${JSON.stringify((bot.getLog?.() ?? []).map((e) => e.text ?? e).slice(-40))}`);
    if (missing.length) {
      const disc = (await import('../../discovery/singleton.js')).default;
      testController.log(`DIAG discovery: locations ${JSON.stringify([...(disc.getDiscoveredLocations?.() ?? [])])} `
        + `exits ${JSON.stringify([...(disc.getDiscoveredExits?.() ?? [])].map((e) => (Array.isArray(e) ? [e[0], [...e[1]]] : e)))}`);
    }
  } finally {
    bot.stop();
    loopState.setInstantMode(instantBefore);
    testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false }, 'tests');
  }
  return testController.getOverallResult();
}

registerTest({
  id: 'playback-bot-loop-mode-maze',
  name: 'Playback Bot: Loop mode on a procgen maze world (Bot blocks)',
  description:
    'Generates a small maze-only world with loop mode on, sets the Loops queue to Instant and presses the bot\'s '
    + 'Play: the runner sets each maze block to Bot and Loops\' maze delegation plays the queue until every '
    + 'sphere-log location is checked.',
  testFunction: playbackBotLoopModeMazeTest,
  category: 'Playback Bot',
  enabled: false,
});

registerTest({
  id: 'playback-bot-loop-mode-mixed',
  name: 'Playback Bot: Loop mode on a mixed procgen world (maze, text adventure, bounce)',
  description:
    'Generates a small loop-mode world of maze, text adventure and bounce regions and presses the bot\'s Play: '
    + 'the runner gives each block the mode that lets the queue play it, until every sphere-log location is checked.',
  testFunction: playbackBotLoopModeMixedTest,
  category: 'Playback Bot',
  enabled: false,
});

registerTest({
  id: 'playback-bot-loop-mode-jta',
  name: 'Playback Bot: Loop mode with JtA zones (pass-through loops)',
  description:
    'Generates a small loop-mode world with JtA zones (locations on) and a maze region and presses the bot\'s Play: '
    + 'a target in a JtA zone is a pass-through loop whose Bot walk lets the zone\'s automation take the check.',
  testFunction: playbackBotLoopModeJtaTest,
  category: 'Playback Bot',
  enabled: false,
});

registerTest({
  id: 'playback-bot-loop-mode-jta-start',
  name: 'Playback Bot: Loop mode in a JtA-only world that starts in a JtA zone',
  description:
    'Generates a three-zone JtA world whose loops start in a JtA zone and presses the bot\'s Play: each loop is a '
    + 'pass-through whose Bot walk plays the zone, until every sphere-log location is checked.',
  testFunction: playbackBotLoopModeJtaStartTest,
  category: 'Playback Bot',
  enabled: false,
});
