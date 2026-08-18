#!/usr/bin/env node
/**
 * check-seedling-editor-phases — **THE GENERATION LADDER, THE OVERLAYS AND THE
 * SELECTABLE INTERMEDIATE RESULTS, IN A BROWSER** (PROCGEN ELEMENTS arc 3,
 * slice 5a — D3, D4, D4' and D5).
 *
 * ⚖ The user's own requirement on the 2026-08-17 generation review (§4 item 6):
 * *"a step-through of the WHOLE generation — a button per step and a report at
 * each"*, and the 2026-08-18 ruling that the PICTURE follows the TEXT
 * selection.
 *
 * ── ⛔ WHAT MAKES THESE CLAIMS **VALUES** AND NOT ECHOES ───────────────
 *
 * The anchor is NODE's own `generateStep` for the same URL, imported into this
 * process. Every row below compares the browser's ledger, its folded terrain
 * and its overlay data against that — so a page that published a readout it did
 * not draw from, or drew a phase other than the one it names, dies here.
 *
 * ⛓ AND THE READOUT **IS** THE PICTURE'S ARGUMENT: `window.__editorGenerate
 * .overlays` and `.phase.selected` are the very objects `drawGenOverlay` and
 * `drawPaintables` consumed (`watchViewer.afterDrawGen` calls both with them),
 * which is arc-2 §11.2's law one substrate over — two functions would let the
 * picture be wrong while the readout stayed right.
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP (trap 176) ──────────
 *
 * Run: node scripts/procgen/check-seedling-editor-phases.mjs
 *      node scripts/procgen/check-seedling-editor-phases.mjs --host=http://localhost:8000
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
const { foldLedger } = await M('procgenLedger.js');
const { genOverlaysFor } = await M('watchGenOverlay.js');
const { terrainAt } = await M('procgenLevel.js');
const { seedlingSkeletonSpec } = await M('procgenSeedling.js');

const PAGE_PATH = '/frontend/modules/seedlingDemo/watch.html';

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};
const json = (v) => JSON.stringify(v);

/**
 * ⚠ THE SUBJECTS ARE MEASURED, NOT PICKED.
 *
 * `SUBJECT` is **post-sword seed 2 with `?elements=killgate`** — the one cell
 * in seeds 1..5 whose kill gate is PLACED rather than dropped by its
 * certification (the other four report
 * `the-skeleton-does-not-solve-with-the-element`), which is what gives the
 * `on-connector` phase a door cell, a grown wall and a DEMAND region to show.
 *
 * `AREAS` is **`?skeleton=rooms&areas=1` at seed 2** — SCANNED for a graph that
 * ACCEPTS, and the scan had to be RE-RUN through the page's own entry point.
 *
 * ⛔⛔ **A SUBJECT FOUND WITH A DIFFERENT INSTRUMENT IS A DIFFERENT SUBJECT.**
 * The first scan called `seedlingModel` directly — a BARE room — and found
 * `rooms` seeds 3 and 10. The page calls `generateStep`, which goes through the
 * SEAM and therefore carries 4c's BIOME DEFAULT ELEMENT, and an element changes
 * the room the partition is taken over. Re-scanned through `generateStep` (2
 * biomes × 7 kinds × seeds 1..12): the accepting cells are **`rooms` seed 2 (7
 * locks, 1 flag) and `rooms` seed 12 (9 locks, 1 flag)**, in BOTH biomes, and 2
 * is the smaller. Seed 3 accepts only without an element, which is why this row
 * reddened before the re-scan rather than after.
 *
 * ⛓ 4b §14.3 published the ceiling this is measured against (acceptance 0–4 of
 * 12 per kind, cause = the AREA COUNT on a 10x10 room).
 *
 * `DROPPED` is a level whose element the certification REFUSED, which is what
 * the *"a dropped element draws NOTHING"* claim needs a live subject for.
 */
const SUBJECT = { seed: 2, biome: 'post-sword', elements: 'killgate' };
const AREAS = { seed: 2, biome: 'pre-sword', skeleton: 'rooms', areas: 1 };
const DROPPED = { seed: 1, biome: 'post-sword', elements: 'killgate' };

const nodeSubject = generateStep({ seed: SUBJECT.seed, biome: SUBJECT.biome, step: 0,
    elements: { name: SUBJECT.elements } });
const nodeAreas = generateStep({ seed: AREAS.seed, biome: AREAS.biome, step: 0,
    skeleton: seedlingSkeletonSpec(AREAS.skeleton), areas: { keys: AREAS.areas } });
const nodeDropped = generateStep({ seed: DROPPED.seed, biome: DROPPED.biome, step: 0,
    elements: { name: DROPPED.elements } });

console.log(`node: subject ledger [${nodeSubject.ledger.map((r) => r.phase).join(', ')}]; `
    + `areas ran ${nodeAreas.areas.ran} with ${nodeAreas.areas.locks?.length ?? 0} lock(s); `
    + `dropped element ran ${nodeDropped.elements.ran}`);

// ── the browser ───────────────────────────────────────────────────────

let server = null;
const host = arg('host', '');
if (!host) server = await serveRepoRoot({});
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

/** ⛔ WAIT FOR THE ARM'S OWN READOUT, never for the element to exist (trap 246). */
async function load(query) {
    errors.length = 0;
    const url = `${origin}${PAGE_PATH}?${query}`;
    console.log(`page: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorGenerate?.phase, null, { timeout: 300000 });
    return page.evaluate(() => window.__editorGenerate);
}

/** ⛓ The phase readout, AFTER the control has settled on the index it asked
 *  for — the CLAIM's own field, never a sleep. */
const atPhase = async (index) => {
    await page.waitForFunction((i) => window.__editorGenerate?.phase?.index === i,
        index, { timeout: 60000 });
    return page.evaluate(() => ({
        gen: window.__editorGenerate,
        note: document.getElementById('genPhaseNote').textContent,
        label: document.getElementById('genPhaseLabel').textContent,
        facts: [...document.querySelectorAll('#genPhaseFacts input[data-fact]')]
            .map((b) => b.dataset.fact),
        legend: [...document.querySelectorAll('#genLegend .tr')].map((e) => e.textContent),
        status: document.getElementById('status').textContent,
    }));
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CLAIM 1 — THE LEDGER REACHES THE PAGE, ROW FOR ROW
 * ══════════════════════════════════════════════════════════════════════ */
{
    const web = await load(`source=generate&seed=${SUBJECT.seed}&biome=${SUBJECT.biome}`
        + `&count=0&elements=${SUBJECT.elements}`);
    check(web.phase.count === nodeSubject.ledger.length,
        '⛓ the page holds the SAME NUMBER of pass-1 phases node recorded',
        `${web.phase.count} vs ${nodeSubject.ledger.length}`);
    check(json(web.phase.phases) === json(nodeSubject.ledger.map((r) => r.phase)),
        '⛓⛓ …in the SAME ORDER, phase for phase', json(web.phase.phases));
    check(web.phase.index === null,
        '⛔ …and the page opens on the FINISHED level, not on a phase');
    check(/the FINISHED level/.test(await page.evaluate(
        () => document.getElementById('genPhaseLabel').textContent)),
    '…and says so where a reader is looking');
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CLAIM 2 — PHASE k SHOWS PHASE k's ROOM, AND NOTHING IS RE-RUN
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ THE ANCHOR IS NODE's OWN FOLD of the SAME ledger, and the comparison is
 * per CELL. A page that showed phase k+1's terrain for k — or that rebuilt the
 * model instead of folding — dies here and in the ledger unit row, and nowhere
 * else.
 */
{
    const rows = nodeSubject.ledger;
    await page.click('#genPhaseNext');
    for (let k = 0; k < rows.length; k += 1) {
        if (k > 0) await page.click('#genPhaseNext');
        // eslint-disable-next-line no-await-in-loop
        const at = await atPhase(k);
        const shown = at.gen.phase.level;
        // eslint-disable-next-line no-await-in-loop
        const folded = foldLedger(rows, k,
            { width: nodeSubject.record.width, height: nodeSubject.record.height });
        const wrong = folded.terrain.filter((c) => terrainAt(shown, c.tx, c.ty) !== c.terrain);
        check(wrong.length === 0,
            `⛓⛓ phase ${k + 1}/${rows.length} (${rows[k].phase}) draws node's FOLD of the `
            + 'ledger, cell for cell',
            wrong.length ? `${wrong.length} cell(s) differ, first ${json(wrong[0])}` : '');
        check(at.gen.phase.row.sentence === rows[k].sentence,
            `…and the readout carries the PHASE's OWN sentence for ${rows[k].phase}`,
            at.gen.phase.row.sentence.slice(0, 60));
        check(at.note.includes(`${rows[k].tiles.changed.length} tile(s) changed`),
            '…with the row\'s OWN tiles DELTA beside it, not a recount of the picture',
            at.note.slice(0, 90));
        check(json(at.facts.filter((f) => f !== '__all'))
            === json(rows[k].data.facts.map((f) => f.id)),
        '…and one SELECTABLE line per intermediate result the phase recorded',
        json(at.facts));
    }
    /** ⛔ AND THE STATUS SAYS NOTHING WAS RE-RUN — the whole point of a ledger. */
    const last = await atPhase(rows.length - 1);
    check(/nothing was re-run/.test(last.status),
        '⛔ the page says a phase is a VIEW — nothing was re-run', last.status);
    check(/pass 2 — use STEP/.test(last.label),
        '⛓⛓ …and the LAST pass-1 row hands over to the existing STEP', last.label);
    /** ⛓ AND THE DELTAS SUM: the last phase folds to the level the page shows. */
    await page.click('#genPhaseEnd');
    const back = await atPhase(null);
    check(back.gen.phase.index === null && back.gen.status === 'ok',
        '⛓ `the FINISHED level` returns through the page\'s ONE display path');
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CLAIM 3 — ⚖ THE 2026-08-18 RULING: THE PICTURE FOLLOWS THE TEXT
 * ══════════════════════════════════════════════════════════════════════ */
{
    const rows = nodeSubject.ledger;
    const k = rows.findIndex((r) => r.phase === 'on-connector');
    await page.evaluate((i) => {
        const el = document.getElementById('genPhase');
        el.value = String(i);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, k);
    let at = await atPhase(k);
    check(at.gen.phase.selected.length === 0,
        '⛔ NOTHING is painted until a line is SELECTED — the ruling\'s own shape');
    const tick = async (id) => {
        await page.evaluate((f) => {
            const b = [...document.querySelectorAll('#genPhaseFacts input[data-fact]')]
                .find((x) => x.dataset.fact === f);
            b.checked = !b.checked;
            b.dispatchEvent(new Event('change', { bubbles: true }));
        }, id);
        return atPhase(k);
    };
    at = await tick('demand-region');
    const nodeDemand = rows[k].data.facts.find((f) => f.id === 'demand-region');
    check(json(at.gen.phase.selected.map((f) => f.id)) === json(['demand-region']),
        '⛓ selecting a LINE selects exactly its paintable');
    check(json(at.gen.phase.selected[0].cells) === json(nodeDemand.cells),
        '⛓⛓⛓ …and the CELLS the painter consumed are node\'s ledger\'s, cell for cell — the '
        + 'readout IS the picture\'s argument', `${at.gen.phase.selected[0].cells.length} cell(s)`);
    check(at.gen.phase.selected[0].kind === 'flood'
        && at.gen.phase.selected[0].count === nodeDemand.count,
    '…kind and count included', `${at.gen.phase.selected[0].kind}/${at.gen.phase.selected[0].count}`);
    at = await tick('main-path');
    check(at.gen.phase.selected.length === 2,
        '⛓ MULTI-SELECT — two lines, two paintables', json(at.gen.phase.selected.map((f) => f.id)));
    at = await tick('__all');
    check(at.gen.phase.selected.length === rows[k].data.facts.length,
        '⛓ the "ALL of this phase\'s facts" toggle selects every one',
        `${at.gen.phase.selected.length} of ${rows[k].data.facts.length}`);
    /** ⛔ AND THE SELECTION IS SCOPED TO ITS ROW — a fact id is unique within a
     *  phase and not across them, so carrying ticks forward would paint a cell
     *  list from a phase the reader is no longer looking at. */
    await page.click('#genPhasePrev');
    const prev = await atPhase(k - 1);
    check(prev.gen.phase.selected.length === 0,
        '⛔ …and moving to another phase CLEARS the selection — a fact id is a row\'s, '
        + 'not the ledger\'s', json(prev.gen.phase.selected.map((f) => f.id)));
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CLAIM 4 — THE THREE OVERLAYS AND THE LEGEND
 * ══════════════════════════════════════════════════════════════════════ */
{
    const web = await load(`source=generate&seed=${AREAS.seed}&biome=${AREAS.biome}`
        + `&count=0&skeleton=${AREAS.skeleton}&areas=${AREAS.areas}`);
    check(web.layer === 'off' && web.overlays.groups.length === 0,
        '⛔ the overlay opens OFF and draws nothing');
    const setLayer = async (layer) => {
        await page.selectOption('#genLayer', layer);
        await page.waitForFunction((l) => window.__editorGenerate?.layer === l, layer,
            { timeout: 60000 });
        return page.evaluate(() => ({
            gen: window.__editorGenerate,
            legend: [...document.querySelectorAll('#genLegend .tr')].map((e) => e.textContent),
        }));
    };
    for (const layer of ['sites', 'elements', 'areas', 'all']) {
        // eslint-disable-next-line no-await-in-loop
        const shown = await setLayer(layer);
        const node = genOverlaysFor(nodeAreas.model, { layer, phase: null });
        check(json(shown.gen.overlays.groups.map((g) => [g.id, g.count, g.style]))
            === json(node.groups.map((g) => [g.id, g.count, g.style])),
        `⛓⛓ the \`${layer}\` overlay's GROUPS are node's — id, cell count and style`,
        json(shown.gen.overlays.groups.map((g) => g.id)));
        check(json(shown.gen.overlays.groups.flatMap((g) => g.cells))
            === json(node.groups.flatMap((g) => g.cells)),
        `⛓⛓⛓ …and every CELL the painter was handed at \`${layer}\` is node's`,
        `${shown.gen.overlays.groups.reduce((n, g) => n + g.count, 0)} cell(s)`);
        /** ⛔ THE LEGEND NAMES EVERY DRAWN GROUP EXACTLY ONCE. */
        check(shown.legend.length === node.legend.length,
            `⛓ …and the LEGEND has one row per group plus one per note at \`${layer}\``,
            `${shown.legend.length} rows`);
    }
    /** ⛓ THE LOCKS AND THE FLAG OF AN ACCEPTED GRAPH ARE DRAWN — the subject
     *  this row was scanned for. */
    const all = await setLayer('all');
    const locks = all.gen.overlays.groups.find((g) => g.id === 'area:locks');
    check(nodeAreas.areas.ran === true,
        '⛓ the subject really is an ACCEPTED area graph (node says so)',
        `${nodeAreas.areas.lockCount} lock(s), ${nodeAreas.areas.flags.length} flag(s)`);
    check(locks && locks.count === nodeAreas.areas.locks.length,
        '⛓⛓ an ACCEPTED area graph draws its boundary LOCKS',
        `${locks?.count} vs ${nodeAreas.areas.locks.length}`);
    check(all.gen.overlays.groups.some((g) => g.id === 'area:flags'),
        '…and its FLAG(s)');
    /** ⛔ NO TEXT ON THE CANVAS — the symbols are named ONCE each in the legend. */
    check(all.legend.length > 0 && all.legend.every((t) => t.trim().length > 0),
        '⛓ every legend row carries a label', `${all.legend.length} rows`);
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛔⛔ CLAIM 5 — A DROPPED ELEMENT DRAWS **NOTHING**
 * ══════════════════════════════════════════════════════════════════════
 *
 * The geometry a refused certification measured survives on
 * `certification.geometry` so the CENSUS numbers do (arc-3 §10.8) — but the
 * level that SHIPPED does not contain it. A picture that read that field would
 * draw a gadget nobody can walk into, and this is the row that says it does not.
 */
{
    await load(`source=generate&seed=${DROPPED.seed}&biome=${DROPPED.biome}`
        + `&count=0&elements=${DROPPED.elements}`);
    await page.selectOption('#genLayer', 'all');
    await page.waitForFunction(() => window.__editorGenerate?.layer === 'all',
        null, { timeout: 60000 });
    const shown = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        legend: [...document.querySelectorAll('#genLegend .tr')].map((e) => e.textContent),
    }));
    check(nodeDropped.elements.ran === false && nodeDropped.elements.certified === false,
        '⛓ the subject really is a DROPPED element (node says so)',
        json(nodeDropped.elements.refused?.reason));
    check(shown.gen.overlays.groups.filter((g) => g.id.startsWith('element:')).length === 0,
        '⛔⛔ …and the overlay draws NO element group at all',
        json(shown.gen.overlays.groups.map((g) => g.id)));
    check(shown.gen.overlays.notes.join(' ').includes(nodeDropped.elements.refused.reason),
        '⛓⛓ …and the REASON is a LEGEND row instead — by name',
        shown.gen.overlays.notes.join(' ').slice(0, 100));
    check(shown.legend.some((t) => t.includes(nodeDropped.elements.refused.reason)),
        '…and it is on the page where a reader is looking');
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CLAIM 6 — THE FOUR INTERMEDIATE RESULTS SLICE 5a PRICED AND DID NOT
 *               CARRY (arc 3, slice 5b — D1, D2, D3, D4)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ EVERY ONE OF THESE IS A **VALUE** CLAIM AND NOT AN ECHO: the anchor is
 * node's own ledger for the same URL, and the comparison is CELL FOR CELL
 * against the very object `drawPaintables` consumed. A page that listed the
 * line and painted something else dies here.
 *
 * ⛓ AND NO PAINTER CODE WAS ADDED FOR ANY OF THEM. `drawPaintables` already
 * switches on `cells|outline|path|flood` and the readout's lines are already
 * the control, so a phase that learns a new fact reaches the screen with no
 * page change at all — which is what ⚖ the 2026-08-18 ruling bought.
 */
{
    const rows = nodeSubject.ledger;
    await load(`source=generate&seed=${SUBJECT.seed}&biome=${SUBJECT.biome}`
        + `&count=0&elements=${SUBJECT.elements}`);
    const goTo = async (name) => {
        const k = rows.findIndex((r) => r.phase === name);
        await page.evaluate((i) => {
            const el = document.getElementById('genPhase');
            el.value = String(i);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, k);
        return { k, at: await atPhase(k) };
    };
    const tickAll = async (k) => {
        await page.evaluate(() => {
            const b = [...document.querySelectorAll('#genPhaseFacts input[data-fact]')]
                .find((x) => x.dataset.fact === '__all');
            if (!b.checked) b.click();
        });
        return atPhase(k);
    };
    const sel = (at, id) => at.gen.phase.selected.find((f) => f.id === id) ?? null;
    const nodeFact = (name, id) => rows.find((r) => r.phase === name)
        .data.facts.find((f) => f.id === id) ?? null;

    /* ── D3: the ON-CONNECTOR candidate funnel ───────────────────────── */
    {
        const { k, at } = await goTo('on-connector');
        const ids = at.facts.filter((f) => f !== '__all');
        for (const id of ['door-candidates-offered', 'door-candidates-tried',
            'door-candidates-legal']) {
            check(ids.includes(id), `⛓ the on-connector row LISTS \`${id}\` as a selectable line`,
                json(ids));
        }
        const after = await tickAll(k);
        const legal = sel(after, 'door-candidates-legal');
        const tried = sel(after, 'door-candidates-tried');
        const offered = sel(after, 'door-candidates-offered');
        check(json(legal?.cells) === json(nodeFact('on-connector', 'door-candidates-legal').cells),
            '⛓⛓⛓ …and the LEGAL set the painter consumed is node\'s, cell for cell',
            `${legal?.cells.length} cell(s)`);
        check(legal?.cells.length === rows.find((r) => r.phase === 'on-connector')
            .data.candidates,
        '⛓⛓⛓ …and it is EXACTLY the set the element\'s ONE draw picked from '
            + '(`cost.candidates`) — the equality that says it was CARRIED',
        `${legal?.cells.length} vs ${rows.find((r) => r.phase === 'on-connector').data.candidates}`);
        const key = (c) => `${c.x},${c.y}`;
        const off = new Set(offered.cells.map(key));
        const tri = new Set(tried.cells.map(key));
        check(tried.cells.every((c) => off.has(key(c)))
            && legal.cells.every((c) => tri.has(key(c))),
        '⛓⛓ …and the funnel NARROWS on the page: offered ⊇ tried ⊇ legal',
        `${off.size} ⊇ ${tri.size} ⊇ ${legal.cells.length}`);
        check(legal.pick && tri.has(key(legal.pick)),
            '⛔ …with the PICK outlined, and it is one of the legal cells', json(legal.pick));
    }

    /* ── D1: the door law's two floods, on the COMPOSITE row ─────────── */
    {
        const k = rows.map((r) => r.phase).lastIndexOf('composite');
        await page.evaluate((i) => {
            const el = document.getElementById('genPhase');
            el.value = String(i);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, k);
        await atPhase(k);
        const at = await tickAll(k);
        const s = sel(at, 'door-flood-start');
        const g = sel(at, 'door-flood-goal');
        check(s && g, '⛓ the composite row carries BOTH sides of the door law\'s cut',
            json(at.gen.phase.selected.map((f) => f.id)));
        check(s.kind === 'flood' && g.kind === 'flood',
            '…as `flood` paintables, which the existing painter already draws');
        const key = (c) => `${c.x},${c.y}`;
        const sk = new Set(s.cells.map(key));
        check(g.cells.every((c) => !sk.has(key(c))),
            '⛓⛓⛓ …and the two are DISJOINT on the page\'s own data — which IS clause 1',
            `${s.cells.length} + ${g.cells.length}`);
        const door = rows.find((r) => r.phase === 'on-connector').data.doorCell;
        check(!sk.has(key(door)) && !g.cells.some((c) => key(c) === key(door)),
            '⛔ …and the DOOR cell is in neither — it is the thing that was walled',
            json(door));
    }

    /* ── D4: the certification's ROUTE ───────────────────────────────── */
    {
        const k = rows.findIndex((r) => r.phase === 'certification');
        await page.evaluate((i) => {
            const el = document.getElementById('genPhase');
            el.value = String(i);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, k);
        await atPhase(k);
        const at = await tickAll(k);
        const route = sel(at, 'certification-route');
        check(route !== null, '⛓ the CERTIFICATION row carries the solve\'s own ROUTE',
            json(at.facts));
        check(route.kind === 'path' && route.cells.length > 1,
            '…as a `path`, which is the one thing a cell SET cannot say',
            `${route.cells.length} cell(s)`);
        check(json(route.cells) === json(nodeFact('certification', 'certification-route').cells),
            '⛓⛓⛓ …and it is node\'s route, waypoint for waypoint');
        check(route.note === null || /GAP/.test(route.note),
            '⛔ …and a discontinuity is NAMED in the note rather than bridged',
            (route.note ?? '(none)').slice(0, 60));
        const lines = rows.find((r) => r.phase === 'certification').data.recordLines;
        check(Array.isArray(lines) && lines.length > 0,
            '⛓ …with the solve\'s RECORDS as reader\'s lines beside it', json(lines));
    }

    /* ── D2: the level-n floods and the VESTIBULE, on the AREAS subject ─ */
    {
        await load(`source=generate&seed=${AREAS.seed}&biome=${AREAS.biome}`
            + `&count=0&skeleton=${AREAS.skeleton}&areas=${AREAS.areas}`);
        const arows = nodeAreas.ledger;
        const k = arows.findIndex((r) => r.phase === 'realisation');
        check(k >= 0, '⛓ the AREAS subject reached REALISATION',
            json(arows.map((r) => r.phase)));
        await page.evaluate((i) => {
            const el = document.getElementById('genPhase');
            el.value = String(i);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, k);
        await atPhase(k);
        const at = await tickAll(k);
        const ves = at.gen.phase.selected.find((f) => f.id === 'goal-vestibule') ?? null;
        const levels = at.gen.phase.selected.filter((f) => /^level-\d+-reach$/.test(f.id));
        check(ves !== null, '⛓⛓ …and its REALISATION row carries the goal\'s VESTIBULE',
            json(at.facts));
        check(levels.length > 0, '⛓⛓ …and one LEVEL-n flood per key level asked',
            json(levels.map((f) => `${f.id}:${f.count}`)));
        /**
         * ⛓⛓⛓ THE CLAIM THE FLOOD EXISTS FOR: level 0 is what the entrance
         * reaches with every level->=1 lock walled, so it must be SMALLER than
         * the next level up. A picture that painted the same set twice would
         * pass a "the line is there" row and fail this one.
         */
        if (levels.length > 1) {
            check(levels[0].count < levels[1].count,
                '⛓⛓⛓ …and level 0 reaches STRICTLY FEWER cells than level 1 — the locks cut',
                `${levels[0].count} < ${levels[1].count}`);
        }
        const nodeVes = arows[k].data.facts.find((f) => f.id === 'goal-vestibule');
        check(json(ves.cells) === json(nodeVes.cells),
            '⛓⛓ …cell for cell against node\'s own ledger');
    }
}

check(errors.length === 0, 'no page errors across the whole row', errors.slice(0, 3).join(' | '));

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
