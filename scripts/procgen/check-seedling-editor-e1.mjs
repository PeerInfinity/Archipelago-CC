#!/usr/bin/env node
/**
 * check-seedling-editor-e1 — **SEEDLING EDITOR E1, IN A REAL BROWSER**: the everyday-editing tools on
 * `watch.html?source=edit`, plus REDO on the maze lab's EDIT arm (the shared `editorView` reaching both).
 *
 * Every value claim is against node's own fold of the same ops through the same adapter (`editCore` +
 * `createSeedlingEditAdapter`), never against the page's echo:
 *
 *   1. **THE TILE-ART PALETTE** — `#genEditTileArt` holds one chip per column of the layer, each drawn from the
 *      art sheets (`data-art`) once `__labArt` is ready, with ink that differs between chips; a chip click sets the
 *      terrain `<select>`; `?art=off` makes every chip its swatch (`data-fallback`).
 *   2. **REDO** — paint, UNDO, then `Ctrl+Shift+Z` brings the edit back and the record equals node's fold; `Ctrl+Y`
 *      after a second undo does the same; a NEW edit after an undo leaves nothing to redo (`#genEditRedo` disabled).
 *   3. **FILL** (`l`) — two corners; ONE edit, a group, and the record equals node's `rectFillOps`.
 *   4. **REPLACE paste** — a cell holding two bodies, pasted over in REPLACE mode with a one-body clip, holds one;
 *      the ADD mode still accumulates.
 *   5. **CLEAR** (`x`) — `entities only` empties the bodies of a rectangle and leaves its terrain.
 *   6. **MOVE** (`m`) — the RECT selection is cut and pasted as ONE edit; the source is empty, the destination
 *      holds it, one UNDO restores the record byte for byte; a second MOVE of the same selection refuses by name.
 *   7. **THE BODY PICKER** — an ATTRS click on a two-body cell writes the BARE op (the last body) and lists the
 *      cell's bodies in `#genEditWhich`; picking body 0 and clicking again writes `which: 0`.
 *   8. **SOLVE IN EDIT** — L10: the goal list is the room's own (its sword, its two exits refused by name); SOLVE
 *      certifies with a tape and ▶ load's builder ships it (`__editorShipProbe` → a non-empty tape); an edit
 *      un-certifies; a goal-less room refuses by name and certifies nothing.
 *   9. **THE MAZE LAB's EDIT ARM** — `#labRedo` and `Ctrl+Shift+Z` bring an undone edit back; `#labTools` still
 *      holds exactly the view's own rows.
 *
 * `--shots=<dir>` writes one screenshot per tool. Brings its own server (`serveRepoRoot`) unless `--host=`.
 *
 *   node scripts/procgen/check-seedling-editor-e1.mjs [--host=http://localhost:8000] [--shots=<dir>]
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
    takeBoxLockOrExit({ name: 'check-seedling-editor-e1.mjs', kind: 'browser' });
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
    const SHOTS = arg('shots', '');
    if (SHOTS) mkdirSync(SHOTS, { recursive: true });

    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { createEditSession, foldEdits, rectFillOps, resolveBase } = await M('procgenCore/editCore.js');
    const { createSeedlingEditAdapter } = await M('seedlingDemo/seedlingEditAdapter.js');
    const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
    const { parseOelLevel } = await M('seedlingDemo/procgenLevelOel.js');
    const { LAYER_COLUMNS, emptyLevel } = await M('seedlingDemo/procgenLevel.js');
    const { applyEdit } = await M('seedlingDemo/watchEdit.js');
    const { recordToOel } = await M('seedlingDemo/procgenLevelOel.js');
    const ATLAS = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const VANILLA = JSON.parse(readFileSync(
        join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), 'utf8'));
    const adapter = createSeedlingEditAdapter({
        schema: null, levelSource: levelSourceFromAtlas(ATLAS), vanillaSetId: VANILLA.set_id, parseOel: parseOelLevel,
    });

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

    /* ── the EDIT arm's helpers ─────────────────────────────────────── */

    const edit = () => page.evaluate(() => window.__editorEdit);
    const settled = async (n, what) => {
        await page.waitForFunction((k) => window.__editorEdit && window.__editorEdit.edits >= k, n,
            { timeout: 60000 });
        const got = (await edit()).edits;
        check(got === n, `⛓ ${what}: the arm settled at EXACTLY ${n} edit(s)`, String(got));
    };
    const openLevel = async (level, extra = '') => {
        await page.goto(`${origin}/frontend/modules/seedlingDemo/watch.html?source=edit&level=${level}${extra}`,
            { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__editorEdit?.status === 'ok', null, { timeout: 120000 });
    };
    const clickCell = async ({ tx, ty }) => {
        const g = await page.evaluate(() => {
            document.getElementById('canvas').scrollIntoView({ block: 'center' });
            const r = document.getElementById('canvas').getBoundingClientRect();
            const lv = window.__editorEdit.level;
            return { left: r.left, top: r.top, width: r.width, height: r.height, cols: lv.width, rows: lv.height };
        });
        // ⛓ this file's own arithmetic, the cell's middle
        await page.mouse.click(g.left + ((tx + 0.5) * g.width) / g.cols, g.top + ((ty + 0.5) * g.height) / g.rows);
    };
    const mode = (m) => page.selectOption('#genEditTool', m);
    /** ⛓ the attrs box SET, not typed: a type change rewrites it from the typed form, and a `fill` racing that
     *  rewrite appends — the box is set after the type, the way a reader edits it last. */
    const setAttrs = (v) => page.$eval('#genEditAttrs', (el, x) => { el.value = x; }, v);
    const key = async (k) => {
        await page.evaluate(() => document.activeElement?.blur?.());
        await page.keyboard.press(k);
    };
    const nodeFold = (base, ops) => foldEdits(adapter, base, ops).record;
    const cellOf = (rec, tx, ty) => adapter.readCell(rec, tx, ty);

    try {
        /* ══ 1. THE TILE-ART PALETTE ══════════════════════════════════ */
        const LEVEL = 14;
        const base = resolveBase(adapter, { kind: 'atlas', set_id: VANILLA.set_id, level: LEVEL });
        await openLevel(LEVEL);
        await page.waitForFunction(() => ['ready', 'failed'].includes(window.__labArt?.status), null,
            { timeout: 60000 });
        await page.waitForFunction(() => document.querySelector('#genEditTileArt canvas[data-art]'), null,
            { timeout: 30000 }).catch(() => {});
        const chips = await page.evaluate(() => [...document.querySelectorAll('#genEditTileArt canvas')].map((c) => {
            const d = c.getContext('2d').getImageData(0, 0, 16, 16).data;
            let h = 0;
            for (let i = 0; i < d.length; i += 1) h = (h * 31 + d[i]) >>> 0;
            return { column: Number(c.dataset.column), art: c.dataset.art === '1', fallback: c.dataset.fallback ?? null, h };
        }));
        check((await page.evaluate(() => window.__labArt?.status)) === 'ready', '⛓ the lab art loaded (the palette\'s source)');
        check(json(chips.map((c) => c.column)) === json([...Array(LAYER_COLUMNS.tiles).keys()]),
            '⛓ #genEditTileArt holds ONE chip per column of the `tiles` layer, in column order',
            `${chips.length} chips vs ${LAYER_COLUMNS.tiles} columns`);
        check(chips.every((c) => c.art), '⛓⛓ every chip is drawn from the ART sheets (data-art), none fell back',
            json(chips.filter((c) => !c.art).map((c) => c.column)));
        check(new Set(chips.map((c) => c.h)).size > chips.length / 2,
            '⛓ …and the chips are different PICTURES (more than half distinct), not one image repeated',
            `${new Set(chips.map((c) => c.h)).size} distinct of ${chips.length}`);
        await page.click('#genEditTileArt canvas[data-column="13"]');
        check((await page.inputValue('#genEditTerrain')) === 'column:13',
            '⛓ a chip click SETS the terrain <select> (the one value the op is built from)',
            await page.inputValue('#genEditTerrain'));
        await page.selectOption('#genEditLayer', 'cliffsides');
        const cliffChips = await page.$$eval('#genEditTileArt canvas', (cs) => cs.map((c) => c.dataset.art === '1'));
        check(cliffChips.length === LAYER_COLUMNS.cliffsides && cliffChips.every(Boolean),
            '⛓ the `cliffsides` layer refills the palette with its pixelmasks, from the art', json(cliffChips));
        await page.selectOption('#genEditLayer', 'tiles');
        await shot('1-tile-art-palette');

        /* ══ 2. REDO ═════════════════════════════════════════════════ */
        await page.click('#genEditTileArt canvas[data-column="3"]');
        await mode('paint');
        const P1 = { tx: 2, ty: 2 };
        await clickCell(P1);
        await settled(1, 'a PAINT');
        const afterPaint = (await edit()).level;
        await page.click('#genEditUndo');
        await settled(0, 'UNDO');
        check((await page.isDisabled('#genEditRedo')) === false, '⛓ after an UNDO, #genEditRedo is live');
        await key('Control+Shift+Z');
        await settled(1, 'Ctrl+Shift+Z');
        check(json((await edit()).level) === json(afterPaint),
            '⛓⛓ REDO (Ctrl+Shift+Z) restores the record BYTE for BYTE', '');
        check(json((await edit()).level) === json(nodeFold(base, (await edit()).editList)),
            '⛓ …and it is node\'s fold of the page\'s own op list');
        await key('Control+z');
        await settled(0, 'Ctrl+Z');
        await key('Control+y');
        await settled(1, 'Ctrl+Y');
        await key('Control+z');
        await settled(0, 'Ctrl+Z again');
        await clickCell({ tx: 3, ty: 2 });
        await settled(1, 'a NEW edit after an undo');
        check((await page.isDisabled('#genEditRedo')) && (await edit()).redo === 0,
            '⛓⛓ a NEW edit after an undo clears the redo list (button disabled, redo 0)', String((await edit()).redo));
        await shot('2-redo');

        /* ══ 3. FILL ═════════════════════════════════════════════════ */
        await key('l');
        const F = { x: 1, y: 3, w: 3, h: 2 };
        await clickCell({ tx: F.x, ty: F.y });
        await clickCell({ tx: F.x + F.w - 1, ty: F.y + F.h - 1 });
        await settled(2, 'FILL');
        const e3 = await edit();
        check(e3.editList[1].op === 'group' && e3.editList[1].ops.length === F.w * F.h,
            `⛓ FILL is ONE group of ${F.w}x${F.h} writes`, `${e3.editList[1].op} × ${e3.editList[1].ops?.length}`);
        const before3 = nodeFold(base, e3.editList.slice(0, 1));
        const nodeFill = rectFillOps(adapter, before3, F, { tile: { column: 3 } });
        check(json(e3.editList[1].ops) === json(nodeFill.ops.map((o) => ({ op: 'paint', tx: o.tx, ty: o.ty, column: 3 }))),
            '⛓⛓ …and its writes are node\'s `rectFillOps` of the same rectangle and column');
        await shot('3-fill');
        /**
         * ⛓ …and FLOOD with a terrain NAME selected (`wall`, the chip above): it used to THROW
         * (`columnOfSpec` was handed `{terrain}` instead of the name) and the arm's mode select reset
         * left it no target at all. MUTANT: revert either fix — this click applies nothing.
         */
        await key('f');
        await clickCell({ tx: 5, ty: 5 });
        await settled(3, 'FLOOD with a terrain name');
        check((await edit()).editList[2].op === 'group' && /^flood /.test((await edit()).editList[2].label),
            '⛓⛓ FLOOD with a terrain NAME selected lands as one group (it threw before E1)',
            (await edit()).editList[2].label);

        /* ══ 4/7. REPLACE paste and the BODY PICKER on a two-body cell ═══ */
        await openLevel(LEVEL);
        const base4 = base;
        const free = (() => {
            for (let ty = 1; ty < base.height - 1; ty += 1) {
                for (let tx = 1; tx < base.width - 2; tx += 1) {
                    if ([0, 1].every((d) => cellOf(base, tx + d, ty).entities.length === 0)) return { tx, ty };
                }
            }
            return null;
        })();
        check(free !== null, '⛓ a free cell pair exists in L14 (the subject, derived)', json(free));
        const D = free;                                   // the two-body cell
        const S1 = { tx: free.tx + 1, ty: free.ty };      // the one-body cell
        await mode('place');
        await page.fill('#genEditType', 'lock');
        await setAttrs('{"tset":"0"}');
        await clickCell(D);
        await settled(1, 'place lock');
        await page.fill('#genEditType', 'button');
        await clickCell(D);
        await settled(2, 'place button');
        await page.fill('#genEditType', 'pushableblock');
        await setAttrs('{}');
        await clickCell(S1);
        await settled(3, 'place pushableblock');
        // 7 — the picker
        await mode('attrs');
        await setAttrs('{"tset":"4"}');
        await clickCell(D);
        await settled(4, 'ATTRS (bare)');
        const opts = await page.$$eval('#genEditWhich option', (os) => os.map((o) => o.value));
        check(!('which' in (await edit()).editList[3]) && json(opts) === json(['', '0', '1']),
            '⛓⛓ an ATTRS click on a two-body cell writes the BARE op and lists the cell\'s bodies in #genEditWhich',
            `${json((await edit()).editList[3])} · ${json(opts)}`);
        await page.selectOption('#genEditWhich', '0');
        await setAttrs('{"tset":"9"}');
        await clickCell(D);
        await settled(5, 'ATTRS which 0');
        const e7 = await edit();
        check(e7.editList[4].which === 0
            && json(cellOf(e7.level, D.tx, D.ty).entities.map((x) => x.attrs.tset)) === json(['9', '4']),
            '⛓⛓ …picking body 0 and clicking again writes `which: 0` and rewrites THAT body',
            json(cellOf(e7.level, D.tx, D.ty).entities));
        await shot('7-body-picker');
        // 4 — replace paste
        await mode('off');
        await key('r');
        await clickCell(S1);
        await clickCell(S1);
        await page.selectOption('#genEditPasteOnly', 'entities');
        await page.selectOption('#genEditPasteMode', 'replace');
        await key('p');
        await clickCell(D);
        await settled(6, 'REPLACE paste');
        const e4 = await edit();
        check(json(cellOf(e4.level, D.tx, D.ty).entities.map((x) => x.type)) === json(['pushableblock']),
            '⛓⛓ a REPLACE paste leaves the destination holding EXACTLY the clip\'s body',
            json(cellOf(e4.level, D.tx, D.ty).entities.map((x) => x.type)));
        check(json(e4.level) === json(nodeFold(base4, e4.editList)), '⛓ …and the record is node\'s fold');
        await page.selectOption('#genEditPasteMode', 'add');
        await clickCell(D);
        await settled(7, 'ADD paste');
        check(cellOf((await edit()).level, D.tx, D.ty).entities.length === 2,
            '⛓ …while the ADD mode still accumulates (the default every payload so far used)');
        await shot('4-replace-paste');

        /* ══ 5. CLEAR ════════════════════════════════════════════════ */
        await page.selectOption('#genEditClearWhat', 'entities');
        await key('x');
        await clickCell(D);
        await clickCell(S1);
        await settled(8, 'CLEAR entities');
        const e5 = await edit();
        check([D, S1].every((c) => cellOf(e5.level, c.tx, c.ty).entities.length === 0)
            && [D, S1].every((c) => json(cellOf(e5.level, c.tx, c.ty).tile) === json(cellOf(base, c.tx, c.ty).tile)),
            '⛓⛓ CLEAR (entities only) empties the bodies and leaves the terrain', '');
        await shot('5-clear');

        /* ══ 6. MOVE ═════════════════════════════════════════════════ */
        await mode('place');
        await page.fill('#genEditType', 'pushableblock');
        await clickCell(D);
        await settled(9, 'place for MOVE');
        await mode('off');
        await page.selectOption('#genEditPasteOnly', 'entities');
        await key('r');
        await clickCell(D);
        await clickCell(D);
        const beforeMove = (await edit()).level;
        await key('m');
        const T = { tx: D.tx, ty: D.ty + 1 };
        await clickCell(T);
        await settled(10, 'MOVE');
        const e6 = await edit();
        check(e6.editList[9].op === 'group' && /^move /.test(e6.editList[9].label),
            '⛓ MOVE is ONE group', e6.editList[9].label);
        check(cellOf(e6.level, D.tx, D.ty).entities.length === 0
            && json(cellOf(e6.level, T.tx, T.ty).entities.map((x) => x.type)).includes('pushableblock'),
            '⛓⛓ the source is EMPTY and the destination holds the body',
            `${json(cellOf(e6.level, D.tx, D.ty).entities)} → ${json(cellOf(e6.level, T.tx, T.ty).entities)}`);
        await shot('6-move');
        await clickCell({ tx: T.tx, ty: T.ty });
        const st = await page.textContent('#status');
        check(/already MOVED/.test(st) && (await edit()).edits === 10,
            '⛔ a second MOVE of the same selection refuses BY NAME and applies nothing', st.slice(0, 90));
        await page.click('#genEditUndo');
        await settled(9, 'UNDO the MOVE');
        check(json((await edit()).level) === json(beforeMove), '⛓ ONE undo puts the whole move back, byte for byte');

        /* ══ 8. SOLVE IN EDIT ════════════════════════════════════════ */
        await openLevel(10);
        const goals = await page.$$eval('#editSolveGoal option', (os) => os.map((o) => ({ v: o.value, t: o.textContent })));
        check(goals[0]?.v === 'collect@48,48' && goals.filter((g) => /refused/.test(g.t)).length === goals.length - 1,
            '⛓ L10\'s goal list is the room\'s own: its sword first, every exit leading OUT refused by name',
            json(goals.map((g) => g.v)));
        await page.click('#genEditSolve');
        await page.waitForFunction(() => window.__editorEdit?.solve, null, { timeout: 120000 });
        const s8 = await edit();
        check(s8.solve.verdict === 'SOLVED' && s8.certified === true && s8.solve.tape,
            '⛓⛓⛓ SOLVE certifies the room through the oracle, with a tape', json(s8.solve));
        const ship = await page.evaluate(() => {
            const b = window.__editorShipProbe?.();
            return b ? { presses: (b.tape?.presses ?? b.tape?.inputs ?? []).length, expect: Boolean(b.expect),
                error: b.error ?? null, label: b.label } : null;
        });
        /**
         * ⚠ A VANILLA room's exits lead out of a ONE-room set, and the sender's validation refuses that set by
         * name — for the zero-input ship as much as for this one (pre-E1, unchanged). The tape ship is proven
         * on a pasted room below.
         */
        check(ship && /out of range for this set/.test(ship.error ?? ''),
            '⚠ L10\'s one-room ship is refused BY THE SENDER\'s validation (its exits leave the set) — the same '
            + 'bound the zero-tape ship already had', (ship?.error ?? json(ship)).slice(0, 100));
        await shot('8-solve-certified');
        await page.click('#genEditTileArt canvas[data-column="13"]');
        await mode('paint');
        await clickCell({ tx: 3, ty: 4 });
        await settled(1, 'an edit after SOLVE');
        check((await edit()).certified === null && (await edit()).solve.current === false,
            '⛓ an edit makes the room UNCERTIFIED again (the solve is about the old record)');
        // a goal-less room: clear every body of a fresh L10
        await openLevel(10);
        await page.selectOption('#genEditClearWhat', 'entities');
        await key('x');
        const lv10 = (await edit()).level;
        await clickCell({ tx: 0, ty: 0 });
        await clickCell({ tx: lv10.width - 1, ty: lv10.height - 1 });
        await settled(1, 'CLEAR every body');
        await page.click('#genEditSolve');
        await page.waitForFunction(() => window.__editorEdit?.solve, null, { timeout: 60000 });
        const s8b = await edit();
        check(/NO GOAL/.test(s8b.solve.refusedByPage ?? '') && s8b.certified !== true,
            '⛔ a goal-less room REFUSES by name and certifies nothing', (s8b.solve.refusedByPage ?? '').slice(0, 80));
        await shot('8-solve-refused');

        // a PASTED room (no exits): SOLVE → the ship carries the certification tape
        const pasted = applyEdit(emptyLevel({ level: 1, width: 9, height: 9 }),
            { op: 'place', tx: 5, ty: 5, type: 'sword', attrs: {} });
        await openLevel(10);
        await page.fill('#editLoad', recordToOel(pasted));
        await page.click('#editLoadGo');
        await page.waitForFunction(() => window.__editorEdit?.baseKind === 'oel', null, { timeout: 60000 });
        await page.click('#genEditSolve');
        await page.waitForFunction(() => window.__editorEdit?.solve, null, { timeout: 120000 });
        const shipP = await page.evaluate(() => {
            const b = window.__editorShipProbe?.();
            return b ? { presses: (b.tape?.inputs ?? []).length, ticks: b.tape?.tick_count ?? null, expect: Boolean(b.expect), error: b.error ?? null,
                label: b.label } : null;
        });
        check((await edit()).solve.verdict === 'SOLVED' && shipP && !shipP.error && shipP.presses > 0 && shipP.expect,
            '⛓⛓⛓ a PASTED room SOLVES, and ▶ load ships it WITH the certification tape and the model\'s end state',
            json(shipP));
        await shot('8-solve-pasted-ship');

        /* ══ 8b. GENERATE's host: REDO in the other arm of the same panel ═══ */
        /**
         * ⛓ The panel is shared, so GENERATE's host carries a redo too. MEASURED by the first E1 run of
         * `check-seedling-editor-arm`: a redo list declared below a hoisted reader killed the arm at boot (TDZ)
         * and THIS row did not visit GENERATE — so it does now.
         */
        await page.goto(`${origin}/frontend/modules/seedlingDemo/watch.html?source=generate&seed=4&count=2&run=1`,
            { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__editorGenerate?.status === 'ok'
            && !document.getElementById('genRunAll').disabled, null, { timeout: 300000 });
        const gen = () => page.evaluate(() => window.__editorGenerate);
        const gsize = (await gen()).identity.match(/size=(\d+)x(\d+)/).slice(1).map(Number);
        const gclick = async (tx, ty) => {
            const r = await page.evaluate(() => {
                document.getElementById('canvas').scrollIntoView({ block: 'center' });
                const b = document.getElementById('canvas').getBoundingClientRect();
                return { l: b.left, t: b.top, w: b.width, h: b.height };
            });
            await page.mouse.click(r.l + ((tx + 0.5) * r.w) / gsize[0], r.t + ((ty + 0.5) * r.h) / gsize[1]);
        };
        await page.click('#genEditTileArt canvas[data-column="13"]');
        await mode('paint');
        await gclick(2, 2);
        await page.waitForFunction(() => window.__editorGenerate?.edits === 1
            && !document.getElementById('genEditUndo').disabled, null, { timeout: 120000 });
        const gOne = json((await gen()).editList);
        await page.click('#genEditUndo');
        await page.waitForFunction(() => window.__editorGenerate?.edits === 0
            && !document.getElementById('genEditRedo').disabled, null, { timeout: 120000 });
        await page.click('#genEditRedo');
        await page.waitForFunction(() => window.__editorGenerate?.edits === 1, null, { timeout: 120000 });
        check(json((await gen()).editList) === gOne,
            '⛓⛓ GENERATE\'s REDO brings the undone edit back, the same op', gOne.slice(0, 80));
        await shot('8b-generate-redo');

        /* ══ 9. THE MAZE LAB ═════════════════════════════════════════ */
        await page.goto(`${origin}/frontend/modules/mazeRoom/lab.html?seed=7&width=9&height=9&count=0&source=edit`,
            { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__mazeLab?.source === 'edit', null, { timeout: 120000 });
        const tools = await page.$$eval('#labTools button', (bs) => bs.map((b) => b.dataset.tool));
        // ⛓ Maze editor tools (B2): the maze lab now names editorView's FILL / CLEAR / MOVE too
        //   (`mazeRoom/mazeEditTools.js`); REDO still has its own button, not a row here.
        check(json(tools) === json(['brush', 'rect', 'paste', 'flood', 'fill', 'clear', 'move', 'escape']),
            '⛓ the maze\'s #labTools still holds exactly the view\'s own rows (REDO is its own button)', json(tools));
        await page.click('#labPalette button[data-type="wall"]');
        const geo = await page.evaluate(() => {
            const r = document.getElementById('canvas').getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
        await page.mouse.click(geo.x + (2.5 * geo.w) / 9, geo.y + (3.5 * geo.h) / 9);
        await page.waitForFunction(() => window.__mazeLab?.edits === 1, null, { timeout: 30000 });
        const mazeOne = await page.evaluate(() => JSON.stringify(window.__mazeLab.level));
        await page.click('#labUndo');
        await page.waitForFunction(() => window.__mazeLab?.edits === 0, null, { timeout: 30000 });
        await page.click('#labRedo');
        await page.waitForFunction(() => window.__mazeLab?.edits === 1, null, { timeout: 30000 }).catch(() => {});
        check((await page.evaluate(() => JSON.stringify(window.__mazeLab.level))) === mazeOne,
            '⛓⛓ the maze lab\'s #labRedo restores the undone edit byte for byte (the shared core\'s redo)');
        await page.click('#labUndo');
        await page.waitForFunction(() => window.__mazeLab?.edits === 0, null, { timeout: 30000 });
        await key('Control+Shift+Z');
        await page.waitForFunction(() => window.__mazeLab?.edits === 1, null, { timeout: 30000 }).catch(() => {});
        check((await page.evaluate(() => window.__mazeLab.edits)) === 1,
            '⛓ …and Ctrl+Shift+Z reaches it too (the view\'s REDO_COMMAND_ID row)');
        await shot('9-maze-redo');

        check(errors.length === 0, '⛔ no page error in any of the above', json(errors.slice(0, 3)));
    } catch (e) {
        check(false, `the row itself threw: ${e.message}`);
    } finally {
        await finish();
    }
    console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}

if (isEntryPoint(import.meta.url)) await main();
