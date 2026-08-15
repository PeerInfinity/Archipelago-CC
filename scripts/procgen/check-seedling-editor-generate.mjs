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
 *  5. **⛓⛓⛓ THE URL ROUND TRIP** (GENERATE-mode UI arc, slice 1) — edit the
 *     form, press, and the address bar NAMES the run; copy it, load it fresh,
 *     and the panel AND the level come back identical. Before slice 1 the
 *     form edited local variables only: seed 3 → 9 + RUN-ALL left `?seed=3`
 *     standing, so the link named a level the page was not showing. ⛔ Both
 *     halves are asserted because a writer nobody reads back is the two-
 *     spellings defect wearing a green tick.
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

/**
 * ⛓ THE ROUND-TRIP SUBJECT, AND EVERY FIELD OF IT MOVES.
 *
 * Claim 5 starts from `?seed=1&biome=post-sword&count=1` with no `?tries=` and
 * no `?k=` and edits the form to THIS — so every one of the five controls has
 * to travel, and a writeback that silently dropped one falls back to a
 * DIFFERENT value (`DEFAULT_BOUNDS` is tries 8 / k 3) rather than coinciding
 * with the right one. ⚠ That is the whole reason `tries`/`k` are not the
 * defaults here: a subject that agrees with the fallback cannot fail.
 *
 * `tickbudget` is the parameter with NO CONTROL AT ALL — the rewrite must
 * copy it — and it is set away from the default 400 so it is a budget the run
 * is really certified under and not just a string in a query.
 *
 * The seed is a MEASUREMENT: at these bounds it must REACH its target, or the
 * step the URL names is not the target the form asked for and the claim gets
 * softer than it reads. Seeds 2/4/5/6/7/8 all reach 2 at tries=3; 5 is used
 * because 1 and 2 are already claim 1–3b's and 36 is the carrier's.
 */
const ROUND = { seed: 5, biome: 'pre-sword', count: 2, tries: 3, k: 2, tickbudget: 600 };
const ROUND_BOUNDS = {
    obstacleTarget: ROUND.count, triesPerStep: ROUND.tries, saturationK: ROUND.k,
};
const ROUND_BUDGET = { maxTicksPerTarget: ROUND.tickbudget };

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
const nodeRound = generateStep({
    seed: ROUND.seed, biome: ROUND.biome, step: ROUND.count,
    bounds: ROUND_BOUNDS, budget: ROUND_BUDGET,
});
const nodeRoundSkeleton = generateStep({ seed: ROUND.seed, biome: ROUND.biome, step: 0 });

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
check(nodeRound.summary.keptCount === ROUND.count && !nodeRound.saturated,
    'the ROUND-TRIP subject really REACHES its target — a saturated one would let claim 5 '
    + 'assert about a step nobody asked for',
    `kept ${nodeRound.summary.keptCount}/${ROUND.count}, stop ${nodeRound.stop}`);

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

/** The five generate controls and the address bar, as the browser holds them. */
const panelOf = () => page.evaluate(() => ({
    url: window.location.search,
    seed: document.getElementById('genSeed').value,
    biome: document.getElementById('genBiome').value,
    count: document.getElementById('genCount').value,
    tries: document.getElementById('genTries').value,
    k: document.getElementById('genK').value,
}));

/**
 * ⛔ WAIT FOR THE LADDER TO STOP, NOT FOR IT TO START.
 *
 * `window.__editorGenerate` appears at the SKELETON, before RUN-ALL has run a
 * single rung, and the driver yields a frame per step — so a wait on the
 * readout alone can read a mid-ladder page and assert about a URL that is
 * about to be rewritten. The buttons are disabled for exactly the span of the
 * run (`busy()`), which is the honest "it finished" marker.
 */
const settled = (step, seed = null) => page.waitForFunction(
    ([s, sd]) => window.__editorGenerate?.step === s
        && (sd === null || window.__editorGenerate.seed === sd)
        && !document.getElementById('genRunAll').disabled,
    [step, seed], { timeout: 300000 });

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

// ── CLAIM 5: ⛓⛓⛓ THE URL ROUND TRIP ─────────────────────────────────
{
    /**
     * ⛓ TWO HALVES, AND NEITHER IS THE CLAIM ON ITS OWN. "The press wrote the
     * params" is a statement about a string; "the copied link reproduces" is
     * the statement anybody actually wants. A writer nobody reads back agrees
     * with itself forever, which is how the defect this repairs survived.
     */
    const start = `source=generate&seed=${PRE.seed}&biome=post-sword&count=1`
        + `&tickbudget=${ROUND.tickbudget}&layers=path`;
    await load(start);
    await page.fill('#genSeed', String(ROUND.seed));
    await page.selectOption('#genBiome', ROUND.biome);
    await page.fill('#genCount', String(ROUND.count));
    await page.fill('#genTries', String(ROUND.tries));
    await page.fill('#genK', String(ROUND.k));
    await page.click('#genRunAll');
    await settled(ROUND.count);
    const pressed = await panelOf();
    const web = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated.level,
        trace: window.__editorGenerated.trace,
    }));
    const u = new URLSearchParams(pressed.url);

    check(web.gen.step === ROUND.count && web.gen.seed === ROUND.seed,
        'RUN-ALL after the edits reached the edited target under the edited seed',
        `step ${web.gen.step}, seed ${web.gen.seed}, bounds ${json(web.gen.bounds)}`);
    check(json(web.level) === json(nodeRound.record)
        && json(web.trace) === json(nodeRound.trace),
        'and the level it generated is node\'s own under those bounds, byte for byte');
    check(u.get('seed') === String(ROUND.seed) && u.get('biome') === ROUND.biome
        && u.get('count') === String(web.gen.step) && u.get('tries') === String(ROUND.tries)
        && u.get('k') === String(ROUND.k) && u.get('run') === '1',
        '⛓ EVERY generate control is written back — the address bar NAMES the run '
        + '(the defect: it named the level BEFORE the edits)', pressed.url);
    /**
     * ⛔ `?tickbudget=` HAS NO CONTROL ON THE FORM. A rewrite that rebuilt the
     * query instead of copying it would drop the budget the level on screen
     * was certified under, silently — so the parameters this writer does not
     * own are asserted to survive it.
     */
    check(u.get('tickbudget') === String(ROUND.tickbudget) && u.get('layers') === 'path',
        'and the parameters it does NOT own survive the rewrite — ?tickbudget= (no control '
        + 'at all) and ?layers=', pressed.url);
    check(web.gen.budget.maxTicksPerTarget === ROUND.tickbudget,
        '…and that preserved budget is the one the run really used, not just a string',
        json(web.gen.budget));

    // ── 5b: the COPIED link, loaded fresh ────────────────────────────
    await load(pressed.url.replace(/^\?/, ''));
    await settled(ROUND.count);
    const reloaded = await panelOf();
    const back = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated.level,
        trace: window.__editorGenerated.trace,
    }));
    check(reloaded.seed === pressed.seed && reloaded.biome === pressed.biome
        && reloaded.count === pressed.count && reloaded.tries === pressed.tries
        && reloaded.k === pressed.k,
        '⛓⛓ the copied URL brings the PANEL back identical — all five controls',
        `${json(pressed)} → ${json(reloaded)}`);
    check(json(back.level) === json(web.level) && json(back.trace) === json(web.trace),
        '⛓⛓ …and the LEVEL back byte-identical, trace included — the link reproduces '
        + 'the run and not merely the form');
    /**
     * ⚠ THE REWRITE IS A FIXED POINT. A link that grew or renamed a parameter
     * on every load would still "round trip" once and drift on the third copy.
     */
    check(reloaded.url === pressed.url,
        'and loading it rewrites it to ITSELF — the encoding is a fixed point, not a drift',
        `${pressed.url}\n        → ${reloaded.url}`);

    // ── 5c: RESET is the SKELETON, and the link says so by ABSENCE ───
    await page.click('#genReset');
    await page.waitForFunction(() => window.__editorGenerate?.step === 0
        && !document.getElementById('genReset').disabled, null, { timeout: 300000 });
    const reset = await panelOf();
    const ru = new URLSearchParams(reset.url);
    check(!ru.has('run') && ru.get('count') === String(ROUND.count),
        'RESET drops ?run= rather than spelling it `run=0` — the skeleton is what a load '
        + 'with no ?run= already shows — and ?count= is the form\'s target again', reset.url);
    const afterReset = await load(reset.url.replace(/^\?/, ''));
    check(afterReset.gen.step === 0 && json(afterReset.level) === json(nodeRoundSkeleton.record),
        'and that link opens on the SKELETON — node\'s own step 0 for this seed, byte for byte',
        `step ${afterReset.gen.step}`);
    check(errors.length === 0, 'no page errors anywhere in the round trip',
        errors.join(' | ') || 'none');
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

    /**
     * ── ⛓⛓⛓ CLAIM 5d: `?gen=` IS AN IDENTITY, SO IT CANNOT SHARE THE BAR ──
     *
     * The payload names its own seed/biome/bounds and REPLACES the URL's, so
     * a link carrying both it and the form's values holds two spellings of
     * one run — the exact defect slice 1 exists to end. At the first press
     * the page owns the run, `gen` goes, and the explicit parameters take
     * over. ⚠ `source=generate` has to go in with them: `?gen=` was also what
     * SELECTED this arm.
     */
    const other = PRE.seed + 3;
    await page.fill('#genSeed', String(other));
    await page.click('#genStep');
    await settled(1, other);
    const dropped = await panelOf();
    const du = new URLSearchParams(dropped.url);
    const nodeDropped = generateStep({
        seed: other, biome: PRE.biome, step: 1, bounds: nodeFull.bounds,
    });
    check(!du.has('gen') && du.get('source') === 'generate' && du.get('seed') === String(other)
        && du.get('count') === '1' && du.get('run') === '1',
        '⛓ the first press DROPS ?gen= and writes the explicit parameters — including '
        + '?source=generate, since ?gen= was also the arm selector', dropped.url);
    check(/\?gen= was DROPPED at the press/.test(await page.textContent('#detail')),
        'and the page SAYS the reproduction claim is gone rather than just dropping it',
        await page.textContent('#detail'));
    const backFromDrop = await load(dropped.url.replace(/^\?/, ''));
    await settled(1, other);
    const droppedLevel = await page.evaluate(() => window.__editorGenerated.level);
    check(json(droppedLevel) === json(nodeDropped.record),
        'and the ?gen=-free link reproduces the level the press produced, byte for byte',
        `step ${backFromDrop.gen.step}`);
} else {
    // ⚠ NAMED, not skipped silently: with `--host=` the caller's server has
    // no route to serve the payload at, so this claim has no vehicle.
    console.log('NOTE: claim 4 (?gen=) needs this row\'s OWN server to serve the payload '
        + 'route, so it is not available under --host=. Run without --host= for it.');
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
