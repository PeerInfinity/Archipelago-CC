/**
 * In-app UI verification for the region-library panel (region-library F3/F5).
 * Drives the REAL Procgen Pipeline panel in a browser and proves the DOM wiring
 * assembles the same spiral world the headless loader does:
 *
 *   Phase A — F3 selection + generate: switch to shuffled-spiral, tick the
 *     committed served demo-maze-pack, set its region count, mix in a procedural
 *     maze quota, Generate, and assert the downloaded rules.json === the headless
 *     buildLibrarySpiralConfig + arrangeShuffledSpiral + buildRulesJson for the
 *     identical config. (Same equality verify-region-library-roundtrip.mjs proves
 *     headlessly — here proven THROUGH the panel's checkbox/count controls.)
 *   Phase B — hybrid persistence: reload the page; the served reference re-fetches
 *     into the working selection (no re-ticking), and Generate STILL === the same
 *     headless world.
 *   Phase C — F5 capture: open a generated region, "Save to library", and assert
 *     the downloaded working-library JSON validates + re-instantiates.
 *   Phase D — sphere-growth library wiring (F6d + F6c): a fresh context in sphere
 *     mode proves the Region-libraries subsection now renders there, both the bounce
 *     AND maze packs are selectable (F6c made maze/runner sphere-capable), ticking a
 *     maze pack surfaces the connection toggles (default best-effort), and
 *     ticking the bounce library flows its content source into the sphere config —
 *     the grown world changes materially vs the same seed/params with NO library
 *     (i.e. the selection reached the engine's resolveSphereLibrarySources). The
 *     engine's correct PLACEMENT of that content is separately proven headlessly
 *     (verify-region-library-sphere-roundtrip.mjs + sphereLibrary.slow.test.js);
 *     Phase D proves the PANEL delivers it.
 *
 * Prereq: dev server on :8000 (localhost → unbundled ES modules, so source edits
 * are picked up). Run: node scripts/procgen/verify-region-library-ui.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const LIBRARY_FILE = path.join(repoRoot, 'frontend/region-libraries/demo-maze-pack.json');

// Substrate libraries register on import (maze = the procedural, rng-consuming
// substrate; its adapter also instantiates the library entries).
await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/mazeRoom/mazeRoomLibrary.js')));
const engine = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/procgenPipeline/procgenPipelineEngine.js')));
const loader = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/procgenPipeline/regionLibraryLoader.js')));
const validator = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/procgenPipeline/regionLibraryValidator.js')));
const { substrateRegistry } = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/shared/procgen/substrateRegistry.js')));

const SEED = 1;
const REGION = { width: 11, height: 11 };
const MAX_ITEMS = 2;
const MAZE_QUOTA = 2;
const LIB_COUNT = 3;
const DEMO_FILE = 'demo-maze-pack.json';

const demoLib = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
const maze = substrateRegistry.get('maze');

// The headless monolith — buildLibrarySpiralConfig (the exact seam the panel's
// _buildSpiralEnvelope calls) + arrangeShuffledSpiral + buildRulesJson from the
// same params the panel is seeded/driven with. Victory resolves the way
// _resolveVictoryItemId does for an empty scenario: the first active substrate's
// declared victoryItem (only maze is in the base quota dict — libraries are held
// separately, so they never contribute victory).
function monolithRulesJson() {
    const { substrateQuotas, substrateConfig } = loader.buildLibrarySpiralConfig(
        [{ library: demoLib, count: LIB_COUNT }],
        { substrateQuotas: { maze: MAZE_QUOTA }, substrateConfig: {} },
    );
    const config = {
        regionSize: REGION,
        itemPool: {},
        obstaclePool: {},
        seed: SEED,
        regionParams: {},
        growthParams: {
            substrateQuotas,
            maxItemsPerRegion: MAX_ITEMS,
            ...(Object.keys(substrateConfig).length ? { substrateConfig } : {}),
        },
        hazardOpts: null,
    };
    const { grid, stats, startCell } = engine.arrangeShuffledSpiral(config);
    return engine.buildRulesJson(grid, {
        startCell,
        seed: SEED,
        enableLoopMode: false,
        regionXpEffect: 'cost',
        completionConditionItem: maze?.victoryItem ?? null,
        procgenMetadata: { driver: 'shuffled-spiral', stop_reason: stats.stopReason },
    });
}

function canon(v) {
    if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
    if (v && typeof v === 'object') {
        return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
    }
    return JSON.stringify(v);
}

const MONO = canon(monolithRulesJson());
// A library-mixed world must build MORE than the bare maze quota (proves the
// library slots actually landed — a config-drop would silently fall back to
// maze-only and still "pass" a weaker equality).
const MONO_REGION_COUNT = Object.keys(monolithRulesJson().regions?.['1'] ?? {}).length;

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

// Seed the panel in shuffled-spiral mode with a maze quota + empty scenario; the
// library is added by DRIVING the panel (Phase A) so the checkbox path is tested.
// Seed ONLY when absent — addInitScript re-runs on every navigation, so an
// unconditional set would wipe the Phase-A tick on the Phase-B reload.
await page.addInitScript(({ seed, region, maxItems, mazeQuota }) => {
    if (localStorage.getItem('procgenPipeline_params')) return;
    localStorage.setItem('procgenPipeline_params', JSON.stringify({
        mode: 'shuffledSpiral',
        params: {
            seed,
            regionWidth: region.width,
            regionHeight: region.height,
            maxItemsPerRegion: maxItems,
        },
        scenario: { items: {}, obstacles: {} },
        substrateQuotas: { maze: mazeQuota },
        substrateMode: 'quotas',
    }));
}, { seed: SEED, region: REGION, maxItems: MAX_ITEMS, mazeQuota: MAZE_QUOTA });

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };

const panelRoot = () => 'document.querySelector(".procgen-pipeline-mode")?.closest(".lm_content") ?? document';
const panelText = () => page.evaluate(() => document.querySelector('.procgen-pipeline-panel')?.textContent ?? document.body.textContent ?? '');
const clickByText = (txt) => page.evaluate(({ t, rootExpr }) => {
    const root = eval(rootExpr);
    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
    if (btn) { btn.click(); return true; }
    return false;
}, { t: txt, rootExpr: panelRoot() });

const extractDownload = async (triggerFn) => {
    const [download] = await Promise.all([page.waitForEvent('download'), triggerFn()]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
};
const extractRulesJson = async () => JSON.parse(await extractDownload(() => clickByText('Download rules.json')));

async function activatePanel() {
    let activated = false;
    for (let i = 0; i < 40 && !activated; i++) {
        activated = await page.evaluate(() => {
            const tab = [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Procgen Pipeline');
            if (!tab) return false;
            tab.click();
            return true;
        });
        if (!activated) await page.waitForTimeout(500);
    }
    if (!activated) throw new Error('could not activate Procgen Pipeline panel');
    await page.waitForTimeout(1500);
}

// Wait until the served-library index has rendered a checkbox for the demo file.
async function waitForServedCheckbox() {
    for (let i = 0; i < 40; i++) {
        const present = await page.evaluate((file) => !!document.querySelector(
            `.procgen-pipeline-served-library-cb[data-file="${file}"]`), DEMO_FILE);
        if (present) return true;
        await page.waitForTimeout(250);
    }
    return false;
}

// Wait until the working selection holds the demo library (name in the Selected
// libraries column).
async function waitForSelectedLibrary() {
    for (let i = 0; i < 40; i++) {
        const has = await page.evaluate(() => {
            const sec = document.querySelector('.procgen-pipeline-region-libraries');
            return !!(sec && /Demo Maze Pack/.test(sec.textContent) && sec.querySelector('.procgen-pipeline-selected-row'));
        });
        if (has) return true;
        await page.waitForTimeout(250);
    }
    return false;
}

// --- Phase A — F3 selection + generate ------------------------------
await page.goto('http://localhost:8000/frontend/');
await page.waitForTimeout(8000);
await activatePanel();

assert(await waitForServedCheckbox(), 'Phase A: served demo-maze-pack checkbox rendered from the index');

// Tick the demo library → async loadServedLibrary → working selection.
await page.evaluate((file) => {
    const cb = document.querySelector(`.procgen-pipeline-served-library-cb[data-file="${file}"]`);
    cb.click();
}, DEMO_FILE);
assert(await waitForSelectedLibrary(), 'Phase A: ticking the checkbox added the demo library to the selection');

// Set its region count via the selected-row number input.
const countSet = await page.evaluate((val) => {
    const sec = document.querySelector('.procgen-pipeline-region-libraries');
    const inp = sec?.querySelector('.procgen-pipeline-selected-row .procgen-pipeline-count-input');
    if (!inp) return false;
    inp.value = String(val);
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}, LIB_COUNT);
assert(countSet, 'Phase A: library region-count input present + set');
await page.waitForTimeout(400);

assert(await clickByText('Generate'), 'Phase A: clicked Generate');
await page.waitForTimeout(3000);
const afterGen = await panelText();
assert(/driver shuffled-spiral/.test(afterGen), 'Phase A: produced a compiled shuffled-spiral result');

const rjA = await extractRulesJson();
const regionCountA = Object.keys(rjA.regions?.['1'] ?? {}).length;
assert(regionCountA === MONO_REGION_COUNT,
    `Phase A: region count ${regionCountA} === headless ${MONO_REGION_COUNT} (maze quota ${MAZE_QUOTA} + library count ${LIB_COUNT}; a dropped library config would fall to maze-only and mismatch)`);
assert(canon(rjA) === MONO, 'Phase A: panel rules.json === headless buildLibrarySpiralConfig + arrange + compile');
// Build-time source only: no library residency in the compiled world.
assert(!JSON.stringify(rjA).includes('libraryDoc') && !JSON.stringify(rjA).includes(demoLib.library_id),
    'Phase A: compiled world carries NO library residency (self-contained regions)');

// --- Phase B — hybrid persistence round-trip ------------------------
await page.reload();
await page.waitForTimeout(8000);
await activatePanel();
assert(await waitForSelectedLibrary(), 'Phase B: served reference re-resolved into the selection after reload');
// The count must survive the reload too (persisted in the served ref).
const countB = await page.evaluate(() => {
    const sec = document.querySelector('.procgen-pipeline-region-libraries');
    return sec?.querySelector('.procgen-pipeline-selected-row .procgen-pipeline-count-input')?.value ?? null;
});
assert(String(countB) === String(LIB_COUNT), `Phase B: region count persisted (${countB} === ${LIB_COUNT})`);

assert(await clickByText('Generate'), 'Phase B: clicked Generate after reload');
await page.waitForTimeout(3000);
const rjB = await extractRulesJson();
assert(canon(rjB) === MONO, 'Phase B: post-reload rules.json === same headless world');

// --- Phase C — F5 capture UI ----------------------------------------
// The "Capture to library" area lists the last generation's regions; Save one,
// then Download the working library and assert it validates + re-instantiates.
const captureBtnPresent = await page.evaluate(() => {
    const sec = document.querySelector('.procgen-pipeline-library-capture');
    return !!(sec && [...sec.querySelectorAll('button')].some((b) => /Save.*to library/.test(b.textContent)));
});
if (!captureBtnPresent) {
    console.log('NOTE: F5 capture UI not present — Phase C skipped (F3-only build).');
} else {
    const captured = await page.evaluate(() => {
        const sec = document.querySelector('.procgen-pipeline-library-capture');
        const btn = [...sec.querySelectorAll('button')].find((b) => /Save.*to library/.test(b.textContent));
        if (!btn) return false;
        btn.click();
        return true;
    });
    assert(captured, 'Phase C: clicked "Save to library" on a generated region');
    await page.waitForTimeout(400);

    const downloadPresent = await page.evaluate(() => {
        const sec = document.querySelector('.procgen-pipeline-library-capture');
        return /Working library \(1 entry\)/.test(sec?.textContent ?? '')
            && [...sec.querySelectorAll('button')].some((b) => /Download working library/.test(b.textContent));
    });
    assert(downloadPresent, 'Phase C: capture added an entry + revealed the Download button');

    const workingText = await extractDownload(() => page.evaluate(() => {
        const sec = document.querySelector('.procgen-pipeline-library-capture');
        const btn = [...sec.querySelectorAll('button')].find((b) => /Download working library/.test(b.textContent));
        btn.click();
    }));
    let workingLib = null;
    try { workingLib = JSON.parse(workingText); } catch (e) { /* asserted below */ }
    assert(!!workingLib, 'Phase C: working-library download is valid JSON');
    if (workingLib) {
        const vr = validator.validateRegionLibrary(workingLib, {
            entryCapabilityCheck: (e) => maze.validateLibraryEntry(e),
        });
        assert(vr.ok, `Phase C: captured working library validates (${vr.errors.join('; ') || 'no errors'})`);
        assert((workingLib.entries?.length ?? 0) === 1, 'Phase C: working library has the captured entry');
        // Re-instantiate the captured entry in a fresh context (independent of the
        // capture): it must produce a self-contained maze region descriptor.
        const entry = workingLib.entries[0];
        const region = maze.instantiateLibraryEntry(entry, {
            region_id: 'rl_ui_probe', exitSides: entry.exit_sides, regionSize: entry.region_size,
        });
        assert(region?.substrate === 'maze' && (region.extracted_rules?.locations?.length ?? 0) >= 0,
            'Phase C: captured entry re-instantiates into a maze region');
    }
}

const pageErrors = logs.filter((l) => l.startsWith('[pageerror]'));
assert(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
if (pageErrors.length) console.log(pageErrors.join('\n'));

// --- Phase D — sphere-growth library wiring (F6d) -------------------
// A fresh context seeded in sphere-growth mode with a bounce quota + a plannable
// bounce item pool. The served index carries BOTH the maze pack (non-bounce) and
// the bounce pack, so sphere mode is a live disable/enable test.
const BOUNCE_FILE = 'demo-bounce-pack.json';
const bounceLib = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/region-libraries/demo-bounce-pack.json'), 'utf8'));
const SPHERE_ITEMS = {
    'Right arrow': 1, 'Left arrow': 1, Springs: 1, Jetpacks: 1, 'Blue platforms': 1, Victory: 1,
};
const sctx = await browser.newContext({ acceptDownloads: true });
const sp = await sctx.newPage();
const slogs = [];
sp.on('console', (msg) => slogs.push(`[${msg.type()}] ${msg.text()}`));
sp.on('pageerror', (err) => slogs.push(`[pageerror] ${err.message}`));
await sp.addInitScript(({ items }) => {
    localStorage.setItem('procgenPipeline_params', JSON.stringify({
        mode: 'sphereGrowth',
        params: {
            seed: 1, regionWidth: 8, regionHeight: 6, maxItemsPerRegion: 2,
            sphereCount: 3, fillerCount: 0, revisitPercent: 25,
        },
        scenario: { items, obstacles: {} },
        // High bounce quota so bounce never runs out of budget (matches
        // verify-sphere-steps-ui.mjs); the library competes for the SAME nodes.
        substrateQuotas: { bounce: 99 }, substrateMix: {}, substrateMode: 'quotas',
    }));
}, { items: SPHERE_ITEMS });

// Phase-D helpers bound to the sphere page (the A–C helpers close over `page`).
const sClickByText = (txt) => sp.evaluate((t) => {
    const btn = [...document.querySelectorAll('.procgen-pipeline-panel button')]
        .find((b) => b.textContent.trim() === t && !b.disabled);
    if (btn) { btn.click(); return true; }
    return false;
}, txt);
// Sphere's primary button is "Run all" (not "Generate"). From scratch it runs the
// plan and pauses (editable plan); "Run all (finish)" completes the rest. Click
// whichever is present until the compile step's success ("Sphere plan realised")
// or an oracle mismatch appears. Returns true only on success.
const sMessage = () => sp.evaluate(() =>
    document.querySelector('.procgen-pipeline-message')?.textContent ?? '');
const sRunAll = async () => {
    for (let i = 0; i < 160; i++) {
        const msg = await sMessage();
        if (/Sphere plan realised/.test(msg)) return true;
        if (/ORACLE MISMATCH|ERROR:/.test(msg)) return false;
        const working = await sp.evaluate(() =>
            /Working…/.test(document.querySelector('.procgen-pipeline-panel')?.textContent ?? ''));
        if (!working) {
            // Idle and not finished → click the next run button to advance.
            const clicked = (await sClickByText('Run all (finish)')) || (await sClickByText('Run all'));
            if (!clicked) return false;
        }
        await sp.waitForTimeout(500);
    }
    return false;
};
const sExtractRulesJson = async () => {
    const [download] = await Promise.all([
        sp.waitForEvent('download'),
        sp.evaluate(() => [...document.querySelectorAll('.procgen-pipeline-panel button')]
            .find((b) => b.textContent.trim() === 'Download rules.json')?.click()),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

await sp.goto('http://localhost:8000/frontend/');
await sp.waitForTimeout(8000);
// Activate the panel (same handshake as activatePanel, bound to sp).
{
    let activated = false;
    for (let i = 0; i < 40 && !activated; i++) {
        activated = await sp.evaluate(() => {
            const tab = [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Procgen Pipeline');
            if (!tab) return false;
            tab.click();
            return true;
        });
        if (!activated) await sp.waitForTimeout(500);
    }
    assert(activated, 'Phase D: activated the Procgen Pipeline panel in sphere mode');
    await sp.waitForTimeout(1500);
}

// D1 — the Region-libraries subsection renders in sphere mode (was spiral-only).
const sphereSubsection = await sp.evaluate(() =>
    !!document.querySelector('.procgen-pipeline-region-libraries'));
assert(sphereSubsection, 'Phase D: Region-libraries subsection renders in sphere mode');

// Wait for both served checkboxes to render from the index.
let bothServed = false;
for (let i = 0; i < 40 && !bothServed; i++) {
    bothServed = await sp.evaluate((files) => files.every((f) => !!document.querySelector(
        `.procgen-pipeline-served-library-cb[data-file="${f}"]`)), [BOUNCE_FILE, DEMO_FILE]);
    if (!bothServed) await sp.waitForTimeout(250);
}
assert(bothServed, 'Phase D: both served packs (bounce + maze) rendered from the index');

// D2 — both bounce AND maze packs ENABLED in sphere mode (F6c: sphere placement
// is no longer bounce-only — maze + runner are sphere-capable too).
const cbState = await sp.evaluate((files) => {
    const get = (f) => document.querySelector(`.procgen-pipeline-served-library-cb[data-file="${f}"]`);
    return { bounceDisabled: get(files.bounce)?.disabled, mazeDisabled: get(files.maze)?.disabled };
}, { bounce: BOUNCE_FILE, maze: DEMO_FILE });
assert(cbState.bounceDisabled === false, 'Phase D: bounce pack checkbox is enabled (sphere-capable)');
assert(cbState.mazeDisabled === false, 'Phase D: maze pack checkbox is enabled (sphere-capable, F6c)');

// D2b — ticking the maze pack surfaces the maze connection toggles, both default
// OFF (best-effort). Untick afterwards so the bounce flow below is unaffected.
await sp.evaluate((f) => document.querySelector(
    `.procgen-pipeline-served-library-cb[data-file="${f}"]`).click(), DEMO_FILE);
let mazeToggles = null;
for (let i = 0; i < 40 && mazeToggles === null; i++) {
    mazeToggles = await sp.evaluate(() => {
        const sw = document.querySelector('.procgen-pipeline-maze-samewall-cb');
        const ta = document.querySelector('.procgen-pipeline-maze-tilealign-cb');
        if (!sw || !ta) return null;
        return { sameWall: sw.checked, tileAlign: ta.checked };
    });
    if (mazeToggles === null) await sp.waitForTimeout(250);
}
assert(mazeToggles !== null, 'Phase D: maze connection toggles render when a maze pack is selected');
assert(mazeToggles && mazeToggles.sameWall === false && mazeToggles.tileAlign === false,
    'Phase D: maze connection toggles default OFF (best-effort)');
// Untick the maze pack (restore the pre-D2b selection state).
await sp.evaluate((f) => document.querySelector(
    `.procgen-pipeline-served-library-cb[data-file="${f}"]`).click(), DEMO_FILE);
await sp.waitForTimeout(300);

// D3 — tick the bounce pack; it lands in the working selection.
await sp.evaluate((f) => document.querySelector(
    `.procgen-pipeline-served-library-cb[data-file="${f}"]`).click(), BOUNCE_FILE);
let bounceSelected = false;
for (let i = 0; i < 40 && !bounceSelected; i++) {
    bounceSelected = await sp.evaluate(() => {
        const sec = document.querySelector('.procgen-pipeline-region-libraries');
        return !!(sec && /Demo Bounce Pack/.test(sec.textContent)
            && sec.querySelector('.procgen-pipeline-selected-row'));
    });
    if (!bounceSelected) await sp.waitForTimeout(250);
}
assert(bounceSelected, 'Phase D: ticking the bounce pack added it to the selection');
await sp.evaluate((val) => {
    const inp = document.querySelector(
        '.procgen-pipeline-region-libraries .procgen-pipeline-selected-row .procgen-pipeline-count-input');
    if (inp) { inp.value = String(val); inp.dispatchEvent(new Event('change', { bubbles: true })); }
}, 4);
await sp.waitForTimeout(400);

// D4 — Generate WITH the library ("Run all"); a sphere-growth world compiles.
assert(await sRunAll(), 'Phase D: ran the sphere pipeline to a compiled result (with library)');
const rjWith = await sExtractRulesJson();
assert(rjWith.procgen_metadata?.driver === 'sphere-growth',
    'Phase D: with-library world is a sphere-growth build');
const regionsWith = Object.values(rjWith.regions ?? {}).reduce((n, byName) => n + Object.keys(byName).length, 0);
assert(regionsWith >= 2, `Phase D: with-library sphere world has ${regionsWith} regions (≥2)`);

// D5 — build-time source only: the library DOCUMENT never embeds, and the PLAYABLE
// regions are self-contained bounce (no library id in them). The library id may
// appear in procgen_metadata.sphere_tree as build PROVENANCE (the node's source
// substrate, like `driver`) — that is not playable residency.
const withStr = JSON.stringify(rjWith);
assert(!withStr.includes('libraryDoc'),
    'Phase D: compiled sphere world embeds NO library document (libraryDoc absent)');
assert(!JSON.stringify(rjWith.regions ?? {}).includes(bounceLib.library_id),
    'Phase D: playable regions are self-contained (no library id in compiled regions)');

// D6 — untick the library and regenerate at the SAME seed/params: the grown world
// must DIFFER. The only change is the library selection, so any difference proves
// the selection reached the sphere config (a dropped wiring → identical worlds →
// this fails). Engine placement correctness is proven by the F6a strata.
await sp.evaluate((f) => document.querySelector(
    `.procgen-pipeline-served-library-cb[data-file="${f}"]`).click(), BOUNCE_FILE);
let bounceCleared = false;
for (let i = 0; i < 40 && !bounceCleared; i++) {
    bounceCleared = await sp.evaluate(() => {
        const sec = document.querySelector('.procgen-pipeline-region-libraries');
        return !!sec && !/Demo Bounce Pack/.test(sec.querySelector('.procgen-pipeline-scenario-selected')?.textContent ?? '');
    });
    if (!bounceCleared) await sp.waitForTimeout(250);
}
assert(bounceCleared, 'Phase D: unticked the bounce library');
// A completed pipeline won't re-plan on "Run all"; Reset drops it so the run
// re-plans from the now-library-less config.
assert(await sClickByText('Reset'), 'Phase D: reset the sphere pipeline before the no-library run');
await sp.waitForTimeout(400);
assert(await sRunAll(), 'Phase D: ran the sphere pipeline to a compiled result (no library)');
const rjNo = await sExtractRulesJson();
assert(rjNo.procgen_metadata?.driver === 'sphere-growth',
    'Phase D: no-library world is a sphere-growth build');
assert(canon(rjWith) !== canon(rjNo),
    'Phase D: the bounce library materially changed the grown world (selection reached the sphere config)');

const spErrors = slogs.filter((l) => l.startsWith('[pageerror]'));
assert(spErrors.length === 0, `Phase D: no page errors (${spErrors.length})`);
if (spErrors.length) console.log(spErrors.join('\n'));

await browser.close();
console.log(failures.length ? `\nFAIL: ${failures.length} failure(s)` : '\nAll region-library UI assertions passed.');
process.exit(failures.length ? 1 : 0);
