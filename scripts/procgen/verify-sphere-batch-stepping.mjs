/**
 * In-app smoke test for SPHERE-MAJOR (batch < all) stepping in the Procgen
 * Pipeline panel (Phase 2.8). With spheresPerBatch = 1 the "Run next step"
 * button must loop the middle four phases per sphere — 2a → 2b → 2c → 3 →
 * (back to) 2a … → 4 — and the batch-progress tag must count spheres built.
 *
 *   Phase A — manual stepping loops back: Run 1 Plan, then Run next step
 *     repeatedly. Assert the button label revisits "Run 2a Allocate" after a
 *     "Run 3 Build regions" (not jumping straight to 4), and that the
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
            .find((el) => /^Run (1|2|3|4)/.test(el.textContent.trim())
                || el.textContent.trim() === 'Pipeline complete');
        return b ? b.textContent.trim() : null;
    });
}
async function clickNext() {
    const ok = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.procgen-pipeline-actions button')]
            .find((el) => (/^Run (1|2|3|4)/.test(el.textContent.trim())) && !el.disabled);
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
// Start with 1 Plan.
await clickNext();
await page.waitForTimeout(500);
let lbl = await nextStepLabel();
if (lbl !== 'Run 2a Allocate') throw new Error(`after Plan, expected Allocate, got ${lbl}`);

const labelSeq = [];
let sawLoopBack = false;
let prev = lbl;
// Step until the pipeline reports complete (cap iterations as a backstop).
for (let i = 0; i < 40; i++) {
    await clickNext();
    await page.waitForTimeout(400);
    lbl = await nextStepLabel();
    labelSeq.push(lbl);
    // A loop-back is a "Run 2a Allocate" appearing AFTER a "Run 3 Build regions".
    if (prev === 'Run 3 Build regions' && lbl === 'Run 2a Allocate') sawLoopBack = true;
    prev = lbl;
    if (lbl === 'Pipeline complete') break;
}
if (!sawLoopBack) {
    throw new Error(`never looped 3 → 2a (batch<all). Label sequence: ${labelSeq.join(' | ')}`);
}
const txtA = await panelText();
if (!/spheres built/.test(txtA)) {
    throw new Error('batch-progress tag ("spheres built") never rendered');
}
const msgA = await message();
if (!msgA.includes('Sphere plan realised')) {
    throw new Error(`stepped batch<all did not realise the plan: ${msgA}`);
}
console.log('PHASE A OK: stepping loops 3 → 2a per sphere; tag counts; oracle holds');
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

// ── Phase C: edit the plan, then re-run in batch<all (no double-wire) ─
// Move a Sphere-1 item down (▼) → _onSpherePlanEdited invalidates from 1.
// Re-running must regenerate the whole sphere-major pipeline cleanly (a stale
// batch cursor would otherwise re-wire already-present waves).
const movedC = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.procgen-pipeline-panel [data-sphere]')];
    const s1 = groups.find((g) => g.getAttribute('data-sphere') === '1') || document;
    const btn = [...s1.querySelectorAll('button')].find((b) => b.textContent === '▼' && !b.disabled);
    if (!btn) return null;
    const label = btn.closest('[data-item], li, div')?.textContent?.trim() ?? '?';
    btn.click();
    return label;
});
if (movedC) {
    await page.waitForTimeout(400);
    await clickBtn('Run all (finish)');
    await page.waitForTimeout(6000);
    const msgC = await message();
    if (!msgC.includes('Sphere plan realised')) {
        throw new Error(`batch<all re-run after a plan edit failed: ${msgC}`);
    }
    console.log('PHASE C OK: plan edit + re-run regenerates the batch<all world —', msgC);
} else {
    console.log('PHASE C SKIP: no movable Sphere-1 item found (plan shape)');
}

// ── Phase D: layout + "◀ Previous sphere" ───────────────────────────
// Re-run to completion, then check (1) the Run buttons live in a dedicated row
// below the step indicators, and (2) "◀ Previous sphere" drops the last sphere
// and a subsequent "Run all" rebuilds it.
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run all');
await page.waitForTimeout(6000);

const layout = await page.evaluate(() => {
    const actions = document.querySelector('.procgen-pipeline-actions');
    const row = actions?.querySelector('.procgen-pipeline-btn-row');
    if (!row) return { ok: false, why: 'no .procgen-pipeline-btn-row' };
    const labels = [...row.querySelectorAll('button')].map((b) => b.textContent.trim());
    const indicator = actions.firstElementChild; // step-indicator chips row
    const rowIsAfterIndicator = indicator && indicator !== row
        && (indicator.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING);
    return {
        ok: !!rowIsAfterIndicator,
        hasRunAll: labels.some((l) => l.startsWith('Run all')),
        hasPrev: labels.some((l) => l.includes('Previous sphere')),
        labels,
    };
});
if (!layout.ok || !layout.hasRunAll || !layout.hasPrev) {
    throw new Error(`button-row layout wrong: ${JSON.stringify(layout)}`);
}
console.log('PHASE D1 OK: Run buttons are a row after the indicators —', layout.labels.join(' | '));

// Note the built-spheres count from the batch tag, step back, confirm it dropped.
const builtBefore = await page.evaluate(() => {
    const m = document.querySelector('.procgen-pipeline-panel')?.textContent?.match(/(\d+)\/(\d+) spheres built/);
    return m ? Number(m[1]) : null;
});
await clickBtn('◀ Previous sphere');
await page.waitForTimeout(400);
const msgD = await message();
if (!/dropped sphere/i.test(msgD)) {
    throw new Error(`"Previous sphere" gave no drop message: ${msgD}`);
}
const builtAfter = await page.evaluate(() => {
    const m = document.querySelector('.procgen-pipeline-panel')?.textContent?.match(/(\d+)\/(\d+) spheres built/);
    return m ? Number(m[1]) : null;
});
if (builtBefore != null && builtAfter != null && !(builtAfter < builtBefore)) {
    throw new Error(`Previous sphere did not reduce built count: ${builtBefore} → ${builtAfter}`);
}
console.log(`PHASE D2 OK: Previous sphere dropped one (${builtBefore} → ${builtAfter}) — ${msgD}`);

// Rebuild + finish.
await clickBtn('Run all (finish)');
await page.waitForTimeout(6000);
const msgD3 = await message();
if (!msgD3.includes('Sphere plan realised')) {
    throw new Error(`rebuild after Previous sphere failed: ${msgD3}`);
}
console.log('PHASE D3 OK: rebuilt to completion after stepping back —', msgD3);

// ── Phase E: "Previous sphere" disabled with no sphere + Append sphere ──
// E1: after Reset (nothing built), "◀ Previous sphere" must be DISABLED.
await clickBtn('Reset');
await page.waitForTimeout(300);
const prevDisabledAtReset = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.procgen-pipeline-actions button')]
        .find((el) => el.textContent.includes('Previous sphere'));
    return b ? b.disabled : null;
});
if (prevDisabledAtReset !== true) {
    throw new Error(`"Previous sphere" should be disabled with no built sphere (got ${prevDisabledAtReset})`);
}
console.log('PHASE E1 OK: "Previous sphere" disabled when no sphere is built');

// Build a full world, then Append a sphere via the UI.
await clickBtn('Run all');
await page.waitForTimeout(6000);

const appended = await page.evaluate(() => {
    const input = document.querySelector('.procgen-pipeline-append-items');
    if (!input) return { ok: false, why: 'no append-items input (is the pipeline complete?)' };
    input.value = 'extra_gem';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = [...document.querySelectorAll('.procgen-pipeline-actions button')]
        .find((el) => el.textContent.trim() === 'Append sphere' && !el.disabled);
    if (!btn) return { ok: false, why: 'no enabled "Append sphere" button' };
    btn.click();
    return { ok: true };
});
if (!appended.ok) throw new Error(`append affordance missing: ${appended.why}`);
await page.waitForTimeout(6000);
const msgE = await message();
if (!/Appended sphere/.test(msgE)) {
    throw new Error(`UI append did not report success: ${msgE}`);
}
// The new item must land in the final sphere alongside the goal. (A goal-only
// final sphere is reverted, so depth may stay the same — the item placement,
// not the depth, is what proves the append.)
const finalSphere = msgE.match(/S(\d+)=\[([^\]]*)\][^S]*$/);
if (!/extra_gem/.test(msgE) || !finalSphere || !finalSphere[2].includes('victory')) {
    throw new Error(`append didn't place the item in the final sphere: ${msgE}`);
}
console.log(`PHASE E2 OK: UI Append sphere placed the item in the goal sphere — ${msgE}`);

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:\n' + errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY SPHERE BATCH STEPPING: ALL OK');
await browser.close();
process.exit(0);
