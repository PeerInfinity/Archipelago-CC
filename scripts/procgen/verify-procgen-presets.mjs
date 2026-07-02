/**
 * In-app smoke test for the Procgen Pipeline panel's preset drop-down
 * (presetDefs.js + _renderPresetBar). verify-sphere-growth-ui.mjs is
 * the template.
 *
 *   1. Pre-seed the panel with a DIRTY setup (gridGrowth, seed 5, no
 *      quotas) so applying a preset visibly changes everything.
 *   2. Assert the drop-down renders at the top with Custom + the two
 *      shipped presets, booting on Custom.
 *   3. Select the runner demo preset and assert the panel state it
 *      populates — mode, seed input, and the persisted bundle
 *      (params incl. the runner* keys, quotas, scenario pool,
 *      activePresetId).
 *   4. Run the full sphere pipeline from that preset and assert the
 *      oracle success message ("Sphere plan realised") — the same
 *      config as the committed runner_sphere_worldgen fixture.
 *   5. Edit a param → the drop-down flips back to Custom.
 *   6. Save a user preset (prompt dialog), reload the page, assert the
 *      selection + params survived, then delete it (confirm dialog).
 *
 * Requires the dev server on :8000. Run:
 *   node scripts/procgen/verify-procgen-presets.mjs
 */

import { chromium } from 'playwright';

const RUNNER_PRESET_ID = 'shipped:runner-sphere-demo';
const DIRTY_STATE = {
    mode: 'gridGrowth',
    params: { seed: 5 },
    scenario: { items: { victory: 1 }, obstacles: {} },
    substrateQuotas: {},
    substrateMix: {},
    substrateMode: 'quotas',
};

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

let checks = 0;
function check(desc, ok, detail = '') {
    if (!ok) {
        console.log('LOGS (last 30):', logs.slice(-30).join('\n'));
        throw new Error(`FAIL: ${desc}${detail ? ` — ${detail}` : ''}`);
    }
    checks += 1;
    console.log(`ok ${checks}: ${desc}`);
}

async function waitFor(desc, fn, timeoutMs = 30000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) {
            console.log('LOGS (last 30):', logs.slice(-30).join('\n'));
            throw new Error(`timeout waiting for: ${desc}`);
        }
        await page.waitForTimeout(500);
    }
}

await page.addInitScript((dirty) => {
    // Only on first load — the reload later must KEEP localStorage to
    // prove persistence, so guard on a marker the script sets once.
    if (!localStorage.getItem('__presetVerifySeeded')) {
        localStorage.setItem('procgenPipeline_params', JSON.stringify(dirty));
        localStorage.setItem('__presetVerifySeeded', '1');
    }
}, DIRTY_STATE);

async function openPanel() {
    await page.goto('http://localhost:8000/frontend/');
    await page.waitForTimeout(8000);
    const activated = await page.evaluate(() => {
        const tab = [...document.querySelectorAll('.lm_tab')]
            .find((t) => t.title === 'Procgen Pipeline');
        if (!tab) return false;
        tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        tab.click();
        return true;
    });
    if (!activated) throw new Error('Procgen Pipeline tab not found');
    await page.waitForTimeout(1500);
    const panel = page.locator('.procgen-pipeline-panel');
    if (await panel.count() === 0) throw new Error('panel not found');
    return panel;
}

const readBundle = () => page.evaluate(
    () => JSON.parse(localStorage.getItem('procgenPipeline_params')));
const readPresetStore = () => page.evaluate(
    () => JSON.parse(localStorage.getItem('procgenPipeline_presets') ?? 'null'));

let panel = await openPanel();
const select = panel.locator('.procgen-pipeline-preset-select');

// ── 2. Drop-down renders with the expected options ─────────────────
check('preset drop-down renders', await select.count() === 1);
check('drop-down sits at the top of the panel',
    await panel.evaluate((el) => el.firstElementChild
        ?.classList.contains('procgen-pipeline-presets')));
const optionLabels = await select.locator('option').allTextContents();
check('Custom + shipped presets listed',
    optionLabels[0] === 'Custom'
        && optionLabels.includes('Runner demo (sphere growth)')
        && optionLabels.includes('Bounce demo (sphere growth)'),
    JSON.stringify(optionLabels));
check('boots on Custom (dirty pre-seeded state, no preset)',
    await select.inputValue() === '');

// ── 3. Apply the runner preset ──────────────────────────────────────
await select.selectOption(RUNNER_PRESET_ID);
await page.waitForTimeout(300);

check('sphereGrowth mode radio checked after apply',
    await panel.locator('input[name="procgen-pipeline-mode"][value="sphereGrowth"]').isChecked());
const seedInput = panel.locator(
    '.procgen-pipeline-field:has(label:text-is("Seed")) input');
check('seed input shows 1', await seedInput.inputValue() === '1');
const applied = await panel.locator('.procgen-pipeline-message').textContent();
check('applied message shown', applied.includes('Preset "Runner demo (sphere growth)" applied.'),
    applied);

const bundle = await readBundle();
check('bundle: mode + seed + start substrate',
    bundle.mode === 'sphereGrowth' && bundle.params.seed === 1
        && bundle.params.startSubstrate === 'runner');
check('bundle: runner* keys populated',
    bundle.params.runnerPhysicsProfile === 'celeste'
        && bundle.params.runnerGapMargin === 0
        && bundle.params.runnerHazardDensity === 0.35
        && bundle.params.runnerLengthSteps === 2,
    JSON.stringify(bundle.params));
check('bundle: quota runner=99, quotas mode',
    bundle.substrateQuotas.runner === 99 && bundle.substrateMode === 'quotas');
check('bundle: runner item pool',
    bundle.scenario.items['Double Jump'] === 1
        && bundle.scenario.items['Blue Platforms'] === 1
        && bundle.scenario.items.Victory === 1);
check('bundle: activePresetId persisted',
    bundle.activePresetId === RUNNER_PRESET_ID);

// ── 4. Generate from the preset (runner zone gen is solver-heavy) ──
await panel.locator('button:has-text("Run all")').first().click();
const genMessage = await waitFor('sphere oracle success message', async () => {
    const m = await panel.locator('.procgen-pipeline-message').textContent();
    if (m.startsWith('ERROR')) throw new Error(`generation failed: ${m}`);
    return m.includes('Sphere plan realised') ? m : null;
}, 240000);
check('generation from preset succeeds (oracle)', true, genMessage);
console.log('GEN MESSAGE:', genMessage);

// ── 5. Editing a param flips the selection to Custom ───────────────
await seedInput.fill('2');
await seedInput.dispatchEvent('change');
await page.waitForTimeout(300);
check('drop-down flips to Custom after an edit',
    await select.inputValue() === '');
check('activePresetId cleared in bundle',
    (await readBundle()).activePresetId === null);

// ── 6. User preset: save, persist across reload, delete ────────────
page.once('dialog', (d) => d.accept('My Test Preset'));
await panel.locator('button:has-text("Save as…")').click();
await page.waitForTimeout(300);
check('user preset selected after save',
    await select.inputValue() === 'user:my-test-preset');
const store = await readPresetStore();
check('user preset persisted to the presets key',
    store?.presets?.length === 1 && store.presets[0].label === 'My Test Preset'
        && store.presets[0].state.params.seed === 2);

panel = await openPanel();
const select2 = panel.locator('.procgen-pipeline-preset-select');
check('selection survives a reload',
    await select2.inputValue() === 'user:my-test-preset');
const seedAfterReload = await panel.locator(
    '.procgen-pipeline-field:has(label:text-is("Seed")) input').inputValue();
check('edited params survive the reload', seedAfterReload === '2');

page.once('dialog', (d) => d.accept());
await panel.locator('button:has-text("Delete")').click();
await page.waitForTimeout(300);
check('drop-down returns to Custom after delete',
    await select2.inputValue() === '');
check('user preset removed from store',
    (await readPresetStore())?.presets?.length === 0);
check('deleted preset no longer listed',
    !(await select2.locator('option').allTextContents()).includes('My Test Preset'));

console.log(`\nAll ${checks} preset drop-down checks passed.`);
await browser.close();
