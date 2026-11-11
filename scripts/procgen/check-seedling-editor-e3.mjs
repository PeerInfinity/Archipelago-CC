#!/usr/bin/env node
/**
 * check-seedling-editor-e3 — **SEEDLING EDITOR E3, IN A REAL BROWSER**: the level set as a 2D MAP on
 * `watch.html?source=edit`.
 *
 * Every value claim is against node's own answer over the SAME set (the page's own download, or a set node built and
 * pasted), never the page's echo:
 *
 *   1. **THE MAP** — the vanilla 116 (and a generated preset's set) are laid out exactly as node's `canonicalLayout`
 *      lays out the set the page holds; every room has a cell, its still is drawn, links have ink.
 *   2. **SELECT / OPEN** — a click selects (links in and out highlighted), a double click opens the room; with the map
 *      focused `Ctrl+Z` hits the SET session and the identity line says so.
 *   3. **CONNECT on the map** — `c`, the source room, a door tick (picks the exit), the target: ONE `connect`, the set
 *      equal to node's fold of the same op; no room moves.
 *   4. **DISCONNECT on the map** — `d`, a click on a link previews it (the ordinal shift, as node's
 *      `disconnectEffectOf` says it), a second click applies ONE `disconnect` equal to node's fold; no room moves.
 *   5. **REFUSALS by name** — self-join, a missing return ordinal, an exit with children, a marked location; a pit and a
 *      `named_rooms` arrival are not exits. Each refusal edits nothing.
 *   6. **PAN / ZOOM / TOGGLE / RE-LAYOUT** — `+`/`-` change the zoom and the canvas; the strip is one toggle away (and
 *      `?setView=strip` opens on it); RE-LAYOUT is the canonical layout.
 *
 * `--shots=<dir>` writes the E3 screenshots. Brings its own server (`serveRepoRoot`) unless `--host=`.
 *
 *   node scripts/procgen/check-seedling-editor-e3.mjs [--host=http://localhost:8000] [--shots=<dir>]
 *
 * Exits 0 when every check passes, 1 otherwise. Takes the box lock (kind `browser`).
 */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
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
    takeBoxLockOrExit({ name: 'check-seedling-editor-e3.mjs', kind: 'browser' });
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
    const SHOTS = arg('shots', '');
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });

    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { foldEdits } = await M('procgenCore/editCore.js');
    const { loadRulesSchema } = await M('procgenCore/jsonSchemaFiles.js');
    const { tileTypeForPlacement, SEEDLING_TILE_SIZE } = await M('flashPanel/seedlingSemantics.js');
    const { buildLevelSet, vanillaRecordSet } = await M('seedlingDemo/levelSetExporter.js');
    const { stableStringify } = await M('procgenCore/contentIdentity.js');
    const { emptyLevel } = await M('seedlingDemo/procgenLevel.js');
    const { parseOelLevel } = await M('seedlingDemo/procgenLevelOel.js');
    const { emptyOverlay } = await M('seedlingDemo/seedlingSetOverlay.js');
    const { createSeedlingSetAdapter, setRecord } = await M('seedlingDemo/seedlingSetAdapter.js');
    const { assembleGeneratedSeedlingSet } = await M('seedlingDemo/seedlingGeneratedSet.js');
    const { canonicalLayout, layoutGraphOf, mapLinksOf } = await M('seedlingDemo/seedlingSetMap.js');
    const { disconnectEffectOf, editorVanillaSet, roomRowsOf } = await M('seedlingDemo/watchSetEditor.js');
    const readRepoJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
    const EMBED = readRepoJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
    const MAP_DOC = readRepoJson('frontend/modules/flashPanel/atlases/seedling-map.json');
    const digest = (v) => createHash('sha256').update(stableStringify(v)).digest('hex');
    const DEPS = {
        parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(),
        atlas: { game: 'check-seedling-editor-e3', mapDocument: 'check-seedling-editor-e3.json' },
    };
    const setAdapter = createSeedlingSetAdapter(DEPS);
    const layoutOf = (set) => {
        const rec = setRecord(set, emptyOverlay());
        return canonicalLayout(layoutGraphOf(rec, mapLinksOf(rec, DEPS).links)).map((p) => [p.gx, p.gy]);
    };
    /** node's fold of `ops` over `set` — the value the page's download must equal (rooms compared). */
    const nodeFold = (set, ops) => foldEdits(setAdapter, setRecord(set, emptyOverlay()), ops).record.set;
    const nodeApply = (set, op) => setAdapter.apply(setRecord(set, emptyOverlay()), op);

    /**
     * ⛓ THE SMALL SET the gestures run on, built here: room 0 has an EAST door to 1, a SOUTH door to 2 and an
     * interior door to 3 carrying a `<node>` (an exit with CHILDREN); 1, 2 and 3 each have a door back.
     */
    const door = (x, y, to, px, py, extra = {}) => ({
        type: 'teleporter', x, y, attrs: { to: String(to), playerx: String(px), playery: String(py) }, ...extra,
    });
    const levels = [
        [door(144, 64, 1, 8, 64), door(64, 144, 2, 64, 8), door(64, 64, 3, 80, 80, { nodes: [{ x: 96, y: 64 }] })],
        [door(0, 64, 0, 136, 64)],
        [door(64, 0, 0, 64, 136)],
        [door(80, 80, 0, 64, 64)],
    ].map((ents, level) => ({ ...emptyLevel({ level, width: 10, height: 10 }), entities: ents }));
    const SMALL = buildLevelSet(levels, { setId: 'check-seedling-editor-e3' }).set;
    const GEN_RULES = JSON.parse(readFileSync(join(REPO,
        'frontend/presets/seedling_generated_chestdoor/AP_1/AP_1_rules.json'), 'utf8'));
    const GEN = assembleGeneratedSeedlingSet(GEN_RULES).set;

    let failed = 0;
    const check = (ok, what, detail) => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed++;
    };
    const json = (v) => JSON.stringify(v);

    const host = arg('host', '');
    const server = host ? null : await serveRepoRoot();
    const origin = host || `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1700 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    const finish = async () => {
        await browser.close().catch(() => {});
        if (server) await closeServer(server);
    };
    const shot = async (name, sel = '#editSetPanel') => {
        if (!SHOTS) return;
        await page.locator(sel).screenshot({ path: join(SHOTS, `${name}.png`) });
    };

    const set = () => page.evaluate(() => window.__editorEdit?.set ?? null);
    const status = () => page.textContent('#status');
    const note = () => page.textContent('#editSetMapNote');
    const open = async (query = '') => {
        await page.goto(`${origin}/frontend/modules/seedlingDemo/watch.html?source=edit&level=1${query}`,
            { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__editorEdit?.status === 'ok', null, { timeout: 120000 });
    };
    const loadSet = async (doc, rooms) => {
        await page.fill('#editLoad', JSON.stringify(doc));
        await page.click('#editLoadGo');
        await page.waitForFunction((n) => window.__editorEdit?.set?.rooms === n
            && window.__editorEdit.set.edits === 0, rooms, { timeout: 120000 });
    };
    const settled = async (n, what) => {
        await page.waitForFunction((k) => window.__editorEdit?.set?.edits === k, n, { timeout: 30000 }).catch(() => {});
        const s = await set();
        check(s.edits === n, `⛓ ${what}: the SET session settled at EXACTLY ${n} edit(s)`, String(s.edits));
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
    };
    const centreOf = (cells, i) => [cells[i][0] + cells[i][2] / 2, cells[i][1] + cells[i][3] / 2];
    /** A point on the line between two rooms' centres, `t` of the way from `a`. */
    const along = (cells, a, b, t) => {
        const [ax, ay] = centreOf(cells, a);
        const [bx, by] = centreOf(cells, b);
        return [ax + (bx - ax) * t, ay + (by - ay) * t];
    };
    const mapKey = async (k) => {
        await page.focus('#editSetOverview');
        await page.keyboard.press(k);
    };
    /** The page's folded set, through its own download. */
    const downloaded = async () => {
        await page.evaluate(() => { delete window.__editorSetOut; });
        await page.click('#editDownloadSet');
        await page.waitForFunction(() => window.__editorSetOut, null, { timeout: 60000 }).catch(() => {});
        return page.evaluate(() => window.__editorSetOut ?? null);
    };
    const highlightInk = () => page.evaluate(() => {
        const o = document.querySelector('#editSetOverviewWrap canvas.editorViewOverlay');
        const d = o.getContext('2d').getImageData(0, 0, o.width, o.height).data;
        let n = 0;
        // ⛓ the highlight colour is #7fe0ff
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] < 160 && d[i + 1] > 180 && d[i + 2] > 220) n += 1;
        return n;
    });

    try {
        /* ── 1. THE MAP: the vanilla 116 ─────────────────────────────────── */
        await open();
        const t0 = Date.now();
        await page.click('#editLoadVanilla');
        await page.waitForFunction(() => window.__editorEdit?.set?.rooms === 116 && window.__editorEdit.set.map,
            null, { timeout: 120000 });
        const loadMs = Date.now() - t0;
        const vanillaMap = (await set()).map;
        const vanillaSet = await downloaded();
        check(vanillaSet !== null, 'the vanilla 116 downloads (the set the map is compared against)');
        /*
         * ⛓⛓ THE PAGE'S VANILLA ≡ NODE'S NAMED CALL, BY DIGEST (slice `seedling-vanilla-set-arrivals`). The page
         * and node's unit rows once opened two different copies (the game's rooms vs the delivered set, one
         * `named_rooms` arrival apart) while every row here compared the page only against itself. MUTANT: the page
         * calls `vanillaRecordSet`'s default (the delivery's patches) — the digest is the delivered one, and this reds.
         */
        const pageDigest = vanillaSet && digest(vanillaSet);
        const editorDigest = digest(editorVanillaSet(EMBED, MAP_DOC).set);
        const deliveredDigest = digest(vanillaRecordSet(EMBED, MAP_DOC).set);
        check(pageDigest === editorDigest && editorDigest !== deliveredDigest,
            '1 ⛓⛓ the page\'s vanilla 116 IS node\'s `editorVanillaSet` (the game\'s rooms), byte for byte, and not the '
            + 'delivered set',
            `page ${pageDigest?.slice(0, 16)} · editorVanillaSet ${editorDigest.slice(0, 16)} · delivered `
            + `${deliveredDigest.slice(0, 16)} · ${vanillaSet?.set_id}`);
        const nodeVanilla = layoutOf(vanillaSet);
        check(json(vanillaMap.positions) === json(nodeVanilla),
            '1 ⛓⛓ THE MAP of the vanilla 116 is node\'s canonicalLayout of the SAME set (the page\'s own download)',
            `rule ${vanillaMap.rule}; ${vanillaMap.positions.length} cells; census ${json(vanillaMap.census)}; `
            + `LOAD→map ${loadMs} ms`);
        check(vanillaMap.cells.length === 116 && new Set(vanillaMap.positions.map(json)).size === 116,
            '1 every room has its own cell');
        const drawnStill = await page.evaluate((cell) => {
            const c = document.getElementById('editSetOverview');
            const d = c.getContext('2d').getImageData(cell[0] + 4, cell[1] + 14, cell[2] - 8, cell[3] - 18).data;
            const seen = new Set();
            for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
            return seen.size;
        }, vanillaMap.cells[0]);
        check(drawnStill > 8, '1 room 0\'s cell carries its STILL (the strip\'s thumbnail, letterboxed)',
            `${drawnStill} colours`);
        const nodeLinks = mapLinksOf(setRecord(vanillaSet, emptyOverlay()), DEPS).links;
        check(json(vanillaMap.links.map((l) => [l.kind, l.from, l.to])) === json(nodeLinks.map((l) => [l.kind, l.from, l.to])),
            '1 the links are node\'s `mapLinksOf` — doors, pits and named_rooms arrivals',
            ['exit', 'pit', 'named'].map((k) => `${k} ${nodeLinks.filter((l) => l.kind === k).length}`).join(', '));
        if (SHOTS) {
            await page.evaluate(() => { const w = document.getElementById('editSetOverviewWrap'); w.scrollLeft = 0; w.scrollTop = 0; });
            await shot('1-vanilla-116-map', '#editSetOverviewWrap');
        }

        /* ── 2. SELECT / OPEN / the undo key ─────────────────────────────── */
        const inkBefore = await highlightInk();
        // ⛓ not room 0: it is selected at mount, so its highlight could not change.
        const pick = 5;
        await clickMap(...centreOf(vanillaMap.cells, pick));
        await page.waitForFunction((i) => window.__editorEdit?.set?.map?.cells && document.getElementById('editSetRoom')?.value === String(i), pick, { timeout: 10000 }).catch(() => {});
        const inkAfter = await highlightInk();
        const selectedNow = await page.$eval('#editSetRoom', (e) => e.value);
        // ⛓ the highlight MOVES (room 0 was selected at mount); which links it covers is the unit row's pin.
        check(inkAfter !== inkBefore && selectedNow === String(pick),
            '2 a click SELECTS the room and the highlight moves to its links in and out',
            `selected ${selectedNow}; highlight ink ${inkBefore} → ${inkAfter}; status "${(await status()).slice(0, 60)}"`);
        await clickMap(...centreOf(vanillaMap.cells, pick), { dbl: true });
        await page.waitForFunction((i) => window.__editorEdit?.set?.openRoom === i, pick, { timeout: 30000 }).catch(() => {});
        check((await set()).openRoom === pick, '3 a DOUBLE CLICK opens the room in the room editor, as OPEN does',
            `openRoom ${(await set()).openRoom}`);
        await page.focus('#editSetOverview');
        const idFocused = await page.textContent('#editSetIdentity');
        check(/hits the SET session \(the map owns its keys/.test(idFocused),
            '3 ⛓ two sessions, one undo key: with the MAP focused the identity line says Ctrl+Z hits the SET',
            idFocused.slice(idFocused.indexOf('⌨')));

        /* ── 1b. a GENERATED set's map ──────────────────────────────────── */
        await open();
        await loadSet(GEN, GEN.rooms.length);
        const genMap = (await set()).map;
        check(json(genMap.positions) === json(layoutOf(GEN)),
            '1 ⛓ a GENERATED set (seedling_generated_chestdoor) is laid out as node lays it out',
            json(genMap.positions));
        await shot('2-generated-set-map');

        /* ── 3. CONNECT on the map ──────────────────────────────────────── */
        await open();
        await loadSet(SMALL, 4);
        const m0 = (await set()).map;
        check(json(m0.positions) === json(layoutOf(SMALL)), 'the small set is laid out as node lays it out',
            json(m0.positions));
        check(m0.positions[1][0] - m0.positions[0][0] === 1 && m0.positions[1][1] === m0.positions[0][1]
            && m0.positions[2][1] - m0.positions[0][1] === 1 && m0.positions[2][0] === m0.positions[0][0],
        '1 ⛓ PLACED BY THEIR EXITS: the room behind 0\'s EAST door is east of it, the one behind its SOUTH door south');
        await mapKey('c');
        await clickMap(...centreOf(m0.cells, 1));
        // ⛓ room 1's only door is #0; its tick is ON its still — clicking it picks the exit.
        await page.waitForFunction(() => window.__editorEdit?.set?.map?.cells, null);
        const ticks = await page.evaluate(() => window.__editorEdit.set.map.cells);
        const room1 = SMALL.rooms[1].source.record.entities[0];
        const k1 = ticks[1][2] - 4;
        const tick = [ticks[1][0] + 2 + (room1.x + 8) * (k1 / 160), ticks[1][1] + 2 + (room1.y + 8) * (k1 / 160)];
        await clickMap(...tick);
        check(/source exit is #0 of room 1/.test(await status()), '3 a click on the source room\'s door TICK picks that exit',
            (await status()).slice(0, 80));
        await page.selectOption('#editSetTargetExit', '0');
        await clickMap(...centreOf(m0.cells, 2));
        await settled(1, 'CONNECT on the map');
        const connectOp = { op: 'connect', from: [1, 0], to: [2, 0], one_way: false };
        const afterConnect = await downloaded();
        check(json(afterConnect?.rooms) === json(nodeFold(SMALL, [connectOp]).rooms),
            '3 ⛓⛓ the set after the map\'s CONNECT equals node\'s fold of ONE `connect` {from:[1,0], to:[2,0]}');
        const m1 = (await set()).map;
        check(json(m1.positions) === json(m0.positions) && m1.moved === 0 && m1.rule === 'sticky',
            '4 ⛓ LAYOUT STABILITY: a connect moves NO room', `rule ${m1.rule}, moved ${m1.moved}`);
        check(m1.links.some((l) => l.kind === 'exit' && l.from === 1 && l.to === 2), '3 the new link is drawn');
        await shot('3-connect');

        /* ── 4. DISCONNECT on the map, with its preview ──────────────────── */
        await mapKey('Escape');
        await mapKey('d');
        const rowsNow = roomRowsOf(setRecord(nodeFold(SMALL, [connectOp]), emptyOverlay()));
        // ⛓ 0→1 is two-way; a click near room 0's end means room 0's door to 1 (#0), and #1, #2 shift down.
        await clickMap(...along(m1.cells, 0, 1, 0.45));
        const preview = await status();
        const want = disconnectEffectOf(rowsNow, 0, 0);
        check(preview.includes(want) && (await note()).includes(want),
            '4 ⛓⛓ DISCONNECT PREVIEW before the press: the status and the note say node\'s `disconnectEffectOf`',
            want);
        check((await set()).edits === 1, '4 the first click on a link applies NOTHING');
        await shot('4-disconnect-preview');
        await clickMap(...along(m1.cells, 0, 1, 0.45));
        await settled(2, 'DISCONNECT on the map (second click)');
        const disconnectOp = { op: 'disconnect', room: 0, exitIndex: 0 };
        const afterDisconnect = await downloaded();
        check(json(afterDisconnect?.rooms) === json(nodeFold(SMALL, [connectOp, disconnectOp]).rooms),
            '4 ⛓⛓ the set after the map\'s DISCONNECT equals node\'s fold of ONE `disconnect` {room:0, exitIndex:0}');
        const m2 = (await set()).map;
        check(json(m2.positions) === json(m0.positions) && m2.moved === 0,
            '4 ⛓ LAYOUT STABILITY: a disconnect moves NO room', `rule ${m2.rule}, moved ${m2.moved}`);
        await mapKey('Control+z');
        await settled(1, 'Ctrl+Z on the focused map undoes the SET');
        check(json((await set()).map.positions) === json(m0.positions), '4 …and the undo moves no room either');

        /* ── 5. REFUSALS, by name, editing nothing ──────────────────────── */
        const refusedBy = async (what, op, run) => {
            const before = (await set()).edits;
            await run();
            await page.waitForTimeout(400);
            const s = await status();
            const nodeSays = op ? nodeApply(nodeFold(SMALL, [connectOp]), op) : null;
            const ok = (await set()).edits === before
                && (op ? (!nodeSays.ok || !nodeSays.applied) && s.includes(nodeSays.description) : true);
            check(ok, `5 ⛓ REFUSED BY NAME — ${what}`, s.slice(0, 160));
            return s;
        };
        await mapKey('Escape');
        await mapKey('c');
        await refusedBy('a SELF-JOIN', { op: 'connect', from: [2, 0], to: [2, 0], one_way: false }, async () => {
            await clickMap(...centreOf(m0.cells, 2));
            await clickMap(...centreOf(m0.cells, 2).map((v) => v - 25));
        });
        await shot('5-refusal-self-join');
        await mapKey('Escape');
        await mapKey('c');
        // ⛓ the ordinal list is the widest room's (room 0 has three exits); room 3 has ONE.
        await refusedBy('a RETURN DOOR ordinal the target lacks', { op: 'connect', from: [1, 0], to: [3, 2], one_way: false },
            async () => {
                await clickMap(...centreOf(m0.cells, 1));
                await page.selectOption('#editSetTargetExit', '2');
                await clickMap(...centreOf(m0.cells, 3));
            });
        await mapKey('Escape');
        await mapKey('d');
        // ⛓ 0→3 is 0's exit #2 — the door carrying a <node> child.
        await page.selectOption('#editSetRoom', '0').catch(() => {});
        await page.selectOption('#editSetExitList', '2').catch(() => {});
        await refusedBy('an exit WITH CHILDREN', { op: 'disconnect', room: 0, exitIndex: 2 }, async () => {
            await clickMap(...along(m1.cells, 0, 3, 0.45));
            await clickMap(...along(m1.cells, 0, 3, 0.45));
        });
        // ⛓ a marked location on room 1's door (which the CONNECT above pointed at room 2), then a disconnect of it.
        await mapKey('Escape');
        await page.selectOption('#editSetRoom', '1');
        await page.waitForTimeout(300);
        const ent = JSON.stringify({ type: 'teleporter', x: room1.x, y: room1.y });
        await page.selectOption('#editSetLocEntity', ent);
        await page.fill('#editSetLocName', 'Door Prize');
        await page.fill('#editSetLocItem', 'Nothing');
        await page.click('#editSetMarkLocation');
        await settled(2, 'MARK a location on room 1\'s door');
        await mapKey('d');
        {
            const before = (await set()).edits;
            await clickMap(...along(m1.cells, 1, 2, 0.45));
            await clickMap(...along(m1.cells, 1, 2, 0.45));
            await page.waitForTimeout(400);
            const s = await status();
            check((await set()).edits === before && /location|unmark-location/i.test(s),
                '5 ⛓ REFUSED BY NAME — a door a LOCATION is marked on (unmark it first)', s.slice(0, 160));
        }
        await mapKey('Escape');

        /* ── 6. ZOOM / TOGGLE / RE-LAYOUT / ?setView=strip ───────────────── */
        const w0 = (await set()).map.frame.width;
        await mapKey('+');
        const z1 = (await set()).map;
        check(z1.zoom > 1 && z1.frame.width > w0, '6 `+` ZOOMS IN: the canvas grows', `${w0} → ${z1.frame.width}`);
        await mapKey('-');
        check((await set()).map.frame.width === w0, '6 `-` zooms back out');
        await page.uncheck('#editSetMapView');
        check((await set()).map === null && /the strip owns its keys/.test(await page.textContent('#editSetIdentity')),
            '5 THE STRIP is one toggle away (and the identity line names it)');
        await page.check('#editSetMapView');
        await page.click('#editSetMapRelayout');
        const rl = (await set()).map;
        check(rl.rule === 'canonical' && rl.relayouts === 1, '4 RE-LAYOUT asks for the canonical layout', json(rl.positions));

        await open('&setView=strip');
        await loadSet(SMALL, 4);
        check((await set()).map === null && !(await page.isChecked('#editSetMapView')),
            '5 `?setView=strip` opens on the STRIP');

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
