#!/usr/bin/env node
/**
 * check-procgen-demos — **EVERY URL IN THE DEMO CATALOGUE IS LOADED, AND EVERY
 * ENTRY'S OWN NAMED CLAIM IS ASSERTED OFF THE PAGE'S READOUT** (PROCGEN
 * ELEMENTS arc 3, slice 5b, D5).
 *
 * ⚖ The user's requirement of 2026-08-17 on the generation review (§4 item 6):
 * *"interactive DEMONSTRATIONS of every demonstrable feature — URL + how to run
 * + what is happening"*. A catalogue nobody runs is a catalogue that rots: a
 * seed whose element stops certifying, a parameter that is renamed, a page that
 * stops reading one — each would leave a link that opens something other than
 * what the prose beside it promises, and nothing would say so.
 *
 * ⛔⛔ **THE DOC IS THE INPUT, NOT A COPY OF IT.** This row PARSES
 * `docs/json/developer/procgen/demos.md` and drives what it finds there. A URL
 * added to the file is loaded by the next run without anybody editing this
 * script, and a URL this script cannot parse is a FAILURE rather than a skip —
 * "the row passed because it did not look at the entry" is the one outcome a
 * rot detector must not have.
 *
 * ── THE ENTRY SHAPE (the parser's whole contract) ─────────────────────
 *
 *   ### <n>. <title>
 *   - **Page:** `<repo path to the .html>`
 *   - **URL:** `<query string>`          ← the page's OWN writer's spelling
 *   - **Phase:** `<phase name>`          ← optional: step the ladder to it
 *   - **Facts:** `<id>,<id>`             ← optional: TICK these fact lines
 *   - **Layer:** `<off|sites|elements|areas|all>`  ← optional: the overlay
 *   - **Claim:** `<path> <op> <value>`   ← asserted off the page's readout
 *   - **Live:** <https://…>              ← optional: the SAME run on GitHub Pages
 *
 * ⛓ `Live:` is the entry's URL on the deployed site (`deploy-gh-pages.yml`
 * publishes `frontend/` as the Pages ROOT, so `/frontend/modules/…` becomes
 * `<base>/modules/…`). It is not typed by hand either: this row asserts that
 * every `Live:` link is EXACTLY `<base> + Page (minus /frontend) + ? + URL`,
 * so the live link and the local URL cannot drift apart. `--pages=<base>` runs
 * the whole catalogue AGAINST the deployed site instead of a local server.
 *
 * `Page` selects the readout: `watch.html` publishes `window.__editorGenerate`,
 * `lab.html` publishes `window.__mazeLab`. Everything else in an entry (the CLI
 * command, how to run it, what is happening) is for the READER and is not
 * parsed — with one exception: an entry with NO `Claim:` line is a failure,
 * because ⚖ the brief's own rule is that *a catalogue entry without a claim is
 * not an entry*.
 *
 * ⛓⛓ **`Phase`/`Facts`/`Layer` ARE DRIVEN, NOT DECORATION.** They are the three
 * things a catalogue entry has to tell a reader (⚖ the brief: *which PHASE to
 * step to, which FACT LINES to select, which overlay layer*), so the row
 * PRESSES them — the phase slider, the fact checkboxes, the overlay select —
 * and the claim is then asserted on the page that a reader following the entry
 * would be looking at. An entry naming a phase the ledger does not have, or a
 * fact id the phase did not record, FAILS: that is exactly the rot this row is
 * for.
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
 *      node scripts/procgen/check-procgen-demos.mjs --only=7
 *      node scripts/procgen/check-procgen-demos.mjs --pages=https://peerinfinity.github.io/Archipelago-CC
 */

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const CATALOGUE = join(REPO, 'docs/json/developer/procgen/demos.md');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/* ══════════ THE PARSER ══════════════════════════════════════════════ */

/** ⛓ One `- **Field:** \`value\`` line, or `null`. */
const field = (block, name) => {
    const m = block.match(new RegExp(`^- \\*\\*${name}:\\*\\*\\s+\`([^\`]*)\``, 'm'));
    return m ? m[1] : null;
};

const READOUTS = new Map([
    ['/frontend/modules/seedlingDemo/watch.html', '__editorGenerate'],
    ['/frontend/modules/mazeRoom/lab.html', '__mazeLab'],
]);

function parseCatalogue(text) {
    const out = [];
    const parts = text.split(/^### /m).slice(1);
    for (const part of parts) {
        const title = part.split('\n', 1)[0].trim();
        const page = field(part, 'Page');
        const url = field(part, 'URL');
        const claim = field(part, 'Claim');
        const phase = field(part, 'Phase');
        const facts = field(part, 'Facts');
        const layer = field(part, 'Layer');
        /** ⛓ A SECOND URL an entry loads for CONTRAST (the carve's typed 0 against
         *  its default). It is LOADED and asserted CLEAN; the entry's claim is
         *  about its own `URL:`. It exists so that the coverage rule below can
         *  stay absolute: every URL in the file is an entry's. */
        const also = field(part, 'Also');
        /** ⛓ The deployed link — `- **Live:** <https://…>` — kept honest below. */
        const liveM = part.match(/^- \*\*Live:\*\* <([^>\n]+)>/m);
        const live = liveM ? liveM[1] : null;
        /**
         * ⛔ AN ENTRY WITH NO `Page:`/`URL:` IS NOT AN OMISSION — it is a
         * PROSE entry (the pointer at an existing doc), and the file says so
         * with `- **Page:** _(none — …)_` rather than by leaving the line out.
         * A missing line is a parse failure; an explicit none is a decision.
         */
        if (page === null && url === null && /\*\*Page:\*\* _\(none/.test(part)) {
            out.push({ title, prose: true });
            continue;
        }
        out.push({ title, page, url, claim, phase, layer, also, live,
            facts: facts ? facts.split(',') : [] });
    }
    return out;
}

/* ══════════ THE CLAIM GRAMMAR ═══════════════════════════════════════ */

const OPS = ['>=', '<=', '!=', '==', '>', '<', 'includes', 'matches'];

/** `a.b.c OP value` → `{path, op, value}`; a malformed claim THROWS. */
function parseClaim(text) {
    for (const op of OPS) {
        const at = text.indexOf(` ${op} `);
        if (at < 0) continue;
        const path = text.slice(0, at).trim();
        const raw = text.slice(at + op.length + 2).trim();
        let value;
        try { value = JSON.parse(raw); } catch { value = raw; }
        return { path, op, value };
    }
    throw new Error(`the claim ${JSON.stringify(text)} has no operator — one of `
        + `[${OPS.join(' ')}] with a space each side`);
}

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

const entries = parseCatalogue(readFileSync(CATALOGUE, 'utf8'));
const only = arg('only', '');
console.log(`catalogue: ${entries.length} entr(ies) in demos.md `
    + `(${entries.filter((e) => e.prose).length} prose)`);

let server = null;
const host = arg('host', '');
/**
 * ⛓ `--pages=<base>` drives the DEPLOYED site. GitHub Pages publishes the
 * `frontend/` directory as its root (`.github/workflows/deploy-gh-pages.yml`),
 * so an entry's `/frontend/modules/…` page lives at `<base>/modules/…` there.
 * The Live-link consistency claim below uses the SAME base — the default is
 * this fork's, so a bare run still checks the links even when it loads the
 * catalogue from a local server.
 */
const PAGES_DEFAULT_BASE = 'https://peerinfinity.github.io/Archipelago-CC';
const pages = arg('pages', '');
const pagesBase = (pages || PAGES_DEFAULT_BASE).replace(/\/$/, '');
const pagePath = (p) => (pages ? p.replace(/^\/frontend(?=\/)/, '') : p);
if (!host && !pages) server = await serveRepoRoot({});
const origin = pages ? pagesBase : (host || `http://127.0.0.1:${server.address().port}`);
const liveLinkFor = (entry) => `${pagesBase}${entry.page.replace(/^\/frontend(?=\/)/, '')}?${entry.url}`;

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
    for (const entry of entries) {
        if (only && !entry.title.startsWith(`${only}.`)) continue;
        if (entry.prose) {
            check(true, `⛓ "${entry.title}" is a PROSE entry — it points at an existing `
                + 'document and names no URL of its own');
            continue;
        }
        if (!entry.page || !entry.url) {
            check(false, `"${entry.title}" is missing its **Page:** or **URL:** line`);
            continue;
        }
        if (!entry.claim) {
            check(false, `"${entry.title}" names NO CLAIM — ⚖ a catalogue entry without a `
                + 'claim is not an entry');
            continue;
        }
        const readout = READOUTS.get(entry.page);
        if (!readout) {
            check(false, `"${entry.title}" names a page this row does not know how to read`,
                `${entry.page}; known: [${[...READOUTS.keys()].join(', ')}]`);
            continue;
        }
        const q = new URLSearchParams(entry.url);
        const step = q.get('run') === '1' ? Number(q.get('count') ?? 0) : 0;
        errors.length = 0;
        const url = `${origin}${pagePath(entry.page)}?${entry.url}`;
        console.log(`\n${entry.title}\n  ${url}\n  claim: ${entry.claim}`);
        /** ⛓ THE LIVE LINK IS DERIVED, NOT TYPED — an entry that carries one
         *  must carry exactly the one its Page + URL spell on Pages. */
        if (entry.live !== null) {
            check(entry.live === liveLinkFor(entry),
                `"${entry.title}" Live: link is exactly Pages base + Page + URL`,
                entry.live === liveLinkFor(entry) ? entry.live
                    : `have ${entry.live}\n    want ${liveLinkFor(entry)}`);
        }
        // eslint-disable-next-line no-await-in-loop
        await page.goto(url, { waitUntil: 'domcontentloaded' });
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
            `⛓ "${entry.title}" — the page REACHED the state its URL names (step ${step})`,
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
            await page.goto(`${origin}${pagePath(entry.page)}?${entry.also}`,
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
 * ⛓⛓⛓ COVERAGE — **EVERY URL IN THE FILE IS AN ENTRY'S, AND EVERY ENTRY'S IS
 * LOADED.** ⛔ Without this the row would be satisfied by a catalogue that
 * mentioned six links and declared two: the rot would be in the prose, where
 * a reader reads it, and the gate would be green.
 * ══════════════════════════════════════════════════════════════════════ */
if (!only) {
    const declared = new Set(entries.flatMap((e) => [e.url, e.also].filter(Boolean)));
    const text = readFileSync(CATALOGUE, 'utf8');
    const looksLikeUrl = /`(source=[^`]+|seed=\d[^`]*)`/g;
    const found = new Set();
    for (const m of text.matchAll(looksLikeUrl)) found.add(m[1]);
    const stray = [...found].filter((u) => !declared.has(u));
    check(stray.length === 0,
        '⛓⛓⛓ every query string in demos.md is DECLARED by an entry (and therefore LOADED)',
        stray.length ? `undeclared: ${stray.map((u) => u.slice(0, 60)).join(' | ')}` : `${found.size} URL(s)`);
}

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
