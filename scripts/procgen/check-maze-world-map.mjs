#!/usr/bin/env node
/**
 * check-maze-world-map — **THE MAZE LAB'S SET ARM AS A 2D MAP, IN A REAL BROWSER** (maze world map, step A):
 * `lab.html?source=set`, a region library and its overlay drawn by `mazeRoom/mazeSetMap.js` through the shared
 * set view (`procgenCore/setEditorView.mountSetEditor`'s `overviewMap`).
 *
 * Every value claim is against node's own answer over the SAME record (the page's own download, or documents node
 * built and pasted), never the page's echo:
 *
 *   1. **THE MAP** — the committed `demo-maze-pack` (bare, then with a ring overlay) and a GENERATED library
 *      (`procgen_maze/AP_3`'s ten rooms, wired by its sidecars) are laid out exactly as node's `canonicalLayout`
 *      lays out the record the page holds; every room has a cell, its still is drawn, the links are node's
 *      `mazeMapLinksOf`, and a room behind an EAST door is east of it.
 *   2. **SELECT / OPEN** — a click selects (the highlight moves), a double click opens the room in this arm.
 *   3. **CONNECT on the map** — `c`, the source room, a door TICK (picks the exit), the target: ONE `connect`, the
 *      overlay equal to node's fold of the same op; no room moves.
 *   4. **DISCONNECT on the map** — `d`, a click on a link picks it and applies nothing, a second click applies ONE
 *      `disconnect` equal to node's fold; no room moves; `Ctrl+Z` on the map undoes the SET.
 *   5. **REFUSALS by name** — a self-join and an exit that is already joined, each the ADAPTER's own sentence, each
 *      editing nothing.
 *   6. **ZOOM / TOGGLE / RE-LAYOUT / the default** — `+`/`-` move the canvas; the strip is one toggle away; RE-LAYOUT
 *      is canonical; no `?setView=` opens on the STRIP (this page's default).
 *   7. **THE WORLD SESSION** — a world bundle opens on the strip, the map toggle disabled and the reason on the line.
 *
 * `--shots=<dir>` writes the slice's screenshots. Brings its own server (`serveRepoRoot`) unless `--host=`.
 *
 *   node scripts/procgen/check-maze-world-map.mjs [--host=http://localhost:8000] [--shots=<dir>]
 *
 * Exits 0 when every check passes, 1 otherwise. Takes the box lock (kind `browser`).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

async function main() {
    takeBoxLockOrExit({ name: 'check-maze-world-map.mjs', kind: 'browser' });
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
    const SHOTS = arg('shots', '');
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });

    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { foldEdits } = await M('procgenCore/editCore.js');
    const { frameOf, doorTickShapes } = await M('procgenCore/setMapLayout.js');
    const { createMazeSetAdapter, exitsOfRoom, setRecord } = await M('mazeRoom/mazeSetAdapter.js');
    const { mazeDisconnectEffectOf } = await M('mazeRoom/mazeSetLab.js');
    const { emptyMazeOverlay } = await M('mazeRoom/mazeAtlasDerivation.js');
    const { mazeMapLinksOf, mazeLayoutGraphOf, mazeDoorPointsOf } = await M('mazeRoom/mazeSetMap.js');
    const { canonicalLayout } = await M('procgenCore/setMapLayout.js');
    const { generatedMazeLibrary } = await M('mazeRoom/mazeSetMap.fixtures.js');
    const { writeBundle } = await M('presets/documentBundle.js');
    const { loadJSZipNode } = await import('./loadJSZipNode.mjs');
    const { emptyWorld } = await M('procgenCore/worldDocument.js');
    const { emptyOverlay: emptySeedlingOverlay } = await M('seedlingDemo/seedlingSetOverlay.js');
    const { buildLevelSet } = await M('seedlingDemo/levelSetExporter.js');
    const { emptyLevel } = await M('seedlingDemo/procgenLevel.js');
    const { stampIdentity } = await M('procgenCore/contentIdentity.js');

    const adapter = createMazeSetAdapter({});
    const PACK_PATH = 'frontend/region-libraries/demo-maze-pack.json';
    const PACK = JSON.parse(readFileSync(join(REPO, PACK_PATH), 'utf8'));
    const GEN_RULES = JSON.parse(readFileSync(join(REPO, 'frontend/presets/procgen_maze/AP_3/AP_3_rules.json'), 'utf8'));
    const GEN = generatedMazeLibrary(GEN_RULES);
    /** ⛓ The demo pack's ring: each room's EAST exit to the next room's WEST exit (two-way by default). */
    const exitOnSide = (entry, side) => entry.payload.exits.find((e) => e.side === side).exit_id;
    const RING = PACK.entries.map((e, i) => ({
        from: [i, exitOnSide(e, 'E')], to: [(i + 1) % PACK.entries.length, exitOnSide(PACK.entries[(i + 1) % PACK.entries.length], 'W')],
    }));
    const overlayWith = (links) => ({ ...emptyMazeOverlay(), links });
    const layoutOf = (rec) => canonicalLayout(mazeLayoutGraphOf(rec, mazeMapLinksOf(rec).links)).map((p) => [p.gx, p.gy]);
    const nodeFold = (rec, ops) => foldEdits(adapter, rec, ops).record;

    let failed = 0;
    const check = (ok, what, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed++;
    };
    const json = (v) => JSON.stringify(v);

    /** ⛓ The WORLD bundle (`check-maze-lab`'s W4 recipe): two linked Seedling rooms + the pack's first two entries. */
    const JSZIP = loadJSZipNode();
    const WORLD_SET = buildLevelSet([0, 1].map((level) => emptyLevel({ level })), { setId: 'maze-world-map', link: true }).set;
    const WORLD_LIB = stampIdentity({ ...PACK, entries: PACK.entries.slice(0, 2), provenance: { ...(PACK.provenance ?? {}) } },
        { idKey: 'library_id', defaultBase: 'demo-maze-pack' });
    const WORLD_ZIP = await writeBundle([
        { kind: 'world', doc: emptyWorld([
            { id: 'seed', kind: 'level-set', overlay: emptySeedlingOverlay(), substrate: 'flash_seedling', doc_id: WORLD_SET.set_id },
            { id: 'mz', kind: 'region-library', overlay: emptyMazeOverlay(), substrate: 'maze', doc_id: WORLD_LIB.library_id },
        ]) },
        { kind: 'level-set', doc: WORLD_SET },
        { kind: 'region-library', doc: WORLD_LIB },
    ], { jszip: JSZIP });
    const WORLD_ROUTE = '/__maze-world-map-world.zip';

    const host = arg('host', '');
    const server = host ? null : await serveRepoRoot();
    const origin = host || `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
    await page.route((u) => u.pathname === WORLD_ROUTE, (r) => r.fulfill({
        status: 200, contentType: 'application/zip', body: Buffer.from(WORLD_ZIP),
    }));
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const finish = async () => {
        await browser.close().catch(() => {});
        if (server) await closeServer(server);
    };
    const shot = async (name, sel = '#setPanel') => {
        if (!SHOTS) return;
        await page.locator(sel).screenshot({ path: join(SHOTS, `${name}.png`) });
    };

    const set = () => page.evaluate(() => window.__mazeLab?.set ?? null);
    const status = () => page.textContent('#status');
    const note = () => page.textContent('#editSetNote');
    const open = async (query = '') => {
        await page.goto(`${origin}/frontend/modules/mazeRoom/lab.html?source=set&library=/${PACK_PATH}${query}`,
            { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__mazeLab?.set?.mounted === true, null, { timeout: 60000 });
    };
    const paste = async (doc, pred, arg2 = null) => {
        await page.fill('#labSetText', json(doc));
        await page.click('#labSetLoad');
        await page.waitForFunction(pred, arg2, { timeout: 60000 });
    };
    const loadLibrary = async (library, overlay = null) => {
        await paste(library, (id) => window.__mazeLab?.set?.library_id === id && window.__mazeLab.set.mounted,
            library.library_id);
        if (overlay) {
            await paste(overlay, (n) => window.__mazeLab?.set?.links === n && window.__mazeLab.set.mounted,
                overlay.links.length);
        }
    };
    const settled = async (n, what) => {
        await page.waitForFunction((k) => window.__mazeLab?.set?.ops === k, n, { timeout: 30000 }).catch(() => {});
        const s = await set();
        check(s.ops === n, `⛓ ${what}: the SET session settled at EXACTLY ${n} op(s)`, String(s.ops));
    };
    const turnMapOn = async () => {
        if (!(await page.isChecked('#editSetMapView'))) await page.check('#editSetMapView');
        await page.waitForFunction(() => window.__mazeLab?.set?.map?.cells?.length > 0, null, { timeout: 10000 });
    };
    /** Click a canvas pixel of the map (scrolling the panel so it is on screen). */
    const clickMap = async (x, y, { dbl = false } = {}) => {
        const r = await page.evaluate(([px, py]) => {
            const c = document.getElementById('editSetOverview');
            const wrap = c.parentNode;
            wrap.scrollIntoView({ block: 'center' });
            wrap.scrollLeft = Math.max(0, px - wrap.clientWidth / 2);
            wrap.scrollTop = Math.max(0, py - wrap.clientHeight / 2);
            const b = c.getBoundingClientRect();
            return { left: b.left, top: b.top, sx: b.width / c.width, sy: b.height / c.height };
        }, [x, y]);
        const at = [r.left + x * r.sx, r.top + y * r.sy];
        if (dbl) await page.mouse.dblclick(...at);
        else await page.mouse.click(...at);
        // ⛓ the page repaints its status line on the next render; a hover is one
        await page.mouse.move(at[0] + 1, at[1] + 1);
    };
    const centreOf = (cells, i) => [cells[i][0] + cells[i][2] / 2, cells[i][1] + cells[i][3] / 2];
    const along = (cells, a, b, t) => {
        const [ax, ay] = centreOf(cells, a);
        const [bx, by] = centreOf(cells, b);
        return [ax + (bx - ax) * t, ay + (by - ay) * t];
    };
    const mapKey = async (k) => {
        await page.focus('#editSetOverview');
        await page.keyboard.press(k);
    };
    /** The page's folded library + overlay, through its own download. */
    const downloaded = async () => {
        await page.evaluate(() => { delete window.__editorSetOut; delete window.__editorSetOverlayOut; });
        await page.click('#editDownloadSet');
        await page.waitForFunction(() => window.__editorSetOverlayOut, null, { timeout: 60000 }).catch(() => {});
        return page.evaluate(() => (window.__editorSetOut
            ? { library: window.__editorSetOut, overlay: window.__editorSetOverlayOut } : null));
    };
    /** Node's tick position of `room`'s exit ordinal `k`, at the page's own layout and zoom. */
    const tickOf = (rec, map, room, k) => {
        const f = frameOf(map.positions.map(([gx, gy]) => ({ gx, gy })), mazeMapLinksOf(rec).sizes, map.zoom);
        const t = doorTickShapes(room, f, mazeMapLinksOf(rec).sizes[room], mazeDoorPointsOf(rec, room))[k];
        return [t.marker.x, t.marker.y];
    };
    const highlightInk = () => page.evaluate(() => {
        const o = document.querySelector('#editSetOverviewWrap canvas.editorViewOverlay');
        if (!o) return -1;
        const d = o.getContext('2d').getImageData(0, 0, o.width, o.height).data;
        let n = 0;
        // ⛓ the highlight colour is #7fe0ff
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] < 160 && d[i + 1] > 180 && d[i + 2] > 220) n += 1;
        return n;
    });
    const stillColours = (cell) => page.evaluate((c) => {
        const cv = document.getElementById('editSetOverview');
        const d = cv.getContext('2d').getImageData(c[0] + 4, c[1] + 14, c[2] - 8, c[3] - 18).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        return seen.size;
    }, cell);

    try {
        /* ── 6a. THE DEFAULT: no `?setView=` is the STRIP ─────────────────── */
        await open();
        const s0 = await set();
        check(s0.map === null && !(await page.isChecked('#editSetMapView'))
            && !(await page.isDisabled('#editSetMapView')),
        '6 ⛓ no `?setView=` opens on the STRIP (this page\'s default), with the map one ENABLED toggle away',
        `map ${json(s0.map)}`);

        /* ── 1. THE MAP: the committed pack, bare and with its ring ───────── */
        await open('&setView=map');
        const bare = setRecord(PACK, emptyMazeOverlay());
        const m0 = (await set()).map;
        check(m0 !== null && (await page.isChecked('#editSetMapView')), '1 `?setView=map` opens on the MAP');
        check(json(m0?.positions) === json(layoutOf(bare)) && m0.links.length === 0,
            '1 ⛓⛓ THE MAP of the committed demo-maze-pack is node\'s canonicalLayout of the SAME record — no '
            + 'overlay, so no links: the rooms are laid out as unreached groups, lowest index first',
            `${json(m0?.positions)}; rule ${m0?.rule}`);
        check(m0.cells.length === PACK.entries.length && new Set(m0.positions.map(json)).size === PACK.entries.length,
            '1 every room has its own cell');
        const colours = await stillColours(m0.cells[0]);
        check(colours > 3, '1 room 0\'s cell carries its STILL (the strip\'s thumbnail, letterboxed)', `${colours} colours`);
        await shot('1-committed-library-map', '#editSetOverviewWrap');

        const ringOverlay = overlayWith(RING);
        await paste(ringOverlay, (n) => window.__mazeLab?.set?.links === n && window.__mazeLab.set.map, RING.length);
        const ringRec = setRecord(PACK, ringOverlay);
        const m1 = (await set()).map;
        check(json(m1.positions) === json(layoutOf(ringRec)),
            '1 ⛓⛓ …with its RING overlay, node\'s canonicalLayout of the same record', json(m1.positions));
        check(json(m1.links.map((l) => [l.from, l.to, l.dir])) === json(mazeMapLinksOf(ringRec).links.map((l) => [l.from, l.to, l.dir])),
            '1 the links are node\'s `mazeMapLinksOf` — each two-way link once per end, its direction the exit\'s side',
            `${m1.links.length} directed links`);
        check(m1.positions[1][0] - m1.positions[0][0] === 1 && m1.positions[1][1] === m1.positions[0][1],
            '1 ⛓ PLACED BY THEIR DOORS: the room behind room 0\'s EAST exit is one cell east of it');
        await shot('1b-committed-library-ring-map', '#editSetOverviewWrap');

        /* ── 1c. a GENERATED library ─────────────────────────────────────── */
        await loadLibrary(GEN.library, GEN.overlay);
        await turnMapOn();
        const genRec = setRecord(GEN.library, GEN.overlay);
        const mg = (await set()).map;
        check(json(mg.positions) === json(layoutOf(genRec)),
            `1 ⛓⛓ a GENERATED library (procgen_maze/AP_3, ${GEN.regions.length} rooms wired by its sidecars) is laid `
            + 'out as node lays it out', `census ${json(mg.census)}`);
        check(mg.census.directed === mg.links.length && mg.census.honoured === mg.census.directed,
            '1 …and every one of its doors lands its room on the door\'s side, one cell away',
            `${mg.census.honoured}/${mg.census.directed}`);
        await shot('2-generated-library-map', '#editSetOverviewWrap');

        /* ── 2. SELECT / OPEN ────────────────────────────────────────────── */
        const inkBefore = await highlightInk();
        const pick = 3;
        await clickMap(...centreOf(mg.cells, pick));
        await page.waitForFunction((i) => window.__mazeLab?.set?.selected === i, pick, { timeout: 10000 }).catch(() => {});
        const inkAfter = await highlightInk();
        check((await set()).selected === pick && inkAfter !== inkBefore,
            '2 a click SELECTS the room and the highlight moves to its links in and out',
            `selected ${(await set()).selected}; highlight ink ${inkBefore} → ${inkAfter}`);
        await clickMap(...centreOf(mg.cells, pick), { dbl: true });
        await page.waitForFunction((i) => window.__mazeLab?.set?.openRoom === i, pick, { timeout: 30000 }).catch(() => {});
        check((await set()).openRoom === pick, '2 a DOUBLE CLICK opens the room in this arm, as OPEN does',
            `openRoom ${(await set()).openRoom}`);

        /* ── 3. CONNECT on the map ──────────────────────────────────────── */
        const chain = overlayWith(RING.slice(0, 2));
        await open('&setView=map');
        await paste(chain, (n) => window.__mazeLab?.set?.links === n && window.__mazeLab.set.map, 2);
        const chainRec = setRecord(PACK, chain);
        const c0 = (await set()).map;
        check(json(c0.positions) === json(layoutOf(chainRec)), 'the chained pack is laid out as node lays it out',
            json(c0.positions));
        const [fromRoom, fromExit] = RING[2].from;
        const [toRoom, toExit] = RING[2].to;
        const ordinal = PACK.entries[fromRoom].payload.exits.findIndex((e) => e.exit_id === fromExit);
        await mapKey('c');
        await clickMap(...centreOf(c0.cells, fromRoom));
        await clickMap(...tickOf(chainRec, c0, fromRoom, ordinal));
        check(await page.$eval('#editSetExitList', (e) => e.value) === fromExit,
            `3 a click on the source room's door TICK picks that exit (#${ordinal} = ${fromExit})`,
            (await status()).slice(0, 90));
        await page.selectOption('#editSetTargetExit', toExit);
        await clickMap(...centreOf(c0.cells, toRoom));
        await settled(1, 'CONNECT on the map');
        const connectOp = { op: 'connect', from: [fromRoom, fromExit], to: [toRoom, toExit], one_way: false };
        const afterConnect = await downloaded();
        check(json(afterConnect?.overlay.links) === json(nodeFold(chainRec, [connectOp]).overlay.links),
            `3 ⛓⛓ the overlay after the map's CONNECT equals node's fold of ONE \`connect\` ${json(connectOp)}`);
        const c1 = (await set()).map;
        check(json(c1.positions) === json(c0.positions) && c1.moved === 0 && c1.rule === 'sticky',
            '4 ⛓ LAYOUT STABILITY: a connect moves NO room', `rule ${c1.rule}, moved ${c1.moved}`);
        check(c1.links.some((l) => l.from === fromRoom && l.to === toRoom), '3 the new link is drawn');
        await shot('3-connect');

        /* ── 4. DISCONNECT on the map ───────────────────────────────────── */
        await mapKey('Escape');
        await mapKey('d');
        await clickMap(...along(c1.cells, 0, 1, 0.4));
        const preview = await status();
        const linkedRec = nodeFold(chainRec, [connectOp]);
        const want = mazeDisconnectEffectOf(linkedRec.library.entries.map((_e, i) => ({ exitList: exitsOfRoom(linkedRec, i) })),
            0, RING[0].from[1]);
        check((await set()).ops === 1 && /DISCONNECT .* of room 0\? Click the SAME link again/.test(preview)
            && preview.includes(want) && (await page.textContent('#editSetMapNote')).includes(want),
        '4 ⛓⛓ the FIRST click on a link picks it and applies NOTHING; the status and the map note say node\'s '
            + '`mazeDisconnectEffectOf` before the press', want);
        check((await set()).map.picked?.room === 0 && (await set()).map.picked?.value === RING[0].from[1],
            '4 …the pick is room 0\'s door to room 1 (the nearer end)', json((await set()).map.picked));
        await shot('4-disconnect-preview');
        await clickMap(...along(c1.cells, 0, 1, 0.4));
        await settled(2, 'DISCONNECT on the map (second click)');
        const disconnectOp = { op: 'disconnect', room: 0, exit_id: RING[0].from[1] };
        const afterDisconnect = await downloaded();
        check(json(afterDisconnect?.overlay.links) === json(nodeFold(chainRec, [connectOp, disconnectOp]).overlay.links),
            `4 ⛓⛓ the overlay after the map's DISCONNECT equals node's fold of ONE \`disconnect\` ${json(disconnectOp)}`);
        const c2 = (await set()).map;
        check(json(c2.positions) === json(c0.positions) && c2.moved === 0,
            '4 ⛓ LAYOUT STABILITY: a disconnect moves NO room', `rule ${c2.rule}, moved ${c2.moved}`);
        await mapKey('Escape');
        await mapKey('Control+z');
        await settled(1, 'Ctrl+Z on the focused map undoes the SET');
        check(json((await set()).map.positions) === json(c0.positions), '4 …and the undo moves no room either');

        /* ── 5. REFUSALS, by name, editing nothing ──────────────────────── */
        const nowRec = nodeFold(chainRec, [connectOp]);
        const refusedBy = async (what, op, run) => {
            const before = (await set()).ops;
            await run();
            await page.waitForTimeout(400);
            const said = `${await status()} ${await note()}`;
            const nodeSays = adapter.apply(nowRec, op);
            check((await set()).ops === before && !nodeSays.ok && said.includes(nodeSays.description.replace(/^maze-set: /, '')),
                `5 ⛓ REFUSED BY NAME — ${what}, in the adapter's own sentence; nothing applied`, said.trim().slice(0, 170));
        };
        await mapKey('c');
        await page.waitForTimeout(100);
        await refusedBy('a SELF-JOIN', { op: 'connect', from: [2, RING[2].from[1]], to: [2, RING[2].from[1]], one_way: false },
            async () => {
                await clickMap(...centreOf(c0.cells, 2));
                await page.selectOption('#editSetExitList', RING[2].from[1]);
                await page.selectOption('#editSetTargetExit', RING[2].from[1]);
                await clickMap(...centreOf(c0.cells, 2).map((v) => v - 25));
            });
        await shot('5-refusal-self-join');
        await mapKey('Escape');
        await mapKey('c');
        // ⛓ room 0's EAST exit already crosses to room 1 (the ring's first link)
        await refusedBy('an exit that is ALREADY JOINED', { op: 'connect', from: [0, RING[0].from[1]], to: [3, RING[3].to[1]], one_way: false },
            async () => {
                await clickMap(...centreOf(c0.cells, 0));
                await page.selectOption('#editSetExitList', RING[0].from[1]);
                await page.selectOption('#editSetTargetExit', RING[3].to[1]);
                await clickMap(...centreOf(c0.cells, 3));
            });
        await mapKey('Escape');

        /* ── 6. ZOOM / TOGGLE / RE-LAYOUT ────────────────────────────────── */
        const w0 = (await set()).map.frame.width;
        await mapKey('+');
        const z1 = (await set()).map;
        check(z1.zoom > 1 && z1.frame.width > w0, '6 `+` ZOOMS IN: the canvas grows', `${w0} → ${z1.frame.width}`);
        await mapKey('-');
        check((await set()).map.frame.width === w0, '6 `-` zooms back out');
        await page.uncheck('#editSetMapView');
        check((await set()).map === null && /the strip owns its keys/.test(await page.textContent('#editSetIdentity')),
            '6 THE STRIP is one toggle away (and the identity line names it)');
        await page.check('#editSetMapView');
        await page.click('#editSetMapRelayout');
        const rl = (await set()).map;
        check(rl.rule === 'canonical' && rl.relayouts === 1 && json(rl.positions) === json(layoutOf(nowRec)),
            '6 RE-LAYOUT asks for the canonical layout of the record as it stands', json(rl.positions));

        /* ── 7. THE WORLD SESSION stays on the strip, and says why ────────── */
        await page.goto(`${origin}/frontend/modules/mazeRoom/lab.html?source=set&world=${WORLD_ROUTE}&setView=map`,
            { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__mazeLab?.set?.mounted === true && window.__mazeLab.set.world,
            null, { timeout: 60000 });
        const ws = await set();
        const why = await page.textContent('#labSetMapWhy');
        check(ws.map === null && (await page.isDisabled('#editSetMapView')) && !(await page.isChecked('#editSetMapView'))
            && /NO MAP for a WORLD/.test(why),
        '7 ⛓ a WORLD session opens on the STRIP even under `?setView=map`: the toggle is DISABLED and the reason is on '
            + 'the line', why.slice(0, 120));
        await shot('6-world-session');

        check(errors.length === 0, 'no page errors', errors.slice(0, 3).join(' | '));
    } catch (e) {
        check(false, 'the row itself threw', e.stack ?? String(e));
    } finally {
        await finish();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}

if (isEntryPoint(import.meta.url)) await main();
