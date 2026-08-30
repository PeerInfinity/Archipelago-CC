/**
 * In-app smoke test for the STEPPED sphere-growth pipeline + plan editor.
 * Drives the real panel in a browser:
 *
 *   Phase A — pure stepping: Run 1 Plan (editor appears) → 2a Allocate
 *     → 2b Topology → 2c Items → 3 Build regions → 4 Compile, asserting
 *     each sub-step's feedback and the oracle success message at the end.
 *   Phase B — editing: Reset → Run 1 Plan → move a Sphere-1 item down a
 *     sphere (▼), assert the editor reflects the move and the pipeline
 *     reset to step 1, then Run all and assert a terminal result.
 *
 *   Phase K — RECORDED EDITS (editor-integration B-d): the gestures above are
 *     ops on the envelope, so the panel shows a history with a count and an
 *     Undo. Asserts the count grows by one per gesture, that Undo shrinks it
 *     and names what it undid, and that undoing everything returns the world
 *     the seed produces (the map's region signature) with the oracle clean.
 *
 * Phase H is a PIN rather than a variation row (editor-integration B-b):
 * measured, `keep` mode's contract pins this region against all eight settings
 * rungs the phase walks, so it asserts THAT and reds if one ever moves. The
 * varying regenerate lives in verify-region-step-editing's Phase F.
 *
 * Phase G′ (editor-integration B-b): the bounce editor's own UNDO — two ops in
 * the panel, two undos, a Save, and the region that reaches the grid is the
 * pre-edit one, with G's oracle still clean.
 *
 * Prereq: a dev server serving THIS worktree. Defaults to :8000; point it
 * elsewhere with PROCGEN_UI_HOST (e.g. PROCGEN_UI_HOST=http://localhost:8129)
 * or --host=<url>, so a session that does not own :8000 can run it.
 * Run: node scripts/procgen/verify-sphere-steps-ui.mjs
 */
import { chromium } from 'playwright';
import { takeBoxLockOrExit } from './boxLock.js';

/**
 * ⛓ R9 P3b, ⚖ 54 (7); ⚖ 62 at 12j — **THE BOX LOCK.** This instrument drives
 * the machine (browser), so it takes the box before it starts and refuses BY
 * NAME if another instrument holds it — replacing a hand-relayed "BOX BUSY".
 * A run UNDER a holder (`gates.mjs`, `standing-values`,
 * `rerecord-seedling-campaign`) recognises the holder's token and passes
 * through. `--wait-for-box=<sec>` queues instead of refusing.
 */

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'verify-sphere-steps-ui.mjs', kind: 'browser' });

// Derived host: --host=<url> wins, then PROCGEN_UI_HOST, then the :8000 default.
const HOST = (process.argv.find((a) => a.startsWith('--host='))?.slice(7)
    ?? process.env.PROCGEN_UI_HOST
    ?? 'http://localhost:8000').replace(/\/$/, '');

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

await page.goto(`${HOST}/frontend/`);
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
await clickBtn('Run 1 Plan');
await page.waitForTimeout(800);
let txt = await panelText();
if (!txt.includes('Starting items (sphere 0)') || !txt.includes('Sphere 1')) {
    throw new Error('plan editor did not appear after Run 1 Plan');
}
console.log('STEP 1: editor appeared with sphere groups');

await clickBtn('Run 2a Allocate');
await page.waitForTimeout(600);
if (!(await panelText()).includes('2a Allocate')) {
    throw new Error('allocate feedback did not appear');
}
console.log('STEP 2a: allocation feedback shown');

await clickBtn('Run 2b Topology');
await page.waitForTimeout(600);
txt = await panelText();
if (!txt.includes('2b Topology')) {
    throw new Error('topology feedback did not appear');
}
if (!txt.includes('└─') && !txt.includes('├─')) {
    throw new Error('2b topology tree glyphs (└─/├─) did not render');
}
console.log('STEP 2b: topology tree (with branch glyphs) shown');

// Toggle to flat view → glyphs gone; back to tree → glyphs return.
const toggled = await page.evaluate((v) => {
    const r = [...document.querySelectorAll(
        'input[name="procgen-pipeline-topology-view"]')].find((el) => el.value === v);
    if (!r) return false;
    r.click();
    return true;
}, 'flat');
if (!toggled) throw new Error('2b view toggle: flat radio not found');
await page.waitForTimeout(300);
if ((await panelText()).match(/[└├]─/)) {
    throw new Error('2b flat view still shows tree glyphs');
}
await page.evaluate((v) => {
    [...document.querySelectorAll('input[name="procgen-pipeline-topology-view"]')]
        .find((el) => el.value === v)?.click();
}, 'tree');
await page.waitForTimeout(300);
if (!(await panelText()).match(/[└├]─/)) {
    throw new Error('2b tree view did not restore glyphs');
}
console.log('STEP 2b: tree/flat view toggle works');
if (!(await panelText()).match(/gate .+\(S\d/)) {
    throw new Error('2b gate dropdown is missing sphere labels (S#)');
}
console.log('STEP 2b: gate dropdown shows sphere labels');

await clickBtn('Run 2c Items');
await page.waitForTimeout(600);
txt = await panelText();
if (!txt.includes('2c Item placement')) {
    throw new Error('item-placement feedback did not appear');
}
if (!txt.match(/\(S\d/)) {
    throw new Error('2c item rows are missing sphere labels (S#)');
}
console.log('STEP 2c: item-placement editor shown with sphere labels');

await clickBtn('Run 3 Build regions');
await page.waitForTimeout(3000);
if (!(await panelText()).includes('3 Build regions')) {
    throw new Error('regions feedback did not appear');
}
console.log('STEP 3: regions feedback shown');

await clickBtn('Run 4 Compile');
await page.waitForTimeout(1500);
let msg = await message();
console.log('STEP 4 MESSAGE:', msg);
if (!msg.includes('Sphere plan realised')) {
    throw new Error(`expected oracle success after step 4, got: ${msg}`);
}
console.log('PHASE A OK: stepped 1→2a→2b→2c→3→4 to a realised plan');

// ── Phase B: edit a Sphere-1 item, then run all ─────────────────────
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run 1 Plan');
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

// The edit should have reset the pipeline to step 1 (downstream stale).
const afterEdit = await panelText();
if (!afterEdit.includes('1 Plan')) throw new Error('step indicator missing after edit');

// After an edit the pipeline is back at step 1 (downstream stale), so
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

// ── Phase C: edit 2c item placement (move an item to another region) ─
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run 1 Plan');
await page.waitForTimeout(400);
await clickBtn('Run 2a Allocate');
await page.waitForTimeout(300);
await clickBtn('Run 2b Topology');
await page.waitForTimeout(300);
await clickBtn('Run 2c Items');
await page.waitForTimeout(400);

const moved2c = await page.evaluate(() => {
    const headers = [...document.querySelectorAll(
        '.procgen-pipeline-panel .procgen-pipeline-scenario-subheader')];
    const h = headers.find((el) => el.textContent.includes('2c Item placement'));
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
if (!moved2c) throw new Error('2c editor: no item move dropdown found');
console.log(`PHASE C: moved "${moved2c.name}" from region #${moved2c.from} to #${moved2c.to}`);
await page.waitForTimeout(400);

await clickBtn('Run all (finish)');
await page.waitForTimeout(4000);
msg = await message();
console.log('PHASE C MESSAGE (moved item):', msg);
const terminalC = msg.includes('Sphere plan realised')
    || msg.includes('ORACLE MISMATCH') || msg.toLowerCase().includes('no host')
    || msg.startsWith('ERROR');
if (!terminalC) throw new Error(`2c edit Run all produced no terminal result: ${msg}`);
console.log('PHASE C OK: 2c item move flowed through to a terminal result');

// ── Phase D: edit 2a allocation (add a filler region) ───────────────
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run 1 Plan');
await page.waitForTimeout(400);
await clickBtn('Run 2a Allocate');
await page.waitForTimeout(400);

const allocEdited = await page.evaluate(() => {
    const headers = [...document.querySelectorAll(
        '.procgen-pipeline-panel .procgen-pipeline-scenario-subheader')];
    const h = headers.find((el) => el.textContent.includes('2a Allocate'));
    if (!h) return false;
    const block = h.parentElement;
    const addFill = [...block.querySelectorAll('button')]
        .find((b) => b.textContent === '+fill' && !b.disabled);
    if (!addFill) return false;
    addFill.click();
    return true;
});
if (!allocEdited) throw new Error('2a editor: no +fill button found');
await page.waitForTimeout(400);
// The allocation feedback should now report at least one filler.
if (!(await panelText()).match(/\d+ filler\(s\)/)) {
    throw new Error('2a editor: filler count did not render after edit');
}
console.log('PHASE D: added a filler via 2a editor');

await clickBtn('Run all (finish)');
await page.waitForTimeout(4000);
msg = await message();
console.log('PHASE D MESSAGE (added filler):', msg);
const terminalD = msg.includes('Sphere plan realised')
    || msg.includes('ORACLE MISMATCH') || msg.toLowerCase().includes('no host')
    || msg.startsWith('ERROR');
if (!terminalD) throw new Error(`2a edit Run all produced no terminal result: ${msg}`);
console.log('PHASE D OK: 2a allocation edit flowed through to a terminal result');

// ── Phase E: edit 2b topology (re-gate a region off-wave) ───────────
await clickBtn('Reset');
await page.waitForTimeout(300);
await clickBtn('Run 1 Plan');
await page.waitForTimeout(400);
await clickBtn('Run 2a Allocate');
await page.waitForTimeout(300);
await clickBtn('Run 2b Topology');
await page.waitForTimeout(400);

const topoEdited = await page.evaluate(() => {
    const headers = [...document.querySelectorAll(
        '.procgen-pipeline-panel .procgen-pipeline-scenario-subheader')];
    const h = headers.find((el) => el.textContent.includes('2b Topology'));
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
if (!topoEdited) throw new Error('2b editor: no re-gateable region found');
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
if (!terminalE) throw new Error(`2b edit Run all produced no terminal result: ${msg}`);
console.log('PHASE E OK: 2b topology edit flowed through to a terminal result');

// ── helpers for the 3 editing phases ────────────────────────────────
// The map's signature, read the only way the page offers one: a hash of the
// composite canvas the panel just drew. It moves for a placement change AND for
// a re-rolled interior, and needs no new instrumentation on the panel.
// ⚠ Phases G′ and K both read it, so it lives with the helpers rather than in
// the phase that happened to need it first.
const mapSig = () => page.evaluate(() => {
    const c = document.querySelector('.procgen-pipeline-canvas');
    if (!c) return null;
    const url = c.toDataURL();
    let h = 0;
    for (let i = 0; i < url.length; i += 1) h = (h * 31 + url.charCodeAt(i)) | 0;
    return `${url.length}:${h}`;
});

function goTab(title) {
    return page.evaluate((t) => {
        const x = [...document.querySelectorAll('.lm_tab')].find((e) => e.title === t);
        if (!x) return false;
        x.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        x.click();
        return true;
    }, title);
}
async function stepToCompiled() {
    await clickBtn('Reset');
    await page.waitForTimeout(300);
    for (const s of ['Run 1 Plan', 'Run 2a Allocate', 'Run 2b Topology',
        'Run 2c Items', 'Run 3 Build regions', 'Run 4 Compile']) {
        await clickBtn(s);
        await page.waitForTimeout(s.includes('3') ? 3000 : 600);
    }
}

// ── Phase F: 3 Re-roll a region (geometry re-rolls; oracle still holds) ─
await stepToCompiled();
let baseMsg = await message();
if (!baseMsg.includes('Sphere plan realised')) throw new Error(`F: baseline not realised: ${baseMsg}`);
const rerolled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.procgen-pipeline-panel button')]
        .find((e) => e.textContent.trim() === 'Re-roll 🎲' && !e.disabled);
    if (!b) return false;
    b.click();
    return true;
});
if (!rerolled) throw new Error('F: no Re-roll 🎲 button found');
await page.waitForTimeout(400);
if (!(await message()).includes('Re-rolled')) throw new Error('F: re-roll message did not appear');
console.log('PHASE F: re-rolled a region');
await clickBtn('Run 4 Compile');
await page.waitForTimeout(2000);
let fMsg = await message();
if (!fMsg.includes('Sphere plan realised')) {
    throw new Error(`F: oracle failed after re-roll + 4: ${fMsg}`);
}
console.log('PHASE F OK: re-roll kept the oracle (exits/plan preserved)');

// ── Phase G: 3 Edit ▸ → pipeline editor → Save → re-run 4 (oracle holds) ─
const openedEditor = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.procgen-pipeline-panel button')]
        .find((e) => e.textContent.trim() === 'Edit ▸');
    if (!b) return false;
    b.click();
    return true;
});
if (!openedEditor) throw new Error('G: no Edit ▸ button found');
await page.waitForTimeout(1200);
const editorTitle = await page.evaluate(() =>
    document.querySelector('.bounce-region-editor-panel .bre-title')?.textContent ?? '');
if (!/\[pipeline\]/.test(editorTitle)) {
    throw new Error(`G: editor did not open in pipeline mode: "${editorTitle}"`);
}
console.log('PHASE G: editor opened in pipeline mode —', editorTitle);
const savedG = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.bounce-region-editor-panel .bre-btn')]
        .find((e) => e.textContent.trim() === 'Save');
    if (!b) return false;
    b.click();
    return true;
});
if (!savedG) throw new Error('G: no Save button in the editor');
await page.waitForTimeout(700);
const saveMsg = await page.evaluate(() =>
    document.querySelector('.bounce-region-editor-panel .bre-message')?.textContent ?? '');
if (!saveMsg.includes('back to the pipeline')) {
    throw new Error(`G: editor save did not write back: "${saveMsg}"`);
}
await goTab('Procgen Pipeline');
await page.waitForTimeout(800);
await clickBtn('Run 4 Compile');
await page.waitForTimeout(2000);
const gMsg = await message();
if (!gMsg.includes('Sphere plan realised')) {
    throw new Error(`G: oracle failed after editor save + 4: ${gMsg}`);
}
console.log('PHASE G OK: Edit ▸ → pipeline save → 4 kept the oracle');

// ── Phase G′: the editor's own UNDO (editor-integration B-b) ────────────
//
// ⛓⛓⛓ The bounce editor's eight mutators are ops on an `editCore` session
// now, so UNDO is the fold over a shorter list. This phase asks the whole
// chain in the REAL panel: two edits, two undos, then a Save — and the region
// that reaches the grid must be the one that was there before Edit ▸.
//
// ⛔ The map signature alone would be a vacuous row (nothing moved, so of
// course it came back). The editor's own counts readout is the positive
// control: it must MOVE on the two ops and RETURN on the two undos, inside the
// panel, before the Save is worth anything.
const breCounts = () => page.evaluate(() =>
    document.querySelector('.bounce-region-editor-panel .bre-counts')?.textContent ?? '');
const breUndoLabel = () => page.evaluate(() => {
    const b = document.querySelector('.bounce-region-editor-panel .bre-undo');
    return b ? `${b.textContent.trim()}${b.disabled ? ' [disabled]' : ''}` : '(absent)';
});
const breClick = (label) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('.bounce-region-editor-panel .bre-btn')]
        .find((e) => e.textContent.trim().startsWith(t));
    if (!b || b.disabled) return false;
    b.click();
    return true;
}, label);

const sigBeforeEdit = await mapSig();
const openedGp = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.procgen-pipeline-panel button')]
        .find((e) => e.textContent.trim() === 'Edit ▸');
    if (!b) return false;
    b.click();
    return true;
});
if (!openedGp) throw new Error("G': no Edit ▸ button found");
await page.waitForTimeout(1200);

const gpZero = await breUndoLabel();
if (!/^↶ Undo \(0 edit\(s\)\) \[disabled\]$/.test(gpZero)) {
    throw new Error(`G': a fresh session should offer a DISABLED undo of 0, got "${gpZero}"`);
}
const countsBefore = await breCounts();

for (const n of [1, 2]) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await breClick('+ platform'))) throw new Error(`G': + platform #${n} did not click`);
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(250);
}
const gpTwo = await breUndoLabel();
if (!/^↶ Undo \(2 edit\(s\)\)$/.test(gpTwo)) {
    throw new Error(`G': two ops should read as 2 edits on an ENABLED undo, got "${gpTwo}"`);
}
const countsEdited = await breCounts();
if (countsEdited === countsBefore) {
    throw new Error(`G': the two ops moved NOTHING — the row would be vacuous ("${countsBefore}")`);
}
console.log(`PHASE G': 2 ops recorded — "${countsBefore}" → "${countsEdited}"`);

// ⛓⛓ **Ctrl+Z INSIDE A NUMBER INPUT IS NOT AN UNDO.** The sidebar is built
// out of number fields, and a browser's own undo inside one is what a person
// means by ⌘Z while their cursor is in it. The key handler lives on the panel
// ROOT and the event bubbles, so the guard is the only thing between the two.
const breKey = (where) => page.evaluate((w) => {
    const root = document.querySelector('.bounce-region-editor-panel');
    if (!root) return 'no panel';
    const el = w === 'input'
        ? root.querySelector('input[type="number"]')
        : root;
    if (!el) return 'no target';
    if (w !== 'input') el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'z', ctrlKey: true, bubbles: true, cancelable: true,
    }));
    return 'sent';
}, where);

if ((await breKey('input')) !== 'sent') throw new Error("G': no number input to type Ctrl+Z into");
await page.waitForTimeout(250);
const gpInInput = await breUndoLabel();
if (!/^↶ Undo \(2 edit\(s\)\)$/.test(gpInInput)) {
    throw new Error(`G': Ctrl+Z inside a number input UNDID a document edit — "${gpInInput}"`);
}
if ((await breKey('root')) !== 'sent') throw new Error("G': could not send Ctrl+Z to the root");
await page.waitForTimeout(250);
const gpAfterKey = await breUndoLabel();
if (!/^↶ Undo \(1 edit\(s\)\)$/.test(gpAfterKey)) {
    throw new Error(`G': Ctrl+Z on the focused panel root did not undo — "${gpAfterKey}"`);
}
console.log("PHASE G': Ctrl+Z is refused inside a number input and honoured on the root");

for (const n of [1]) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await breClick('↶ Undo'))) throw new Error(`G': undo #${n} did not click`);
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(250);
}
const gpBack = await breUndoLabel();
if (!/^↶ Undo \(0 edit\(s\)\) \[disabled\]$/.test(gpBack)) {
    throw new Error(`G': undo ×2 should empty the list, got "${gpBack}"`);
}
const countsBack = await breCounts();
if (countsBack !== countsBefore) {
    throw new Error(`G': undo ×2 did not restore the level — "${countsBefore}" vs "${countsBack}"`);
}
// ⛓ **NO "selected: pN" FOR A PLATFORM THE LEVEL DOES NOT HOLD.** Each
// `+ platform` SELECTS the platform it made (the `value` the session forwards),
// so after undoing both, the sidebar must be back at its hint.
//
// ⚠ **THIS ROW DOES NOT GATE `_resolveSelection`, AND SAYING SO IS THE POINT.**
// The mutant that made that method a no-op came back GREEN: every reader of
// `_selectedId` resolves by `find`, so a stale id renders exactly as no
// selection. What this row gates is the SIDEBAR's fallback; the guard itself is
// prophylactic and the panel's own docblock says which hazard it removes.
const breSelection = () => page.evaluate(() => [...document
    .querySelectorAll('.bounce-region-editor-panel .bre-edit-block')]
    .map((b) => b.textContent).join(' | '));
const gpSel = await breSelection();
if (/selected: /.test(gpSel)) {
    throw new Error(`G': _selectedId survived the undo of its own add-platform — "${gpSel}"`);
}
if (!/Click a platform to edit it\./.test(gpSel)) {
    throw new Error(`G': the platform block did not fall back to its hint — "${gpSel}"`);
}

if (!(await breClick('Save'))) throw new Error("G': no Save button in the editor");
await page.waitForTimeout(700);
const gpSaveMsg = await page.evaluate(() =>
    document.querySelector('.bounce-region-editor-panel .bre-message')?.textContent ?? '');
if (!gpSaveMsg.includes('back to the pipeline')) {
    throw new Error(`G': editor save did not write back: "${gpSaveMsg}"`);
}
await goTab('Procgen Pipeline');
await page.waitForTimeout(800);
await clickBtn('Run 4 Compile');
await page.waitForTimeout(2000);
const gpMsg = await message();
if (!gpMsg.includes('Sphere plan realised')) {
    throw new Error(`G': oracle failed after undo ×2 + save + 4: ${gpMsg}`);
}
const sigAfterUndo = await mapSig();
if (sigBeforeEdit && sigAfterUndo && sigBeforeEdit !== sigAfterUndo) {
    throw new Error("G': the region that reached the grid is NOT the pre-edit region");
}
console.log("PHASE G' OK: 2 ops → undo ×2 → save → the pre-edit region reached the grid, "
    + 'oracle clean');

// ── Phase H: 3 Edit ▸ → editor Regenerate (keep) → Save → 4 (oracle holds) ─
const openedH = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.procgen-pipeline-panel button')]
        .find((e) => e.textContent.trim() === 'Edit ▸');
    if (!b) return false;
    b.click();
    return true;
});
if (!openedH) throw new Error('H: no Edit ▸ button found');
await page.waitForTimeout(1000);
// Expand the "Region generation" section, bump the seed, Regenerate.
const expanded = await page.evaluate(() => {
    const h = [...document.querySelectorAll('.bounce-region-editor-panel .bre-collapsible')]
        .find((e) => e.textContent.includes('Region generation'));
    if (!h) return false;
    h.click();
    return true;
});
if (!expanded) throw new Error('H: "Region generation" section header not found');
await page.waitForTimeout(300);
/**
 * ⛓⛓⛓ **WHAT THIS ROW ACTUALLY MEASURES** (editor-integration B-b).
 *
 * ⛔ **IT WAS VACUOUS.** It bumped the seed to one value and asserted the
 * oracle survived the regenerate — over a regenerate that produced a level
 * IDENTICAL to the one already loaded. Invisible for as long as the panel
 * printed *"Regenerated"* unconditionally; the editor's session prints
 * *"No change"* now (an op that moves no bytes is not an edit, through the
 * adapter's own `equal`), which is what exposed it.
 *
 * ⛔⛔ **AND IT CANNOT BE FIXED BY PICKING A BETTER KNOB — MEASURED.** Eight
 * rungs of the panel's own settings (five seeds, two decor chances, a jitter)
 * ALL leave the level unchanged for this region. The reason is `keep` mode:
 * the generator is handed the region's real `exitSpecs`/`locationSpecs`, whose
 * requirements constrain `generateLevelFromSpecs`' proposal loop, and a
 * contract this tight admits ONE proposal shape. So the browser row asserts
 * what is true here — **the contract PINS the level against every knob the
 * panel offers** — and names the ladder it walked, rather than asserting a
 * variation it cannot produce.
 *
 * ⇒ THE VARYING REGENERATE IS `verify-region-step-editing.mjs`'s PHASE F,
 * which regenerates a LESS constrained region and carries its own non-vacuity
 * assertion (`platSig(after) !== sig0`). This row is the browser half: the
 * panel's Regenerate ▸ Save path, end to end, with the oracle at the end of it.
 */
const setNumField = (label, value) => page.evaluate(({ l, v }) => {
    const row = [...document.querySelectorAll('.bounce-region-editor-panel .bre-field')]
        .find((r) => r.querySelector('span')?.textContent === l);
    const inp = row?.querySelector('input');
    if (!inp) return false;
    inp.value = String(v);
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}, { l: label, v: value });

const LADDER = [
    ['seed', 24680], ['seed', 3], ['seed', 7], ['seed', 101], ['seed', 999983],
    ['decor jetpack', 0.8], ['decor fork', 0.8], ['jitter', 80],
];
const hCountsBefore = await breCounts();
let regenMsg = '';
const hMoved = [];
let hRan = 0;
for (const [label, value] of LADDER) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await setNumField(label, value))) throw new Error(`H: no "${label}" field in settings`);
    // eslint-disable-next-line no-await-in-loop
    const clicked = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.bounce-region-editor-panel .bre-btn')]
            .find((e) => e.textContent.trim().startsWith('Regenerate'));
        if (!b) return false;
        b.click();
        return true;
    });
    if (!clicked) throw new Error('H: no Regenerate button');
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(800);
    // eslint-disable-next-line no-await-in-loop
    regenMsg = await page.evaluate(() =>
        document.querySelector('.bounce-region-editor-panel .bre-message')?.textContent ?? '');
    if (/^Regenerate failed/.test(regenMsg)) continue;
    if (!regenMsg.includes('Regenerated')) throw new Error(`H: regenerate did not run: "${regenMsg}"`);
    hRan += 1;
    if (!/^No change/.test(regenMsg)) hMoved.push(`${label}=${value}`);
}
if (hRan === 0) throw new Error(`H: no rung of the ladder even RAN the generator — "${regenMsg}"`);
/**
 * ⛔ **THE PIN.** Every rung that ran reported a no-op, and that is the claim.
 * The day one of them moves the level this row REDS — and it should: the
 * contract will have stopped pinning the region, which is exactly when "the
 * oracle survived the regenerate" starts meaning something and this row wants
 * re-measuring with the rung that moved it.
 */
if (hMoved.length) {
    throw new Error(`H: the contract no longer PINS this region — [${hMoved.join(', ')}] moved `
        + 'the level, where B-b measured all 8 rungs as no-ops. Re-measure this row: use the '
        + 'rung that moved it and assert the counts readout changes, the way '
        + "verify-region-step-editing's Phase F does.");
}
const hCountsAfter = await breCounts();
if (hCountsAfter !== hCountsBefore) {
    throw new Error(`H: the session reported ${hRan} no-ops but the level READ differently — `
        + `"${hCountsBefore}" → "${hCountsAfter}"`);
}
console.log(`PHASE H: the keep-mode contract PINS this region — ${hRan}/${LADDER.length} `
    + `settings rungs all no-ops ("${hCountsAfter}")`);
await page.evaluate(() => {
    [...document.querySelectorAll('.bounce-region-editor-panel .bre-btn')]
        .find((e) => e.textContent.trim() === 'Save')?.click();
});
await page.waitForTimeout(700);
await goTab('Procgen Pipeline');
await page.waitForTimeout(800);
await clickBtn('Run 4 Compile');
await page.waitForTimeout(2000);
const hMsg = await message();
if (!hMsg.includes('Sphere plan realised')) {
    throw new Error(`H: oracle failed after regenerate + save + 4: ${hMsg}`);
}
console.log('PHASE H OK: editor Regenerate (keep) → save → 4 kept the oracle '
    + '(the VARYING regenerate is verify-region-step-editing Phase F)');

// ── Phase I: composite-map mode radio renders + switches without error ──
// (The two-click canvas gestures can't be driven headless — the GL panel
// isn't laid out, so getBoundingClientRect is 0 — so the move/swap LOGIC is
// covered by verify-region-step-editing's engine cases G/H; here we just
// confirm the radio is present and mode-switching is wired.)
const mapModes = await page.evaluate(() =>
    [...document.querySelectorAll('input[name="procgen-pipeline-map-mode"]')].map((r) => r.value));
if (!['edit', 'moveRegion', 'moveExit'].every((m) => mapModes.includes(m))) {
    throw new Error(`I: map-mode radio missing options, got: ${mapModes.join(',')}`);
}
const switched = await page.evaluate(() => {
    const r = [...document.querySelectorAll('input[name="procgen-pipeline-map-mode"]')]
        .find((x) => x.value === 'moveRegion');
    if (!r) return false;
    r.click();
    return document.querySelector('input[name="procgen-pipeline-map-mode"]:checked')?.value === 'moveRegion';
});
if (!switched) throw new Error('I: could not switch map mode to moveRegion');
console.log('PHASE I OK: composite-map mode radio (Edit/Move Region/Move Exits) renders + switches');

// ── Phase J: 3 per-region substrate override (not limited by the quota mix) ──
// Quotas are bounce-only (substrateQuotas { bounce: 99 }), so the 3 override
// dropdown must still offer 'maze' (a sphere-capable substrate not in the mix).
await stepToCompiled();
const subDropdowns = await page.evaluate(() => {
    const sels = [...document.querySelectorAll('.procgen-pipeline-region-substrate')];
    return {
        count: sels.length,
        firstOpts: sels[0] ? [...sels[0].options].map((o) => o.value) : [],
    };
});
if (subDropdowns.count === 0) throw new Error('J: no 3 region substrate dropdown found');
if (!subDropdowns.firstOpts.includes('maze')) {
    throw new Error(`J: dropdown is quota-limited — missing 'maze' (got ${subDropdowns.firstOpts.join(',')})`);
}
console.log(`PHASE J: 3 substrate dropdowns present (${subDropdowns.count}); `
    + `offer non-quota substrates [${subDropdowns.firstOpts.join(',')}]`);

// Override a region to maze (not in the quota mix), re-run, confirm oracle holds.
await page.evaluate(() => {
    const sel = document.querySelector('.procgen-pipeline-region-substrate');
    sel.value = 'maze';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(400);
if (!(await message()).includes('substrate → maze')) {
    throw new Error(`J: substrate-change message did not appear: ${await message()}`);
}
await clickBtn('Run all (finish)');
await page.waitForTimeout(2500);
const jMsg = await message();
if (!jMsg.includes('Sphere plan realised')) {
    throw new Error(`J: oracle failed after substrate override + re-run: ${jMsg}`);
}
console.log('PHASE J OK: per-region substrate override (bounce→maze) re-realised + kept the oracle');

// ── Phase K: the recorded edit history + Undo (editor-integration B-d) ──────
// Every gesture above is now an OP on the envelope, not a mutate-and-forget.
// The panel renders the list with a count and an Undo, and undoing everything
// must return the world the seed produces — determinism is the guarantee.
// ⚠ Phase J ends on "Run all (finish)", after which the panel's buttons stay
// disabled while the run drains. Wait for Reset to come back rather than
// assuming a fixed sleep is enough.
for (let i = 0; i < 40; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ready = await page.evaluate(() => [...document.querySelectorAll('.procgen-pipeline-panel button')]
        .some((el) => el.textContent.trim() === 'Reset' && !el.disabled));
    if (ready) break;
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(500);
}
await stepToCompiled();

const history = () => page.evaluate(() => ({
    count: Number((document.querySelector('.procgen-pipeline-edit-count')?.textContent ?? '')
        .replace(/\D+/g, '') || 0),
    rows: [...document.querySelectorAll('.procgen-pipeline-edit-row')].map((r) => r.textContent),
    hasUndo: !!document.querySelector('.procgen-pipeline-edit-undo'),
}));
const k0 = await history();
if (k0.count !== 0) throw new Error(`K: expected an empty history, got ${k0.count}`);
const sigClean = await mapSig();

// One re-roll, through the panel's own button.
await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Re-roll'));
    b?.click();
});
await page.waitForTimeout(500);
const k1 = await history();
if (k1.count !== 1) throw new Error(`K: history did not record the re-roll (count ${k1.count})`);
if (!k1.hasUndo) throw new Error('K: no Undo control after the first edit');
if (!/Re-rolled/.test(k1.rows[0] ?? '')) throw new Error(`K: history row reads "${k1.rows[0]}"`);
console.log(`PHASE K: the re-roll RECORDED — "${k1.rows[0]}"`);

// Undo it and re-run: the map must come back to what the seed produces.
await page.evaluate(() => {
    document.querySelector('.procgen-pipeline-edit-undo')?.click();
});
await page.waitForTimeout(400);
const kUndoMsg = await message();
if (!kUndoMsg.startsWith('Undid:')) throw new Error(`K: undo message reads "${kUndoMsg}"`);
const k2 = await history();
if (k2.count !== 0) throw new Error(`K: history did not shrink on undo (count ${k2.count})`);
await clickBtn('Run all (finish)');
await page.waitForTimeout(2500);
const kMsg = await message();
if (!kMsg.includes('Sphere plan realised')) {
    throw new Error(`K: oracle failed after undo + re-run: ${kMsg}`);
}
const sigBack = await mapSig();
if (sigClean && sigBack && sigClean !== sigBack) {
    throw new Error('K: undo did not return the never-edited map');
}
console.log('PHASE K OK: record → undo → re-run returns the never-edited world, oracle clean');


const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
    console.log('PAGE ERRORS:', errors.join('\n'));
    process.exit(1);
}
console.log('VERIFY SPHERE STEPS UI: ALL OK');
await browser.close();
process.exit(0);
