#!/usr/bin/env node
/**
 * check-procgen-demos — **EVERY LINK IN THE DEMO CATALOGUE IS LOADED, AND
 * EVERY ENTRY'S OWN NAMED CLAIM IS ASSERTED OFF THE PAGE'S READOUT** (PROCGEN
 * ELEMENTS arc 3, slice 5b; rebuilt on the data module by PROCGEN DOCS P1).
 *
 * ⚖ The user's requirement of 2026-08-17 on the generation review (§4 item 6):
 * *"interactive DEMONSTRATIONS of every demonstrable feature — URL + how to run
 * + what is happening"*. A catalogue nobody runs is a catalogue that rots: a
 * seed whose element stops certifying, a parameter that is renamed, a page that
 * stops reading one — each would leave a link that opens something other than
 * what the prose beside it promises, and nothing would say so.
 *
 * ⛔⛔ **THE CATALOGUE IS `frontend/modules/procgenDocs/demos.js`, AND THIS ROW
 * IMPORTS IT.** ⚖ The user, 2026-08-18: *"change demos.md to an html file, so
 * that it can interact with the scripts directly, rather than having to be
 * manually edited"*. Until then this row PARSED `demos.md` and the file
 * carried a hand-kept `Live:` link per entry that a claim here checked for
 * drift. Now there is ONE module and TWO readers of it — this row, and
 * `procgenDocs/demos.html`, which renders it in a browser. An entry edited in
 * the module is the link the page shows AND the link this row loads, in the
 * same commit; there is no second copy to drift, and no markdown to parse.
 *
 * ── WHAT AN ENTRY GIVES THIS ROW ──────────────────────────────────────
 *
 *   page     the repo path to the .html — must be one of `READOUTS`
 *   url      the query string, the page's OWN writer's spelling
 *   also     an optional SECOND url, LOADED for contrast and asserted clean
 *   phase    optional: step the ladder to it
 *   facts    optional: TICK these fact lines
 *   layer    optional: the overlay select
 *   claim    `<path> <op> <value>`, asserted off the page's readout
 *   prose    an entry that names no url of its own (it points at a doc)
 *
 * `page` selects the readout: `watch.html` publishes `window.__editorGenerate`,
 * `lab.html` publishes `window.__mazeLab`. Everything else on an entry (the CLI
 * command, how to run it, what is happening) is for the READER — except that an
 * entry with NO claim is a FAILURE, because ⚖ the brief's own rule is that *a
 * catalogue entry without a claim is not an entry*.
 *
 * ⛓⛓ **`phase`/`facts`/`layer` ARE DRIVEN, NOT DECORATION.** They are the three
 * things a catalogue entry has to tell a reader (⚖ the brief: *which PHASE to
 * step to, which FACT LINES to select, which overlay layer*), so the row
 * PRESSES them — the phase slider, the fact checkboxes, the overlay select —
 * and the claim is then asserted on the page that a reader following the entry
 * would be looking at. An entry naming a phase the ledger does not have, or a
 * fact id the phase did not record, FAILS: that is exactly the rot this row is
 * for.
 *
 * ⛓⛓⛓ **AND THE CATALOGUE PAGE ITSELF IS LOADED.** `demos.html` is the other
 * reader of the module, so a rendering bug is a catalogue failure: the row
 * asserts the page renders the same entries, in the same order, with the same
 * links — measured off ITS DOM, not echoed from the import. That is what
 * replaced the old coverage-over-a-markdown-file claim.
 *
 * ⛓ `--pages=<base>` runs the whole catalogue AGAINST THE DEPLOYED SITE
 * (`deploy-gh-pages.yml` publishes `frontend/` as the Pages ROOT, so an entry's
 * `/frontend/modules/…` lives at `<base>/modules/…` there — the mapping is
 * `pagesHref()` in the data module, spelled ONCE and imported here). Every
 * navigation asserts a 200, so under `--pages=` this row is the check that the
 * links the page SHOWS are links that load.
 *
 * ⛔ THE WAIT IS ON THE CLAIM'S OWN PRE-CONDITION, never on existence (trap
 * 246): both pages publish their readout at the SKELETON, before `?run=1`'s
 * ladder has run a rung. The expected step is DERIVED from the URL — `run=1`
 * means the ladder goes to `count`, its absence means step 0 — and the Seedling
 * page's RUN-ALL button must also have come back enabled.
 *
 * ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP (trap 176).
 *
 * Run: node scripts/procgen/check-procgen-demos.mjs
 *      node scripts/procgen/check-procgen-demos.mjs --host=http://localhost:8000
 *      node scripts/procgen/check-procgen-demos.mjs --only=sword-gated
 *      node scripts/procgen/check-procgen-demos.mjs --only=7
 *      node scripts/procgen/check-procgen-demos.mjs --pages=https://peerinfinity.github.io/Archipelago-CC
 */

import { chromium } from '@playwright/test';

import {
    DEMOS, PAGES_BASE, READOUTS, pagesHref, parseClaim,
} from '../../frontend/modules/procgenDocs/demos.js';
import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

/** ⛓ The catalogue PAGE — the module's other reader, gated below. */
const DEMOS_PAGE = '/frontend/modules/procgenDocs/demos.html';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/* ══════════ THE CLAIM GRAMMAR ═══════════════════════════════════════
 * ⛓ `parseClaim` lives in the data module now, beside the claims it parses,
 * so the page, this row and the unit test all agree on what a well-formed
 * entry is. What stays here is the half that needs a live readout. */

const dig = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function holds({ op, value }, got) {
    switch (op) {
    case '==': return JSON.stringify(got) === JSON.stringify(value);
    case '!=': return JSON.stringify(got) !== JSON.stringify(value);
    case '>=': return Number(got) >= Number(value);
    case '<=': return Number(got) <= Number(value);
    case '>': return Number(got) > Number(value);
    case '<': return Number(got) < Number(value);
    case 'includes': return Array.isArray(got)
        ? got.includes(value) : String(got ?? '').includes(String(value));
    case 'matches': return new RegExp(String(value)).test(String(got ?? ''));
    default: throw new Error(`unknown op ${op}`);
    }
}

/* ══════════ THE RUN ═════════════════════════════════════════════════ */

const only = arg('only', '');
const chosen = only
    ? DEMOS.filter((e) => e.id === only || String(e.n) === only)
    : DEMOS;
console.log(`catalogue: ${DEMOS.length} entr(ies) in procgenDocs/demos.js `
    + `(${DEMOS.filter((e) => e.prose).length} prose)`
    + (only ? ` — --only=${only} selects ${chosen.length}` : ''));
if (only && chosen.length === 0) {
    console.log(`\n--only=${only} matched NO entry; ids: [${DEMOS.map((e) => e.id).join(', ')}]`);
    process.exit(1);
}

let server = null;
const host = arg('host', '');
/**
 * ⛓ `--pages=<base>` drives the DEPLOYED site, and `pagesHref()` from the data
 * module is the ONE spelling of the mapping (`frontend/` is the Pages root, so
 * `/frontend/modules/…` is `<base>/modules/…`). ⛔ The row does not keep its
 * own copy of that rule any more — a second spelling was exactly what the old
 * hand-typed `Live:` lines and their consistency claim existed to police.
 */
const pages = arg('pages', '');
const pagesBase = (pages || PAGES_BASE).replace(/\/$/, '');
const pagePath = (path) => (pages ? path.replace(/^\/frontend(?=\/)/, '') : path);
if (!host && !pages) server = await serveRepoRoot({});
const origin = pages ? pagesBase : (host || `http://127.0.0.1:${server.address().port}`);
/** ⛓ The link for THIS run: on `--pages=` it IS `pagesHref(entry)`. */
const hrefFor = (entry, url = entry.url) => (pages
    ? pagesHref(entry, { base: pagesBase, url })
    : `${origin}${pagePath(entry.page)}?${url}`);

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

try {
    for (const entry of chosen) {
        const name = `${entry.n}. ${entry.title}`;
        /* ── the two SHAPE claims, asserted for every entry the catalogue
         *    holds. ⛔ They replace the parser's failure branches: a module
         *    cannot be "missing a **URL:** line", but it can very easily hold
         *    an entry nothing can load, and the old coverage claim over the
         *    markdown is what used to notice. */
        check(entry.prose || Boolean(entry.claim),
            `⛓ "${name}" NAMES A CLAIM — ⚖ a catalogue entry without one is not an entry`,
            entry.prose ? 'prose entry — it points at a doc and names no URL of its own'
                : entry.claim);
        if (entry.prose) continue;
        check(READOUTS.has(entry.page),
            `…and names a page this row knows how to READ`,
            READOUTS.has(entry.page) ? `${entry.page} → window.${READOUTS.get(entry.page)}`
                : `${entry.page}; known: [${[...READOUTS.keys()].join(', ')}]`);
        const readout = READOUTS.get(entry.page);
        if (!readout || !entry.claim) continue;
        const q = new URLSearchParams(entry.url);
        const step = q.get('run') === '1' ? Number(q.get('count') ?? 0) : 0;
        errors.length = 0;
        const url = hrefFor(entry);
        console.log(`\n${name}\n  ${url}\n  claim: ${entry.claim}`);
        // eslint-disable-next-line no-await-in-loop
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        /** ⛓⛓ THE LINK THE PAGE SHOWS IS A LINK THAT LOADS. Under `--pages=`
         *  this url IS `pagesHref(entry)` — the exact string `demos.html`
         *  puts in its PAGES anchor — so a 404 on the deployed site is a
         *  catalogue failure rather than something a reader discovers. */
        check(response?.status() === 200,
            `…and the link RESOLVES (HTTP 200)`, `status ${response?.status() ?? 'none'}`);
        let got;
        let waitError = null;
        try {
            // eslint-disable-next-line no-await-in-loop
            await page.waitForFunction(([r, s]) => {
                const o = window[r];
                if (!o) return false;
                if (o.fatal) return true;
                if (o.status && o.status !== 'ok') return true;
                if (o.step !== s) return false;
                const run = document.getElementById('genRunAll');
                return !run || !run.disabled;
            }, [readout, step], { timeout: 300000 });
        } catch (e) { waitError = e.message; }
        // eslint-disable-next-line no-await-in-loop
        const state = await page.evaluate((r) => window[r] ?? null, readout);
        check(waitError === null,
            `⛓ "${name}" — the page REACHED the state its URL names (step ${step})`,
            waitError ?? '');
        check(errors.length === 0, '…with ZERO console errors and ZERO pageerrors',
            errors.join(' | '));
        /* ── the three controls the entry names, PRESSED ────────────── */
        let driven = state;
        if (entry.phase) {
            // eslint-disable-next-line no-await-in-loop
            const at = await page.evaluate(([r, n]) => {
                const i = (window[r]?.phase?.phases ?? []).lastIndexOf(n);
                if (i < 0) return -1;
                const slider = document.getElementById('genPhase');
                slider.value = String(i);
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                return i;
            }, [readout, entry.phase]);
            check(at >= 0, `…the ledger HAS the phase the entry names (\`${entry.phase}\`)`,
                at < 0 ? `phases: ${JSON.stringify(state?.phase?.phases ?? null)}` : `index ${at}`);
            if (at >= 0) {
                // eslint-disable-next-line no-await-in-loop
                await page.waitForFunction(([r, i]) => window[r]?.phase?.index === i,
                    [readout, at], { timeout: 60000 });
            }
        }
        for (const id of entry.facts) {
            // eslint-disable-next-line no-await-in-loop
            const ticked = await page.evaluate((f) => {
                const box = document.querySelector(`#genPhaseFacts input[data-fact="${f}"]`);
                if (!box) return false;
                if (!box.checked) box.click();
                return true;
            }, id);
            check(ticked, `…and the phase RECORDED the fact line the entry names (\`${id}\`)`);
        }
        if (entry.layer) {
            // eslint-disable-next-line no-await-in-loop
            await page.selectOption('#genLayer', entry.layer);
            // eslint-disable-next-line no-await-in-loop
            await page.waitForFunction(([r, l]) => window[r]?.layer === l,
                [readout, entry.layer], { timeout: 60000 });
        }
        if (entry.phase || entry.facts.length || entry.layer) {
            // eslint-disable-next-line no-await-in-loop
            driven = await page.evaluate((r) => window[r] ?? null, readout);
        }
        const claim = parseClaim(entry.claim);
        got = dig(driven, claim.path);
        if (entry.also) {
            errors.length = 0;
            // eslint-disable-next-line no-await-in-loop
            await page.goto(hrefFor(entry, entry.also),
                { waitUntil: 'domcontentloaded' });
            // eslint-disable-next-line no-await-in-loop
            await page.waitForFunction((r) => Boolean(window[r]), readout, { timeout: 300000 })
                .catch(() => {});
            // eslint-disable-next-line no-await-in-loop
            const ok = await page.evaluate((r) => Boolean(window[r]) && !window[r].fatal, readout);
            check(ok && errors.length === 0,
                `…and the entry's CONTRAST link loads clean too (\`Also:\`)`,
                errors.join(' | '));
        }
        check(holds(claim, got),
            `⛓⛓ …and its OWN CLAIM holds: \`${entry.claim}\``,
            `${claim.path} = ${JSON.stringify(got)}`);
    }
} catch (e) {
    check(false, 'the demos row THREW', e.stack ?? e.message);
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE CATALOGUE PAGE IS THE MODULE'S OTHER READER, SO IT IS GATED HERE.
 * ⛔ Without this the row would be satisfied by a module whose page renders
 * nothing: the entries would be correct, every link would load, and a reader
 * opening `demos.html` would see an empty document. The old coverage claim
 * asked the same question of a markdown file — "is what a READER sees the
 * thing this row checked?" — and this is that question about the page.
 *
 * ⛓ The page publishes `__procgenDemosPage` MEASURED OFF ITS OWN DOM (ids,
 * count, every rendered href). A readout echoed from the import would hold
 * with the render deleted (trap 269).
 * ══════════════════════════════════════════════════════════════════════ */
try {
    const url = pages ? `${pagesBase}${pagePath(DEMOS_PAGE)}` : `${origin}${DEMOS_PAGE}`;
    console.log(`\nthe catalogue PAGE\n  ${url}`);
    errors.length = 0;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    check(response?.status() === 200, '⛓ the catalogue page RESOLVES (HTTP 200)',
        `status ${response?.status() ?? 'none'}`);
    await page.waitForFunction(() => window.__procgenDemosPage?.ready === true,
        undefined, { timeout: 60000 }).catch(() => {});
    const seen = await page.evaluate(() => window.__procgenDemosPage ?? null);
    check(errors.length === 0, '…with ZERO console errors and ZERO pageerrors',
        errors.join(' | '));
    check(seen?.count === DEMOS.length,
        '…and it RENDERED one section per entry in the module',
        `page ${seen?.count ?? 'none'} vs module ${DEMOS.length}`);
    const wantIds = DEMOS.map((e) => e.id).join(',');
    check((seen?.ids ?? []).join(',') === wantIds,
        '…the same entries, in the same order (its ids, off its DOM)',
        (seen?.ids ?? []).join(',') === wantIds ? wantIds
            : `page [${(seen?.ids ?? []).join(',')}]\n    want [${wantIds}]`);
    /** ⛓ And the PAGES link beside every entry is the one this row loads —
     *  one function, two readers, no third spelling. */
    const wantLinks = DEMOS.filter((e) => !e.prose)
        .flatMap((e) => [e.url, e.also].filter(Boolean).map((u) => pagesHref(e, { url: u })));
    const missing = wantLinks.filter((l) => !(seen?.links ?? []).includes(l));
    check(missing.length === 0,
        `…and SHOWS every entry's Pages link (${wantLinks.length} of them)`,
        missing.length ? `missing: ${missing.join(' | ')}` : 'all rendered');
} catch (e) {
    check(false, 'the catalogue PAGE check THREW', e.stack ?? e.message);
}


console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
