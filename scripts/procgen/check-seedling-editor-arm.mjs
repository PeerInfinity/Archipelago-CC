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
 * ── SLICE C2 — the rest of Tier A's DOM ───────────────────────────────
 *
 * 11. **THE ID RULE IS TRUE OF THE LIVE DOM** — `edit*` is a control only the
 *     EDIT arm has (inside `#editOnly`), `genEdit*` is one BOTH arms mount.
 * 12. **THE LAYER PICKER PAINTS A CLIFFSIDE**, and the hovered-cell readout
 *     shows it — the first time the page says what a cell IS.
 * 13. **A COLUMN OUTSIDE THE FOUR TERRAIN NAMES PAINTS**, and the HUD names
 *     the tile TYPE it built.
 * 14. **THE ROOM-FLAGS FORM ROUND TRIPS THROUGH UNDO** — a presence flag and
 *     an attribute flag, each an op in the identity.
 * 15. **THE FLAG REACH BOUND IS DISPLAYED AND MEASURED** — six flags the JS
 *     model cannot see, and the one it can.
 * 16. **⚖ RULING 5's WARNING, PRESENT AND ABSENT BY LEVEL** — L14 has no
 *     compiled-in boss geometry and the boss level does, named.
 * 17. **A CROP THAT WOULD DROP SOMETHING IS REFUSED, VERBATIM.**
 * 18. **`set-room` IS A LAUNCHABLE BASE** — load a set, open a room, edit it,
 *     download the set, load it back: the same record.
 * 19. **AN `embed`-SOURCED ROOM IS REFUSED BY NAME**, which is the whole
 *     committed VANILLA set.
 * 20. **THE PASTE FILTER'S OPTIONS ARE DERIVED** from the descriptor.
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
const { ENTITY_CLASSES, buildLevelWorld } = await M('levelWorld.js');
const { untranscribedTypes } = await M('watchEdit.js');
const { DEFAULT_PLACE_TYPE } = await M('watchEditor.js');
const { parseOelLevel } = await M('procgenLevelOel.js');
const {
    LAYER_COLUMNS, TERRAIN_NAMES, columnOfSpec,
} = await M('procgenLevel.js');
const {
    ROOM_FLAG_TAGS, ROOM_GEOMETRY_BOSSES, flagModelReach, roomFlagsIn,
} = await M('watchEdit.js');
const { buildLevelSet } = await M('levelSetExporter.js');
const { validateLevelSet } = await M('levelSetValidator.js');
const { TILE_COLUMN_TO_TYPE, TILE_TYPE_NAMES } = await import(
    join(REPO, 'frontend/modules/flashPanel/seedlingSemantics.js'));
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
/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE C2's SUBJECTS — every one DERIVED
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ THE LEVEL WHOSE RESIZE RAISES ⚖ RULING 5's WARNING — DERIVED, not the
 * brief's guess. ⛔ The brief said *"level 94 (or whichever holds a
 * `bosstotem`)"*: level 94 holds none. Measured over the committed atlas, five
 * levels hold one of the five compiled-in-geometry classes and L43 is the
 * `bosstotem` one — a subject read out of the data, so the day the atlas moves
 * the row follows it instead of asserting the warning's ABSENCE under a name
 * that says presence (§12.7 item 2's shape).
 */
const BOSS = (() => {
    for (const l of ATLAS.levels) {
        const held = [...new Set((l.entities ?? []).map((e) => e.type)
            .filter((t) => Object.prototype.hasOwnProperty.call(ROOM_GEOMETRY_BOSSES, t)))];
        if (held.length > 0) return { level: l.level, classes: held, w: l.width, h: l.height };
    }
    return null;
})();
check(BOSS !== null && BOSS.classes.length > 0,
    '⛓⛓ the ⚖ RULING 5 subject is a level DERIVED from the atlas as holding one of the five '
    + 'compiled-in-geometry classes — the brief named level 94 and level 94 holds none',
    json(BOSS));
const L14_BOSSES = (ATLAS.levels.find((l) => l.level === LEVEL)?.entities ?? [])
    .filter((e) => Object.prototype.hasOwnProperty.call(ROOM_GEOMETRY_BOSSES, e.type));
check(L14_BOSSES.length === 0,
    `⛓ …and level ${LEVEL} holds NONE of them, which is what makes claim 16's ABSENT half a `
    + 'real half rather than a coincidence', `${L14_BOSSES.length}`);

/**
 * ⛓ A CROP THAT MUST BE REFUSED — the smallest rectangle that still drops
 * something, derived from where L14's own contents actually are. ⛔ Chosen
 * against the RECORD rather than typed: a crop to a size the room already
 * exceeds by nothing would be refused for being out of range instead, which is
 * a different refusal with a different sentence.
 */
const CROP = (() => {
    const b = adapter.bounds(baseRecord);
    for (let w = b.w - 1; w >= 3; w -= 1) {
        // ⛓ `foldEdits` THROWS on a refused op (its own rule: a fold that
        // skipped one would reconstruct a different level), so the refusal is
        // the answer this loop is looking for.
        try {
            foldEdits(adapter, baseRecord, [{ op: 'resize', width: w, height: b.h }]);
        } catch (e) {
            if (/would drop/.test(e.message)) return { width: w, height: b.h, why: e.message };
            throw e;
        }
    }
    return null;
})();
check(CROP !== null && /would drop/.test(CROP.why ?? ''),
    '⛓⛓ the CROP subject is the WIDEST rectangle node has proved `resizeRoom` refuses — a '
    + 'crop the room could absorb would make claim 17 assert the refusal\'s ABSENCE under a '
    + 'name that says presence',
    `${CROP?.width}x${CROP?.height}`);

/** ⛓ …and the GROWN size for claim 16, one axis, inside `ROOM_TILES_MAX`. */
const GROW_BY = 2;

/**
 * ⛓⛓⛓ A LEVEL SET THIS PAGE CAN ACTUALLY OPEN — built here, out of the atlas.
 *
 * ⛔ **LEVEL 110 AND NOT 14, AND THAT IS A MEASUREMENT.** `validateLevelSet`
 * refuses a one-room set whose room carries an `@to` outside `0..0`, and over
 * the 116 committed rooms exactly TWO (81 and 110) survive on their own. A set
 * built around L14 would be REFUSED by the page's own validator and the row
 * would be about the validator rather than about the base (trap 235).
 */
const SET_LEVEL = (() => {
    for (const l of ATLAS.levels) {
        const { set } = buildLevelSet(
            [{ seed: 0, record: levelSourceFromAtlas(ATLAS)(l.level), summary: null,
                name: `L${l.level}` }],
            { setId: 'arm-probe', generator: 'check-seedling-editor-arm.mjs' },
        );
        if (validateLevelSet(set).ok) return l.level;
    }
    return null;
})();
const SET_DOC = SET_LEVEL === null ? null : buildLevelSet(
    [{ seed: 0, record: levelSourceFromAtlas(ATLAS)(SET_LEVEL), summary: null,
        name: `L${SET_LEVEL}` }],
    { setId: 'arm-probe', generator: 'check-seedling-editor-arm.mjs' },
).set;
check(SET_DOC !== null && validateLevelSet(SET_DOC).ok
    && typeof SET_DOC.rooms[0].source?.xml === 'string',
    '⛓⛓ the `set-room` subject is a one-room set node BUILT and node VALIDATED, whose room '
    + 'carries a real `source.xml` — the vanilla set is 116 EMBED-sourced rooms and cannot '
    + 'be one', `L${SET_LEVEL} → ${SET_DOC?.set_id}, ${SET_DOC?.rooms.length} room(s)`);
/**
 * ⛓ NODE'S OWN `set-room` RESOLVER, over the same document the page is handed —
 * so claim 18's record comparison is against a fold this file performed and not
 * against the page's echo (trap 269).
 */
const adapter2 = createSeedlingEditAdapter({
    schema: null,
    levelSource: levelSourceFromAtlas(ATLAS),
    vanillaSetId: VANILLA.set_id,
    parseOel: parseOelLevel,
    levelSetSource: (id) => (SET_DOC && id === SET_DOC.set_id ? SET_DOC : null),
});
check(VANILLA.rooms.every((r) => typeof r.source?.xml !== 'string'),
    '⛓ …and NOT ONE of the vanilla set\'s 116 rooms carries an `xml` source, which is what '
    + 'claim 19 is about', `${VANILLA.rooms.length} rooms, 0 with xml`);

/** ⛓ A CLIFFSIDE COLUMN and a NON-TERRAIN tile column, both derived. */
const CLIFF_COLUMN = 0;
const CLIFF_CELL = FREE;
const WIDE_COLUMN = (() => {
    const names = new Set(TERRAIN_NAMES.map((n) => columnOfSpec(n, 'tiles', 'arm')));
    for (let c = 0; c < LAYER_COLUMNS.tiles; c += 1) if (!names.has(c)) return c;
    return null;
})();
check(WIDE_COLUMN !== null && !TERRAIN_NAMES.some(
    (n) => columnOfSpec(n, 'tiles', 'arm') === WIDE_COLUMN),
    `⛓ the wide-column subject is column ${WIDE_COLUMN} — one of the `
    + `${LAYER_COLUMNS.tiles} the picker reaches and NOT one of the `
    + `${TERRAIN_NAMES.length} named terrains, so painting it is a claim about the new `
    + 'control and not about the old one',
    `type ${TILE_COLUMN_TO_TYPE[WIDE_COLUMN]} ${TILE_TYPE_NAMES[TILE_COLUMN_TO_TYPE[WIDE_COLUMN]]}`);

/** ⛓ THE FLAGS — one PRESENCE flag and one ATTRIBUTE flag, off the schema. */
const FLAG_PRESENCE = ROOM_FLAG_TAGS
    .find((t) => SCHEMA.entities[t] && SCHEMA.entities[t].values.length === 0);
const FLAG_ATTR = ROOM_FLAG_TAGS
    .find((t) => SCHEMA.entities[t] && SCHEMA.entities[t].values.length > 0
        && !roomFlagsIn(baseRecord).some((f) => f.tag === t));
const FLAG_HELD = roomFlagsIn(baseRecord);
check(Boolean(FLAG_PRESENCE) && Boolean(FLAG_ATTR) && FLAG_HELD.length > 0,
    '⛓ the flag subjects are DERIVED from the schema and the room: a presence flag (no '
    + 'declared values), an attribute flag this room does NOT already hold, and the flag it '
    + 'DOES hold', `${FLAG_PRESENCE} · ${FLAG_ATTR} · held ${json(FLAG_HELD.map((f) => f.tag))}`);

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

/**
 * ⛔⛔ **EVERY ELEMENT READ IS NULL-SAFE, AND THE MISSING ONES ARE REPORTED AS A
 * VALUE.** A mutant that renames one shared id made this reader THROW on
 * `getElementById(...).options` — so the row died as *"the row itself threw"*
 * before claim 11, the row that exists to catch exactly that rename, could run.
 * A reader is not a claim: it must be able to describe a page that is WRONG,
 * or the claims behind it never get their turn (trap 599's family — a wrong
 * build must fail as a FINDING, not as the harness falling over).
 */
const read = () => page.evaluate(() => {
    const missing = [];
    const el = (id) => {
        const e = document.getElementById(id);
        if (!e) missing.push(id);
        return e;
    };
    const text = (id) => el(id)?.textContent ?? null;
    return {
        missing,
        edit: window.__editorEdit,
        url: window.location.search,
        base: text('editBase'),
        status: text('status'),
        clip: text('genEditClipNote'),
        bound: text('genEditTranscribe'),
        boundHidden: el('genEditTranscribe')?.hidden ?? null,
        loadNote: text('editLoadNote'),
        rows: [...document.querySelectorAll('#genEdits .eRow')].map((e) => e.textContent),
        /* ── slice C2's readouts ─────────────────────────────────── */
        cell: text('genEditCellNote'),
        flagNote: text('genEditFlagNote'),
        reach: text('genEditFlagReach'),
        resizeNote: text('genEditResizeNote'),
        setNote: text('editSetNote'),
        setRooms: [...(el('editSetRoom')?.options ?? [])].map((o) => o.textContent),
        pasteOptions: [...(el('genEditPasteOnly')?.options ?? [])].map((o) => o.value),
        flagsChecked: [...document.querySelectorAll('#genEditFlags input[type=checkbox]')]
            .filter((e) => e.checked).map((e) => e.dataset.flag),
    };
});

/**
 * ⛓⛓ **HOVER A CELL AND READ WHAT THE PAGE SAYS IT IS.** ⛔ The mouse is moved
 * with this file's OWN arithmetic over the last pixel of the cell, exactly as
 * `clickCell` does — nothing here calls `tileAtPoint`.
 */
/**
 * ⛓ **OPEN A COLLAPSED `<details>`** — the flags form and the resize form are
 * closed sections, which is what keeps the shared panel readable in the
 * GENERATE arm. ⛔ Opening one is the reader's own gesture and it is performed
 * rather than assumed: a `page.check` on a control inside a closed `<details>`
 * fails as *"element is not visible"* — a driver timeout naming the WAIT
 * instead of the claim (trap 599's family, met here in another costume).
 */
const openSection = async (id) => {
    await page.evaluate((k) => { document.getElementById(k).open = true; }, id);
};

const hoverCell = async (cell) => {
    const geo = await page.evaluate(() => {
        document.getElementById('canvas').scrollIntoView({ block: 'center' });
        const r = document.getElementById('canvas').getBoundingClientRect();
        const lv = window.__editorEdit.level;
        return { left: r.left, top: r.top, width: r.width, height: r.height,
            cols: lv.width, rows: lv.height };
    });
    await page.mouse.move(geo.left + ((cell.tx + 1) * geo.width) / geo.cols - 1,
        geo.top + ((cell.ty + 1) * geo.height) / geo.rows - 1);
    return (await read()).cell;
};

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
    /**
     * ⛔⛔ **FIRST, AND BEFORE ANY CLAIM: DOES EVERY ELEMENT THESE ROWS NAME
     * EXIST?** A mutant that renames one control makes the DRIVER fail — a
     * `selectOption` timeout naming a selector — and a timeout is a finding
     * about the harness, not about the page. This row runs before the first
     * gesture so the mutant's real cause is NAMED, and the driver failures that
     * follow are its consequences rather than the whole report.
     */
    check(boot.missing.length === 0,
        '⛔ EVERY ELEMENT THE ROWS BELOW READ EXISTS — a renamed or dropped control is a '
        + 'NAMED finding here, before any gesture times out looking for it',
        json(boot.missing));
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

    await page.click('#genEditGesture_rect');
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
    await page.selectOption('#genEditPasteOnly', 'tile');
    await page.click('#genEditGesture_paste');
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
    /**
     * ⛓ SLICE C2 MOVED THIS HALF. A level set is no longer refused as *"the
     * level-set arm's — plan phase 3"*: it LOADS, and what refuses a bad one is
     * `validateLevelSet`, whose errors are printed VERBATIM. ⛔ The sentence
     * changed because the behaviour did, and it is recorded here rather than
     * quietly matched with a looser regex.
     */
    check(/LEVEL SET/.test(setBase) && /validateLevelSet` REFUSES it/.test(setBase)
        && /rooms must be a non-empty array/.test(setBase),
        '⛓ …and a document that IS a level set and does not VALIDATE is refused with the '
        + 'validator\'s own words — a page that said "invalid set" would have thrown away '
        + 'the whole answer', setBase.slice(0, 140));


    /* ══ CLAIM 11 — THE ID RULE, OVER THE LIVE DOM ═════════════════ */

    await load(`source=edit&level=${LEVEL}`);
    /**
     * ⛔⛔ **A RULE ASSERTED OVER THE DOM, NOT AGAINST A LIST IN THIS FILE.**
     * §12.10 left the `genEdit*` prefix *"a lie in one arm"* and C1's own
     * three new SHARED controls carried `edit*` names — the rule's other
     * direction. It is a rule now: `edit*` is a control ONLY the edit arm has
     * (inside `#editOnly`), `genEdit*` is one BOTH arms mount. ⛓ A list here
     * would decay the day a control was added (trap 574); the scan derives
     * both sides off the page and says how many it looked at.
     */
    const ids = await page.evaluate(() => {
        const inside = (el, id) => Boolean(document.getElementById(id)?.contains(el));
        const rows = [...document.querySelectorAll('#editPanel [id]')].map((el) => ({
            id: el.id,
            onlyArm: inside(el, 'editOnly'),
            inPanel: inside(el, 'editPanel'),
        }));
        return {
            rows,
            editStar: rows.filter((r) => /^edit(?!Panel$|Only$)/.test(r.id)),
            genStar: rows.filter((r) => r.id.startsWith('genEdit')),
        };
    });
    check((await read()).missing.length === 0,
        '⛔ every element the rows below read EXISTS — a renamed id is a CLAIM failure here '
        + 'and in claim 11, never the reader falling over', json((await read()).missing));
    check(ids.editStar.length > 0 && ids.genStar.length > 0,
        '⛓ the id scan is not vacuous — the panel really does hold both prefixes',
        `${ids.editStar.length} edit* · ${ids.genStar.length} genEdit* of ${ids.rows.length}`);
    check(ids.editStar.every((r) => r.onlyArm),
        '⛓⛓⛓ **EVERY `edit*` ID IS INSIDE `#editOnly`** — an `edit*` name is a promise that '
        + 'the GENERATE arm never shows the control, and `PANELS.editOnly` is what keeps it',
        json(ids.editStar.filter((r) => !r.onlyArm).map((r) => r.id)));
    check(ids.genStar.every((r) => r.inPanel && !r.onlyArm),
        '⛓⛓⛓ **AND EVERY `genEdit*` ID IS SHARED** — inside `#editPanel` and OUTSIDE '
        + '`#editOnly`. ⛓ C1 shipped three shared controls under `edit*` names '
        + '(`editTools`, `editPasteOnly`, `editClipNote`); they are `genEditGestures` / '
        + '`genEditPasteOnly` / `genEditClipNote` now, and this row is what would notice a '
        + 'fourth', json(ids.genStar.filter((r) => r.onlyArm).map((r) => r.id)));

    /* ══ CLAIM 20 — THE PASTE FILTER'S OPTIONS ARE DERIVED ═════════ */

    const nodeFields = Object.keys(adapter.readCell(baseRecord, 0, 0));
    const opts = (await read()).pasteOptions;
    check(json(opts) === json(['', ...nodeFields]),
        '⛓⛓⛓ §12.10\'s LAST TYPED ROSTER IS GONE — the paste filter offers exactly the '
        + 'fields `adapter.readCell` presents, so a FOURTH descriptor field arrives as an '
        + '`<option>` with no edit on the page', `${json(opts)} vs ${json(nodeFields)}`);

    /* ══ CLAIM 12 — THE LAYER PICKER PAINTS A CLIFFSIDE ════════════ */

    const beforeCliff = await read();
    check(beforeCliff.edit.level.layers.every((l) => l.name !== 'cliffsides'),
        `⛓ level ${LEVEL} has NO cliffsides layer to begin with, so the paint below has to `
        + 'CREATE one — which is the half a page that only ever painted `tiles` could not '
        + 'have exercised',
        json(beforeCliff.edit.level.layers.map((l) => l.name)));
    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditLayer', 'cliffsides');
    const cliffOpts = await page.evaluate(() => ({
        values: [...document.getElementById('genEditTerrain').options].map((o) => o.value),
        groups: [...document.getElementById('genEditTerrain').querySelectorAll('optgroup')]
            .map((g) => g.label),
    }));
    check(cliffOpts.values.every((v) => v.startsWith('column:'))
        && cliffOpts.values.length === LAYER_COLUMNS.cliffsides,
        `⛓⛓ picking \`cliffsides\` REFILLS the picker with that layer's `
        + `${LAYER_COLUMNS.cliffsides} pixelmasks and NO terrain name — a name there is `
        + 'refused by `columnOfSpec`, so offering one would arm a brush whose every click '
        + 'refused', json(cliffOpts));
    await page.selectOption('#genEditTerrain', `column:${CLIFF_COLUMN}`);
    await clickCell(CLIFF_CELL);
    await settled(1);
    const cliffed = await read();
    const nodeCliff = foldEdits(adapter, baseRecord, [{
        op: 'paint', tx: CLIFF_CELL.tx, ty: CLIFF_CELL.ty, layer: 'cliffsides',
        column: CLIFF_COLUMN,
    }]).record;
    check(json(cliffed.edit.level) === json(nodeCliff),
        '⛓⛓⛓ **THE BROWSER PAINTED A CLIFFSIDE AND IT IS NODE\'S FOLD, BYTE FOR BYTE** — '
        + '`paint {layer, column}` has existed since slice B and nothing on the page could '
        + 'reach it');
    check(/\[cliffsides\]/.test(cliffed.rows[0] ?? ''),
        '⛓ …and the op\'s own row says which LAYER it painted', cliffed.rows[0]?.slice(0, 70));
    const hudCliff = await hoverCell(CLIFF_CELL);
    check(new RegExp(`cliffside column ${CLIFF_COLUMN}`).test(hudCliff),
        '⛓⛓ …and the HOVERED-CELL READOUT SHOWS IT. `readCell` has answered `{tile, cliff, '
        + 'entities}` since slice B and no page ever displayed it; this is the first time '
        + 'the page says what a cell IS', hudCliff.slice(0, 110));

    /* ══ CLAIM 13 — A COLUMN OUTSIDE THE FOUR NAMES ════════════════ */

    await load(`source=edit&level=${LEVEL}`);
    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditLayer', 'tiles');
    const tileOpts = await page.evaluate(() => [
        ...document.getElementById('genEditTerrain').options].map((o) => o.value));
    check(tileOpts.length === TERRAIN_NAMES.length + LAYER_COLUMNS.tiles
        && json(tileOpts.slice(0, TERRAIN_NAMES.length)) === json([...TERRAIN_NAMES]),
        `⛓⛓⛓ the picker reaches ALL ${LAYER_COLUMNS.tiles} COLUMNS, with the `
        + `${TERRAIN_NAMES.length} terrain NAMES first and still spelling themselves — a `
        + 'respelling would have moved bytes in every committed `?gen=` payload',
        `${tileOpts.length} option(s)`);
    await page.selectOption('#genEditTerrain', `column:${WIDE_COLUMN}`);
    await clickCell(PAINT);
    await settled(1);
    const wide = await read();
    const nodeWide = foldEdits(adapter, baseRecord,
        [{ op: 'paint', tx: PAINT.tx, ty: PAINT.ty, column: WIDE_COLUMN }]).record;
    check(json(wide.edit.level) === json(nodeWide),
        `⛓⛓ a column outside the four names PAINTS, and the record is node's fold — column `
        + `${WIDE_COLUMN} builds tile type ${TILE_COLUMN_TO_TYPE[WIDE_COLUMN]}`);
    const hudWide = await hoverCell(PAINT);
    check(hudWide.includes(`column ${WIDE_COLUMN}`)
        && hudWide.includes(TILE_TYPE_NAMES[TILE_COLUMN_TO_TYPE[WIDE_COLUMN]]),
        '⛓⛓ …and the HUD names the tile TYPE it built, off `TILE_COLUMN_TO_TYPE` — which is '
        + 'the only way a reader can tell 45 columns apart', hudWide.slice(0, 110));

    /* ══ CLAIM 14 — THE ROOM-FLAGS FORM ROUND TRIPS ════════════════ */

    await load(`source=edit&level=${LEVEL}`);
    const flagsAtBoot = await read();
    check(json(flagsAtBoot.flagsChecked) === json(FLAG_HELD.map((f) => f.tag))
        && json(flagsAtBoot.edit.flags) === json(FLAG_HELD.map((f) => f.tag)),
        '⛓⛓ THE FORM READS THE ROOM — a loaded vanilla L14 shows the flag it actually '
        + 'carries and no other', json(flagsAtBoot.flagsChecked));
    const heldValue = await page.evaluate(
        (t) => document.getElementById(`genEditFlag_${t}_alpha`)?.value, FLAG_HELD[0].tag);
    check(heldValue === FLAG_HELD[0].attrs.alpha,
        '⛓ …and the TYPED INPUT carries that flag\'s own attribute value off the record',
        `${heldValue} vs ${FLAG_HELD[0].attrs.alpha}`);

    await openSection('genEditFlagsSection');
    await page.check(`#genEditFlag_${FLAG_PRESENCE}`);
    await settled(1);
    const placedFlag = await read();
    const nodeFlag = foldEdits(adapter, baseRecord, [{
        op: 'place', tx: 0, ty: 0, type: FLAG_PRESENCE, attrs: {},
    }]).record;
    check(json(placedFlag.edit.level) === json(nodeFlag),
        `⛓⛓⛓ A PRESENCE FLAG IS A \`place\` AT THE ORIGIN, and the record is node's fold — `
        + `<${FLAG_PRESENCE}> is an ENTITY in the OEL and a LEVEL PROPERTY in the game, so `
        + 'it needed no new op, only a form');
    check(placedFlag.rows.length === 1 && placedFlag.rows[0].includes(FLAG_PRESENCE),
        '⛔ …AND IT IS IN THE EDIT LIST. The form writes through the SESSION, so undo, the '
        + 'payload and the identity line all see a flag change exactly as they see a brush '
        + 'stroke', placedFlag.rows[0]?.slice(0, 60));
    await page.click('#genEditUndo');
    await settled(0);
    check(json((await read()).edit.level) === json(baseRecord),
        '⛓⛓ …and ONE UNDO puts the room back to the base, byte for byte');

    await page.check(`#genEditFlag_${FLAG_ATTR}`);
    await settled(1);
    await page.fill(`#genEditFlag_${FLAG_ATTR}_${SCHEMA.entities[FLAG_ATTR].values[0].name}`,
        '7');
    await page.evaluate((id) => document.getElementById(id).dispatchEvent(
        new Event('change', { bubbles: true })),
    `genEditFlag_${FLAG_ATTR}_${SCHEMA.entities[FLAG_ATTR].values[0].name}`);
    await settled(2);
    const attred = await read();
    check(attred.rows.length === 2 && /EDIT attrs \(0,0\)/.test(attred.rows[1]),
        `⛓⛓ AN ATTRIBUTE FLAG IS A \`place\` THEN AN \`attrs\` — two ops, both in the `
        + 'identity, both at the flag\'s own cell', attred.rows[1]?.slice(0, 70));
    const wrote = attred.edit.level.entities.find((e) => e.type === FLAG_ATTR);
    check(wrote?.attrs?.[SCHEMA.entities[FLAG_ATTR].values[0].name] === '7',
        `⛓ …and the value the form typed is the value the RECORD carries`, json(wrote?.attrs));
    await page.uncheck(`#genEditFlag_${FLAG_ATTR}`);
    await settled(3);
    check(!(await read()).edit.level.entities.some((e) => e.type === FLAG_ATTR),
        '⛓⛓ …and UNTICKING is a `remove` at that flag\'s own cell — the flag is gone from '
        + 'the record and the removal is the THIRD op, not an erasure of the first two');

    /* ══ CLAIM 15 — THE FLAG REACH BOUND, MEASURED ═════════════════ */

    const reach = (await read()).reach;
    const nodeReach = flagModelReach(baseRecord, buildLevelWorld, {
        attrsFor: (t) => Object.fromEntries((SCHEMA.entities[t]?.values ?? [])
            .filter((v) => v.default !== null && v.default !== undefined)
            .map((v) => [v.name, v.default])),
    });
    const ignored = nodeReach.filter((r) => r.reads === false).map((r) => r.tag);
    const reads = nodeReach.filter((r) => r.reads === true).map((r) => r.tag);
    check(ignored.length > 0 && reads.length > 0,
        '⛔⛔ NODE\'S OWN MEASUREMENT FIRST, AND IT IS WHAT OVERTURNED THE BRIEF: the brief '
        + 'said to derive "which flags the JS model ignores" from `levelWorld`\'s class '
        + 'table, and that table gives ALL SEVEN `as3: null` — it answers CONSTRUCTION. '
        + 'Built with and without, six worlds are byte-identical and <control> is NOT',
        `${json(ignored)} ignored · ${json(reads)} read`);
    check(reach.includes(`${ignored.length} of these ${nodeReach.length} flags`)
        && ignored.every((t) => reach.includes(t)) && reads.every((t) => reach.includes(t)),
        '⛓⛓⛓ …and the PAGE says exactly that, naming both sides — ⚖ ruling 3\'s shape one '
        + 'layer up: the edit is never refused, and what the reader is told is what the JS '
        + 'oracle can and cannot answer about it', reach.slice(0, 150));
    check(/the wasm is the only certifier/.test(reach),
        '⛔ …and it names the CERTIFIER, because a room-flags form that changed `lightalpha` '
        + 'cannot be checked in JS at all (§12.10)');

    /* ══ CLAIM 16 — ⚖ RULING 5's WARNING, PRESENT AND ABSENT ═══════ */

    await load(`source=edit&level=${LEVEL}`);
    await openSection('genEditResizeSection');
    const grow = { w: baseRecord.width + GROW_BY, h: baseRecord.height };
    await page.fill('#genEditResizeW', String(grow.w));
    const previewNoBoss = (await read()).resizeNote;
    check(/new cells hold NO TILE/.test(previewNoBoss)
        && !/fight geometry is COMPILED IN/.test(previewNoBoss),
        `⛓⛓⛓ ⚖ RULING 5 — GROWING level ${LEVEL} by ${GROW_BY} columns warns about the `
        + 'UNTILED cells and says NOTHING about boss geometry, because this room holds none '
        + `of the ${Object.keys(ROOM_GEOMETRY_BOSSES).length} classes`,
        previewNoBoss.slice(0, 130));
    await page.click('#genEditResizeGo');
    await settled(1);
    const grown = await read();
    check(grown.edit.level.width === grow.w && grown.edit.level.height === grow.h,
        `⛓ …and the room really is ${grow.w}x${grow.h} now`,
        `${grown.edit.level.width}x${grown.edit.level.height}`);
    check(/EDIT resize → /.test(grown.rows[0] ?? '')
        && /new cells hold NO TILE/.test(grown.rows[0] ?? ''),
        '⛓⛓ …and the SAME sentences come back AFTER, off `foldEdits().steps` — the preview '
        + 'and the readout cannot disagree about a room they are both describing',
        grown.rows[0]?.slice(0, 90));

    await load(`source=edit&level=${BOSS.level}`);
    await openSection('genEditResizeSection');
    await page.fill('#genEditResizeW', String(BOSS.w + GROW_BY));
    const previewBoss = (await read()).resizeNote;
    check(/fight geometry is COMPILED IN/.test(previewBoss)
        && BOSS.classes.every((c) => previewBoss.includes(`<${c}>`))
        && BOSS.classes.every((c) => previewBoss.includes(ROOM_GEOMETRY_BOSSES[c])),
        `⛓⛓⛓ …AND ON LEVEL ${BOSS.level} THE WARNING IS PRESENT AND NAMES THE CLASS — `
        + `${BOSS.classes.join(', ')}, with the AS3 constants that hold its rectangle. ⚖ `
        + 'Ruling 5: displayed until plan §5 #1 lands, and the edit is never blocked',
        previewBoss.slice(0, 170));

    /* ══ CLAIM 17 — A CROP THAT WOULD DROP SOMETHING ═══════════════ */

    await load(`source=edit&level=${LEVEL}`);
    await openSection('genEditResizeSection');
    await page.fill('#genEditResizeW', String(CROP.width));
    await page.click('#genEditResizeGo');
    await page.waitForTimeout(800);
    const cropped = await read();
    check(cropped.edit.edits === 0 && json(cropped.edit.level) === json(baseRecord),
        '⛔ A CROP THAT WOULD DROP SOMETHING IS REFUSED — nothing was applied and the room '
        + 'is untouched', `${cropped.edit.edits} edit(s)`);
    check(/would drop/.test(cropped.resizeNote) && /REFUSED/.test(cropped.resizeNote)
        && /Clear the cells first/.test(cropped.resizeNote),
        '⛓⛓⛓ …and the refusal is `procgenLevel`\'s OWN SENTENCE, VERBATIM — it names the '
        + 'tiles and the bodies that would be lost, and a page that paraphrased it would be '
        + 'a second opinion about which cells are in danger', cropped.resizeNote.slice(0, 150));

    /* ══ CLAIM 18 — `set-room` IS A LAUNCHABLE BASE ════════════════ */

    await page.fill('#editLoad', JSON.stringify(SET_DOC));
    await page.click('#editLoadGo');
    /**
     * ⛔ THE WAIT IS ON THE VALUE THE CLAIM NAMES — the HELD set's own id — and
     * not on a sleep. A fixed pause is a wait that a slower machine turns into
     * a claim about `null`, and a 116-room document takes a real moment to
     * cross the box.
     */
    /**
     * ⛔ A BOUNDED WAIT THAT BECOMES A CHECK. The wait is on the value the claim
     * names, which is right — but a build that NEVER sets it can only time out,
     * and a timeout reports the WAIT rather than the claim. Caught here so the
     * finding is *"the page did not hold the set"* with what it did hold.
     */
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id,
        SET_DOC.set_id, { timeout: 60000 }).catch(() => {});
    const held = await read();
    check(held.edit.set?.set_id === SET_DOC.set_id && held.edit.set.rooms === 1
        && held.edit.set.openable === 1,
        '⛓⛓ A LEVEL SET LOADS AND IS HELD — validated on the way in, and the page says how '
        + 'many of its rooms it could open', json(held.edit.set));
    check(held.setRooms.length === SET_DOC.rooms.length
        && held.setRooms[0].includes(SET_DOC.rooms[0].name),
        '⛓ …and its ROOMS ARE OFFERED, named', json(held.setRooms));
    await page.selectOption('#editSetRoom', '0');
    await page.click('#editSetOpen');
    await page.waitForFunction(() => window.__editorEdit?.baseKind === 'set-room', null,
        { timeout: 60000 });
    const opened = await read();
    const nodeRoom = resolveBase(adapter2, { kind: 'set-room', set_id: SET_DOC.set_id, room: 0 });
    check(json(opened.edit.base) === json({ kind: 'set-room', set_id: SET_DOC.set_id, room: 0 })
        && json(opened.edit.level) === json(nodeRoom),
        '⛓⛓⛓ **§3.2\'s FOURTH BASE IS LAUNCHABLE** — picking a room resolves it through the '
        + '`oel` arm, and the record is node\'s own `resolveBase`, byte for byte',
        json(opened.edit.base));
    check(opened.base.includes(SET_DOC.set_id) && opened.base.includes('room 0'),
        '⛓ …and the IDENTITY LINE prints the set\'s `set_id` and the room id',
        opened.base.slice(0, 110));

    const roomFree = (() => {
        const b = adapter.bounds(nodeRoom);
        for (let y = 1; y < b.h - 1; y += 1) {
            for (let x = 1; x < b.w - 1; x += 1) {
                const c = adapter.readCell(nodeRoom, x, y);
                if (c.tile && c.tile.column !== PAINT_COLUMN && c.entities.length === 0) {
                    return { tx: x, ty: y };
                }
            }
        }
        return null;
    })();
    check(roomFree !== null,
        '⛓ …and the set room has a cell whose column is not the one about to be painted, so '
        + 'the edit below is a real change', json(roomFree));
    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditLayer', 'tiles');
    await page.selectOption('#genEditTerrain', PAINT_TERRAIN);
    await clickCell(roomFree);
    await settled(1);
    const editedRoom = (await read()).edit.level;
    await page.click('#editDownloadSet');
    await page.waitForFunction(() => window.__editorSetOut, null, { timeout: 30000 });
    const out = await page.evaluate(() => window.__editorSetOut);
    check(out.set_id !== SET_DOC.set_id
        && out.set_id.endsWith(`-${out.provenance.content_hash}`),
        '⛓⛓⛓ THE SET COMES BACK RE-STAMPED — `stampLevelSetIdentity` recomputes the content '
        + 'hash and rebuilds the id around it, so an EDITED SET IS A DIFFERENT SET BY '
        + 'CONSTRUCTION (plan §4.2, the one thing a save file cannot otherwise detect)',
        `${SET_DOC.set_id} → ${out.set_id}`);
    check(validateLevelSet(out).ok,
        '⛓ …and node validates what the page wrote', json(validateLevelSet(out).errors));
    await page.fill('#editLoad', JSON.stringify(out));
    await page.click('#editLoadGo');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id, out.set_id,
        { timeout: 60000 });
    await page.selectOption('#editSetRoom', '0');
    await page.click('#editSetOpen');
    await page.waitForFunction((id) => window.__editorEdit?.base?.set_id === id, out.set_id,
        { timeout: 60000 });
    const reopened = await read();
    /**
     * ⛔⛔ **THE COMPARISON DROPS `path`, AND THAT IS THE RE-STAMP, NOT A
     * LOOSENING.** A `set-room` record's `path` is provenance — it is
     * `<set_id>#<room>` — and the download RE-STAMPS the set, so the reloaded
     * room's `path` names the NEW id BY CONSTRUCTION. A row that demanded byte
     * equality including `path` would be demanding that an edited set keep its
     * old identity, which is the one thing §4.2 says it must not do. ⇒ the
     * CONTENT is compared byte for byte and the provenance is asserted to have
     * MOVED, to the id the page actually wrote.
     */
    const contentOf = (r) => {
        const { path: _p, ...rest } = r;
        return json(rest);
    };
    check(contentOf(reopened.edit.level) === contentOf(editedRoom)
        && reopened.edit.edits === 0,
        '⛓⛓⛓ **AND IT ROUND TRIPS**: the set with the edited room\'s XML replaced, loaded '
        + 'back and opened, IS the record that was on screen — with an EMPTY op list, '
        + 'because the edit is in the room now and not beside it. That is Tier B\'s first '
        + 'write path, whole', `${reopened.edit.edits} edit(s)`);
    check(reopened.edit.level.path === `${out.set_id}#0`
        && editedRoom.path === `${SET_DOC.set_id}#0`,
        '⛓⛓ …and the ONE field that differs is the room\'s PROVENANCE, which names the '
        + 'RE-STAMPED set — an edited set is a different set by construction, so a room of it '
        + 'says so',
        `${editedRoom.path} → ${reopened.edit.level.path}`);

    /* ══ CLAIM 19 — AN `embed`-SOURCED ROOM ════════════════════════ */

    await page.fill('#editLoad', JSON.stringify(VANILLA));
    await page.click('#editLoadGo');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id, VANILLA.set_id,
        { timeout: 120000 });
    const vanillaHeld = await read();
    check(vanillaHeld.edit.set?.set_id === VANILLA.set_id
        && vanillaHeld.edit.set.openable === 0,
        '⛓⛓ THE COMMITTED VANILLA SET LOADS AND NOT ONE OF ITS 116 ROOMS IS OPENABLE HERE',
        json(vanillaHeld.edit.set));
    check(/EMBED-sourced and NOT openable/.test(vanillaHeld.setNote)
        && /source=edit&level=N/.test(vanillaHeld.setNote),
        '⛓ …and the page says WHY and WHERE THE DOOR IS: an `embed` is a path into a SWF\'s '
        + '`[Embed]` table, a fact about a source tree, and the ATLAS base is how that set '
        + 'is edited', vanillaHeld.setNote.slice(0, 150));
    await page.selectOption('#editSetRoom', '0');
    await page.click('#editSetOpen');
    await page.waitForTimeout(800);
    const refusedRoom = await read();
    check(/EMBED-sourced/.test(refusedRoom.status)
        && json(refusedRoom.edit.level) === json(vanillaHeld.edit.level),
        '⛔⛔ …and PRESSING OPEN REFUSES BY NAME — with the room the reader was editing '
        + 'still on screen', refusedRoom.status.slice(0, 130));

    /* ══ CLAIM 8 — "open in editor" from GENERATE ══════════════════ */

    await page.goto(`${origin}${PAGE_PATH}?source=generate&seed=4&count=2&run=1`,
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorGenerate?.status === 'ok'
        && !document.getElementById('genRunAll').disabled, null, { timeout: 300000 });
    /**
     * ⛓⛓⛓ CLAIM 11's OTHER HALF — THE SAME RULE, IN THE GENERATE ARM. ⛔ The
     * `genEdit*` half is what a shared id PROMISES, and this is where the
     * promise is kept or broken: every one of them is present and visible here,
     * and `#editOnly`'s controls are not.
     */
    const genIds = await page.evaluate((wanted) => ({
        missing: wanted.filter((id) => !document.getElementById(id)),
        hiddenPanel: document.getElementById('editPanel').hidden,
        onlyHidden: document.getElementById('editOnly').hidden,
    }), ids.genStar.map((r) => r.id));
    check(genIds.missing.length === 0 && genIds.hiddenPanel === false
        && genIds.onlyHidden === true,
        `⛓⛓⛓ **ALL ${ids.genStar.length} \`genEdit*\` CONTROLS ARE MOUNTED IN THE GENERATE `
        + 'ARM TOO** — one edit implementation, two hosts — and `#editOnly` is HIDDEN here, '
        + 'which is what makes the `edit*` prefix a promise rather than a naming habit',
        json(genIds));
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
