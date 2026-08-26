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
 *  4. **THE IGNORED MEMBERS ARE NAMED** — the level set, the overlay, the
 *     region atlas and (since EDITOR v3 E2c) the REGION LIBRARY travelled in
 *     the same zip and the app said so, by kind and by entry name. A member
 *     that vanished without a word is indistinguishable from one that was never
 *     there.
 *  4b. **THE FIFTH KIND REACHES THIS DOOR** — the bundle written above carries
 *     a committed `region-library` and the app names it. ⛔ Asserted as its own
 *     row rather than folded into claim 4's list, because a kind ADDED to
 *     `BUNDLE_KINDS` that never reached the app's loader would leave claim 4
 *     green over a roster the app has no branch for
 *     ([[feedback_roster_readout_type_filter]] — check what a readout
 *     ENUMERATES before gating on it: `presetUI.loadDocumentFile` names
 *     `members.filter(kind !== 'rules')`, so the library IS enumerated and the
 *     row can see it).
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
/**
 * ⛓⛓ EDITOR v3 E2c — **THE FIFTH MEMBER KIND, FROM A COMMITTED PACK.** The
 * region library is the maze SET arm's primary document; it is not a preset and
 * the app has no reader for it, which is exactly why it belongs in this row —
 * the claim is that an IGNORED member is NAMED, and a fifth kind that nothing
 * named would be a silent drop wearing a new label.
 */
const LIBRARY = JSON.parse(readFileSync(
    join(REPO, 'frontend/region-libraries/demo-maze-pack.json'), 'utf8'));
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
    { kind: 'region-library', doc: LIBRARY },
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
 * ⛓ TWO KNOWN-BENIGN 404s, EXCLUDED BY NAME AND COUNTED.
 *
 * `/_source-mtime` — `app/buildInfo.js` probes it and only `serve-nocache.py`
 * serves it; under a plain static server the build stamp stays empty.
 *
 * `<game>_textadventure.json` — the text-adventure wrapper probes for an
 * OPTIONAL per-game prose document (`customData.js`: *"otherwise null, and the
 * engine keeps its generic prose"*). Only `adventure` ships one, so every other
 * game 404s BY DESIGN. ⚠ It is in this row because the anchor preset is Baking
 * Adventure; a row that had quietly picked a game with a prose file would have
 * been green for a reason nobody chose.
 *
 * ⛔ Named rather than matched loosely, and the counts are PRINTED, because a
 * bounded exclusion that does not say what it excluded reads as "there was
 * nothing to exclude".
 */
const BENIGN_404 = ['/_source-mtime', '_textadventure.json'];
/**
 * ⛓ ONE KNOWN-BENIGN CONSOLE ERROR, EXCLUDED BY NAME AND COUNTED.
 *
 * ⛔ **IT IS THE DRIVER'S NAVIGATION, NOT THE APP'S DEFECT.** Every upload gets
 * a fresh page (see `openApp`), and each load kicks off `sphereState`'s own
 * auto-load for the app's DEFAULT preset — `presets/adventure/…_sphere_log.jsonl`,
 * a file that has nothing to do with the three documents under test. Navigating
 * away cancels that fetch mid-flight and the app reports it, correctly, as
 * `TypeError: Failed to fetch`.
 *
 * ⚠ MATCHED ON BOTH HALVES so it cannot swallow a real fetch failure, and the
 * count is asserted at MOST ONE PER NAVIGATION — a second one on the same page
 * would be something else and would red this row.
 */
const BENIGN_ERROR = (text) => text.includes('Failed to load sphere log')
    && text.includes('TypeError: Failed to fetch');

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

    /**
     * ⛓⛓⛓ **A FRESH PAGE PER UPLOAD, AND THAT IS A MEASUREMENT, NOT A HABIT.**
     *
     * ⛔ THE PRESETS PANEL IS A BACKGROUND TAB OF ITS GOLDENLAYOUT STACK — AT
     * LOAD, before anything is loaded into it. Probed: the chain above
     * `#back-to-presets` is `button → #presets-list → #presets-panel →
     * .lm_content → div{display:none}`. `setInputFiles` never noticed (a file
     * input takes no actionability check, which is why the first upload works
     * and is why this went unseen); the first `page.click` did, timing out 30 s
     * on *"element is not visible"*. And `ui:activatePanel {panelId:
     * 'presetsPanel'}` did not lift it either.
     *
     * ⇒ each upload gets its OWN page load. That is what a person doing three
     * separate loads does anyway, it removes every coupling to layout state,
     * and it keeps the row's subject where it belongs: what `files:jsonLoaded`
     * carries, not which tab is in front.
     *
     * ⚠ `displayLoadedJsonFileDetails` ALSO replaces the games list with a
     * detail view, so `#json-file-input` is gone after a load even when the
     * panel IS in front — a second reason the same page cannot serve two
     * uploads.
     */
    let NAVIGATIONS = 0;
    const openApp = async () => {
        NAVIGATIONS += 1;
        await page.goto(`${base}/frontend/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(
            () => Boolean(document.getElementById('json-file-input')) && Boolean(window.eventBus),
            null, { timeout: 120000 },
        ).catch((e) => { throw new Error(`STUCK waiting for the presets panel: ${e.message}`); });
        /**
         * ⛓⛓ THE TAP, installed before the upload: every `files:jsonLoaded` and
         * `ui:notification` IN ORDER. ⛔ A row that read only a final state
         * could not tell "the bundle published this document" from "the page
         * still shows the previous load".
         */
        await page.evaluate(() => {
            window.__e1c = { loaded: [], notes: [] };
            window.eventBus.subscribe('files:jsonLoaded', (d) => {
                const byPlayer = d.jsonData?.regions ?? {};
                window.__e1c.loaded.push({
                    sourceName: d.sourceName,
                    game_name: d.jsonData?.game_name,
                    seed_name: d.jsonData?.seed_name,
                    playerRegions: Object.keys(byPlayer[Object.keys(byPlayer)[0]] ?? {}).length,
                });
            }, 'e1cTap');
            window.eventBus.subscribe('ui:notification',
                (d) => window.__e1c.notes.push(`${d.type}: ${d.message}`), 'e1cTap');
        });
    };

    await openApp();

    /* ── CLAIM 1 ─────────────────────────────────────────────────────── */
    const accept = await page.evaluate(
        () => document.getElementById('json-file-input').getAttribute('accept'));
    const wanted = ['.json', '.json.gz', '.zip', '.archipelago'];
    check(wanted.every((x) => accept.split(',').includes(x)),
        '⛓ CLAIM 1 — the file input OFFERS the three shapes and keeps `.archipelago`',
        `accept="${accept}"`);

    const upload = async (path, why) => {
        await openApp();
        await page.setInputFiles('#json-file-input', path);
        await page.waitForFunction(
            () => window.__e1c.loaded.length > 0, null, { timeout: 60000 },
        ).catch((e) => { throw new Error(`STUCK waiting for ${why} to publish: ${e.message}`); });
        return page.evaluate(() => ({
            ...window.__e1c.loaded[window.__e1c.loaded.length - 1],
            notes: window.__e1c.notes.slice(),
        }));
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
    const bundled = await upload(BUNDLE, 'the .zip bundle');
    check(bundled.game_name === anchor.game_name && bundled.seed_name === anchor.seed_name
        && bundled.playerRegions === anchor.playerRegions,
        '⛓⛓ CLAIM 3 — the BUNDLE loads THE SAME DOCUMENT as the plain `.json`',
        `game_name ${bundled.game_name}, seed_name ${bundled.seed_name}, `
        + `${bundled.playerRegions} region(s) · source ${bundled.sourceName}`);
    check(/rules\.json/.test(bundled.sourceName ?? ''),
        '⛓ CLAIM 3b — the source name says which MEMBER was loaded',
        bundled.sourceName);
    const named = bundled.notes.join(' | ');
    check(['level-set', 'overlay', 'region-atlas'].every((k) => named.includes(k)),
        '⛓⛓ CLAIM 4 — the IGNORED members are NAMED, by kind and by entry name',
        named.slice(0, 300));
    /**
     * ⛓⛓⛓ EDITOR v3 E2c — **CLAIM 4b: THE FIFTH KIND REACHES THE APP'S DOOR.**
     * ⛔ MUTANT: `classifyDocument`'s `region-library` predicate added and the
     * entry left out of `BUNDLE_KINDS` — `writeBundle` throws above and this row
     * never runs; the reverse (the entry added, the predicate not) writes the
     * member and `readBundle` reports it in `notes` as unclassifiable, so the
     * KIND does not appear here and this row goes red while claim 4 stays green.
     */
    check(named.includes('region-library'),
        '⛓⛓ CLAIM 4b — the `region-library` member is NAMED too (the FIFTH bundle kind, E2c)',
        named.slice(0, 400));

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
    const cancelled = errors.filter(BENIGN_ERROR);
    const realErrors = errors.filter((e) => !BENIGN_ERROR(e));
    check(realErrors.length === 0 && real404.length === 0 && cancelled.length <= NAVIGATIONS,
        '⛓ CLAIM 7 — no page error and no unexpected 404 across all four loads '
        + `(${benign.length} benign ${BENIGN_404.join(', ')} 404(s) and ${cancelled.length} `
        + `navigation-cancelled sphere-log fetch(es) over ${NAVIGATIONS} page loads, both `
        + 'excluded BY NAME and counted)',
        [...realErrors, ...real404].join(' | ').slice(0, 400));
} catch (e) {
    check(false, 'the row ran to the end', e.message);
}

// eslint-disable-next-line no-console
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
