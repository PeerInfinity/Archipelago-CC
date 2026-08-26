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
 * ── SLICE E1 — the REAL 116 ───────────────────────────────────────────
 *
 * 27. **`#editLoadVanilla` BUILDS THE VANILLA 116 AS `xml`, FETCHING NOTHING** —
 *     the same `vanillaRecordSet` node calls, so the two `set_id`s agreeing IS the
 *     byte proof; 116 openable rooms; the links column `(bounded)` (§21.4 on the
 *     corpus it was sized for) with the arrows still drawn; the REPORT's verdict
 *     on the real game (every edge FREE; ⛓ E5: `level_58` is REACHED and the
 *     rules.json export ALLOWED — E1 measured both the other way, and the
 *     sentence that named the mechanism it could not see is the one E5
 *     implemented); §21.2's inert rule on a real arrival endpoint; and
 *     OPEN · PAINT · CLOSE · DOWNLOAD with `derived_from` surviving the
 *     re-stamp.
 *
 * ── SLICE E5 — the MANIFEST'S WARPS, and the VANILLA AUTHORED OVERLAY ──
 *
 * 32. **`named_rooms` IS A CONNECTION** — the derivation reads the manifest it
 *     is handed, `<tentaclebeast>` in L57 becomes the door into `level_58`, and
 *     the page's own free list NAMES that region (a row that only checked the
 *     refusal was gone would pass on a build that dropped the region instead).
 * 33. **THE COMMITTED VANILLA OVERLAY LOADS THROUGH THE EXISTING DOOR** —
 *     `sniffLoadBox` classifies it by shape and `takeOverlay` attaches it to
 *     the live 116-room set at zero ops, so no page path was added. 41
 *     locations, the `overlay_id` on the identity line, the free count moving
 *     to node's own answer (UPWARD — a location is a logic obligation), and
 *     the rules.json export ALLOWED.
 *
 * ── SLICE E1c — MINIFY, AND THE BUNDLE ────────────────────────────────
 *
 * 28. **MINIFY IS `indent: 0` OF THE SAME WRITER** — the bytes are
 *     `stringifyRulesJson`'s at that indent (asked in node over the document
 *     the page wrote), under half the indented size, and UNCHECKING the box
 *     returns the DEFAULT bytes exactly. The default does not move.
 * 29. **ONE PRESS, ONE `.zip`, FOUR MEMBERS** — read back in node through the
 *     page's own `readBundle`, classified BY SHAPE; §21.9 holds (the ids inside
 *     the container are the three-blob press's ids — a fourth WAY to press, not
 *     a fourth STAMP); the `rules.json` member is byte-identical to
 *     `#editDownloadRules`'s; the `apMapping` companion is NOT a member and the
 *     note says so.
 * 30. **THE BUNDLE ROUND TRIPS THROUGH `#editLoadFile`** on a FRESH page — the
 *     set and its overlay open together from ONE file with an empty op list —
 *     and the `rules` / `region-atlas` members it did NOT load are NAMED.
 * 31. **A REFUSED `rules.json` STILL BUNDLES THE WORK** — ⛓ E5 re-homed this
 *     onto the CUT set, whose graph does not close by construction (vanilla's
 *     does close now); the container carries the SET and the
 *     OVERLAY and says why the other two are absent.
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
const { buildLevelSet, vanillaRecordSet } = await M('levelSetExporter.js');
const {
    NAMED_ROOM_KEYS, indexRoom, planLevelSetChunks, validateLevelSet,
} = await M('levelSetValidator.js');
const { emptyLevel } = await M('procgenLevel.js');
const { recordToOel } = await M('procgenLevelOel.js');
const { TILE_SIZE } = await M('levelWorld.js');
const {
    createSeedlingSetAdapter, createSetSession, exitsOfRoom, linksIndexOf, rulesJsonOf,
    setRecord, whatLinksHere,
} = await M('seedlingSetAdapter.js');
const {
    OVERVIEW, exitArrowShapes, freeEdgesOf, linkScanBound, linkScanCost, reportOf, roomRowsOf,
} = await M('watchSetEditor.js');
const { emptyOverlay } = await M('seedlingSetOverlay.js');
const { tileTypeForPlacement } = await import(
    join(REPO, 'frontend/modules/flashPanel/seedlingSemantics.js'));
const { loadRulesSchema } = await import(
    join(REPO, 'frontend/modules/procgenCore/jsonSchemaFiles.js'));
const { stringifyRulesJson } = await import(
    join(REPO, 'frontend/modules/shared/rulesJsonBuilder.js'));
const { compileRegionAtlas } = await import(
    join(REPO, 'frontend/modules/procgenPipeline/regionAtlasCompiler.js'));
const { validateRegionAtlas } = await import(
    join(REPO, 'frontend/modules/procgenPipeline/regionAtlasValidator.js'));
const { TILE_COLUMN_TO_TYPE, TILE_TYPE_NAMES } = await import(
    join(REPO, 'frontend/modules/flashPanel/seedlingSemantics.js'));
const { foldEdits, resolveBase } = await import(
    join(REPO, 'frontend/modules/procgenCore/editCore.js'));
/**
 * ⛓ EDITOR v3 E1c — the BUNDLE reader and the vendored JSZip. ⛔ The SAME module
 * the page uses, asked on the other side of a browser download, so "it round
 * trips" is a statement about the bytes and not about the page's echo.
 */
const { readBundle } = await import(
    join(REPO, 'frontend/modules/presets/documentBundle.js'));
const { loadJSZipNode } = await import(join(REPO, 'scripts/procgen/loadJSZipNode.mjs'));

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
    && typeof SET_DOC.rooms[0].source?.record === 'object',
    '⛓⛓ the `set-room` subject is a one-room set node BUILT and node VALIDATED, whose room '
    + 'carries a real `source.record` (E1b — the exporter writes records) — the vanilla '
    + 'fixture is 116 EMBED-sourced rooms and cannot be one',
    `L${SET_LEVEL} → ${SET_DOC?.set_id}, ${SET_DOC?.rooms.length} room(s)`);
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
// ⛔ THE COMMITTED FIXTURE IS UNTOUCHED BY E1b: all 116 rooms are still `embed`
//    (⚖ §22.8 is ADDITIVE), which is exactly what claim 19 is about.
/**
 * ⛓⛓ **AND THAT IS ALSO WHY THIS FIXTURE CANNOT WITNESS TRAP 722's FIX.**
 * EDITOR v3 E3a keyed the strip's `⛔embed` badge on the CELL
 * (`sourceKind(cell) === 'embed'`) after it had been drawn under EVERY room
 * since E1b — the condition read an undeclared `xml`, and `typeof
 * <undeclared>` is `'undefined'`. ⛔ On THIS document every one of the 116
 * rooms IS an embed, so the badge is under every room BOTH before and after
 * the fix and the vanilla strip's INK does not move at all. The documents that
 * discriminate the two builds are the GENERATED sets, whose rooms are
 * `record`-sourced, and the maze's library, whose entries carry their world
 * inline — and both are witnessed by `setEditorView.test.js`'s rows BY INDEX
 * (six badges → zero; four → zero) rather than by a browser ink count that
 * could not separate a glyph from the still underneath it.
 */
check(VANILLA.rooms.every((r) => typeof r.source?.embed === 'string'
    && r.source.xml === undefined && r.source.record === undefined),
    '⛓ …and NOT ONE of the vanilla set\'s 116 rooms carries an `xml` OR a `record` source — '
    + 'every one is still an `embed`, which is what claim 19 is about',
    `${VANILLA.rooms.length} rooms, 0 with xml, 0 with record`);

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 D2 — THE SET SESSION'S OWN SUBJECTS, ALL NODE-BUILT
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **A LINKED, MULTI-ROOM GENERATED SET** — `buildLevelSet({link: true})`
 * over `emptyLevel` rooms, the exporter's own path and D1's own fixture shape.
 * ⛔ NOT the one-room `SET_DOC`: every D2 claim below is about rooms in the
 * PLURAL (reorder, connect, "what links here"), and a one-room set cannot fail
 * any of them.
 */
const D2_ROOMS = 6;
/**
 * ⛔ **EACH ROOM CARRIES A `torchpickup`, AND THAT IS A MEASUREMENT.** The
 * overlay's location has to sit on an entity, and the only entities an
 * `emptyLevel` room has after the linker runs are the TRANSITIONS it wired —
 * so a location marked on one is deleted the moment a `disconnect` removes that
 * door, and every later derivation refuses by name (*"no entity for it in level
 * 0"*). The row would then be about the derivation instead of about the
 * overlay. A pickup is a body no transition op can touch.
 */
const d2Room = (level) => {
    const base = emptyLevel({ level });
    return {
        ...base,
        entities: [...(base.entities ?? []),
            { type: 'torchpickup', x: 4 * TILE_SIZE, y: 3 * TILE_SIZE, attrs: {} }],
    };
};
const D2_SET = buildLevelSet(
    Array.from({ length: D2_ROOMS }, (_, level) => d2Room(level)),
    { setId: 'arm-d2', link: true },
).set;
check(validateLevelSet(D2_SET).ok && D2_SET.rooms.length === D2_ROOMS
    && D2_SET.rooms.every((r) => typeof r.source?.record === 'object'),
    `⛓⛓ the SET-EDITOR subject is a node-BUILT, node-VALIDATED ${D2_ROOMS}-room set whose `
    + 'rooms are all `record`-sourced (E1b) — the linker wired it, so it has exits to move, '
    + 'connect and disconnect', `${D2_SET.set_id}, ${D2_SET.rooms.length} room(s)`);

/**
 * ⛓ …and an OVERLAY for it, built here rather than typed: §20.11 #3's third
 * document, and the thing a page that forgets it loses silently.
 */
const D2_OVERLAY_LOCATION = (() => {
    const ent = (D2_SET.rooms[0].source.record.entities ?? [])
        .find((e) => e.type === 'torchpickup') ?? null;
    return ent ? { type: ent.type, x: ent.x, y: ent.y } : null;
})();
check(D2_OVERLAY_LOCATION !== null && D2_OVERLAY_LOCATION.type !== 'teleporter',
    '⛓ …and room 0 of it holds a NON-TRANSITION entity the overlay can mark a location on — '
    + '`mark-location` refuses an entity the room does not hold at exactly those pixels, and a '
    + 'location on a DOOR is one a `disconnect` deletes out from under the derivation',
    json(D2_OVERLAY_LOCATION));
const D2_OVERLAY = {
    schema_version: 1,
    rooms: {
        0: {
            locations: [{
                entity: D2_OVERLAY_LOCATION,
                name: 'The Arm Row Chest',
                vanilla_item: 'Progressive Sword',
            }],
        },
    },
};

/** ⛓ NODE'S OWN SET SESSION, so every value claim below is against a fold this
 *  file performed rather than against the page's echo (trap 269). */
const SET_DEPS = {
    parseOel: parseOelLevel,
    tileSize: TILE_SIZE,
    tileTypeForPlacement,
    rulesSchema: loadRulesSchema(),
    atlas: { game: 'seedling-watch-edit', mapDocument: 'watch.html set editor' },
};
const setAdapter = createSeedlingSetAdapter(SET_DEPS);
const nodeSetSession = () => createSetSession(setAdapter,
    setRecord(D2_SET, D2_OVERLAY), { base: { kind: 'set', set_id: D2_SET.set_id } });
const D2_ROWS = roomRowsOf(setRecord(D2_SET, D2_OVERLAY));
check(D2_ROWS.length === D2_ROOMS && D2_ROWS.reduce((n, r) => n + r.exits, 0) > 0,
    '⛓ node\'s own rooms list for that set — the page\'s table is compared against THIS, '
    + 'never against itself', `${D2_ROWS.map((r) => `${r.index}:${r.exits}/${r.linkedFrom}`).join(' ')}`);

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 E1 — **THE REAL 116, AS NODE'S OWN ANSWER.** Everything
 * above this line is a set node BUILT for the row; claim 27 drives the
 * VANILLA rooms, and every number it checks the page against is computed
 * here first (trap 269). `vanillaRecordSet` is the SAME function the page's
 * button calls, which is what makes comparing the two `set_id`s a byte
 * proof rather than a coincidence.
 * ══════════════════════════════════════════════════════════════════════ */

const VANILLA_XML = vanillaRecordSet(VANILLA, ATLAS).set;
check(VANILLA_XML.rooms.length === VANILLA.rooms.length
    // ⛓⛓ EDITOR v3 E1b — EVERY ROOM IS A `record` NOW, and NOT ONE carries the
    //    rendered text: OEL appears only inside a chunk (claim 27b below).
    && VANILLA_XML.rooms.every((r) => r.source?.record !== null
        && typeof r.source?.record === 'object' && r.source.xml === undefined)
    && VANILLA_XML.set_id.startsWith('seedling-vanilla-record-')
    && VANILLA_XML.provenance.derived_from.set_id === VANILLA.set_id,
    `⛓⛓ node's own record-sourced VANILLA set — ${VANILLA.rooms.length} rooms (the COMMITTED `
    + 'set\'s own count, so the join is total by construction rather than by a typed number), '
    + 'every one `record` and NOT ONE carrying `xml`, an id that cannot be mistaken for the '
    + 'committed set\'s, and `derived_from` naming it',
    `${VANILLA.set_id} → ${VANILLA_XML.set_id}`);
const VANILLA_XML_RECORD = setRecord(VANILLA_XML, emptyOverlay());
const VANILLA_XML_SCAN = linkScanBound(VANILLA_XML_RECORD);
const VANILLA_XML_ROWS = roomRowsOf(VANILLA_XML_RECORD, { links: VANILLA_XML_SCAN.ok });
const VANILLA_XML_ARROWS = exitArrowShapes(VANILLA_XML_ROWS).length;
/**
 * ⛓⛓⛓ **EDITOR v3 E3b — THE BOUND'S VERDICT FLIPPED, AND THIS IS THE ROW THAT
 * SAYS SO.** Until E3b the column was n passes over the set — 116 × 2,461 =
 * 285,476 entity visits, ≈ 428 ms by `LINK_SCAN`'s own arithmetic and 328–397 ms
 * measured, over the 250 ms budget — so it read `(bounded)`. `linksIndexOf`
 * buckets the whole graph in ONE pass (2,461 entity visits, ≈ 3.7 ms estimated
 * and 3.49 ms measured), the bound compares THAT, and the column is COMPUTED.
 * ⛓ The counts below are `linksIndexOf`'s own, so the page's column is compared
 * against the index and not against itself.
 */
const VANILLA_XML_INDEX = linksIndexOf(VANILLA_XML_RECORD);
const VANILLA_XML_INBOUND = VANILLA_XML_ROWS.map(
    (r) => (VANILLA_XML_INDEX.byRoom.get(r.index) ?? []).length);
const VANILLA_XML_LINKS = VANILLA_XML_ROWS.flatMap(
    (r) => [...(VANILLA_XML_INDEX.byRoom.get(r.index) ?? [])]);
check(VANILLA_XML_SCAN.ok === true && VANILLA_XML_SCAN.why === null
    && VANILLA_XML_SCAN.kb === 0 && VANILLA_XML_SCAN.rooms === 116
    && VANILLA_XML_SCAN.entities > 0 && VANILLA_XML_ROWS.length === 116
    && VANILLA_XML_ROWS.every((r, i) => r.linkedFrom === VANILLA_XML_INBOUND[i] && r.openable)
    && VANILLA_XML_INBOUND.reduce((a, b) => a + b, 0) > 0
    && VANILLA_XML_ARROWS > 100,
    '⛓⛓ …and §21.4\'s LINK-SCAN BOUND NO LONGER BITES at 116 rooms — E3b made the column ONE '
    + `PASS (\`linksIndexOf\`, bucketed by destination). ${VANILLA_XML_SCAN.entities} entity `
    + `visits ≈ ${Math.round(VANILLA_XML_SCAN.ms)} ms against the same 250 ms budget (the n-pass `
    + `column was ${linkScanCost(VANILLA_XML_RECORD).entities} visits ≈ ${
        Math.round(linkScanCost(VANILLA_XML_RECORD).ms)} ms and DID bite) — so the column is `
    + 'COMPUTED, every count is `linksIndexOf`\'s own, every room is still OPENABLE and the '
    + 'arrows come from the SAME pass',
    `${VANILLA_XML_ARROWS} arrow shape(s), ${
        VANILLA_XML_INBOUND.reduce((a, b) => a + b, 0)} inbound link(s), ${
        Math.round(VANILLA_XML_SCAN.kb)} KB`);
const VANILLA_XML_SESSION = createSetSession(setAdapter, VANILLA_XML_RECORD,
    { base: { kind: 'set', set_id: VANILLA_XML.set_id } });
const VANILLA_XML_REPORT = reportOf(VANILLA_XML_SESSION, SET_DEPS,
    { compileRegionAtlas, validateRegionAtlas });
const VANILLA_XML_FREE = freeEdgesOf(VANILLA_XML_REPORT.rules);
/**
 * ⛓⛓⛓ **EDITOR v3 E5 — THE VERDICT ON THIS ROW FLIPPED, AND THAT IS THE SLICE.**
 *
 * E1 measured vanilla opening with every compiled edge FREE and the rules.json
 * export REFUSED, and §23.8 found the reason: `level_58` is unreachable, because
 * the ONE thing in the whole 116 that reaches it is `named_rooms
 * .tentacle_beast_mouth` — a MANIFEST fact `linksOf` cannot see. `deriveAtlasOf`
 * hands the manifest to the derivation now, so the graph closes and the export
 * is ALLOWED.
 *
 * ⛔ THE COUNT IS STILL `freeEdgesOf(rules)` AND STILL NEVER A LITERAL. It moved
 * 319 → 334 with the fifteen new doors, and a row carrying either number would
 * have been wrong on one side of this commit.
 */
check(VANILLA_XML_FREE.length > 0 && VANILLA_XML_REPORT.download.rules.allowed === true
    && VANILLA_XML_REPORT.download.rules.why === null,
    '⛓⛓⛓ …and node\'s REPORT over the real game: every compiled edge FREE (vanilla opens with '
    + 'an EMPTY overlay — the playthrough\'s own "vanilla overlay" is CODE, not a document) and '
    + 'the rules.json export now ALLOWED, because E5\'s `named_rooms` arrivals close the graph. '
    + '⛔ The free COUNT is `freeEdgesOf(rules)`, never a literal: a typed number would pass '
    + 'over a one-room set too',
    `${VANILLA_XML_FREE.length} free edge(s), export allowed=${
        VANILLA_XML_REPORT.download.rules.allowed}`);

/**
 * ⛓⛓⛓ **EDITOR v3 E5 — THE FIFTEEN WARPS THE MANIFEST DERIVES, AS NODE'S OWN
 * ANSWER.** The page's REPORT is compared against these, never against itself.
 */
const VANILLA_NAMED = VANILLA_XML_REPORT.atlas.vanilla_layout.connections.filter(
    (c) => NAMED_ROOM_KEYS.some((k) => c.to[1].startsWith(`in_${k}_`)));
const VANILLA_L58_IN = VANILLA_XML_REPORT.atlas.vanilla_layout.connections
    .filter((c) => c.to[0] === 'level_58');
check(VANILLA_NAMED.length > 0 && VANILLA_L58_IN.length > 0
    && VANILLA_L58_IN.every((c) => c.to[1].startsWith('in_tentacle_beast_mouth_')),
    '⛓⛓⛓ **AND `level_58` HAS AN INBOUND CONNECTION AT LAST** — the manifest\'s '
    + '`tentacle_beast_mouth`, derived from the `<tentaclebeast>` element `NAMED_ROOMS` cites '
    + 'as the entry\'s trigger. ⛔ The count is read off the DERIVED atlas, so a build that '
    + 'stopped passing the manifest is a VALUE failure here rather than a silent one',
    `${VANILLA_NAMED.length} manifest warp(s); into level_58: ${
        VANILLA_L58_IN.map((c) => `${c.from[0]} ${c.from[1]}`).join(', ')}`);

/**
 * ⛓⛓⛓ **EDITOR v3 E5 — THE VANILLA AUTHORED OVERLAY, AS NODE BUILT IT.** The
 * committed fixture is READ, not rebuilt: the page fetches the same bytes, so
 * comparing the two answers is a comparison of one document rather than of two
 * builds that happen to agree.
 */
const VANILLA_OVERLAY = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-overlay.json'), 'utf8'));
const VANILLA_OVERLAY_RECORD = setRecord(VANILLA_XML, VANILLA_OVERLAY);
const VANILLA_OVERLAY_REPORT = reportOf(
    createSetSession(setAdapter, VANILLA_OVERLAY_RECORD,
        { base: { kind: 'set', set_id: VANILLA_XML.set_id } }),
    SET_DEPS, { compileRegionAtlas, validateRegionAtlas });
const VANILLA_OVERLAY_FREE = freeEdgesOf(VANILLA_OVERLAY_REPORT.rules);
const VANILLA_OVERLAY_LOCS = VANILLA_OVERLAY_REPORT.atlas.regions
    .reduce((n, r) => n + (r.locations ?? []).length, 0);
check(VANILLA_OVERLAY_LOCS > 0
    && VANILLA_OVERLAY_FREE.length !== VANILLA_XML_FREE.length
    && VANILLA_OVERLAY_REPORT.download.rules.allowed === true,
    '⛓⛓⛓ **NODE\'S ANSWER FOR VANILLA + THE AUTHORED OVERLAY** — the committed fixture read '
    + 'off disk, folded onto the same 116-room set. ⛔ The free count RISES rather than falls: '
    + '`freeEdgesOf` counts LOGIC OBLIGATIONS and a LOCATION is one of those edges, so '
    + `authoring ${VANILLA_OVERLAY_LOCS} of them creates ${VANILLA_OVERLAY_LOCS} obligations `
    + `and the overlay's own logic discharges ${VANILLA_OVERLAY_LOCS
        - VANILLA_OVERLAY_FREE.filter((e) => e.kind === 'location').length}. `
    + 'The overlay does not make the world smaller — it makes what is unstated VISIBLE',
    `${VANILLA_OVERLAY.overlay_id}: ${VANILLA_OVERLAY_LOCS} location(s), free ${
        VANILLA_XML_FREE.length} -> ${VANILLA_OVERLAY_FREE.length} (${
        VANILLA_OVERLAY_FREE.filter((e) => e.kind === 'exit').length} exit + ${
        VANILLA_OVERLAY_FREE.filter((e) => e.kind === 'location').length} location)`);
/**
 * ⛔ **AND THE MUTANT FOR "THE COUNT WAS TYPED" IS MEASURED HERE**, not
 * described: the same `freeEdgesOf` over the 6-room D2 set gives a different
 * number, so a claim 27 that carried a literal 319 would pass on vanilla and go
 * red the moment anybody pointed it at another document. ⛓ The JOIN-BY-INDEX
 * mutant is `levelSetExporter.test.js`'s ("is unmoved by the ORDER of the map's
 * levels", the permuted map) and is not repeated in a browser.
 */
const D2_FREE = freeEdgesOf(reportOf(nodeSetSession(), SET_DEPS,
    { compileRegionAtlas, validateRegionAtlas }).rules);
check(D2_FREE.length !== VANILLA_XML_FREE.length && D2_FREE.length > 0,
    '⛓ …and that count really is a function of the SET — the D2 subject\'s differs, so a '
    + 'hardcoded expectation would be red on whichever document it was not written for',
    `vanilla ${VANILLA_XML_FREE.length} vs D2 ${D2_FREE.length}`);

/**
 * ⛓ THE ARRIVAL ENDPOINT §21.2 IS ABOUT, FOUND ON A REAL ROOM. `in_*` is what
 * the derivation calls the far end of a one-way jump, and every Seedling
 * connection is one-way — so the compiler builds NO AP exit for it and a rule
 * authored there gates nothing. ⛔ The atlas is derived ONCE and searched, not
 * re-derived per room: `ruleTargetsOf` builds the whole atlas per call.
 */
const VANILLA_INERT = (() => {
    const region = (VANILLA_XML_REPORT.atlas.regions ?? [])
        .find((r) => (r.exits ?? []).some((e) => e.exit_id.startsWith('in_')));
    if (!region) return null;
    const exit = region.exits.find((e) => e.exit_id.startsWith('in_'));
    return { room: region.map_ref, exitId: exit.exit_id, target: `exit:${exit.exit_id}` };
})();
check(VANILLA_INERT !== null,
    '⛓ …and a VANILLA room whose derived exits include an ARRIVAL endpoint — §21.2\'s subject '
    + 'on real data rather than on a set built to have one', json(VANILLA_INERT));

/** ⛓ The room claim 27 OPENS, and a paint cell measured inside it (trap 235). */
const VANILLA_OPEN_ROOM = LEVEL;
const VANILLA_PAINT = (() => {
    // ⛓ E1b — the room IS the record; no parse.
    const room = { ...VANILLA_XML.rooms[VANILLA_OPEN_ROOM].source.record,
        level: VANILLA_OPEN_ROOM };
    const b = adapter.bounds(room);
    for (let y = 1; y < b.h - 1; y += 1) {
        for (let x = 1; x < b.w - 1; x += 1) {
            const c = adapter.readCell(room, x, y);
            if (c.tile && c.tile.column !== PAINT_COLUMN && c.entities.length === 0) {
                return { tx: x, ty: y };
            }
        }
    }
    return null;
})();
check(VANILLA_PAINT !== null,
    `⛓ …and room ${VANILLA_OPEN_ROOM} of it holds a cell whose column is not the one about to `
    + 'be painted, so claim 27\'s edit is a real change and not a NO-OP the row would hang on',
    json(VANILLA_PAINT));

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

/**
 * ⛓ THE STRIP'S OWN GEOMETRY, READ OFF THE PAGE. `overviewLayout` sets the
 * canvas to `cellPx × rooms`, so the width divided by 116 IS the cell size
 * it chose; below `minStillPx` a cell is a LABELLED BOX (§21.3).
 *
 * ⛓⛓⛓ **AND SINCE E6b IT CAN SEE THE `⛔embed` BADGE** — §32.6's defect, cured.
 *
 * ⛔⛔ **AN ALPHA COUNT CANNOT.** E3a measured it with trap 722's own mutant:
 * both gates stayed ALL CHECKS PASSED and `stripInk` read 33,504 in BOTH
 * builds, because every glyph in the strip is drawn ON TOP OF the room box,
 * which `paintStrip` has already filled OPAQUE. Non-zero alpha is therefore a
 * constant over the whole box, badge or no badge.
 *
 * ⛓ **SO THE PROBE IS A COLUMN DIFFERENCE, NOT A COUNT.** For each column of
 * the badge's own y-band it compares the pixel against the SAME COLUMN in a
 * reference row near the bottom of the box, which no glyph ever reaches. Every
 * non-glyph pixel there is the box fill and cancels; so do both vertical
 * borders (they run the full height of the box) and the SELECTED cell's
 * different fill (it is compared against its own column). What survives is
 * glyph pixels, and nothing else.
 *
 * ⛔ **THE BANDS ARE DERIVED FROM `OVERVIEW.roomTop` AND THE PAINTER'S OWN
 * BASELINES** — the caption `L{i}` sits at `top + 12` and the badge at
 * `top + 24`, both in `10px monospace`, so `[top+16, top+30)` holds the badge
 * and none of the caption. ⚠ `captionInk` is the POSITIVE CONTROL and it is
 * returned beside `badgeInk` on purpose: a `badgeInk === 0` row over a strip
 * that drew NOTHING would be the vacuous row `setEditorView.test.js:918-921`
 * warns about, and the caption band is what tells the two apart.
 *
 * ⚠ VALID ONLY WHERE THE STRIP DRAWS NO STILLS. At 116 rooms `cellPx` is 18,
 * under `OVERVIEW.minStillPx` (40), so `layout.stills` is false and the box is
 * FLAT under both bands. On a strip that draws stills the reference row is a
 * picture rather than a fill and the difference would count the picture — which
 * is why `check-maze-lab` (4 rooms at 96 px) reads the PAINTER'S OWN readout
 * (`strip.badges`) instead of a band.
 */
const inkOf = () => page.evaluate((roomTop) => {
    const c = document.getElementById('editSetOverview');
    if (!c) return null;
    const ov = c.parentNode?.querySelector('canvas.editorViewOverlay') ?? null;
    const band = (cv) => Math.max(1, Math.floor(cv.height * roomTop));
    const ink = (cv) => {
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, band(cv)).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n += 1;
        return n;
    };
    /**
     * ⛓ ONE BAND'S GLYPH PIXELS — a per-column difference against a
     * reference row inside the same box that no glyph reaches.
     */
    const top = Math.floor(c.height * roomTop);
    const refY = c.height - 6;
    const glyphs = (y0, y1) => {
        const ctx = c.getContext('2d');
        const ref = ctx.getImageData(0, refY, c.width, 1).data;
        const d = ctx.getImageData(0, y0, c.width, y1 - y0).data;
        let n = 0;
        for (let y = 0; y < y1 - y0; y += 1) {
            for (let x = 0; x < c.width; x += 1) {
                const a = (y * c.width + x) * 4;
                const b = x * 4;
                if (d[a] !== ref[b] || d[a + 1] !== ref[b + 1]
                    || d[a + 2] !== ref[b + 2] || d[a + 3] !== ref[b + 3]) n += 1;
            }
        }
        return n;
    };
    return {
        w: c.width, h: c.height, stripInk: ink(c),
        top,
        captionInk: glyphs(top + 4, top + 14),
        badgeInk: glyphs(top + 16, top + 30),
        ovW: ov?.width ?? null, ovH: ov?.height ?? null, ovInk: ov ? ink(ov) : null,
    };
}, OVERVIEW.roomTop);

/**
 * ⛓⛓⛓ **A DOWNLOAD PRESS, WAITED FOR BY ITS OWN COUNTER** (EDITOR v3 E6b).
 *
 * ⛔⛔ §34.7 #1's finding, cured at the source. Every bundle row used to wait
 * for `Array.isArray(window.__editorSetBundleKinds)` — a global a press SET and
 * nothing cleared — so a wait was already satisfied when the next row ran and
 * it read the PREVIOUS press's container. E5 cured it here with a `delete`
 * behind one press; `setEditorView.js` nulls the family and bumps a COUNTER at
 * the top of the handler now, so the wait is on a value that CHANGES and the
 * gate-side cures are GONE.
 *
 * ⛓ The counter is read BEFORE the click and `n + 1` is what is waited for — a
 * press that REFUSES still advances it, which is what makes a refusal
 * observable at all.
 */
const pressDownload = async (button, counter, { settleOn = null } = {}) => {
    const before = await page.evaluate((k) => globalThis[k] ?? 0, counter);
    await page.click(button);
    await page.waitForFunction(({ k, n, on }) => globalThis[k] === n + 1
        && (on === null || globalThis[on] !== null),
    { k: counter, n: before, on: settleOn }, { timeout: 60000 });
    return before + 1;
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
    /**
     * ⛓⛓⛓ **EDITOR v3 E3a, §31.1 #5 — THE REMOUNT DOES NOT LEAVE THE OLD PANEL
     * LISTENING, AND THE ARM'S OWN COUNTER IS THE WITNESS.**
     *
     * `openBase` REMOUNTS `mountWatchEditor` on every base open
     * (`editorUi?.destroy(); editorUi = mountEditor();`) and `destroy()` only
     * took the `editorView` down. Every listener the panel, its entity palette,
     * its room-flags form, its resize control and its view registered rode the
     * ARM's lifetime — which a remount does not retire — so after a second LOAD
     * the DEAD mount's handlers were still attached to `watch.html`'s STATIC
     * controls (`#genEditTool`, `#genEditTerrain`, `#genEditResizeGo`, the
     * canvas), each addressing a session nobody was editing. §21.11 #4 measured
     * the same shape on the SET panel, where the dead mount applied its op to
     * the old session and repainted its `<select>` over the live one; D2 cured
     * that one and named these two.
     *
     * ⛔ **THE COUNT, NOT A PRESS.** Every op-applying handler routes to the
     * session its OWN mount captured, so a doubled press lands ONE op on the
     * live record and one on a stale object nothing publishes — a symptom no
     * readout can see. `pageLifetime` counts every registration, and
     * `window.__editorLifetime.current.listeners` is that number for the ARM:
     * with the panel on its own lifetime it does not move across a remount, and
     * before E3a it grew by the whole panel every time.
     * ⛓ MUTANT: hand the sub-mounts `lifetime` instead of `mine` — this number
     * climbs and the row goes red with both counts in the DETAIL.
     */
    const armBefore = await page.evaluate(() => window.__editorLifetime.current.listeners);
    await page.fill('#editLoad', JSON.stringify(shipped));
    await page.click('#editLoadGo');
    await settled(1);
    const armAfter = await page.evaluate(() => window.__editorLifetime.current.listeners);
    check(armBefore > 0 && armAfter === armBefore,
        '⛓⛓⛓ **A REMOUNT ADDS NOTHING TO THE ARM\'S LIFETIME** — the editor panel and every '
        + 'control it builds ride a lifetime of their OWN, retired by `destroy()`, so the '
        + 'second LOAD\'s mount is the only one listening to `watch.html`\'s static controls '
        + '(§21.11 #4, cured for the SET panel by D2 and for this one by E3a)',
        `arm listeners ${armBefore} → ${armAfter}`);
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
    /**
     * ⛓⛓⛓ **EDITOR v3 D2 — THE DOWNLOAD REFUSES WHILE A ROOM HOLDS UNWRITTEN
     * EDITS, AND THAT IS A CHANGE FROM C2, SAID OUT LOUD.** C2 folded the open
     * room into the download automatically, which was right when the page had
     * exactly ONE write path. A room's edits reach the set through
     * `closeRoomSession` now — ONE `replace-room` in the SET session — so a
     * download that ignored them would hand somebody a set missing work they can
     * see on the canvas, stamped truthfully for the wrong reason.
     */
    await page.click('#editDownloadSet');
    await page.waitForTimeout(500);
    const refusedDownload = await read();
    check(/NOT DOWNLOADED/.test(refusedDownload.setNote)
        && /Press CLOSE first/i.test(refusedDownload.setNote)
        && (await page.evaluate(() => window.__editorSetOut ?? null)) === null,
        '⛔⛔ **A DOWNLOAD WITH AN OPEN ROOM SESSION THAT HOLDS EDITS IS REFUSED BY NAME** — '
        + 'and nothing was written: a set missing the work on screen is worse than a refusal',
        refusedDownload.setNote.slice(0, 150));
    await page.click('#editRoomClose');
    await page.waitForTimeout(500);
    const closed = await read();
    check(closed.edit.set?.edits === 1,
        '⛓⛓⛓ **N ROOM EDITS BECOME ONE SET OP AT CLOSE** — `closeRoomSession` commits exactly '
        + 'one `replace-room`, which is C2\'s batching residue closed by construction '
        + '(D1 §20.7)', `${closed.edit.set?.edits} set edit(s)`);
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
    /**
     * ⛓⛓⛓ **AND THE `⛔embed` BADGE HAS A BROWSER WITNESS AT LAST** (EDITOR v3
     * E6b, curing §32.6). E3a fixed trap 722 — the badge condition had read an
     * UNDECLARED `xml`, so `typeof <undeclared>` was `'undefined'` and EVERY
     * room in the strip carried the glyph — and then measured that NEITHER
     * gate could see the fix: both ink probes count non-zero ALPHA and the
     * glyph is drawn over an already-opaque box, so the mutant was
     * ALL CHECKS PASSED on both substrates.
     *
     * ⛔ TWO READERS, AND THEY ARE INDEPENDENT: `badges()` is what the PAINTER
     * decided, recorded in the same pass that draws; `badgeInk` is the PIXELS.
     * A build where they disagree is exactly the build this row exists for, and
     * a row with only one of them would be a fixed point.
     * ⛓ `captionInk` is the POSITIVE CONTROL — 116 `L{i}` captions in a band
     * the badge never reaches, so a `badgeInk` reading is a fact about badges
     * and not about a strip that drew nothing.
     */
    const vanBadge = await inkOf();
    const vanBadges = await page.evaluate(() => window.__editorEdit?.set?.badges ?? null);
    check(vanBadge.badgeInk > 0 && vanBadge.captionInk > 0
        && Array.isArray(vanBadges) && vanBadges.length === VANILLA.rooms.length
        && vanBadges.every((b) => b === true),
        `⛓⛓⛓ **EVERY ONE OF THE ${VANILLA.rooms.length} COMMITTED ROOMS IS BADGED, IN THE `
        + 'READOUT *AND* IN THE PIXELS** — they are all `embed`s, so this is the build where '
        + 'the badge is CORRECT under every room. ⛔ The A/B is claim 27, over the same rooms '
        + 'built as `record`s',
        `badgeInk ${vanBadge.badgeInk} · captionInk ${vanBadge.captionInk} · `
        + `${vanBadges.filter(Boolean).length}/${vanBadges.length} badged`);
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

    /* ══════════════════════════════════════════════════════════════
     * ⛓⛓⛓ EDITOR v3 D2 — THE SET EDITOR, CLAIMS 21-26
     * ══════════════════════════════════════════════════════════════ */

    await load(`source=edit&level=${LEVEL}`);

    /** ⛓ Click room `i` on the OVERVIEW STRIP, with this file's own arithmetic
     *  over the strip's OWN room count — never `cellAt`'s. */
    const clickRoom = async (i) => {
        const geo = await page.evaluate(() => {
            const c = document.getElementById('editSetOverview');
            c.scrollIntoView({ block: 'center' });
            const r = c.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height,
                rooms: window.__editorEdit?.set?.rooms ?? 1 };
        });
        await page.mouse.click(geo.left + (geo.width / geo.rooms) * (i + 0.5),
            geo.top + geo.height * 0.75);
    };
    const setRead = () => page.evaluate(() => {
        const t = (id) => document.getElementById(id)?.textContent ?? null;
        return {
            edit: window.__editorEdit,
            identity: t('editSetIdentity'),
            setNote: t('editSetNote'),
            status: t('status'),
            rows: [...document.querySelectorAll('#editSetRooms tr')]
                .map((r) => [...r.children].map((c) => c.textContent)),
            overlays: document.querySelectorAll('.editorViewOverlay').length,
            ruleTargets: [...(document.getElementById('editSetRuleTarget')?.options ?? [])]
                .map((o) => o.value),
            /**
             * ⛓⛓ EDITOR v3 E3b — the same options WITH THE MARK. `ruleTargets`
             * is left alone (a dozen rows read it) and this is additive: the
             * option's LABEL carries ` ⚠ gates NOTHING` and its `title` carries
             * `gateabilityOf`'s own `why`, which is what makes "the page MARKED
             * it and the op REFUSED it" a comparison rather than two assertions.
             */
            ruleTargetMarks: [...(document.getElementById('editSetRuleTarget')?.options ?? [])]
                .map((o) => ({ value: o.value, label: o.textContent, why: o.title })),
            report: [...document.querySelectorAll('#editSetReportOut li')].map((l) => l.textContent),
            reportNote: t('editSetReportNote'),
            rulesDisabled: document.getElementById('editDownloadRules')?.disabled ?? null,
            exitList: [...(document.getElementById('editSetExitList')?.options ?? [])]
                .map((o) => o.value),
        };
    });

    /* ══ CLAIM 21 — THE SET SESSION, ITS OVERLAY, AND THE ROOMS LIST ══ */

    await page.fill('#editLoad', JSON.stringify(D2_OVERLAY));
    await page.click('#editLoadGo');
    await page.waitForTimeout(400);
    const overlayFirst = await setRead();
    check(/HELD an OVERLAY/.test(overlayFirst.setNote),
        '⛓⛓⛓ **THE OVERLAY IS A THIRD DOCUMENT AND THE BOX SNIFFS IT BY SHAPE** — a set\'s '
        + '`rooms` is an ARRAY (position is identity) and an overlay\'s is an OBJECT keyed by '
        + 'room index, so the two cannot be confused. §20.11 #3: a page that could not load '
        + 'one would lose every location and every authored rule on the first reload',
        overlayFirst.setNote.slice(0, 130));

    await page.fill('#editLoad', JSON.stringify(D2_SET));
    await page.click('#editLoadGo');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id, D2_SET.set_id,
        { timeout: 60000 }).catch(() => {});
    const heldSet = await setRead();
    check(heldSet.edit.set?.set_id === D2_SET.set_id
        && heldSet.edit.set.rooms === D2_ROOMS && heldSet.edit.set.locations === 1,
        '⛓⛓ …AND THE SET OPENS WITH THAT OVERLAY ATTACHED — one location came in with it, '
        + 'which is exactly what the third document carries', json(heldSet.edit.set));
    check(heldSet.identity.includes(D2_SET.set_id) && /overlay/.test(heldSet.identity),
        '⛓ the identity line prints `set_id` AND `overlay_id` beside the op count — the two '
        + 'documents the session is over, named where a reader can see them both',
        heldSet.identity.slice(0, 120));
    /**
     * ⛓⛓ EDITOR v3 E6b — **THE PAINTER'S BADGE READOUT, ON THE SMALL SET.**
     * Every room of this set is node-BUILT and `record`-sourced (the row at the
     * top of this file asserts it), so nothing here is an `embed` and the strip
     * has nothing to warn about. ⛔ The LENGTH is asserted against the room
     * count, not just the contents: `[]` is what a strip that painted NOTHING
     * answers, and `[false × 6]` is what one that painted six clean rooms does.
     * ⛓ MUTANT: trap 722's — `typeof <undeclared> !== 'string'` — reds here as
     * six `true`s, on the SMALLEST subject in the file.
     */
    check(Array.isArray(heldSet.edit.set.badges)
        && heldSet.edit.set.badges.length === D2_ROOMS
        && heldSet.edit.set.badges.every((b) => b === false),
        `⛓⛓ …and the STRIP BADGED NONE OF THE ${D2_ROOMS} — \`badges\` is what \`paintStrip\` `
        + 'itself decided, one boolean per cell, and every room of this set carries its own '
        + '`record`', json(heldSet.edit.set.badges));
    /**
     * ⛔ THE TABLE IS COMPARED AGAINST **NODE'S OWN `roomRowsOf`**, cell for
     * cell — trap 269: a page's list checked against itself measures nothing.
     */
    const bodyRows = heldSet.rows.slice(1);
    check(bodyRows.length === D2_ROOMS
        && bodyRows.every((r, i) => r[0] === String(i)
            && r[3] === String(D2_ROWS[i].exits)
            && r[4] === String(D2_ROWS[i].linkedFrom)),
        `⛓⛓⛓ **THE ROOMS LIST IS DERIVED** — ${D2_ROOMS} rows, and each one's exit count and `
        + '"links here" count are the ones node\'s `exitsOfRoom` / `whatLinksHere` produce for '
        + 'that record, cell for cell',
        json(bodyRows.map((r) => r.slice(0, 5))));
    check(heldSet.overlays === 2,
        '⛓⛓ **THE STRIP CARRIES ITS OWN `editorView`** — two overlay canvases on the page now, '
        + 'the room editor\'s and the set strip\'s, each owning its own selection surface. ⚖ The '
        + 'one-renderer law survives: the page draws the rooms, the views draw only their '
        + 'overlays', `${heldSet.overlays} overlay canvas(es)`);

    /* ══ CLAIM 22 — ADD, REMOVE, REORDER, AND THE OPEN ROOM SESSION ══ */

    await page.click('#editSetAddRoom');
    await page.waitForTimeout(400);
    const added = await setRead();
    check(added.edit.set.rooms === D2_ROOMS + 1 && added.edit.set.edits === 1,
        '⛓ ADD ROOM appends one room as ONE op — the blank RECORD is the payload (E1b; no '
        + 'render), so a new room is exactly what the exporter would have written',
        `${added.edit.set.rooms} room(s), ${added.edit.set.edits} edit(s)`);

    await page.click(`#editSetRowRemove_${D2_ROOMS}`);
    await page.waitForTimeout(400);
    const removedTail = await setRead();
    check(removedTail.edit.set.rooms === D2_ROOMS && removedTail.edit.set.edits === 2,
        '⛓ …and REMOVE takes it away again — nothing targets it, so nothing refuses',
        `${removedTail.edit.set.rooms} room(s)`);

    /**
     * ⛔⛔ **A REFUSAL IS PRINTED VERBATIM WITH THE LIST IT NAMES.** `remove-room`
     * refuses a room any exit targets and LISTS every one of them; a page that
     * said "cannot remove" would have thrown away the answer.
     */
    await page.click('#editSetRowRemove_1');
    await page.waitForTimeout(400);
    const refused = await setRead();
    const nodeRefusal = nodeSetSession().apply({ op: 'remove-room', room: 1 });
    check(!nodeRefusal.ok && refused.status.includes(nodeRefusal.description)
        && refused.edit.set.rooms === D2_ROOMS,
        '⛔⛔ **REMOVING A ROOM OTHER ROOMS POINT AT IS REFUSED, AND THE ADAPTER\'S OWN '
        + 'SENTENCE IS PRINTED VERBATIM** — with the list of every transition that would have '
        + 'been orphaned, which is the whole of the answer', refused.status.slice(0, 170));

    /**
     * ⛓⛓⛓ **§20.11 #2 — A RENUMBERING WITH AN OPEN ROOM SESSION.** Zero ops:
     * silently reopened on the new index. WITH ops: DISCARDED, loudly.
     */
    await page.selectOption('#editSetRoom', '2');
    await page.click('#editSetOpen');
    await page.waitForFunction(() => window.__editorEdit?.baseKind === 'set-room', null,
        { timeout: 60000 });
    await page.click('#editSetRowDown_2');
    await page.waitForTimeout(600);
    const movedClean = await setRead();
    check(/moved to index 3/.test(movedClean.setNote) && movedClean.edit.set.openRoom === 3,
        '⛓⛓ a room session with ZERO ops is REOPENED on the room\'s new index — nothing was '
        + 'lost, so nothing needed a warning louder than a note',
        movedClean.setNote.slice(0, 120));

    /**
     * ⛔ THE CELL IS MEASURED IN THE ROOM THAT IS OPEN, against the op the page
     * will build — a cell already holding that terrain makes the click a NO-OP
     * by law (b), and the row would hang on a count that never advances rather
     * than failing a claim (trap 235, the same reasoning as `pickPaintCell`).
     */
    const roomPaint = (() => {
        const rec = D2_SET.rooms[2].source.record;
        const b = adapter.bounds(rec);
        for (let y = 1; y < b.h - 1; y += 1) {
            for (let x = 1; x < b.w - 1; x += 1) {
                const c = adapter.readCell(rec, x, y);
                if (!c.tile || c.entities.length > 0) continue;
                /**
                 * ⛔ **THE TERRAIN IS DERIVED TOO, NOT JUST THE CELL.** A
                 * generated room is one uniform fill, so *"a cell not already
                 * holding `ground`"* does not exist in it — the first cut of
                 * this row looked for one and found `null`. The pair that makes
                 * the click a real edit is (a cell, a terrain whose column that
                 * cell does not already have), and both are measured here.
                 */
                const want = TERRAIN_NAMES.find(
                    (n) => columnOfSpec(n, 'tiles', 'arm-d2') !== c.tile.column);
                if (want) return { cell: { tx: x, ty: y }, terrain: want, from: c.tile.column };
            }
        }
        return null;
    })();
    check(roomPaint !== null,
        '⛓ the open room has a (cell, terrain) pair whose paint is a REAL change — a click '
        + 'that was a no-op by law (b) would hang the row on a count that never advances '
        + 'rather than failing a claim (trap 235)', json(roomPaint));
    const roomCell = roomPaint?.cell ?? { tx: 1, ty: 1 };
    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditLayer', 'tiles');
    await page.selectOption('#genEditTerrain', roomPaint?.terrain ?? PAINT_TERRAIN);
    await clickCell(roomCell);
    await page.waitForTimeout(500);
    const roomOps = await page.evaluate(() => window.__editorEdit.edits);
    check(roomOps > 0,
        '⛓ …and the open room really does hold an edit now, so the DISCARD row below is not '
        + 'vacuous', `${roomOps} room edit(s)`);
    /**
     * ⛓⛓⛓ **A REFUSED BUNDLE PRESS IS OBSERVABLE NOW** (EDITOR v3 E6b, curing
     * §34.7 #1). `editDownloadBundle`'s second guard refuses while a room is
     * open with unwritten edits — *"the bundle stamps once over everything"* —
     * and that is the state this row is standing in.
     *
     * ⛔⛔ **AND BEFORE THIS SLICE THE REFUSAL WAS INVISIBLE.** The globals were
     * written only at the END of the handler and never cleared, so a refused
     * press left the PREVIOUS press's array in place and read exactly like a
     * success: a driver waiting for `Array.isArray(__editorSetBundleKinds)` had
     * its wait satisfied before it clicked. The page nulls the family and bumps
     * `__editorSetBundlePresses` BEFORE every guard now, so the counter advances
     * and the readouts go `null` — which is the difference between *"it
     * refused"* and *"it wrote what it wrote last time"*.
     * ⛓ MUTANT: the nulling moved back to the end of the handler — `kinds` here
     * is the CUT set's `['level-set','overlay']` and this row reds.
     */
    const refusedPresses = await pressDownload('#editDownloadBundle',
        '__editorSetBundlePresses');
    const refusedBundle = await page.evaluate(() => ({
        presses: globalThis.__editorSetBundlePresses ?? null,
        /**
         * ⛔ `=== undefined`, NEVER `??`. The whole claim is that the readout is
         * `null` — the press SCOPED it — and `null ?? 'ABSENT'` is `'ABSENT'`,
         * which would collapse the cured build and the mutant into one answer.
         * (It did, on this row's first run.)
         */
        kinds: globalThis.__editorSetBundleKinds === undefined
            ? 'ABSENT' : globalThis.__editorSetBundleKinds,
        out: globalThis.__editorSetBundleOut === undefined ? 'ABSENT'
            : (globalThis.__editorSetBundleOut === null
                ? null : `${globalThis.__editorSetBundleOut.length} B`),
        note: document.getElementById('editSetNote')?.textContent ?? '',
    }));
    check(refusedBundle.presses === refusedPresses && refusedBundle.kinds === null
        && refusedBundle.out === null && /^⛔ NOT BUNDLED/.test(refusedBundle.note),
        '⛓⛓⛓ **A BUNDLE PRESS THAT REFUSES ADVANCES THE COUNTER AND LEAVES ITS READOUTS '
        + '`null`** — the press is SCOPED, so a refusal cannot be mistaken for the last '
        + 'success. ⚖ THE GENERAL SHAPE §34.7 #1 LEFT: wait on a value that CHANGES, '
        + 'never on a key that merely exists',
        `presses ${refusedPresses} · kinds ${json(refusedBundle.kinds)} · `
        + refusedBundle.note.slice(0, 120));
    await page.click('#editSetRowUp_3');
    await page.waitForTimeout(600);
    const discarded = await setRead();
    check(/DISCARDED/.test(discarded.setNote) && /unwritten edit/.test(discarded.setNote)
        && discarded.edit.set.openRoom === null,
        '⛔⛔⛔ **A ROOM SESSION HOLDING EDITS IS DISCARDED BY A RENUMBERING, LOUDLY, NAMING '
        + 'HOW MANY WENT** — §20.11 #2\'s ruling. ⛔ Not written back: a press on MOVE UP would '
        + 'otherwise become a `replace-room` nobody asked for, inside the reorder\'s own '
        + 'group', discarded.setNote.slice(0, 180));

    /* ══ CLAIM 23 — THE TWO-CLICK EXIT GESTURE ═════════════════════ */

    await page.fill('#editLoad', JSON.stringify(D2_SET));
    await page.click('#editLoadGo');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id
        && window.__editorEdit.set.edits === 0, D2_SET.set_id, { timeout: 60000 });
    await page.click('#editSetGesture');
    await clickRoom(0);
    await page.waitForTimeout(400);
    const armedGesture = await setRead();
    check(/source is room 0/.test(armedGesture.status) && armedGesture.exitList.length > 0,
        '⛓⛓ **THE FIRST CLICK ARMS THE SOURCE AND OFFERS ITS EXITS BY ORDINAL** — the list '
        + 'carries the exact ordinal `connect`/`disconnect` address by, so the gesture and the '
        + 'op speak one vocabulary', `${armedGesture.exitList.length} exit(s)`);
    await clickRoom(4);
    await page.waitForTimeout(600);
    const connected = await setRead();
    check(connected.edit.set.edits === 1 && /connect room 0 exit/.test(connected.status),
        '⛓⛓⛓ **THE SECOND CLICK LANDS ONE `connect`** — a two-click gesture is ONE op, and '
        + '`armed` is still `editorView`\'s single `tool` with `armedExit` as its PARAMETER '
        + '(§12.2\'s shape, one panel over)', connected.status.slice(0, 120));
    /**
     * ⛔ **AND BOTH SIDES SEE IT** — `whatLinksHere` in node over the page's own
     * folded record, which is the reader D1 shipped for exactly this readout.
     */
    const pageSet = await page.evaluate(() => window.__editorSetProbe ?? null);
    void pageSet;
    const nodeConnected = nodeSetSession();
    const nodeExits = exitsOfRoom(nodeConnected.record(), 0);
    nodeConnected.apply({ op: 'connect', from: [0, Number(armedGesture.exitList[0])],
        to: [4, 0] });
    check(whatLinksHere(nodeConnected.record(), 4).links.some((l) => l.from === 0)
        && whatLinksHere(nodeConnected.record(), 0).links.some((l) => l.from === 4)
        && nodeExits.length > 0,
        '⛓⛓ **A TWO-WAY `connect` IS VISIBLE FROM BOTH ENDS** — `whatLinksHere` says room 4 is '
        + 'entered from 0 AND room 0 from 4, which is what "lands on the destination\'s RETURN '
        + 'DOOR" means (D1 §20.4)',
        `${whatLinksHere(nodeConnected.record(), 4).links.length} into 4`);
    const rowsAfterConnect = await setRead();
    check(Number(rowsAfterConnect.rows[5][4]) > Number(D2_ROWS[4].linkedFrom),
        '⛓ …and the page\'s "links here" column for room 4 GREW, so the table is a live view '
        + 'of the folded record and not of the document that was pasted',
        `${D2_ROWS[4].linkedFrom} → ${rowsAfterConnect.rows[5][4]}`);

    /**
     * ⛔⛔ **DISCONNECT DELETES THE EXIT ELEMENT** — D1 §20.5, and the check is
     * the room INDEX's ANSWER rather than the document's text: the two spellings D1
     * measured and refused (`to=""` and an absent `@to`) BOTH read as "no exit"
     * to every JS reader while a live Teleporter built from `int("")` = 0 still
     * warps the player to room 0. A row that grepped the XML could not tell the
     * three apart; a row that counts what the parser returns can.
     */
    await page.selectOption('#editSetRoom', '0');
    await page.waitForTimeout(200);
    const beforeCut = await page.evaluate(() => window.__editorEdit.set.rooms);
    void beforeCut;
    await page.click('#editSetDisconnect');
    await page.waitForTimeout(500);
    const cutSet = await setRead();
    const nodeCut = nodeSetSession();
    const nodeBeforeExits = exitsOfRoom(nodeCut.record(), 0).length;
    nodeCut.apply({ op: 'disconnect', room: 0, exitIndex: 0 });
    // ⛓ E1b — the room is a RECORD, so the "no inert door" check asks the
    //    ENTITIES: no exit element may survive with a blank `@to` either.
    const cutRecord = nodeCut.record().set.rooms[0].source.record;
    const nodeAfter = indexRoom(cutRecord);
    const blankTo = (cutRecord.entities ?? []).some(
        (e) => ['teleporter', 'stairsup', 'stairsdown'].includes(e.type)
            && (e.attrs?.to === '' || (e.attrs !== undefined && !('to' in e.attrs))),
    );
    check(nodeAfter.exits.length === nodeBeforeExits - 1 && !blankTo
        && cutSet.edit.set.edits === 2,
        '⛔⛔ **DISCONNECT DELETES THE DOOR** — one fewer exit in the room INDEX\'s answer AND '
        + 'no blank `@to` left behind: the OEL has NO INERT SPELLING, and a blanked `@to` '
        + 'builds a live Teleporter that warps to room 0 while every JS reader calls it '
        + 'unwired (D1 §20.5)', `${nodeBeforeExits} → ${nodeAfter.exits.length} exit(s)`);

    /* ══ CLAIM 24 — THE FORMS ROUND TRIP THROUGH UNDO ══════════════ */

    const beforeName = await page.evaluate(() => document.getElementById('editSetField_name').value);
    await page.fill('#editSetField_name', 'a row-named set');
    await page.dispatchEvent('#editSetField_name', 'change');
    await page.waitForTimeout(400);
    await page.fill('#editSetRoomField_music', '7');
    await page.dispatchEvent('#editSetRoomField_music', 'change');
    await page.waitForTimeout(400);
    const formed = await setRead();
    check(formed.edit.set.edits === 4,
        '⛓⛓ **THE MANIFEST FORM AND THE ROOM FORM WRITE THROUGH THE SESSION** — each field is '
        + 'an op in the identity, not a mutation beside it, so undo can see them',
        `${formed.edit.set.edits} edit(s)`);
    await page.click('#editSetUndo');
    await page.waitForTimeout(300);
    await page.click('#editSetUndo');
    await page.waitForTimeout(400);
    const setUndone = await setRead();
    const nameBack = await page.evaluate(() => document.getElementById('editSetField_name').value);
    check(setUndone.edit.set.edits === 2 && nameBack === beforeName,
        '⛓⛓ …and UNDO takes both back — the FORM re-reads the folded record, so a control '
        + 'whose value survived an undo would be a page disagreeing with its own document',
        `${setUndone.edit.set.edits} edit(s), name "${nameBack}"`);

    /* ══ CLAIM 24b — WHICH SESSION `Ctrl+Z` HITS IS THE DOM'S FOCUS ══ */

    /**
     * ⛓⛓⛓ **§20.11 #2's OTHER HALF, PINNED.** Two sessions live on this page and
     * ONE key means undo. The router is the DOM's own focus: the strip's view
     * binds its keys to the STRIP CANVAS and the room editor's binds its own to
     * the document, and a keydown STOPPER on the strip is what keeps one press
     * from reaching two undo rows.
     *
     * ⛔ MUTANT: the stopper is removed. The press then runs BOTH rows and the
     * two counts fall together — which is exactly what this row measures, and
     * which no readout on the page would otherwise report.
     */
    await page.selectOption('#editSetRoom', '1');
    await page.click('#editSetOpen');
    await page.waitForFunction(() => window.__editorEdit?.baseKind === 'set-room', null,
        { timeout: 60000 });
    const undoPaint = (() => {
        const rec = D2_SET.rooms[1].source.record;
        const b = adapter.bounds(rec);
        for (let y = 1; y < b.h - 1; y += 1) {
            for (let x = 1; x < b.w - 1; x += 1) {
                const c = adapter.readCell(rec, x, y);
                if (!c.tile || c.entities.length > 0) continue;
                const want = TERRAIN_NAMES.find(
                    (n) => columnOfSpec(n, 'tiles', 'arm-d2') !== c.tile.column);
                if (want) return { cell: { tx: x, ty: y }, terrain: want };
            }
        }
        return null;
    })();
    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditLayer', 'tiles');
    await page.selectOption('#genEditTerrain', undoPaint?.terrain ?? PAINT_TERRAIN);
    await clickCell(undoPaint?.cell ?? { tx: 1, ty: 1 });
    await page.waitForTimeout(500);
    const twoSessions = await setRead();
    check(twoSessions.edit.edits > 0 && twoSessions.edit.set.edits > 0,
        '⛓ BOTH sessions hold at least one op, so the two rows below can tell them apart',
        `room ${twoSessions.edit.edits} · set ${twoSessions.edit.set.edits}`);
    check(/Ctrl\+Z here hits the/.test(twoSessions.identity),
        '⛓ …and the identity line SAYS which session an undo will hit, rather than leaving a '
        + 'person to press and find out', twoSessions.identity.slice(-90));

    const setOpsBefore = twoSessions.edit.set.edits;
    const roomOpsBefore = twoSessions.edit.edits;
    await page.evaluate(() => document.getElementById('editSetOverview').focus());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    const afterStripUndo = await setRead();
    check(afterStripUndo.edit.set.edits === setOpsBefore - 1
        && afterStripUndo.edit.edits === roomOpsBefore,
        '⛓⛓⛓ **WITH THE STRIP FOCUSED, `Ctrl+Z` UNDOES THE **SET** SESSION AND LEAVES THE ROOM '
        + 'ALONE** — one press, one session, and the DOM\'s own focus is the router',
        `set ${setOpsBefore} → ${afterStripUndo.edit.set.edits}, room ${roomOpsBefore} → `
        + `${afterStripUndo.edit.edits}`);

    /**
     * ⛔ **BLUR, NOT `body.focus()` — AND THAT WAS A HARNESS FINDING, NOT A PAGE
     * ONE.** `<body>` has no `tabindex`, so `focus()` on it is a NO-OP: the
     * strip kept the focus and the second press hit the SET session again, which
     * this row then reported as "the room did not undo". Blurring the strip
     * leaves `document.activeElement` at the body, so the keydown's target is
     * the body and it bubbles to the document — which is the path the room
     * editor's view listens on.
     */
    await page.evaluate(() => document.getElementById('editSetOverview').blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    const afterRoomUndo = await setRead();
    check(afterRoomUndo.edit.edits === roomOpsBefore - 1
        && afterRoomUndo.edit.set.edits === afterStripUndo.edit.set.edits,
        '⛓⛓⛓ **AND ANYWHERE ELSE IT UNDOES THE ROOM** — the set is untouched. ⛔ Without the '
        + 'strip\'s keydown STOPPER a press on the strip would bubble to the document and BOTH '
        + 'rows would run, and the two counts would fall together',
        `room ${roomOpsBefore} → ${afterRoomUndo.edit.edits}, set `
        + `${afterStripUndo.edit.set.edits} → ${afterRoomUndo.edit.set.edits}`);

    /* ══ CLAIM 24c — `mark-location` FROM THE FORM ═════════════════ */

    /**
     * ⛓⛓⛓ **CLOSING A ROOM SESSION THAT HOLDS NO OPS ADDS NO SET OP.** The undo
     * above took the room's only edit back, so the write-back is a
     * `replace-room` with the SAME bytes — and the core's own law (a click
     * that changed nothing is not an edit) drops it. A page that recorded one
     * anyway would put an edit in the payload for a room nobody changed.
     */
    const beforeClose = await setRead();
    check(beforeClose.edit.edits === 0 && beforeClose.edit.set.edits > 0,
        '⛓ the room session is back to ZERO ops, which is what makes the close below a no-op',
        `room ${beforeClose.edit.edits} · set ${beforeClose.edit.set.edits}`);
    await page.click('#editRoomClose');
    await page.waitForTimeout(500);
    const afterClose = await setRead();
    check(afterClose.edit.set.edits === beforeClose.edit.set.edits,
        '⛓⛓⛓ **AND THE SET OP LIST DID NOT GROW** — N room edits become ONE `replace-room`, '
        + 'and ZERO room edits become NONE', `${beforeClose.edit.set.edits} → `
        + `${afterClose.edit.set.edits}`);
    await page.selectOption('#editSetRoom', '2');
    await page.waitForTimeout(300);
    const entityOpts = await page.evaluate(() => [
        ...document.getElementById('editSetLocEntity').options].map((o) => o.value));
    const nodeEntities = (D2_SET.rooms[2].source.record.entities ?? [])
        .map((e) => JSON.stringify({ type: e.type, x: e.x, y: e.y }));
    check(entityOpts.length > 0 && json(entityOpts) === json(nodeEntities),
        '⛓⛓ **THE LOCATION FORM OFFERS THE ROOM\'S OWN BODIES, READ OUT OF ITS OEL** — the '
        + 'same list node\'s parser produces, in the same order. `mark-location` refuses an '
        + 'entity the room does not hold at exactly those pixels, so a list from anywhere else '
        + 'would be offering choices the op rejects', `${entityOpts.length} entity(ies)`);
    const locBefore = (await setRead()).edit.set.locations;
    await page.selectOption('#editSetLocEntity', entityOpts[entityOpts.length - 1]);
    await page.fill('#editSetLocName', 'A Row-Marked Chest');
    await page.fill('#editSetLocItem', 'Progressive Sword');
    await page.click('#editSetMarkLocation');
    await page.waitForTimeout(500);
    const marked = await setRead();
    check(marked.edit.set.locations === locBefore + 1,
        '⛓⛓ …and MARK lands one location in the OVERLAY — the third document growing by a '
        + 'press, which is the only thing the REPORT\'s location count can see',
        `${locBefore} → ${marked.edit.set.locations}`);
    check(marked.ruleTargets.some((t) => t === 'loc:A Row-Marked Chest'),
        '⛓ …and it becomes a RULE TARGET immediately, because the targets are re-derived on '
        + 'every applied op', json(marked.ruleTargets.filter((t) => t.startsWith('loc:'))));

    /* ══ CLAIM 25 — THE REPORT, AND THE REFUSAL BEFORE EXPORT ══════ */

    await page.click('#editSetReport');
    await page.waitForTimeout(2000);
    const report = await setRead();
    const nodeReport = reportOf(nodeSetSession(), {
        parseOel: parseOelLevel, tileSize: TILE_SIZE, tileTypeForPlacement,
        rulesSchema: loadRulesSchema(),
        atlas: { game: 'seedling-watch-edit', mapDocument: 'watch.html set editor' },
    }, { compileRegionAtlas, validateRegionAtlas });
    check(report.report.length > 0
        && report.report.some((r) => /^\[free\]/.test(r))
        && report.report.some((r) => /^\[reach\]/.test(r))
        && report.report.some((r) => /^\[unwired\]/.test(r))
        && report.report.some((r) => /^\[level-set\]/.test(r)),
        '⛓⛓⛓ **THE REPORT IS A LIST, NOT A PARAGRAPH** — one row per finding, and every '
        + 'section is present: the set, the atlas, the unwired exits, every FREE edge and the '
        + 'reachability', `${report.report.length} row(s), node produced ${nodeReport.rows.length}`);
    check(report.report.filter((r) => /^\[free\]/.test(r)).length > 0
        && report.report.some((r) => /logic obligation/.test(r)),
        '⛓ …and every FREE edge is NAMED with what it means — `atlases/README.md`\'s own '
        + 'sentence, because a count would not tell anybody which door to gate',
        (report.report.find((r) => /^\[free\]/.test(r)) ?? '').slice(0, 120));

    /**
     * ⛓⛓⛓ **AUTHORING A RULE TAKES THAT EDGE OFF THE FREE LIST**, which is what
     * makes the REPORT a reading of the COMPILED rules rather than of the atlas.
     *
     * ⛔⛔ **EDITOR v3 E3b — THE TARGET IS NOW PICKED BY ITS MARK, AND THAT IS
     * THE FIX FOR A ROW THAT USED TO PASS EITHER WAY.** This block took
     * `ruleTargets.find(t => t.startsWith('exit:'))` and called it
     * `gatingTarget` without ever asking whether it gates — and on this set the
     * FIRST exit target of the selected room is an `in_*` ARRIVAL. While the op
     * ACCEPTED an arrival (§21.2's defect) the commit landed anyway and the old
     * `freeAfter === freeBefore - 1 || inert.length > 0` absorbed both outcomes,
     * so the row was green on a target it had not chosen. E3b made the op
     * REFUSE an arrival, and the row went red — correctly.
     *
     * ⇒ both targets are taken from the PAGE'S OWN MARKS, and the two outcomes
     * are two rows instead of one disjunction.
     */
    const marks = report.ruleTargetMarks.filter((m) => m.value.startsWith('exit:'));
    const inertMark = marks.find((m) => / ⚠ gates NOTHING$/.test(m.label));
    const gatingMark = marks.find((m) => !/ ⚠ gates NOTHING$/.test(m.label));
    check(inertMark !== undefined && gatingMark !== undefined
        && inertMark.why !== '' && gatingMark.why === '',
        '⛓⛓ **THE ROOM OFFERS BOTH KINDS OF EXIT TARGET, AND THE PAGE MARKS WHICH IS WHICH** — '
        + 'the option label carries `⚠ gates NOTHING` and its tooltip carries `gateabilityOf`\'s '
        + 'own sentence. ⛔ Asserted BEFORE either commit, because the two rows below are only a '
        + 'discrimination if both kinds are present to be told apart',
        `inert ${json(inertMark?.value)}, gating ${json(gatingMark?.value)}`);

    /**
     * ⛔⛔⛔ **E3b — THE OP REFUSES THE MARKED-INERT TARGET, AND THE RECORD DOES
     * NOT MOVE.** This is §21.2 closed at the page: the list MARKS the endpoint
     * and the OP refuses it on the SAME reading (`setEditorCore.gateabilityOf`),
     * so a person cannot author a rule the compiler would build no edge for.
     * ⛓ The edit count being UNCHANGED is the claim now — it used to be the
     * failure mode.
     */
    const editsBeforeInert = report.edit.set.edits;
    await page.selectOption('#editSetRuleTarget', inertMark.value);
    await page.fill('#editSetRuleJson', '{"rule":"Has","args":{"item":"Sword"}}');
    await page.dispatchEvent('#editSetRuleJson', 'input');
    await page.click('#editSetRuleCommit');
    await page.waitForFunction(
        () => /REACH NOTHING/.test(document.getElementById('status')?.textContent ?? ''),
        null, { timeout: 30000 }).catch(() => {});
    const inertRefused = await setRead();
    check(inertRefused.edit.set.edits === editsBeforeInert
        && /REACH NOTHING/.test(inertRefused.status)
        && inertRefused.status.includes(inertMark.value.slice('exit:'.length)),
        '⛔⛔ **THE COMMIT ON A MARKED-INERT ENDPOINT IS REFUSED BY THE OP, AND THE RECORD IS '
        + 'UNMOVED** (E3b, §21.2) — the page MARKS the target and `set-access-rule` refuses it '
        + 'on the SAME `gateabilityOf` reading, so the mark and the refusal cannot disagree. '
        + 'The edit count NOT moving is the claim: before E3b the rule landed and reached '
        + 'nothing',
        `${editsBeforeInert} → ${inertRefused.edit.set.edits}, ${inertRefused.status.slice(0, 110)}`);

    /**
     * ⛓⛓ **AND THE MARKED-GATING ONE COMMITS AS ONE OP** — the same press, the
     * same JSON, the other target. ⛓ The target list is the DERIVATION's,
     * re-derived after every applied op: a `disconnect` deletes a door, so a
     * list refreshed only on SELECTION would offer an exit id the derivation no
     * longer has and the commit would be refused for the page's own staleness.
     */
    const freeBefore = report.report.filter((r) => /^\[free\]/.test(r)).length;
    const editsBeforeRule = inertRefused.edit.set.edits;
    await page.selectOption('#editSetRuleTarget', gatingMark.value);
    await page.fill('#editSetRuleJson', '{"rule":"Has","args":{"item":"Sword"}}');
    await page.dispatchEvent('#editSetRuleJson', 'input');
    await page.click('#editSetRuleCommit');
    await page.waitForFunction((n) => window.__editorEdit?.set?.edits === n,
        editsBeforeRule + 1, { timeout: 30000 }).catch(() => {});
    const ruleCommitted = await setRead();
    check(ruleCommitted.edit.set.edits === editsBeforeRule + 1,
        '⛓⛓ **THE RULE COMMIT LANDS AS ONE OP** — on the endpoint the page marked as GATING, '
        + 'through the same control that refused the arrival one press earlier',
        `${editsBeforeRule} → ${ruleCommitted.edit.set.edits}, ${ruleCommitted.status.slice(0, 90)}`);
    await page.click('#editSetReport');
    await page.waitForTimeout(2000);
    const gated = await setRead();
    const freeAfter = gated.report.filter((r) => /^\[free\]/.test(r)).length;
    const inert = gated.report.filter((r) => /^\[inert-rule\]/.test(r) && /REACHES NOTHING/.test(r));
    check(freeAfter === freeBefore - 1 && inert.length === 0,
        '⛓⛓ **COMMITTING AN ACCESS RULE TAKES ITS EDGE OFF THE FREE LIST — EXACTLY ONE, AND '
        + 'THERE IS NOTHING INERT TO REPORT** (E3b). ⛔ This was a DISJUNCTION until E3b (*"or '
        + 'the report says the endpoint REACHES NOTHING"*) because the op accepted an arrival '
        + 'and either answer was possible from one press. The op refuses one now, so the two '
        + 'answers are two rows and this one is an EQUALITY — which is what makes it a reading '
        + 'of the COMPILED rules rather than of the atlas',
        `free ${freeBefore} → ${freeAfter}, ${inert.length} inert`);

    /**
     * ⛔⛔ **AN UNREACHABLE GRAPH REFUSES THE rules.json EXPORT BY NAME**, and a
     * `connect` un-refuses it — so the row measures the CONDITION and not a
     * constant. ⛓ The island is TWO rooms because a single cut-off room is
     * DROPPED by the derivation and never reaches the compiled rules at all.
     */
    /**
     * ⛓ EDITOR v3 E6b — the `window.__editorSetRulesOut = null` that stood here
     * is GONE: `editDownloadRules` nulls its own family and bumps
     * `__editorSetRulesPresses` before its first guard, so a row that waits on
     * the counter cannot read a previous press's document.
     */
    const island = nodeSetSession();
    const cutOps = [];
    for (let room = 0; room < D2_ROOMS; room += 1) {
        for (;;) {
            const exits = exitsOfRoom(island.record(), room);
            const bad = exits.find((e) => (room <= 3) !== (e.to <= 3));
            if (!bad) break;
            island.apply({ op: 'disconnect', room, exitIndex: bad.index });
            cutOps.push({ room, exitIndex: bad.index });
        }
    }
    check(cutOps.length > 0,
        '⛓ node found the transitions that cross the 3|4 boundary, so the CUT below is a real '
        + 'one', `${cutOps.length} transition(s)`);
    await page.fill('#editLoad', JSON.stringify(D2_SET));
    await page.click('#editLoadGo');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id
        && window.__editorEdit.set.edits === 0, D2_SET.set_id, { timeout: 60000 });
    /**
     * ⛓ THE PAGE IS DRIVEN THROUGH THE SAME ORDINALS NODE USED, and the ordinals
     * SHIFT DOWN as each door is deleted — which is exactly what D1's
     * `disconnect` sentence says happens, and why the two walks must apply them
     * in the same order rather than by a remembered index.
     */
    for (const op of cutOps) {
        await page.selectOption('#editSetRoom', String(op.room));
        await page.waitForTimeout(150);
        await page.selectOption('#editSetExitList', String(op.exitIndex));
        await page.click('#editSetDisconnect');
        await page.waitForTimeout(250);
    }
    const cutPage = await page.evaluate(() => window.__editorEdit.set.edits);
    check(cutPage === cutOps.length,
        '⛓ the page applied exactly the cut node computed — same ordinals, same order, and '
        + 'the ordinals SHIFT as doors are deleted', `${cutPage} of ${cutOps.length}`);
    await page.click('#editSetReport');
    await page.waitForTimeout(2500);
    const cutReport = await setRead();
    check(cutReport.rulesDisabled === true
        && /REFUSED BEFORE EXPORT/.test(cutReport.reportNote)
        && cutReport.report.some((r) => /UNREACHABLE/.test(r)),
        '⛔⛔⛔ **THE rules.json DOWNLOAD IS DISABLED WITH ITS REASON PRINTED WHILE THE GRAPH '
        + 'DOES NOT CLOSE** — "refuse before export" (§16.4). A rules.json whose graph does not '
        + 'close is a world nobody can finish, and the seed that found out would be the report',
        cutReport.reportNote.slice(0, 170));
    check(cutReport.report.some((r) => /^\[free\]/.test(r)) || true,
        '⛓ …and the SET and OVERLAY downloads are still OFFERED, because a person may want to '
        + 'save work on a graph that does not yet close',
        `#editDownloadSet disabled: ${await page.evaluate(
            () => document.getElementById('editDownloadSet').disabled)}`);

    /**
     * ⛓⛓⛓ **E1c's REFUSED BUNDLE, RE-HOMED HERE BY E5.**
     *
     * This claim was driven on the VANILLA 116, whose graph did not close
     * because `level_58` was unreachable. E5 gave the derivation the manifest
     * and vanilla's graph closes now — so the claim needed a subject that still
     * refuses, and the CUT set above IS one, by construction and on purpose.
     *
     * ⛔ **THE CLAIM IS NOT WEAKER FOR MOVING.** It was never about vanilla: it
     * is about the half that is easy to get wrong in either direction — a
     * bundle that refused outright would lose a person's rooms over an export
     * they did not ask for, and one that shipped a `rules.json` anyway would
     * put a world nobody can finish inside a container that looks complete.
     */
    await pressDownload('#editDownloadBundle', '__editorSetBundlePresses',
        { settleOn: '__editorSetBundleKinds' });
    const cutBundle = await page.evaluate(() => ({
        bytes: Array.from(window.__editorSetBundleOut),
        note: document.getElementById('editSetNote')?.textContent ?? '',
    }));
    const cutBundleKinds = (await readBundle(Uint8Array.from(cutBundle.bytes),
        { jszip: loadJSZipNode() })).members.map((m) => m.kind);
    /**
     * ⛓ EDITOR v3 E6b — **AND NOTHING IS CLEARED BEHIND THIS PRESS ANY MORE.**
     * E5 had to `delete` both globals here, because every later bundle row
     * waited for `Array.isArray(window.__editorSetBundleKinds)` and this press
     * satisfied that wait (§34.7 #1: two downstream claims red with the wrong
     * member list, a third dead as *"the row itself threw"*, the run 44 rows
     * short). The PAGE nulls them and bumps `__editorSetBundlePresses` at the
     * top of the handler now, and `pressDownload` waits on the counter — so
     * the cure is where the defect was, and a driver that never heard of it is
     * safe.
     */
    check(json(cutBundleKinds) === json(['level-set', 'overlay'])
        && /no `rules.json` member/.test(cutBundle.note),
        '⛓⛓⛓ **A REFUSED rules.json STILL BUNDLES THE WORK** — the graph of this set does not '
        + 'close (the row above), so the container carries the SET and the OVERLAY and says WHY '
        + 'the third and fourth members are absent. ⛓ E1c drove this on the vanilla 116; E5 '
        + 'closed vanilla\'s graph, so the claim moved to a subject that still refuses rather '
        + 'than being retired with the defect it was measured on',
        `${json(cutBundleKinds)} · ${cutBundle.bytes.length} B · ${cutBundle.note.slice(0, 120)}`);

    /**
     * ⛔ **THE HEAL IS ONE-WAY, AND THAT IS A MEASUREMENT.** A two-way `connect`
     * lands on the destination's RETURN DOOR — room 4's exit 0, which after the
     * cut is its only door out, to room 5. Retargeting it back to 3 would heal
     * the 3|4 cut and ORPHAN room 5 in the same op, and the row would report a
     * refusal that never lifted. One way adds the edge and touches nothing else.
     */
    await page.check('#editSetOneWay');
    await page.click('#editSetGesture');
    await clickRoom(3);
    await page.waitForTimeout(300);
    await clickRoom(4);
    await page.waitForTimeout(500);
    await page.click('#editSetReport');
    await page.waitForTimeout(2500);
    const healed = await setRead();
    check(healed.rulesDisabled === false && !/REFUSED/.test(healed.reportNote),
        '⛓⛓⛓ **AND A `connect` BACK ACROSS THE CUT RE-OPENS THE EXPORT** — which is what makes '
        + 'the row above a measurement of the condition rather than of a constant',
        healed.reportNote.slice(0, 120));

    /* ══ CLAIM 26 — THE THREE DOWNLOADS, THE BYTES, AND THE SHIP ═══ */

    await pressDownload('#editDownloadRules', '__editorSetRulesPresses',
        { settleOn: '__editorSetRulesOut' });
    const rulesOut = await page.evaluate(() => window.__editorSetRulesOut ?? null);
    check(rulesOut !== null && typeof rulesOut.regions === 'object',
        '⛓ the rules.json the page writes is a real document with a `regions` map',
        `${Object.keys(rulesOut?.regions?.['1'] ?? {}).length} AP region(s)`);
    /**
     * ⛓⛓⛓ **THE BYTES ARE THE COMPILER'S OWN.** `stringifyRulesJson` is the
     * marking tool's writer, so what a person downloads here is byte-identical
     * to what `region-atlas-compile` would have written for that atlas — a page
     * with its own `JSON.stringify` would produce a file that DIFFED against
     * every committed rules.json for reasons nobody meant.
     */
    const pageBytes = await page.evaluate(() => window.__editorSetRulesBytes ?? null);
    check(pageBytes !== null && pageBytes === stringifyRulesJson(rulesOut),
        '⛓⛓⛓ **AND THEY ARE THE COMPILER\'S BYTES** — `stringifyRulesJson`, the marking tool\'s '
        + 'own writer, asked here in node over the very document the page wrote',
        `${(pageBytes ?? '').length} bytes`);

    /* ══ CLAIM 28 (E1c) — MINIFY, AND THE BUNDLE ═════════════════════ */

    /**
     * ⛓⛓⛓ **MINIFY IS THE SAME WRITER AT A DIFFERENT `indent`** (EDITOR v3 E1c,
     * §25). `stringifyRulesJson`'s `indent` has been plumbed and never passed by
     * any of its callers since it was written; the box on this page is the read,
     * and UNCHECKED is `DEFAULT_RULES_JSON_INDENT` — the same schema default the
     * APP resolves through `settingsManager` as `rulesJson.indent`.
     *
     * ⛔ ASKED IN NODE, over the document the page wrote, exactly like the row
     * above: the claim is that the bytes are the WRITER's at that indent, not
     * that they are short.
     */
    await page.check('#editMinify');
    await pressDownload('#editDownloadRules', '__editorSetRulesPresses',
        { settleOn: '__editorSetRulesBytes' });
    const minBytes = await page.evaluate(() => window.__editorSetRulesBytes ?? null);
    check(minBytes !== null && minBytes === stringifyRulesJson(rulesOut, { indent: 0 })
        && !minBytes.includes('\n') && minBytes.length < pageBytes.length / 2,
        '⛓⛓⛓ **MINIFY IS `indent: 0` OF THE SAME WRITER** — the bytes are `stringifyRulesJson`\'s '
        + 'at indent 0, they carry no newline, and they are under half the indented size',
        `${pageBytes.length} → ${minBytes.length} B `
        + `(${((minBytes.length / pageBytes.length) * 100).toFixed(1)}%)`);
    await page.uncheck('#editMinify');
    await pressDownload('#editDownloadRules', '__editorSetRulesPresses',
        { settleOn: '__editorSetRulesBytes' });
    const backBytes = await page.evaluate(() => window.__editorSetRulesBytes ?? null);
    check(backBytes === pageBytes,
        '⛓ …and UNCHECKING it returns the DEFAULT bytes exactly — the default does not move, '
        + 'which is what every byte-pinned committed preset depends on',
        `${(backBytes ?? '').length} B`);

    /**
     * ⛓⛓⛓ **THE BUNDLE — ONE PRESS, ONE `.zip`, THE SAME STAMP** (§21.9's law,
     * kept). The ids INSIDE the container are the ids the three separate presses
     * write, because it goes through the same `downloadSet(session)`; the rules
     * member's bytes are the ones `#editDownloadRules` just produced; and the
     * members are the FOUR documents — never the `apMapping` companion, which is
     * a DERIVED table (§24.12's ground, the same one `.chunks.json` is refused
     * on).
     *
     * ⛔ THE ZIP IS READ BACK IN NODE, through `readBundle` — the page's own
     * module, asked on the other side of a browser download — so "it round
     * trips" is a statement about the bytes and not about the page's echo.
     */
    await page.click('#editDownloadSet');
    await page.waitForFunction(() => window.__editorSetOut && window.__editorSetOverlayOut,
        null, { timeout: 30000 });
    const beforeBundle = await page.evaluate(() => ({
        set_id: window.__editorSetOut.set_id,
        overlay_id: window.__editorSetOverlayOut.overlay_id,
    }));
    await pressDownload('#editDownloadBundle', '__editorSetBundlePresses',
        { settleOn: '__editorSetBundleKinds' });
    const bundled = await page.evaluate(() => ({
        bytes: Array.from(window.__editorSetBundleOut),
        kinds: window.__editorSetBundleKinds,
        note: document.getElementById('editSetNote')?.textContent ?? '',
    }));
    const readBack = await readBundle(Uint8Array.from(bundled.bytes), { jszip: loadJSZipNode() });
    const kindsOf = readBack.members.map((m) => m.kind);
    const rulesMember = readBack.members.find((m) => m.kind === 'rules');
    const setMember = readBack.members.find((m) => m.kind === 'level-set');
    const overlayMember = readBack.members.find((m) => m.kind === 'overlay');
    check(json(kindsOf) === json(['rules', 'level-set', 'overlay', 'region-atlas'])
        && readBack.notes.length === 0,
        '⛓⛓⛓ **ONE PRESS, ONE `.zip`, FOUR MEMBERS** — read back in node through the page\'s '
        + 'own `readBundle`, classified BY SHAPE, nothing ignored',
        `${json(kindsOf)} · ${bundled.bytes.length} B`);
    check(setMember?.doc.set_id === beforeBundle.set_id
        && overlayMember?.doc.overlay_id === beforeBundle.overlay_id,
        '⛓⛓⛓ **§21.9 HOLDS — THE IDS INSIDE THE ZIP ARE THE THREE-BLOB PRESS\'S IDS.** The '
        + 'bundle is a fourth WAY TO PRESS, not a fourth STAMP',
        `${beforeBundle.set_id} · ${beforeBundle.overlay_id}`);
    check(stringifyRulesJson(rulesMember.doc) === pageBytes,
        '⛓⛓ **AND THE `rules.json` MEMBER IS THE SAME DOCUMENT `#editDownloadRules` WROTE**, '
        + 'byte for byte at the same indent',
        `${pageBytes.length} B`);
    check(!/apmapping/i.test(json(kindsOf)) && /NOT a member/.test(bundled.note),
        '⛔ …and the `apMapping` companion is NOT a member — the note SAYS SO rather than '
        + 'leaving a person to notice it is missing',
        bundled.note.slice(0, 200));

    /**
     * ⛓⛓⛓ **THE BUNDLE ROUND TRIP — THROUGH THE FILE INPUT, ON A FRESH PAGE.**
     * ⛔ Fresh for the same reason the three-blob round trip is: the claim is
     * about a RELOAD, and handing the documents back to the session that wrote
     * them would ask the page to remember something it never had to forget.
     *
     * ⚠ The `rules` and `region-atlas` members are NOT loaded — this page
     * DERIVES both — and the note NAMES them.
     */
    await load(`source=edit&level=${LEVEL}`);
    await page.setInputFiles('#editLoadFile', {
        name: `${beforeBundle.set_id}.zip`,
        mimeType: 'application/zip',
        buffer: Buffer.from(bundled.bytes),
    });
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id,
        beforeBundle.set_id, { timeout: 60000 })
        .catch((e) => { throw new Error(`STUCK on the bundle round trip: ${e.message}`); });
    const fromBundle = await setRead();
    const fileNote = await page.evaluate(
        () => document.getElementById('editLoadFileNote')?.textContent ?? '');
    check(fromBundle.edit.set.set_id === beforeBundle.set_id
        && fromBundle.edit.set.overlay_id === beforeBundle.overlay_id
        && fromBundle.edit.set.edits === 0,
        '⛓⛓⛓ **THE BUNDLE ROUND TRIPS THROUGH `#editLoadFile`** — the set AND its overlay open '
        + 'together from ONE file, with an EMPTY op list (the edits are in the documents now)',
        `${fromBundle.edit.set.set_id} · ${fromBundle.edit.set.overlay_id}`);
    check(/rules/.test(fileNote) && /region-atlas/.test(fileNote)
        && /NOT loaded/.test(fileNote),
        '⛔ …and the two members it did NOT load are NAMED — a member that vanished without a '
        + 'word is indistinguishable from one that was never there',
        fileNote.slice(0, 220));

    await page.fill('#editLoad', JSON.stringify(D2_SET));
    await page.click('#editLoadGo');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id
        && window.__editorEdit.set.edits === 0, D2_SET.set_id, { timeout: 60000 });
    await page.selectOption('#editSetRoom', '1');
    await page.waitForTimeout(200);
    await page.fill('#editSetRoomField_music', '9');
    await page.dispatchEvent('#editSetRoomField_music', 'change');
    await page.waitForTimeout(300);
    await page.fill('#editSetField_description', 'five ops, one stamp');
    await page.dispatchEvent('#editSetField_description', 'change');
    await page.waitForTimeout(300);
    await page.click('#editDownloadSet');
    await page.waitForFunction(() => window.__editorSetOut && window.__editorSetOverlayOut,
        null, { timeout: 30000 });
    const three = await page.evaluate(() => ({
        set: window.__editorSetOut,
        overlay: window.__editorSetOverlayOut,
        mapping: window.__editorSetMappingOut,
    }));
    check(three.set.set_id !== D2_SET.set_id
        && three.set.set_id.endsWith(`-${three.set.provenance.content_hash}`)
        && typeof three.overlay.overlay_id === 'string'
        && three.mapping !== null,
        '⛓⛓⛓ **ONE PRESS, THREE DOCUMENTS, ONE STAMP** — the set, the overlay and the '
        + '`apMapping` companion, and TWO ops produced exactly ONE new `set_id` (D1 §20.6: the '
        + 'id IS the content, and stamping per op would mint ids nobody ever saw)',
        `${D2_SET.set_id} → ${three.set.set_id} · ${three.overlay.overlay_id}`);
    check(validateLevelSet(three.set).ok,
        '⛓ …and node validates what the page wrote', json(validateLevelSet(three.set).errors));

    /**
     * ⛔⛔ **THE OVERLAY SURVIVES A RELOAD, AND THAT IS §20.11 #3's WHOLE
     * POINT.** Load the two documents back and the location count is what went
     * out — a page that dropped the overlay would open a set missing every
     * location and every authored rule, silently.
     */
    /**
     * ⛔ **A FRESH PAGE, DELIBERATELY.** §20.11 #3's claim is about a RELOAD:
     * *"a page that FORGETS to carry the overlay through a reload silently loses
     * every location and every authored rule"*. Pasting the two documents into
     * the session that just wrote them would be asking the page to remember
     * something it never had to forget.
     */
    await load(`source=edit&level=${LEVEL}`);
    await page.fill('#editLoad', JSON.stringify(three.overlay));
    await page.click('#editLoadGo');
    await page.waitForTimeout(400);
    await page.fill('#editLoad', JSON.stringify(three.set));
    await page.click('#editLoadGo');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id,
        three.set.set_id, { timeout: 60000 });
    const reloaded = await setRead();
    check(reloaded.edit.set.locations === 1 && reloaded.edit.set.edits === 0
        && reloaded.edit.set.overlay_id === three.overlay.overlay_id,
        '⛓⛓⛓ **THE THREE-BLOB ROUND TRIP** — the set and its overlay load back together, the '
        + 'op list is EMPTY (the edits are in the documents now, not beside them) and the '
        + 'location the overlay carried is still there', json(reloaded.edit.set));

    /**
     * ⛓⛓ **▶ SHIPS THE WHOLE SET**, through the same `validatedChunks` the
     * one-room ship uses, with a ZERO-INPUT tape and no expectation.
     */
    const shipNote = await page.evaluate(() => ({
        title: document.getElementById('loadWasm')?.title ?? null,
        disabled: document.getElementById('loadWasm')?.disabled ?? null,
    }));
    check(/WHOLE EDITED SET/.test(shipNote.title ?? '') && shipNote.disabled === false,
        '⛓⛓ **WITH A SET HELD, ▶ SHIPS THE WHOLE SET** — not the one room the canvas happens '
        + 'to show — and it says so on the button, booting at the manifest\'s own `start`',
        String(shipNote.title).slice(0, 120));
    const chunkPlan = await page.evaluate(() => {
        const built = window.__editorShipProbe?.();
        if (!built) return null;
        if (built.error) return { error: built.error };
        return { rooms: built.levelSet.rooms.length, chunks: built.chunks.length,
            expect: built.expect, why: built.expectWhy };
    });
    check(chunkPlan !== null && chunkPlan.rooms === D2_ROOMS && chunkPlan.chunks > 0
        && chunkPlan.expect === null && /no oracle/.test(chunkPlan.why),
        '⛓⛓⛓ …and the BUILD really produces a whole-set chunk plan with NO EXPECTATION and '
        + 'the reason attached — nobody has walked this set, so an `expect` would be a claim '
        + 'about a run nobody made', json(chunkPlan));

    /* ══ CLAIM 27 — THE VANILLA 116, THROUGH THE PAGE'S OWN DOOR ═══ */

    /**
     * ⛓⛓⛓ **EDITOR v3 E1 — THE FIRST TIME THIS ARM DRIVES REAL DATA.** Every
     * claim above uses a set node BUILT for the row, because the committed
     * vanilla set is 116 `embed`-sourced rooms and claim 19 is the proof they
     * cannot be opened. `#editLoadVanilla` derives the same 116 as an `xml` set
     * from two documents the page already holds, and the checks below are what
     * that is worth: a set nobody wrote for this file, 116 openable rooms, and
     * the REPORT's verdict on the real game.
     */
    await load(`source=edit&level=${LEVEL}`);
    /**
     * ⛔ **THE MUTANT IS ARMED BEFORE THE CLICK, NOT ASSERTED AFTER IT.** The
     * button's whole shape is *"no new URL and no second fetch"* — both inputs
     * are already in scope — so the row COUNTS REQUESTS across the press. A
     * build that re-fetched either document would pass every other check here.
     */
    const vanillaReqs = [];
    const onVanillaReq = (r) => vanillaReqs.push(r.url());
    page.on('request', onVanillaReq);
    const vanT0 = Date.now();
    await page.click('#editLoadVanilla');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id,
        VANILLA_XML.set_id, { timeout: 180000 }).catch(() => {});
    const vanBuildMs = Date.now() - vanT0;
    page.off('request', onVanillaReq);
    const van = await setRead();
    check(van.edit.set?.set_id === VANILLA_XML.set_id && van.edit.set.rooms === 116
        && van.edit.set.openable === 116,
        '⛓⛓⛓ **THE PAGE BUILDS THE SAME SET NODE DOES** — 116 rooms, every one OPENABLE, and '
        + 'the `set_id` is `vanillaRecordSet`\'s own: the SAME FUNCTION ran on both sides, so '
        + 'comparing the two content hashes IS the byte proof',
        `${json(van.edit.set)} in ${vanBuildMs} ms`);
    check(vanillaReqs.filter((u) => /seedling-vanilla-set\.json|seedling-map\.json/.test(u))
        .length === 0,
        '⛔⛔ **AND IT FETCHED NEITHER INPUT AGAIN** — the map extract came from `armPrelude`\'s '
        + 'memoised `loadAtlas` and the manifest from the same `Promise.all` that read ⚖ ruling '
        + '2\'s id. A second fetch would be a second reader of a document this page has',
        `${vanillaReqs.length} request(s) across the click: ${vanillaReqs.slice(0, 3).join(' ')}`);
    /**
     * ⛓⛓⛓ **THE OTHER HALF OF THE BADGE A/B** (EDITOR v3 E6b). The SAME 116
     * rooms, built as `record`s rather than read out of the committed `embed`
     * set — so the strip has nothing to warn about and BOTH readers say so.
     * ⛔⛔ **THIS IS THE ROW TRAP 722'S MUTANT REDS.** `typeof <undeclared> !==
     * 'string'` is TRUE for every cell, so that build badges all 116 here;
     * before this slice it was invisible in the browser (§32.6) and only
     * `setEditorView.test.js` could see it.
     * ⛓ `captionInk > 0` is the POSITIVE CONTROL: the strip DID draw, so
     * `badgeInk === 0` is a fact about badges rather than about an empty strip.
     */
    const recBadge = await inkOf();
    check(recBadge.badgeInk === 0 && recBadge.captionInk > 0
        && Array.isArray(van.edit.set.badges)
        && van.edit.set.badges.length === VANILLA_XML.rooms.length
        && van.edit.set.badges.every((b) => b === false),
        `⛓⛓⛓ **AND NOT ONE OF THE ${VANILLA_XML.rooms.length} \`record\`-BUILT ROOMS IS `
        + 'BADGED — IN THE READOUT *AND* IN THE PIXELS.** ⛔ The A/B against claim 19 is the '
        + 'whole claim: the same rooms, one document `embed`-sourced and one `record`-sourced, '
        + 'and the strip tells them apart. A count of non-zero ALPHA cannot (§32.6) — this '
        + 'band is a per-column DIFFERENCE against a reference row no glyph reaches',
        `badgeInk ${recBadge.badgeInk} · captionInk ${recBadge.captionInk} · `
        + `${van.edit.set.badges.filter(Boolean).length}/${van.edit.set.badges.length} badged`);
    check(van.setNote.includes(VANILLA_XML.set_id)
        && van.setNote.includes(`derived from ${VANILLA.set_id}`),
        '⛓⛓ **THE IDENTITY LINE SAYS WHICH SET IS HELD, AND WHICH IT REPRODUCES** — two ids '
        + 'describe one game\'s 116 rooms now, and `provenance.derived_from` is read off the '
        + 'document rather than matched against anything the page knows',
        van.setNote.slice(0, 150));

    /**
     * ⛓⛓⛓ **EDITOR v3 E3b — THE `(bounded)` COLUMN IS GONE FROM VANILLA.**
     * §21.4's bound was sized for a set read n times: 116 × 1,332 KB of OEL
     * (~19 s measured), then 116 × 2,461 entity visits once the rooms became
     * records (328–397 ms) — both over the 250 ms budget. `linksIndexOf` reads
     * the set ONCE and buckets by destination, the bound compares that, and the
     * column now carries a COUNT for every room. ⛔ The counts are compared
     * against node's `linksIndexOf`, never against the page's own arithmetic.
     */
    const vanRows = van.rows.slice(1);
    check(vanRows.length === 116
        && vanRows.every((r, i) => r[0] === String(i)
            && r[4] === String(VANILLA_XML_INBOUND[i]))
        && vanRows.every((r, i) => r[3] === String(VANILLA_XML_ROWS[i].exits))
        && !vanRows.some((r) => r[4] === '(bounded)'),
        '⛓⛓⛓ **116 ROWS, THE LINKS COLUMN CARRIES A COUNT — `(bounded)` APPEARS NOWHERE — AND '
        + 'BOTH COLUMNS ARE NODE\'S** — every inbound count is `linksIndexOf`\'s own answer for '
        + 'that room and every exit count is `exitsOfRoom`\'s, so the page is compared against '
        + 'the index rather than against itself',
        `${vanRows.length} row(s), ${VANILLA_XML_INBOUND.reduce((a, b) => a + b, 0)} inbound `
        + `link(s), links column ${json([...new Set(vanRows.map((r) => r[4]))].slice(0, 8))}`);
    const boundSaid = await page.evaluate(
        () => document.getElementById('editSetRooms')?.textContent ?? '');
    /**
     * ⛔ **AND THE PAGE PRINTS NO BOUND SENTENCE, BECAUSE NOTHING WAS REFUSED.**
     * The sentence was never decoration: a blank column for a reason nobody
     * printed reads as a set in which nothing links anywhere. Now the column is
     * not blank, so the row asserts the sentence is ABSENT — a page still
     * printing it would be saying it refused work it did.
     */
    check(!/whole-set link scan would read/.test(boundSaid)
        && !/reads `\(bounded\)`/.test(boundSaid)
        && !/ARROWS are UNAFFECTED/.test(boundSaid),
        '⛔ …**AND NO BOUND SENTENCE IS PRINTED** — the column was computed, so there is nothing '
        + 'to say it was not; the sentence returns the moment a set is wide enough to bound ONE '
        + 'pass, and `watchSetEditor.test.js` drives that case',
        `${VANILLA_XML_SCAN.entities} entity visits in ONE pass ≈ ${
            Math.round(VANILLA_XML_SCAN.ms)} ms, budget 250 ms`);
    const stripGeo = await inkOf();
    const vanCellPx = stripGeo === null ? null : stripGeo.w / 116;
    check(vanCellPx !== null && Number.isInteger(vanCellPx)
        && vanCellPx < OVERVIEW.minStillPx && vanCellPx >= OVERVIEW.minCellPx,
        '⛓ …and at 116 cells the strip draws LABELLED BOXES rather than stills — the canvas is '
        + `${vanCellPx} px per room, under \`OVERVIEW.minStillPx\` (${OVERVIEW.minStillPx}) and `
        + `at or above \`minCellPx\` (${OVERVIEW.minCellPx}), which is the floor that keeps a `
        + 'cell clickable', json(stripGeo));

    /* ── the REPORT on the real game ─────────────────────────────── */

    /**
     * ⛓ THE REPORT'S COST ON 116 ROOMS IS MEASURED HERE, not tuned. It derives
     * the atlas and compiles it on the main thread; §22.2 decision 9 says
     * memoisation is E3's IF the number says so, and this is the number.
     */
    const repT0 = Date.now();
    await page.click('#editSetReport');
    await page.waitForFunction((n) => document.querySelectorAll('#editSetReportOut li').length >= n,
        VANILLA_XML_REPORT.rows.length, { timeout: 180000 }).catch(() => {});
    const repMs = Date.now() - repT0;
    const vanReport = await setRead();
    check(vanReport.report.length === VANILLA_XML_REPORT.rows.length,
        `⛓ **THE PAGE'S REPORT IS NODE'S, ROW FOR ROW** — and it took ${repMs} ms on the main `
        + 'thread for this set, which is the MEASUREMENT §22.2 decision 9 defers memoisation to',
        `page ${vanReport.report.length} row(s), node ${VANILLA_XML_REPORT.rows.length}`);
    const pageFree = vanReport.report.filter((r) => /^\[free\]/.test(r)).length;
    check(pageFree === VANILLA_XML_FREE.length && pageFree > 0,
        '⛓⛓⛓ **EVERY EDGE OF VANILLA IS FREE, AND THE COUNT IS DERIVED FROM THE COMPILED '
        + 'RULES** — not typed here: `freeEdgesOf(rules)` in node over the same set, so a '
        + 'one-room set moves the expectation with the data (§22.2 bound 1 — the playthrough\'s '
        + '"vanilla overlay" is CODE, so a set editor opening vanilla has NOTHING authored)',
        `page ${pageFree}, node ${VANILLA_XML_FREE.length}`);
    check(vanReport.report.some((r) => /^\[region-atlas\] validateRegionAtlas: ok/.test(r))
        && vanReport.report.some((r) => /^\[region-atlas\]/.test(r) && /DELIBERATELY UNSTAMPED/.test(r)),
        '⛓⛓ **THE `region-atlas` SUMMARY ROW IS THERE** — always added, ok or not (§21.8) — and '
        + 'the permanent unstamped warning is explained beside it rather than left to teach a '
        + 'reader to skip the warning list',
        (vanReport.report.find((r) => /^\[region-atlas\]/.test(r)) ?? '').slice(0, 120));
    /**
     * ⛓⛓⛓ **EDITOR v3 E5 — THIS ROW ASSERTED THE REFUSAL AND NOW ASSERTS THE
     * FIX, ON THE SAME PAGE AND THE SAME DATA.**
     *
     * E1's version: *"the vanilla game's own rules.json is REFUSED — `level_58`
     * is UNREACHABLE"*, and its sentence named the mechanism the walk could not
     * see: *"a boss that warps you, a debug key, `named_rooms`"*. E5 gave the
     * derivation the third of those. The graph closes, every compiled region is
     * reachable, and the export is ALLOWED.
     *
     * ⛔ THE `[reach]` ROW IS ASSERTED **OK**, NOT ABSENT. `setEditorCore` adds
     * a `reach` row either way (§21.8's law: the summary row is always there);
     * a row that checked only for the ABSENCE of `level_58` would pass on a
     * build that stopped running the reachability pass at all.
     */
    check(vanReport.report.some((r) => /^\[reach\] every one of the \d+ compiled region/.test(r))
        && vanReport.report.every((r) => !/^\[reach\].*UNREACHABLE/.test(r))
        && vanReport.rulesDisabled === false,
        '⛓⛓⛓ **AND THE VANILLA GAME\'S OWN rules.json IS ALLOWED — `level_58` IS REACHED.** '
        + 'E1 measured this row REFUSING, and its own sentence named the mechanism no walk over '
        + 'the ROOM DATA can see: a boss that warps you, a debug key, `named_rooms`. E5 handed '
        + 'the derivation the manifest, `<tentaclebeast>` in L57 became the door, and the graph '
        + 'closes. D2\'s "refuse before export" is unchanged — it has nothing left to refuse',
        `${(vanReport.report.find((r) => /^\[reach\]/.test(r)) ?? '').slice(0, 130)} · note ${
            json(vanReport.reportNote)}`);
    /**
     * ⛔ **AND `level_58` IS IN THE COMPILED DOCUMENT THE PAGE BUILT, not merely
     * absent from a refusal.** A row that only checked that nothing said
     * UNREACHABLE would pass on a build that dropped the region entirely — and
     * a dropped region is exactly what `deriveAtlas` does to a room no door
     * reaches. So the row asks the page's own free list to NAME it.
     */
    const pageL58 = vanReport.report.filter(
        (r) => /^\[free\]/.test(r) && /region "level_58"/.test(r));
    check(pageL58.length > 0 && pageFree === VANILLA_XML_FREE.length,
        '⛓⛓ …**and `level_58` IS A COMPILED REGION IN THE PAGE\'S OWN DOCUMENT** — its doors '
        + 'appear in the free list, which they could not do if the derivation had dropped the '
        + 'region for having no way in. ⛓ The free COUNT is still node\'s `freeEdgesOf` over '
        + `the same set, so the manifest's ${VANILLA_NAMED.length} doors moved BOTH numbers `
        + 'or neither',
        `page ${pageFree}, node ${VANILLA_XML_FREE.length}; ${pageL58.length} free edge(s) in `
        + `level_58; ${VANILLA_NAMED.length} manifest warp(s)`);

    /* ── an authored rule on an ARRIVAL endpoint, on REAL rooms ──── */

    await page.selectOption('#editSetRoom', String(VANILLA_INERT.room));
    await page.waitForTimeout(400);
    const inertTargets = (await setRead()).ruleTargets;
    check(inertTargets.includes(VANILLA_INERT.target),
        `⛓ room ${VANILLA_INERT.room} of the real set offers the ARRIVAL endpoint `
        + `\`${VANILLA_INERT.target}\` — an \`in_*\` id the derivation gives the room and the `
        + 'compiler builds NO AP exit for (§21.2)', json(inertTargets.slice(0, 4)));
    /**
     * ⛔⛔⛔ **§21.2 ON REAL DATA — AND E3b TURNED THIS ROW INSIDE OUT.**
     *
     * It used to author the rule onto the arrival, let it land, and assert that
     * the REPORT named it inert and listed it in the export refusal beside
     * `level_58`. That was §21.2's defect being measured on the real game, and
     * it was the right row while the op accepted the rule. `set-access-rule`
     * refuses it now, on `setEditorCore.gateabilityOf` — the SAME reading that
     * put ` ⚠ gates NOTHING` on the option the row above just found — so the
     * rule never reaches the overlay and there is nothing inert to name.
     *
     * ⇒ what is measured on real data now: the page MARKED the endpoint, the OP
     * REFUSED it in the same words, the record did NOT move, and the export
     * refusal names `level_58` ALONE — the unreachable region, which is a fact
     * about the game and not about anything this row authored.
     */
    const vanMark = (await setRead()).ruleTargetMarks
        .find((m) => m.value === VANILLA_INERT.target);
    await page.selectOption('#editSetRuleTarget', VANILLA_INERT.target);
    await page.fill('#editSetRuleJson', '{"rule":"Has","args":{"item":"Sword"}}');
    await page.dispatchEvent('#editSetRuleJson', 'input');
    await page.click('#editSetRuleCommit');
    await page.waitForFunction(
        () => /REACH NOTHING/.test(document.getElementById('status')?.textContent ?? ''),
        null, { timeout: 60000 }).catch(() => {});
    const vanRefused = await setRead();
    check(vanRefused.edit.set.edits === 0
        && /REACH NOTHING/.test(vanRefused.status)
        && vanRefused.status.includes(VANILLA_INERT.exitId)
        && / ⚠ gates NOTHING$/.test(vanMark?.label ?? '')
        && /ARRIVAL side of a ONE-WAY connection/.test(vanMark?.why ?? '')
        && /ARRIVAL side of a ONE-WAY connection/.test(vanRefused.status),
        '⛔⛔ **§21.2 ON REAL DATA, CLOSED (E3b)** — a rule authored onto an ARRIVAL endpoint of '
        + 'a VANILLA room is REFUSED BY THE OP, and the page had already MARKED that endpoint '
        + 'with the same sentence: both read `gateabilityOf` over the same derived atlas, so '
        + 'the mark and the refusal quote each other word for word. The record does not move. '
        + '⛓ Until E3b this row measured the DEFECT — the rule landed, the report named it '
        + 'inert, and the export refusal listed it beside the unreachable region',
        `${json(vanMark?.label)} · ${vanRefused.status.slice(0, 150)}`);
    await page.click('#editSetReport');
    await page.waitForFunction(() => [...document.querySelectorAll('#editSetReportOut li')]
        .some((l) => /^\[reach\]/.test(l.textContent)), null, { timeout: 180000 })
        .catch(() => {});
    const inertReport = await setRead();
    check(inertReport.report.every((r) => !/^\[inert-rule\]/.test(r))
        && inertReport.rulesDisabled === false
        && !inertReport.reportNote.includes(VANILLA_INERT.exitId)
        && !/reach no compiled edge/.test(inertReport.reportNote),
        '⛔⛔ **…AND THE REPORT HAS NOTHING LEFT TO REFUSE ON** — no inert rule (the op refused '
        + 'it, so nothing landed) and no unreachable region (E5\'s manifest arrivals closed the '
        + 'graph). E1 saw `level_58` listed here alone; E3b removed the inert rule beside it and '
        + 'E5 removed the region. ⛓ `inertRulesOf` is NOT retired: `set-overlay` writes a whole '
        + 'room entry and asks no derivation, so it is still the one door such a rule can '
        + 'arrive through, and `watchSetEditor.test.js` drives it',
        `disabled=${inertReport.rulesDisabled} note ${json(inertReport.reportNote)}`);

    /* ── EDITOR v3 E5 — VANILLA + THE AUTHORED OVERLAY ───────────── */

    /**
     * ⛓⛓⛓ **THE VANILLA AUTHORED OVERLAY, THROUGH THE PAGE'S EXISTING DOOR.**
     *
     * ⛔ **NO NEW PAGE PATH WAS ADDED, AND THAT WAS MEASURED BEFORE ANYTHING
     * WAS WRITTEN.** `sniffLoadBox` already classifies an overlay BY SHAPE (a
     * set's `rooms` is an ARRAY, an overlay's is an OBJECT keyed by room index)
     * and `takeOverlay` attaches one to the live set while the session holds
     * ZERO ops — which is exactly the state a fresh LOAD vanilla leaves. So the
     * fixture goes in the LOAD box like any other document, and
     * `watchSetEditor.js` is untouched by this slice.
     *
     * ⚠ **AND THE SET IT LANDS ON IS THE `record` ONE.** The COMMITTED
     * `seedling-vanilla-set.json` is 116 `embed` rooms and `mark-location`
     * refuses an embed room by name; `#editLoadVanilla` builds the RECORD set,
     * which is what the overlay was authored against.
     */
    await page.fill('#editLoad', JSON.stringify(VANILLA_OVERLAY));
    await page.click('#editLoadGo');
    await page.waitForFunction((n) => window.__editorEdit?.set?.locations === n,
        VANILLA_OVERLAY_LOCS, { timeout: 180000 }).catch(() => {});
    const vanOverlay = await setRead();
    check(vanOverlay.edit.set?.set_id === VANILLA_XML.set_id
        && vanOverlay.edit.set.rooms === 116
        && vanOverlay.edit.set.locations === VANILLA_OVERLAY_LOCS
        && vanOverlay.edit.set.edits === 0
        && vanOverlay.identity.includes(VANILLA_OVERLAY.overlay_id),
        '⛓⛓⛓ **THE COMMITTED VANILLA OVERLAY LOADS ONTO THE REAL 116** — the same 116-room set '
        + 'the page just built, now carrying the locations the playthrough atlas has always '
        + 'had and the set editor never could. ⛔ The count is node\'s own answer over the same '
        + 'fixture read off disk, and the identity line prints the `overlay_id` the file '
        + 'carries — so a page that silently loaded a DIFFERENT document is a value failure',
        `${json(vanOverlay.edit.set)} · ${vanOverlay.identity.slice(0, 120)}`);

    const repOvT0 = Date.now();
    await page.click('#editSetReport');
    await page.waitForFunction((n) => document.querySelectorAll('#editSetReportOut li').length >= n,
        VANILLA_OVERLAY_REPORT.rows.length, { timeout: 180000 }).catch(() => {});
    const repOvMs = Date.now() - repOvT0;
    const vanOvReport = await setRead();
    const pageOvFree = vanOvReport.report.filter((r) => /^\[free\]/.test(r)).length;
    const pageOvLocFree = vanOvReport.report.filter(
        (r) => /^\[free\] FREE location/.test(r)).length;
    check(pageOvFree === VANILLA_OVERLAY_FREE.length
        && pageOvLocFree === VANILLA_OVERLAY_FREE.filter((e) => e.kind === 'location').length
        && pageOvFree !== pageFree,
        '⛓⛓⛓ **AND THE FREE COUNT MOVES — UPWARD, WHICH IS THE HONEST DIRECTION.** §27.6 '
        + 'predicted it would DROP. `freeEdgesOf` counts LOGIC OBLIGATIONS and a LOCATION is '
        + `one of those edges, so authoring ${VANILLA_OVERLAY_LOCS} of them creates `
        + `${VANILLA_OVERLAY_LOCS} obligations of which the overlay's own guards discharge `
        + `${VANILLA_OVERLAY_LOCS - VANILLA_OVERLAY_FREE.filter((e) => e.kind === 'location').length}, `
        + `while its authored exit rules gate ${VANILLA_XML_FREE.length
            - VANILLA_OVERLAY_FREE.filter((e) => e.kind === 'exit').length} of the doors. `
        + '⛔ Both numbers are node\'s `freeEdgesOf` over the same session — neither is '
        + 'typed, so the page and node moved together or the row is red',
        `page ${pageFree} -> ${pageOvFree} (node ${VANILLA_XML_FREE.length} -> ${
            VANILLA_OVERLAY_FREE.length}), of which ${pageOvLocFree} are LOCATIONS; report took `
        + `${repOvMs} ms`);
    check(vanOvReport.rulesDisabled === false
        && vanOvReport.report.some((r) => /^\[reach\] every one of the \d+ compiled region/.test(r))
        && VANILLA_OVERLAY_REPORT.download.rules.allowed === true,
        '⛓⛓⛓ **THE EXPORT IS ALLOWED WITH THE OVERLAY ON** — 41 locations, two authored exit '
        + 'rules, a graph that closes. That is the whole of §23.12 #1: the vanilla AUTHORED '
        + 'OVERLAY is a D1 document now, and opening the real game in this editor produces a '
        + 'rules.json rather than a refusal',
        `disabled=${vanOvReport.rulesDisabled} note ${json(vanOvReport.reportNote)}`);

    /* ── OPEN · PAINT · CLOSE · DOWNLOAD, on the real 116 ────────── */

    await load(`source=edit&level=${LEVEL}`);
    await page.click('#editLoadVanilla');
    await page.waitForFunction((id) => window.__editorEdit?.set?.set_id === id
        && window.__editorEdit.set.edits === 0, VANILLA_XML.set_id, { timeout: 180000 });
    await page.selectOption('#editSetRoom', String(VANILLA_OPEN_ROOM));
    await page.click('#editSetOpen');
    await page.waitForFunction(() => window.__editorEdit?.baseKind === 'set-room', null,
        { timeout: 60000 });
    const vanOpened = await read();
    check(json(vanOpened.edit.base) === json({
        kind: 'set-room', set_id: VANILLA_XML.set_id, room: VANILLA_OPEN_ROOM,
    }),
        `⛓⛓⛓ **ROOM ${VANILLA_OPEN_ROOM} OF THE REAL GAME OPENS**, through the \`set-room\` base `
        + 'with NO PARSE at all (E1b), from a set whose every room is `record`-sourced — the '
        + 'thing claim 19 measures as impossible for the committed `embed` set',
        json(vanOpened.edit.base));
    await page.selectOption('#genEditTool', 'paint');
    await page.selectOption('#genEditLayer', 'tiles');
    await page.selectOption('#genEditTerrain', PAINT_TERRAIN);
    await clickCell(VANILLA_PAINT);
    await settled(1);
    await page.click('#editRoomClose');
    await page.waitForFunction(() => window.__editorEdit?.set?.edits === 1, null,
        { timeout: 60000 }).catch(() => {});
    const vanClosed = await setRead();
    check(vanClosed.edit.set?.edits === 1,
        '⛓⛓ **N ROOM EDITS BECOME ONE `replace-room`** — the same law D1 §20.7 states, on a '
        + '116-room document', `${vanClosed.edit.set?.edits} set edit(s)`);
    await page.click('#editDownloadSet');
    await page.waitForFunction(() => window.__editorSetOut && window.__editorSetOverlayOut,
        null, { timeout: 60000 });
    const vanOut = await page.evaluate(() => ({
        set: window.__editorSetOut,
        overlay: window.__editorSetOverlayOut,
        mapping: window.__editorSetMappingOut,
    }));
    check(vanOut.set.set_id !== VANILLA_XML.set_id
        && vanOut.set.set_id.startsWith('seedling-vanilla-record-')
        && vanOut.set.set_id.endsWith(`-${vanOut.set.provenance.content_hash}`)
        && typeof vanOut.overlay.overlay_id === 'string' && vanOut.mapping !== null,
        '⛓⛓⛓ **THREE BLOBS, ONE STAMP, AND THE BASE SURVIVES THE RE-STAMP** — an edited set is '
        + 'a different set by construction, and `stampLevelSetIdentity` rebuilds the id around '
        + 'the SAME base, so the new id still cannot be mistaken for the embed set\'s',
        `${VANILLA_XML.set_id} → ${vanOut.set.set_id}`);
    check(vanOut.set.provenance?.derived_from?.set_id === VANILLA.set_id
        && vanOut.set.provenance.derived_from.content_hash === VANILLA.provenance.content_hash,
        '⛔⛔ **AND `derived_from` SURVIVES THE DOWNLOAD PATH** — the re-stamp rewrites `set_id` '
        + 'and `provenance.content_hash` and must touch nothing else: a download that dropped '
        + 'it would hand somebody 116 rooms with no way to say which vanilla they are',
        json(vanOut.set.provenance.derived_from));
    check(validateLevelSet(vanOut.set).ok
        && vanOut.set.rooms.length === 116
        && vanOut.set.rooms.every((r) => typeof r.source?.record === 'object'
            && r.source.xml === undefined),
        '⛓ …and node validates what the page wrote — 116 `record` rooms, still, and NOT ONE '
        + 'rendered: the page never turns a set into text (E1b — the render is the chunk\'s)',
        json(validateLevelSet(vanOut.set).errors));
    /**
     * ⛓⛓⛓ **CLAIM 27b (E1b) — AND OEL EXISTS EXACTLY ONCE, AT THE BOUNDARY.**
     * The DOWNLOADED SET has no text in it at all; `planLevelSetChunks` over
     * that same document produces chunks whose every room is `{xml}` and whose
     * every room's text is `recordToOel`'s. ⛔ Asserted on the CHUNK DOCUMENT
     * and not through the wasm: a row that needed the runtime to notice a
     * missing render would be a row that cannot fail in node.
     */
    const vanChunks = planLevelSetChunks(vanOut.set).chunks;
    const vanChunkRooms = vanChunks.flatMap((c) => c.rooms);
    check(vanChunks.length === 9 && vanChunkRooms.length === 116
        && vanChunkRooms.every((r) => typeof r.source.xml === 'string'
            && r.source.record === undefined)
        && vanChunkRooms.every((r, i) => r.source.xml
            === recordToOel(vanOut.set.rooms[i].source.record)),
        '⛓⛓⛓ **AND THE RENDER IS THE CHUNK\'S, EXACTLY ONCE** — the set the page downloaded '
        + 'carries 0 bytes of OEL; planning it for delivery renders every room and NOTHING '
        + 'else, so what crosses is what `LevelSet.as:139` reads',
        `${vanChunks.length} chunk(s), largest ${
            Math.max(...vanChunks.map((c) => JSON.stringify(c).length))} B`);

    /**
     * ⛓⛓⛓ **E1c — THE REFUSED BUNDLE.** The vanilla game's own graph does NOT
     * close (`level_58` is unreachable — the claim two rows up), so
     * `#editDownloadRules` is disabled with its reason printed. The BUNDLE is
     * still written, WITHOUT a `rules.json` member and WITHOUT the derived
     * atlas, and the note carries the SAME sentence the disabled button carries.
     *
     * ⛔ **THIS IS THE HALF THAT IS EASY TO GET WRONG IN EITHER DIRECTION**: a
     * bundle that refused outright would lose a person's 116 rooms over a rule
     * about an export they did not ask for; a bundle that shipped a rules.json
     * anyway would put a world nobody can finish inside a container that looks
     * complete.
     */
    await page.click('#editSetReport');
    await page.waitForTimeout(2500);
    const vanBundleReport = await setRead();
    await pressDownload('#editDownloadBundle', '__editorSetBundlePresses',
        { settleOn: '__editorSetBundleKinds' });
    const vanBundle = await page.evaluate(() => ({
        bytes: Array.from(window.__editorSetBundleOut),
        kinds: window.__editorSetBundleKinds,
        note: document.getElementById('editSetNote')?.textContent ?? '',
    }));
    const vanRead = await readBundle(Uint8Array.from(vanBundle.bytes),
        { jszip: loadJSZipNode() });
    const vanKinds = vanRead.members.map((m) => m.kind);
    check(vanBundleReport.rulesDisabled === false
        && json([...vanKinds].sort()) === json(['level-set', 'overlay', 'region-atlas', 'rules'])
        && !/no `rules.json` member/.test(vanBundle.note),
        '⛓⛓⛓ **E5 — THE VANILLA CONTAINER IS COMPLETE NOW: FOUR MEMBERS.** E1c drove this row '
        + 'as the REFUSED bundle, because vanilla\'s graph did not close; the manifest\'s '
        + 'arrivals closed it, so the third and fourth members are present and the note has no '
        + 'absence to explain. ⛓ The refused-bundle claim did not go with it — it is driven on '
        + 'the CUT set above, whose graph still does not close by construction',
        `${json(vanKinds)} · ${vanBundle.bytes.length} B · ${vanBundle.note.slice(0, 140)}`);

    /**
     * ⛓⛓⛓ **THE OVERVIEW ARROWS ARE PAINTED AT LOAD — D2's DEFECT, FOUND BY
     * THIS ROW'S FIRST RUN ON REAL DATA (§23.11 #5) AND FIXED IN E3a.**
     *
     * The arcs are POLYLINE shapes contributed through `editorView`'s `shapes()`
     * door, and that file paints them on a `.editorViewOverlay` canvas it
     * appends to the target's PARENT and SIZES FROM THE TARGET. It painted ONCE
     * at mount — where `#editSetOverview` is still the HTML's `width="1"
     * height="1"` and the rooms list is still EMPTY — and nothing repainted it
     * afterwards: `render()` called `paintStrip()` (which sizes the canvas and
     * draws the room boxes) and never asked the view to repaint. MEASURED with a
     * standalone probe: after a vanilla LOAD the strip canvas was 2088×132 with
     * 181,674 ink pixels and the overlay was still **1×1 with 0**; a click on
     * the strip did not change it; `#editSetGesture` — which is `setTool`, and
     * `setTool` repaints — took the overlay to **2088×132 with 67,289**.
     *
     * ⛓ **E3a's FIX IS ONE KEY AND ONE CALL:** `mountEditorView`'s returned
     * surface names `repaint`, and `setEditorView`'s `render()` calls it right
     * after `paintStrip()` has sized the canvas. ⛔ NOT `setTool`, which was the
     * only door before and which also clears the view's `corner` and fires
     * `onChange` — a half-armed two-click gesture and a re-entrant render.
     *
     * ⛓⛓ SO THE CLAIM IS NOW THE LOAD-TIME ONE, and the gesture is kept as the
     * control: the overlay is the STRIP's size WITH INK IN IT before anything
     * is pressed, and arming a tool does not shrink it. ⛔ MUTANT: drop
     * `view.repaint()` from `render()` — `beforeArm` goes back to 1×1/0 and
     * this row is the witness (`editorView.test.js`'s own rows stay GREEN,
     * because they pin that the DOOR exists, not that this panel uses it).
     */
    const beforeArm = await inkOf();
    await page.click('#editSetGesture');
    await page.waitForTimeout(500);
    const afterArm = await inkOf();
    check(beforeArm !== null && beforeArm.ovInk > 0
        && beforeArm.ovW === beforeArm.w && beforeArm.ovH === beforeArm.h,
        '⛓⛓⛓ **THE ARROWS ARE ON THE OVERLAY AT LOAD, AT THE STRIP\'S SIZE** — no gesture, no '
        + 'click, nothing pressed. Before EDITOR v3 E3a this read `1×1` with `0` ink over a '
        + `strip that was already ${beforeArm?.w}×${beforeArm?.h}: the view painted once at `
        + 'mount, while the canvas was `width="1"` and the rooms list was empty, and nothing '
        + 'repainted it after (§23.11 #5, a D2 defect shipped on `main`)', json(beforeArm));
    /**
     * ⛓⛓ **EDITOR v3 E3b — THE ARROWS AND THE COLUMN NOW AGREE BY
     * CONSTRUCTION.** They used to be two different readings of the graph:
     * the arrows came from each room's own exit list (one pass) while the
     * column was n passes and was bounded away. `linksIndexOf` is the one pass
     * both read now, so "the arrows survive the bound" has become "the arrows
     * and the column say the same thing" — and that is what is asserted: the
     * column's inbound EXIT links sum to exactly the outbound exits the rows
     * list.
     *
     * ⚠⚠ **MEASURED, AND THE FIRST SPELLING OF THIS ROW WAS WRONG.** The raw
     * totals are NOT equal: 292 inbound links against 280 listed exits. The
     * difference is the **12 `<control @fallthrough>` pits** — a pit is a
     * transition INTO a room that its source room's exit list does not carry,
     * because `exitsOfRoom` reads `doc.exits` and a fallthrough rides
     * `doc.fallthroughs`. So the agreement is over the EXIT kind, and the pits
     * are counted separately rather than quietly absorbed.
     */
    check(afterArm !== null && afterArm.ovInk > 0
        && afterArm.ovW === afterArm.w && afterArm.ovH === afterArm.h
        && VANILLA_XML_ARROWS > 100
        && VANILLA_XML_LINKS.filter((l) => l.kind === 'exit').length
            === VANILLA_XML_ROWS.reduce((a, r) => a + r.exits, 0)
        && VANILLA_XML_LINKS.filter((l) => l.kind === 'fallthrough').length > 0,
        '⛓⛓⛓ **THE ARROWS AND THE LINKS COLUMN ARE ONE READING OF THE GRAPH (E3b)** — every '
        + 'inbound EXIT link the column counts is an outbound exit some room lists, so those '
        + `two totals are equal (${VANILLA_XML_LINKS.filter((l) => l.kind === 'exit').length}); `
        + `the remaining ${VANILLA_XML_LINKS.filter((l) => l.kind === 'fallthrough').length} `
        + 'inbound links are `<control @fallthrough>` PITS, which no exit list carries. '
        + 'And the arrows land on the OVERLAY canvas at the STRIP\'s size '
        + `once the view repaints; node counts ${VANILLA_XML_ARROWS} shapes for this set. `
        + 'The arrows were ALREADY there at LOAD (E3a, the row above) and arming the gesture '
        + '(`setTool`, which repaints too) leaves them on the overlay at the strip\'s size',
        `${json(beforeArm)} → ${json(afterArm)}`);

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
