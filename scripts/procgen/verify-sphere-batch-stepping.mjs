/**
 * In-app smoke test for SPHERE-MAJOR (batch < all) stepping in the Procgen
 * Pipeline panel (Phase 2.8). With spheresPerBatch = 1 the "Run next step"
 * button must loop the middle four phases per sphere — ②a → ②b → ②c → ③ →
 * (back to) ②a … → ④ — and the batch-progress tag must count spheres built.
 *
 *   Phase A — manual stepping loops back: Run ① Plan, then Run next step
 *     repeatedly. Assert the button label revisits "Run ②a Allocate" after a
 *     "Run ③ Build regions" (not jumping straight to ④), and that the
 *     batch-progress tag advances ("k/N spheres built"), finishing with the
 *     oracle success message.
 *   Phase B — "Run all" finishes a batch<all world with the oracle clean.
 *
 * Prereq: dev server on :8000. Run: node scripts/procgen/verify-sphere-batch-stepping.mjs
 */
import { chromium } from 'playwright';

const SEED = 1;
const ITEM_POOL = { key_red: 1, key_blue: 1, key_green: 1, key_yellow: 1, victory: 1 };
const PANEL_PARAMS = {
    seed: SEED, regionWidth: 8, regionHeight: 6, maxItemsPerRegion: 2,
    sphereCount: 4, fillerCount: 0, revisitPercent: 25, startSubstrate: 'maze',
    spheresPerBatch: 1,
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

async function panelText() {
    return page.evaluate(() => document.querySelector('.procgen-pipeline-panel')?.textContent ?? '');
}
// The "Run next step" button is the non-primary button whose label starts "Run ".
async function nextStepLabel() {
    return page.evaluate(() => {
        const b = [...document.querySelectorAll('.procgen-pipeline-actions button')]
            .find((el) => /^Run (①|②|③|④)/.test(el.textContent.trim())
                || el.textContent.trim() === 'Pipeline complete');
        return b ? b.textContent.trim() : null;
    });
}
async function clickNext() {
    const ok = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.procgen-pipeline-actions button')]
            .find((el) => (/^Run (①|②|③|④)/.test(el.textContent.trim())) && !el.disabled);
        if (!b) return false;
        b.click();
        return true;
    });
    if (!ok) throw new Error('Run-next-step button not found/enabled');
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

// ── Phase A: manual stepping loops back per sphere ──────────────────
// Start with ① Plan.
await clickNext();
await page.waitForTimeout(500);
let lbl = await nextStepLabel();
if (lbl !== 'Run ②a Allocate') throw new Error(`after Plan, expected Allocate, got ${lbl}`);

const labelSeq = [];
let sawLoopBack = false;
let prev = lbl;
// Step until the pipeline reports complete (cap iterations as a backstop).
for (let i = 0; i < 40; i++) {
    await clickNext();
    await page.waitForTimeout(400);
    lbl = await nextStepLabel();
    labelSeq.push(lbl);
    // A loop-back is a "Run ②a Allocate" appearing AFTER a "Run ③ Build regions".
    if (prev === 'Run ③ Build regions' && lbl === 'Run ②a Allocate') sawLoopBack = true;
    prev = lbl;
    if (lbl === 'Pipeline complete') break;
}
if (!sawLoopBack) {
    throw new Error(`never looped ③ → ②a (batch<all). Label sequence: ${labelSeq.join(' | ')}`);
}
const txtA = await panelText();
if (!/spheres built/.test(txtA)) {
    throw new Error('batch-progress tag ("spheres built") never rendered');
}
const msgA = await message();
if (!msgA.includes('Sphere plan realised')) {
    throw new Error(`stepped batch<all did not realise the plan: ${msgA}`);
}
console.log('PHASE A OK: stepping loops ③ → ②a per sphere; tag counts; oracle holds');
console.log('  label sequence:', labelSeq.join(' | '));

// ── Phase B: "Run all" finishes a batch<all world ───────────────────
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run all');
await page.waitForTimeout(6000);
const msgB = await message();
if (!msgB.includes('Sphere plan realised')) {
    throw new Error(`"Run all" did not realise the batch<all plan: ${msgB}`);
}
console.log('PHASE B OK: "Run all" finishes the batch<all pipeline —', msgB);

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:\n' + errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY SPHERE BATCH STEPPING: ALL OK');
await browser.close();
process.exit(0);
