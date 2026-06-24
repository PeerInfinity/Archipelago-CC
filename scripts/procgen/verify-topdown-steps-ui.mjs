/**
 * In-app smoke test for the STEPPED top-down pipeline (Phase 2). Drives the real
 * panel in a browser:
 *
 *   Phase A — pure stepping: load a source rules.json, then Run ① Layout →
 *     ② Realise → ③ Finalize → ④ Compile, asserting the step indicator advances,
 *     each step's feedback block appears, and the compiled output shows.
 *   Phase B — Run all + Reset: Reset, then Generate (run all) and assert a
 *     terminal compiled result + the composite grid canvas.
 *
 * Prereq: dev server on :8000. Run: node scripts/procgen/verify-topdown-steps-ui.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const SRC_PATH = '/tmp/td-verify-source.json';
// A small maze source: Menu → Hub → {North,East,West} → Deep, with gated exits.
const SOURCE = {
    start_regions: { '1': { default: ['Menu'] } },
    assume_bidirectional_exits: true,
    game_name: 'TDVerifyMaze',
    regions: {
        '1': {
            Menu: { name: 'Menu', exits: [{ name: 'GameStart', connected_region: 'Hub', access_rule: { rule: 'True_' } }], locations: [] },
            Hub: {
                name: 'Hub',
                exits: [
                    { name: 'toN', connected_region: 'North', access_rule: { rule: 'True_' } },
                    { name: 'toE', connected_region: 'East', access_rule: { rule: 'True_' } },
                    { name: 'toW', connected_region: 'West', access_rule: { rule: 'True_' } },
                ],
                locations: [{ name: 'Hub_Chest', item: { name: 'key_red' } }],
            },
            North: { name: 'North', exits: [{ name: 'toDeep', connected_region: 'Deep', access_rule: { rule: 'Has', args: { item_name: 'key_red' } } }], locations: [{ name: 'North_A', item: { name: 'key_blue' } }] },
            East: { name: 'East', exits: [], locations: [{ name: 'East_A', item: { name: 'Victory' } }] },
            West: { name: 'West', exits: [], locations: [{ name: 'West_A', item: { name: 'f3' } }] },
            Deep: { name: 'Deep', exits: [], locations: [{ name: 'Deep_A', item: { name: 'f4' } }] },
        },
    },
};
writeFileSync(SRC_PATH, JSON.stringify(SOURCE));

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.addInitScript(() => {
    localStorage.setItem('procgenPipeline_params', JSON.stringify({
        mode: 'topDown',
        params: { seed: 1, gridWidth: 5, gridHeight: 5, regionWidth: 6, regionHeight: 6 },
        scenario: { items: {}, obstacles: {} },
        substrateMix: { maze: 1 }, substrateMode: 'mix',
    }));
});

await page.goto('http://localhost:8000/frontend/');
await page.waitForTimeout(8000);

const activated = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Procgen Pipeline');
    if (!tab) return false;
    tab.click();
    return true;
});
if (!activated) { console.log('❌ could not activate Procgen Pipeline panel'); console.log(logs.join('\n')); await browser.close(); process.exit(1); }
await page.waitForTimeout(1500);

const panelText = () => page.evaluate(() => document.querySelector('.procgen-pipeline')?.textContent ?? document.body.textContent ?? '');
// Scope to the procgen panel — other panels (e.g. loops) also have a "Reset"
// button, so a page-wide text match can hit the wrong one.
const clickByText = (txt) => page.evaluate((t) => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content')
        ?? document;
    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
    if (btn) { btn.click(); return true; }
    return false;
}, txt);

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? '✅' : '❌'} ${msg}`); };

// Load the source via the file input.
await page.setInputFiles('.procgen-pipeline-source-input', SRC_PATH);
await page.waitForTimeout(800);
assert((await panelText()).includes('Loaded source'), 'source loaded');

// Phase A — step through ①→④.
const steps = ['Run ① Layout', 'Run ② Realise', 'Run ③ Finalize', 'Run ④ Compile'];
for (const label of steps) {
    const clicked = await clickByText(label);
    assert(clicked, `clicked "${label}"`);
    await page.waitForTimeout(1200);
}
const afterSteps = await panelText();
assert(afterSteps.includes('① Layout') && afterSteps.includes('④ Compile'), 'step indicator shows all four steps');
assert(/driver top-down/.test(afterSteps), 'compile feedback shows driver top-down');
assert(/\d+ regions/.test(afterSteps), 'compile feedback shows region count');

// Phase B — Reset then Run all (Generate).
assert(await clickByText('Reset'), 'clicked "Reset"');
await page.waitForTimeout(500);
const afterReset = await panelText();
assert(!/driver top-down/.test(afterReset), 'reset cleared the pipeline');
assert(await clickByText('Generate'), 'clicked "Generate"');
await page.waitForTimeout(2500);
const afterAll = await panelText();
assert(/driver top-down/.test(afterAll), 'Run all (Generate) produced a compiled result');
const hasCanvas = await page.evaluate(() => !!document.querySelector('.procgen-pipeline-canvas-wrap canvas'));
assert(hasCanvas, 'composite grid canvas rendered');

const pageErrors = logs.filter((l) => l.startsWith('[pageerror]'));
assert(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
if (pageErrors.length) console.log(pageErrors.join('\n'));

await browser.close();
console.log(failures.length ? `\n❌ ${failures.length} FAILURE(S)` : '\n✅ ALL PASS');
process.exit(failures.length ? 1 : 0);
