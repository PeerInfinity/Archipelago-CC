/**
 * regionEditors — **THE ROOM-EDITOR RESOLVER.** Given a substrate id, hand back
 * the ONE function that opens a room of that substrate for editing, or `null`.
 *
 * ── ⛓⛓⛓ EDITOR INTEGRATION W3 — THE ANSWER IS THE REGISTRY'S NOW ─────
 *
 * This file used to BE the registry: a module-level table that every editor
 * wrote itself into at `initialize()` time. ⚖ the editor-integration plan
 *§3.2 replaced that with a DECLARATION the substrate entry already carries —
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
 * and `open({region, contract, onSave})` — which fits a `panel` door only. A
 * `lab` door refuses a region (it takes a SET document), and that refusal went
 * to nobody until `roomEditorKindOf` let the panel route a lab door through
 * `pipelineRoomEdit.js` (2026-10-18).
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { bindLabRoomEditor, findLabPanel, labPanelInstances } from '../procgenLabPanel/labRoomEditor.js';

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

/**
 * ⛓ WHICH kind of door `getRegionEditor(substrate)` opens — `'panel'`,
 * `'lab'`, or `null` (no declaration, or a runtime override from the
 * deprecated table, which takes the panel contract). A caller needs it because
 * the two kinds take DIFFERENT sessions: a panel takes `{region, contract}`, a
 * lab door takes a SET document (`record`) and refuses a region
 * (`pipelineRoomEdit.js` builds that document for the pipeline).
 */
export function roomEditorKindOf(substrate) {
    if (Object.prototype.hasOwnProperty.call(regionEditors, substrate)) return 'panel';
    const kind = substrateRegistry.get(substrate)?.roomEditor?.kind;
    return Object.prototype.hasOwnProperty.call(ROOM_EDITOR_KINDS, kind) ? kind : null;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ONE OPENER — "open this region's editor" for EVERY caller
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ region-editor-launch, the user 2026-10-19 (Q1): ONE shared mechanism,
 * used by the pipeline's Edit ▸ (sphere, top-down, the map) and the APWorld
 * Editor's. Before it, a door whose panel was not on screen did nothing useful:
 * the lab door SAID "Open Procgen Lab — maze first", and the bounce door's
 * `ui:activatePanel` only RAISES a tab, so a closed bounce editor was a press
 * that did nothing at all.
 *
 * ⛔ THE LAB DOOR STILL OPENS NOTHING (`labRoomEditor.js`'s *"said rather than
 * opened"*). Creating a panel is the CALLER's act — the reader pressed Edit ▸
 * here — so it lives in this resolver, the one place both callers already go
 * through, and the door keeps its contract: it finds a mounted panel or refuses.
 *
 *   `kind: 'lab'`   → a mounted panel for the entry's `page`, else (module
 *                     disabled → `enableModule`) `createPanelInstance(
 *                     'procgenLabPanel', {substrate: page})`, then a bounded wait
 *                     for the instance to register itself.
 *   `kind: 'panel'` → `enableModule(decl.module)`, which creates the panel when
 *                     the layout has none and raises it when it has one. The
 *                     entry's own `open` then hands the session over (bounce's
 *                     pending slot is read by a panel mounted before OR after).
 *
 * A host that cannot be made is a REFUSAL (`{ok:false, why}`), never a throw:
 * both callers already print the door's refusals.
 */
export const LAB_PANEL_MODULE = 'procgenLabPanel';
const HOST_WAIT_MS = 5000;
const HOST_POLL_MS = 50;

const hostRefusal = (why) => ({ ok: false, why, close() {} });

/** ⛓ One in-flight create per lab page: a double press must not open two tabs. */
const creating = new Map();

async function waitFor(fn, { timeoutMs, pollMs, sleep }) {
    const until = Date.now() + timeoutMs;
    for (;;) {
        const v = fn();
        if (v) return v;
        if (Date.now() >= until) return null;
        await sleep(pollMs);
    }
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const defaultApi = () => (typeof window !== 'undefined' ? window.moduleManagerApi ?? null : null);

async function makeLabHost(page, api, timing) {
    const enabled = api.getAllModuleStates?.()?.[LAB_PANEL_MODULE]?.enabled;
    if (enabled === false) {
        // ⚠ Closing the LAST lab tab disables the module, and a disabled module
        //   refuses `createPanelInstance`. Enabling it mounts one lab panel (the
        //   maze, `ProcgenLabPanelUI`'s default) — the one we want, or not.
        //   Wait for THAT mount before deciding, or a slow one would be met by a
        //   second, duplicate tab.
        await api.enableModule?.(LAB_PANEL_MODULE);
        await waitFor(() => labPanelInstances().length > 0, timing);
        const found = findLabPanel(page);
        if (found) return found;
    }
    if (typeof api.createPanelInstance !== 'function') return null;
    await api.createPanelInstance(LAB_PANEL_MODULE, { substrate: page });
    return waitFor(() => findLabPanel(page), timing);
}

/**
 * ⛓ Make sure `substrate`'s editor has a panel on screen. `{ok:true}` or a
 * refusal sentence.
 *
 * @param {string} substrate
 * @param {object} [o] `{api, timeoutMs, pollMs, sleep}` — the module manager
 *   (`window.moduleManagerApi` by default) and the wait, injectable for a row
 */
export async function ensureRoomEditorHost(substrate, {
    api = defaultApi(), timeoutMs = HOST_WAIT_MS, pollMs = HOST_POLL_MS, sleep = defaultSleep,
} = {}) {
    const timing = { timeoutMs, pollMs, sleep };
    const kind = roomEditorKindOf(substrate);
    const decl = substrateRegistry.get(substrate)?.roomEditor;
    if (kind === 'lab') {
        const page = decl.page;
        if (findLabPanel(page)) return { ok: true };
        if (!api) {
            return hostRefusal(`no Procgen Lab panel is open for "${page}", and this page has no module `
                + `manager to open one. Open "Procgen Lab — ${page}" first.`);
        }
        let pending = creating.get(page);
        if (!pending) {
            pending = makeLabHost(page, api, timing).finally(() => creating.delete(page));
            creating.set(page, pending);
        }
        const panel = await pending;
        return panel ? { ok: true, opened: true }
            : hostRefusal(`a Procgen Lab panel for "${page}" was asked for and did not appear within `
                + `${timeoutMs} ms. Open "Procgen Lab — ${page}" from the Modules panel and press Edit ▸ again.`);
    }
    if (kind === 'panel' && typeof decl?.module === 'string' && decl.module !== '') {
        if (typeof api?.enableModule !== 'function') return { ok: true };
        await api.enableModule(decl.module);
        return { ok: true };
    }
    return { ok: true };
}

/**
 * ⛓⛓ **THE CALL BOTH CALLERS MAKE**: the host, then the door. Answers the
 * door's own handle (`{ok, why, close}` for a lab door, nothing for a panel
 * door) or the host's refusal in the same shape.
 */
export async function openRoomEditor(substrate, session, opts = {}) {
    const open = getRegionEditor(substrate);
    if (!open) return hostRefusal(`no region editor for "${substrate}".`);
    const host = await ensureRoomEditorHost(substrate, opts);
    if (!host.ok) return host;
    return open(session);
}

/** ⛔ TEST-ONLY, and named so. */
export function clearRoomEditorHostRequests() {
    creating.clear();
}

export { regionEditors };
