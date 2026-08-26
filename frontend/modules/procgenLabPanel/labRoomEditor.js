/**
 * procgenLabPanel/labRoomEditor — **THE HOST SIDE OF THE ROOM-EDITOR CONTRACT
 * FOR SUBSTRATES WHOSE EDITOR IS A LAB PAGE.**
 *
 * EDITOR INTEGRATION arc, slice W3 (`NewDocs/plans/editor-integration.md` §3.2,
 * §9). `regionEditors.getRegionEditor(id)` resolves a registry entry whose
 * `roomEditor.kind` is `'lab'` to this module's `openLabRoomEditor`, bound to
 * the entry's own `page` and `arm`. The maze and Seedling substrates therefore
 * get an `Edit ▸`-shaped door with NO second editor written for either: the
 * door is the lab page the arc already built, hosted in `procgenLabPanel`.
 *
 * ── ⛓⛓⛓ THREE MOVES, AND NOT ONE NEW PROTOCOL FIELD ──────────────────
 *
 *   1. **A DOCUMENT IN** — `procgenLab:load` carries the SET document
 *      (`payload` is an OPAQUE object to `assertLoad`), and each page's
 *      `load` SNIFFS it through the ONE classifier it already has, so a region
 *      library / level set / overlay lands on the SET arm's intake instead of
 *      the lab-level box.
 *   2. **ONE ROOM** — `procgenLab:navigate` with the page's own grammar,
 *      `?source=<arm>&room=<n>`. ⛔ The ARM is the registry entry's, not this
 *      file's: the maze's SET arm is `?source=set` and Seedling's edit arm is
 *      `?source=edit`, and a table here naming them would be the second place
 *      those two words live.
 *   3. **THE FOLDED DOCUMENT OUT** — `procgenLab:levelChanged`, whose payload
 *      is a `labRoomEnvelope` while a SET arm holds a session. The page's own
 *      close folds ONE `replace-room` into the record and re-announces.
 *
 * ── ⛔⛔ THE CLOSE IS A **TRANSITION**, NEVER A COUNT ──────────────────
 *
 * `onSave` fires when the envelope's `room` goes `n → null`. ⚠ Trap 599's
 * family: a wait on the number of edits cannot tell one three-cell stroke from
 * three presses, and a close that folded a NO-OP room session would move no
 * count at all — the host would sit forever on a room the reader already shut.
 * The transition is a fact about the page's session, published by the page,
 * and it is the same signal whether the reader made 0 edits or 40.
 *
 * ── ⛓ WHY THE PANEL INSTANCES ARE REGISTERED HERE ────────────────────
 *
 * `ui:activatePanel` matches on `componentType`, and BOTH lab panels are
 * `procgenLabPanel` — measured by `check-procgen-lab-hosting.mjs`, which
 * records that the event *"can only ever raise the first"* and raises the
 * Seedling tab through Golden Layout's own API instead. So a host that needs
 * *the maze one* cannot ask the layout by name; it needs the INSTANCE. The
 * panel registers itself on mount and drops itself on `destroy()` — per mount,
 * because a remounted panel that kept the old mount's entry would hand a
 * caller an iframe that is already `about:blank`.
 *
 * ⛔ THIS MODULE IMPORTS NOTHING FROM A SUBSTRATE. `procgenCore/` is the
 * shared vocabulary (`bindingContract`'s own line); a host that imported
 * `mazeRoom/` or `seedlingDemo/` would be the second place that knows what a
 * maze room is, and its own test asserts the import list.
 */

import eventBus from '../../app/core/eventBus.js';
import { LAB_EVENTS, SUBSTRATES, addressedTo } from '../procgenCore/labProtocol.js';
import { openRoomOf } from '../procgenCore/labRoomEnvelope.js';

const MODULE_ID = 'procgenLabRoomEditor';

/* ══════════════════════════════════════════════════════════════════════
 * THE LIVE PANEL INSTANCES
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ Mounted `ProcgenLabPanelUI`s, newest last. See the docblock for why. */
const instances = new Set();

/** Called by `ProcgenLabPanelUI`'s constructor — ONE entry per MOUNT. */
export function registerLabPanelInstance(panel) {
    instances.add(panel);
}

/** Called by `ProcgenLabPanelUI.destroy()`. Idempotent. */
export function unregisterLabPanelInstance(panel) {
    instances.delete(panel);
}

/** ⛓ Every mounted lab panel, in mount order. */
export function labPanelInstances() {
    return [...instances];
}

/**
 * ⛓ The mounted panel showing `page`'s lab, or `null`. ⚠ `allowMultipleInstances`
 * is true, so a reader may have two maze labs open; the FIRST is taken and the
 * refusal below never fires for that case — which is the honest behaviour, a
 * host cannot know which of two identical panels the reader meant.
 */
export function findLabPanel(page) {
    for (const panel of instances) if (panel?.substrate === page) return panel;
    return null;
}

/** ⛔ TEST-ONLY, and named so — `substrateRegistry.clear()`'s convention. */
export function clearLabPanelInstances() {
    instances.clear();
}

/* ══════════════════════════════════════════════════════════════════════
 * THE DOOR
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ A refusal is a RETURN VALUE, never a throw — see `openLabRoomEditor`. */
const refuse = (why) => ({ ok: false, why, close() {} });

/**
 * Open room `room` of `record` in `page`'s lab, and call `onSave(record)` ONCE
 * when the reader closes it.
 *
 * ⛔ **IT REFUSES, IT DOES NOT THROW AND IT DOES NOT HANG.** Every way this can
 * fail before the page has the document — an unknown page, no panel mounted,
 * a payload the protocol refuses — comes back as `{ok: false, why}` in the same
 * call. The caller (`procgenPipelineUI._editRegion`, a set editor's strip) has
 * a message box and no way to time out an iframe; a promise that never settled
 * would be a room the reader is waiting on with nothing on screen.
 *
 * ⚠ AND THERE IS NO TIMER AFTER THAT. Once the document is in the page, the
 * only thing left is a PERSON editing a room, and a deadline on that would
 * discard their work at whatever number this file guessed.
 *
 * @param {object} opts
 * @param {'maze'|'seedling'} opts.page  which lab page (the registry entry's)
 * @param {string} opts.arm        that page's `?source=` for its SET arm
 * @param {number} opts.room       0-based index into the document's rooms
 * @param {object} opts.record     the SET document to hand in
 * @param {(record:object)=>void} opts.onSave  called ONCE, on the close
 * @param {object} [opts.bus]      the event bus (the app's, by default)
 * @returns {{ok:boolean, why?:string, close:()=>void}}
 */
export function openLabRoomEditor({
    page, arm, room = 0, record, onSave, bus = eventBus,
} = {}) {
    if (!SUBSTRATES.includes(page)) {
        return refuse(`labRoomEditor: page is ${JSON.stringify(page)}, not one of `
            + `[${SUBSTRATES.join(', ')}]. It names the LAB PAGE this substrate's rooms are `
            + 'edited on, and there is no page for anything else.');
    }
    if (typeof arm !== 'string' || arm === '') {
        return refuse(`labRoomEditor: arm is ${JSON.stringify(arm)} — it must be the `
            + `${page} page's own \`?source=\` for the arm that holds a SET document. ⛔ It `
            + 'comes off the registry entry, because this file must not be the second place '
            + 'those words are spelled.');
    }
    if (!Number.isInteger(room) || room < 0) {
        return refuse(`labRoomEditor: room is ${JSON.stringify(room)} — it must be a `
            + 'non-negative integer index into the document\'s rooms.');
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return refuse(`labRoomEditor: record must be the SET document object, got `
            + `${JSON.stringify(record)}. ⛔ A REGION alone is not enough: the lab door hands `
            + 'the page a whole document and asks for room n of it, because that is what its '
            + 'SET arm edits — a caller holding only one region wants the `panel` kind.');
    }
    if (typeof onSave !== 'function') {
        return refuse('labRoomEditor: onSave must be a function — it is the ONLY return '
            + 'path, and an open room whose close reached nobody would lose the edit '
            + 'silently.');
    }

    const panel = findLabPanel(page);
    if (!panel) {
        return refuse(`labRoomEditor: no Procgen Lab panel is mounted for ${JSON.stringify(page)}. `
            + 'Open "Procgen Lab — ' + page + '" first. ⛔ Said rather than opened: this '
            + 'module holds no layout and a host that added a panel behind the reader would '
            + 'be a second thing deciding what is on screen.');
    }

    // ⛓ Best-effort, and the row does not depend on it: a hidden Golden Layout
    //   tab has a ZERO-sized canvas, so an unraised panel is a room nobody can
    //   click. `raise()` goes through GL's own API because `ui:activatePanel`
    //   matches on componentType and both lab panels share one.
    try { panel.raise?.(); } catch { /* the layout may be mid-teardown */ }

    let sent;
    try {
        sent = panel.load(record);
    } catch (e) {
        return refuse(`labRoomEditor: the ${page} lab refused the document — ${e.message}`);
    }
    // ⚠ `false` is NOT a failure: the panel QUEUES a load for a frame that has
    //   not connected and flushes it on `iframe:appReady`. Only a throw is one.
    void sent;

    const search = `?source=${arm}&room=${room}`;

    /**
     * ⛓⛓ THE THREE PHASES, AND EACH ONE IS A FACT THE PAGE PUBLISHED.
     *   'holding'   — waiting for the page to report it is holding a SET document
     *   'open'      — the envelope named OUR room; the reader is editing
     *   'done'      — `onSave` has fired, exactly once
     */
    let phase = 'holding';
    let navigated = false;

    const handler = (data) => {
        if (phase === 'done') return;
        if (!addressedTo(data, panel.iframeId)) return;
        const open = openRoomOf(data?.payload);
        // ⛔ `undefined` = this is the LADDER payload, not a SET envelope. It is
        //   not a state change here: the page is simply not on the SET arm yet.
        if (open === undefined) return;

        if (open === room) {
            phase = 'open';
            return;
        }
        if (phase === 'open' && open === null) {
            phase = 'done';
            off();
            onSave(data.payload.record);
            return;
        }
        // ⛓ The page is holding the document with no room open — ask for ours.
        //   ⚠ ONCE: a navigate per announce would re-open the room the reader
        //   just closed, and the close would never be seen.
        if (!navigated && open === null) {
            navigated = true;
            try {
                panel.navigate(search);
            } catch (e) {
                phase = 'done';
                off();
                // ⛔ REPORTED WHERE THE PANEL REPORTS, not swallowed: a navigate
                //   the page refused leaves a document held and no room open,
                //   and a silent one would look like a reader who never pressed.
                panel._note?.(`labRoomEditor: ${e.message}`, true);
            }
        }
    };

    const off = () => {
        bus.unsubscribe?.(LAB_EVENTS.levelChanged, handler, MODULE_ID);
    };

    bus.subscribe(LAB_EVENTS.levelChanged, handler, MODULE_ID);

    return {
        ok: true,
        /** ⛓ Give up on this room. ⛔ `onSave` never fires after it. */
        close() {
            phase = 'done';
            off();
        },
    };
}

/**
 * ⛓ The shape `regionEditors.js` stores: a `roomEditor` declaration of kind
 * `'lab'` becomes ONE opener bound to that entry's page and arm, so the
 * pipeline's `open({region, contract, onSave})` and a set editor's strip call
 * the same function with the same words.
 */
export function bindLabRoomEditor({ page, arm }) {
    return (session = {}) => openLabRoomEditor({ ...session, page, arm });
}
