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
import { OVERVIEW } from '../procgenCore/setEditorCore.js';
import { deserializeMazeWorld } from './mazeRoomEngine.js';
import { drawWorld, plainView } from './mazeRoomRender.js';
import {
    LIBRARY_FIELDS, ROOM_FIELDS, closeRoomSession, downloadLibrary,
    exitRuleKey, exitsOfRoom, isMazeSetRefusal, locationRuleKey,
    deriveAtlasOf, readSetCell, rulesJsonOf, validateForDownload, whatLinksHere,
} from './mazeSetAdapter.js';

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
                + 'whose rooms are `entries[]` carrying maze payloads',
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
 * @param {{rulesSchema?: object, drawRoomStill?: Function}} o
 *   `drawRoomStill` — the PAGE's renderer. The node rows hand a RECORDING stub
 *   so the claim is *which room was asked for*, not what it looked like;
 *   `mazeLabView.js` hands `makeDrawRoomStill()`.
 */
export function mazeSetBindings({ rulesSchema = null, drawRoomStill = null } = {}) {
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
        drawRoomStill,
    };
}
