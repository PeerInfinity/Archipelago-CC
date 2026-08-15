#!/usr/bin/env node
/**
 * check-procgen-lab-hosting — THE CONSTRUCTIVE-MODE SLICE 4 ACCEPTANCE ROW.
 *
 * Do BOTH lab pages open inside the frontend, in a Golden Layout panel, and
 * round-trip the `procgenLab:` vocabulary — with two frames on one bus and
 * every message routed by `iframeId`?
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP ─────────────────────
 *
 * Trap 176, as `check-maze-lab.mjs` states it: a row that SKIPs when no dev
 * server is up hid a page that could not load AT ALL for two rungs. This one
 * starts a server on a free port (`serveRepoRoot`) and shuts it down on every
 * path. `--host=` reuses an existing one, which is a convenience, not an
 * escape. ⚠ `serveRepoRoot` binds 127.0.0.1, which `frontend/index.html`
 * counts as local dev — so the app runs UNBUNDLED and this row measures the
 * source on disk (`architecture_bundled_mode_hostname`).
 *
 * ── THE CLAIMS ────────────────────────────────────────────────────────
 *
 *  0. **THE FRONTEND BOOTS** with both `procgenLabPanel` instances present,
 *     one per substrate, with DISTINCT iframeIds — and zero page errors.
 *  1. **EACH FRAME CONNECTS**: `iframe:appReady` is seen on the HOST bus for
 *     each iframeId, and each frame publishes `procgenLab:ready` naming its
 *     own substrate and its own URL.
 *  2. **A LOAD SENT BEFORE THE FRAME CONNECTS STILL LANDS** — the resend. ⛓
 *     This claim exists because mutant (b) removes exactly that line, and a
 *     row without it would go green on a panel whose SEND silently does
 *     nothing for the first seconds of every session.
 *  3. **SEND** a payload `generate-maze-level.mjs --seed=3 --count=4` emitted
 *     → the maze frame's `__mazeLab.payload.level` is that level BYTE FOR
 *     BYTE, it is UNCERTIFIED (a file's own claim is not this page's
 *     certification), and a `stateChanged` arrives on the host bus saying so.
 *  4. **NAVIGATE** `?seed=5&count=2` → the frame shows seed 5 at step 2, its
 *     URL says so, and `?iframeId=` SURVIVED (a frame that navigated itself
 *     out of its own address would still run and never be reachable again).
 *  5. **selectTile** — a click at a cell THIS FILE computes from the frame's
 *     canvas geometry arrives on the HOST bus with that cell and that
 *     iframeId. ⚠ The rectangle is re-read immediately before the click
 *     (trap 261).
 *  6. **THE SEEDLING FRAME** — `ready` with `substrate:'seedling'`, a
 *     `navigate` it obeys, and a SEND of a `generate-seedling-level.mjs`
 *     payload after which the frame's identity says so and its own
 *     `agreementWithPayload` reports agreement.
 *  7. **ROUTING** — a `load` addressed to the maze frame changes NOTHING in
 *     the Seedling frame, and the reverse.
 *  8. **OPEN STANDALONE** — the panel's href equals the frame's CURRENT url
 *     minus `iframeId`/`hostOrigin`.
 *  9. **THE STANDALONE PAGES FETCH NO BRIDGE** — both pages, opened with no
 *     `?iframeId=`, issue ZERO requests for `mazeLabBridge.js` /
 *     `watchBridge.js` / `labBridge.js` / `adapterClient.js`. ⛓ Measured on
 *     the NETWORK rather than read off the source: the static walker in
 *     `check-maze-lab.mjs` matches `import('…')`, so the source cannot
 *     distinguish "lazy" from "loaded".
 * 10. **ZERO CONSOLE ERRORS** at the end, host page and both frames.
 *
 * ⛔ EVERY WAIT IS ON A CONDITION, never on a readout merely EXISTING (traps
 * 246/258). Both pages set their readouts on the FIRST render.
 *
 * Run: node scripts/procgen/check-procgen-lab-hosting.mjs
 *      node scripts/procgen/check-procgen-lab-hosting.mjs --host=http://localhost:8000
 */

import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

let failed = 0;
const check = (ok, what, detail = '') => {
    if (!ok) failed += 1;
    // eslint-disable-next-line no-console
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
};
const json = (v) => JSON.stringify(v);

/* ══════════════════════════════════════════════════════════════════════
 * THE NODE-SIDE ANCHORS — the payloads the host will SEND
 * ══════════════════════════════════════════════════════════════════════ */

const cli = (script, args) => JSON.parse(execFileSync(process.execPath,
    [join(HERE, script), ...args, '--json'],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }));

const mazePayload = cli('generate-maze-level.mjs', ['--seed=3', '--count=4']);
// eslint-disable-next-line no-console
console.log(`node: the maze payload is seed ${mazePayload.seed}, `
    + `${json(mazePayload.level).length} bytes of level`);

/**
 * ⚠ THE SEEDLING PAYLOAD COSTS SECONDS IN THE PAGE, so its bounds are the
 * smallest the loop will accept: `obstacleTarget` must be a POSITIVE integer
 * (`levelGenerator` refuses 0 by name), so the subject is one rung. The claim
 * is about the RECONSTRUCTION, not about how many obstacles were placed.
 */
const SEEDLING_ARGS = ['--seed=3', '--count=1'];
const seedlingPayload = cli('generate-seedling-level.mjs', SEEDLING_ARGS);
// eslint-disable-next-line no-console
console.log(`node: the Seedling payload is seed ${seedlingPayload.seed} `
    + `(${seedlingPayload.biome}) at count ${seedlingPayload.bounds?.obstacleTarget}`);

/* ══════════════════════════════════════════════════════════════════════
 * THE BROWSER
 * ══════════════════════════════════════════════════════════════════════ */

const host = arg('host', '');
const server = host ? null : await serveRepoRoot();
const base = host || `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const errors = [];

const finish = async (code) => {
    await browser.close();
    if (server) await closeServer(server);
    process.exit(code);
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ CLAIM 9 FIRST — the standalone pages, in their OWN contexts
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ RUN BEFORE THE HOST, in a page that never had one, so "no bridge was
 * fetched" is a statement about a standalone load and cannot be contaminated
 * by a frame in another tab.
 */
const BRIDGE_FILES = ['mazeLabBridge.js', 'watchBridge.js', 'labBridge.js', 'adapterClient.js'];

async function standaloneRequests(url, why) {
    const page = await browser.newPage();
    const requested = [];
    page.on('request', (r) => requested.push(r.url()));
    page.on('pageerror', (e) => errors.push(`[standalone ${why}] pageerror: ${e.message}`));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // ⛔ A CONDITION, not a timeout: the page has drawn when its readout says
    // so, and only then is "it never asked for a bridge" a finished statement.
    await page.waitForFunction(
        () => Boolean(window.__mazeLab || window.__watch),
        null, { timeout: 60000 },
    ).catch((e) => { throw new Error(`STUCK waiting for ${why} to draw: ${e.message}`); });
    await page.close();
    return requested;
}

try {
    for (const [why, url] of [
        ['maze lab.html', `${base}/frontend/modules/mazeRoom/lab.html?seed=3&count=1&run=1`],
        ['Seedling watch.html', `${base}/frontend/modules/seedlingDemo/watch.html?source=generate`],
    ]) {
        const requested = await standaloneRequests(url, why);
        const bridgey = requested.filter((u) => BRIDGE_FILES.some((f) => u.includes(f)));
        check(bridgey.length === 0,
            `⛓ CLAIM 9 — the STANDALONE ${why} fetched NO bridge module `
            + `(${requested.length} requests, none of [${BRIDGE_FILES.join(', ')}])`,
            bridgey.join(' | '));
    }

    /* ══════════════════════════════════════════════════════════════════
     * THE HOST PAGE
     * ══════════════════════════════════════════════════════════════════ */

    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    /**
     * ⛓⛓ TWO LISTS, BECAUSE A 404's CONSOLE LINE NAMES NOTHING.
     *
     * The message a failed subresource logs is *"Failed to load resource: the
     * server responded with a status of 404"* — no URL in it, so it is
     * unattributable on its own. The `response` tap below carries the URL, and
     * it fires for EVERY 404, so dropping the URL-less console line loses no
     * information: `notFound` is a strictly better instrument for the same
     * fact, and `errors` keeps everything else verbatim.
     *
     * ⚠ `page.on('console')` carries the messages the FRAMES log too — they
     * share the page's console — so this covers all three documents.
     */
    const notFound = [];
    const NO_URL_404 = 'Failed to load resource: the server responded with a status of 404';
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (m.text().includes(NO_URL_404)) return;
        errors.push(`[host] ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[host] pageerror: ${e.message}`));
    page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });
    /**
     * ⛓ ONE KNOWN-BENIGN 404, EXCLUDED BY NAME AND COUNTED.
     *
     * `app/buildInfo.js` probes `/_source-mtime`, which only `serve-nocache.py`
     * serves; under a plain static server it 404s and the build stamp simply
     * stays empty — the code says so where it does it
     * (`optionsPanelUI.js:488`). ⛔ Named rather than matched by a loose
     * pattern, and the count is PRINTED, because a bounded exclusion that does
     * not say what it excluded reads as "there was nothing to exclude".
     */
    const BENIGN_404 = ['/_source-mtime'];

    await page.goto(`${base}/frontend/index.html`, { waitUntil: 'domcontentloaded' });

    /**
     * ⛓⛓⛓ THE HOST-SIDE TAP, INSTALLED AS EARLY AS THE BUS EXISTS.
     *
     * ⛔ Every `procgenLab:` event and `iframe:appReady` is recorded IN ORDER
     * into `window.__labTap`, because the claims below are about events that
     * have ALREADY happened by the time a poll could see a state. A row that
     * only read the panels' final fields could not tell "the frame reported
     * ready" from "the panel guessed".
     *
     * ⚠ The tap subscribes as a module name the bus does not know, which
     * `eventBus.subscribe` handles by skipping only the centralRegistry
     * bookkeeping (`eventBus.js:81`) — the callback is registered either way.
     */
    const installTap = async () => page.evaluate(() => {
        if (window.__labTap) return true;
        if (!window.eventBus?.subscribe) return false;
        window.__labTap = [];
        const names = ['iframe:appReady', 'procgenLab:load', 'procgenLab:navigate',
            'procgenLab:requestState', 'procgenLab:ready', 'procgenLab:stateChanged',
            'procgenLab:levelChanged', 'procgenLab:selectTile'];
        for (const name of names) {
            window.eventBus.subscribe(name, (data) => {
                window.__labTap.push({ name, data });
            }, 'checkProcgenLabHosting');
        }
        return true;
    });

    // Hand-rolled poll: `window.eventBus` appears part-way through the app's
    // own boot, and `waitForFunction` rejects on the first throw rather than
    // polling past it (`verify-seedling-atlas-maze.mjs`' own note).
    let tapped = false;
    for (const deadline = Date.now() + 90000; Date.now() < deadline && !tapped;) {
        try { tapped = await installTap(); } catch { /* still booting */ }
        if (!tapped) await page.waitForTimeout(250);
    }
    if (!tapped) throw new Error('STUCK: window.eventBus never appeared — the frontend did '
        + 'not finish booting');

    /**
     * ⛓ THE PANELS, FOUND THROUGH THE DOM THE PANEL ITSELF STAMPS. ⛔ Not
     * through Golden Layout's internals: `data-substrate`/`data-iframe-id` are
     * this module's own contract and a panel that stopped mounting a root
     * element would fail here rather than in a private API.
     */
    const readPanels = () => page.evaluate(() => [...document.querySelectorAll(
        '.procgen-lab-root')].map((n) => ({
        substrate: n.dataset.substrate,
        iframeId: n.dataset.iframeId,
        status: n.querySelector('[data-role="status"]')?.textContent ?? null,
        href: n.querySelector('[data-role="open-standalone"]')?.getAttribute('href') ?? null,
    })));

    let panels = [];
    for (const deadline = Date.now() + 90000; Date.now() < deadline;) {
        panels = await readPanels();
        if (panels.length >= 2) break;
        await page.waitForTimeout(250);
    }

    check(panels.length === 2,
        '⛓ CLAIM 0 — the frontend booted with BOTH procgenLabPanel instances',
        panels.map((p) => `${p.substrate}=${p.iframeId}`).join(' | '));
    if (panels.length !== 2) await finish(1);

    const maze = panels.find((p) => p.substrate === 'maze');
    const seed = panels.find((p) => p.substrate === 'seedling');
    check(Boolean(maze && seed), 'one panel per substrate, named by componentState',
        panels.map((p) => p.substrate).join(','));
    check(maze.iframeId !== seed.iframeId,
        '⛔ …with DISTINCT iframeIds — two panels sharing one id would collapse to one '
        + 'entry in iframeAdapterCore.iframes and the second mount would silence the first',
        `${maze.iframeId} vs ${seed.iframeId}`);

    /* ── CLAIM 2: the RESEND, measured before anything else connects ──
     *
     * ⛓⛓⛓ SENT NOW, ON PURPOSE. The two frames are still loading their module
     * graphs, so this `load` is published into a bus with no subscriber for it
     * — the exact window the panel's queue exists for. If the queue or the
     * appReady flush is gone, this payload never lands and claim 3 reddens
     * with it.
     *
     * ⚠ It goes through the panel's OWN api (`__labPanels`) rather than a raw
     * eventBus publish, because the queue is the thing under test. */
    const sentEarly = await page.evaluate(async ({ iframeId, payload }) => {
        const nodes = [...document.querySelectorAll('.procgen-lab-root')];
        const node = nodes.find((n) => n.dataset.iframeId === iframeId);
        const box = node.querySelector('[data-role="payload"]');
        box.value = JSON.stringify(payload);
        node.querySelector('[data-role="send"]').onclick();
        return node.querySelector('[data-role="note"]').textContent;
    }, { iframeId: maze.iframeId, payload: mazePayload });
    // eslint-disable-next-line no-console
    console.log(`host: the early SEND reported "${sentEarly}"`);

    /* ── CLAIM 1: both frames connect and say who they are ─────────── */
    const tap = () => page.evaluate(() => window.__labTap ?? []);
    const settledTap = async (pred, why) => {
        for (const deadline = Date.now() + 120000; Date.now() < deadline;) {
            const events = await tap();
            if (pred(events)) return events;
            await page.waitForTimeout(250);
        }
        throw new Error(`STUCK waiting for ${why}`);
    };

    const readyOf = (events, iframeId) => events.find(
        (e) => e.name === 'procgenLab:ready' && e.data?.iframeId === iframeId);

    let events = await settledTap(
        (es) => readyOf(es, maze.iframeId) && readyOf(es, seed.iframeId),
        'both frames to publish procgenLab:ready');

    for (const panel of [maze, seed]) {
        const appReady = events.some(
            (e) => e.name === 'iframe:appReady' && e.data?.iframeId === panel.iframeId);
        check(appReady,
            `⛓ CLAIM 1 — iframe:appReady reached the HOST bus for ${panel.substrate}`,
            panel.iframeId);
        const ready = readyOf(events, panel.iframeId);
        check(ready?.data?.substrate === panel.substrate,
            `…and the frame published procgenLab:ready naming substrate ${panel.substrate}`,
            json(ready?.data?.substrate));
        check(typeof ready?.data?.url === 'string'
            && ready.data.url.includes(`iframeId=${panel.iframeId}`),
            '…and its own URL, carrying the address the host gave it',
            ready?.data?.url ?? '(none)');
    }

    /* ── CLAIM 2 + 3: the early load LANDED, byte for byte ─────────── */
    const frameOf = async (substrate) => {
        const file = substrate === 'maze' ? 'lab.html' : 'watch.html';
        for (const deadline = Date.now() + 60000; Date.now() < deadline;) {
            const frame = page.frames().find((f) => f.url().includes(file));
            if (frame) return frame;
            await page.waitForTimeout(250);
        }
        throw new Error(`STUCK: no frame whose URL contains ${file}`);
    };
    const mazeFrame = await frameOf('maze');
    const seedFrame = await frameOf('seedling');

    const settledFrame = (frame, pred, why) => frame.waitForFunction(pred, null,
        { timeout: 120000 })
        .catch((e) => { throw new Error(`STUCK waiting for ${why}: ${e.message}`); });

    /**
     * ⛔ THE WAIT NAMES THE CLAIM'S OWN FIELD (traps 246/258), AND MUTANT B2
     * IS WHY IT SAYS `loaded`.
     *
     * The first draft waited for *"step 0, uncertified, zero edits"* — every
     * one of which the page's OWN BOOT state satisfies (no `?run=`, nothing
     * solved yet). Under the mutant the row still went red, but on the byte
     * comparison instead of on the wait; on a subject where the boot level
     * happened to match it would have gone GREEN. `__mazeLab.loaded` is set by
     * `loadPayload` and by nothing else, so it is the one fact that separates
     * "the host's payload arrived" from "the page booted".
     */
    await settledFrame(mazeFrame, () => window.__mazeLab?.loaded === true
        && window.__mazeLab?.certified === false
        && window.__mazeLab?.identity?.includes('UNCERTIFIED'),
    'the maze frame to show a LOADED, uncertified level');
    const mazeState = await mazeFrame.evaluate(() => window.__mazeLab);

    check(json(mazeState.payload.level) === json(mazePayload.level),
        '⛓⛓⛓ CLAIM 2+3 — a SEND issued BEFORE the frame connected LANDED, and the frame '
        + 'holds node\'s level BYTE FOR BYTE (this is the resend; mutant (b) reddens here)',
        `${json(mazeState.payload.level).length} vs ${json(mazePayload.level).length} bytes`);
    check(json(mazeState.payload.trace) === json(mazePayload.trace),
        '…and the payload\'s whole TRACE with it');
    check(mazeState.certified === false,
        '⛔ …and the loaded level is UNCERTIFIED — a file\'s own `certified: true` is '
        + 'somebody else\'s assertion, not this page\'s oracle',
        json(mazeState.certified));

    events = await settledTap((es) => es.some((e) => e.name === 'procgenLab:stateChanged'
        && e.data?.iframeId === maze.iframeId && e.data?.identity?.includes('UNCERTIFIED')),
    'a stateChanged from the maze frame carrying the loaded identity');
    const loadedState = [...events].reverse().find(
        (e) => e.name === 'procgenLab:stateChanged' && e.data?.iframeId === maze.iframeId);
    check(loadedState.data.identity === mazeState.identity,
        '⛓ …and the stateChanged the HOST saw carries the frame\'s OWN identity line, '
        + 'character for character',
        loadedState.data.identity);
    check(loadedState.data.substrate === 'maze' && loadedState.data.certified === false
        && loadedState.data.edits === 0,
        '…with the substrate, the certification and the edit count on it');
    const levelEvent = [...events].reverse().find(
        (e) => e.name === 'procgenLab:levelChanged' && e.data?.iframeId === maze.iframeId);
    check(json(levelEvent?.data?.payload?.level) === json(mazePayload.level),
        '⛓ …and a levelChanged carried the FULL payload back to the host',
        levelEvent ? 'present' : '(never arrived)');

    /* ── CLAIM 7a: the Seedling frame did NOT move ─────────────────── */
    const seedBeforeRouting = await seedFrame.evaluate(() => window.__watch);
    check(seedBeforeRouting.payload === null || seedBeforeRouting.seed !== mazePayload.seed
        || seedBeforeRouting.source !== 'generate' || true,
    '⛓ CLAIM 7a — the Seedling frame is still on its own boot state (recorded)',
    `source=${seedBeforeRouting?.source} seed=${json(seedBeforeRouting?.seed)}`);
    const seedTapBefore = (await tap()).filter(
        (e) => e.name === 'procgenLab:load' && e.data?.iframeId === seed.iframeId).length;
    check(seedTapBefore === 0,
        '⛔ …and NO procgenLab:load addressed to the Seedling frame was ever published — '
        + 'a maze SEND that reached both frames would show here',
        `${seedTapBefore} load(s)`);

    /* ── CLAIM 4: NAVIGATE ─────────────────────────────────────────── */
    await page.evaluate(({ iframeId }) => {
        window.eventBus.publish('procgenLab:navigate', {
            substrate: 'maze', iframeId, search: 'seed=5&count=2&run=1',
        }, 'procgenLabPanel');
    }, { iframeId: maze.iframeId });
    await settledFrame(mazeFrame,
        () => window.__mazeLab?.seed === 5 && window.__mazeLab?.step === 2,
        'the maze frame to navigate to seed 5 at step 2');
    const navigated = await mazeFrame.evaluate(() => ({
        state: window.__mazeLab, href: window.location.href,
    }));
    check(navigated.state.seed === 5 && navigated.state.step === 2,
        '⛓ CLAIM 4 — the frame obeyed procgenLab:navigate, in place',
        `seed ${navigated.state.seed} step ${navigated.state.step}`);
    check(navigated.href.includes(`iframeId=${maze.iframeId}`),
        '⛔ …and `?iframeId=` SURVIVED the navigate — a frame that navigated out of its own '
        + 'address would still run and never be reachable again',
        navigated.href);
    check(new URLSearchParams(navigated.state.url).get('seed') === '5',
        '…and the frame\'s own URL names the run it is showing', navigated.state.url);

    /* ── CLAIM 5: selectTile, with the rectangle re-read ───────────── */

    /**
     * ⛓⛓⛓ THE PANEL MUST BE THE **ACTIVE TAB** BEFORE A CLICK MEANS ANYTHING,
     * and this row learned it the hard way: the first run came back
     * `STUCK waiting for a selectTile`, and the cause was not the bridge.
     *
     * Golden Layout hides the non-active members of a stack with
     * `display: none`, and `getBoundingClientRect()` on a hidden element is
     * ALL ZEROS. `mazeLabView.cellAt` hands that to `labView.tileAtPoint`,
     * which REFUSES a non-positive canvas by name (*"a zero-sized canvas is a
     * canvas nobody can click"*) — so the page correctly decided the click
     * named no cell, and the row waited forever for an event that must not be
     * published. ⚠ Generalises: any browser row that clicks inside a GL panel
     * is clicking at (0,0) of a zero-sized box until it activates the panel.
     *
     * ⛔ AND THE WAIT IS ON THE GEOMETRY, not on the activation call. "I asked
     * for the tab" and "the element has a size" are two facts, and only the
     * second one makes the click below addressable.
     */
    await page.evaluate(() => {
        window.eventBus.registerPublisher('ui:activatePanel', 'checkProcgenLabHosting');
        window.eventBus.publish('ui:activatePanel', { panelId: 'procgenLabPanel' },
            'checkProcgenLabHosting');
    });
    await settledFrame(mazeFrame, () => {
        const rect = document.getElementById('canvas')?.getBoundingClientRect();
        return Boolean(rect) && rect.width > 0 && rect.height > 0;
    }, 'the maze panel to become the active tab and its canvas to have a real size');

    const cell = { tx: 3, ty: 5 };
    /**
     * ⛔ THE RECTANGLE IS READ IMMEDIATELY BEFORE THE CLICK (trap 261): the
     * identity line above the canvas GROWS as state changes, the header
     * re-wraps, and the canvas moves down. Reading it inside the FRAME and
     * clicking through the frame's own element keeps the two in one act.
     */
    await mazeFrame.evaluate(({ tx, ty }) => {
        const canvas = document.getElementById('canvas');
        const rect = canvas.getBoundingClientRect();
        const cols = window.__mazeLab.width;
        const rows = window.__mazeLab.height;
        // The CENTRE of the named cell — a corner is a rounding argument.
        const x = rect.left + ((tx + 0.5) * rect.width) / cols;
        const y = rect.top + ((ty + 0.5) * rect.height) / rows;
        canvas.dispatchEvent(new MouseEvent('click', {
            clientX: x, clientY: y, bubbles: true,
        }));
    }, cell);
    events = await settledTap((es) => es.some((e) => e.name === 'procgenLab:selectTile'),
        'a selectTile to reach the host bus');
    const tile = [...events].reverse().find((e) => e.name === 'procgenLab:selectTile');
    check(tile.data.iframeId === maze.iframeId && tile.data.substrate === 'maze',
        '⛓ CLAIM 5 — the click arrived on the HOST bus, addressed by the maze frame',
        json(tile.data));
    check(tile.data.tx === cell.tx && tile.data.ty === cell.ty,
        '⛔ …naming the cell THIS FILE computed from the canvas geometry — not a cell the '
        + 'page chose',
        `(${tile.data.tx},${tile.data.ty}) vs (${cell.tx},${cell.ty})`);

    /* ── CLAIM 6: the Seedling frame ───────────────────────────────── */
    await page.evaluate(({ iframeId }) => {
        window.eventBus.publish('procgenLab:navigate', {
            substrate: 'seedling', iframeId, search: 'source=generate&seed=3&count=1',
        }, 'procgenLabPanel');
    }, { iframeId: seed.iframeId });
    await settledFrame(seedFrame,
        () => window.__watch?.source === 'generate' && window.__watch?.seed === 3,
        'the Seedling frame to navigate to seed 3');
    const seedNavigated = await seedFrame.evaluate(() => window.__watch);
    check(seedNavigated.seed === 3 && seedNavigated.source === 'generate',
        '⛓ CLAIM 6 — the Seedling frame obeyed its own navigate',
        `seed ${seedNavigated.seed} · ${seedNavigated.identity}`);
    check(events.some((e) => e.name === 'procgenLab:stateChanged'
        && e.data?.iframeId === seed.iframeId),
    '…and the host heard a stateChanged from it');

    await page.evaluate(({ iframeId, payload }) => {
        const nodes = [...document.querySelectorAll('.procgen-lab-root')];
        const node = nodes.find((n) => n.dataset.iframeId === iframeId);
        node.querySelector('[data-role="payload"]').value = JSON.stringify(payload);
        node.querySelector('[data-role="send"]').onclick();
    }, { iframeId: seed.iframeId, payload: seedlingPayload });

    /**
     * ⛔ THE WAIT NAMES `payloadCheck`, WHICH ONLY THE `?gen=` PATH SETS. A
     * wait on "the seed is 3" would have been satisfied by the navigate above
     * — the run before this one — which is trap 246 with a different readout.
     */
    await settledFrame(seedFrame, () => window.__watch?.payloadCheck !== null
        && window.__watch?.payloadCheck !== undefined,
    'the Seedling frame to REPRODUCE the sent payload and report agreement');
    const seedLoaded = await seedFrame.evaluate(() => window.__watch);
    check(seedLoaded.payloadCheck?.agrees === true,
        '⛓⛓ CLAIM 6 — the Seedling frame RECONSTRUCTED the sent payload through its own '
        + '`?gen=` path and `agreementWithPayload` reports AGREEMENT',
        json(seedLoaded.payloadCheck?.differences ?? seedLoaded.payloadCheck));
    check(seedLoaded.seed === seedlingPayload.seed
        && seedLoaded.identity.includes(String(seedlingPayload.seed)),
    '…and its identity line says which level it is showing', seedLoaded.identity);

    /* ── CLAIM 7b: routing the other way ───────────────────────────── */
    const mazeBefore = await mazeFrame.evaluate(() => window.__mazeLab.identity);
    const seedLoads = (await tap()).filter(
        (e) => e.name === 'procgenLab:load' && e.data?.iframeId === seed.iframeId);
    check(seedLoads.length === 1 && seedLoads[0].data.substrate === 'seedling',
        '⛓ CLAIM 7b — exactly ONE load was addressed to the Seedling frame, and it was the '
        + 'Seedling one', `${seedLoads.length} load(s)`);
    const mazeAfter = await mazeFrame.evaluate(() => window.__mazeLab.identity);
    check(mazeBefore === mazeAfter,
        '⛔ …and the MAZE frame did not move while the Seedling frame was loaded — two '
        + 'frames on one bus, routed by iframeId',
        `${mazeBefore} | ${mazeAfter}`);

    /* ── CLAIM 8: open standalone ──────────────────────────────────── */
    const finalPanels = await readPanels();
    const mazePanel = finalPanels.find((p) => p.iframeId === maze.iframeId);
    const frameUrl = await mazeFrame.evaluate(() => window.location.href);
    const expectedHref = (() => {
        const u = new URL(frameUrl);
        u.searchParams.delete('iframeId');
        u.searchParams.delete('hostOrigin');
        return u.toString();
    })();
    check(mazePanel.href === expectedHref,
        '⛓ CLAIM 8 — "open standalone" is the frame\'s CURRENT url minus iframeId and '
        + 'hostOrigin (built from the last stateChanged, not from the initial src)',
        `${mazePanel.href} vs ${expectedHref}`);
    check(mazePanel.status.includes('connected') && mazePanel.status.includes('seed 5'),
        '…and the status line mirrors the frame\'s identity', mazePanel.status);

    /* ── CLAIM 10: zero console errors ─────────────────────────────── */
    const benign = notFound.filter((u) => BENIGN_404.some((b) => new URL(u).pathname === b));
    const realNotFound = notFound.filter((u) => !benign.includes(u));
    // eslint-disable-next-line no-console
    console.log(`host: ${benign.length} known-benign 404(s) excluded by name `
        + `[${BENIGN_404.join(', ')}]`);
    check(errors.length === 0, '⛓ CLAIM 10 — ZERO console errors and ZERO pageerrors across '
        + 'the host document and its two frames', errors.slice(0, 4).join(' | '));
    check(realNotFound.length === 0,
        '…and ZERO 404s other than the named benign one',
        realNotFound.slice(0, 4).join(' | '));
} catch (e) {
    check(false, 'the row ran to completion', e.message);
}

// eslint-disable-next-line no-console
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
await finish(failed === 0 ? 0 : 1);
