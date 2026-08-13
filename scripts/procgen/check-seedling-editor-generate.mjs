#!/usr/bin/env node
/**
 * check-seedling-editor-generate — THE PROCGEN PoC SLICE 5 ACCEPTANCE ROW.
 *
 * Does the PAGE, running the Cloudberry loop in a browser from nothing but
 * URL parameters, generate the same level and the same trace node does — and
 * does it DRAW the walk it solved, all of it?
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP ─────────────────────
 *
 * The editor arc's own lesson (`export-seedling-view.mjs`'s docblock, trap
 * 176): the browser rows that SKIPPED when no dev server was up hid a page
 * that could not load AT ALL for two rungs. This row starts one on a free
 * port (`serveRepoRoot`, shared with the exporter so there is exactly one
 * static server in the arc) and shuts it down on every path. **There is no
 * skip condition.** `--host=` uses an existing server instead, which is a
 * convenience and not an escape.
 *
 * ── WHAT IT CAN CATCH, AND WHAT IT CANNOT ─────────────────────────────
 *
 * Both sides call the same loop, so this is NOT a check that the loop is
 * correct — it is a check that the PAGE'S OWN PATH TO IT is, and everything
 * between a URL and that call is page-owned and unshared: parsing the bounds,
 * choosing the palette, wiring the model to the oracle, running 60-odd
 * modules in chromium rather than node, and re-stepping the resulting tape
 * through the scrubber. A defect in any of them shows here.
 *
 * ⛔ It does NOT re-derive the generator's answer independently — nothing can,
 * short of a second generator. The anchor is node's OWN output for the same
 * seed, which is the artifact `generate-seedling-level.mjs` emits.
 *
 * ── THE FOUR CLAIMS ───────────────────────────────────────────────────
 *
 *  1. **STEP** — one press of STEP from the skeleton gives the level
 *     `generateSeedlingLevel(target=1)` gives, byte for byte. (The prefix
 *     property `watchGenerate` rests on, crossing the runtime boundary.)
 *  2. **RUN-ALL + the VERBATIM refusals** — the finished level and its whole
 *     trace match node's, and every veto the pane shows carries the reason
 *     text node recorded, character for character (⚖ §7.4; trap 202 — the
 *     refusals are the evidence channel).
 *  3. **⛓⛓⛓ THE SCRUB FORK, IN A BROWSER** — a post-sword CARRIER (a level
 *     holding `wall-gap-spinner-killlock-*`, whose solve banks a scratch
 *     clear no tape can declare) draws EVERY frame of its walk. Before slice
 *     5's stepper option the page collected 270 of 379 and reported a throw;
 *     the failure mode is a plausible SHORT replay, so the frame count is the
 *     only thing that shows it.
 *  4. **`?gen=`** — a payload emitted by the CLI is reproduced in the browser
 *     byte-identically, which is a determinism statement across two runtimes.
 *
 * Run: node scripts/procgen/check-seedling-editor-generate.mjs
 *      node scripts/procgen/check-seedling-editor-generate.mjs --host=http://localhost:8000
 */

import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { generateStep } = await M('watchGenerate.js');

/**
 * ⛓ THE SUBJECTS ARE MEASURED, NOT PICKED.
 *
 * `PRE` is **seed 1 at target 2**, because that is the cheapest pre-sword case
 * that VETOES something: claim 2 asserts the veto text is verbatim, and the
 * first draft used seed 9, which keeps both its candidates — the check passed
 * over an EMPTY list and said so. A row that reports PASS on nothing is the
 * bounded-sweep trap in acceptance clothes, so the subject moved to one where
 * the assertion has a subject (seeds 1..12 scanned at targets 2 and 3; seed 1
 * is the first with a REVERTED row carrying refusal text).
 *
 * `CARRIER` is seed 36 post-sword — one of §15.4's thirteen carrier seeds, and
 * it keeps its kill template at step **1** (measured over the pool 3/27/31/36:
 * 3 keeps one at step 2, 27 at step 3), which is what makes the scrub-fork
 * claim affordable in a browser.
 */
const PRE = { seed: 1, biome: 'pre-sword', count: 2 };
const CARRIER = { seed: 36, biome: 'post-sword', count: 1 };

const PAGE_PATH = '/frontend/modules/seedlingDemo/watch.html';
const GEN_ROUTE = '/__generated-payload.json';

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};
const json = (v) => JSON.stringify(v);

// ── node's own answers, first: the anchors every claim is measured against ──

const nodeSkeleton = generateStep({ ...PRE, step: 0 });
const nodeStep1 = generateStep({ ...PRE, step: 1 });
const nodeFull = generateStep({ ...PRE, step: PRE.count });
const nodeCarrier = generateStep({ ...CARRIER, step: CARRIER.count });

const payload = {
    generator: 'scripts/procgen/check-seedling-editor-generate.mjs',
    seed: PRE.seed,
    biome: PRE.biome,
    bounds: nodeFull.bounds,
    level: nodeFull.record,
    trace: nodeFull.trace,
};

console.log(`node: skeleton goal cell (${nodeSkeleton.model.goalCell.tx},`
    + `${nodeSkeleton.model.goalCell.ty}); step 1 keeps `
    + `${nodeStep1.summary.kept.map((k) => k.template).join(', ')}; target ${PRE.count} keeps `
    + `${nodeFull.summary.kept.map((k) => k.template).join(', ')} over `
    + `${nodeFull.summary.attempts} attempt(s)`);
console.log(`node: carrier seed ${CARRIER.seed} keeps `
    + `${nodeCarrier.summary.kept.map((k) => k.template).join(', ')}`);
check(nodeCarrier.summary.kept.some((k) => k.family === 'kill'),
    'the carrier subject really holds a KILL template — otherwise claim 3 is vacuous',
    nodeCarrier.summary.kept.map((k) => `${k.template}(${k.family})`).join(', '));

// ── the browser ───────────────────────────────────────────────────────

let server = null;
const host = arg('host', '');
if (!host) server = await serveRepoRoot({ routes: { [GEN_ROUTE]: Buffer.from(`${json(payload)}\n`) } });
const origin = host || `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const finish = async (code) => {
    await browser.close().catch(() => {});
    await closeServer(server);
    process.exit(code);
};

/** Load a GENERATE view and wait for the arm's own readout. */
async function load(query, { timeout = 300000 } = {}) {
    errors.length = 0;
    const url = `${origin}${PAGE_PATH}?${query}`;
    console.log(`page: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorGenerate, null, { timeout });
    return page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated?.level ?? null,
        trace: window.__editorGenerated?.trace ?? null,
        paneRows: [...document.querySelectorAll('#genTrace .tr')].map((e) => e.textContent),
        paneVisible: !document.getElementById('genTraceSection').hidden,
        panelVisible: !document.getElementById('generatePanel').hidden,
    }));
}

// ── CLAIM 0: the arm mounts, and the SKELETON is what step 0 shows ────
{
    const q = `source=generate&seed=${PRE.seed}&biome=${PRE.biome}&count=${PRE.count}`;
    const web = await load(q);
    check(web.panelVisible && web.paneVisible,
        'the GENERATE panel and the generation pane are both mounted');
    check(web.gen.status === 'ok', 'the arm reached a state without refusing',
        web.gen.message ?? web.gen.status);
    check(web.gen.step === 0 && web.gen.genRows === 0,
        'it lands on the SKELETON — step 0, no generation rows yet',
        `step ${web.gen.step}, ${web.gen.genRows} row(s)`);
    check(json(web.level) === json(nodeSkeleton.record),
        'and the skeleton the page shows is node\'s own skeleton, byte for byte');

    // ── CLAIM 1: ONE PRESS OF STEP ───────────────────────────────────
    await page.click('#genStep');
    await page.waitForFunction(() => window.__editorGenerate?.step === 1,
        null, { timeout: 300000 });
    const stepped = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated.level,
        trace: window.__editorGenerated.trace,
    }));
    check(json(stepped.level) === json(nodeStep1.record),
        'STEP once → the level `generateSeedlingLevel(target=1)` gives, byte for byte');
    check(json(stepped.trace) === json(nodeStep1.trace),
        '…and its whole trace too',
        `${stepped.trace.length} row(s)`);
    check(stepped.gen.agreement.compared && stepped.gen.agreement.agrees,
        'the DISPLAY solve agrees with the trace row that accepted the record',
        `display ${stepped.gen.agreement.displayTicks}t, trace `
        + `${stepped.gen.agreement.traceTicks}t`);
}

// ── CLAIM 2: RUN-ALL, and the refusals VERBATIM ──────────────────────
{
    const q = `source=generate&seed=${PRE.seed}&biome=${PRE.biome}&count=${PRE.count}&run=1`;
    const web = await load(q);
    check(web.gen.step === PRE.count, `RUN-ALL reached step ${PRE.count}`,
        `step ${web.gen.step}, stop ${web.gen.stop}`);
    check(json(web.level) === json(nodeFull.record),
        'the finished level is node\'s, byte for byte');
    check(json(web.trace) === json(nodeFull.trace),
        'the whole generation trace is node\'s, byte for byte',
        `${web.trace.length} row(s)`);
    check(web.paneRows.length === nodeFull.trace.length,
        'the pane renders ONE ROW PER ATTEMPT — kept and vetoed alike',
        `${web.paneRows.length} rendered, ${nodeFull.trace.length} in the trace`);

    /**
     * ⛔ VERBATIM, and this is trap 202's channel. The danger record is empty
     * on every success BY CONSTRUCTION, so a veto's own reason text is the
     * only evidence the pane carries — a page that summarised it would be
     * showing a lossy copy of the whole content.
     */
    const nodeVetoes = nodeFull.trace.filter((r) => r.outcome !== 'KEPT' && r.reasonText);
    check(nodeVetoes.length > 0,
        '⛔ THE SUBJECT REALLY VETOES SOMETHING — otherwise the claim below passes '
        + 'over an empty list',
        `${nodeVetoes.length} veto(es) with text`);
    check(json(web.gen.vetoes.map((v) => v.reasonText).filter(Boolean))
        === json(nodeVetoes.map((r) => r.reasonText)),
        `every veto's reason text is VERBATIM node's (${nodeVetoes.length} veto(es) with text)`,
        nodeVetoes.length
            ? `first: ${nodeVetoes[0].reasonText.slice(0, 90)}…`
            : '(none)');
    check(errors.length === 0, 'no page errors during the RUN-ALL',
        errors.join(' | ') || 'none');
}

// ── CLAIM 3: ⛓⛓⛓ THE SCRUB FORK, in a browser ───────────────────────
{
    const q = `source=generate&seed=${CARRIER.seed}&biome=${CARRIER.biome}`
        + `&count=${CARRIER.count}&run=1`;
    const web = await load(q);
    check(web.gen.status === 'ok' && web.gen.verdict === 'SOLVED',
        'the CARRIER level solves in the page', `${web.gen.verdict} in ${web.gen.ticks} ticks`);
    check((web.gen.scratchClears ?? []).length > 0,
        'its solve banks a SCRATCH CLEAR no tape can declare — the fork\'s precondition',
        json(web.gen.scratchClears?.map((c) => `${c.by} → ${c.lock} @${c.at}`) ?? []));
    check((web.gen.strategies ?? []).includes('kill'),
        'and the clearer is DISCHARGED on the route (⚖ §12.1\'s standard: a RECORD in '
        + 'the FINAL solve, never a keep-count)',
        json(web.gen.strategies));
    /**
     * ⛔ THE CLAIM ITSELF. `collectRun` RETURNS a mid-walk throw rather than
     * raising it, so the pre-slice-5 failure is a plausible SHORT replay with
     * an error under it — never a crash. The frame count is what shows it.
     */
    check(web.gen.frames === web.gen.ticks + 1,
        'the SCRUB DRAWS EVERY FRAME of the walk it solved (the scrub fork, §13.4)',
        `${web.gen.frames} frame(s) for a ${web.gen.ticks}-tick walk`);
    check(errors.length === 0, 'and no page errors while it did',
        errors.join(' | ') || 'none');
}

// ── CLAIM 3b: THE SEED IS THE LEVEL'S IDENTITY, and the form says so ──
{
    /**
     * ⛓ A LADDER BELONGS TO ONE SEED. Step 2 of seed A followed by step 3 of
     * seed B would be a display that has never shown a level any single run
     * produces — so a changed seed RESETS to the skeleton. Driven, because
     * "the control edits a value nobody reads" is exactly the defect the
     * editor arc's slice 5 found in the SOLVE button.
     */
    const q = `source=generate&seed=${PRE.seed}&biome=${PRE.biome}&count=${PRE.count}&run=1`;
    await load(q);
    await page.fill('#genSeed', String(PRE.seed + 1));
    await page.click('#genStep');
    await page.waitForFunction((s) => window.__editorGenerate?.seed === s,
        PRE.seed + 1, { timeout: 300000 });
    const after = await page.evaluate(() => ({
        gen: window.__editorGenerate, level: window.__editorGenerated.level,
    }));
    const nodeOther = generateStep({ ...PRE, seed: PRE.seed + 1, step: 1 });
    check(after.gen.step === 1,
        'retyping the seed RESTARTS the ladder at step 1 rather than continuing the old one',
        `step ${after.gen.step} (was ${PRE.count})`);
    check(json(after.level) === json(nodeOther.record),
        'and the level it shows is the NEW seed\'s own step 1, byte for byte');
}

// ── CLAIM 4: ?gen= reproduces node's payload in the browser ──────────
if (!host) {
    const web = await load(`gen=${GEN_ROUTE}`);
    check(web.gen.payloadCheck?.checked === true,
        'the ?gen= payload was checked rather than merely displayed');
    check(web.gen.payloadCheck?.agrees === true,
        'the browser REPRODUCED node\'s payload byte-identically — level AND trace',
        json(web.gen.payloadCheck?.differences ?? []));
    check(json(web.level) === json(payload.level),
        'and what it drew is that level');
} else {
    // ⚠ NAMED, not skipped silently: with `--host=` the caller's server has
    // no route to serve the payload at, so this claim has no vehicle.
    console.log('NOTE: claim 4 (?gen=) needs this row\'s OWN server to serve the payload '
        + 'route, so it is not available under --host=. Run without --host= for it.');
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
