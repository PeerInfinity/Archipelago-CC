// Discovery mode × Loop mode × a world's `discovery_mode` block — in-app rows.
//
// Each row SETS its own starting state: the persisted
// `moduleSettings.discovery.enableDiscoveryMode` (restored after) and the world
// it loads (built here with buildRulesJson and published the way the Procgen
// Pipeline's "Load into frontend" does). The table being held is
// discovery/worldDiscoveryMode.js's.
import { registerTest } from '../testRegistry.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import settingsManager from '../../../app/core/settingsManager.js';
import { arrangeShuffledSpiral, buildRulesJson } from '../../procgenPipeline/procgenPipelineEngine.js';
import discoveryStateSingleton from '../../discovery/singleton.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import {
  LOOP_MODE_OVERRIDES,
  OVERRIDE_KEYS,
  WALK_TO_REVEAL_OVERRIDES,
} from '../../discovery/worldDiscoveryMode.js';

const PREFIX = 'moduleSettings.discovery.';
const api = (mod, fn) => centralRegistry.getPublicFunction(mod, fn);
const loopModeOn = () => api('loops', 'isLoopModeActive')?.() === true;

/** The discovery keys currently held as session overrides, unprefixed. */
function sessionOverrides() {
  const out = {};
  for (const key of OVERRIDE_KEYS) {
    if (settingsManager._overrides.has(`${PREFIX}${key}`)) out[key] = settingsManager._overrides.get(`${PREFIX}${key}`);
  }
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A small maze-only world; `discoveryMode` omitted = no block (the default). */
function mazeWorld({ enableLoopMode, discoveryMode }) {
  const { grid, startCell, stats } = arrangeShuffledSpiral({
    regionSize: { width: 7, height: 7 },
    itemPool: { victory: 1 },
    obstaclePool: {},
    seed: 5,
    regionParams: {},
    growthParams: { substrateQuotas: { maze: 3 }, maxItemsPerRegion: 2, startSubstrate: 'maze' },
    hazardOpts: {},
  });
  return buildRulesJson(grid, {
    startCell, seed: 5, enableLoopMode, regionXpEffect: 'cost', completionConditionItem: 'victory',
    ...(discoveryMode ? { discoveryMode } : {}),
    procgenMetadata: { driver: 'discovery-mode-tests', stop_reason: stats.stopReason },
  });
}

async function loadWorld(testController, rulesJson, label) {
  const loaded = testController.waitForEvent('stateManager:rulesLoaded', 10000);
  testController.eventBus.publish('files:jsonLoaded', { jsonData: rulesJson, selectedPlayerId: '1', sourceName: label }, 'tests');
  await loaded;
  await testController.stateManager.pingWorker(`after-${label}`, 3000);
}

async function expectOverrides(testController, expected, what) {
  const ok = await testController.pollForCondition(() => same(sessionOverrides(), expected), what, 8000, 100);
  testController.reportCondition(`${what} (held: ${JSON.stringify(sessionOverrides())})`, ok);
  return ok;
}

/** Run `body` with the persisted discovery flag set to `persisted`, restoring it after. */
async function withPersistedDiscovery(testController, persisted, body) {
  const key = `${PREFIX}enableDiscoveryMode`;
  const before = settingsManager.settings?.moduleSettings?.discovery?.enableDiscoveryMode;
  await settingsManager.updateSetting(key, persisted);
  try {
    return await body();
  } finally {
    if (loopModeOn()) testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false, auto: true }, 'tests');
    await testController.pollForCondition(() => !loopModeOn(), 'loop mode off (cleanup)', 5000, 100);
    await loadWorld(testController, mazeWorld({ enableLoopMode: false }), 'discoveryModeCleanup');
    await settingsManager.updateSetting(key, before ?? false);
  }
}

/**
 * (a) of the user's condition: at the default (no block), a loop world gets
 * EXACTLY the eight session-only overrides Loop mode has always forced, the
 * persisted value is untouched, and leaving loop mode clears all eight. Then
 * B1: a world without loop_costs loaded over a loop world leaves no override.
 */
async function defaultLoopOverrideUnchanged(testController) {
  return withPersistedDiscovery(testController, false, async () => {
    await loadWorld(testController, mazeWorld({ enableLoopMode: true }), 'discoveryDefaultLoop');
    testController.reportCondition('the world carries no discovery_mode block', true);
    const on = await testController.pollForCondition(loopModeOn, 'loop mode on (auto-enabled by loop_costs)', 8000, 100);
    testController.reportCondition('loop mode on (auto-enabled by loop_costs)', on);
    await expectOverrides(testController, { ...LOOP_MODE_OVERRIDES }, 'the eight loop-mode overrides, exactly');
    testController.reportCondition('persisted enableDiscoveryMode is untouched (false)',
      settingsManager.settings?.moduleSettings?.discovery?.enableDiscoveryMode === false);
    testController.reportCondition('effective enableDiscoveryMode is true',
      (await settingsManager.getSetting(`${PREFIX}enableDiscoveryMode`, false)) === true);

    testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false }, 'tests');
    const off = await testController.pollForCondition(() => !loopModeOn(), 'loop mode off', 5000, 100);
    testController.reportCondition('loop mode off after an explicit disable', off);
    await expectOverrides(testController, {}, 'leaving loop mode clears all eight');

    // B1 — in memory: loop world, then a world without loop_costs over it.
    await loadWorld(testController, mazeWorld({ enableLoopMode: true }), 'discoveryDefaultLoop2');
    await testController.pollForCondition(loopModeOn, 'loop mode on again', 8000, 100);
    await loadWorld(testController, mazeWorld({ enableLoopMode: false }), 'discoveryDefaultPlain');
    const autoOff = await testController.pollForCondition(() => !loopModeOn(), 'loop mode auto-off', 8000, 100);
    testController.reportCondition('loop mode auto-disabled for the world without loop_costs', autoOff);
    await expectOverrides(testController, {}, 'B1: no override survives into the world without loop_costs');
    testController.reportCondition('effective enableDiscoveryMode is the persisted false',
      (await settingsManager.getSetting(`${PREFIX}enableDiscoveryMode`, true)) === false);
    return testController.getOverallResult();
  });
}

/** A world with discovery OFF in loop mode: no discovery, everything discovered. */
async function worldOffInLoopMode(testController) {
  return withPersistedDiscovery(testController, true, async () => {
    await loadWorld(testController, mazeWorld({ enableLoopMode: true, discoveryMode: 'off' }), 'discoveryOffLoop');
    const on = await testController.pollForCondition(loopModeOn, 'loop mode on', 8000, 100);
    testController.reportCondition('loop mode on', on);
    await expectOverrides(testController, { enableDiscoveryMode: false }, 'only enableDiscoveryMode, forced false');
    testController.reportCondition('effective enableDiscoveryMode is false (over a persisted true)',
      (await settingsManager.getSetting(`${PREFIX}enableDiscoveryMode`, true)) === false);
    const regions = [...(testController.stateManager.getStaticData()?.regions?.keys() ?? [])];
    const allFound = await testController.pollForCondition(
      () => regions.length > 0 && regions.every((r) => discoveryStateSingleton.isRegionDiscovered(r)),
      'every region discovered', 5000, 100);
    testController.reportCondition(`every region counts as discovered (${regions.length})`, allFound);
    return testController.getOverallResult();
  });
}

/** A world with discovery ON in loop mode: exactly the default loop bundle. */
async function worldOnInLoopMode(testController) {
  return withPersistedDiscovery(testController, false, async () => {
    await loadWorld(testController, mazeWorld({ enableLoopMode: true, discoveryMode: 'on' }), 'discoveryOnLoop');
    const on = await testController.pollForCondition(loopModeOn, 'loop mode on', 8000, 100);
    testController.reportCondition('loop mode on', on);
    await expectOverrides(testController, { ...LOOP_MODE_OVERRIDES }, 'the loop-mode bundle');
    testController.eventBus.publish('loops:setLoopMode', { action: 'disable', activatePanel: false }, 'tests');
    await testController.pollForCondition(() => !loopModeOn(), 'loop mode off', 5000, 100);
    await expectOverrides(testController, { ...WALK_TO_REVEAL_OVERRIDES }, 'leaving loop mode → walk-to-reveal (the world says on)');
    return testController.getOverallResult();
  });
}

/** Click an exit through the Exits dispatcher; true if the player moved. */
async function clickExitMoves(testController, sourceRegion, exit) {
  const gs = getGameStateSingleton();
  const { getExitsModuleDispatcher } = await import('../../exits/index.js');
  const dispatcher = getExitsModuleDispatcher();
  if (!dispatcher) return null;
  dispatcher.publish('user:exitClicked', {
    exitName: exit.name, sourceRegion, destinationRegion: exit.connected_region, accessRule: exit.access_rule,
    isDiscovered: discoveryStateSingleton.isExitDiscovered(sourceRegion, exit.name),
  });
  return testController.pollForCondition(() => gs.currentRegion === exit.connected_region,
    `moved to ${exit.connected_region}`, 3000, 100);
}

/** The player's region and one of its exits into a region reachable now. */
function startExit(testController) {
  const gs = getGameStateSingleton();
  const from = gs?.currentRegion;
  const exits = testController.stateManager.getStaticData()?.regions?.get(from)?.exits ?? [];
  const reach = testController.stateManager.getSnapshot()?.regionReachability ?? {};
  const ok = (r) => reach[r] === true || reach[r] === 'reachable' || reach[r] === 'checked';
  const exit = exits.find((e) => e.connected_region && e.connected_region !== from && ok(e.connected_region)) ?? null;
  if (!exit) {
    testController.log(`exits of ${from}: ${JSON.stringify(exits.map((e) => [e.name, e.connected_region, reach[e.connected_region]]))}`);
  }
  return { from, exit };
}

/**
 * A world with discovery ON and no loop mode: walk-to-reveal, and a click on
 * a discovered exit MOVES (B2). Then the scope: the same click on a world with
 * NO block and discovery switched on by hand still only discovers.
 */
async function worldOnWithoutLoops(testController) {
  return withPersistedDiscovery(testController, false, async () => {
    await loadWorld(testController, mazeWorld({ enableLoopMode: false, discoveryMode: 'on' }), 'discoveryOnPlain');
    testController.reportCondition('loop mode stays off', !loopModeOn());
    await expectOverrides(testController, { ...WALK_TO_REVEAL_OVERRIDES }, 'the walk-to-reveal bundle');

    const { from, exit } = startExit(testController);
    testController.reportCondition(`an exit from the start region into a reachable region (${from} → ${exit?.connected_region})`, !!exit);
    if (!exit) return testController.getOverallResult();
    testController.reportCondition('that exit is discovered (start-region exits are)',
      discoveryStateSingleton.isExitDiscovered(from, exit.name));
    const moved = await clickExitMoves(testController, from, exit);
    testController.reportCondition('B2: clicking the discovered exit moves the player', moved === true);
    const arrived = exit.connected_region;
    const revealed = await testController.pollForCondition(
      () => discoveryStateSingleton.isRegionDiscovered(arrived), `${arrived} discovered on enter`, 3000, 100);
    testController.reportCondition('walking in reveals the region', revealed);

    // Scope: no block, discovery on by hand → the click still only discovers.
    await loadWorld(testController, mazeWorld({ enableLoopMode: false }), 'discoveryHandPlain');
    await expectOverrides(testController, {}, 'a world without the block forces nothing');
    await settingsManager.updateSetting(`${PREFIX}enableDiscoveryMode`, true);
    const second = startExit(testController);
    const movedByHand = second.exit ? await clickExitMoves(testController, second.from, second.exit) : null;
    testController.reportCondition('hand-enabled discovery: the click does NOT move (unchanged)', movedByHand === false);
    return testController.getOverallResult();
  });
}

const ROWS = [
  ['discovery-default-loop-override-unchanged', 'Discovery: default world in loop mode — the eight overrides exactly as before; B1 leak fixed', defaultLoopOverrideUnchanged,
    'Loads a loop world with NO discovery_mode block and asserts the eight session-only overrides and their values, that the persisted value is untouched, that leaving loop mode clears all eight, and that a world without loop_costs loaded over a loop world leaves none behind'],
  ['discovery-world-off-in-loop-mode', 'Discovery: a world with discovery OFF in loop mode', worldOffInLoopMode,
    'Loop world with discovery_mode enabled:false over a persisted true: only enableDiscoveryMode is overridden, to false, and every region counts as discovered'],
  ['discovery-world-on-in-loop-mode', 'Discovery: a world with discovery ON in loop mode', worldOnInLoopMode,
    'Loop world with discovery_mode enabled:true: the loop-mode bundle; leaving loop mode switches to walk-to-reveal'],
  ['discovery-world-on-without-loops', 'Discovery: a world with discovery ON without loop mode (walk-to-reveal, B2)', worldOnWithoutLoops,
    'No loop costs, discovery_mode enabled:true: the walk-to-reveal bundle, a click on a discovered exit moves and reveals; a world without the block and hand-enabled discovery still only discovers'],
];

for (const [id, name, testFunction, description] of ROWS) {
  registerTest({ id, name, description, category: 'discoveryMode', testFunction });
}
