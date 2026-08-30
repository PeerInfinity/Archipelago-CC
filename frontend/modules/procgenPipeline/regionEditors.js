/**
 * regionEditors — **THE ROOM-EDITOR RESOLVER.** Given a substrate id, hand back
 * the ONE function that opens a room of that substrate for editing, or `null`.
 *
 * ── ⛓⛓⛓ EDITOR INTEGRATION W3 — THE ANSWER IS THE REGISTRY'S NOW ─────
 *
 * This file used to BE the registry: a module-level table that every editor
 * wrote itself into at `initialize()` time. ⚖ `NewDocs/plans/editor-integration.md`
 * §3.2 replaced that with a DECLARATION the substrate entry already carries —
 *
 *     entry.roomEditor = { kind: 'panel', open }              // bounce
 *     entry.roomEditor = { kind: 'lab', page, arm }           // maze, Seedling
 *
 * — for the reason the plan's §0.6 gives: *"open room i of document D in
 * substrate S's editor and receive ONE room op back"* is one contract with two
 * spellings, and the second spelling (the set editors' `openRoomAt` → room
 * session → ONE `replace-room`) is on a LAB PAGE that a self-registration in
 * the app could never reach — a page is not a module and never calls
 * `initialize()`.
 *
 * ⛔ **THE DECLARATION IS DATA, NOT A REGISTRATION**, and that is what makes it
 * work for both: `substrateRegistry.register` validates only `id` and
 * `sharing` (measured, `substrateRegistry.js:198-210`), the three libraries
 * that carry it stay node-importable, and a headless caller — the capability
 * matrix, a `check-*.mjs` gate — can ask *"does this substrate have a room
 * editor, and of what kind"* without a browser.
 *
 * ── ⛓ THE FOUR ANSWERS ────────────────────────────────────────────────
 *
 *   `kind: 'panel'` → the entry's own `open`, verbatim.
 *   `kind: 'lab'`   → `labRoomEditor.bindLabRoomEditor` bound to that entry's
 *                     PAGE and ARM.
 *   an unknown kind → `null`, and the reason is CONSOLE-VISIBLE by name (a
 *                     silent `null` here reads exactly like "no editor yet",
 *                     which is a true sentence about the wrong subject).
 *   no declaration  → `null`, exactly as before — the pipeline's *"No region
 *                     editor for X yet"* stays true for runner, jta, omsi and
 *                     text_adventure.
 *
 * ── THE CONTRACT ITSELF ───────────────────────────────────────────────
 *
 *     open({ region | record, base?, contract?, onSave })
 *
 * `onSave(edited)` is the ONLY return path and the CALLER decides what one
 * saved document is: the pipeline splices it back with `grid.replaceRegion` and
 * invalidates its own steps (⛔ still the panel's knowledge — §1's two
 * write-back depths are not the editor's business); a set editor turns it into
 * ONE `replace-room`. `contract` carries what the realiser used (sidePortals,
 * exitSpecs, locationSpecs, physicsProfile, mode, braidWidth, freeArrow, …).
 *
 * ⚠ THE EXPORT NAME DID NOT MOVE. `procgenPipelineUI` calls `getRegionEditor`
 * at four sites (`:3209`, `:3252`, `:5452`, `:5500`) and `open({region,
 * contract, onSave})` at two of them — measured to FIT this contract already,
 * so the panel needed no edit for W3.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { bindLabRoomEditor } from '../procgenLabPanel/labRoomEditor.js';

/**
 * ⛓ THE DEPRECATED OVERRIDE TABLE. `registerRegionEditor` is kept for ONE
 * release so an out-of-tree editor is not broken by this slice; nothing in the
 * repository writes to it any more (bounce's own call at
 * `bounceRegionEditor/index.js:56` was deleted in the same commit, and a row in
 * `regionEditors.test.js` asserts the table is EMPTY).
 *
 * ⚠ IT WINS OVER THE ENTRY, because that is what the word OVERRIDE means: a
 * caller that registered a launcher at runtime meant to replace whatever the
 * registry declares, and a resolver that quietly preferred the declaration
 * would ignore the only reason anyone would still call this.
 */
const regionEditors = {};

/** @deprecated Declare `roomEditor` on the substrate registry entry instead. */
export function registerRegionEditor(substrate, openFn) {
    regionEditors[substrate] = openFn;
}

/** ⛓ The kinds, and what each one resolves to. ⛔ Never a hand list elsewhere. */
export const ROOM_EDITOR_KINDS = Object.freeze({
    panel: (decl, substrate) => {
        if (typeof decl.open !== 'function') {
            return refuse(substrate, `\`roomEditor.kind: 'panel'\` needs an \`open\` function `
                + `and this entry's is ${typeof decl.open}`);
        }
        return decl.open;
    },
    lab: (decl, substrate) => {
        if (typeof decl.page !== 'string' || decl.page === '') {
            return refuse(substrate, '`roomEditor.kind: \'lab\'` needs a `page` — the lab '
                + 'page this substrate\'s rooms are edited on');
        }
        if (typeof decl.arm !== 'string' || decl.arm === '') {
            return refuse(substrate, `\`roomEditor.kind: 'lab'\` needs an \`arm\` — the `
                + `${decl.page} page's own \`?source=\` for the arm that holds a SET document`);
        }
        return bindLabRoomEditor({ page: decl.page, arm: decl.arm });
    },
});

/**
 * ⛔ A MALFORMED DECLARATION IS NAMED, NOT SWALLOWED. `null` is the answer
 * either way — the panel must not crash on a bad entry — but "no editor yet"
 * and "this entry declares one and it is wrong" are different facts, and only
 * one of them is somebody's bug.
 */
function refuse(substrate, why) {
    // eslint-disable-next-line no-console
    console.warn(`regionEditors: substrate "${substrate}" declares a roomEditor this file `
        + `cannot open — ${why}. ⇒ no editor is offered for it.`);
    return null;
}

/**
 * The launcher for `substrate`'s rooms, or `null`.
 *
 * @param {string} substrate a substrate registry id (`region.substrate`)
 * @returns {((session:object)=>any)|null}
 */
export function getRegionEditor(substrate) {
    if (Object.prototype.hasOwnProperty.call(regionEditors, substrate)) {
        return regionEditors[substrate];
    }
    const decl = substrateRegistry.get(substrate)?.roomEditor;
    if (!decl || typeof decl !== 'object') return null;
    const resolve = ROOM_EDITOR_KINDS[decl.kind];
    if (!resolve) {
        return refuse(substrate, `\`roomEditor.kind\` is ${JSON.stringify(decl.kind)}, not one `
            + `of [${Object.keys(ROOM_EDITOR_KINDS).join(', ')}]`);
    }
    return resolve(decl, substrate);
}

export { regionEditors };
