/**
 * mazeRoom/mazeSetLab — **THE LAB PAGE'S SET-ARM BINDINGS, WITHOUT THE DOM.**
 *
 * EDITOR v3 arc, slice E2c (`NewDocs/plans/seedling-editor-v3.md` §27.4, §30).
 * E2b lifted `mountSetEditor` into `procgenCore/setEditorView.js` and proved a
 * SECOND binding over `mazeSetAdapter` in node, with no page — and it left the
 * binding list as a literal inside `setEditorView.test.js` (§28.9: *"the
 * bindings a page must supply are now a LIST, and it is `mazeBindings` — copy
 * it"*). ⛔ **IT IS MOVED HERE RATHER THAN COPIED.** A copy would be two
 * answers to *"what is the maze's `exits.addressOf`"*, and the first slice to
 * change one would leave the other saying something else — the same reason the
 * mount itself was lifted instead of re-spelled on `lab.html`.
 *
 * ⇒ `setEditorView.test.js` IMPORTS `mazeSetBindings` from this file, so the ten
 * rows that already exercise it are this module's rows too, and
 * `mazeLabView.js`'s SET arm hands the SAME object to the SAME mount. Beside it
 * is the page's INTAKE — which document a pasted or fetched file IS, and which
 * served packs this arm may offer at all.
 *
 * ── ⛔ NO DOM AND NO NODE IMPORTS ─────────────────────────────────────
 *
 * `mazeLab.js`'s law, for the same reason: this file is unit-tested in node and
 * loaded in a browser, so it may reach for neither side's globals. What needs a
 * `document` (the mount, the LOAD box, the room session's canvas) is
 * `mazeLabView.js`'s.
 *
 * ⚠ `drawRoomStill` is the ONE apparent exception, and it is not one: it takes
 * the canvas it is handed and asks it for a 2D context.
 * `mazeRoomRender.drawWorld` reads ZERO `window.`/`document.` (§27.1 #2
 * measured it), so a still is node-drivable against a recording context and IS
 * driven that way.
 */

import { classifyDocument } from '../presets/documentBundle.js';
import { stampIdentity } from '../procgenCore/contentIdentity.js';
import { OVERVIEW } from '../procgenCore/setEditorCore.js';
import { deriveWorldAtlasOf, worldRulesJsonOf } from '../procgenCore/worldDerivation.js';
import {
    WORLD_FIELDS, exitsOfWorldRoom, isWorldSetRefusal, partAt, partRecordOf,
    validateWorldForDownload, worldAdapterFns,
} from '../procgenCore/worldSetAdapter.js';
import { deserializeMazeWorld } from './mazeRoomEngine.js';
import { drawWorld, plainView } from './mazeRoomRender.js';
import { emptyMazeOverlay } from './mazeAtlasDerivation.js';
import {
    LIBRARY_FIELDS, ROOM_FIELDS, SET_OP_KINDS as MAZE_SET_OP_KINDS, blankMazeRoomPayload,
    closeRoomSession, createMazeSetAdapter, downloadLibrary, exitRuleKey, exitsOfRoom,
    isMazeSetRefusal, locationRuleKey, deriveAtlasOf, readSetCell, rulesJsonOf,
    setRecord as mazeSetRecord, validateForDownload, whatLinksHere,
} from './mazeSetAdapter.js';
/**
 * ⛓⛓ EDITOR INTEGRATION W4 — **SEEDLING'S DOCUMENT HALF, AND ONLY THAT.** See
 * the WORLD section's docblock: `mazeRoom/` is under no `bindingContract` rule
 * (it IS a substrate) and ⚖ Q4 put the world editor on this page, so the second
 * part descriptor is plugged in here. ⛔ Nothing from Seedling's RENDERER.
 */
import { LevelSetExitError } from '../seedlingDemo/levelSetExits.js';
import {
    SET_OP_KINDS as SEEDLING_SET_OP_KINDS, SeedlingSetAdapterError, SeedlingSetDeriveRefusal,
    closeRoomSession as seedlingCloseRoomSession, createSeedlingSetAdapter,
    deriveAtlasOf as seedlingDeriveAtlasOf, downloadSet as seedlingDownloadSet,
    exitsOfRoom as seedlingExitsOfRoom, readSetCell as seedlingReadSetCell,
    setRecord as seedlingSetRecord, validateForDownload as seedlingValidateForDownload,
    whatLinksHere as seedlingWhatLinksHere,
} from '../seedlingDemo/seedlingSetAdapter.js';
import {
    ROOM_FIELDS as SEEDLING_ROOM_FIELDS,
} from '../seedlingDemo/seedlingSetAdapter.js';
import {
    SeedlingSetOverlayError, emptyOverlay as emptySeedlingOverlay,
    exitRuleKey as seedlingExitRuleKey, locationRuleKey as seedlingLocationRuleKey,
} from '../seedlingDemo/seedlingSetOverlay.js';
import { roomRecordOf, roomSourceKind } from '../seedlingDemo/levelSetValidator.js';
/**
 * ⛓⛓ **THE SEEDLING LINK-SCAN BOUND IS IMPORTED, NOT RE-DERIVED.** `LINK_SCAN`
 * and `linkScanCost` are facts about the SEEDLING substrate — measured over the
 * vanilla 116 — and they live where they were measured. ⛔ Nothing in
 * `watchSetEditor.js` is EDITED by this slice (its 226-row gate is a QUOTED
 * standing row); this reads ONE exported function, which is the alternative to
 * a second cost model that would part company on the first re-measurement.
 */
import { linkScanBound as seedlingLinkScanBound } from '../seedlingDemo/watchSetEditor.js';

/**
 * ⛓ THE SUBSTRATE THIS ARM CAN OPEN. ⛔ Read off the library index's own
 * `substrates` field rather than matched against a list this file keeps: a pack
 * declares what it holds, and the maze lab may only offer the packs it can
 * actually deserialize.
 */
export const LAB_SUBSTRATE = 'maze';

/**
 * ⛓⛓ **THE SERVED INDEX, FILTERED TO WHAT THIS PAGE CAN OPEN.**
 *
 * `regionLibraryLoader.loadServedIndex` returns every committed pack (a maze
 * one, a bounce one and a runner one today). ⛔ Offering all three would be a
 * picker whose second and third rows refuse on the press — `deserializeMazeWorld`
 * has nothing to do with a bounce zone's payload — so the FILTER is the claim
 * and the browser row asserts it rather than asserting a count that moves the
 * day somebody commits a fourth pack.
 *
 * @param {Array<object>} index `loadServedIndex`'s rows
 * @returns {Array<{file: string, library_id: string, label: string}>}
 */
export function mazeLibraryRows(index) {
    return (Array.isArray(index) ? index : [])
        .filter((row) => Array.isArray(row?.substrates) && row.substrates.includes(LAB_SUBSTRATE))
        .map((row) => ({
            file: row.file,
            library_id: row.library_id,
            label: `${row.name ?? row.file} — ${row.entry_count} entry(ies)`,
        }));
}

/**
 * ⛓⛓⛓ **ONE INTAKE PATH PER DOCUMENT KIND, AND AMBIGUITY REFUSES BY NAME.**
 *
 * The SET arm takes TWO documents: a region LIBRARY (the rooms) and an OVERLAY
 * (the links, the locations and the authored rules — and for the maze the links
 * ARE the graph, §26.6). ⛔ Both arrive through one box, so something has to
 * decide which a pasted document IS, and the answer is `classifyDocument` —
 * the SAME classifier `documentBundle` and `watchViewer`'s load box use. A
 * second predicate here would be a second answer to a question that already has
 * one, and the two would part company on the first new field.
 *
 * ⛔ **A KIND THIS ARM DOES NOT LOAD IS NAMED, NOT CALLED "not a library".** A
 * `rules.json` or a region atlas pasted here is a perfectly well-formed
 * document that belongs to another reader, and *"this is not a region library"*
 * would be a true sentence about the wrong subject (the header-warning trap).
 *
 * @param {unknown} doc a parsed JSON document
 * @returns {{kind: 'library'|'overlay'|null, doc?: object, why?: string}}
 */
export function sniffSetDocument(doc) {
    const kind = classifyDocument(doc);
    if (kind === 'region-library') return { kind: 'library', doc };
    if (kind === 'overlay') return { kind: 'overlay', doc };
    if (kind === 'rules') {
        return {
            kind: null,
            why: 'this is a `rules.json` — the SET arm DERIVES one from the library and the '
                + 'overlay (press `rules.json` to download it), so loading one back would be '
                + 'loading this page\'s own output as its input',
        };
    }
    if (kind === 'region-atlas') {
        return {
            kind: null,
            why: 'this is a REGION ATLAS — the SET arm derives its atlas from the library and '
                + 'the overlay, so an atlas has no input to be. Load the LIBRARY it was '
                + 'compiled from instead',
        };
    }
    if (kind === 'level-set') {
        return {
            kind: null,
            why: 'this is a SEEDLING LEVEL SET (`rooms` is an ARRAY) — that document\'s editor '
                + 'is `seedlingDemo/watch.html?source=edit`. This arm edits a REGION LIBRARY, '
                + 'whose rooms are `entries[]` carrying maze payloads. ⛓ A level set is also '
                + 'one HALF of a WORLD: load the BUNDLE that carries it with a region library '
                + 'and a `world.json` and the SET arm opens both parts at once',
        };
    }
    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W4 — **A WORLD NAMES ITS PARTS AND IS NOT ONE.**
     *
     * `classifyDocument` learns the kind by SHAPE (`parts` an object + `links`
     * an array, W2 §8.2), so this arm can now say what a pasted world IS. ⛔ It
     * still REFUSES, and the reason is the document's own: a world holds NO
     * rooms — its rooms are its parts' — so a world alone has nothing to edit,
     * and the only arrival that can carry a world AND the documents it names is
     * a BUNDLE. ⇒ named, never called "not a region library".
     */
    if (kind === 'world') {
        return {
            kind: null,
            why: 'this is a WORLD document — it NAMES its parts '
                + `(${Object.keys(doc?.parts ?? {}).map((id) => `\`${id}\``).join(', ') || 'none'}) `
                + 'and holds no rooms of its own, so there is nothing here to edit. Load the '
                + 'BUNDLE it travels in (a `.zip` carrying `world.json` beside the `level-set` '
                + 'and the `region-library` it names) through Upload, or hand the page '
                + '`?world=<path>`',
        };
    }
    return {
        kind: null,
        why: 'this JSON is neither a REGION LIBRARY (`library_id` + an `entries` array) nor an '
            + 'OVERLAY (`overlay_id`, or `rooms` keyed by room INDEX) — and it is not any '
            + 'other document this repo writes either, so there is no reader to hand it to',
    };
}

/**
 * ⛓⛓⛓ **THE STILL — `drawWorld` ON THE PAYLOAD'S OWN WORLD.**
 *
 * ⚖ THE ONE-RENDERER LAW: `mountSetEditor` blits what it is handed and the page
 * draws its own substrate. ⛔ **THROUGH `deserializeMazeWorld`, NEVER
 * `deserializeMazeLevel`** — the two spellings are `procgenMaze.js:270-281`'s
 * own warning (§27.1 #3): the LIBRARY payload carries AP-canonical exit and
 * location names and the LAB payload does not.
 *
 * ⛔⛔ **AND THE STILL CANNOT TELL THEM APART — MEASURED, AND SAID RATHER THAN
 * ASSUMED.** E2c's kickoff predicted a mutant here (*"`drawRoomStill` through
 * `serializeMazeLevel`'s world — a still of the wrong document"*). It is GREEN:
 * over all four committed demo-pack entries the two spellings produce
 * BYTE-IDENTICAL draw-op streams (393/379/393/379 calls, first difference at
 * index -1). The reason is structural, not lucky — `drawWorld` reads tiles,
 * items, obstacles, the entrance and exit POSITIONS, and every one of those
 * agrees; what parts company (`side`, `exitName`, `targetRegion`,
 * `targetExitId`, `isBackExit`) is AP vocabulary the RENDERER never looks at.
 * => the right spelling is still load-bearing, and the row that can SEE it is
 * `mazeSetAdapter.test.js`'s CLOSE row (§28.5), not this one. A green row over
 * a mutant nothing can see is not a row (trap 713); `mazeSetLab.test.js` pins
 * the identity so the claim stays a measurement.
 *
 * ⛓ THE TILE SIZE IS DERIVED from the strip cell the mount gives a room and the
 * room's own longer side, so a 15x15 entry and an 11x11 one both fill their
 * cell. ⛔ Never `TILE_PX`: that is the EDIT canvas's 20 px, and at 11 tiles it
 * would draw 220 px into a 96 px box.
 *
 * @param {{cellPx?: number}} [o]
 * @returns {(canvas: object, cell: object, index: number) => string|null}
 */
export function makeDrawRoomStill({ cellPx = OVERVIEW.cellPx } = {}) {
    return function drawRoomStill(canvas, cell) {
        const world = deserializeMazeWorld(cell.payload);
        const tilePx = Math.max(1, Math.floor(cellPx / Math.max(world.width, world.height)));
        canvas.width = world.width * tilePx;
        canvas.height = world.height * tilePx;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'this canvas has no 2D context, so the room has no still';
        drawWorld(ctx, world, plainView({ tilePx }));
        return null;
    };
}

/**
 * ⛓⛓ **THE BASE TAG A SET-SIDE ROOM SESSION CARRIES.**
 *
 * ⛔ It is NOT `mazeSetAdapter.bases.library` — that resolves a whole LIBRARY,
 * and this names ONE ROOM of one. ⚖ Ruling 2's shape and Seedling's own
 * spelling (`{kind: 'set-room', set_id, room}`), in the maze's vocabulary: the
 * `library_id` carries the document's CONTENT HASH, so a payload that named
 * only the index could be re-opened against a library these edits were never
 * edits OF. `entry_id` rides along because a reorder MOVES the index and the
 * entry id does not — a reader of the tag can tell which fact went stale.
 *
 * ⛓ The core never interprets a base (`createEditSession`'s docblock), so this
 * needs no resolver and declares none.
 */
export function roomBaseTag(library, room, entry) {
    return Object.freeze({
        kind: 'library-room',
        library_id: library?.library_id ?? null,
        room,
        entry_id: entry?.entry_id ?? null,
    });
}

/**
 * ⛓⛓ **THE MAZE'S BINDINGS, IN ONE PLACE — MOVED OUT OF `setEditorView.test.js`
 * (§28.9).** Every one of them is a fact about the maze that
 * `procgenCore/setEditorView.js` may not know: an exit is addressed by
 * `exit_id` and not by an ordinal, a location is an `items[]` ORDINAL and not
 * an entity at pixels, the manifest form is `LIBRARY_FIELDS`, the document is a
 * `region-library` whose id is `library_id`, and there is no link-scan bound at
 * all (E2a priced the whole column at 0.363 ms — §26.6).
 *
 * @param {{rulesSchema?: object, drawRoomStill?: Function, blankSize?: Function}} o
 *   `drawRoomStill` — the PAGE's renderer. The node rows hand a RECORDING stub
 *   so the claim is *which room was asked for*, not what it looked like;
 *   `mazeLabView.js` hands `makeDrawRoomStill()`.
 *   `blankSize` — a THUNK `() => ({width, height})` (EDITOR v3 E6b). ⛔ A thunk
 *   and not a value: the size lives in two `<input>`s a person may retype
 *   between presses, and a number read once at mount would be the size the page
 *   had when it loaded rather than the one on screen. ⛔ And a THUNK rather than
 *   the two elements, because this file may not touch a DOM (the docblock's own
 *   law) — the page reads its own inputs and hands back a plain object.
 */
export function mazeSetBindings({
    rulesSchema = null, drawRoomStill = null, blankSize = null,
} = {}) {
    return {
        adapterFns: {
            readSetCell,
            exitsOfRoom,
            whatLinksHere,
            bounds: (record) => ({ w: (record?.library?.entries ?? []).length, h: 1 }),
            validateForDownload,
            deriveAtlasOf,
            rulesJsonOf,
            closeRoomSession,
            download: (session) => {
                const out = downloadLibrary(session);
                return {
                    members: [
                        {
                            kind: 'region-library',
                            doc: out.library,
                            name: `${out.library.library_id}.json`,
                            label: out.library.library_id,
                            readout: '__editorSetOut',
                        },
                        {
                            kind: 'overlay',
                            doc: out.overlay,
                            name: `${out.overlay.overlay_id}.overlay.json`,
                            label: `overlay ${out.overlay.overlay_id}`,
                            readout: '__editorSetOverlayOut',
                        },
                    ],
                    report: out.report,
                    apMappingWhy: out.apMappingWhy,
                };
            },
        },
        document: {
            kind: 'region-library',
            noun: 'library',
            validator: 'validateRegionLibrary',
            idOf: (c) => c.library_id,
            docOf: (record) => record.library,
        },
        ruleKeys: { exit: exitRuleKey, location: locationRuleKey },
        forms: {
            manifestRows: () => LIBRARY_FIELDS.map(
                (field) => ({ field, control: 'text', label: field })),
            roomRows: () => ROOM_FIELDS.map(
                (field) => ({ field, control: 'text', label: field })),
        },
        /**
         * ⛔⛔ **ENDPOINT-ADDRESSED, NOT ORDINAL.** `targetOptions` is the
         * DISTINCT `exit_id`s the library holds, because the destination room is
         * not known until the second click and a maze exit is not positional — a
         * target whose entry has no such exit is refused BY NAME by `connect`,
         * listing what it does have. That is the adapter's sentence, not a
         * second authority here.
         */
        exits: {
            valueOf: (ex) => ex.exit_id,
            labelOf: (ex) => `${ex.exit_id} (${ex.side ?? '·'}) → `
                + `${ex.to === null ? 'unlinked' : `room ${ex.to} ${ex.toExit}`}`,
            addressOf: (value) => String(value),
            targetOptions: (rows) => [...new Set(
                rows.flatMap((r) => r.exitList.map((e) => e.exit_id)))]
                .map((id) => ({ value: id, label: id })),
            disconnectOp: (room, value) => ({ op: 'disconnect', room, exit_id: String(value) }),
        },
        locations: {
            options: (cell) => (cell.payload?.items ?? []).map((it, i) => ({
                value: String(i), label: `${it.id ?? `slot_${i}`} @(${it.x},${it.y})`,
            })),
            emptyWhy: '⛔ pick a SLOT first — `mark-location` names an `items[]` ORDINAL and '
                + 'this entry carries none',
            targetOf: (value) => ({ item: Number(value) }),
        },
        /**
         * ⛔ **THERE IS NO BOUND, AND THAT IS SAID RATHER THAN DEFAULTED.** E2a
         * measured the whole "links here" column at 0.363 ms over a 116-entry
         * library — 0.15 % of `LINK_SCAN`'s 250 ms budget — because the links
         * are ONE authored list and no payload is read at all.
         */
        linkBound: () => ({ ok: true, why: null }),
        isRefusal: isMazeSetRefusal,
        rulesSchema,
        stillKey: (cell) => cell.payload,
        /**
         * ⛓⛓ **EVERY MAZE ROOM IS `record`-EQUIVALENT, BY CONSTRUCTION**
         * (EDITOR v3 E3a, trap 722). A region-library ENTRY carries its whole
         * captured world INLINE as `payload` — there is no external file to
         * point at and no compiled-in blob to name, so the vocabulary Seedling
         * needs three words for has exactly one answer here.
         *
         * ⛔ SAID rather than defaulted, and NOT `null`: `null` would read as
         * *"this substrate does not know"*, and the mount would then have to
         * decide what an unknown kind means for the badge. The maze knows —
         * the badge is never drawn on this page, and that is a claim its gate
         * makes rather than a silence.
         */
        sourceKind: () => 'record',
        drawRoomStill,
        /**
         * ⛓⛓⛓ **ADD ROOM, AND THE WHOLE OP IS THE BINDING'S** (EDITOR v3 E6b).
         * `mountSetEditor`'s press only says WHERE (`at = roomCount()`); what a
         * blank room IS is the substrate's, and Seedling's twin
         * (`watchSetEditor.js`) hands a blank `record` where this hands a
         * `payload`. ⛓ `blankMazeRoomPayload` (E3b) is that vocabulary — a
         * DOORLESS, all-floor world whose `exit_sides` are `[]`, so the room
         * arrives unwired and the REPORT warns about it until a `connect` gives
         * it a door.
         *
         * ⛔ **`null` WHEN NO `blankSize` WAS SUPPLIED**, so a binding built
         * with no page (every node row that does not ask for the button) leaves
         * the press saying *"no `addRoomOp` was injected"* exactly as it did
         * before this slice — the mount's own sentence, not a second one here.
         *
         * ⛔ **AND NOTHING HERE CHECKS THE SIZE.** `createWorld` refuses a
         * dimension below 2 by name (`invalid dimensions 1x11`) and
         * `blankTileGridLibraryEntry`'s docblock already says the refusal is
         * left to it *"so there is one authority for what a world may be"*. The
         * `<input min="2">` on the page is a hint to a person, not a gate.
         */
        addRoomOp: blankSize === null ? null : (at) => ({
            op: 'add-room', at, payload: blankMazeRoomPayload(blankSize()),
        }),
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — THE WORLD: ITS PARTS, AND ITS INTAKE
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔⛔ **THIS FILE NOW IMPORTS BOTH SUBSTRATES, AND THAT IS EXACTLY WHERE THE
 * LAW PUTS THEM.** `bindingContract.test.js` reads `procgenCore/`'s directory
 * and refuses a shipping module THERE that imports `seedlingDemo/`,
 * `mazeRoom/` or `flashPanel/` — which is why W2's three world modules take
 * every substrate half INJECTED. `mazeRoom/` is under no such rule (it IS a
 * substrate) and ⚖ Q4 ruled `lab.html` is the world editor's page, so the two
 * part descriptors are plugged in HERE, once, in the same shape
 * `seedlingDemo/worldChain.test.js` plugs them in for node.
 *
 * ⚖ **THE ONE-RENDERER LAW IS NOT BENT BY IT.** What is imported is Seedling's
 * SET ADAPTER — the DOCUMENT half. Its PAINTER (`previewLevel`, `makeRenderer`,
 * `levelWorld`'s tileset) is not imported and may not be: a Seedling room's
 * still is `watch.html`'s to draw, and on this page a Seedling cell gets a
 * BADGE and the room's name (§10, `worldSetBindings.drawRoomStill`).
 */

/**
 * ⛓⛓ **THE GAME A WORLD'S SEEDLING PART DECLARES, AND WHY IT IS A CONSTANT
 * WITH A ROW UNDER IT.**
 *
 * A merged atlas takes the START part's `game` (W2 §8.3 #3) and the compiler
 * keys its FLASH row off `substrateIdFor(atlas.game)` — so for the Seedling
 * rooms of a world to compile as `flash_seedling` (the substrate the player's
 * registry and `flashSeedlingLibrary` know), the game has to be this word.
 * ⛔ `substrateIdFor` is a slug function and cannot be inverted, so the value
 * cannot be DERIVED from the substrate id; it is PINNED against it instead —
 * `mazeSetLab.test.js` asserts `substrateIdFor(SEEDLING_ATLAS_GAME)` is
 * `flashSeedlingLibrary`'s own registry id, so the day either moves the row
 * says so. ⚠ It is deliberately NOT `watch.html`'s `'seedling-watch-edit'`,
 * which slugs to `flash_seedling_watch_edit` — a substrate nothing plays.
 */
export const SEEDLING_ATLAS_GAME = 'seedling';

/**
 * ⛓⛓⛓ **THE PART DESCRIPTORS FOR ONE LOADED WORLD — ONE PER DECLARED PART.**
 *
 * ⛔⛔ **THE IDS ARE THE WORLD'S, NEVER THIS FILE'S.** A world document names
 * its own parts (`world.parts` is `{<partId>: {kind, …}}`), and a page that
 * minted `seed`/`mz` would open somebody else's world under two names it does
 * not use — every op is addressed by part id, so the strip would refuse every
 * press. What this file supplies is the SUBSTRATE HALF for each declared
 * `kind`, in DECLARATION ORDER, which is also the order the composite
 * concatenates rooms in and the order that decides the START part.
 *
 * ⛔ **ONE PART PER KIND, AND THE SECOND REFUSES BY NAME.** A bundle carries at
 * most one member of each kind (`documentBundle`'s reader throws on two), so a
 * world declaring two level sets names a document this page can never hold. It
 * is the PAGE's limit and not the world model's, and it is said as one.
 *
 * ⛓ `idOf` rides on the descriptor because the world manifest's `doc_id` has to
 * be compared against the held document's own stamp — `set_id` on one side,
 * `library_id` on the other. It is the field each substrate's own
 * `document.idOf` names for the mount, and a row asserts the maze's two agree.
 *
 * @param {object} o
 * @param {object} o.world           the loaded world document
 * @param {object} [o.rulesSchema]   the fetched `rules.schema.json`
 * @param {string} [o.mapDocument]   what the merged atlas's `map_document` says
 * @param {number} o.tileSize        Seedling's pixels-per-tile (`levelWorld.TILE_SIZE`)
 * @param {Function} o.parseOel      `procgenLevelOel.parseOelLevel`
 * @param {Function} o.tileTypeForPlacement  `flashPanel/seedlingSemantics`'s
 * @param {Function} o.substrateIdFor        the compiler's own game → substrate map
 * @returns {{parts: Array<object>, deps: object, errors: Array<string>}}
 */
export function worldPartDescriptors({
    world, rulesSchema = null, mapDocument = 'world.json', tileSize,
    parseOel, tileTypeForPlacement, substrateIdFor,
} = {}) {
    const errors = [];
    const parts = [];
    const deps = {};
    const seen = new Set();
    for (const [id, row] of Object.entries(world?.parts ?? {})) {
        if (seen.has(row?.kind)) {
            errors.push(`this world declares a SECOND \`${row.kind}\` part ("${id}") — a bundle `
                + 'carries at most one member of each kind, so `lab.html` can hold only one '
                + `${row.kind} at a time and the second would have no document`);
            continue;
        }
        if (row?.kind === 'level-set') {
            seen.add(row.kind);
            const seedDeps = Object.freeze({
                parseOel,
                tileSize,
                tileTypeForPlacement,
                rulesSchema,
                atlas: { game: SEEDLING_ATLAS_GAME, mapDocument },
            });
            deps[id] = seedDeps;
            parts.push(seedlingPartDescriptor(id, seedDeps, substrateIdFor));
        } else if (row?.kind === 'region-library') {
            seen.add(row.kind);
            deps[id] = {};
            parts.push(mazePartDescriptor(id, rulesSchema));
        } else {
            errors.push(`part "${id}" declares kind ${JSON.stringify(row?.kind)}; `
                + '`lab.html` holds a `level-set` (Seedling) and a `region-library` (the maze), '
                + 'and there is no third substrate half to plug in for anything else');
        }
    }
    if (parts.length === 0 && errors.length === 0) {
        errors.push('this world declares no parts at all — its rooms ARE its parts\' rooms, so '
            + 'there is nothing for the strip to show');
    }
    return { parts: Object.freeze(parts), deps: Object.freeze(deps), errors };
}

/** ⛓ Seedling's half — the SET adapter and the four readers `roomRowsOf` takes. */
function seedlingPartDescriptor(id, seedDeps, substrateIdFor) {
    const adapter = createSeedlingSetAdapter(seedDeps);
    /**
     * ⛓ The four refusal CLASSES Seedling's own `apply` catches, composed from
     * the CLASSES rather than from their names — W2's chain composes the same
     * list, and a class one reader named and the other did not is a data
     * condition that crashes on one path and is a row on the other.
     */
    const isRefusal = (e) => [
        SeedlingSetAdapterError, SeedlingSetDeriveRefusal, SeedlingSetOverlayError,
        LevelSetExitError,
    ].some((Klass) => e instanceof Klass);
    return Object.freeze({
        id,
        kind: 'level-set',
        adapter,
        opKinds: SEEDLING_SET_OP_KINDS,
        recordOf: (set, overlay) => seedlingSetRecord(set, overlay ?? emptySeedlingOverlay()),
        splitRecord: (record) => ({ doc: record.set, overlay: record.overlay }),
        readSetCell: seedlingReadSetCell,
        exitsOfRoom: seedlingExitsOfRoom,
        whatLinksHere: seedlingWhatLinksHere,
        bounds: adapter.bounds,
        isRefusal,
        /**
         * ⛔ DERIVED from the very dep the derivation reads, never the literal
         * `'flash_seedling'` (W1 §7.1 #2 — the literal is a mutant that reds
         * four rows over a generated set).
         */
        substrateOfRoom: () => substrateIdFor(seedDeps.atlas.game),
        validateForDownload: seedlingValidateForDownload,
        deriveAtlasOf: seedlingDeriveAtlasOf,
        closeRoomSession: seedlingCloseRoomSession,
        download: seedlingDownloadSet,
        emptyOverlay: emptySeedlingOverlay,
        idOf: (doc) => doc?.set_id ?? null,
        ruleKeys: { exit: seedlingExitRuleKey, location: seedlingLocationRuleKey },
        noun: 'level set',
        validator: 'validateLevelSet',
        /** ⛓ The registry PAGE this part's rooms are edited on — W3 §9.2's word. */
        page: 'seedling',
    });
}

/** ⛓ …and the maze's, over the SAME functions `mazeSetBindings` hands the mount. */
function mazePartDescriptor(id, rulesSchema) {
    const adapter = createMazeSetAdapter({ rulesSchema });
    return Object.freeze({
        id,
        kind: 'region-library',
        adapter,
        opKinds: MAZE_SET_OP_KINDS,
        recordOf: (library, overlay) => mazeSetRecord(library, overlay ?? emptyMazeOverlay()),
        splitRecord: (record) => ({ doc: record.library, overlay: record.overlay }),
        readSetCell,
        exitsOfRoom,
        whatLinksHere,
        bounds: adapter.bounds,
        isRefusal: isMazeSetRefusal,
        /** ⛓ …and the maze's substrate is the ENTRY's own field, PER ROOM (W1 §7.3). */
        substrateOfRoom: (record, room) => record.library.entries[room]?.substrate ?? null,
        validateForDownload,
        deriveAtlasOf,
        closeRoomSession,
        download: downloadLibrary,
        emptyOverlay: emptyMazeOverlay,
        idOf: (doc) => doc?.library_id ?? null,
        ruleKeys: { exit: exitRuleKey, location: locationRuleKey },
        noun: 'region library',
        validator: 'validateRegionLibrary',
        page: LAB_SUBSTRATE,
    });
}

/**
 * ⛓⛓⛓ **BIND A BUNDLE'S MEMBERS TO A WORLD'S DECLARED PARTS.**
 *
 * ⛔⛔ **BY `doc_id`, NEVER BY POSITION.** A world's manifest carries a
 * `doc_id` per part precisely so a reader can tell whether the documents in the
 * zip are the ones the world was authored over — the parts are an OBJECT and
 * objects have no position anybody should rely on, and two documents of two
 * kinds would bind "correctly" under any ordering right up until somebody
 * builds a world of two libraries. So the KIND resolves which member is a
 * candidate and the `doc_id` DECIDES, refusing by name and naming WHICH part
 * disagreed and both ids. ⚠ A part whose `doc_id` is absent binds by kind and
 * SAYS SO in a note: W2 made the field optional and a world an editor is
 * holding may legitimately not have been stamped yet.
 *
 * ⛔ Each member has already been through its OWN validator by the time it gets
 * here — this function decides IDENTITY, not validity, exactly as
 * `classifyDocument` decides kind and the validator decides goodness.
 *
 * @param {object} o
 * @param {object} o.world    the world document out of the bundle
 * @param {Array<{kind: string, doc: object}>} o.members  the bundle's members
 * @param {Array<object>} o.parts  `worldPartDescriptors`' output
 * @returns {{ok: boolean, docs: object, errors: Array<string>, notes: Array<string>}}
 */
export function bindWorldParts({ world, members = [], parts = [] } = {}) {
    const errors = [];
    const notes = [];
    const docs = {};
    const byKind = new Map(members.map((m) => [m.kind, m.doc]));
    for (const part of parts) {
        const doc = byKind.get(part.kind);
        if (doc === undefined) {
            errors.push(`part "${part.id}" is a \`${part.kind}\` and this bundle carries none — `
                + `it holds ${members.map((m) => `\`${m.kind}\``).join(', ') || 'no recognised member'}`);
            continue;
        }
        const declared = world?.parts?.[part.id]?.doc_id;
        const held = part.idOf(doc);
        if (declared === undefined) {
            notes.push(`part "${part.id}" declares no \`doc_id\`, so its \`${part.kind}\` was `
                + `bound BY KIND — the held document is stamped \`${held ?? '(unstamped)'}\``);
        } else if (declared !== held) {
            errors.push(`part "${part.id}" names \`${declared}\` and the \`${part.kind}\` in `
                + `this bundle is stamped \`${held ?? '(unstamped)'}\` — these are not the same `
                + 'document. ⛓ A world\'s links name ROOM INDICES into the documents it was '
                + 'authored over, so opening it against a different one would put every '
                + 'crossing on a door nobody drew');
        }
        docs[part.id] = doc;
    }
    const held = new Set(parts.map((p) => p.kind));
    for (const m of members) {
        if (m.kind === 'world' || held.has(m.kind)) continue;
        notes.push(`the \`${m.kind}\` member was NOT loaded — a world's parts are the documents `
            + 'its manifest names, and this one is not among them');
    }
    return { ok: errors.length === 0, docs, errors, notes };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — THE WORLD'S BINDINGS FOR `mountSetEditor`
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **AN ENDPOINT VALUE CARRIES THE PART THAT SPELLED IT.**
 *
 * ⛔⛔ The two substrates address an exit DIFFERENTLY — Seedling by the
 * ORDINAL its `exitsOfRoom` numbers the row with, the maze by `exit_id` — and
 * the strip's two `<select>`s hold ONE string each for the whole world. A
 * binding that guessed from the string's SHAPE (`"0"` is an ordinal, `"exit_3"`
 * is an id) would be a second authority on what an exit IS, and it would guess
 * wrong the day a maze pack names an entry `"0"`. So the VALUE is
 * `<part>/<the part's own value>`, built and read back by the same pair of
 * functions, and `addressOf` hands the part's own `addressOf` its own half.
 *
 * ⛓ `/` is safe: `worldDocument.PART_ID_RE` is `[A-Za-z0-9_-]+`, so a part id
 * cannot contain one and the FIRST `/` is always the separator.
 */
const partedValue = (part, value) => `${part}/${value}`;
const splitPartedValue = (value) => {
    const at = String(value ?? '').indexOf('/');
    return at < 0 ? { part: null, value: String(value ?? '') }
        : { part: String(value).slice(0, at), value: String(value).slice(at + 1) };
};

/**
 * ⛓⛓⛓ **SEEDLING'S EXIT AND LOCATION BINDINGS, SPELLED HERE.**
 *
 * ⛔ **THIS IS A SECOND SPELLING OF `watchSetEditor.js`'s `SET_EXITS` /
 * `setLocations`, AND IT IS SAID RATHER THAN HIDDEN.** Those two are `const`s
 * private to that page's mount, `watchSetEditor.js` is outside this slice's
 * scope, and exporting them would be an edit to the most-gated file in the
 * Seedling arm (its 226-row gate is a QUOTED standing row). ⇒ the second
 * spelling exists, and what keeps it honest is that its rows are scored
 * against the **LAW** and not against the other spelling: the address this
 * produces is handed to Seedling's own `connect` / `disconnect` / `mark-location`
 * and the claim is that the ADAPTER accepts it (⚖ *"score a discriminator
 * against the LAW"*). A row that compared two bindings would pass whatever both
 * happened to say.
 */
const SEEDLING_EXITS = Object.freeze({
    valueOf: (ex) => String(ex.index),
    labelOf: (ex) => `#${ex.index} ${ex.element} → room ${ex.to} `
        + `@(${ex.playerx ?? '·'},${ex.playery ?? '·'})`,
    addressOf: (value) => {
        const n = Number(value);
        return Number.isInteger(n) ? n : 0;
    },
    optionsOf: (rows) => {
        const most = rows.reduce((n, r) => Math.max(n, r.exitList.length), 0);
        return Array.from({ length: Math.max(1, most) },
            (_, i) => ({ value: String(i), label: `#${i}` }));
    },
    disconnectOp: (room, value) => ({ op: 'disconnect', room, exitIndex: Number(value) }),
});

const SEEDLING_LOCATIONS = (parseOel) => Object.freeze({
    options: (cell) => {
        let entities = [];
        try {
            entities = roomRecordOf(cell.room, { parseOel }).entities ?? [];
        } catch (e) {
            if (!(e instanceof Error)) throw e;
            entities = [];
        }
        return entities.map((ent) => ({
            value: JSON.stringify({ type: ent.type, x: ent.x, y: ent.y }),
            label: `${ent.type} @(${ent.x},${ent.y})`,
        }));
    },
    targetOf: (value) => ({ entity: JSON.parse(value) }),
});

/** ⛓ …and the maze's, taken from `mazeSetBindings` — the ONE authority there. */
const MAZE_UI = (rulesSchema) => {
    const b = mazeSetBindings({ rulesSchema });
    return Object.freeze({
        exits: Object.freeze({
            valueOf: b.exits.valueOf,
            labelOf: b.exits.labelOf,
            addressOf: b.exits.addressOf,
            optionsOf: (rows) => b.exits.targetOptions(rows),
            disconnectOp: b.exits.disconnectOp,
        }),
        locations: Object.freeze({ options: b.locations.options, targetOf: b.locations.targetOf }),
        sourceKind: b.sourceKind,
        stillKey: b.stillKey,
        roomFields: ROOM_FIELDS,
        linkBound: b.linkBound,
    });
};

/** ⛓ The UI half for one part descriptor, by its KIND. */
function partUi(part, { rulesSchema, parseOel }) {
    if (part.kind === 'region-library') return MAZE_UI(rulesSchema);
    return Object.freeze({
        exits: SEEDLING_EXITS,
        locations: SEEDLING_LOCATIONS(parseOel),
        sourceKind: (cell) => roomSourceKind(cell.room?.source),
        stillKey: (cell) => cell.room?.source ?? null,
        roomFields: SEEDLING_ROOM_FIELDS,
        linkBound: (record) => seedlingLinkScanBound(record),
    });
}

/**
 * ⛓⛓⛓ **THE WORLD'S BINDINGS — the same object `mazeSetBindings` is, over
 * `worldSetAdapter`'s composite instead of one substrate.**
 *
 * Every per-room binding DISPATCHES on the cell's own `part` (which W2's
 * `readWorldCell` adds), and every per-record one is the world module's. ⛔ The
 * mount is unchanged apart from the two seams W4 added — the SUBSTRATE badge
 * and the optional overlay clause — because everything else it presses was
 * already a parameter.
 *
 * @param {object} o
 * @param {Array<object>} o.parts  `worldPartDescriptors`' output
 * @param {object} o.deps          its `deps`, keyed by part id
 * @param {object} [o.rulesSchema]
 * @param {Function} [o.drawMazeStill] `makeDrawRoomStill()` — the maze's painter
 * @param {Function} o.parseOel
 * @param {object} [o.compileOptions] the maze row's `gridFor` and any injected
 *   `sidecarBuilders` (W2 §8.5) — the page builds it, this file threads it
 * @param {string} [o.gameName]
 */
export function worldSetBindings({
    parts = [], deps = {}, rulesSchema = null, drawMazeStill = null, parseOel = null,
    compileOptions = {}, gameName = 'World',
} = {}) {
    const byId = new Map(parts.map((p) => [p.id, p]));
    const ui = new Map(parts.map((p) => [p.id, partUi(p, { rulesSchema, parseOel })]));
    const uiOf = (id) => ui.get(id) ?? null;
    const partOfCell = (cell) => byId.get(cell?.part) ?? null;

    return {
        adapterFns: {
            ...worldAdapterFns(parts),
            /**
             * ⛓ EVERY EXIT ROW IS TAGGED WITH ITS PART, so the two `<select>`s
             * can build a value that survives the round trip. ⛔ The part's own
             * rows are otherwise VERBATIM — a binding that rebuilt them would
             * drop whatever field the row carries that this file does not
             * enumerate (trap 823's shape).
             */
            exitsOfRoom: (record, room) => exitsOfWorldRoom(record, room, parts)
                .map((ex) => ({ ...ex, part: partAt(record, room, parts).part.id })),
            validateForDownload: (session) => validateWorldForDownload(session, parts),
            deriveAtlasOf: (record, d) => deriveWorldAtlasOf(record, { parts, deps: d ?? deps }),
            rulesJsonOf: (session, d, { compileRegionAtlas } = {}) => worldRulesJsonOf(
                session, d ?? deps,
                { compileRegionAtlas, parts, gameName, compileOptions },
            ),
            /**
             * ⛓⛓⛓ **A ROOM CLOSES INTO ITS OWN PART, THROUGH THE PART'S OWN
             * FUNCTION, AGAINST A SESSION SHIM.** ⛔ Not re-implemented here:
             * the maze's close runs the CAPTURE path (`serialize`+`extract`) and
             * Seedling's hands the room record straight over, and a world that
             * spelled either a second time would be the page deciding what a
             * saved room IS. The shim gives the part its OWN record and
             * re-globalises the `room` of whatever op it applies, so the op the
             * SESSION stores is addressed the way every other world op is.
             */
            closeRoomSession: (setSession, roomSession, room) => {
                const at = partAt(setSession.record(), room, parts, '`closeRoomSession`');
                return at.part.closeRoomSession(
                    partSessionShim(setSession, at), roomSession, at.local,
                );
            },
            download: (session) => worldDownloadMembers(session, parts),
        },
        document: {
            kind: 'world',
            noun: 'world',
            validator: 'worldErrors',
            idOf: (w) => w?.world_id ?? null,
            docOf: (record) => record.world,
        },
        /**
         * ⛓ BOTH PARTS' RULE KEYS ARE THE SAME FUNCTION OBJECT —
         * `procgenCore/setOverlay.js` builds both overlays, so this is not a
         * choice between two spellings, and a row asserts the identity rather
         * than letting the page pick a side.
         */
        ruleKeys: { exit: exitRuleKey, location: locationRuleKey },
        forms: {
            /** ⛓ The WORLD's own two fields — a PART's field needs `{part, path}`,
             *  which this form has no control for, and `set-field` says so. */
            manifestRows: () => WORLD_FIELDS.map(
                (field) => ({ field, control: 'text', label: field })),
            /**
             * ⛓ …and the room form is the UNION of the parts' room fields, in
             * part order. ⛔ A field the cell's part does not have is REFUSED BY
             * NAME by that part (`set-room-field` is forwarded), which is one
             * authority; a form that filtered by the selection would be a second.
             */
            roomRows: () => parts.flatMap((p) => uiOf(p.id).roomFields.map(
                (field) => ({ field, control: 'text', label: `${field} (${p.id})` }),
            )),
        },
        exits: {
            valueOf: (ex) => partedValue(ex.part, uiOf(ex.part).exits.valueOf(ex)),
            labelOf: (ex) => `${ex.part} · ${uiOf(ex.part).exits.labelOf(ex)}`,
            addressOf: (value) => {
                const { part, value: inner } = splitPartedValue(value);
                return uiOf(part) ? uiOf(part).exits.addressOf(inner) : inner;
            },
            targetOptions: (rows) => parts.flatMap((p) => {
                const mine = rows.filter((r) => (r.exitList[0]?.part ?? null) === p.id);
                if (mine.length === 0) return [];
                return uiOf(p.id).exits.optionsOf(mine).map((o) => ({
                    value: partedValue(p.id, o.value), label: `${p.id} · ${o.label}`,
                }));
            }),
            disconnectOp: (room, value) => {
                const { part, value: inner } = splitPartedValue(value);
                return uiOf(part)
                    ? uiOf(part).exits.disconnectOp(room, inner)
                    : { op: 'disconnect', room };
            },
        },
        locations: {
            options: (cell) => (uiOf(cell?.part)?.locations.options(cell) ?? []).map((o) => ({
                value: partedValue(cell.part, o.value), label: o.label,
            })),
            emptyWhy: '⛔ pick a SLOT or an ENTITY first — a world\'s `mark-location` is its '
                + 'PART\'s (an `items[]` ORDINAL in a maze room, a body at exact pixels in a '
                + 'Seedling one), and this room offers none',
            targetOf: (value) => {
                const { part, value: inner } = splitPartedValue(value);
                return uiOf(part) ? uiOf(part).locations.targetOf(inner) : { item: Number(inner) };
            },
        },
        /**
         * ⛓ THE BOUND IS EVERY PART'S, AND THE FIRST REFUSAL WINS — a world's
         * link column is scanned part by part, so a Seedling half too big to
         * scan bounds the whole strip and SAYS WHICH PART did.
         */
        linkBound: (record) => {
            for (const part of parts) {
                const inner = uiOf(part.id).linkBound(partRecordOf(record, part));
                if (!inner.ok) return { ok: false, why: `part "${part.id}": ${inner.why}` };
            }
            return { ok: true, why: null };
        },
        isRefusal: (e) => isWorldSetRefusal(e) || parts.some((p) => p.isRefusal(e)),
        rulesSchema,
        stillKey: (cell) => uiOf(cell?.part)?.stillKey(cell) ?? null,
        sourceKind: (cell) => uiOf(cell?.part)?.sourceKind(cell) ?? null,
        /**
         * ⛓⛓⛓ **THE SUBSTRATE BADGE — READ OFF THE CELL, NOT DERIVED.** W2's
         * `readWorldCell` puts `substrate` on every descriptor from the PART's
         * own reader, so the strip labels each room with the substrate that
         * will play it without deriving anything.
         */
        cellSubstrate: (cell) => cell?.substrate ?? null,
        /** ⛓ …and the identity line names the parts, where a set names its overlay. */
        identityOf: (record) => `${parts.length} part(s): ${parts
            .map((p) => `${p.id} (${p.kind}, ${p.bounds(partRecordOf(record, p)).w} room(s))`)
            .join(', ')}`,
        /**
         * ⛓⛓ **THE STILL DISPATCHES BY SUBSTRATE, AND FOR A SEEDLING ROOM THIS
         * PAGE HAS NO PAINTER.** ⚖ The one-renderer law: a Seedling room is
         * drawn by `watch.html`, and importing its painter here would put two
         * renderers for one substrate in the tree. ⇒ a Seedling cell gets a
         * CARD — the substrate, the room's name and what its source IS — which
         * is the honest picture this page can draw of a room it does not render.
         */
        drawRoomStill: (canvas, cell, index) => {
            const part = partOfCell(cell);
            if (part?.kind === 'region-library' && drawMazeStill) {
                return drawMazeStill(canvas, cell, index);
            }
            return drawRoomCard(canvas, cell, index);
        },
        /**
         * ⛔ **NO `addRoomOp`, AND THE REASON IS THE OP'S OWN SHAPE.** A world's
         * `add-room` is PART-ADDRESSED (`{op:'add-room', part, at}`) because a
         * room belongs to a document, and the mount's press says only WHERE
         * (`at = roomCount()`). A world strip therefore needs a control that
         * names the part, and W4 does not add one — the press keeps the mount's
         * own sentence (*"no `addRoomOp` was injected"*) rather than this file
         * guessing a part for it.
         */
        addRoomOp: null,
    };
}

/**
 * ⛓⛓ **A SESSION SHIM FOR ONE PART** — `record()` is that part's, and `apply`
 * re-globalises the op's `room` before handing it to the WORLD session. ⛔ The
 * part's own `closeRoomSession` reads the record (the maze's resolves the entry
 * to name it in its refusal) and applies exactly one op; both halves have to be
 * in the part's coordinates on the way in and the world's on the way out.
 */
function partSessionShim(setSession, at) {
    return {
        record: () => at.record,
        apply: (op) => setSession.apply(
            Number.isInteger(op?.room) ? { ...op, room: at.offset + op.room } : op,
        ),
    };
}

/**
 * ⛓ **THE CARD A ROOM THIS PAGE CANNOT RENDER GETS.** ⛔ It is not a picture of
 * the room and does not pretend to be one: the substrate, the name and the
 * source kind, on a plain field — everything the strip can say truthfully about
 * a Seedling room without a Seedling renderer.
 */
export function drawRoomCard(canvas, cell, index) {
    canvas.width = OVERVIEW.cellPx;
    canvas.height = OVERVIEW.cellPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'this canvas has no 2D context, so the room has no card';
    ctx.fillStyle = '#1b2430';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#8fd7a0';
    ctx.font = '9px monospace';
    ctx.fillText(String(cell?.substrate ?? '?'), 4, 30);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(String(cell?.room?.name ?? `room ${index}`).slice(0, 12), 4, 44);
    ctx.fillStyle = '#9aa';
    ctx.fillText(`(${roomSourceKind(cell?.room?.source) ?? 'no source'})`, 4, 58);
    return null;
}

/**
 * ⛓⛓⛓ **A WORLD'S DOWNLOAD — THE FOUR DOCUMENTS, ONE STAMP, ONE PRESS.**
 *
 * Each part's own `download` runs against its own SESSION SHIM, so the level
 * set is stamped by `downloadSet` and the region library by `downloadLibrary` —
 * their sentences, their validators, their `apMapping` companion (or the maze's
 * `why` for not having one). ⛔ The WORLD is stamped HERE and only here: W2
 * left `world_id` unstamped on purpose because stamping belongs to the download
 * the page owns (§8.10 residue), and `stampIdentity` is the same function both
 * substrates stamp with — one hash function for every document in the tree.
 *
 * ⛔ **THE PARTS' OVERLAYS ARE NOT SEPARATE MEMBERS.** A world IS the composite
 * overlay (W2 §8.2: `BUNDLE_ENTRY_NAMES` derives one `overlay.json` per bundle
 * and two overlays cannot both ride it), so each part's stamped overlay is
 * written back INTO the world document before it is stamped — which is what
 * makes the world's own hash cover both halves. The parts' overlays therefore
 * travel, exactly once, inside the member that names them.
 *
 * ⛓ The `rules.json` and the derived `region-atlas` are the MOUNT's to add:
 * they ride on the REPORT's verdict (§21.8's law — the export refuses while the
 * graph does not close), and this function is what says which documents the
 * press produces regardless of it.
 */
export function worldDownloadMembers(session, parts) {
    const record = session.record();
    const members = [];
    const notes = [];
    const overlays = {};
    let edits = 0;
    const warnings = [];
    for (const part of parts) {
        const at = { record: partRecordOf(record, part), offset: 0 };
        const out = part.download({ record: () => at.record, ops: () => session.ops() });
        const doc = out.set ?? out.library;
        overlays[part.id] = out.overlay;
        members.push({
            kind: part.kind,
            doc,
            name: `${part.idOf(doc)}.json`,
            label: `${part.id}: ${part.idOf(doc)}`,
            readout: null,
        });
        if (out.apMapping) {
            members.push({
                kind: 'ap-mapping',
                doc: out.apMapping,
                name: `${part.idOf(doc)}.ap-invalidation.json`,
                label: `${part.id}: the apMapping companion`,
                whyNotMember: 'it is DERIVED from the set on demand and travels beside the '
                    + 'bundle, never inside it',
                readout: null,
            });
        }
        if (out.apMappingWhy) notes.push(`part "${part.id}": ${out.apMappingWhy}`);
        edits = session.ops().length;
        for (const w of out.report?.warnings ?? []) warnings.push(`part "${part.id}": ${w}`);
    }
    /**
     * ⛔ A COPY, AND THE `world_id` IS STRIPPED OF ITS OLD HASH BY
     * `stampIdentity` ITSELF — the same rule both substrates' downloads follow,
     * so two presses over the same edits produce the same id.
     */
    const world = stampIdentity(
        {
            ...record.world,
            overlays,
            provenance: { ...(record.world.provenance ?? {}) },
        },
        { idKey: 'world_id', defaultBase: 'world' },
    );
    members.unshift({
        kind: 'world',
        doc: world,
        name: `${world.world_id}.json`,
        label: `world ${world.world_id}`,
        readout: '__editorWorldOut',
    });
    return {
        members,
        report: {
            world_id: world.world_id,
            parts: parts.map((p) => p.id),
            rooms: worldAdapterFns(parts).bounds(record).w,
            links: (record.world.links ?? []).length,
            edits,
            warnings,
        },
        apMappingWhy: notes.join(' | ') || null,
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — CROSS-PART DOORS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **WHAT A CROSS-PART DOOR MAY BE ATTACHED TO, PER ROOM — THE DERIVED
 * ATLAS'S OWN EXIT IDS.**
 *
 * ⛔⛔ **NOT THE PART'S OWN EXIT VOCABULARY** (§8.10 #4). A `world.links`
 * endpoint names the exit id the MERGED ATLAS carries, and neither part spells
 * its exits that way on the authoring side: Seedling's set adapter addresses an
 * exit by an ORDINAL and its derivation emits `out_<type>_<x>_<y>`; the maze's
 * `exit_id` happens to survive the derivation and its SIDE does not. A gesture
 * built from `exitsOfRoom` would therefore offer a Seedling ordinal where the
 * link wants a derived id — and `deriveWorldAtlas` would refuse it by name,
 * listing exits nobody could have picked from the strip.
 *
 * ⛓ The rooms are resolved to regions BY `map_ref`, which is what both
 * derivations write it as and what `deriveWorldAtlas` itself resolves endpoints
 * with — one answer, not two. ⚠ A room the derivation DROPPED (Seedling drops a
 * region no link reaches that holds nothing) has NO region and says so, rather
 * than offering an empty list that reads as *"this room has no doors"*.
 *
 * @param {object} record the world record
 * @param {Array<object>} parts
 * @param {object} deps    keyed by part id
 * @returns {{ok: boolean, why?: string, rows?: Array<object>}}
 */
export function worldDoorRows(record, parts, deps) {
    let derived;
    try {
        derived = deriveWorldAtlasOf(record, { parts, deps });
    } catch (e) {
        if (!(e instanceof Error)) throw e;
        return { ok: false, why: `the world's atlas does not derive, so there are no exits to `
            + `offer — ${e.message}` };
    }
    const byPart = new Map();
    for (const region of derived.atlas.regions ?? []) {
        const split = String(region.region_id).split('.');
        const part = split.length > 1 ? split[0] : null;
        if (!byPart.has(part)) byPart.set(part, new Map());
        byPart.get(part).set(region.map_ref, region);
    }
    const rows = [];
    let offset = 0;
    for (const part of parts) {
        const partRecord = partRecordOf(record, part);
        const count = part.bounds(partRecord).w;
        for (let local = 0; local < count; local += 1) {
            const region = byPart.get(part.id)?.get(local) ?? null;
            rows.push({
                index: offset + local,
                part: part.id,
                local,
                name: part.readSetCell(partRecord, local, 0).room?.name ?? '',
                region_id: region?.region_id ?? null,
                exits: region ? (region.exits ?? []).map((ex) => ex.exit_id) : [],
                why: region ? null : 'the derivation kept NO region for this room — no link in '
                    + 'its own part reaches it and it holds nothing, so there is no exit for a '
                    + 'crossing to leave by until it has one',
            });
        }
        offset += count;
    }
    return { ok: true, rows, atlas: derived.atlas };
}

/**
 * ⛓⛓⛓ **THE PRESS'S OWN CONSEQUENCE, SHOWN BEFORE IT** — the DISPLACEMENT
 * (§8.3) and any refusal, read off the DERIVATION ITSELF rather than predicted.
 *
 * ⛔⛔ A preview that reasoned about displacement on its own would be a SECOND
 * model of a rule whose whole point is that it is subtle: a world link unwires
 * the part-internal connection on its `from` endpoint, but only one whose two
 * endpoints are in the SAME part — and W2 shipped that rule's first spelling
 * with a defect precisely because the second condition is easy to miss. ⇒ the
 * preview appends the candidate link to a COPY of the record, derives, and
 * reports what the merge SAID. One authority, and the sentence the reader sees
 * before the press is the sentence they get after it.
 *
 * @returns {{ok: boolean, why?: string, displaced?: Array<object>, notes?: Array<string>}}
 */
export function worldDoorPreview(record, parts, deps, link) {
    /**
     * ⛔⛔ **THE OP IS PROJECTED ONTO A LINK, FIELD BY NAME.** A `connect` op and
     * a `world.links[]` entry share three fields and the op carries a fourth
     * (`op`), and `worldErrors` refuses an undeclared field on a link BY NAME —
     * which is how this row found the first spelling, where the whole op went
     * in and the preview came back *"world.links[0].op is not a declared
     * field"* on a perfectly good door. ⛓ Named rather than spread: the world
     * document's link shape is `worldDocument`'s and this must not quietly
     * carry whatever an op grows next.
     */
    const entry = { from: link?.from, to: link?.to, one_way: link?.one_way };
    const probe = Object.freeze({
        ...record,
        world: { ...record.world, links: [...(record.world.links ?? []), entry] },
    });
    try {
        const derived = deriveWorldAtlasOf(probe, { parts, deps });
        return {
            ok: true,
            displaced: derived.displaced ?? [],
            notes: derived.notes ?? [],
        };
    } catch (e) {
        if (!(e instanceof Error)) throw e;
        return { ok: false, why: e.message };
    }
}

/**
 * ⛓⛓⛓ **THE OP THE GESTURE PRODUCES, AND ITS SHAPE COMES FROM THE TWO CELLS'
 * PARTS** (W2 §8.4).
 *
 * ⛔⛔ **A CROSS-PART DOOR IS A DIFFERENT OP SHAPE, NOT A DIFFERENT ARGUMENT.**
 * The OBJECT pair is the world's and names DERIVED ATLAS exit ids; the ARRAY
 * pair is a part's own and names that part's own exits. A gesture that always
 * wrote object endpoints would send a same-part door to `world.links`, where it
 * would be refused by name — and one that always wrote array endpoints would
 * silently address a part-internal `connect` with an exit id belonging to
 * whatever room shared the index.
 *
 * ⛔ **`one_way` IS REQUIRED AND HAS NO DEFAULT HERE.** The two substrates
 * disagree about it (Seedling's derivation writes `one_way: true` on every
 * connection it makes; the maze's `LINK_ONE_WAY_DEFAULT` is `false`), so a
 * crossing between them is in neither convention and a default would impose one
 * substrate's law on a door that is not in it (W2 §8.2). The CONTROL therefore
 * starts unset and this refuses an unset one by name rather than picking.
 *
 * @param {{part, room, exit}} from  the SOURCE endpoint, in GLOBAL room terms
 * @param {{part, room, exit}} to    the TARGET endpoint
 * @param {boolean|null} oneWay
 * @returns {{ok: boolean, why?: string, op?: object, shape?: 'world'|'part'}}
 */
export function worldDoorOp(from, to, oneWay) {
    if (!from || !to) {
        return { ok: false, why: 'a door needs BOTH endpoints — pick a source room and its exit, '
            + 'then a target room and its exit' };
    }
    if (from.part === to.part) {
        return {
            ok: false,
            why: `both endpoints are in part "${from.part}", so this is that part's OWN door and `
                + 'not a crossing. ⛓ Draw it with the strip\'s own CONNECT gesture, which writes '
                + 'the ARRAY form that part\'s `connect` takes — a world link is for a door '
                + 'BETWEEN two documents, and one inside a part would be refused by name.',
            shape: 'part',
        };
    }
    if (oneWay !== true && oneWay !== false) {
        return {
            ok: false,
            why: '⛔ pick ONE-WAY or TWO-WAY first. The two substrates disagree about the '
                + 'default — Seedling\'s derivation writes `one_way: true` on every connection '
                + 'it makes (its one transition primitive is a one-way jump) and the maze\'s '
                + '`LINK_ONE_WAY_DEFAULT` is `false` (a crossing is a tile you walk back off) — '
                + 'so a crossing between them is in NEITHER convention and defaulting would '
                + 'impose one substrate\'s law on a door that is not in it.',
        };
    }
    return {
        ok: true,
        shape: 'world',
        op: {
            op: 'connect',
            from: { part: from.part, room: from.room, exit: from.exit },
            to: { part: to.part, room: to.room, exit: to.exit },
            one_way: oneWay,
        },
    };
}

/** ⛓ …and the symmetric one. ⛔ ONE endpoint: `worldDisconnect` finds the link
 *  from either side and names the crossings there are when none joins it. */
export function worldDoorDisconnectOp(from) {
    if (!from) return { ok: false, why: 'pick the crossing\'s SOURCE endpoint first' };
    return {
        ok: true,
        op: { op: 'disconnect', from: { part: from.part, room: from.room, exit: from.exit } },
    };
}
