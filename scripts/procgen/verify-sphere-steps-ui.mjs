/**
 * In-app smoke test for the STEPPED sphere-growth pipeline + plan editor.
 * Drives the real panel in a browser:
 *
 *   Phase A — pure stepping: Run ① Plan (editor appears) → ②a Allocate
 *     → ②b Topology → ②c Items → ③ Build regions → ④ Compile, asserting
 *     each sub-step's feedback and the oracle success message at the end.
 *   Phase B — editing: Reset → Run ① Plan → move a Sphere-1 item down a
 *     sphere (▼), assert the editor reflects the move and the pipeline
 *     reset to step ①, then Run all and assert a terminal result.
 *
 * Prereq: dev server on :8000. Run: node scripts/procgen/verify-sphere-steps-ui.mjs
 */
import { chromium } from 'playwright';

const SEED = 1;
const ITEM_POOL = {
    'Right arrow': 1, 'Left arrow': 1, Springs: 1, Jetpacks: 1,
    'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
};
const PANEL_PARAMS = {
    seed: SEED, regionWidth: 8, regionHeight: 6, maxItemsPerRegion: 2,
    sphereCount: 3, fillerCount: 0, revisitPercent: 25,
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
        substrateQuotas: { bounce: 99 }, substrateMix: {}, substrateMode: 'quotas',
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

const panel = page.locator('.procgen-pipeline-panel');
if (await panel.count() === 0) throw new Error('procgen pipeline panel not found');

async function panelText() {
    // textContent (not innerText) — the GoldenLayout panel may not be
    // laid out in headless, so innerText returns '' for hidden subtrees.
    return page.evaluate(() => document.querySelector('.procgen-pipeline-panel')?.textContent ?? '');
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

// ── Phase A: pure stepping ──────────────────────────────────────────
await clickBtn('Run ① Plan');
await page.waitForTimeout(800);
let txt = await panelText();
if (!txt.includes('Starting items (sphere 0)') || !txt.includes('Sphere 1')) {
    throw new Error('plan editor did not appear after Run ① Plan');
}
console.log('STEP ①: editor appeared with sphere groups');

await clickBtn('Run ②a Allocate');
await page.waitForTimeout(600);
if (!(await panelText()).includes('②a Allocate')) {
    throw new Error('allocate feedback did not appear');
}
console.log('STEP ②a: allocation feedback shown');

await clickBtn('Run ②b Topology');
await page.waitForTimeout(600);
if (!(await panelText()).includes('②b Topology')) {
    throw new Error('topology feedback did not appear');
}
console.log('STEP ②b: topology feedback shown');

await clickBtn('Run ②c Items');
await page.waitForTimeout(600);
if (!(await panelText()).includes('②c Item placement')) {
    throw new Error('item-placement feedback did not appear');
}
console.log('STEP ②c: item-placement feedback shown');

await clickBtn('Run ③ Build regions');
await page.waitForTimeout(3000);
if (!(await panelText()).includes('③ Build regions')) {
    throw new Error('regions feedback did not appear');
}
console.log('STEP ③: regions feedback shown');

await clickBtn('Run ④ Compile');
await page.waitForTimeout(1500);
let msg = await message();
console.log('STEP ④ MESSAGE:', msg);
if (!msg.includes('Sphere plan realised')) {
    throw new Error(`expected oracle success after step ④, got: ${msg}`);
}
console.log('PHASE A OK: stepped ①→②a→②b→②c→③→④ to a realised plan');

// ── Phase B: edit a Sphere-1 item, then run all ─────────────────────
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run ① Plan');
await page.waitForTimeout(600);

// Move the first Sphere-1 item down one sphere (▼).
const moved = await page.evaluate(() => {
    const headers = [...document.querySelectorAll('.procgen-pipeline-scenario-subheader')];
    const h = headers.find((el) => el.textContent.trim().startsWith('Sphere 1'));
    if (!h) return null;
    const group = h.parentElement;
    const down = [...group.querySelectorAll('button')]
        .find((b) => b.textContent === '▼' && !b.disabled);
    if (!down) return null;
    const name = down.parentElement.querySelector('span')?.textContent ?? '';
    down.click();
    return name;
});
if (!moved) throw new Error('no movable Sphere-1 item found');
console.log('PHASE B: moved Sphere-1 item down:', moved);
await page.waitForTimeout(400);

// The edit should have reset the pipeline to step ① (downstream stale).
const afterEdit = await panelText();
if (!afterEdit.includes('① Plan')) throw new Error('step indicator missing after edit');

// After an edit the pipeline is back at step ① (downstream stale), so
// the primary button reads "Run all (finish)".
await clickBtn('Run all (finish)');
await page.waitForTimeout(4000);
msg = await message();
console.log('PHASE B MESSAGE (edited plan):', msg);
const terminal = msg.includes('Sphere plan realised')
    || msg.includes('ORACLE MISMATCH') || msg.toLowerCase().includes('no host')
    || msg.startsWith('ERROR');
if (!terminal) throw new Error(`edited-plan Run all produced no terminal result: ${msg}`);
// Prove the edited draft was used: the moved item must NOT still be in
// the S1 bucket of a realised plan (it moved to S2+).
if (msg.includes('Sphere plan realised')) {
    const s1 = msg.match(/S1=\[([^\]]*)\]/)?.[1] ?? '';
    if (s1.split(', ').map((s) => s.trim()).includes(moved.replace(' ★', ''))) {
        throw new Error(`edited item "${moved}" still in S1 — edit did not flow through`);
    }
    console.log('PHASE B OK: edited plan realised, moved item left S1');
} else {
    console.log('PHASE B OK: edited plan produced a terminal warn/error (warn-but-allow):', msg);
}

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:', errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY SPHERE STEPS UI: ALL OK');
await browser.close();
process.exit(0);
