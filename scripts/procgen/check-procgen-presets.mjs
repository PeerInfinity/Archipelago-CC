/**
 * In-app gate for the Procgen Pipeline panel's preset drop-down
 * (presetDefs.js + _renderPresetBar + _applyPreset): EVERY shipped preset is
 * applied through the drop-down and generated through the panel's own Generate,
 * and the world the panel builds is the world the headless row asserts on.
 *
 *   1. Pre-seed the panel with a DIRTY setup (gridGrowth, seed 5, no
 *      quotas) so applying a preset visibly changes everything.
 *   2. Assert the drop-down renders at the top, boots on Custom, shows its
 *      mode groups in PRESET_GROUP_ORDER, and lists every shipped preset in
 *      its own mode's group — read off SHIPPED_PRESETS, so a preset added or
 *      dropped there is expected here without an edit.
 *   3. For EVERY shipped preset, in list order: select it → the persisted
 *      bundle carries its mode, quotas, mix and library references → the
 *      apply CLEARED the previous preset's compiled output (the completion
 *      wait below keys on that output, so a result left over from the
 *      previous preset must not be readable as this one's) → its served
 *      libraries resolve with no drift warning → a top-down preset sees the
 *      loaded Adventure world in its source picker → Generate → wait for THIS
 *      preset's compiled output under PRESET_HEADLESS_BUDGET_MS ×
 *      BROWSER_BUDGET_FACTOR → the mode's completion line (sphere: the oracle's
 *      "Sphere plan realised"; spiral, grid, top-down: the stop reason the
 *      headless run stopped with) → the compiled rules.json equals the one
 *      presetRun.js builds headless in this process from the same definition.
 *   4. Edit a param → the drop-down flips back to Custom.
 *   5. Save a user preset (prompt dialog), reload the page, assert the
 *      selection + params survived, then delete it (confirm dialog).
 *   6. (C2) A top-down preset over a source LARGER than the default grid:
 *      load APCalc (81 regions), apply topdown-maze-ta-demo → the grid inputs
 *      read the source's derived grid (`gridDimsForSource`) → Generate →
 *      `stop: all_placed`; then a user preset that PINS 6×6, persisted as the
 *      active one, keeps 6×6 when a reload re-adopts APCalc. Step 3's
 *      top-down presets also assert their grid
 *      inputs read Adventure's derived grid after the apply.
 *   7. (F1) A top-down user preset saved over APCalc with the grid untouched
 *      carries no grid key, so applied over Adventure it reads Adventure's
 *      derived grid; one saved after typing a width carries the width only,
 *      so applied over APCalc it keeps that width and derives the height.
 *
 * The page is opened as `?game=adventure&seed=1`: the top-down presets realise
 * the LOADED world (⚖ user 2026-09-16, Q4), and this is the loaded world the
 * headless row's top-down fixture is. (A plain page load also has Adventure
 * loaded — measured P2 W0 — but the gate names its precondition.)
 *
 * Requires a repo-root dev server: `--host=<origin>` wins, then
 * PROCGEN_UI_HOST, then the test server (scripts/test/testServer.js:
 * http://localhost:$TEST_PORT, default 8000 — so a worktree's `TEST_PORT`
 * reaches this gate as it reaches `npm test`).
 *
 * Run:
 *   node scripts/procgen/check-procgen-presets.mjs [--host=<origin>]
 * @ci-box it generates EVERY shipped preset in a browser, including the runner presets the CI preset row skips by ruling (⚖ user 2026-09-16, "Skip runner presets in CI, by a declared field": their generator is seconds per region and was cut from the CI slow battery), so only the box runs the whole list.
 *   ⇒ deleting this one line is how a later slice adopts it into CI.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { takeBoxLockOrExit } from './boxLock.js';
import { findPanelTab, PROCGEN_PIPELINE_PANEL } from './seedlingRoomPlay.js';
import {
    SHIPPED_PRESETS, PRESET_GROUPS, PRESET_GROUP_ORDER, PRESET_HEADLESS_BUDGET_MS,
} from '../../frontend/modules/procgenPipeline/presetDefs.js';

/**
 * ⛓ R9 P3b, ⚖ 54 (7); ⚖ 62 at 12j — **THE BOX LOCK.** This instrument drives
 * the machine (browser), so it takes the box before it starts and refuses BY
 * NAME if another instrument holds it — replacing a hand-relayed "BOX BUSY".
 * A run UNDER a holder (`gates.mjs`, `standing-values`,
 * `rerecord-seedling-campaign`) recognises the holder's token and passes
 * through. `--wait-for-box=<sec>` queues instead of refusing.
 */

import { argvHelp } from './argvHelp.js';
import { TEST_BASE_URL } from '../test/testServer.js';
import { checkLine, failOnCrash, totalLine } from './gateTotal.js';

argvHelp(import.meta.url);
failOnCrash();
takeBoxLockOrExit({ name: 'check-procgen-presets.mjs', kind: 'browser' });

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback);
const HOST = (arg('host', null) ?? process.env.PROCGEN_UI_HOST ?? TEST_BASE_URL).replace(/\/$/, '');
const PAGE_URL = `${HOST}/frontend/?game=adventure&seed=1`;

/**
 * How much longer than the headless budget a preset may take through the panel.
 * MEASURED (P2, 2026-09-16, own tree on :8150, two full runs at 1-minute load
 * ~6–9): the slowest browser run was runner-placement-demo at 24.2 s (headless
 * 18.6 s in the same run; 11.1 s / 12.2 s in the other), the largest
 * browser ÷ headless ratio of a runner preset 1.30, and every other preset under
 * 0.9 s in the browser. 2 × the 30 s budget leaves 2.5× the slowest measured
 * run for the box's load, which has moved that preset 11.7 s → 26.7 s headless.
 */
const BROWSER_BUDGET_FACTOR = 2;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOPDOWN_SOURCE_FILE = 'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const TOPDOWN_SPHERE_LOG_FILE = 'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl';
/**
 * ⛓ C2 — the probe over a source LARGER than the default 3×3 grid holds: APCalc,
 * 81 regions. Before C2 a top-down preset applied over it laid out 3×3 and
 * stopped partial_layout (the apply rebuilt the grid from the defaults).
 */
const LARGE_SOURCE_GAME = 'apcalc';
const LARGE_SOURCE_FILE = 'frontend/presets/apcalc/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const LARGE_SOURCE_PRESET_ID = 'shipped:topdown-maze-ta-demo';
/** A grid side a user preset PINS in step 6 — any side the large source does not derive. */
const PINNED_GRID_SIDE = 6;

// The headless side: the panel's whole registry, then presetRun — the same
// assembly the panel's Generate calls (loaded after --help and the box lock).
const { REGISTRY_LIBRARIES } = await import('./reference/registry.mjs');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const { buildRunFromState, runPresetHeadless, gridDimsForSource } = await import(
    '../../frontend/modules/procgenPipeline/presetRun.js');
const { resolveLibrarySelection } = await import(
    '../../frontend/modules/procgenPipeline/regionLibraryLoader.js');

async function diskFetch(url) {
    const file = join(ROOT, 'frontend', url);
    if (!existsSync(file)) return { ok: false, status: 404 };
    const text = readFileSync(file, 'utf8');
    return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
}

async function headlessWorld(preset) {
    const { resolved } = await resolveLibrarySelection(preset.state.libraries ?? [],
        { fetchImpl: diskFetch, basePath: '' });
    const ctx = { resolvedLibraries: resolved };
    if (preset.state.mode === 'topDown') {
        ctx.topDownSource = JSON.parse(readFileSync(join(ROOT, TOPDOWN_SOURCE_FILE), 'utf8'));
        ctx.sphereLog = readFileSync(join(ROOT, TOPDOWN_SPHERE_LOG_FILE), 'utf8')
            .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
    }
    return runPresetHeadless(buildRunFromState(preset.state, ctx));
}

/** The first JSON path at which two values differ, or null. */
function firstDifference(a, b, path = '') {
    if (a === b) return null;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null
        || Array.isArray(a) !== Array.isArray(b)) return path || '/';
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
        const d = firstDifference(a[k], b[k], `${path}/${k}`);
        if (d) return d;
    }
    return JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b)) ? null : `${path} (key order)`;
}

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
        throw new Error(`${desc}${detail ? ` — ${detail}` : ''}`);
    }
    checks += 1;
    console.log(checkLine(true, `${checks}. ${desc}`));
}

async function waitFor(desc, fn, timeoutMs = 30000) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) {
            console.log('LOGS (last 30):', logs.slice(-30).join('\n'));
            throw new Error(`timeout after ${timeoutMs} ms waiting for: ${desc}`);
        }
        await page.waitForTimeout(250);
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

async function openPanel(url = PAGE_URL) {
    await page.goto(url);
    await page.waitForTimeout(8000);
    // Polled, not looked up once: at 1-minute load ~10 the tab was measured
    // absent 8 s after goto (C2, 2026-09-30) on an otherwise healthy boot.
    // The panel counts as open when its preset drop-down is VISIBLE: a click
    // that lands while the boot is still re-rendering the layout was measured
    // (C2, load ~10) to leave the drop-down hidden, so the tab is re-clicked.
    const panel = page.locator('.procgen-pipeline-panel');
    const shown = await waitFor('the Procgen Pipeline panel, showing its preset drop-down', async () => {
        const tab = await findPanelTab(page, PROCGEN_PIPELINE_PANEL);
        if (!tab) return false;
        await tab.evaluate((t) => { t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); t.click(); });
        await page.waitForTimeout(1500);
        return panel.locator('.procgen-pipeline-preset-select').first().isVisible();
    }, 30000).catch(() => false);
    if (!shown) throw new Error('Procgen Pipeline tab not found, or its panel never showed the preset drop-down');
    return panel;
}

const readBundle = () => page.evaluate(
    () => JSON.parse(localStorage.getItem('procgenPipeline_params')));
const readPresetStore = () => page.evaluate(
    () => JSON.parse(localStorage.getItem('procgenPipeline_presets') ?? 'null'));
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The grid inputs' values as numbers, `{ width, height }`. */
const readGridInputs = async (p) => ({
    width: Number(await p.locator('.procgen-pipeline-field:has(label:text-is("Grid width")) input').inputValue()),
    height: Number(await p.locator('.procgen-pipeline-field:has(label:text-is("Grid height")) input').inputValue()),
});
/** The panel's message line, or '' — the panel renders no element while it is empty. */
const readMessage = () => page.evaluate(() => document
    .querySelector('.procgen-pipeline-panel .procgen-pipeline-message')?.textContent ?? '');

let panel = await openPanel();
const select = panel.locator('.procgen-pipeline-preset-select');

// ── 2. The drop-down: Custom, the groups in the ruled order, every preset ──
check('preset drop-down renders', await select.count() === 1);
check('drop-down sits at the top of the panel',
    await panel.evaluate((el) => el.firstElementChild
        ?.classList.contains('procgen-pipeline-presets')));
check('boots on Custom (dirty pre-seeded state, no preset)',
    await select.inputValue() === '');
const firstOption = await select.locator(':scope > option').allTextContents();
check('Custom is the first option, outside every group', sameJson(firstOption, ['Custom']),
    JSON.stringify(firstOption));
const groupLabels = await select.locator('optgroup').evaluateAll((els) => els.map((g) => g.label));
// Derived from the order constant and the definitions' modes — NOT from
// groupShippedPresets, the function the panel renders with.
const expectedGroups = PRESET_GROUP_ORDER
    .filter((mode) => SHIPPED_PRESETS.some((p) => p.state.mode === mode))
    .map((mode) => PRESET_GROUPS[mode]);
check('the mode groups appear in PRESET_GROUP_ORDER, a mode with no preset omitted, no User group yet',
    sameJson(groupLabels, expectedGroups), JSON.stringify({ groupLabels, expectedGroups }));
const optionGroups = Object.fromEntries(await select.locator('optgroup option').evaluateAll(
    (els) => els.map((o) => [o.value, [o.parentElement.label, o.textContent]])));
const misplaced = SHIPPED_PRESETS.filter((p) => !sameJson(optionGroups[p.id],
    [PRESET_GROUPS[p.state.mode], p.label]));
check(`every shipped preset (${SHIPPED_PRESETS.length} in the list) is an option with its label in its mode's group`,
    misplaced.length === 0, JSON.stringify(misplaced.map((p) => [p.id, optionGroups[p.id] ?? null])));

// ── 3. Every shipped preset: apply → Generate → this preset's world ────────
const ceilingMs = PRESET_HEADLESS_BUDGET_MS * BROWSER_BUDGET_FACTOR;
const primary = panel.locator('.procgen-pipeline-btn-primary').first();
const rulesPre = panel.locator('.procgen-pipeline-rules-json');
const timings = [];
for (const preset of SHIPPED_PRESETS) {
    const def = preset.state;
    await select.selectOption(preset.id);
    await page.waitForTimeout(300);

    const applied = await readMessage();
    check(`${preset.id}: applied message`, applied.includes(`Preset "${preset.label}" applied.`), applied);
    check(`${preset.id}: mode radio ${def.mode} checked`,
        await panel.locator(`input[name="procgen-pipeline-mode"][value="${def.mode}"]`).isChecked());
    const bundle = await readBundle();
    check(`${preset.id}: persisted bundle carries the definition's mode, quotas, mix, libraries and its id`,
        bundle.mode === def.mode
            && sameJson(bundle.substrateQuotas, def.substrateQuotas)
            && sameJson(bundle.substrateMix, def.substrateMix)
            && sameJson(bundle.libraries ?? [], def.libraries ?? [])
            && Object.entries(def.params).every(([k, v]) => sameJson(bundle.params[k], v))
            && bundle.activePresetId === preset.id,
        JSON.stringify(bundle));
    // ⛔ The completion wait below reads the compiled output, so the apply must
    // have cleared the previous preset's. Measured (P2): with _applyPreset's reset
    // removed this check reds on the second preset; with this check ALSO removed
    // the gate stays green, because Generate nulls the result and disables its
    // button synchronously on click — so this row guards the APPLY's reset, and
    // the wait (plus the headless-world comparison) cannot read a stale output.
    check(`${preset.id}: the apply cleared the previous compiled output`, await rulesPre.count() === 0);

    if ((def.libraries ?? []).length) {
        await waitFor(`${preset.id}: its ${def.libraries.length} region libraries resolve`, async () => (
            await panel.locator('.procgen-pipeline-region-libraries .procgen-pipeline-selected-row').count()
                === def.libraries.length));
        const warning = await panel.evaluate((el) => el.textContent.includes('Region libraries:'));
        check(`${preset.id}: served libraries resolved with no drift or missing-file warning`, !warning);
    }
    if (def.mode === 'topDown') {
        const status = await panel.locator('.procgen-pipeline-source-status').first().textContent();
        check(`${preset.id}: the source picker has the loaded Adventure world`,
            status.startsWith(`Loaded: loaded (./presets/adventure/AP_14089154938208861744/`), status);
        // ⛓ C2 — the apply keeps the grid the source needs (the preset pins none).
        const want = gridDimsForSource(JSON.parse(readFileSync(join(ROOT, TOPDOWN_SOURCE_FILE), 'utf8')));
        const got = await readGridInputs(panel);
        check(`${preset.id}: the apply leaves the grid inputs at the source's derived ${want.width}×${want.height}`,
            sameJson(got, want), JSON.stringify(got));
    }

    const expected = await headlessWorld(preset);

    const t0 = Date.now();
    await primary.click();
    await waitFor(`${preset.id}: its own compiled output`, async () => {
        const m = await readMessage();
        if (m.startsWith('ERROR') || m.startsWith('SPHERE ORACLE MISMATCH')) {
            throw new Error(`${preset.id}: generation failed: ${m}`);
        }
        return await rulesPre.count() === 1 && !(await primary.isDisabled());
    }, ceilingMs);
    const browserMs = Date.now() - t0;

    const text = await panel.textContent();
    if (def.mode === 'sphereGrowth') {
        const m = await readMessage();
        check(`${preset.id}: sphere oracle realised the plan`, m.includes('Sphere plan realised'), m);
    } else {
        check(`${preset.id}: the result reads stop: ${expected.stats.stopReason}`,
            text.includes(`stop: ${expected.stats.stopReason}`));
    }
    const world = JSON.parse(await rulesPre.textContent());
    check(`${preset.id}: the panel's world is the headless world presetRun builds`,
        sameJson(world, expected.rulesJson), `first difference at ${firstDifference(world, expected.rulesJson)}`);
    const regions = Object.keys(world.regions['1']).length;
    timings.push(`${preset.id} · ${def.mode} · ${regions} regions · headless ${expected.ms} ms · browser ${browserMs} ms`);
    console.log(`  ${timings.at(-1)}`);
}

// re-apply the first preset so the edit-flip section below starts from a
// selected preset with the seed field it expects
await select.selectOption(SHIPPED_PRESETS[0].id);
await page.waitForTimeout(300);
const seedInput = panel.locator(
    '.procgen-pipeline-field:has(label:text-is("Seed")) input');

// ── 4. Editing a param flips the selection to Custom ───────────────
await seedInput.fill('2');
await seedInput.dispatchEvent('change');
await page.waitForTimeout(300);
check('drop-down flips to Custom after an edit',
    await select.inputValue() === '');
check('activePresetId cleared in bundle',
    (await readBundle()).activePresetId === null);

// ── 5. User preset: save, persist across reload, delete ────────────
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

// ── 6. A top-down preset over a source larger than the default grid ──────
{
    const largePanel = await openPanel(`${HOST}/frontend/?game=${LARGE_SOURCE_GAME}&seed=1`);
    const largeSelect = largePanel.locator('.procgen-pipeline-preset-select');
    await largeSelect.selectOption(LARGE_SOURCE_PRESET_ID);
    await page.waitForTimeout(300);
    const status = await largePanel.locator('.procgen-pipeline-source-status').first().textContent();
    check(`${LARGE_SOURCE_PRESET_ID} over ${LARGE_SOURCE_GAME}: the source picker has the loaded ${LARGE_SOURCE_GAME} world`,
        status.includes(`./presets/${LARGE_SOURCE_GAME}/`), status);
    const want = gridDimsForSource(JSON.parse(readFileSync(join(ROOT, LARGE_SOURCE_FILE), 'utf8')));
    const got = await readGridInputs(largePanel);
    check(`${LARGE_SOURCE_PRESET_ID} over ${LARGE_SOURCE_GAME}: the apply sets the grid to the derived ${want.width}×${want.height}`,
        sameJson(got, want), JSON.stringify(got));
    const largePrimary = largePanel.locator('.procgen-pipeline-btn-primary').first();
    const largeRules = largePanel.locator('.procgen-pipeline-rules-json');
    const t0 = Date.now();
    await largePrimary.click();
    await waitFor(`${LARGE_SOURCE_PRESET_ID} over ${LARGE_SOURCE_GAME}: its compiled output`, async () => {
        const m = await readMessage();
        if (m.startsWith('ERROR')) throw new Error(`${LARGE_SOURCE_PRESET_ID} over ${LARGE_SOURCE_GAME}: generation failed: ${m}`);
        return await largeRules.count() === 1 && !(await largePrimary.isDisabled());
    }, ceilingMs);
    const text = await largePanel.textContent();
    check(`${LARGE_SOURCE_PRESET_ID} over ${LARGE_SOURCE_GAME}: the result reads stop: all_placed`,
        text.includes('stop: all_placed'), (text.match(/stop: [a-z_]+/g) ?? []).join(', '));
    timings.push(`${LARGE_SOURCE_PRESET_ID} over ${LARGE_SOURCE_GAME} · topDown · ${want.width}×${want.height} · browser ${Date.now() - t0} ms`);

    // A preset that PINS its grid keeps it when a reload re-adopts the source.
    // Measured (C2): with the adoption's pin ignored, the reload reads 12, the
    // pre-C2 behaviour P2 carried ("a reload adopts the source's grid over the preset's").
    check(`the pinned side ${PINNED_GRID_SIDE} is not ${LARGE_SOURCE_GAME}'s derived side`, PINNED_GRID_SIDE !== want.width);
    const pinned = {
        mode: 'topDown',
        params: { seed: 3, gridWidth: PINNED_GRID_SIDE, gridHeight: PINNED_GRID_SIDE },
        scenario: { items: {}, obstacles: {} },
        substrateQuotas: {},
        substrateMix: { maze: 1 },
        substrateMode: 'mix',
    };
    await page.evaluate((st) => {
        localStorage.setItem('procgenPipeline_presets',
            JSON.stringify({ presets: [{ id: 'user:grid-pin', label: 'grid pin', state: st }] }));
        localStorage.setItem('procgenPipeline_params', JSON.stringify({ ...st, activePresetId: 'user:grid-pin' }));
    }, pinned);
    const pinPanel = await openPanel(`${HOST}/frontend/?game=${LARGE_SOURCE_GAME}&seed=1`);
    check(`a reload over ${LARGE_SOURCE_GAME} keeps the active user preset that pins ${PINNED_GRID_SIDE}×${PINNED_GRID_SIDE}`,
        await pinPanel.locator('.procgen-pipeline-preset-select').inputValue() === 'user:grid-pin');
    const pinGot = await readGridInputs(pinPanel);
    check(`the source's adoption on that reload leaves the pinned grid at ${PINNED_GRID_SIDE}×${PINNED_GRID_SIDE}`,
        sameJson(pinGot, { width: PINNED_GRID_SIDE, height: PINNED_GRID_SIDE }), JSON.stringify(pinGot));
}

// ── 7. (F1) A top-down user preset pins only the grid axes the user typed ──
// ⚖ user 2026-09-30: a saved top-down preset leaves the grid OUT unless the
// user changed it by hand. Measured (F1) with the capture keeping both keys:
// the Adventure apply below reads APCalc's 12×12.
{
    const SMALL_SOURCE_GAME = 'adventure';
    const small = gridDimsForSource(JSON.parse(readFileSync(join(ROOT, TOPDOWN_SOURCE_FILE), 'utf8')));
    const large = gridDimsForSource(JSON.parse(readFileSync(join(ROOT, LARGE_SOURCE_FILE), 'utf8')));
    check(`${SMALL_SOURCE_GAME}'s derived grid ${small.width}×${small.height} is not ${LARGE_SOURCE_GAME}'s ${large.width}×${large.height}`,
        small.width !== large.width && small.height !== large.height);
    check(`the typed width ${PINNED_GRID_SIDE} is neither source's derived width`,
        PINNED_GRID_SIDE !== small.width && PINNED_GRID_SIDE !== large.width);
    await page.evaluate(() => localStorage.setItem('procgenPipeline_presets', JSON.stringify({ presets: [] })));
    const savePreset = async (p, label) => {
        page.once('dialog', (d) => d.accept(label));
        await p.locator('button:has-text("Save as…")').click();
        await page.waitForTimeout(300);
        return (await readPresetStore())?.presets?.find((x) => x.label === label) ?? null;
    };
    /** Custom, then the preset: re-selecting the selected option fires no change. */
    const applyById = async (p, id) => {
        const sel = p.locator('.procgen-pipeline-preset-select');
        await sel.selectOption('');
        await page.waitForTimeout(300);
        await p.locator('.procgen-pipeline-preset-select').selectOption(id);
        await page.waitForTimeout(300);
    };

    // (a) Over APCalc, the grid untouched → the saved preset carries no grid key.
    let p7 = await openPanel(`${HOST}/frontend/?game=${LARGE_SOURCE_GAME}&seed=1`);
    await applyById(p7, LARGE_SOURCE_PRESET_ID);
    check(`F1: ${LARGE_SOURCE_PRESET_ID} over ${LARGE_SOURCE_GAME} reads the derived ${large.width}×${large.height} before the save`,
        sameJson(await readGridInputs(p7), large), JSON.stringify(await readGridInputs(p7)));
    const untouched = await savePreset(p7, 'Grid untouched');
    check('F1: a top-down preset saved with the grid untouched carries no grid key',
        untouched && !('gridWidth' in untouched.state.params) && !('gridHeight' in untouched.state.params),
        JSON.stringify(untouched?.state?.params));

    // ... and applied over Adventure, its grid is Adventure's derived one.
    p7 = await openPanel(`${HOST}/frontend/?game=${SMALL_SOURCE_GAME}&seed=1`);
    const smallStatus = await p7.locator('.procgen-pipeline-source-status').first().textContent();
    check(`F1: the source picker has the loaded ${SMALL_SOURCE_GAME} world`,
        smallStatus.includes(`./presets/${SMALL_SOURCE_GAME}/`), smallStatus);
    await applyById(p7, untouched.id);
    const overSmall = await readGridInputs(p7);
    check(`F1: that preset applied over ${SMALL_SOURCE_GAME} lays out on ${SMALL_SOURCE_GAME}'s derived ${small.width}×${small.height}, not ${large.width}×${large.height}`,
        sameJson(overSmall, small), JSON.stringify(overSmall));

    // (b) Type a width → the saved preset carries (pins) the width only.
    const widthInput = p7.locator('.procgen-pipeline-field:has(label:text-is("Grid width")) input');
    await widthInput.fill(String(PINNED_GRID_SIDE));
    await widthInput.dispatchEvent('change');
    await page.waitForTimeout(300);
    const typed = await savePreset(p7, 'Width typed');
    check(`F1: a top-down preset saved after typing width ${PINNED_GRID_SIDE} carries gridWidth ${PINNED_GRID_SIDE} and no gridHeight`,
        typed?.state?.params?.gridWidth === PINNED_GRID_SIDE && !('gridHeight' in typed.state.params),
        JSON.stringify(typed?.state?.params));

    // ... and applied over APCalc, the width is kept and the height derived.
    p7 = await openPanel(`${HOST}/frontend/?game=${LARGE_SOURCE_GAME}&seed=1`);
    await applyById(p7, typed.id);
    const overLarge = await readGridInputs(p7);
    check(`F1: that preset applied over ${LARGE_SOURCE_GAME} keeps width ${PINNED_GRID_SIDE} and derives height ${large.height}`,
        sameJson(overLarge, { width: PINNED_GRID_SIDE, height: large.height }), JSON.stringify(overLarge));
    await page.evaluate(() => localStorage.setItem('procgenPipeline_presets', JSON.stringify({ presets: [] })));
}

console.log(`\nPer preset (${HOST}, ceiling ${ceilingMs} ms each):\n  ${timings.join('\n  ')}`);
console.log(`\nAll ${checks} preset drop-down checks passed.`);
await browser.close();
console.log(totalLine(0));
process.exit(0);
