// Scenario tests for the playback bot. See ../README.md for the discipline.
//
// Calibration target: prove the in-app harness can drive the playback bot
// end-to-end against a real preset. If these pass, the same pattern extends
// to scenario tests for maze / text-adventure / jta substrate behaviour
// (with the bot as the deterministic driver).

import { registerTest } from '../testRegistry.js';
import { getActivePanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';

const APCALC_RULES = './presets/apcalc/AP_14089154938208861744/AP_14089154938208861744_rules.json';
// Tiny procgen+maze preset (4 regions, 3 locations) — picked specifically
// because (a) it uses the maze substrate so the bot has a controller to
// dispatch to and (b) it's small enough to drain to completion fast.
const PROCGEN_MAZE_RULES =
  './presets/procgen_maze_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json';

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
 * speed and verify it reaches the "finished" status. This exercises the
 * bot → substrateRegistry → maze controller → state mutation chain.
 *
 * Status: currently times out at "Sphere 0.1 → waiting for region (1/3)".
 * The bot picks up the sphere queue but the procgen player doesn't route
 * through the maze automatically the way the live UI does — there's some
 * activation step (probably surfaced by a user click in the procgenPlayer
 * or loops panel) that this test doesn't reproduce. Disabled in
 * playwright_tests_config-playback.json pending investigation; the
 * partial test is kept here as a starting point for whoever picks it up.
 */
async function playbackBotInstantPlaybackTest(testController) {
  testController.log('Loading procgen_maze_worldgen rules + sphere log...');
  await testController.loadRulesFromFile(PROCGEN_MAZE_RULES);
  const sphereState = getSphereStateSingleton();
  await sphereState.loadSphereLog(
    PROCGEN_MAZE_RULES.replace('_rules.json', '_sphere_log.jsonl')
  );
  const sphereQueueLen = sphereState.getSphereData()?.length ?? 0;
  testController.reportCondition('sphere data non-empty', sphereQueueLen > 0);

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

  // refresh() picks up the newly-loaded sphere data so the bot's status
  // line reflects the queue (helpful for diagnostic logs on failure).
  bot.refresh();

  testController.log(`Bot status before instant(): "${bot.getStatus()}"`);
  await bot.instant();

  // Poll until the bot reaches a terminal state. "finished — N location(s)
  // visited" is the success signal (set in playbackBotUI.js around line 618).
  // 20s timeout is generous — the preset has 3 locations.
  const finished = await testController.pollForCondition(
    () => (bot.getStatus() || '').startsWith('finished'),
    'bot reaches finished status',
    20000,
    250
  );
  testController.reportCondition('bot drained queue to completion', finished);
  testController.log(`Bot final status: "${bot.getStatus()}"`);

  return testController.getOverallResult();
}

registerTest({
  id: 'playback-bot-instant-completion',
  name: 'Playback Bot: instant-mode completion',
  description:
    'Drives the bot at instant speed through procgen_maze_worldgen '
    + '(4 regions, 3 locations) and asserts it reaches the "finished" '
    + 'status. Exercises the bot → substrate-controller dispatch chain.',
  testFunction: playbackBotInstantPlaybackTest,
  category: 'Playback Bot',
  enabled: false,
});
