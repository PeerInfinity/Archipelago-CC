/**
 * In-app tests for the Rule Converter's Exact (Pyodide) engine.
 *
 * The row SETS the state it expects and cleans up after itself: it loads its
 * own preset, enables the panel through the module manager (the panel is
 * disabled by default) and disables it again if it found it disabled.
 */

import { registerTest } from '../testRegistry.js';

const CATEGORY = 'Rule Converter';
const MODULE_ID = 'ruleConverter';
const PANEL_SELECTOR = '.rule-converter-panel';
/** A worldgen preset whose `helpers` carry options (swordless, retro_bow…). */
const PRESET_PATH = './presets/alttp_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/** Pyodide boots from the CDN on the first conversion. */
const CONVERT_TIMEOUT_MS = 120000;
const POLL_MS = 100;

const SCRIPT = `def has_light(state, player):
    return state.has("Lantern", player) or state.has("Torch", player)


def can_enter_cave(state, player, keys=2):
    return has_light(state, player) and state.has("Cave Key", player, keys)


def not_a_helper(x):
    return x
`;

/** Deep equality of two JSON values, key order ignored (Python's ==). */
function sameJson(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every(k => Object.prototype.hasOwnProperty.call(b, k) && sameJson(a[k], b[k]));
}

/**
 * Press a Convert button and wait for the conversion it started to finish.
 * Returns false when it did not finish in time.
 *
 * ⛔ Waits on the panel's finished-conversion count, not on `isConverting`
 * going true then false: a warm conversion can finish inside one busy
 * main-thread gap, before a poll's first check ever sees it running.
 */
async function pressConvert(testController, panel, button, label) {
    const before = panel.exactRuns;
    button.click();
    return testController.pollForCondition(
        () => panel.exactRuns > before && !panel.isConverting, `${label} finished`, CONVERT_TIMEOUT_MS, POLL_MS);
}

function parsePane(editor) {
    try {
        return JSON.parse(editor.value);
    } catch {
        return null;
    }
}

/**
 * ⛓⛓ **EXACT MODE — THE REAL EXPORTER, IN THE PAGE, BOTH WAYS.** Switches the
 * Rule Converter to Exact through its engine select, converts a script of
 * helper functions with the Convert buttons (Pyodide boots from the CDN on
 * the first press; the exporter analyzer and world_generator run in a
 * worker), and checks:
 *   - calls between the script's functions stay `{"type": "helper"}` refs,
 *     params/defaults are kept, a non-helper function is named in warnings;
 *   - script → helpers → Python → helpers is unchanged;
 *   - with "Use loaded game's options", the loaded alttp_worldgen preset's own
 *     36 helpers survive helpers → Python → helpers unchanged (options stay
 *     options).
 */
export async function ruleConverterExactModeRoundTrips(testController) {
    const states = window.moduleManagerApi?.getAllModuleStates?.() ?? {};
    const wasEnabled = states[MODULE_ID]?.enabled === true;
    try {
        // Panel FIRST, then the preset: the panel takes the loaded document
        // from stateManager:rawJsonDataLoaded, and loadRulesFromFile (a load
        // straight through the proxy) publishes that event without moving
        // getLastRawJsonData(), the panel's catch-up for loads before it mounted.
        await window.moduleManagerApi.enableModule(MODULE_ID);
        const panel = await testController.pollForValue(
            () => document.querySelector(PANEL_SELECTOR)?.__panel ?? null,
            'the Rule Converter panel', 15000, 50);
        testController.reportCondition('the Rule Converter panel is open', !!panel);
        if (!panel) return testController.getOverallResult();

        testController.log(`Loading ${PRESET_PATH}…`);
        await testController.loadRulesFromFile(PRESET_PATH);
        await testController.stateManager.pingWorker('after-rules-load', 15000);

        // The preset the row loaded is the one the panel will read options from.
        const payload = panel.lastRawPayload;
        const presetHelpers = payload?.rawJsonData?.helpers?.['1'];
        testController.reportCondition('the panel saw the loaded preset (alttp_worldgen helpers)',
            String(payload?.rawJsonData?.game_name ?? '').includes('WorldGen')
                && presetHelpers && Object.keys(presetHelpers).length > 0);

        // Exact, through the real control.
        panel.engineSelect.value = 'exact';
        panel.engineSelect.dispatchEvent(new Event('change'));
        testController.assertEqual('the engine is Exact', 'exact', panel.engine);
        testController.reportCondition('Exact hides Format and shows the Convert buttons',
            panel.formatLabel.style.display === 'none'
                && panel.convertPythonButton.style.display !== 'none'
                && panel.convertJsonButton.style.display !== 'none');

        // 1. Script → helpers.
        panel.pythonEditor.value = SCRIPT;
        panel.pythonEditor.dispatchEvent(new Event('input'));
        testController.reportCondition('typing in Exact does not convert by itself', !panel.isConverting);
        const toHelpers = await pressConvert(testController, panel, panel.convertPythonButton, 'Python → helpers');
        testController.reportCondition('Python → helpers finished', toHelpers);
        testController.log(`status: ${panel.statusMessage.textContent} (${panel.timing.textContent})`);
        const helpers = parsePane(panel.jsonEditor);
        testController.reportCondition('the JSON pane holds the two helpers',
            sameJson(Object.keys(helpers ?? {}), ['has_light', 'can_enter_cave']));
        testController.reportCondition('has_light is an or of two item checks', sameJson(helpers?.has_light, {
            type: 'or',
            conditions: [{ type: 'item_check', item: 'Lantern' }, { type: 'item_check', item: 'Torch' }],
        }));
        const cave = helpers?.can_enter_cave;
        testController.reportCondition('can_enter_cave keeps its param and default',
            sameJson(cave?.params, ['keys']) && sameJson(cave?.defaults, { keys: 2 }));
        testController.reportCondition('…and calls has_light as a helper reference',
            sameJson(cave?.body?.conditions?.[0], { type: 'helper', name: 'has_light' }));
        testController.reportCondition('the non-helper function is named in the warnings',
            panel.warningsList.textContent.includes('not_a_helper'));
        testController.reportCondition('no error panel', panel.errorPanel.style.display === 'none');

        // 2. → Python → helpers, unchanged.
        const toPython = await pressConvert(testController, panel, panel.convertJsonButton, 'helpers → Python');
        testController.reportCondition('helpers → Python finished', toPython);
        testController.reportCondition('the Python pane holds both functions',
            panel.pythonEditor.value.includes('def has_light(')
                && panel.pythonEditor.value.includes('def can_enter_cave('));
        const again = await pressConvert(testController, panel, panel.convertPythonButton, 'Python → helpers (again)');
        testController.reportCondition('the script round-trips unchanged',
            again && sameJson(parsePane(panel.jsonEditor), helpers));

        // 3. The loaded preset's helpers, with its options.
        if (presetHelpers) {
            panel.useGameOptions.checked = true;
            panel.jsonEditor.value = JSON.stringify(presetHelpers, null, 2);
            panel.jsonEditor.dispatchEvent(new Event('input'));
            const presetToPython = await pressConvert(testController, panel, panel.convertJsonButton,
                'preset helpers → Python');
            const presetBack = presetToPython
                && await pressConvert(testController, panel, panel.convertPythonButton, 'preset Python → helpers');
            const back = parsePane(panel.jsonEditor) ?? {};
            const names = Object.keys(presetHelpers);
            const differ = names.filter(n => !sameJson(back[n], presetHelpers[n]));
            testController.log(`preset: ${names.length - differ.length}/${names.length} identical`
                + (differ.length ? `; differ: ${differ.slice(0, 5).join(', ')}` : ''));
            testController.reportCondition('the preset helpers round-trip unchanged (options stay options)',
                !!presetBack && differ.length === 0 && Object.keys(back).length === names.length);
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('rule converter Exact test error-free', false);
    } finally {
        if (!wasEnabled) await window.moduleManagerApi?.disableModule?.(MODULE_ID);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'rule-converter-exact-mode-round-trips',
    name: 'Rule Converter: Exact mode converts helper scripts both ways with the real exporter',
    description: 'Boots Pyodide (CDN), converts a script of helper functions to a helpers dict and back '
               + 'through the Convert buttons, and round-trips the loaded alttp_worldgen preset\'s helpers '
               + 'with its option definitions.',
    testFunction: ruleConverterExactModeRoundTrips,
    category: CATEGORY,
    enabled: false, // off by default — runs only in the test-substrates mode
});
