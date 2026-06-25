/**
 * In-app smoke test for the STEPPED top-down pipeline (Phase 2). Drives the real
 * panel in a browser:
 *
 *   Phase A — pure stepping: load a source rules.json, then Run 1 Layout →
 *     2 Realise → 3 Finalize → 4 Compile, asserting the step indicator advances,
 *     each step's feedback block appears, and the compiled output shows.
 *   Phase B — Run all + Reset: Reset, then Generate (run all) and assert a
 *     terminal compiled result + the composite grid canvas.
 *   Phase C — substrate-assignment editor (Phase 4): after a full Generate,
 *     change a region's substrate dropdown at 1 Layout, assert the pipeline
 *     invalidated (4 feedback gone), re-run, and assert the realised substrate
 *     mix reflects the edit + 4 recompiles.
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

// Click the primary run button regardless of its label ("Generate" when idle /
// complete, "Run all (finish)" mid-pipeline).
const clickPrimary = () => page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    const b = root.querySelector('.procgen-pipeline-btn-primary');
    if (!b || b.disabled) return false;
    b.click();
    return true;
});

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? '✅' : '❌'} ${msg}`); };

// "Use currently-loaded …" checkboxes: present + checked by default.
const useLoadedState = () => page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    return [...root.querySelectorAll('.procgen-pipeline-use-loaded input[type=checkbox]')]
        .map((c) => c.checked);
});
const checksBefore = await useLoadedState();
assert(checksBefore.length === 2 && checksBefore.every(Boolean),
    `use-loaded checkboxes present + checked by default (got [${checksBefore}])`);

// Load the source via the file input — this should uncheck "Use currently-loaded
// rules.json".
await page.setInputFiles('.procgen-pipeline-source-input', SRC_PATH);
await page.waitForTimeout(800);
assert((await panelText()).includes('Loaded source'), 'source loaded');
const checksAfter = await useLoadedState();
assert(checksAfter[0] === false, 'browsing a rules file unchecked "Use currently-loaded rules.json"');

// Phase A — step through 1→4.
const steps = ['Run 1 Layout', 'Run 2 Realise', 'Run 3 Finalize', 'Run 4 Compile'];
for (const label of steps) {
    const clicked = await clickByText(label);
    assert(clicked, `clicked "${label}"`);
    await page.waitForTimeout(2500);
}
const afterSteps = await panelText();
assert(afterSteps.includes('1 Layout') && afterSteps.includes('4 Compile'), 'step indicator shows all four steps');
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
// (completed=3). Parse the 2 realise substrate counts, flip a LEAF region's
// substrate dropdown at 1, assert 4 invalidated, re-run 2→4, and assert the
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

// The edit invalidated 2..4 → the compile feedback is gone (completed rolled to 0).
assert(!/driver top-down/.test(await panelText()), 'Phase C: substrate edit invalidated 4');

// Re-run 2→4 (the per-step buttons; nextStep is now "2 Realise").
for (const label of ['Run 2 Realise', 'Run 3 Finalize', 'Run 4 Compile']) {
    assert(await clickByText(label), `Phase C: clicked "${label}"`);
    await page.waitForTimeout(2500);
}
assert(/driver top-down/.test(await panelText()), 'Phase C: 4 recompiled after re-run');

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

// Phase D — layout editor reuse (Phase 5). After Phase C re-ran 4, the grid is
// finalized+compiled, so the interactive map editor is live. Assert the radio
// offers only the two Move modes (no per-region Edit in top-down), then perform a
// Move Region edit via canvas clicks and confirm it invalidates 4 and recompiles.
const mapModes = await page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    return [...root.querySelectorAll('.procgen-pipeline-map-modes input[type=radio]')].map((r) => r.value);
});
assert(mapModes.length === 3 && mapModes.includes('moveRegion') && mapModes.includes('moveExit')
    && mapModes.includes('edit'),
`Phase D: map editor offers Edit/Move Region/Move Exits (got [${mapModes}])`);

// Select Move Region.
const pickedMode = await page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    const r = [...root.querySelectorAll('.procgen-pipeline-map-modes input[type=radio]')]
        .find((x) => x.value === 'moveRegion');
    if (!r) return false;
    r.click();
    return true;
});
assert(pickedMode, 'Phase D: selected Move Region mode');
await page.waitForTimeout(300);

// Classify cells as occupied/empty by sampling each cell's centre pixel — in a
// sparse grid the modal colour is the empty-cell background.
const cells = await page.evaluate(() => {
    const c = document.querySelector('.procgen-pipeline-canvas');
    if (!c) return null;
    const gw = +c.dataset.gridW; const gh = +c.dataset.gridH;
    const cw = +c.dataset.cellW; const ch = +c.dataset.cellH;
    const ctx = c.getContext('2d');
    const colourAt = (gx, gy) => {
        const px = ctx.getImageData(gx * cw + (cw >> 1), gy * ch + (ch >> 1), 1, 1).data;
        return `${px[0]},${px[1]},${px[2]}`;
    };
    const grid = [];
    const freq = {};
    for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
            const col = colourAt(gx, gy);
            grid.push({ gx, gy, col });
            freq[col] = (freq[col] ?? 0) + 1;
        }
    }
    const empty = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    return {
        gw, gh, cw, ch,
        occupied: grid.filter((g) => g.col !== empty).map(({ gx, gy }) => ({ gx, gy })),
        empties: grid.filter((g) => g.col === empty).map(({ gx, gy }) => ({ gx, gy })),
    };
});
assert(cells && cells.occupied.length >= 1 && cells.empties.length >= 1,
    `Phase D: found occupied (${cells?.occupied.length}) + empty (${cells?.empties.length}) cells`);

// Click an occupied cell, then an empty cell, to move the region there.
const clickCell = (gx, gy) => page.evaluate(({ gx, gy }) => {
    const c = document.querySelector('.procgen-pipeline-canvas');
    const cw = +c.dataset.cellW; const ch = +c.dataset.cellH;
    const rect = c.getBoundingClientRect();
    const clientX = rect.left + (gx * cw + cw / 2) * (rect.width / c.width);
    const clientY = rect.top + (gy * ch + ch / 2) * (rect.height / c.height);
    c.dispatchEvent(new MouseEvent('click', { clientX, clientY, bubbles: true }));
}, { gx, gy });

const src = cells.occupied[0];
const dst = cells.empties[0];
await clickCell(src.gx, src.gy);
await page.waitForTimeout(300);
assert(/Move Region: selected/.test(await panelText()), 'Phase D: first click selected a region');
await clickCell(dst.gx, dst.gy);
await page.waitForTimeout(400);
assert(/Moved the region|Swapped/.test(await panelText()), 'Phase D: second click moved the region');
assert(!/driver top-down/.test(await panelText()), 'Phase D: layout edit invalidated 4');

assert(await clickByText('Run 4 Compile'), 'Phase D: clicked "Run 4 Compile"');
await page.waitForTimeout(2500);
const afterMove = await panelText();
assert(/driver top-down/.test(afterMove), 'Phase D: 4 recompiled after the move');
assert(/\d+ regions/.test(afterMove), 'Phase D: compiled rules.json still reports a region count');

// Phases E/F run on a FRESH pipeline (Phase D left cellsByName intentionally
// stale after a layout move — Phase 5's design), so reset + regenerate first.
const findBtn = (txt, enabledOnly = false) => page.evaluate(({ txt, enabledOnly }) => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    const b = [...root.querySelectorAll('button')]
        .find((x) => x.textContent.trim() === txt && (!enabledOnly || !x.disabled));
    if (!b) return false;
    b.click();
    return true;
}, { txt, enabledOnly });

assert(await clickByText('Reset'), 'Phases E/F: reset to a clean pipeline');
await page.waitForTimeout(400);
assert(await clickPrimary(), 'Phases E/F: regenerated a fresh pipeline');
await page.waitForTimeout(6000);
assert(/driver top-down/.test(await panelText()), 'Phases E/F: fresh pipeline compiled');

// Phase E — per-region Re-roll 🎲 (Phase 6a). Bump a region's sub-seed → re-run.
assert(await findBtn('Re-roll 🎲'), 'Phase E: clicked a Re-roll 🎲 button');
await page.waitForTimeout(400);
assert(/Re-rolled/.test(await panelText()), 'Phase E: re-roll message appeared');
assert(!/driver top-down/.test(await panelText()), 'Phase E: re-roll invalidated 4');
assert(await clickPrimary(), 'Phase E: ran to completion after re-roll');
await page.waitForTimeout(6000);
const afterReroll = await panelText();
assert(/driver top-down/.test(afterReroll), 'Phase E: 4 recompiled after re-roll');
assert(/\d+ regions/.test(afterReroll), 'Phase E: compiled rules.json still reports a region count');

// Phase F — per-region Edit ▸ (Phase 6b). Needs a bounce region (only bounce has
// a region editor). If none was assigned, force one via the 1 substrate dropdown.
let hasBounceEdit = await page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    return [...root.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Edit ▸' && !b.disabled);
});
if (!hasBounceEdit) {
    const forced = await page.evaluate(() => {
        const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
        const sel = [...root.querySelectorAll('select.procgen-pipeline-td-substrate')]
            .find((s) => [...s.options].some((o) => o.value === 'bounce'));
        if (!sel) return false;
        sel.value = 'bounce';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    });
    assert(forced, 'Phase F: forced a region to bounce via the 1 dropdown');
    await page.waitForTimeout(400);
    assert(await clickPrimary(), 'Phase F: regenerated with the forced bounce region');
    await page.waitForTimeout(6000);
    hasBounceEdit = true;
}

assert(await findBtn('Edit ▸', true), 'Phase F: clicked an enabled Edit ▸ (bounce region)');
await page.waitForTimeout(800);
const editorOpened = await page.evaluate(() =>
    !!document.querySelector('.bounce-region-editor-panel'));
assert(editorOpened, 'Phase F: bounce region editor opened (contract built OK)');

const savedF = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.bounce-region-editor-panel .bre-btn')]
        .find((e) => e.textContent.trim() === 'Save');
    if (!b) return false;
    b.click();
    return true;
});
assert(savedF, 'Phase F: clicked Save in the editor');
await page.waitForTimeout(600);
assert(/Saved edits/.test(await panelText()), 'Phase F: editor save wrote back to the pipeline');
assert(await clickPrimary(), 'Phase F: re-run 34 after the edit');
await page.waitForTimeout(6000);
const afterEdit = await panelText();
assert(/driver top-down/.test(afterEdit), 'Phase F: 4 recompiled after the region edit');

const pageErrors = logs.filter((l) => l.startsWith('[pageerror]'));
assert(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
if (pageErrors.length) console.log(pageErrors.join('\n'));

// The panel loads in top-down mode (renders the source picker), which must not
// poke the sphereState singleton before it exists (peekSphereStateSingleton).
const sphereWarn = logs.filter((l) => l.includes('Singleton not yet created'));
assert(sphereWarn.length === 0, `no "[sphereState] Singleton not yet created" warning (${sphereWarn.length})`);

await browser.close();
console.log(failures.length ? `\n❌ ${failures.length} FAILURE(S)` : '\n✅ ALL PASS');
process.exit(failures.length ? 1 : 0);
