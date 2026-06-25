/**
 * In-app smoke test for the STEPPED top-down pipeline (Phase 2). Drives the real
 * panel in a browser:
 *
 *   Phase A — pure stepping: load a source rules.json, then Run ① Layout →
 *     ② Realise → ③ Finalize → ④ Compile, asserting the step indicator advances,
 *     each step's feedback block appears, and the compiled output shows.
 *   Phase B — Run all + Reset: Reset, then Generate (run all) and assert a
 *     terminal compiled result + the composite grid canvas.
 *   Phase C — substrate-assignment editor (Phase 4): after a full Generate,
 *     change a region's substrate dropdown at ① Layout, assert the pipeline
 *     invalidated (④ feedback gone), re-run, and assert the realised substrate
 *     mix reflects the edit + ④ recompiles.
 *
 * Prereq: dev server on :8000. Run: node scripts/procgen/verify-topdown-steps-ui.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const SRC_PATH = '/tmp/td-verify-source.json';
// A small cyclic source: Menu → Hub → {RoomA ⇄ RoomB}. Every NON-Menu region has
// at least one forward exit so the bounce (braid) substrate — which requires ≥1
// exit spec — can realise ANY region. (A leaf with no exits would make a random
// bounce assignment throw "braid: at least one exit spec required".)
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
                    { name: 'toA', connected_region: 'RoomA', access_rule: { rule: 'True_' } },
                    { name: 'toB', connected_region: 'RoomB', access_rule: { rule: 'True_' } },
                ],
                locations: [{ name: 'Hub_Chest', item: { name: 'key_red' } }],
            },
            RoomA: { name: 'RoomA', exits: [{ name: 'A_toB', connected_region: 'RoomB', access_rule: { rule: 'True_' } }], locations: [{ name: 'A_Victory', item: { name: 'Victory' } }] },
            RoomB: { name: 'RoomB', exits: [{ name: 'B_toA', connected_region: 'RoomA', access_rule: { rule: 'Has', args: { item_name: 'key_red' } } }], locations: [{ name: 'B_chest', item: { name: 'key_blue' } }] },
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
        substrateMix: { maze: 1, bounce: 1 }, substrateMode: 'mix',
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
    await page.waitForTimeout(2500);
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
await page.waitForTimeout(5000);
const afterAll = await panelText();
assert(/driver top-down/.test(afterAll), 'Run all (Generate) produced a compiled result');
const hasCanvas = await page.evaluate(() => !!document.querySelector('.procgen-pipeline-canvas-wrap canvas'));
assert(hasCanvas, 'composite grid canvas rendered');

// Phase C — substrate-assignment editor (Phase 4). Phase B left a full Generate
// (completed=3). Parse the ② realise substrate counts, flip a LEAF region's
// substrate dropdown at ①, assert ④ invalidated, re-run ②→④, and assert the
// realised mix shifted by one toward the edited substrate.
const realiseCounts = async () => page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    const m = (root.textContent || '').match(/Realised \d+ region\(s\):\s*([^·\n]+)/);
    if (!m) return null;
    const counts = {};
    for (const part of m[1].split(',')) {
        const mm = part.trim().match(/(\d+)\s+(\S+)/);
        if (mm) counts[mm[2]] = Number(mm[1]);
    }
    return counts;
});

const before = await realiseCounts();
assert(before !== null, 'Phase C: parsed baseline realise substrate counts');

// Flip a region's substrate to a different in-mix option. Every region in the
// test source has ≥1 exit, so either substrate (maze / bounce) realises any of
// them.
const flip = await page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    const sels = [...root.querySelectorAll('select.procgen-pipeline-td-substrate')];
    if (!sels.length) return { ok: false, reason: 'no substrate dropdowns' };
    const pick = sels[0];
    const cur = pick.value;
    const alt = [...pick.options].map((o) => o.value).find((v) => v !== cur);
    if (!alt) return { ok: false, reason: 'only one substrate option' };
    pick.value = alt;
    pick.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, region: pick.dataset.region, from: cur, to: alt };
});
assert(flip.ok, `Phase C: flipped a region's substrate (${flip.region}: ${flip.from}→${flip.to})`);
await page.waitForTimeout(400);

// The edit invalidated ②..④ → the compile feedback is gone (completed rolled to 0).
assert(!/driver top-down/.test(await panelText()), 'Phase C: substrate edit invalidated ④');

// Re-run ②→④ (the per-step buttons; nextStep is now "② Realise").
for (const label of ['Run ② Realise', 'Run ③ Finalize', 'Run ④ Compile']) {
    assert(await clickByText(label), `Phase C: clicked "${label}"`);
    await page.waitForTimeout(2500);
}
assert(/driver top-down/.test(await panelText()), 'Phase C: ④ recompiled after re-run');

// The dropdown still shows the edited value (the override persisted through re-run).
const persisted = await page.evaluate((region) => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    return [...root.querySelectorAll('select.procgen-pipeline-td-substrate')]
        .find((s) => s.dataset.region === region)?.value ?? null;
}, flip.region);
assert(persisted === flip.to, `Phase C: edited substrate persisted (${flip.region}=${persisted})`);

// The realised mix shifted by one toward the edited substrate.
const after = await realiseCounts();
const shifted = after && (after[flip.to] ?? 0) === ((before?.[flip.to] ?? 0) + 1);
assert(shifted, `Phase C: realised mix honored the edit `
    + `(${flip.to}: ${before?.[flip.to] ?? 0}→${after?.[flip.to] ?? 0})`);

const pageErrors = logs.filter((l) => l.startsWith('[pageerror]'));
assert(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
if (pageErrors.length) console.log(pageErrors.join('\n'));

await browser.close();
console.log(failures.length ? `\n❌ ${failures.length} FAILURE(S)` : '\n✅ ALL PASS');
process.exit(failures.length ? 1 : 0);
