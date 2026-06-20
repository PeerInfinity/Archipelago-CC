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
txt = await panelText();
if (!txt.includes('②b Topology')) {
    throw new Error('topology feedback did not appear');
}
if (!txt.includes('└─') && !txt.includes('├─')) {
    throw new Error('②b topology tree glyphs (└─/├─) did not render');
}
console.log('STEP ②b: topology tree (with branch glyphs) shown');

// Toggle to flat view → glyphs gone; back to tree → glyphs return.
const toggled = await page.evaluate((v) => {
    const r = [...document.querySelectorAll(
        'input[name="procgen-pipeline-topology-view"]')].find((el) => el.value === v);
    if (!r) return false;
    r.click();
    return true;
}, 'flat');
if (!toggled) throw new Error('②b view toggle: flat radio not found');
await page.waitForTimeout(300);
if ((await panelText()).match(/[└├]─/)) {
    throw new Error('②b flat view still shows tree glyphs');
}
await page.evaluate((v) => {
    [...document.querySelectorAll('input[name="procgen-pipeline-topology-view"]')]
        .find((el) => el.value === v)?.click();
}, 'tree');
await page.waitForTimeout(300);
if (!(await panelText()).match(/[└├]─/)) {
    throw new Error('②b tree view did not restore glyphs');
}
console.log('STEP ②b: tree/flat view toggle works');
if (!(await panelText()).match(/gate .+\(S\d/)) {
    throw new Error('②b gate dropdown is missing sphere labels (S#)');
}
console.log('STEP ②b: gate dropdown shows sphere labels');

await clickBtn('Run ②c Items');
await page.waitForTimeout(600);
txt = await panelText();
if (!txt.includes('②c Item placement')) {
    throw new Error('item-placement feedback did not appear');
}
if (!txt.match(/\(S\d/)) {
    throw new Error('②c item rows are missing sphere labels (S#)');
}
console.log('STEP ②c: item-placement editor shown with sphere labels');

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

// ── Phase C: edit ②c item placement (move an item to another region) ─
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run ① Plan');
await page.waitForTimeout(400);
await clickBtn('Run ②a Allocate');
await page.waitForTimeout(300);
await clickBtn('Run ②b Topology');
await page.waitForTimeout(300);
await clickBtn('Run ②c Items');
await page.waitForTimeout(400);

const moved2c = await page.evaluate(() => {
    const headers = [...document.querySelectorAll(
        '.procgen-pipeline-panel .procgen-pipeline-scenario-subheader')];
    const h = headers.find((el) => el.textContent.includes('②c Item placement'));
    if (!h) return null;
    const block = h.parentElement;
    const sel = block.querySelector('select');
    if (!sel) return null;
    const cur = sel.value;
    const other = [...sel.options].find((o) => o.value !== cur);
    if (!other) return null;
    const name = sel.parentElement.querySelector('span')?.textContent ?? '';
    sel.value = other.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { name, from: cur, to: other.value };
});
if (!moved2c) throw new Error('②c editor: no item move dropdown found');
console.log(`PHASE C: moved "${moved2c.name}" from region #${moved2c.from} to #${moved2c.to}`);
await page.waitForTimeout(400);

await clickBtn('Run all (finish)');
await page.waitForTimeout(4000);
msg = await message();
console.log('PHASE C MESSAGE (moved item):', msg);
const terminalC = msg.includes('Sphere plan realised')
    || msg.includes('ORACLE MISMATCH') || msg.toLowerCase().includes('no host')
    || msg.startsWith('ERROR');
if (!terminalC) throw new Error(`②c edit Run all produced no terminal result: ${msg}`);
console.log('PHASE C OK: ②c item move flowed through to a terminal result');

// ── Phase D: edit ②a allocation (add a filler region) ───────────────
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run ① Plan');
await page.waitForTimeout(400);
await clickBtn('Run ②a Allocate');
await page.waitForTimeout(400);

const allocEdited = await page.evaluate(() => {
    const headers = [...document.querySelectorAll(
        '.procgen-pipeline-panel .procgen-pipeline-scenario-subheader')];
    const h = headers.find((el) => el.textContent.includes('②a Allocate'));
    if (!h) return false;
    const block = h.parentElement;
    const addFill = [...block.querySelectorAll('button')]
        .find((b) => b.textContent === '+fill' && !b.disabled);
    if (!addFill) return false;
    addFill.click();
    return true;
});
if (!allocEdited) throw new Error('②a editor: no +fill button found');
await page.waitForTimeout(400);
// The allocation feedback should now report at least one filler.
if (!(await panelText()).match(/\d+ filler\(s\)/)) {
    throw new Error('②a editor: filler count did not render after edit');
}
console.log('PHASE D: added a filler via ②a editor');

await clickBtn('Run all (finish)');
await page.waitForTimeout(4000);
msg = await message();
console.log('PHASE D MESSAGE (added filler):', msg);
const terminalD = msg.includes('Sphere plan realised')
    || msg.includes('ORACLE MISMATCH') || msg.toLowerCase().includes('no host')
    || msg.startsWith('ERROR');
if (!terminalD) throw new Error(`②a edit Run all produced no terminal result: ${msg}`);
console.log('PHASE D OK: ②a allocation edit flowed through to a terminal result');

// ── Phase E: edit ②b topology (re-gate a region off-wave) ───────────
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run ① Plan');
await page.waitForTimeout(400);
await clickBtn('Run ②a Allocate');
await page.waitForTimeout(300);
await clickBtn('Run ②b Topology');
await page.waitForTimeout(400);

const topoEdited = await page.evaluate(() => {
    const headers = [...document.querySelectorAll(
        '.procgen-pipeline-panel .procgen-pipeline-scenario-subheader')];
    const h = headers.find((el) => el.textContent.includes('②b Topology'));
    if (!h) return null;
    const block = h.parentElement;
    const gateSels = [...block.querySelectorAll('select')]
        .filter((s) => s.title === 'Entry gate item');
    // Re-gate the first gated, non-Victory region to Victory (a sphere-3
    // item) — off-wave for any earlier-wave region → stratification warning.
    for (const sel of gateSels) {
        const opt = [...sel.options].find((o) => o.value === 'Victory');
        if (opt && sel.value && sel.value !== 'Victory') {
            sel.value = 'Victory';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
    }
    return null;
});
if (!topoEdited) throw new Error('②b editor: no re-gateable region found');
await page.waitForTimeout(400);
const afterTopo = await panelText();
if (afterTopo.includes("isn't a sphere")) {
    console.log('PHASE E: stratification warning rendered after off-wave re-gate');
} else {
    console.log('PHASE E: re-gate applied (no off-wave warning — on-wave target)');
}

await clickBtn('Run all (finish)');
await page.waitForTimeout(4000);
msg = await message();
console.log('PHASE E MESSAGE (re-gated):', msg);
const terminalE = msg.includes('Sphere plan realised')
    || msg.includes('ORACLE MISMATCH') || msg.toLowerCase().includes('no host')
    || msg.startsWith('ERROR');
if (!terminalE) throw new Error(`②b edit Run all produced no terminal result: ${msg}`);
console.log('PHASE E OK: ②b topology edit flowed through to a terminal result');

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:', errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY SPHERE STEPS UI: ALL OK');
await browser.close();
process.exit(0);
