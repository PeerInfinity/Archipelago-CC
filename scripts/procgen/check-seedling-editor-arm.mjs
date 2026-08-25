#!/usr/bin/env node
/**
 * check-seedling-editor-arm — **THE FIFTH SOURCE, `?source=edit`.**
 *
 * EDITOR v3 slice C1 (`NewDocs/plans/seedling-editor-v3.md` §3.1, §3.2, §3.4,
 * §3.5). Free editing used to be a `<details>` nested inside `#generatePanel`
 * with every handler a closure in `runGenerate`; it is a panel of its own now,
 * shown for BOTH arms, over `procgenCore/editorView.js` and one adapter. This
 * row is about the half that did not exist before: **a room with no ladder.**
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP ─────────────────────
 *
 * `serveRepoRoot` on a free port, shut down on every path, no skip condition
 * (trap 176). `--host=` reuses an existing server, which is a convenience and
 * not an escape.
 *
 * ── ⛓ WHY IT IS ITS OWN ROW AND NOT MORE OF `-edit` ───────────────────
 *
 * `check-seedling-editor-edit.mjs` is 71 checks about editing a level the LOOP
 * produced — every one of its anchors is `generateWithDirectives({seed, biome,
 * step, edits})` in node. Nothing here has a seed. The anchors are the ATLAS's
 * committed bytes and the adapter's own fold, and three of the claims
 * deliberately leave the page holding a room the JS model REFUSES TO BUILD,
 * which that row's helpers would never wait for.
 *
 * ── THE CLAIMS ────────────────────────────────────────────────────────
 *
 *  1. **THE ARM BOOTS ON AN ATLAS BASE** — `?source=edit&level=14` draws a
 *     still frame, the identity line names the base AND its content hash, and
 *     the URL is what was asked for.
 *  2. **PAINT · PLACE · UNDO** — each op lands, and the record after them is
 *     BYTE-IDENTICAL to node's own fold of the same list through the same
 *     adapter.
 *  3. **⚖ RULING 3's BOUND** — a DECLARED type the JS model does not
 *     transcribe places for real, the bound is shown naming it, and the page
 *     survives the engine's refusal instead of going blank.
 *  4. **RECT + PASTE with a FILTER**, and §11.9 bound 1's accumulation
 *     sentence said BEFORE the paste lands.
 *  5. **A PAYLOAD ROUND TRIP** — what the page downloads, loaded back through
 *     the LOAD box, reproduces the same record and the same payload BYTE for
 *     BYTE.
 *  6. **⚖ RULING 2 — A WRONG `set_id` REFUSES BY NAME**, and the room the
 *     reader was editing is still on screen.
 *  7. **A `generate` BASE IS REFUSED BY NAME IN THIS ARM** (§3.2: the ladder
 *     owns that identity), and a level SET is refused as the level-set arm's.
 *  8. **"OPEN IN EDITOR" FROM GENERATE** carries the record and the edit count,
 *     without a reload and without putting one edit in the URL.
 *  9. **THE CLI SCREENSHOTS IT** — `export-seedling-view.mjs --source=edit
 *     --level=14 --tick=0` writes a PNG, and says `?tick=` names nothing here.
 * 10. **⛔ NO EDIT REACHES A URL**, in either arm, ever.
 *
 * Run: node scripts/procgen/check-seedling-editor-arm.mjs
 *      node scripts/procgen/check-seedling-editor-arm.mjs --host=http://localhost:8000
 */

import { chromium } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { createSeedlingEditAdapter } = await M('seedlingEditAdapter.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { ENTITY_CLASSES } = await M('levelWorld.js');
const { untranscribedTypes } = await M('watchEdit.js');
const { DEFAULT_PLACE_TYPE } = await M('watchEditor.js');
const { parseOelLevel } = await M('procgenLevelOel.js');
const { columnOfSpec } = await M('procgenLevel.js');
const { foldEdits, resolveBase } = await import(
    join(REPO, 'frontend/modules/procgenCore/editCore.js'));

const PAGE_PATH = '/frontend/modules/seedlingDemo/watch.html';
const ATLAS = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const VANILLA = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), 'utf8'));

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};
const json = (v) => JSON.stringify(v);

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ NODE'S OWN ANSWERS FIRST (trap 269) — every value claim below is
 * against a fold this file performed, never against the page's echo.
 * ══════════════════════════════════════════════════════════════════════ */

const adapter = createSeedlingEditAdapter({
    schema: null,
    levelSource: levelSourceFromAtlas(ATLAS),
    vanillaSetId: VANILLA.set_id,
    parseOel: parseOelLevel,
});

const LEVEL = 14;
const BASE_TAG = { kind: 'atlas', set_id: VANILLA.set_id, level: LEVEL };
const baseRecord = resolveBase(adapter, BASE_TAG);

/**
 * ⛓⛓⛓ **THE SUBJECTS, ALL DERIVED — trap 574's shape and §11.5 item 4's.**
 *
 * ⛔⛔ **THE BRIEF NAMED `bob` AS THE TYPE THAT WOULD RAISE THE TRANSCRIBE
 * BOUND, AND IT DOES NOT.** *Not one of `procgenPalette`'s five* and *not in
 * `levelWorld.ENTITY_CLASSES`* are two different sets; `bob` is in the first
 * and not the second. Both are needed and both are computed here:
 *
 *   `WIDE_ONLY`      offered only by the wide roster, and TRANSCRIBED — the
 *                    place must simply work.
 *   `UNTRANSCRIBED`  DECLARED by `Shrum.oep` and NOT transcribed — ⚖ ruling 3.
 *
 * ⛔ AND THE CELLS ARE MEASURED, not chosen (trap 235): the PAINT cell must
 * not already hold the terrain being painted, or the click is a NO-OP by law
 * (b) and the row hangs on a count that never advances rather than failing a
 * claim (the hang `-edit.mjs` paid for once, written down here so it is not
 * paid twice).
 */
const SCHEMA = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-ogmo-schema.json'), 'utf8'));
const DECLARED = Object.keys(SCHEMA.entities);
const UNTRANSCRIBED_ALL = DECLARED.filter((t) => !ENTITY_CLASSES[t]);
const NARROW = new Set((await M('watchEdit.js')).ENTITY_ROSTER_PROCGEN.map((e) => e.type));
const WIDE_ONLY = DECLARED.find((t) => !NARROW.has(t) && ENTITY_CLASSES[t]);
const UNTRANSCRIBED = UNTRANSCRIBED_ALL[0];

const cellOf = (record, tx, ty) => adapter.readCell(record, tx, ty);
/**
 * ⛔ **THE CELL IS PICKED AGAINST THE OP THE BROWSER WILL ACTUALLY BUILD, WHICH
 * IS A TERRAIN NAME.** The first cut derived a target COLUMN here and drove the
 * page's terrain `<select>` — two spellings of one paint, and they disagreed:
 * both records were valid folds of DIFFERENT ops and the byte comparison went
 * red for a reason that was this file's, not the page's. ⇒ node builds the same
 * `{terrain}` op the palette does, and the cell is one whose column is not
 * already that terrain's (trap 235: a subject that agrees with its target
 * cannot fail, and by law (b) the click would not even count as an edit).
 */
const PAINT_TERRAIN = 'ground';
const PAINT_COLUMN = columnOfSpec(PAINT_TERRAIN, 'tiles', 'check-seedling-editor-arm');
const pickPaintCell = () => {
    const b = adapter.bounds(baseRecord);
    for (let y = 1; y < b.h - 1; y += 1) {
        for (let x = 1; x < b.w - 1; x += 1) {
            const c = cellOf(baseRecord, x, y);
            if (c.tile && c.tile.column !== PAINT_COLUMN && c.entities.length === 0) {
                return { tx: x, ty: y, from: c.tile.column, to: PAINT_COLUMN };
            }
        }
    }
    return null;
};
const PAINT = pickPaintCell();
check(PAINT !== null,
    '⛔ the PAINT subject is a cell whose column DIFFERS from the one about to be written — '
    + 'a cell already holding it would make the click a NO-OP (law (b)) and hang the row on a '
    + 'count that never advances rather than failing a claim',
    json(PAINT));
/** An entity-free cell for PLACE, so the place is the only body there. */
const FREE = (() => {
    const b = adapter.bounds(baseRecord);
    for (let y = 1; y < b.h - 1; y += 1) {
        for (let x = 1; x < b.w - 1; x += 1) {
            if (cellOf(baseRecord, x, y).entities.length === 0 && (x !== PAINT?.tx || y !== PAINT?.ty)) {
                return { tx: x, ty: y };
            }
        }
    }
    return null;
})();
check(FREE !== null && WIDE_ONLY && UNTRANSCRIBED,
    '⛓ …and the three other subjects exist: an entity-free cell, a wide-roster-only '
    + 'TRANSCRIBED type, and a DECLARED UNTRANSCRIBED one',
    `${json(FREE)} · ${WIDE_ONLY} · ${UNTRANSCRIBED}`);
check(!NARROW.has(WIDE_ONLY) && Boolean(ENTITY_CLASSES[WIDE_ONLY]),
    `⛓ \`${WIDE_ONLY}\` really is outside the five and really IS transcribed, so claim 3's `
    + 'two halves are about two different sets and not one');
check(UNTRANSCRIBED_ALL.length > 0 && UNTRANSCRIBED_ALL.length < DECLARED.length,
    `⛓ …and the UNTRANSCRIBED set is neither empty nor everything — ${UNTRANSCRIBED_ALL.length} `
    + `of ${DECLARED.length} declared types`, UNTRANSCRIBED_ALL.join(' '));

const PAINT_OP = { op: 'paint', tx: PAINT.tx, ty: PAINT.ty, terrain: PAINT_TERRAIN };

/**
 * ⛓⛓⛓ **THE COPY RECTANGLE IS ONE NODE HAS PROVED CARRIES A BODY**, and that
 * is a mutant's finding rather than a precaution.
 *
 * ⛔ The first cut asked *"if the clip carries bodies, is the accumulation
 * sentence said"* — a CONDITIONAL, and the mutant that makes
 * `seedlingClipWarnings` return nothing makes its precondition FALSE, so the row
 * passed vacuously while asserting the bound's ABSENCE (trap 569's family: a
 * scan's own precondition can be unanswerable, and then its silence reads as a
 * verdict). ⇒ the rectangle is CHOSEN so the clip must carry a body, node says
 * how many, and the sentence is then required UNCONDITIONALLY.
 */
const COPY = (() => {
    const b = adapter.bounds(baseRecord);
    for (let y = 0; y < b.h - 1; y += 1) {
        for (let x = 0; x < b.w - 1; x += 1) {
            let bodies = 0;
            for (let dy = 0; dy < 2; dy += 1) {
                for (let dx = 0; dx < 2; dx += 1) {
                    bodies += cellOf(baseRecord, x + dx, y + dy).entities.length;
                }
            }
            if (bodies > 0) return { x, y, w: 2, h: 2, bodies };
        }
    }
    return null;
})();
check(COPY !== null && COPY.bodies > 0,
    '⛔ the COPY rectangle is one node has PROVED holds at least one body — a clip with none '
    + 'would make claim 4\'s accumulation sentence unaskable, and a row whose precondition '
    + 'is false passes while asserting the bound\'s ABSENCE (trap 569)',
    json(COPY));
/** A destination whose cells hold bodies too, so ACCUMULATION is the real risk. */
const PASTE_AT = (() => {
    const b = adapter.bounds(baseRecord);
    for (let y = 0; y < b.h - 1; y += 1) {
        for (let x = 0; x < b.w - 1; x += 1) {
            if (x === COPY.x && y === COPY.y) continue;
            if (cellOf(baseRecord, x, y).tile?.column !== cellOf(baseRecord, COPY.x, COPY.y).tile?.column) {
                return { tx: x, ty: y };
            }
        }
    }
    return null;
})();
check(PASTE_AT !== null,
    '⛓ …and the PASTE destination differs in its TILE from the clip\'s first cell, so a '
    + '`only: tile` paste there is a real change and not a no-op the fold would drop',
    json(PASTE_AT));
const PLACE_OP = { op: 'place', tx: FREE.tx, ty: FREE.ty, type: WIDE_ONLY, attrs: {} };
/**
 * ⛓ THE OP LIST THE BROWSER WILL BUILD, held as ONE value so the count in the
 * label below is INTERPOLATED off it — §11.7's linter cure, and the rule is
 * the same every time: a number typed into a name beside a `.length` in scope
 * is a claim nothing keeps in step.
 */
const NODE_OPS = [PAINT_OP, PLACE_OP];
const nodeAfterTwo = foldEdits(adapter, baseRecord, NODE_OPS).record;
const nodeAfterUndo = foldEdits(adapter, baseRecord, NODE_OPS.slice(0, -1)).record;
check(!adapter.equal(baseRecord, nodeAfterTwo) && !adapter.equal(nodeAfterTwo, nodeAfterUndo),
    '⛓ node\'s three records are three DIFFERENT records — a fold whose steps agreed would '
    + 'make claim 2 pass on a page that applied nothing');

/* ══════════════════════════════════════════════════════════════════════
 * THE BROWSER
 * ══════════════════════════════════════════════════════════════════════ */

let server = null;
const host = arg('host', '');
if (!host) server = await serveRepoRoot();
const origin = host || `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const OUT = mkdtempSync(join(tmpdir(), 'seedling-editor-arm-'));
const finish = async (code) => {
    await browser.close().catch(() => {});
    await closeServer(server);
    rmSync(OUT, { recursive: true, force: true });
    process.exit(code);
};

/**
 * ⛔ WAIT FOR THE PAGE TO STOP, NOT FOR IT TO START.
 *
 * ⛔⛔ **AND THE WAIT IS `>=`, WITH THE COUNT AS A CHECK** — A2 §10.8's second
 * defect, and this row measured it again. A wait for an EXACT count is one a
 * WRONG BUILD OVERSHOOTS: the mutant that leaves a second armed dispatch on the
 * canvas applies every click TWICE, so `=== 1` never becomes true and the row
 * dies on a 120 s timeout NAMING THE WAIT instead of failing the claim that
 * counts edits. `>=` lets the page settle and turns the overshoot back into a
 * value finding a reader can attribute.
 */
const settled = async (n) => {
    await page.waitForFunction(
        (k) => window.__editorEdit && window.__editorEdit.edits >= k, n, { timeout: 120000 });
    const got = await page.evaluate(() => window.__editorEdit.edits);
    check(got === n, `⛓ the arm settled at EXACTLY ${n} edit(s) — an overshoot here is a `
        + 'build applying a gesture more than once, and it is a VALUE failure rather than a '
        + 'wait that never returned', `${got}`);
};

const read = () => page.evaluate(() => ({
    edit: window.__editorEdit,
    url: window.location.search,
    base: document.getElementById('editBase').textContent,
    status: document.getElementById('status').textContent,
    clip: document.getElementById('editClipNote').textContent,
    bound: document.getElementById('genEditTranscribe').textContent,
    boundHidden: document.getElementById('genEditTranscribe').hidden,
    loadNote: document.getElementById('editLoadNote').textContent,
    rows: [...document.querySelectorAll('#genEdits .eRow')].map((e) => e.textContent),
}));

/**
 * ⛓⛓ THE CANVAS RECTANGLE IS RE-READ BEFORE **EVERY** CLICK and the target is
 * THIS FILE'S OWN ARITHMETIC over the LAST PIXEL of the cell — `-edit.mjs`'s
 * two lessons (§10.5's growing header, and trap 257's invisible off-by-one),
 * kept rather than re-learned. ⛔ Nothing here calls `tileAtPoint`.
 */
const clickCell = async (cell) => {
    const geo = await page.evaluate(() => {
        document.getElementById('canvas').scrollIntoView({ block: 'center' });
        const r = document.getElementById('canvas').getBoundingClientRect();
        const lv = window.__editorEdit.level;
        return {
            left: r.left, top: r.top, width: r.width, height: r.height,
            cols: lv.width, rows: lv.height,
        };
    });
    const x = ((cell.tx + 1) * geo.width) / geo.cols - 1;
    const y = ((cell.ty + 1) * geo.height) / geo.rows - 1;
    const landsOn = {
        tx: Math.floor((x * geo.cols) / geo.width),
        ty: Math.floor((y * geo.rows) / geo.height),
    };
    if (json(landsOn) !== json({ tx: cell.tx, ty: cell.ty })) {
        check(false, `⛔ this file's own arithmetic puts the click in ${json(landsOn)}, not `
            + `${json(cell)} — the geometry moved and the claim below would be about the `
            + 'wrong cell');
    }
    await page.mouse.click(geo.left + x, geo.top + y);
};

const load = async (search) => {
    await page.goto(`${origin}${PAGE_PATH}?${search}`, { waitUntil: 'domcontentloaded' });
    await settled(0);
};

try {
    /* ══ CLAIM 1 — the arm boots on an ATLAS base ═══════════════════ */

    await load(`source=edit&level=${LEVEL}`);
    const boot = await read();
    check(boot.edit.status === 'ok' && boot.edit.baseKind === 'atlas'
        && json(boot.edit.base) === json(BASE_TAG),
        '⛓⛓⛓ `?source=edit&level=14` BOOTS INTO THE FIFTH ARM on an ATLAS base, with the '
        + 'vanilla set\'s stamped `set_id` — READ off the committed set, never typed, so the '
        + 'hash check below is a real comparison', json(boot.edit.base));
    check(json(boot.edit.level) === json(baseRecord),
        '⛓⛓ …and the record on screen IS the atlas\'s committed bytes, byte for byte against '
        + 'node\'s own `resolveBase` — the anchor every claim below moves away from');
    check(boot.base.includes(VANILLA.set_id) && boot.base.includes('carries NO edits'),
        '⛓ the identity line names the base AND its content hash AND ⚖ ruling 9', boot.base);
    check(boot.edit.why === null,
        '⛔ …and the still frame DREW — a room that would not build says so here rather than '
        + 'going blank', json(boot.edit.why));
    const bootUrl = boot.url;
    check(/source=edit/.test(bootUrl) && !/edit(s|List)=/.test(bootUrl),
        '⛓ the URL is the launch parameters and nothing else', bootUrl);
    check(boot.edit.transcribe.length === 0 && boot.boundHidden !== false,
        '⛓ …and a vanilla room says NOTHING about transcription, so the bound cannot read as '
        + 'a standing warning');

    /* ══ CLAIM 2 — PAINT · PLACE · UNDO, against node's fold ════════ */

    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditTerrain', PAINT_TERRAIN);
    const paintCell = await page.evaluate(() => document.getElementById('genEditTerrain').value);
    check(paintCell === PAINT_TERRAIN, '⛓ the terrain picker is MOUNTED IN THIS ARM — it is filled '
        + 'by the shared section and not by the GENERATE arm, which is what an empty '
        + '`<select>` here would have proved otherwise', paintCell);
    await clickCell(PAINT);
    await settled(1);
    await page.selectOption('#genEditTool', 'place');
    await page.fill('#genEditType', WIDE_ONLY);
    await page.fill('#genEditAttrs', '{}');
    await clickCell(FREE);
    await settled(2);
    const two = await read();
    check(two.edit.edits === NODE_OPS.length && two.rows.length === NODE_OPS.length,
        `⛓ ${NODE_OPS.length} op(s), ${NODE_OPS.length} row(s) in the pane`,
        `${two.edit.edits} / ${two.rows.length}`);
    check(json(two.edit.level) === json(nodeAfterTwo),
        '⛓⛓⛓ **THE BROWSER\'S RECORD IS NODE\'S FOLD, BYTE FOR BYTE** — the same adapter, '
        + 'the same base, the same two ops. This is the cross-runtime claim, on a level with '
        + 'no ladder behind it');
    check(two.edit.certified === null,
        '⛔ …and an edit NEVER certifies itself');
    await page.click('#genEditUndo');
    await settled(1);
    const undone = await read();
    check(json(undone.edit.level) === json(nodeAfterUndo),
        '⛓⛓ UNDO IS THE FOLD OVER A SHORTER LIST — the record equals one that never had the '
        + 'popped op, byte for byte, which a stack could only promise if nothing else wrote '
        + 'the record');

    /* ══ CLAIM 3 — ⚖ RULING 3's BOUND ══════════════════════════════ */

    await page.selectOption('#genEditTool', 'place');
    await page.fill('#genEditType', UNTRANSCRIBED);
    await page.fill('#genEditAttrs', '{}');
    await clickCell(FREE);
    await settled(2);
    const untr = await read();
    check(json(untr.edit.transcribe) === json([UNTRANSCRIBED]),
        `⛔ ⚖ RULING 3: the edit is NEVER REFUSED — \`${UNTRANSCRIBED}\` is a body the GAME `
        + 'loads and the JS model does not, and the page takes it', json(untr.edit.transcribe));
    check(untr.boundHidden === false
        && untr.bound.includes(UNTRANSCRIBED)
        && /does not transcribe 1 type\(s\)/.test(untr.bound)
        && /load in wasm is the certifier/.test(untr.bound),
        '⛓⛓⛓ …and the BOUND IS DISPLAYED, naming the type and naming the certifier',
        untr.bound.slice(0, 110));
    check(/would not BUILD/.test(untr.status) && /LevelWorldError/.test(untr.status),
        '⛓⛓ …and the STILL FRAME could not be drawn, with the builder\'s own name — the '
        + 'throw is caught BY CLASS and becomes this arm\'s `why`, so a page that died '
        + 'between the change and the readout cannot report the change as never made',
        untr.status.slice(0, 90));
    check(untr.edit.status === 'refused' && untr.edit.edits === 2,
        '⛔ …and the ARM IS ALIVE with the edit still in it — the room still edits, still '
        + 'downloads and still ships', `${untr.edit.status} / ${untr.edit.edits}`);
    await page.click('#genEditUndo');
    await settled(1);
    check((await read()).edit.status === 'ok',
        '⛔⛔ THE PAGE SURVIVED THE ENGINE THROW — one UNDO later it draws again, which a '
        + 'fatal would have made unreachable');

    /* ══ CLAIM 4 — RECT + PASTE with a FILTER, and the bound SAID ═══ */

    await page.click('#editTool_rect');
    await clickCell({ tx: COPY.x, ty: COPY.y });
    await clickCell({ tx: COPY.x + COPY.w - 1, ty: COPY.y + COPY.h - 1 });
    const copied = await read();
    check(new RegExp(`copied ${COPY.w}x${COPY.h} at \\(${COPY.x},${COPY.y}\\)`).test(copied.status),
        '⛓ RECT copies a rectangle from two corner clicks', copied.status.slice(0, 60));
    /**
     * ⛔ UNCONDITIONAL, on a rectangle node has proved carries bodies — the
     * mutant that returns no warnings must have nowhere to hide.
     */
    check(/a paste ADDS them/.test(copied.status) && /§11\.9 bound 1/.test(copied.status),
        '⛓⛓⛓ §11.9 BOUND 1 IS SAID THE MOMENT THE CLIP EXISTS, and it is said UNCONDITIONALLY '
        + `— this clip provably carries ${COPY.bodies} body/bodies. A Seedling paste `
        + 'ACCUMULATES; the sentence is the PAGE\'s and `editorView` only guarantees it comes '
        + 'BEFORE the paste lands', copied.status.slice(0, 150));
    check(new RegExp(`carries ${COPY.bodies} body`).test(copied.clip),
        '⛓⛓ …and the CLIPBOARD note counts the bodies node counted, so the sentence is a '
        + 'MEASUREMENT of this clip and not a standing warning printed for every copy',
        copied.clip.slice(0, 120));
    await page.selectOption('#editPasteOnly', 'tile');
    await page.click('#editTool_paste');
    const beforePaste = (await read()).edit.edits;
    /**
     * ⛔⛔ **AN ORDERING CANNOT BE READ OFF THE END STATE**, and this row learned
     * it the way rows do: the first cut read `#status` AFTER the paste and
     * asserted the warning was in it. It is not — `applyOp`'s own description
     * (*"paste tile 2x2 at (1,1) (4 op(s))"*) is the LAST thing written, which
     * is correct, and the warning was written a moment earlier. A2 §10.2
     * departure 2's whole claim is that the view guarantees the sentence comes
     * BEFORE rather than after, and BEFORE is a fact about a SEQUENCE. ⇒ the
     * sequence is recorded with a `MutationObserver` armed before the press.
     */
    /**
     * ⛔⛔ **THE RECORDS, NOT THE BOX** — and the first cut got this wrong in
     * BOTH halves, which is worth writing down because it made a correct page
     * look broken. A `MutationObserver` callback is a MICROTASK and it is
     * handed a LIST: two synchronous `textContent` writes in one task arrive as
     * TWO records in ONE invocation, so (a) a callback that pushes once per
     * invocation records ONE of the two, and (b) reading `box.textContent` from
     * inside it reads the LAST value for every record, because the box is live
     * by then. ⇒ push per RECORD, and read the text node the record ADDED —
     * assigning `textContent` replaces the node, so `addedNodes[0]` is exactly
     * the string that was written at that moment.
     */
    await page.evaluate(() => {
        window.__statusLog = [];
        const box = document.getElementById('status');
        window.__statusObserver = new MutationObserver((records) => {
            for (const m of records) {
                window.__statusLog.push([...m.addedNodes].map((n) => n.textContent).join(''));
            }
        });
        window.__statusObserver.observe(box, { childList: true, characterData: true, subtree: true });
    });
    await clickCell(PASTE_AT);
    await page.waitForTimeout(1500);
    const pasted = await read();
    const seq = await page.evaluate(() => {
        window.__statusObserver.disconnect();
        return window.__statusLog;
    });
    const warnAt = seq.findIndex((t) => /a paste ADDS them/.test(t));
    const landedAt = seq.findIndex((t) => /paste tile/.test(t));
    check(warnAt >= 0 && landedAt >= 0 && warnAt < landedAt,
        '⛓⛓⛓ …AND AGAIN **BEFORE** THE PASTE LANDS — the accumulation sentence is written to '
        + 'the status line at index ' + `${warnAt} and the paste's own description at `
        + `${landedAt}. That ORDER is editorView's one guarantee about a warning it cannot `
        + 'itself compose, and it is asserted as a SEQUENCE because an end state cannot show '
        + 'it', json(seq.map((t) => t.slice(0, 40))));
    check(pasted.edit.edits === beforePaste + 1,
        '⛓⛓ …the PASTE applied and is ONE entry (a group), never one per cell — a list with '
        + `${COPY.w * COPY.h} presses in it would need that many undos`,
        `${beforePaste} → ${pasted.edit.edits}`);
    check(pasted.rows[pasted.rows.length - 1]?.includes('paste tile'),
        '⛓⛓ …and the entry carries the THREE-WAY FILTER in its own sentence (`only: tile`), '
        + 'which a boolean pair could not spell for a substrate with two tile layers PLUS '
        + 'bodies', pasted.rows[pasted.rows.length - 1]?.slice(0, 80));

    /* ══ CLAIM 5 — THE PAYLOAD ROUND TRIP, BYTE FOR BYTE ═══════════ */

    await load(`source=edit&level=${LEVEL}`);
    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditTerrain', PAINT_TERRAIN);
    await clickCell(PAINT);
    await settled(1);
    /**
     * ⛔ THE PAYLOAD IS TAKEN FROM THE READOUT AND NOT FROM A DOWNLOADED FILE.
     * The download is a `Blob` + `a.click()`, which Playwright can intercept —
     * but the FILE is not the claim: the claim is that `{base, edits}` round
     * trips through the LOAD box, and reading it here keeps the row from
     * passing because a browser happened to write bytes somewhere.
     */
    const shipped = await page.evaluate(() => ({
        base: window.__editorEdit.base, edits: window.__editorEdit.editList,
    }));
    const before = await read();
    await page.fill('#editLoad', JSON.stringify(shipped));
    await page.click('#editLoadGo');
    await settled(1);
    const after = await read();
    check(json(after.edit.base) === json(shipped.base)
        && json(after.edit.editList) === json(shipped.edits),
        '⛓⛓⛓ A PAYLOAD ROUND TRIPS BYTE FOR BYTE — `{base, edits}` out, the same `{base, '
        + 'edits}` back, through the LOAD box\'s shape sniff');
    check(json(after.edit.level) === json(before.edit.level),
        '⛓⛓ …and it reproduces the SAME RECORD, which is the claim the payload exists to '
        + 'make: the identity is `base, then edits`, and the URL never carried either');
    check(!/edit(s|List)=/.test(after.url),
        '⛔ …and NOT ONE EDIT REACHED THE URL', after.url);

    /* ══ CLAIM 6 — ⚖ RULING 2, the hash mismatch ═══════════════════ */

    const heldBefore = (await read()).edit.level;
    await page.fill('#editLoad', JSON.stringify({
        base: { kind: 'atlas', set_id: `${VANILLA.set_id}-WRONG`, level: 3 }, edits: [],
    }));
    await page.click('#editLoadGo');
    await page.waitForTimeout(800);
    const mismatch = await read();
    check(/REFUSED/.test(mismatch.loadNote) && /CONTENT HASH/.test(mismatch.loadNote)
        && mismatch.loadNote.includes(VANILLA.set_id),
        '⛓⛓⛓ ⚖ RULING 2 — a `set_id` that is not the vanilla content hash REFUSES BY NAME, '
        + 'in the SAVE STAMP\'s own shape', mismatch.loadNote.slice(0, 130));
    check(json(mismatch.edit.level) === json(heldBefore),
        '⛔ …AND THE ROOM THE READER WAS EDITING IS STILL ON SCREEN. A page that cleared the '
        + 'canvas on a bad paste would answer a refusal with a blank screen');

    /* ══ CLAIM 7 — the two bases this arm does NOT own ═════════════ */

    await page.fill('#editLoad', JSON.stringify({
        base: { kind: 'generate', seed: 4, biome: 'pre-sword', step: 2 }, edits: [],
    }));
    await page.click('#editLoadGo');
    await page.waitForTimeout(500);
    const genBase = (await read()).loadNote;
    check(/REFUSED/.test(genBase) && /open it from GENERATE/.test(genBase),
        '⛓⛓ §3.2 — a `generate` base is REFUSED BY NAME HERE and told whose it is: '
        + 'reproducing it means RUNNING the ladder, and "open in editor" is the door that '
        + 'carries the record the other way', genBase.slice(0, 120));
    await page.fill('#editLoad', JSON.stringify({ set_id: 'x', rooms: [] }));
    await page.click('#editLoadGo');
    await page.waitForTimeout(500);
    const setBase = (await read()).loadNote;
    check(/LEVEL SET/.test(setBase) && /phase 3/.test(setBase),
        '⛓ …and a LEVEL SET is refused as the level-set arm\'s, rather than read as a '
        + 'payload that happens to be missing fields', setBase.slice(0, 110));

    /* ══ CLAIM 8 — "open in editor" from GENERATE ══════════════════ */

    await page.goto(`${origin}${PAGE_PATH}?source=generate&seed=4&count=2&run=1`,
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorGenerate?.status === 'ok'
        && !document.getElementById('genRunAll').disabled, null, { timeout: 300000 });
    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditTerrain', 'wall');
    const genGeo = await page.evaluate(() => {
        document.getElementById('canvas').scrollIntoView({ block: 'center' });
        const r = document.getElementById('canvas').getBoundingClientRect();
        const lv = window.__editorGenerated.level;
        return { left: r.left, top: r.top, width: r.width, height: r.height,
            cols: lv.width, rows: lv.height };
    });
    await page.mouse.click(genGeo.left + ((8 + 1) * genGeo.width) / genGeo.cols - 1,
        genGeo.top + ((8 + 1) * genGeo.height) / genGeo.rows - 1);
    await page.waitForFunction(() => window.__editorGenerate?.edits >= 1, null,
        { timeout: 120000 });
    check(await page.evaluate(() => window.__editorGenerate.edits) === 1,
        '⛓ the GENERATE arm settled at EXACTLY one edit for one click — the `>=` wait above '
        + 'is what makes a build that applies it twice a VALUE failure here rather than a '
        + 'timeout naming the wait',
        `${await page.evaluate(() => window.__editorGenerate.edits)}`);
    const genBefore = await page.evaluate(() => ({
        level: window.__editorGenerated.level, url: window.location.search,
    }));
    await page.click('#genOpenEditor');
    await page.waitForFunction(() => window.__editorEdit?.status === 'ok', null,
        { timeout: 120000 });
    const handed = await read();
    check(handed.edit.baseKind === 'generate' && handed.edit.base.seed === 4
        && handed.edit.base.step === 2,
        '⛓⛓⛓ §3.5 — "OPEN IN EDITOR" CROSSES WITH THE LADDER\'S IDENTITY: seed, biome and '
        + 'step travel as the `base` TAG', json(handed.edit.base));
    check(json(handed.edit.level) === json(genBefore.level),
        '⛓⛓ …and the RECORD crosses with it, byte for byte — a `generate` base cannot be '
        + 'RESOLVED (that means running the ladder), so the arm that ran it hands the answer '
        + 'over');
    check(handed.edit.base.edits === 1 && handed.edit.edits === 0,
        '⛔⛔ AND THE EDITS CROSS AS THE RECORD, NOT AS OPS. The tag says ONE edit is already '
        + 'folded in; the new session\'s own list is EMPTY. Handing both would apply them '
        + 'twice (A2 §10.6 bound 2, in this direction)',
        `${handed.edit.base.edits} in the tag, ${handed.edit.edits} in the session`);
    check(handed.base.includes('1 edit(s) ALREADY IN'),
        '⛓ …and the identity line says which is which, because a reader who cannot tell them '
        + 'apart cannot tell what this payload reproduces', handed.base.slice(0, 140));
    check(/source=edit/.test(handed.url) && !/edit(s|List)=/.test(handed.url),
        '⛔ …with no reload (the in-place lifetime switch) and not one edit in the URL',
        handed.url);

    /* ══ CLAIM 9 — the CLI screenshots the new arm ═════════════════ */

    const png = join(OUT, 'edit14.png');
    const run = await promisify(execFile)('node', [
        join(HERE, 'export-seedling-view.mjs'),
        `--out=${png}`, '--source=edit', `--level=${LEVEL}`, '--tick=0',
        ...(host ? [`--host=${host}`] : []),
    ], { cwd: REPO, timeout: 300000 }).catch((e) => e);
    const stdout = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    check(!run.code && statSync(png).size > 1000,
        '⛓⛓⛓ `export-seedling-view.mjs --source=edit --level=14 --tick=0` WRITES A PNG — the '
        + 'CLI forwards every page parameter verbatim, so the new arm is screenshottable with '
        + 'ZERO new flags',
        `exit ${run.code ?? 0}, ${statSync(png).size} bytes`);
    check(/`\?tick=` names nothing here/.test(stdout),
        '⛓⛓ …and it SAYS `?tick=` names nothing in this arm rather than reporting tick 0 of a '
        + 'walk nobody took — the arm answers the readiness contract with the REASON attached',
        (/⚠[^\n]*/.exec(stdout) ?? [''])[0].slice(0, 110));

    /* ══ CLAIM 10 — no edit reaches a URL, in either arm ═══════════ */

    check(!/edit/.test(genBefore.url.replace(/source=edit/g, '')),
        '⛔⛔ ⚖ RULING 9 HELD ACROSS THE WHOLE ROW: not one edit reached a URL in the '
        + 'GENERATE arm either, after a paint that moved the level', genBefore.url);
    check(errors.length === 0,
        '⛔ and NOTHING threw to the console across the whole row — a page that survived by '
        + 'swallowing would still have said so here', errors.slice(0, 3).join(' | '));
} catch (e) {
    check(false, 'the row itself threw', e.stack || e.message);
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
