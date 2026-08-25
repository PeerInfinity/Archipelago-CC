/**
 * In-app smoke test for the STEPPED shuffled-spiral pipeline (Part 2c). Drives
 * the real panel in a browser and proves the stepped-UI output is byte-identical
 * to the monolithic arrangeShuffledSpiral + buildRulesJson (the same equality
 * dump-spiral-byteidentity.mjs proves headlessly — here it's proven THROUGH the
 * panel UI):
 *
 *   Phase A — pure stepping: Run 1 Arrange → 2 Content → 3 Regions → 4 Compile,
 *     asserting the step indicator advances, each step's feedback block appears,
 *     the compiled output shows, and the downloaded rules.json === the headless
 *     monolith for the identical config.
 *   Phase B — Run all + Reset: Reset clears the pipeline, then Generate (run all)
 *     produces a terminal compiled result + the composite grid canvas, and that
 *     rules.json ALSO === the monolith (the Run-all path).
 *
 * Prereq: dev server on :8000. Run: node scripts/procgen/verify-spiral-steps-ui.mjs
 */
import { chromium } from 'playwright';
import { stableStringify } from '../../frontend/modules/procgenCore/contentIdentity.js';

// Substrate libraries register on import (maze is the procedural, rng-consuming
// substrate — ③ regions draws rng, so this exercises the ①→③ rng threading).
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import {
    arrangeShuffledSpiral, buildRulesJson,
} from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';

// The panel seeds these params into localStorage; the headless monolith below
// mirrors EXACTLY what _buildSpiralEnvelope builds from them, so the only
// variable under test is stepped-UI-vs-monolith.
const SEED = 1;
const REGION = { width: 8, height: 6 };
const MAX_ITEMS = 2;
const QUOTAS = { maze: 6 };

// Resolve the completion item the way _resolveVictoryItemId does for a
// scenario-less spiral world: the first quota'd substrate declaring a victoryItem.
function resolveVictory(quotas) {
    return Object.entries(quotas)
        .map(([id, n]) => (n > 0 ? substrateRegistry.get(id)?.victoryItem : null))
        .find(Boolean) ?? null;
}

// The headless monolith — arrangeShuffledSpiral + buildRulesJson with the exact
// config _buildSpiralEnvelope + the ④ Compile step produce from the seeded params.
function monolithRulesJson() {
    const config = {
        regionSize: REGION,
        itemPool: {},
        obstaclePool: {},
        seed: SEED,
        regionParams: {},
        growthParams: { substrateQuotas: QUOTAS, maxItemsPerRegion: MAX_ITEMS },
        hazardOpts: null,
    };
    const { grid, stats, startCell } = arrangeShuffledSpiral(config);
    return buildRulesJson(grid, {
        startCell,
        seed: SEED,
        enableLoopMode: false,
        regionXpEffect: 'cost',
        completionConditionItem: resolveVictory(QUOTAS),
        procgenMetadata: { driver: 'shuffled-spiral', stop_reason: stats.stopReason },
    });
}

// Canonical stringify = THE family's (procgenCore/contentIdentity.js), so a
// key-order difference between the panel's stringifyRulesJson round-trip and the
// headless object cannot false-fail. It was an identical hand copy until D0a.
const canon = stableStringify;

const MONO = canon(monolithRulesJson());

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.addInitScript(({ seed, region, maxItems, quotas }) => {
    localStorage.setItem('procgenPipeline_params', JSON.stringify({
        mode: 'shuffledSpiral',
        params: {
            seed,
            regionWidth: region.width,
            regionHeight: region.height,
            maxItemsPerRegion: maxItems,
        },
        scenario: { items: {}, obstacles: {} },
        substrateQuotas: quotas,
        substrateMode: 'quotas',
    }));
}, { seed: SEED, region: REGION, maxItems: MAX_ITEMS, quotas: QUOTAS });

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
// Scope button lookups to the procgen panel — other panels also have "Reset".
const clickByText = (txt) => page.evaluate((t) => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
    if (btn) { btn.click(); return true; }
    return false;
}, txt);

// The primary run button, whatever its label ("Generate" idle/complete,
// "Run all (finish)" mid-pipeline).
const clickPrimary = () => page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    const b = root.querySelector('.procgen-pipeline-btn-primary');
    if (!b || b.disabled) return false;
    b.click();
    return true;
});

// Text of the step indicator chips (scoped to the panel).
const primaryLabel = () => page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    return root.querySelector('.procgen-pipeline-btn-primary')?.textContent?.trim() ?? null;
});

// Extract the rules.json the panel would emit by capturing the "Download
// rules.json" download and reading its content.
const extractRulesJson = async () => {
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        clickByText('Download rules.json'),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const failures = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); console.log(`${cond ? '✅' : '❌'} ${msg}`); };

// The panel loads in shuffledSpiral mode with a fresh (unstarted) pipeline: the
// primary reads "Generate" and the next-step button reads "Run 1 Arrange".
assert((await primaryLabel()) === 'Generate', 'fresh pipeline: primary button reads "Generate"');
assert(await page.evaluate(() => {
    const root = document.querySelector('.procgen-pipeline-mode')?.closest('.lm_content') ?? document;
    return [...root.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Run 1 Arrange');
}), 'fresh pipeline: "Run 1 Arrange" next-step button present');

// Phase A — step through 1→4.
const steps = ['Run 1 Arrange', 'Run 2 Content', 'Run 3 Regions', 'Run 4 Compile'];
for (const label of steps) {
    const clicked = await clickByText(label);
    assert(clicked, `clicked "${label}"`);
    await page.waitForTimeout(1200);
}
const afterSteps = await panelText();
assert(afterSteps.includes('1 Arrange') && afterSteps.includes('4 Compile'), 'step indicator shows all four steps');
assert(/1 Arrange — spiral placement plan/.test(afterSteps), '1 Arrange feedback block appeared');
assert(/No content substrate/.test(afterSteps), '2 Content renders the no-op note');
assert(/3 Regions — spiral-walk region synthesis/.test(afterSteps), '3 Regions feedback block appeared');
assert(/driver shuffled-spiral/.test(afterSteps), 'compile feedback shows driver shuffled-spiral');
assert(/\d+ regions/.test(afterSteps), 'compile feedback shows a region count');

// The stepped-UI rules.json === the headless monolith.
const steppedRj = await extractRulesJson();
assert(canon(steppedRj) === MONO, 'Phase A: stepped-UI rules.json === monolithic arrangeShuffledSpiral+compile');

// The composite grid canvas renders once ③ Regions built the grid.
assert(await page.evaluate(() => !!document.querySelector('.procgen-pipeline-canvas-wrap canvas')),
    'Phase A: composite grid canvas rendered');

// Phase B — Reset then Run all (Generate).
assert(await clickByText('Reset'), 'clicked "Reset"');
await page.waitForTimeout(500);
const afterReset = await panelText();
assert(!/driver shuffled-spiral/.test(afterReset), 'reset cleared the pipeline');
assert((await primaryLabel()) === 'Generate', 'after reset: primary button back to "Generate"');

assert(await clickByText('Generate'), 'clicked "Generate"');
await page.waitForTimeout(3000);
const afterAll = await panelText();
assert(/driver shuffled-spiral/.test(afterAll), 'Run all (Generate) produced a compiled result');
assert(await page.evaluate(() => !!document.querySelector('.procgen-pipeline-canvas-wrap canvas')),
    'Phase B: composite grid canvas rendered');

// The Run-all rules.json === the same monolith (deterministic on the seed).
const allRj = await extractRulesJson();
assert(canon(allRj) === MONO, 'Phase B: Run-all rules.json === monolithic arrangeShuffledSpiral+compile');

const pageErrors = logs.filter((l) => l.startsWith('[pageerror]'));
assert(pageErrors.length === 0, `no page errors (${pageErrors.length})`);
if (pageErrors.length) console.log(pageErrors.join('\n'));

// The panel must not poke the sphereState singleton before it exists.
const sphereWarn = logs.filter((l) => l.includes('Singleton not yet created'));
assert(sphereWarn.length === 0, `no "[sphereState] Singleton not yet created" warning (${sphereWarn.length})`);

await browser.close();
console.log(failures.length ? `\n❌ ${failures.length} FAILURE(S)` : '\n✅ ALL PASS');
process.exit(failures.length ? 1 : 0);
