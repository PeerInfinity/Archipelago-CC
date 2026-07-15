/**
 * In-app smoke test for gridGrowth mode's async generation + live progress.
 *
 * Grid-growth used to run synchronously (blocking the event loop) so its
 * progress indicator never repainted. It now drains growMazeAsync, streaming a
 * region/regionDone event per built region with a setTimeout(0) yield between
 * them — like the plan-driven sphere/top-down modes, except the region count is
 * EMERGENT so the panel shows "Building region N" with NO denominator.
 *
 * Asserts:
 *   1. The panel boots in gridGrowth mode.
 *   2. Clicking Generate streams live progress: at least one "Building region N"
 *      repaint is captured (via a MutationObserver on the progress element).
 *   3. Those frames carry NO "/<total>" denominator (grid-growth is emergent).
 *   4. Generation completes and produces a result (export actions appear), with
 *      no uncaught page errors.
 *
 * Prereq: dev server on :8000 (python -m http.server 8000).
 * Run:  node scripts/procgen/verify-grid-growth-ui.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
page.on('console', (msg) => {
    // Uncaught JS exceptions (pageerror) are the real signal. Boot-time
    // resource 404s (favicon / optional assets) are environmental noise.
    if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) {
        errors.push(`[console.error] ${msg.text()}`);
    }
});

// Boot the panel in gridGrowth mode with a big grid + generous pool so growth
// builds many regions (more setTimeout(0) yields => progress is easy to observe).
await page.addInitScript(() => {
    localStorage.setItem('procgenPipeline_params', JSON.stringify({
        mode: 'gridGrowth',
        params: {
            seed: 1, gridWidth: 6, gridHeight: 6,
            regionWidth: 8, regionHeight: 6, maxItemsPerRegion: 2, maxRegions: null,
        },
        scenario: { items: { key_red: 30 }, obstacles: { door_red: 30 } },
        substrateQuotas: { maze: 40 },
        substrateMix: {},
        substrateMode: 'quotas',
    }));
});

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

const panel = page.locator('.procgen-pipeline-panel');
if (await panel.count() === 0) throw new Error('procgen pipeline panel not found');
const gridRadio = panel.locator('input[name="procgen-pipeline-mode"][value="gridGrowth"]');
if (!await gridRadio.isChecked()) throw new Error('panel did not boot in gridGrowth mode');
console.log('PANEL: gridGrowth mode active');

// Capture every progress-element repaint (direct textContent mutations from
// _updateProgressEl) via a subtree/characterData MutationObserver.
await page.evaluate(() => {
    window.__frames = [];
    const root = document.querySelector('.procgen-pipeline-panel');
    const record = () => {
        const el = document.querySelector('.procgen-pipeline-progress');
        const t = el && el.textContent;
        if (t && (window.__frames.length === 0 || window.__frames[window.__frames.length - 1] !== t)) {
            window.__frames.push(t);
        }
    };
    new MutationObserver(record).observe(root, { childList: true, subtree: true, characterData: true });
});

await panel.locator('button:has-text("Generate")').first().click();
await page.waitForTimeout(4000);

const frames = await page.evaluate(() => window.__frames);
const buildingFrames = frames.filter((f) => /Building region \d+/.test(f));
const finalizeFrames = frames.filter((f) => /Finalizing/.test(f));
console.log(`PROGRESS FRAMES: ${frames.length} total, ${buildingFrames.length} "Building region", `
    + `${finalizeFrames.length} "Finalizing"`);
if (buildingFrames.length) {
    console.log('  sample:', JSON.stringify(buildingFrames[Math.floor(buildingFrames.length / 2)]));
}

// A "Building region N" line must NOT carry a "/<total>" denominator.
const withDenominator = buildingFrames.filter((f) => /Building region \d+\/\d+/.test(f));

// Result produced? Export actions appear once this.result is set.
const exportVisible = await panel.locator('button:has-text("Download")').count() > 0
    || await panel.locator('.procgen-pipeline-export, .procgen-pipeline-actions').count() > 0;

const problems = [];
if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`);
if (buildingFrames.length === 0) problems.push('no "Building region" progress frame captured');
if (withDenominator.length) problems.push(`progress showed a denominator: ${withDenominator[0]}`);
if (!exportVisible) problems.push('no export actions / result after generation');

await browser.close();
if (problems.length) {
    console.log('\nFAIL:\n - ' + problems.join('\n - '));
    process.exit(1);
}
console.log('\nPASS — grid-growth streams denominator-less live progress and produces a result');
process.exit(0);
