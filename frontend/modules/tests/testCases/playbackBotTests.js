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
