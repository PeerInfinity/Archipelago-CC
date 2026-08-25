#!/usr/bin/env node
/**
 * check-preset-bundle-load — **THE MAIN APP OPENS A BUNDLE AND A `.json.gz`.**
 *
 * EDITOR v3 slice E1c (`CC/docs/plans/seedling-editor-v3.md` §25; ⚖ the user's
 * 2026-08-25 ruling, plan §22.8 items 2–4).
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP ─────────────────────
 *
 * `serveRepoRoot` on a free port, shut down on every path, no skip condition
 * (trap 176). `--host=` reuses an existing server, which is a convenience and
 * not an escape.
 *
 * ── ⛓ WHY IT IS ITS OWN ROW ───────────────────────────────────────────
 *
 * Every other Seedling row drives `watch.html`. This one drives
 * `frontend/index.html` — the app a person actually loads a preset into — and
 * the claim is about the door that changed: `#json-file-input`. The unit rows
 * (`documentBundle.test.js`) prove the CONTAINER; only a browser can prove that
 * what comes out of it reaches `files:jsonLoaded` as the same document the
 * plain `.json` does.
 *
 * ⛔ **THE ANCHOR IS THE PLAIN FILE, NOT A TYPED NUMBER** (trap 269's shape). The
 * row loads a committed preset three ways — as `.json`, as a `.zip` bundle, as
 * a `.json.gz` — and asserts the second and third against the FIRST. A hardcoded
 * region count would be a fact about the day this file was written.
 *
 * ⛔ **AND IT WRITES ONLY TO ITS OWN SCRATCH DIRECTORY.** No committed
 * `*_rules.json` is ever minified or gzipped (byte pins); the `.zip` and the
 * `.json.gz` are BUILT HERE from a committed preset into a temp dir and removed
 * on every path.
 *
 * ── THE CLAIMS ────────────────────────────────────────────────────────
 *
 *  1. **THE FILE INPUT OFFERS THE THREE SHAPES** — `accept` names `.json`,
 *     `.json.gz`, `.zip` and still `.archipelago`.
 *  2. **A PLAIN `.json` LOADS** — and what it published is the ANCHOR.
 *  3. **THE BUNDLE LOADS THE SAME DOCUMENT** — `game_name`, `seed_name` and the
 *     region count all equal the anchor's.
 *  4. **THE IGNORED MEMBERS ARE NAMED** — the level set, the overlay and the
 *     region atlas travelled in the same zip and the app said so, by kind and
 *     by entry name. A member that vanished without a word is
 *     indistinguishable from one that was never there.
 *  5. **A `.json.gz` LOADS THE SAME DOCUMENT** — gunzipped by the `1f 8b` magic.
 *  6. **NOTHING WAS DOUBLE-DECODED** — the plain `.json` went through the same
 *     `gunzipIfNeeded` seam and is unharmed, which is the mutant that a gunzip
 *     keyed on a header or a name would fail.
 *  7. **NO PAGE ERROR AND NO 404** across all three loads.
 *
 * Run: node scripts/procgen/check-preset-bundle-load.mjs
 *      node scripts/procgen/check-preset-bundle-load.mjs --host=http://localhost:8000
 */

import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';
import { loadJSZipNode } from './loadJSZipNode.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const { writeBundle } = await import(
    join(REPO, 'frontend/modules/presets/documentBundle.js'));

let failed = 0;
const check = (ok, what, detail) => {
    // eslint-disable-next-line no-console
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ NODE BUILDS THE THREE FILES FIRST — from COMMITTED documents.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ **A SMALL COMMITTED PRESET WITH A NON-EMPTY `seed_name`.** The seedling
 * presets stamp an EMPTY `seed_name`, and an equality row over `'' === ''` is
 * a row that cannot fail; this one carries a real 20-digit seed, so all three
 * of the compared fields say something.
 */
const RULES_PATH =
    'frontend/presets/bakingadventure/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const RULES_TEXT = readFileSync(join(REPO, RULES_PATH), 'utf8');
const RULES = JSON.parse(RULES_TEXT);
const LEVEL_SET = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), 'utf8'));
const ATLAS = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/flashPanel/atlases/seedling-fixture.json'), 'utf8'));
/** ⛓ An overlay of the shape D2 writes — `rooms` keyed BY INDEX, never an array. */
const OVERLAY = { schema_version: 1, overlay_id: 'overlay-e1c-gate', rooms: { 3: { rules: {} } } };

/** ⛓ NODE'S OWN ANSWER, so the browser's is compared and not trusted. */
const NODE_REGIONS = Object.keys(RULES.regions?.[Object.keys(RULES.regions)[0]] ?? {}).length;

const scratch = mkdtempSync(join(tmpdir(), 'e1c-bundle-gate-'));
const PLAIN = join(scratch, 'AP_1_rules.json');
const BUNDLE = join(scratch, 'AP_1_bundle.zip');
const GZ = join(scratch, 'AP_1_rules.json.gz');
writeFileSync(PLAIN, RULES_TEXT);
writeFileSync(BUNDLE, await writeBundle([
    { kind: 'rules', doc: RULES },
    { kind: 'level-set', doc: LEVEL_SET },
    { kind: 'overlay', doc: OVERLAY },
    { kind: 'region-atlas', doc: ATLAS },
], { jszip: loadJSZipNode() }));
writeFileSync(GZ, gzipSync(Buffer.from(RULES_TEXT)));

// eslint-disable-next-line no-console
console.log(`node: ${RULES_PATH} — game_name ${RULES.game_name}, seed_name ${RULES.seed_name}; `
    + `bundle ${readFileSync(BUNDLE).length} B, gz ${readFileSync(GZ).length} B, `
    + `plain ${RULES_TEXT.length} B`);

/* ══════════════════════════════════════════════════════════════════════
 * THE BROWSER
 * ══════════════════════════════════════════════════════════════════════ */

const host = arg('host', '');
const server = host ? null : await serveRepoRoot();
const base = host || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

const finish = async (code) => {
    await browser.close();
    if (server) await closeServer(server);
    rmSync(scratch, { recursive: true, force: true });
    process.exit(code);
};

const errors = [];
const notFound = [];
const NO_URL_404 = 'Failed to load resource: the server responded with a status of 404';
/**
 * ⛓ ONE KNOWN-BENIGN 404, EXCLUDED BY NAME AND COUNTED — `app/buildInfo.js`
 * probes `/_source-mtime`, which only `serve-nocache.py` serves. Named rather
 * than matched loosely, and the count is printed, because a bounded exclusion
 * that does not say what it excluded reads as "there was nothing to exclude".
 */
const BENIGN_404 = ['/_source-mtime'];

try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (m.text().includes(NO_URL_404)) return;
        errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });
    /**
     * ⛔ A DIALOG IS RECORDED, NOT JUST DISMISSED. `displayLoadedJsonFileDetails`
     * asks "is this a rules.json for a game?" when the NAME does not say so —
     * and for a bundle member the CLASSIFIER has already answered, so a prompt
     * here would be the defect, not the handling.
     */
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });

    await page.goto(`${base}/frontend/index.html`, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
        () => Boolean(document.getElementById('json-file-input')) && Boolean(window.eventBus),
        null, { timeout: 120000 },
    ).catch((e) => { throw new Error(`STUCK waiting for the presets panel: ${e.message}`); });

    /* ── CLAIM 1 ─────────────────────────────────────────────────────── */
    const accept = await page.evaluate(
        () => document.getElementById('json-file-input').getAttribute('accept'));
    const wanted = ['.json', '.json.gz', '.zip', '.archipelago'];
    check(wanted.every((x) => accept.split(',').includes(x)),
        '⛓ CLAIM 1 — the file input OFFERS the three shapes and keeps `.archipelago`',
        `accept="${accept}"`);

    /**
     * ⛓⛓ THE TAP, installed before the first upload: every `files:jsonLoaded`
     * and `ui:notification` IN ORDER. ⛔ A row that read only a final state
     * could not tell "the bundle published this document" from "the previous
     * load is still on screen".
     */
    await page.evaluate(() => {
        window.__e1c = { loaded: [], notes: [] };
        window.eventBus.subscribe('files:jsonLoaded', (d) => {
            window.__e1c.loaded.push({
                sourceName: d.sourceName,
                game_name: d.jsonData?.game_name,
                seed_name: d.jsonData?.seed_name,
                regions: Object.keys(d.jsonData?.regions ?? {}).length,
                playerRegions: Object.keys(
                    d.jsonData?.regions?.[Object.keys(d.jsonData?.regions ?? {})[0]] ?? {}).length,
            });
        }, 'e1cTap');
        window.eventBus.subscribe('ui:notification',
            (d) => window.__e1c.notes.push(`${d.type}: ${d.message}`), 'e1cTap');
    });

    /**
     * ⛔ **THE INPUT IS GONE AFTER A LOAD, AND THAT IS THE PANEL WORKING.**
     * `displayLoadedJsonFileDetails` REPLACES the games list with a detail view
     * whose only navigation is `#back-to-presets` — so a second
     * `setInputFiles('#json-file-input')` waits 30 s for an element the page
     * deliberately removed. Measured here, on the second upload. ⇒ every upload
     * re-enters through the panel's own BACK button rather than through a
     * re-render nobody can press, which also makes each load a fresh journey
     * through the same door a person would take.
     */
    const upload = async (path, why) => {
        const before = await page.evaluate(() => window.__e1c.loaded.length);
        if (!await page.evaluate(() => Boolean(document.getElementById('json-file-input')))) {
            await page.click('#back-to-presets');
            await page.waitForFunction(
                () => Boolean(document.getElementById('json-file-input')),
                null, { timeout: 30000 },
            ).catch((e) => {
                throw new Error(`STUCK re-entering the games list before ${why}: ${e.message}`);
            });
        }
        await page.setInputFiles('#json-file-input', path);
        await page.waitForFunction(
            (n) => window.__e1c.loaded.length > n, before, { timeout: 60000 },
        ).catch((e) => { throw new Error(`STUCK waiting for ${why} to publish: ${e.message}`); });
        return page.evaluate(() => window.__e1c.loaded[window.__e1c.loaded.length - 1]);
    };

    /* ── CLAIM 2 — THE ANCHOR ────────────────────────────────────────── */
    const anchor = await upload(PLAIN, 'the plain .json');
    check(anchor.game_name === RULES.game_name && anchor.seed_name === RULES.seed_name
        && anchor.seed_name !== ''
        && anchor.playerRegions === NODE_REGIONS,
        '⛓ CLAIM 2 — the plain `.json` loads, and node agrees with the page about it',
        `game_name ${anchor.game_name}, seed_name ${anchor.seed_name}, `
        + `${anchor.playerRegions} region(s) (node: ${NODE_REGIONS})`);

    /* ── CLAIMS 3 + 4 — THE BUNDLE ───────────────────────────────────── */
    const notesBefore = await page.evaluate(() => window.__e1c.notes.length);
    const bundled = await upload(BUNDLE, 'the .zip bundle');
    check(bundled.game_name === anchor.game_name && bundled.seed_name === anchor.seed_name
        && bundled.playerRegions === anchor.playerRegions,
        '⛓⛓ CLAIM 3 — the BUNDLE loads THE SAME DOCUMENT as the plain `.json`',
        `game_name ${bundled.game_name}, seed_name ${bundled.seed_name}, `
        + `${bundled.playerRegions} region(s) · source ${bundled.sourceName}`);
    check(/rules\.json/.test(bundled.sourceName ?? ''),
        '⛓ CLAIM 3b — the source name says which MEMBER was loaded',
        bundled.sourceName);
    const newNotes = await page.evaluate(
        (n) => window.__e1c.notes.slice(n), notesBefore);
    const named = newNotes.join(' | ');
    check(['level-set', 'overlay', 'region-atlas'].every((k) => named.includes(k)),
        '⛓⛓ CLAIM 4 — the IGNORED members are NAMED, by kind and by entry name',
        named.slice(0, 300));

    /* ── CLAIM 5 — THE `.json.gz` ────────────────────────────────────── */
    const gz = await upload(GZ, 'the .json.gz');
    check(gz.game_name === anchor.game_name && gz.seed_name === anchor.seed_name
        && gz.playerRegions === anchor.playerRegions,
        '⛓⛓ CLAIM 5 — a `.json.gz` gunzips on the `1f 8b` magic and loads THE SAME DOCUMENT',
        `game_name ${gz.game_name}, ${gz.playerRegions} region(s)`);

    /* ── CLAIM 6 — NOTHING DOUBLE-DECODED ────────────────────────────── */
    const again = await upload(PLAIN, 'the plain .json, a second time');
    check(again.playerRegions === anchor.playerRegions,
        '⛓ CLAIM 6 — the plain `.json` goes through the SAME gunzip seam and is UNHARMED '
        + '(the mutant: a gunzip keyed on the name or the header would throw here)',
        `${again.playerRegions} region(s)`);
    check(dialogs.length === 0,
        '⛓ CLAIM 6b — nothing PROMPTED: the classifier already said the member is a rules.json',
        dialogs.join(' | '));

    /* ── CLAIM 7 ─────────────────────────────────────────────────────── */
    const benign = notFound.filter((u) => BENIGN_404.some((b) => u.includes(b)));
    const real404 = notFound.filter((u) => !BENIGN_404.some((b) => u.includes(b)));
    check(errors.length === 0 && real404.length === 0,
        '⛓ CLAIM 7 — no page error and no unexpected 404 across all four loads '
        + `(${benign.length} benign ${BENIGN_404.join(', ')} 404(s) excluded by name)`,
        [...errors, ...real404].join(' | ').slice(0, 400));
} catch (e) {
    check(false, 'the row ran to the end', e.message);
}

// eslint-disable-next-line no-console
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
