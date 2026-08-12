#!/usr/bin/env node
/**
 * export-seedling-view — THE EDITOR ARC'S CLI: any view of `watch.html`, as
 * a PNG, from a terminal, with no browser and no dev server of your own.
 *
 * ⚖ RULED IN BY THE USER (kickoff §1.5 / §6.5) FOR AGENT USE: an agent can
 * Read a PNG. Everything this arc built — the solve, the eight overlay
 * layers, the trace pane, `?tick=` — is reachable from a URL, so it is
 * reachable from here, and the picture is the point.
 *
 *   node scripts/procgen/export-seedling-view.mjs --out=/tmp/view.png \
 *       --tape=frontend/modules/seedlingDemo/fixtures/tapes/r8-solve-18.json
 *
 *   # any page parameter, forwarded verbatim — the CLI adds no vocabulary
 *   --layers=player,enemies,arrows   --tick=247   --side=js   --speed=1
 *   --boot=<repo-relative json> --level=4 --goals=exit:64,16 --solve=1
 *
 * ⚠ `?shot=1` HOLDS THE CURSOR WHERE IT LANDS, and with no `--tick=` that
 * is FRAME 0 — the room before anything has happened in it. Pass a tick, or
 * `--tick=last` for the end of the walk (the only value the page cannot
 * parse itself; see TICK_LAST — the CLI resolves it by loading the same
 * page twice, never by poking the page's own scrub).
 *
 *   # the CLI's own flags
 *   --out=<file.png>   where to write (required; the ONLY file it writes)
 *   --trace            include the HUD and the decision-trace pane, not
 *                      just the canvas
 *   --params="a=b&c=d" a raw query string (individual flags win over it)
 *   --host=http://…    use an EXISTING server instead of starting one
 *   --timeout=ms       how long to wait for the page (default 180000)
 *   --json             print the readout as JSON on stdout
 *   --quiet            no human lines on stdout (the PNG is the output)
 *
 * ── IT BRINGS ITS OWN SERVER ────────────────────────────────────────────
 *
 * On a FREE port (`listen(0)`), on 127.0.0.1, serving the REPO ROOT, shut
 * down by its captured handle on every path INCLUDING the refusals. It
 * never assumes :8000, never starts a second server on a port somebody
 * else holds, and never touches a process it did not start — the page needs
 * a static file server and nothing else, so bringing one is cheaper than
 * depending on one.
 *
 * ⛓ THAT IS ALSO WHY THIS IS THE ARC'S BROWSER GATE (⚖ kickoff §8.9). The
 * only browser coverage before it SKIPPED (exit 0) when no server was up,
 * and that graceful skip hid a page that could not load AT ALL for two
 * rungs (slice 1 §8.4, trap 176). A tool that starts its own server has
 * nothing to skip on.
 *
 * ── ⛔ THE REFUSAL PATH IS A PATH, NOT A HOPE (trap 184) ────────────────
 *
 * A Seedling run refuses BY NAME, and often: a lethal pit, water under an
 * unpinned `sound`, and — for SIX of the 153 committed boots — the v8 fold
 * refusing a v9 `persistence[].at` (slice 3 §10.3, a documented v1 bound).
 * When the page refuses, this CLI prints the PAGE'S OWN MESSAGE on stderr
 * and exits non-zero, and **writes no PNG at all**. A blank or partial
 * frame with exit 0 is the defect this rule exists to prevent: the caller
 * of an exporter reads the picture, not the log.
 *
 *   0  the view was drawn and written
 *   1  usage
 *   2  the PAGE REFUSED (its message on stderr; nothing written)
 *   3  the page never reached readiness within --timeout (nothing written)
 *   4  the view was written, but the page logged errors (see stderr)
 *
 * ⚖ RULED (2026-08-12): **exit 4 keeps its file.** A real frame plus a
 * non-zero exit is the honest pair when the page logged errors — the picture
 * is evidence, and the exit code is what stops a caller from reading a
 * throwing page as a clean one. Failing WITHOUT a file here would discard
 * that evidence exactly when somebody most needs to look at it. (2 and 3 are
 * different: there, what would be written is a refused or unfinished view.)
 *
 * `check-seedling-editor-export.mjs` is the acceptance row and drives all
 * of these, the refusal included.
 *
 * ⛔ ONE RENDERER. This script screenshots the PAGE. It does not know how a
 * spinner is drawn, which layers exist, or what a tick is — those are URL
 * parameters. Two renderers of one run is the two-cost-models trap with
 * pixels (kickoff §3.5).
 */

/**
 * ⚠ FROM `@playwright/test`, NOT FROM `playwright` — `package.json` PINS the
 * former and FLOATS the latter, and only the pinned one's browser build is
 * in `~/.cache/ms-playwright` after a plain `npm ci`. Slice 1's own note.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    EXIT, buildViewUrl, classify, isExpectedSidecar404, parseArgs, readPngHeader, wantsLastTick,
} from './exportSeedlingView.js';

const REPO_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

const MIME = {
    '.html': 'text/html; charset=utf-8',
    // ⛔ ES MODULES NEED A JAVASCRIPT MIME TYPE — a browser refuses to
    // execute a module served as octet-stream, and the page is all modules.
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.jsonl': 'application/x-ndjson',
};

/** A read-only static file server over the repo root, on a free port. */
function serveRepoRoot() {
    const server = createServer((req, res) => {
        let rel;
        try {
            rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        } catch {
            res.writeHead(400).end('bad path');
            return;
        }
        const file = join(REPO_ROOT, rel);
        // ⛔ Never above the root, whatever the caller asks for.
        if (!file.startsWith(REPO_ROOT) || !existsSync(file)) {
            res.writeHead(404).end('not found');
            return;
        }
        /**
         * ⛓ DIRECTORY LISTINGS, BECAUSE THE PAGE READS THEM.
         *
         * `loadTapeIndex` builds the tape picker AND the boot presets from
         * the dev server's own listing (`href="…json"`), deliberately — a
         * committed manifest would go stale between a recording and the
         * regeneration that noticed. A server without one is a working page
         * with NO PICKER, which is a different page than the one a person
         * sees at :8000, and this tool exports what the page shows.
         *
         * Same shape as `python3 -m http.server`'s listing, which is the
         * documented dev server and therefore the thing to be equivalent to.
         */
        if (statSync(file).isDirectory()) {
            const names = readdirSync(file).sort();
            const links = names
                .map((n) => `<li><a href="${encodeURIComponent(n)}">${n}</a></li>`).join('\n');
            res.writeHead(200, { 'Content-Type': MIME['.html'] })
                .end(`<!DOCTYPE html><title>${rel}</title><ul>\n${links}\n</ul>`);
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
            .end(readFileSync(file));
    });
    return new Promise((ok, no) => {
        server.once('error', no);
        server.listen(0, '127.0.0.1', () => ok(server));
    });
}

// ── the caller's arguments ───────────────────────────────────────────────

const { opts, page: pageParams, unknown, bad } = parseArgs(process.argv.slice(2));

if (opts.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8')
        .split('\n').slice(1).filter((l) => l.startsWith(' *')).map((l) => l.slice(2).trimEnd())
        .join('\n'));
    process.exit(EXIT.ok);
}
if (bad.length) {
    for (const b of bad) console.error(`usage: ${b}`);
    console.error('       node scripts/procgen/export-seedling-view.mjs --help');
    process.exit(EXIT.usage);
}
for (const u of unknown) {
    // ⚠ NAMED, NOT DROPPED, AND NOT FATAL: the page reports an unknown
    // parameter itself (`?layers=` does, by name), and a CLI that refused
    // one would go stale the moment the page grew a parameter.
    console.error(`⚠ "${u}" is not one of watch.html's known parameters — forwarding it anyway`);
}

// ── the server, the browser, the page ────────────────────────────────────

let server = null;
let browser = null;
/** ⛔ EVERY EXIT PATH GOES THROUGH HERE, the refusals included. */
async function shutdown() {
    if (browser) await browser.close().catch(() => {});
    if (server) {
        server.closeAllConnections?.();
        await new Promise((r) => server.close(r));
    }
}
function done(code, why) {
    if (why) console.error(why);
    return shutdown().then(() => process.exit(code));
}

if (!opts.host) server = await serveRepoRoot();
const origin = opts.host || `http://127.0.0.1:${server.address().port}`;

browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
let errors = [];
// ⚠ WITH THE RESOURCE URL — a bare "Failed to load resource: 404" names
// nothing, so a rule that allowed one expected 404 could only allow them all.
page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

/**
 * Load one view and read the page's own verdict on it.
 *
 * ⛓ THE WAIT IS A RACE, AND WHY IT IS A RACE.
 *
 * `body[data-shot-ready="1"]` is the readiness contract (kickoff §10.6) and
 * is the ONLY thing a successful export waits for. But a refused page never
 * raises it — `fatal()` writes the message into `#status.bad` and stops —
 * so waiting on readiness alone would turn every named refusal into a
 * `--timeout` wait and a message about the wrong thing.
 *
 * ⚠ AND THE VERDICT IS READ FROM THE FINAL STATE, NOT FROM WHO WON. A run
 * that throws MID-WAY does both: it reports the throw and then draws the
 * frames it got. So the loser is given a grace window and the page is asked
 * once, at the end, what it thinks — which is how a partial frame is caught
 * being plausible.
 */
async function load(url) {
    errors = [];
    if (!opts.quiet) console.log(`page: ${url}`);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (e) {
        await done(EXIT.timeout, `the page would not load: ${e.message}`);
    }
    const ready = page.waitForSelector('body[data-shot-ready="1"]', { timeout: opts.timeout })
        .then(() => 'ready', () => null);
    const refused = page.waitForSelector('#status.bad', { timeout: opts.timeout })
        .then(() => 'refused', () => null);
    const first = await Promise.race([ready, refused]);
    if (first === 'refused') {
        // The partial-frame case: the throw is reported, then what was
        // collected is drawn. A short grace so the final read sees both facts.
        await page.waitForSelector('body[data-shot-ready="1"]', { timeout: 10000 }).catch(() => {});
    }
    // `first === null` means both waits hit `--timeout`; the read below
    // reports that as the timeout it is, with the page's last status attached.
    const state = await page.evaluate(() => ({
        ready: document.body.dataset.shotReady === '1',
        refused: document.getElementById('status').className === 'bad',
        status: document.getElementById('status').textContent,
        detail: document.getElementById('detail').textContent,
        shot: window.__editorShot ?? null,
        layers: (window.__editorOverlays?.layers ?? []).filter((l) => l.on).map((l) => l.id),
        markers: window.__editorOverlays?.markers?.length ?? null,
        traceRows: window.__editorOverlays?.trace?.rows ?? null,
    }));
    const unexpected = errors.filter((e) => !isExpectedSidecar404(e));
    return {
        state,
        unexpected,
        verdict: classify({
            ready: state.ready,
            refused: state.refused,
            message: [state.status, state.detail].filter(Boolean).join(' — '),
            pageErrors: unexpected,
        }),
    };
}

const first = buildViewUrl(origin, pageParams);
if (first.forcedShot !== null) {
    console.error(`⚠ ?shot=${first.forcedShot} ignored — the readiness contract needs shot=1, `
        + 'and a screenshot of an animating page is a screenshot of whenever it opened');
}
let { state, unexpected, verdict } = await load(first.url);
let url = first.url;

/**
 * ⛓ `--tick=last`, RESOLVED THE ONLY WAY THAT KEEPS ONE CONTRACT: the first
 * load told us how many frames this run collected, so the second asks for
 * the last of them by number. A refusal on the first load is reported as
 * itself, below — there is nothing to resolve against.
 */
if (wantsLastTick(pageParams) && verdict.write) {
    const last = Math.max(0, (state.shot?.frames ?? 1) - 1);
    if (!opts.quiet) console.log(`--tick=last → tick ${last} of ${state.shot?.frames} frame(s)`);
    ({ url } = buildViewUrl(origin, pageParams, { tick: last }));
    ({ state, unexpected, verdict } = await load(url));
}

if (!verdict.write) {
    await done(verdict.code, `${verdict.why}\n(nothing written to ${opts.out})`);
}

// ── the picture ──────────────────────────────────────────────────────────

/**
 * `--trace` widens the frame to `main`, which is the canvas, the layer
 * toggles, the legend and the trace pane — i.e. what a person looking at
 * the page sees. Without it the shot is the CANVAS ALONE, because the
 * common ask is "show me the room" and a screenshot cropped to the thing
 * asked about is the one worth Reading.
 */
mkdirSync(dirname(resolve(opts.out)), { recursive: true });
await page.locator(opts.trace ? 'main' : '#canvas').screenshot({ path: opts.out });
const png = readPngHeader(readFileSync(opts.out));

const readout = {
    url,
    out: opts.out,
    png: { width: png.width, height: png.height, isPng: png.isPng },
    tick: state.shot?.tick ?? null,
    frames: state.shot?.frames ?? null,
    label: state.shot?.label ?? null,
    why: state.shot?.why ?? null,
    layers: state.layers,
    markers: state.markers,
    traceRows: state.traceRows,
    status: state.status,
    pageErrors: unexpected,
    exit: verdict.code,
};
if (opts.json) console.log(JSON.stringify(readout, null, 2));
else if (!opts.quiet) {
    console.log(`wrote ${opts.out} — ${png.width}x${png.height}, tick ${readout.tick} of `
        + `${readout.frames} frame(s), layers [${readout.layers.join(', ')}]`
        + (readout.markers === null ? '' : `, ${readout.markers} marker(s)`)
        + (readout.traceRows ? `, ${readout.traceRows} trace row(s)` : ''));
    if (readout.why) console.log(`⚠ ${readout.why}`);
}
// ⚠ THE QUIET WAY TO EXPORT NOTHING: frame 0 of a long run is a room in
// which nothing has happened yet, and it looks like a perfectly good
// picture. Said out loud rather than defaulted away — the cursor is the
// page's decision, not this tool's.
if (!pageParams.has('tick') && readout.tick === 0 && (readout.frames ?? 0) > 1) {
    console.error(`⚠ exported frame 0 of ${readout.frames} — nothing has happened yet in this `
        + 'view. Pass --tick=N, or --tick=last for the end of the walk.');
}
await done(verdict.code, verdict.why ? `⚠ ${verdict.why}` : '');
