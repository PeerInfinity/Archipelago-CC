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
 * `mazeLabView.js`'s SET arm hands the SAME object to the SAME mount. ⚠ That
 * half lands with the MOUNT, one commit on; what is here first is the page's
 * INTAKE — which document a pasted or fetched file IS, and which served packs
 * this arm may offer at all.
 *
 * ── ⛔ NO DOM AND NO NODE IMPORTS ─────────────────────────────────────
 *
 * `mazeLab.js`'s law, for the same reason: this file is unit-tested in node and
 * loaded in a browser, so it may reach for neither side's globals. What needs a
 * `document` (the mount, the LOAD box, the room session's canvas) is
 * `mazeLabView.js`'s.
 *
 * ⚠ `drawRoomStill` (next commit) is the ONE apparent exception, and it is not
 * one: it takes the canvas it is handed and asks it for a 2D context.
 * `mazeRoomRender.drawWorld` reads ZERO `window.`/`document.` (§27.1 #2
 * measured it), so a still is node-drivable against a recording context and IS
 * driven that way.
 */

import { classifyDocument } from '../presets/documentBundle.js';

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
