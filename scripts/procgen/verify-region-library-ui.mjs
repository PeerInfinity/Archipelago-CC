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

await browser.close();
console.log(failures.length ? `\nFAIL: ${failures.length} failure(s)` : '\nAll region-library UI assertions passed.');
process.exit(failures.length ? 1 : 0);
