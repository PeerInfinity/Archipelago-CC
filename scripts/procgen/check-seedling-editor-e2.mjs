#!/usr/bin/env node
/**
 * check-seedling-editor-e2 — **SEEDLING EDITOR E2, IN A REAL BROWSER**: entity links on `watch.html?source=edit`.
 *
 * Every value claim is against node's own fold of the same op through the same adapter, never the page's echo:
 *
 *   1. **THE OVERLAY** — the room's wires reach `__editorEdit.links` equal to node's `linksOf`, the overlay canvas has
 *      ink with them on and less with `#genEditShowLinks` off.
 *   2. **REWIRE** (`k`) — pick, click the partner: ONE `attrs` edit equal to node's `bindOps`; UNDO and REDO step it.
 *   3. **SHIFT** — a new group for the two is ONE edit; a refused partner (a body with no group) says why and edits
 *      nothing.
 *   4. **THE ROPE** (`n`) — pick a rope, click a column: ONE `nodes` edit equal to node's `ropeEndOp`; left of the pulley
 *      refuses by name.
 *   5. **THE ISSUES** — removing a button names the responder it orphans; a rope with no node refuses the OEL download
 *      and ▶ load by the same sentence; a cross-room button is named as something SOLVE cannot see.
 *   6. **SOLVE** — a link edit leaves the room uncertified.
 *
 * `--shots=<dir>` writes one screenshot per tool. Brings its own server (`serveRepoRoot`) unless `--host=`.
 *
 *   node scripts/procgen/check-seedling-editor-e2.mjs [--host=http://localhost:8000] [--shots=<dir>]
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
    takeBoxLockOrExit({ name: 'check-seedling-editor-e2.mjs', kind: 'browser' });
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
    const SHOTS = arg('shots', '');
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });

    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { foldEdits } = await M('procgenCore/editCore.js');
    const { createSeedlingEditAdapter } = await M('seedlingDemo/seedlingEditAdapter.js');
    const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
    const { parseOelLevel } = await M('seedlingDemo/procgenLevelOel.js');
    const { bindOps, groupMembers, linksOf, ropeEndOp } = await M('seedlingDemo/entityLinks.js');
    const read = (p) => JSON.parse(readFileSync(join(REPO, 'frontend/modules', p), 'utf8'));
    const ATLAS = read('flashPanel/atlases/seedling-map.json');
    const VANILLA = read('seedlingDemo/fixtures/seedling-vanilla-set.json');
    const schema = read('seedlingDemo/fixtures/seedling-ogmo-schema.json');
    const O = { schema };
    const adapter = createSeedlingEditAdapter({
        schema, levelSource: levelSourceFromAtlas(ATLAS), vanillaSetId: VANILLA.set_id, parseOel: parseOelLevel,
    });
    const fold = (base, ops) => foldEdits(adapter, base, ops).record;
    const cellOf = (e) => ({ tx: Math.floor(e.x / 16), ty: Math.floor(e.y / 16) });
    const aloneInCell = (l, m) => l.entities.filter((e) => {
        const a = cellOf(e);
        const b = cellOf(m);
        return a.tx === b.tx && a.ty === b.ty;
    }).length === 1;

    /** ⛓ Derived from the rooms: a level with a wired publisher and a responder of ANOTHER group, each alone in its cell. */
    const pickLevel = () => {
        for (const l of ATLAS.levels) {
            const ms = groupMembers(l, O).filter((m) => m.t >= 0 && m.role !== 'cross-room' && aloneInCell(l, m));
            for (const a of ms.filter((m) => m.role === 'publisher' && linksOf(l, O).some((k) => k.from?.index === m.index))) {
                const b = ms.find((m) => m.role === 'responder' && m.t !== a.t);
                if (b) return { l, a, b };
            }
        }
        return null;
    };
    const { l: LINK_ROOM, a: PUB, b: OTHER } = pickLevel();
    const ROPE_ROOM = ATLAS.levels.find((l) => l.entities.some((e) => e.type === 'rope'));
    const ROPE_INDEX = ROPE_ROOM.entities.findIndex((e) => e.type === 'rope');
    const CROSS_ROOM = ATLAS.levels.find((l) => linksOf(l, O).some((k) => k.kind === 'cross-room'));

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
    const shot = async (name) => {
        if (!SHOTS) return;
        await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
    };

    const edit = () => page.evaluate(() => window.__editorEdit);
    const status = () => page.textContent('#status');
    const settled = async (n, what) => {
        await page.waitForFunction((k) => window.__editorEdit?.edits === k, n, { timeout: 60000 }).catch(() => {});
        check((await edit()).edits === n, `⛓ ${what}: the arm settled at EXACTLY ${n} edit(s)`, String((await edit()).edits));
    };
    const openLevel = async (level) => {
        await page.goto(`${origin}/frontend/modules/seedlingDemo/watch.html?source=edit&level=${level}`,
            { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__editorEdit?.status === 'ok', null, { timeout: 120000 });
    };
    const clickCell = async ({ tx, ty }, modifiers = []) => {
        const g = await page.evaluate(() => {
            document.getElementById('canvas').scrollIntoView({ block: 'center' });
            const r = document.getElementById('canvas').getBoundingClientRect();
            const lv = window.__editorEdit.level;
            return { left: r.left, top: r.top, width: r.width, height: r.height, cols: lv.width, rows: lv.height };
        });
        for (const m of modifiers) await page.keyboard.down(m);
        await page.mouse.click(g.left + ((tx + 0.5) * g.width) / g.cols, g.top + ((ty + 0.5) * g.height) / g.rows);
        for (const m of modifiers) await page.keyboard.up(m);
    };
    const key = async (k) => {
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press(k);
    };
    const ink = () => page.evaluate(() => {
        const o = document.querySelector('canvas.editorViewOverlay');
        const d = o.getContext('2d').getImageData(0, 0, o.width, o.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) n += 1;
        return n;
    });
    const armed = (id) => page.$eval(`#genEditGesture_${id}`, (b) => b.className === 'armedTool');
    const shape = (l) => l.map((k) => ({ kind: k.kind, group: k.group ?? null, from: k.from?.index ?? k.rope?.index ?? null, to: k.to?.index ?? null }));

    try {
        /* ══ 1. THE OVERLAY ══════════════════════════════════════════ */
        await openLevel(LINK_ROOM.level);
        // ⛓ A hover must not move the canvas: `genEditCellNote` once grew a line, and a click then landed a row off.
        const canvasTop = () => page.evaluate(() => document.getElementById('canvas').getBoundingClientRect().top);
        await page.evaluate(() => document.getElementById('canvas').scrollIntoView({ block: 'center' }));
        const topBefore = await canvasTop();
        const rectNow = await page.evaluate(() => {
            const r = document.getElementById('canvas').getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.mouse.move(rectNow.x, rectNow.y);
        const topAfter = await canvasTop();
        check(topAfter === topBefore, '⛓ hovering a cell does not move the canvas', `${topBefore} → ${topAfter}`);
        const live = (await edit()).links;
        check(json(shape(live.links)) === json(shape(linksOf(LINK_ROOM, O))),
            `⛓ L${LINK_ROOM.level}: the page's links are node's \`linksOf\``, `${live.links.length} link(s)`);
        const inkOn = await ink();
        check(inkOn > 0, '⛓ the overlay carries ink for the wires', String(inkOn));
        await shot('1-links-overlay');
        await page.uncheck('#genEditShowLinks');
        const inkOff = await ink();
        check(inkOff < inkOn, '⛓ #genEditShowLinks off takes the wires away', `${inkOn} → ${inkOff}`);
        await page.check('#genEditShowLinks');

        /* ══ 2. REWIRE ═══════════════════════════════════════════════ */
        await key('k');
        check(await armed('link'), '⛓ `k` arms LINK');
        await clickCell(cellOf(PUB));
        check((await edit()).links.picked === PUB.index, '⛓ the first click picks the publisher', await status());
        const inkPicked = await ink();
        check(inkPicked !== inkOn, '⛓ picking changes the picture (its partners highlighted)', `${inkOn} → ${inkPicked}`);
        await shot('2-link-picked');
        await clickCell(cellOf(OTHER));
        await settled(1, 'a LINK');
        const want = bindOps(LINK_ROOM, PUB.index, OTHER.index, O);
        check(json((await edit()).level) === json(fold(LINK_ROOM, [want])), '⛓⛓ the record equals node\'s fold of `bindOps`');
        check((await edit()).editList.length === 1 && (await edit()).editList[0].op === 'attrs', '⛓ ONE `attrs` edit',
            json((await edit()).editList));
        await shot('2-link-rewired');
        await key('Control+z');
        await settled(0, 'UNDO of a LINK');
        check(json((await edit()).level) === json(LINK_ROOM), '⛓ one UNDO restores the room');
        await key('Control+Shift+Z');
        await settled(1, 'REDO of a LINK');
        check(json((await edit()).level) === json(fold(LINK_ROOM, [want])), '⛓ REDO brings it back');
        await key('Control+z');
        await settled(0, 'UNDO again');

        /* ══ 3. SHIFT, AND A REFUSAL ═════════════════════════════════ */
        await key('Escape');
        await key('k');
        await clickCell(cellOf(PUB));
        await clickCell(cellOf(OTHER), ['Shift']);
        await settled(1, 'a SHIFT LINK');
        const list = (await edit()).editList;
        check(list.length === 1 && list[0].op === 'group' && list[0].ops.length === 2,
            '⛓ a new group for the two is ONE edit of two members', json(list));
        const fresh = bindOps(LINK_ROOM, PUB.index, OTHER.index, { schema, fresh: true });
        check(json((await edit()).level) === json(fold(LINK_ROOM, [fresh])), '⛓⛓ …equal to node\'s fold');
        await page.click('#genEditUndo');
        await settled(0, 'UNDO of a SHIFT LINK');
        await key('Escape');
        await key('k');
        const bare = LINK_ROOM.entities.find((e) => !schema.entities[e.type]?.values?.some((v) => v.name === 'tset')
            && aloneInCell(LINK_ROOM, e));
        await clickCell(cellOf(bare));
        check(/cannot be wired/.test(await status()), `⛓ a <${bare.type}> refuses by name`, await status());
        check((await edit()).edits === 0, '⛓ …and edits nothing');
        await key('Escape');

        /* ══ 4. THE ROPE ═════════════════════════════════════════════ */
        await openLevel(ROPE_ROOM.level);
        const rope = ROPE_ROOM.entities[ROPE_INDEX];
        await key('n');
        check(await armed('node'), '⛓ `n` arms NODE');
        await clickCell(cellOf(rope));
        const end = cellOf(rope).tx + 2;
        await clickCell({ tx: end, ty: cellOf(rope).ty + 1 });
        await settled(1, 'a NODE');
        const nodeOp = ropeEndOp(ROPE_ROOM, ROPE_INDEX, end, O);
        check(json((await edit()).level) === json(fold(ROPE_ROOM, [nodeOp])),
            '⛓⛓ the rope\'s end equals node\'s fold, on its own row whatever row was clicked',
            json((await edit()).level.entities[ROPE_INDEX].nodes));
        await shot('4-rope-end');
        await key('Control+z');
        await settled(0, 'UNDO of a NODE');
        await key('Control+Shift+Z');
        await settled(1, 'REDO of a NODE');
        await key('Control+z');
        await settled(0, 'UNDO of a NODE, again');
        await clickCell({ tx: cellOf(rope).tx - 1, ty: cellOf(rope).ty });
        check(/to the RIGHT of its pulley/.test(await status()), '⛓ left of the pulley refuses by name', await status());
        check((await edit()).edits === 0, '⛓ …and edits nothing');
        await key('Escape');

        /* ══ 5. THE ISSUES ═══════════════════════════════════════════ */
        await openLevel(LINK_ROOM.level);
        await page.selectOption('#genEditTool', 'remove');
        await clickCell(cellOf(PUB));
        await settled(1, 'a REMOVE of the publisher');
        const issues = await page.$$eval('#genEditLinkIssues li', (l) => l.map((x) => x.textContent));
        check(issues.some((t) => /has no publisher in this room/.test(t)), '⛓ removing the publisher names what it orphans',
            json(issues));
        await shot('5-issues');
        await page.selectOption('#genEditTool', 'place');
        await page.fill('#genEditType', 'rope');
        await page.$eval('#genEditAttrs', (el) => { el.value = '{"tset":"0","tag":"0"}'; });
        const empty = await page.evaluate(() => {
            const r = window.__editorEdit.level;
            const has = new Set(r.entities.map((e) => `${Math.floor(e.x / 16)},${Math.floor(e.y / 16)}`));
            for (let y = 1; y < r.height - 1; y += 1) {
                for (let x = 1; x < r.width - 1; x += 1) if (!has.has(`${x},${y}`)) return { tx: x, ty: y };
            }
            return null;
        });
        await clickCell(empty);
        await settled(2, 'a PLACE of a rope with no node');
        const before = await page.evaluate(() => document.querySelectorAll('a[download]').length);
        await page.click('#editDownloadOel');
        check(/not saved.*has no <node>/.test(await status()), '⛓⛓ the OEL download refuses a rope with no node, by name',
            await status());
        check((await page.evaluate(() => document.querySelectorAll('a[download]').length)) === before, '⛓ …and writes nothing');
        const ship = await page.evaluate(() => window.__editorShipProbe?.());
        check(/has no <node>/.test(ship?.error ?? ''), '⛓⛓ ▶ load refuses it by the same sentence', json(ship?.error ?? ship));
        await shot('5-rope-no-node');
        await openLevel(CROSS_ROOM.level);
        const crossNotes = await page.$$eval('#genEditLinkIssues li', (l) => l.map((x) => x.textContent));
        check(crossNotes.some((t) => /does not see <buttonroom>.*it solves one room/.test(t)),
            `⛓ L${CROSS_ROOM.level}: a cross-room button is named as something SOLVE cannot see`, json(crossNotes));

        /* ══ 6. SOLVE ═════════════════════════════════════════════════ */
        await openLevel(LINK_ROOM.level);
        check((await edit()).certified !== true, '⛓ a fresh room is not certified');
        await key('k');
        await clickCell(cellOf(PUB));
        await clickCell(cellOf(OTHER));
        await settled(1, 'a LINK before SOLVE');
        check((await edit()).certified !== true, '⛓ a link edit leaves the room uncertified, as any edit does');

        check(errors.length === 0, '⛓ the page threw nothing', errors.join(' | '));
    } finally {
        await finish();
    }
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    process.exit(failed === 0 ? 0 : 1);
}

if (isEntryPoint(import.meta.url)) await main();
