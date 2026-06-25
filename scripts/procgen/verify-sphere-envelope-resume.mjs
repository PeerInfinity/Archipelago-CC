/**
 * In-app verification of the sphere-growth ENVELOPE interop (export / load
 * & auto-resume) in the Procgen Pipeline panel. Drives the real panel:
 *
 *   Phase 1 — full round-trip: run the whole pipeline 1→4, Export envelope,
 *     Reset, Load envelope. Assert it reports all 6 steps present and that a
 *     re-export's compiled rules.json is byte-identical to the original
 *     (the UI cfg/prep ↔ config adapters are lossless).
 *   Phase 2 — auto-detect partial resume: strip everything from `grow`
 *     onward out of the envelope, Reset, Load it. Assert the panel reports
 *     "resume from regions" (the first step with missing output) WITHOUT the
 *     user choosing a step, then Run all and assert the same realised plan.
 *
 * Prereq: dev server on :8000. Run: node scripts/procgen/verify-sphere-envelope-resume.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SEED = 1;
// Maze-only world — deterministic, fast, and free of the bounce arrow-entry
// prep so the round-trip assertions stay simple.
const ITEM_POOL = { key_red: 1, key_blue: 1, key_green: 1, victory: 1 };
const PANEL_PARAMS = {
    seed: SEED, regionWidth: 8, regionHeight: 6, maxItemsPerRegion: 2,
    sphereCount: 3, fillerCount: 0, revisitPercent: 25, startSubstrate: 'maze',
};

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.addInitScript(({ params, items }) => {
    localStorage.setItem('procgenPipeline_params', JSON.stringify({
        mode: 'sphereGrowth', params,
        scenario: { items, obstacles: {} },
        substrateQuotas: { maze: 99 }, substrateMix: {}, substrateMode: 'quotas',
    }));
}, { params: PANEL_PARAMS, items: ITEM_POOL });

await page.goto('http://localhost:8000/frontend/');
await page.waitForTimeout(8000);

const activated = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Procgen Pipeline');
    if (!tab) return false;
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    tab.click();
    return true;
});
if (!activated) throw new Error('Procgen Pipeline tab not found');
await page.waitForTimeout(1500);
if (await page.locator('.procgen-pipeline-panel').count() === 0) {
    throw new Error('procgen pipeline panel not found');
}

async function clickBtn(text) {
    const ok = await page.evaluate((t) => {
        const b = [...document.querySelectorAll('.procgen-pipeline-panel button')]
            .find((el) => el.textContent.trim() === t && !el.disabled);
        if (!b) return false;
        b.click();
        return true;
    }, text);
    if (!ok) throw new Error(`button not found/enabled: "${text}"`);
}
async function message() {
    return page.evaluate(() =>
        document.querySelector('.procgen-pipeline-message')?.textContent ?? '');
}
async function runFullPipeline() {
    for (const [s, wait] of [['Run 1 Plan', 600], ['Run 2a Allocate', 400],
        ['Run 2b Topology', 400], ['Run 2c Items', 400],
        ['Run 3 Build regions', 3000], ['Run 4 Compile', 1500]]) {
        await clickBtn(s);
        await page.waitForTimeout(wait);
    }
}
async function exportEnvelope() {
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        clickBtn('Export envelope'),
    ]);
    const path = await download.path();
    return JSON.parse(readFileSync(path, 'utf8'));
}
async function loadEnvelope(path) {
    await page.locator('.procgen-pipeline-envelope-input').setInputFiles(path);
    await page.waitForTimeout(800);
}

// ── Phase 1: full round-trip ────────────────────────────────────────
await runFullPipeline();
const baseMsg = await message();
if (!baseMsg.includes('Sphere plan realised')) {
    throw new Error(`baseline pipeline not realised: ${baseMsg}`);
}
console.log('BASELINE:', baseMsg);

const env1 = await exportEnvelope();
if (!env1.config || !env1.compile?.rulesJson) {
    throw new Error('exported envelope missing config / compile.rulesJson');
}
if (env1.completed !== 5) throw new Error(`exported completed=${env1.completed}, want 5`);
const baseRules = JSON.stringify(env1.compile.rulesJson);
console.log('EXPORT OK: envelope has config + all step outputs, completed=5');

await clickBtn('Reset');
await page.waitForTimeout(300);

const fullPath = join(tmpdir(), `sphere-env-full-${SEED}.json`);
writeFileSync(fullPath, JSON.stringify(env1, null, 2));
await loadEnvelope(fullPath);
const loadMsg = await message();
console.log('LOAD (full):', loadMsg);
if (!loadMsg.includes('all 6 steps present')) {
    throw new Error(`full-load message wrong: ${loadMsg}`);
}
// Re-export and compare: the UI cfg/prep ↔ config adapters must be lossless.
const env2 = await exportEnvelope();
if (JSON.stringify(env2.compile.rulesJson) !== baseRules) {
    throw new Error('re-exported rules.json differs from the original (adapter lossy)');
}
console.log('PHASE 1 OK: full export → reset → load → re-export is byte-identical');

// ── Phase 2: auto-detect partial resume ─────────────────────────────
const partial = JSON.parse(JSON.stringify(env1));
// Drop everything from the regions step onward — presence=keep, absence=
// recompute. The first missing output is `regions`.
delete partial.grow;
delete partial.compile;
delete partial.completed; // resume must not depend on the field
const partialPath = join(tmpdir(), `sphere-env-partial-${SEED}.json`);
writeFileSync(partialPath, JSON.stringify(partial, null, 2));

await clickBtn('Reset');
await page.waitForTimeout(300);
await loadEnvelope(partialPath);
const partMsg = await message();
console.log('LOAD (partial):', partMsg);
if (!partMsg.includes('resume from regions')) {
    throw new Error(`partial-load did not auto-detect resume from regions: ${partMsg}`);
}
console.log('PHASE 2a OK: auto-detected resume point = regions (first missing output)');

await clickBtn('Run all (finish)');
await page.waitForTimeout(4000);
const resumedMsg = await message();
console.log('RESUMED:', resumedMsg);
if (!resumedMsg.includes('Sphere plan realised')) {
    throw new Error(`resumed pipeline not realised: ${resumedMsg}`);
}
const env3 = await exportEnvelope();
if (JSON.stringify(env3.compile.rulesJson) !== baseRules) {
    throw new Error('resumed-from-partial rules.json differs from the original');
}
console.log('PHASE 2b OK: resumed from partial → identical rules.json');

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:\n' + errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY SPHERE ENVELOPE RESUME: ALL OK');
await browser.close();
process.exit(0);
