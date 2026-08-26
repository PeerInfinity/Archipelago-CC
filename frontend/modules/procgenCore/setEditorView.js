/**
 * procgenCore/setEditorView — **THE SET EDITOR'S DOM, FOR ANY SET SUBSTRATE.**
 *
 * EDITOR v3 arc, slice E2b (`NewDocs/plans/seedling-editor-v3.md` §27, §28).
 * D2 built this mount inside `seedlingDemo/watchSetEditor.js`; E2a moved the
 * substrate-free CALCULATIONS out into `setEditorCore.js` and measured what was
 * left. The measurement is why this file exists: of the mount's 1,051 lines,
 * about **26 call sites in five spots** knew they were on Seedling — the record
 * shape, the OEL entity list, the two rule-key spellings, the room-session
 * close and the three-blob download. Everything else already read the ADAPTER.
 *
 * ⇒ the mount MOVED (not copied) and each of those sites became a NAMED
 * PARAMETER. `watchSetEditor.js` keeps `mountWatchSetEditor` as the BINDING
 * that hands Seedling's in; `mazeRoom/` will hand the maze's in when
 * `lab.html` grows its SET arm (E2c). ⛔ Writing this a second time on the lab
 * page would have been a 1,000-line copy that drifts from the day it lands —
 * §7/§16.2's one-toolkit law, and the reason E2a's move happened at all.
 *
 * ── ⛓ WHAT A SUBSTRATE HANDS IN, AND WHY EACH ONE IS NOT DERIVABLE ────
 *
 *  · **`adapterFns`** — `readSetCell`, `exitsOfRoom`, `whatLinksHere`,
 *    `bounds`, `validateForDownload`, `deriveAtlasOf`, `rulesJsonOf`,
 *    `closeRoomSession`, `download`. D1's vocabulary plus the two PAGE seams
 *    (a room session closing into the set; one press → N documents).
 *  · **`document`** = `{kind, noun, validator, idOf, docOf}` — what §1 of the
 *    REPORT calls the thing it validated, and which half of the record that
 *    thing IS (`record.set` for Seedling, `record.library` for the maze).
 *  · **`ruleKeys`** = `{exit, location}`, the overlay's own key BUILDERS, so no
 *    `exit:` prefix is ever typed here (E2a's lesson: a literal is green over
 *    Seedling for ever and reports ZERO inert rules for everyone else).
 *  · **`forms`** = `{manifestRows(), roomRows()}` — `SET_FIELDS`/`NAMED_ROOMS`/
 *    `MUSIC_*` on one substrate, `LIBRARY_FIELDS`/`ROOM_FIELDS` on the other.
 *  · **`exits`** = `{valueOf, labelOf, addressOf, targetOptions, disconnectOp}`
 *    — a Seedling exit is addressed by ORDINAL and a maze exit by `exit_id`, so
 *    the `<option>`'s VALUE is built and read back by the same binding.
 *  · **`locations`** = `{options, emptyWhy, targetOf}` — `mark-location` names
 *    an OEL entity at exact pixels on one substrate and an `items[]` ORDINAL on
 *    the other.
 *  · **`drawRoomStill(canvas, cell, index)`** and **`stillKey(cell)`** — ⚖ the
 *    ONE-RENDERER law: the page draws its own substrate and this file blits
 *    what it is handed. The KEY is the substrate's too, because what makes a
 *    room's still stale is what the substrate copies on write.
 *  · **`linkBound(record)`**, **`isRefusal`**, **`rulesSchema`**,
 *    **`addRoomOp(at)`**.
 *
 * ── ⚖ THE LAWS THIS FILE KEEPS ───────────────────────────────────────
 *
 *  · **ONE RENDERER** (above), and **THE PAGE INJECTS** `compileRegionAtlas` /
 *    `validateRegionAtlas`, exactly as the adapters refuse to name a pipeline
 *    dependency of their own.
 *  · **EVERY REFUSAL IS PRINTED VERBATIM.** An adapter sentence names the room,
 *    the ordinal and the list; a paraphrase is where the evidence channel stops
 *    being evidence.
 *  · **`edit*` IDS, ON THE INJECTED `doc`** (§13.4) — `watch.html` carries them
 *    today and `lab.html` will carry the SAME ones (E2c), which is why there is
 *    no id map here to go stale.
 *  · ⛔ **`bindingContract.test.js` IS THE GATE**: nothing under `seedlingDemo/`,
 *    `mazeRoom/` or `flashPanel/` may be imported from this directory.
 */

import {
    OVERVIEW, addRoomMapping, exitArrowShapes, moveOrder, overviewLayout, removeRoomMapping,
    renumberDecision, reorderMapping, reportOver, roomRowsOf as coreRoomRowsOf, ruleTargetsOver,
} from './setEditorCore.js';
import { ruleSchemaErrors } from './jsonSchemaCheck.js';
import { UNDO_COMMAND_ID, mountEditorView } from './editorView.js';
import { createLifetime } from './pageLifetime.js';
import { stringifyRulesJson } from '../shared/rulesJsonBuilder.js';
import {
    BUNDLE_KINDS, DEFAULT_RULES_JSON_INDENT, writeBundle,
} from '../presets/documentBundle.js';

export class SetEditorViewError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SetEditorViewError';
    }
}

const fail = (message) => { throw new SetEditorViewError(message); };

/**
 * ⛓ `reportOver`'s own discipline (`setEditorCore.js:54`): a reader that was
 * not handed in refuses BY NAME rather than becoming `undefined is not a
 * function` three renders later.
 */
const need = (fn, what) => {
    if (typeof fn !== 'function') {
        fail(`setEditorView: this mount needs \`${what}\` injected — the DOM half may not `
            + 'import a substrate binding (`bindingContract.test.js` is the gate), so every '
            + 'reader of a set document is handed in by the adapter that owns it.');
    }
    return fn;
};

/** ⛓ THE ADAPTER SURFACE THIS MOUNT PRESSES, IN ONE PLACE — D1's vocabulary
 *  plus the two page seams (`closeRoomSession`, `download`). */
export const ADAPTER_FNS = Object.freeze([
    'readSetCell', 'exitsOfRoom', 'whatLinksHere', 'bounds', 'validateForDownload',
    'deriveAtlasOf', 'rulesJsonOf', 'closeRoomSession', 'download',
]);

/**
 * ⛓⛓⛓ **EVERY REASON THIS MOUNT NOTIFIES ITS PAGE, IN ONE FROZEN LIST**
 * (EDITOR v3 E3a, §31.1 #1). ⛔ It is EXPORTED because it is a CONTRACT and not
 * a detail: a page that switches on `why` has to be able to ask what the
 * vocabulary is, and a roster that lived only in the call sites would grow a
 * sixth value nobody's handler had heard of.
 *
 * ⛓⛓ **TWO OF THE SIX ARE NOT IN THE PLAN'S FOUR** (§31.1 lists
 * `op · report · close · select`), and both were found by applying the rule
 * rather than by reading it:
 *
 * ⛓ `download` — the SET download press ALREADY called `onSetChange` before
 * this slice while the rules and bundle presses, which write the same class of
 * readout global and the same note, did not. Three presses in one family with
 * two behaviours is the very asymmetry item 1 exists to end.
 *
 * ⛓ `room` — the rooms table's OPEN button runs `selectRoom` · the PAGE's
 * `openRoomAt` · this mount's `render()`, IN THAT ORDER. The page's own render
 * therefore happens BEFORE the mount's, so a readout written from it says
 * *"no room open"* while `#editSetIdentity` beside it already says
 * *"ROOM n open with k edit(s)"* — the same stale-readout shape one control
 * over, and the CLOSE half was the only one that had a notification.
 */
export const SET_CHANGE_WHY = Object.freeze([
    'op', 'report', 'close', 'select', 'room', 'download',
]);

const el = (doc, tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    // ⛔ `textContent`, never `innerHTML` — every sentence here is an adapter's
    // own, about data a person pasted in.
    if (text !== undefined) node.textContent = text;
    return node;
};

/**
 * ⛓⛓⛓ **MOUNT THE SET EDITOR.** One call per LOADED DOCUMENT: the page destroys
 * and remounts when a different one arrives, exactly as `runEditor` does for a
 * room, so nothing here has to unpick a previous set's state.
 *
 * @param {object} o
 * @param {object} o.lifetime  the arm's — every listener rides it
 * @param {object} o.session   the SET session
 * @param {object} o.adapter   the SET adapter
 * @param {object} o.deps      passed OPAQUELY to `deriveAtlasOf` and `reportOver`
 * @param {object} o.adapterFns   `ADAPTER_FNS`, each `need()`-checked by name
 * @param {object} o.document  `{kind, noun, validator, idOf, docOf}`
 * @param {object} o.ruleKeys  `{exit, location}` — the overlay's key BUILDERS
 * @param {object} o.forms     `{manifestRows(), roomRows()}`
 * @param {object} o.exits     `{valueOf, labelOf, addressOf, targetOptions, disconnectOp}`
 * @param {object} o.locations `{options(cell), emptyWhy, targetOf(value)}`
 * @param {Function} o.linkBound  `(record) => {ok, why}` — or `ok` for ever, said
 * @param {Function} o.isRefusal  the substrate's own refusal classes
 * @param {object}  [o.rulesSchema] parsed `rules.schema.json`
 * @param {Function} o.compileRegionAtlas  injected — `procgenPipeline/`
 * @param {Function} o.validateRegionAtlas injected — `procgenPipeline/`
 * @param {object}  [o.atlasSchema]  the fetched `region-atlas.schema.json`
 * @param {Function} [o.drawRoomStill] `(canvas, cell, index) => why|null` — the
 *   PAGE's own renderer. Absent, the overview draws labelled boxes and says so.
 * @param {Function} o.stillKey    `(cell) => any` — the stills cache's key
 * @param {Function} o.sourceKind  `(cell) => string|null` — WHERE the room's
 *   contents live, in the substrate's own vocabulary. The strip's `⛔embed`
 *   badge is the one reader: it draws iff this answers `'embed'`
 * @param {Function} [o.addRoomOp] `(at) => op` — what an ADD ROOM press applies
 * @param {Function} o.say         the status line
 * @param {Function} o.roomSession `() => {room, ops, session}|null`
 * @param {Function} o.openRoomAt  `(index) => boolean`
 * @param {Function} o.discardRoom `() => void`
 * @param {Function} o.download    `(name, text, type) => void`
 * @param {Function} [o.onSetChange] `({why}) => void` — the page re-renders its
 *   own readouts. ⛔ **ONE ORDERING RULE, AND IT IS THE CONTRACT** (EDITOR v3
 *   E3a): this mount's OWN `render()` has already run when it is called, on
 *   every path, so a page may publish what it derives from the MOUNT and not
 *   only what it derives from the SESSION. `why` is one of `SET_CHANGE_WHY`
 * @param {Function} [o.loadZip]   `() => Promise<JSZip>`
 * @param {object}  [o.doc]        the DOM the `edit*` ids live in
 */
export function mountSetEditor({
    lifetime, session, adapter, deps = {}, compileRegionAtlas, validateRegionAtlas,
    atlasSchema = undefined,
    adapterFns = null, document = null, ruleKeys = null, forms = null,
    exits = null, locations = null,
    linkBound = null, isRefusal = null, rulesSchema = null,
    drawRoomStill = null, stillKey = null, sourceKind = null, addRoomOp = null,
    say = () => {}, roomSession = () => null, openRoomAt = () => false,
    discardRoom = () => {}, download = () => {}, onSetChange = null,
    loadZip = null,
    doc = globalThis.document,
} = {}) {
    /**
     * ⛓⛓ **EDITOR v3 E1b — `recordToOel` IS GONE FROM THIS MOUNT.** It was
     * REQUIRED BY NAME until now, for the two places this panel rendered a
     * record: ADD ROOM's blank and CLOSE ROOM's write-back. Both hand a RECORD
     * to the adapter since plan §22.8, and the one render left in the pipeline
     * happens at the chunk boundary (`planLevelSetChunks`). ⚠ A caller still
     * PASSING it is harmless — an unread property of the options object — which
     * is why the page's own call site did not have to move for this.
     */
    for (const [name, v] of [
        ['lifetime', lifetime], ['session', session], ['adapter', adapter],
        ['compileRegionAtlas', compileRegionAtlas],
        ['document', document], ['ruleKeys', ruleKeys], ['forms', forms],
        ['adapterFns', adapterFns], ['exits', exits], ['locations', locations],
    ]) {
        if (!v) fail(`setEditorView: \`${name}\` is required — refused by name.`);
    }
    /**
     * ⛓⛓⛓ **EVERY READER OF A SET DOCUMENT IS HANDED IN, BY NAME** — the
     * discipline `reportOver` already follows (`setEditorCore.js:54`). ⛔ A
     * missing one has to refuse HERE rather than at the first render: a mount
     * that came up and then threw inside `paintStrip` would have already
     * emptied the boxes the page was showing.
     */
    for (const name of ADAPTER_FNS) need(adapterFns[name], `adapterFns.${name}`);
    for (const name of ['exit', 'location']) need(ruleKeys[name], `ruleKeys.${name}`);
    for (const name of ['manifestRows', 'roomRows']) need(forms[name], `forms.${name}`);
    for (const name of ['valueOf', 'labelOf', 'addressOf', 'targetOptions', 'disconnectOp']) {
        need(exits[name], `exits.${name}`);
    }
    for (const name of ['options', 'targetOf']) need(locations[name], `locations.${name}`);
    need(document.idOf, 'document.idOf');
    need(document.docOf, 'document.docOf');
    need(linkBound, 'linkBound');
    need(stillKey, 'stillKey');
    need(sourceKind, 'sourceKind');
    need(isRefusal, 'isRefusal');
    /** ⛓ The document's NOUN, upper-cased once — every sentence below uses it. */
    const NOUN = String(document.noun).toUpperCase();
    /**
     * ⛓⛓ **THE BUNDLE'S FILENAME IS THE PRIMARY DOCUMENT'S OWN ID** — the one
     * member whose `kind` IS this document's kind. ⛔ Derived rather than passed:
     * a second field naming the id would be a second authority for the thing
     * `document.idOf` already answers, and the two would part company the first
     * time a substrate re-stamped one and not the other.
     */
    const bundleId = (out) => document.idOf(
        out.members.find((m) => m.kind === document.kind)?.doc ?? {});
    const $ = (id) => doc.getElementById(id);

    /**
     * ⛓⛓⛓ **THIS MOUNT OWNS ITS OWN LIFETIME, AND THAT IS A DEFECT THIS SLICE
     * FOUND BY DRIVING IT.**
     *
     * ⛔ A new set REMOUNTS this panel — `takeLevelSet` destroys and rebuilds —
     * and every listener registered on the ARM's lifetime survives that, because
     * the arm has not been retired. Measured: after a second LOAD, `#editSetDisconnect`
     * fired on BOTH mounts, the DEAD one applied its op to the OLD session and
     * repainted the OLD `<select>` over the live one, and the rule-target list
     * the page offered was a document nobody was editing. The op that followed
     * was refused BY NAME against an exit the live record does not have — a true
     * sentence about the wrong subject, produced by a listener nobody had
     * detached.
     *
     * ⇒ every listener here rides a lifetime of THIS mount's, retired by
     * `destroy()`; and it is retired with the arm too, so a page teardown takes
     * it even if nobody calls `destroy`.
     */
    const mine = createLifetime('setEditorView');
    lifetime.onRetire(() => mine.retire('the EDIT arm was retired'));

    /**
     * ⛓⛓ **MINIFY, ON THE PAGE** (EDITOR v3 E1c, §25). `rulesJson.indent` is a
     * `settingsManager` scope in the APP; `watch.html` is a standalone lab page
     * with no settingsManager at all, so the control IS the read — and its
     * UNCHECKED state is `DEFAULT_RULES_JSON_INDENT`, the SAME schema default
     * the app resolves. One default, two doors.
     *
     * ⛔ It is a FUNCTION, not a captured number: the box can be ticked between
     * two presses, and a value read at mount would be the state the page opened
     * with rather than the one the reader chose.
     */
    const indentNow = () => ($('editMinify')?.checked ? 0 : DEFAULT_RULES_JSON_INDENT);

    /* ── STATE: exactly three things, and each is one fact ─────────── */

    /** Which room the forms, the rule box and the highlight are about. */
    let selected = 0;
    /**
     * ⛓⛓ THE GESTURE'S PARAMETER — `armedTemplate`'s shape one panel over
     * (§12.2): `editorView`'s `tool` is the ONE armed value, and this is what
     * the `connect` tool is armed WITH. ⛔ Not a second armed state: with the
     * tool disarmed this is meaningless and is cleared.
     */
    let armedExit = null;
    /** The rule targets, derived ONCE per selection change (§20.11 #4). */
    let targets = { exits: [], locations: [], why: null };

    const record = () => session.record();
    /**
     * ⛔⛔ **THE ADAPTER'S OWN `bounds`, NEVER `record().set.rooms.length`.** The
     * strip, the arrows, the REPORT's room count and `editorView`'s addressing
     * must all agree, and one spelling is how that stays true — a maze record
     * has no `set` key at all, so the literal reading is not merely wrong here,
     * it throws.
     */
    const roomCount = () => adapterFns.bounds(record()).w;
    /**
     * ⛓ **THE LINK-SCAN BOUND IS THE SUBSTRATE'S, AND SO IS ITS ABSENCE.**
     * Seedling prices OEL bytes and record entities (§21.4, §24.7); the maze's
     * links are ONE authored list and E2a measured the whole column at 0.363 ms,
     * so its `linkBound` says `ok` for ever and SAYS SO. ⛔ Not defaulted here:
     * what is not bounded has to be named too.
     */
    const bound = () => linkBound(record());
    let rows = [];

    /* ── THE OVERVIEW STRIP ────────────────────────────────────────── */

    const overview = $('editSetOverview');
    /** ⛓ ONE OFFSCREEN CANVAS PER ROOM, cached by the room's own XML — a still
     *  is only redrawn when the room it draws has changed. */
    const stills = new Map();

    const layoutNow = () => overviewLayout(roomCount(),
        overview?.parentNode?.clientWidth ?? OVERVIEW.cellPx * roomCount());

    const paintStrip = () => {
        if (!overview) return;
        const layout = layoutNow();
        overview.width = layout.width;
        overview.height = layout.height;
        overview.style.width = `${layout.width}px`;
        overview.style.height = `${layout.height}px`;
        const ctx = overview.getContext ? overview.getContext('2d') : null;
        if (!ctx) return;
        ctx.clearRect(0, 0, layout.width, layout.height);
        const top = OVERVIEW.roomTop * layout.height;
        const h = layout.height - top;
        for (let i = 0; i < roomCount(); i += 1) {
            const cell = adapterFns.readSetCell(record(), i, 0);
            const x = i * layout.cellPx;
            ctx.save();
            ctx.fillStyle = i === selected ? '#204050' : '#181818';
            ctx.fillRect(x + 1, top + 1, layout.cellPx - 2, h - 2);
            /**
             * ⛓⛓ EDITOR v3 E2b — THE STILL IS DRAWN BY THE PAGE, FROM THE
             * `readCell` DESCRIPTOR, and the CACHE IS KEYED BY THE SUBSTRATE.
             * ⛔ `stillKey` is a parameter because what makes a still stale is
             * what the substrate copies on write: Seedling keys on the room's
             * `source` OBJECT (every op is copy-on-write, so a changed room has
             * a new `source` by construction, and a `record` room has no string
             * to compare); the maze keys on its `payload`. A key this file chose
             * — the index, or a fresh object — would either never invalidate or
             * never hit.
             */
            const key = stillKey(cell);
            let drew = false;
            if (layout.stills && drawRoomStill && key !== null) {
                let still = stills.get(i);
                if (!still || still.key !== key) {
                    const c = doc.createElement('canvas');
                    let why = null;
                    try {
                        why = drawRoomStill(c, cell, i);
                    } catch (e) {
                        if (!(e instanceof Error)) throw e;
                        why = e.message;
                    }
                    still = { key, canvas: why ? null : c, why };
                    stills.set(i, still);
                }
                if (still.canvas && still.canvas.width > 0) {
                    ctx.drawImage(still.canvas, x + 2, top + 2,
                        layout.cellPx - 4, h - 4);
                    drew = true;
                }
            }
            ctx.strokeStyle = i === selected ? '#7fe0ff' : '#555';
            ctx.lineWidth = i === selected ? 2 : 1;
            ctx.strokeRect(x + 1, top + 1, layout.cellPx - 2, h - 2);
            ctx.fillStyle = drew ? '#ffd75f' : '#bbb';
            ctx.font = '10px monospace';
            ctx.fillText(`L${i}`, x + 4, top + 12);
            /**
             * ⛓⛓⛓ **THE BADGE IS KEYED ON THE CELL, AND THE VOCABULARY IS THE
             * SUBSTRATE'S** (EDITOR v3 E3a, §31.1 #3; trap 722).
             *
             * ⛔ This read `typeof xml !== 'string'` and `xml` had been an
             * UNDECLARED free variable since E1b replaced the room's `xml` with
             * its `source`. `typeof <undeclared>` is `'undefined'` and never
             * throws, so the test was TRUE on every pass and EVERY room in the
             * strip carried `⛔embed` — all 116 vanilla rooms (which ARE embeds,
             * so nobody could see it there) and all four maze rooms, which have
             * no embeds at all. E2b carried it as a named `const` with a row so
             * that the fix could not be silent; this is the fix, and the row is
             * flipped rather than deleted.
             *
             * ⛔ `sourceKind` is a PARAMETER because *"where does this room's
             * contents live"* is a question only the substrate can answer:
             * Seedling's is `record | xml | embed` off `room.source`, and a maze
             * library entry carries its world INLINE, so its answer is a
             * constant.
             */
            if (sourceKind(cell) === 'embed') ctx.fillText('⛔embed', x + 4, top + 24);
            ctx.restore();
        }
    };

    /* ── THE VIEW ON THE STRIP — polylines, and the two-click gesture ─ */

    /**
     * ⛔ **PIXELS → ROOM, IN THE ADAPTER'S OWN COORDINATES.** `bounds` is
     * `{w: rooms.length, h: 1}`, so the answer is `{tx: room, ty: 0}` and a
     * click below the arrow band is still that room — the band is drawing space,
     * not a second row.
     */
    const cellAt = (ev) => {
        const rect = overview.getBoundingClientRect();
        const n = roomCount();
        if (!(rect.width > 0) || n === 0) return null;
        const tx = Math.floor(((ev.clientX - rect.left) / rect.width) * n);
        return tx >= 0 && tx < n ? { tx, ty: 0 } : null;
    };

    /**
     * ⛓⛓ **THE RETURN DOOR IS AN ORDINAL, NOT A ROOM'S EXIT** — and that is
     * forced by the gesture: `connect` lands on the DESTINATION's return door
     * (D1 §20.4), and which room is the destination is not known until the
     * second click happens. ⛔ The range is DERIVED from the widest room in the
     * set, and a target that has no such exit is refused BY NAME by the adapter
     * with its real count in the sentence — one authority, not two.
     */
    const fillOrdinalSelect = () => {
        const sel = $('editSetTargetExit');
        if (!sel) return;
        const keep = sel.value;
        const most = rows.reduce((n, r) => Math.max(n, r.exitList.length), 0);
        const options = exits.targetOptions(rows);
        sel.innerHTML = '';
        for (const opt of options) {
            const o = el(doc, 'option', null, opt.label);
            o.value = opt.value;
            sel.appendChild(o);
        }
        if (keep !== '' && options.some((o) => o.value === keep)) sel.value = keep;
        sel.disabled = most === 0;
    };

    /**
     * ⛓⛓ **WHICH ROOM THE EXIT LIST WAS LAST FILLED FOR** — the one piece of
     * state preserving its value needs, and the reason it is not simply
     * `fillOrdinalSelect`'s three lines copied over. That list is the SET's
     * distinct target ordinals and does not depend on the selection; THIS one is
     * *"the SELECTED room's exits"*, so a value carried across a room change
     * would be an exit id belonging to a different room.
     */
    let exitListRoom = null;

    /**
     * ⛓⛓⛓ **AND IT KEEPS ITS VALUE ACROSS A RENDER** (EDITOR v3 E3a, §31.1 #4).
     *
     * ⛔ D2's asymmetry, found by E2c's browser row and named in §30.12 #1:
     * `fillOrdinalSelect` preserved and this did not, so a value set before the
     * first click of the CONNECT gesture was gone by the second. The panel's own
     * flow hid it — the list IS the selected room's exits and the first click is
     * what selects the room — but the gesture row had to pick the exit BETWEEN
     * the two clicks to work at all, and nothing declared why.
     *
     * ⛔ **A VANISHED SELECTION FALLS BACK AND SAYS SO.** A `disconnect` or a
     * renumbering can delete the very exit a person had chosen; falling back to
     * the first option silently would leave the next press addressing a door
     * nobody picked. ⚠ Said through `say`, never `setNote`: the note is where
     * the op that removed it is explaining itself, and overwriting that with a
     * consequence of it would be the panel talking over its own account.
     */
    const fillExitSelect = (id, room) => {
        const sel = $(id);
        if (!sel) return;
        const keep = exitListRoom === room ? sel.value : '';
        sel.innerHTML = '';
        const list = rows[room]?.exitList ?? [];
        for (const ex of list) {
            const o = el(doc, 'option', null, exits.labelOf(ex));
            o.value = exits.valueOf(ex);
            sel.appendChild(o);
        }
        sel.disabled = list.length === 0;
        const values = list.map((ex) => String(exits.valueOf(ex)));
        if (keep !== '' && values.includes(keep)) sel.value = keep;
        else if (keep !== '') {
            say(`the exit ${keep} you had picked is no longer on room ${room} — the list `
                + `fell back to ${values.length ? values[0] : 'EMPTY (this room has no exits)'}`,
            true);
        }
        exitListRoom = room;
    };

    /**
     * ⛓⛓ **THE ROOM'S OWN ENTITIES, FOR `mark-location`.** ⛔ Read out of the
     * room's OEL through the injected parser — `mark-location` refuses an
     * entity the room does not hold AT EXACTLY THOSE PIXELS, so a list built
     * from anything else would offer choices the op rejects.
     */
    const fillEntitySelect = (room) => {
        const sel = $('editSetLocEntity');
        if (!sel) return;
        sel.innerHTML = '';
        const options = locations.options(adapterFns.readSetCell(record(), room, 0));
        for (const opt of options) {
            const o = el(doc, 'option', null, opt.label);
            o.value = opt.value;
            sel.appendChild(o);
        }
        sel.disabled = options.length === 0;
    };

    /**
     * ⛓⛓⛓ **THE TWO-CLICK EXIT GESTURE.** Click the SOURCE room, then the
     * TARGET room, and ONE `connect` lands. ⛔ `armed` is still `editorView`'s
     * single `tool`; `armedExit` is this gesture's PARAMETER, exactly as the
     * GENERATE arm's `armedTemplate` is AT…'s (§12.2, and the reason a page tool
     * exists at all).
     */
    const connectAt = (cell) => {
        if (armedExit === null) {
            selectRoom(cell.tx);
            armedExit = { room: cell.tx };
            say(`CONNECT — source is room ${cell.tx}; pick WHICH exit in the list, then click `
                + 'the TARGET room (its RETURN DOOR is the ordinal beside the list). '
                + '⚠ Escape disarms.');
            render();
            return;
        }
        /**
         * ⛓⛓ **AN ENDPOINT IS WHAT THE SUBSTRATE SAYS IT IS.** Seedling
         * addresses an exit by its ORDINAL in the room's list; a maze exit is
         * not positional and is addressed by `exit_id` (E2a's `connect`/
         * `disconnect`). ⛔ So the `<option>`'s VALUE is built by the binding
         * and read back by the binding, and this line never converts it.
         */
        applySet({
            op: 'connect',
            from: [armedExit.room, exits.addressOf($('editSetExitList')?.value ?? 0)],
            to: [cell.tx, exits.addressOf($('editSetTargetExit')?.value ?? 0)],
            one_way: Boolean($('editSetOneWay')?.checked),
        });
        armedExit = null;
        view.setTool(null);
    };

    const view = mountEditorView({
        canvas: overview,
        /**
         * ⛓⛓ **THE `doc` IS THREADED THROUGH, AND UNTIL EDITOR v3 E2b IT WAS
         * NOT.** `mountEditorView` defaults its own `doc` to
         * `globalThis.document` and CREATES the selection overlay with it, so on
         * the page the two were the same object and nothing could tell. ⛔ A
         * mount handed a different `doc` — which is the only way this function
         * is drivable under `environment: 'node'` — built its overlay in a
         * document nobody was looking at, or refused by name when there was no
         * `globalThis.document` at all. Byte-inert on the page BY CONSTRUCTION
         * (the same object), and it is what makes `setEditorView.test.js` a
         * measurement rather than a browser-only hope.
         */
        doc,
        session,
        adapter,
        cellAt,
        /**
         * ⛔ A SET HAS NO BRUSH, AND THAT IS THE **THIRD ANSWER** rather than
         * `null`. "No brush is armed" would send the reader to a palette that
         * does not exist; this says what the strip is for.
         */
        brushOp: () => ({
            refused: `a ROOM is not painted — the strip edits the ${NOUN}. Use OPEN to edit a `
                + 'room\'s contents, CONNECT to join two rooms, or the rooms list to add, '
                + 'remove and reorder them.',
        }),
        floodTarget: () => null,
        pasteOptions: () => ({}),
        tools: [{ id: 'connect', label: 'CONNECT two rooms', key: 'c', at: connectAt }],
        shapes: () => exitArrowShapes(rows, { selected }),
        commands: [{
            id: UNDO_COMMAND_ID,
            label: 'UNDO the last SET edit',
            run: () => {
                const n = session.ops().length;
                if (!session.undo()) { say('the SET session has nothing to undo', true); return; }
                stills.clear();
                say(`UNDO — ${n - 1} SET edit(s) remain`);
                render();
                onSetChange?.({ why: 'op' });
            },
        }],
        /**
         * ⛓⛓⛓ **WHICH SESSION `Ctrl+Z` HITS IS THE DOM'S OWN FOCUS.** This view
         * binds its keys to the OVERVIEW CANVAS; the room editor's view binds
         * its own to the document. ⛔ Without the stopper registered below, a
         * key pressed on the strip would BUBBLE to the document and BOTH undo
         * rows would run on one press — two sessions answering one gesture, and
         * the reader could not tell which.
         */
        keyTarget: overview,
        say,
        offRoom: () => 'that point is past the last room of the strip',
        onChange: ({ result }) => {
            if (result?.applied) {
                stills.clear();
                /**
                 * ⛓⛓ **THE RULE TARGETS ARE RE-DERIVED ON EVERY APPLIED OP, and
                 * that is still §20.11 #4's bound.** The rule was *"once per
                 * SELECTION change, never per keystroke"*, and an op is neither:
                 * a `disconnect` DELETES a door, so a target list that only
                 * refreshed on selection would offer an exit id the derivation
                 * no longer has — and the commit would be refused for a list the
                 * page itself had gone stale on. Measured: it was.
                 */
            }
            render();
            /**
             * ⛓⛓⛓ **AFTER `render()`, NOT BEFORE — EDITOR v3 E3a, §31.1 #1.**
             * ⛔ It used to fire INSIDE the `applied` branch above, i.e. while
             * this mount's `rows`, its rooms table, its note and its identity
             * line were still the PREVIOUS op's. MEASURED on the two-click
             * CONNECT (§30.8): a page's `set.links` read **1** off the SESSION
             * while anything it read off the MOUNT read `linkedFrom: [0,0,0,0]`,
             * one op behind — so `mazeLabView` published no `strip`, `note` or
             * `identity` at all rather than publish a lie. This line is why it
             * can publish them again.
             */
            if (result?.applied) onSetChange?.({ why: 'op' });
        },
        lifetime: mine,
    });

    // ⛓ See `keyTarget` above — the strip owns its keys.
    mine.on(overview, 'keydown', (e) => e.stopPropagation());

    /* ── THE ONE OP PATH ───────────────────────────────────────────── */

    /**
     * ⛓⛓⛓ **EVERY OP THIS PANEL BUILDS GOES THROUGH `view.apply`** — the one
     * place a set op reaches the session, so the sentence, the repaint and the
     * host notification happen once per press (C2's `apply` door, used exactly
     * as the room-flags form uses it).
     *
     * ⛓ AND A RENUMBERING OP CARRIES ITS DECISION ABOUT THE OPEN ROOM SESSION
     * (§20.11 #2) — computed BEFORE, acted on only if the op actually landed.
     */
    const applySet = (op, { renumber = null, what = null } = {}) => {
        const decision = renumber
            ? renumberDecision(roomSession(), renumber, what ?? op.op)
            : null;
        let res;
        try {
            res = view.apply(op);
        } catch (e) {
            /**
             * ⛔⛔ **A DERIVATION FAILURE IS NOT A REFUSAL CLASS, AND IT REACHED
             * THE PAGE AS AN UNCAUGHT THROW.** Measured by this slice's own
             * driving: `set-access-rule` builds the atlas to check its target,
             * and `deriveAtlas` throws a PLAIN `Error` — which
             * `seedlingSetAdapter.apply` deliberately does NOT catch (*"a
             * TypeError here is a defect"*, D1) and `editorView.applyOp` does
             * not either (it catches `EditCoreError`). So a set whose atlas
             * cannot derive — e.g. one where a `disconnect` deleted the very
             * `<teleporter>` a marked LOCATION sits on — took the arm down.
             *
             * ⛓ CAUGHT HERE, WHERE THE PAGE IS: reported as a refusal with the
             * producer's own sentence, so the reader gets the finding instead of
             * a dead panel. ⚠ The gap itself is D1's and is NAMED rather than
             * changed (§21's out-of-scope list).
             */
            if (!(e instanceof Error)) throw e;
            say(`the op was REFUSED by the DERIVATION — ${e.message}`, true);
            setNote(`⛔ ${op.op} could not be applied: ${e.message}`, true);
            // ⛓ EDITOR v3 E6a — the SYNTHESISED refusal carries a `reason` too,
            //   and it is the thrown error's own class name. A caller branching
            //   on `res.reason` must not have to tell "the session refused" from
            //   "the derivation threw and the page caught it".
            return { ok: false, applied: false, description: e.message, reason: e?.name };
        }
        if (res.ok && res.applied && decision) {
            if (decision.action === 'discard') discardRoom();
            else if (decision.action === 'reopen' && decision.room !== roomSession()?.room) {
                discardRoom();
                openRoomAt(decision.room);
            }
            if (decision.warning) setNote(decision.warning, decision.action === 'discard');
            /**
             * ⛔ **AND THE READOUT IS REDRAWN AFTER THE DECISION, NOT ONLY
             * BEFORE IT.** `view.apply` fires `onChange` INSIDE the op, which is
             * before the room session is discarded — so a page that rendered
             * only there would still be reporting the discarded room as open.
             * C2 met the same shape from the other side ("a page's readout only
             * learns what its `render` writes").
             *
             * ⛓⛓ **AND THE MOUNT RENDERS AGAIN FIRST** (EDITOR v3 E3a). The
             * `render()` inside `onChange` above ran BEFORE the decision, so at
             * this point `#editRoomClose`'s disabled state and the identity
             * line's `ROOM n open with k edit(s)` are still describing a room
             * session this decision has just discarded. ⛔ The ordering rule is
             * not *"a render happened at some point"*, it is *"the mount is
             * current when the page is told"*.
             */
            render();
            onSetChange?.({ why: 'op' });
        }
        return res;
    };

    const setNote = (text, bad = false) => {
        const n = $('editSetNote');
        if (!n) return;
        n.textContent = text;
        n.className = bad ? 'note bad' : 'note';
    };

    /* ── SELECTION ─────────────────────────────────────────────────── */

    function selectRoom(index) {
        if (!Number.isInteger(index) || index < 0 || index >= roomCount()) return;
        /**
         * ⛓⛓ **THE `select` NOTIFICATION IS GUARDED ON AN ACTUAL MOVE**
         * (EDITOR v3 E3a, §31.1 #1). A page DOES read this — `mazeLabView`
         * publishes `window.__mazeLab.set.selected` off `setUi.selected`, and
         * before this it went stale on every strip click that only selected.
         * ⛔ Guarded rather than unconditional for TWO measured reasons: a
         * re-click on the room already selected changes nothing a page could
         * publish, and the mount's own `selectRoom(0)` at the end of mount
         * would otherwise fire `onSetChange` INTO A PAGE WHOSE `setUi` HAS NOT
         * BEEN ASSIGNED YET — the mount-time call that hits the TDZ.
         */
        const moved = selected !== index;
        selected = index;
        const sel = $('editSetRoom');
        if (sel) sel.value = String(index);
        render();
        if (moved) onSetChange?.({ why: 'select' });
    }

    /* ── THE ROOMS LIST ────────────────────────────────────────────── */

    const renderRooms = () => {
        const box = $('editSetRooms');
        if (!box) return;
        box.innerHTML = '';
        const scan = bound();
        const table = el(doc, 'table', 'setRooms');
        const head = el(doc, 'tr');
        for (const h of ['#', 'name', 'music', 'exits', 'links here', 'loc', 'rules', '']) {
            head.appendChild(el(doc, 'th', null, h));
        }
        table.appendChild(head);
        for (const row of rows) {
            const tr = el(doc, 'tr', row.index === selected ? 'sel' : null);
            tr.appendChild(el(doc, 'td', null, String(row.index)));
            tr.appendChild(el(doc, 'td', null, row.name || '(unnamed)'));
            tr.appendChild(el(doc, 'td', null, String(row.music ?? '·')));
            tr.appendChild(el(doc, 'td', null, row.exits === null ? '⛔' : String(row.exits)));
            tr.appendChild(el(doc, 'td', null,
                row.linkedFrom === null ? '(bounded)' : String(row.linkedFrom)));
            tr.appendChild(el(doc, 'td', null, String(row.locations)));
            tr.appendChild(el(doc, 'td', null, String(row.rules)));
            const acts = el(doc, 'td');
            const button = (id, label, run, disabled = false) => {
                const b = el(doc, 'button', null, label);
                b.id = `${id}_${row.index}`;
                b.disabled = disabled;
                mine.on(b, 'click', run);
                acts.appendChild(b);
            };
            button('editSetRowOpen', 'OPEN', () => {
                selectRoom(row.index);
                openRoomAt(row.index);
                render();
                /**
                 * ⛓⛓ **EDITOR v3 E3a — AND THE PAGE IS TOLD AFTER THE MOUNT
                 * RENDERS.** `openRoomAt` is the PAGE's and it re-renders the
                 * page itself, so without this the identity line and
                 * `#editRoomClose` a readout published were the ones from
                 * BEFORE the room opened. ⛔ CLOSE has always had its
                 * notification; OPEN never did.
                 */
                onSetChange?.({ why: 'room' });
            }, !row.openable);
            button('editSetRowUp', '▲', () => {
                const order = moveOrder(roomCount(), row.index, -1);
                applySet({ op: 'reorder', order },
                    { renumber: reorderMapping(order), what: 'MOVE UP' });
            }, row.index === 0);
            button('editSetRowDown', '▼', () => {
                const order = moveOrder(roomCount(), row.index, 1);
                applySet({ op: 'reorder', order },
                    { renumber: reorderMapping(order), what: 'MOVE DOWN' });
            }, row.index === roomCount() - 1);
            button('editSetRowRemove', 'REMOVE', () => {
                applySet({ op: 'remove-room', room: row.index },
                    { renumber: removeRoomMapping(row.index), what: 'REMOVE' });
            });
            tr.appendChild(acts);
            mine.on(tr, 'click', () => { selectRoom(row.index); render(); });
            if (row.why) {
                const note = el(doc, 'tr');
                const td = el(doc, 'td', 'note bad', row.why);
                td.colSpan = 8;
                note.appendChild(td);
                table.appendChild(tr);
                table.appendChild(note);
                continue;
            }
            table.appendChild(tr);
        }
        box.appendChild(table);
        if (!scan.ok) box.appendChild(el(doc, 'div', 'note bad', scan.why));
    };

    /* ── THE FORMS ─────────────────────────────────────────────────── */

    /**
     * ⛓⛓ **THE FORMS ARE THE SUBSTRATE'S SHAPE, DERIVED ONCE.** Seedling's rows
     * come from `SET_FIELDS`/`NAMED_ROOMS`/`MUSIC_*` and the maze's from
     * `LIBRARY_FIELDS`/`ROOM_FIELDS` — and MEASURED (§28): neither reads the
     * RECORD, so neither takes one and both are derived at mount exactly as
     * D2 derived them.
     */
    const manifestRows = forms.manifestRows();
    const roomRows = forms.roomRows();

    const renderManifest = () => {
        const box = $('editSetManifest');
        if (!box) return;
        const set = document.docOf(record());
        box.innerHTML = '';
        for (const row of manifestRows) {
            const line = el(doc, 'div', 'line');
            line.appendChild(el(doc, 'label', null, row.label));
            if (row.control === 'text') {
                const input = el(doc, 'input');
                input.id = `editSetField_${row.field}`;
                input.value = set[row.field] ?? '';
                mine.on(input, 'change', () => applySet({
                    op: 'set-field', path: row.field, value: input.value,
                }));
                line.appendChild(input);
            } else if (row.control === 'spawn') {
                const cur = set[row.field] ?? {};
                for (const part of ['level', 'x', 'y']) {
                    const input = el(doc, 'input');
                    input.id = `editSetStart_${part}`;
                    input.type = 'number';
                    input.value = cur[part] === undefined ? '' : String(cur[part]);
                    input.style.width = '5em';
                    line.appendChild(el(doc, 'span', 'note', ` ${part} `));
                    mine.on(input, 'change', () => {
                        const next = { level: Number($('editSetStart_level').value) };
                        for (const p of ['x', 'y']) {
                            const raw = $(`editSetStart_${p}`).value;
                            // ⛓ EMPTY MEANS OMITTED — the schema says an absent
                            // x/y is the Game constructor's own default (80, 128),
                            // so writing one would be inventing a spawn.
                            if (raw !== '') next[p] = Number(raw);
                        }
                        applySet({ op: 'set-field', path: row.field, value: next });
                    });
                    line.appendChild(input);
                }
            } else if (row.control === 'roomlist') {
                const input = el(doc, 'input');
                input.id = `editSetField_${row.field}`;
                input.value = (set[row.field] ?? []).join(', ');
                input.style.width = '20em';
                mine.on(input, 'change', () => applySet({
                    op: 'set-field',
                    path: row.field,
                    value: input.value.split(',').map((v) => v.trim()).filter((v) => v !== '')
                        .map((v) => Number(v)),
                }));
                line.appendChild(input);
                line.appendChild(el(doc, 'span', 'note',
                    ` ⚠ minItems ${row.minItems}: the title screen advances `
                    + '`menuIndex % menuLevels.length`, so an empty list makes that index NaN'));
            } else {
                const cur = set[row.field] ?? {};
                for (const key of row.keys) {
                    const sub = el(doc, 'div', 'line');
                    sub.appendChild(el(doc, 'span', 'note', `${key.key} (${key.cite})`));
                    const input = el(doc, 'input');
                    input.id = `editSetNamed_${key.key}`;
                    input.type = 'number';
                    input.style.width = '5em';
                    const v = cur[key.key];
                    input.value = v === undefined ? ''
                        : String(typeof v === 'object' ? v.level : v);
                    mine.on(input, 'change', () => {
                        const next = { ...cur };
                        if (input.value === '') delete next[key.key];
                        else if (key.position) {
                            next[key.key] = {
                                ...(typeof cur[key.key] === 'object' ? cur[key.key] : {}),
                                level: Number(input.value),
                            };
                        } else next[key.key] = { level: Number(input.value) };
                        applySet({ op: 'set-field', path: row.field, value: next });
                    });
                    sub.appendChild(input);
                    line.appendChild(sub);
                }
            }
            box.appendChild(line);
        }
    };

    const renderRoomForm = () => {
        const box = $('editSetRoomForm');
        if (!box) return;
        box.innerHTML = '';
        const cell = adapterFns.readSetCell(record(), selected, 0);
        box.appendChild(el(doc, 'div', 'note', `room ${selected}`));
        for (const row of roomRows) {
            const line = el(doc, 'div', 'line');
            line.appendChild(el(doc, 'label', null, row.label));
            const input = el(doc, 'input');
            input.id = `editSetRoomField_${row.field}`;
            if (row.control === 'checkbox') {
                input.type = 'checkbox';
                input.checked = Boolean(cell.room[row.field]);
            } else if (row.control === 'number') {
                input.type = 'number';
                input.min = String(row.min);
                input.max = String(row.max);
                input.value = String(cell.room[row.field] ?? row.min);
            } else {
                input.value = cell.room[row.field] ?? '';
            }
            mine.on(input, 'change', () => applySet({
                op: 'set-room-field',
                room: selected,
                field: row.field,
                value: row.control === 'checkbox' ? input.checked
                    : (row.control === 'number' ? Number(input.value) : input.value),
            }));
            line.appendChild(input);
            box.appendChild(line);
        }
    };

    /* ── RULE AUTHORING ────────────────────────────────────────────── */

    const renderRuleTargets = () => {
        const sel = $('editSetRuleTarget');
        if (!sel) return;
        sel.innerHTML = '';
        /**
         * ⛔ **AN ENDPOINT THAT GATES NOTHING IS MARKED, NOT HIDDEN.** ⛓ The
         * justification moved at E3b and the docblock did not (§33.12 #3b,
         * fixed E6a): it used to read *"the op accepts it, so hiding it would
         * be a second authority"*, and the op has REFUSED it by name since E3b
         * (`seedlingSetAdapter`'s `gateabilityOf`). The DECISION is unchanged
         * and the reason is a different one — MARKING rather than hiding keeps
         * the derivation's own sentence in front of the author, so a person
         * meeting an inert endpoint learns that it exists and why it gates
         * nothing instead of meeting a list it is silently missing from. The
         * option says which it is, in the derivation's own words.
         */
        for (const e of targets.exits) {
            const o = el(doc, 'option', null,
                `${ruleKeys.exit(e.id)}${e.gates ? '' : ' ⚠ gates NOTHING'}`);
            o.value = ruleKeys.exit(e.id);
            o.title = e.why ?? '';
            sel.appendChild(o);
        }
        for (const name of targets.locations) {
            const o = el(doc, 'option', null, ruleKeys.location(name));
            o.value = ruleKeys.location(name);
            sel.appendChild(o);
        }
        sel.disabled = sel.options.length === 0;
        const note = $('editSetRuleNote');
        if (note) {
            const inert = targets.exits.filter((e) => !e.gates);
            note.textContent = targets.why
                ?? `${targets.exits.length} exit target(s) and ${targets.locations.length} `
                + 'location target(s) for this room — DERIVED once per selection, never per '
                + `keystroke (building the atlas is what an exit id costs).${inert.length
                    ? ` ⚠ ${inert.length} of the exits GATE NOTHING: ${inert[0].why}`
                    : ''}`;
            note.className = targets.why ? 'note bad' : 'note';
        }
    };

    const checkRuleJson = () => {
        const box = $('editSetRuleJson');
        const out = $('editSetRuleErrors');
        if (!box || !out) return null;
        let tree = null;
        try {
            tree = JSON.parse(box.value);
        } catch (e) {
            out.textContent = `⛔ not JSON — ${e.message}`;
            out.className = 'note bad';
            return null;
        }
        const errs = rulesSchema ? ruleSchemaErrors(tree, rulesSchema) : [];
        out.textContent = errs.length === 0
            ? (rulesSchema ? '⛓ the rule validates against `rules.schema.json`'
                : '⚠ no rules schema was fetched, so only the SHAPE is checked at commit')
            : `⛔ ${errs.join(' | ')}`;
        out.className = errs.length === 0 ? 'note' : 'note bad';
        return errs.length === 0 ? tree : null;
    };

    /* ── THE REPORT ────────────────────────────────────────────────── */

    let lastReport = null;

    const runReport = () => {
        const box = $('editSetReportOut');
        lastReport = reportOver({
            session,
            deps,
            adapterFns,
            document,
            ruleKeys,
            compileRegionAtlas,
            validateRegionAtlas,
            atlasSchema,
        });
        if (box) {
            box.innerHTML = '';
            const list = el(doc, 'ul', 'setReport');
            for (const row of lastReport.rows) {
                const li = el(doc, 'li', row.severity === 'error' ? 'bad' : null,
                    `[${row.kind}] ${row.text}`);
                list.appendChild(li);
            }
            box.appendChild(list);
        }
        const btn = $('editDownloadRules');
        if (btn) {
            btn.disabled = !lastReport.download.rules.allowed;
            btn.title = lastReport.download.rules.why ?? 'write rules.json';
        }
        const why = $('editSetReportNote');
        if (why) {
            why.textContent = lastReport.download.rules.why
                ?? '⛓ the graph closes and the set validates — rules.json may be exported.';
            why.className = lastReport.download.rules.allowed ? 'note' : 'note bad';
        }
        return lastReport;
    };

    /* ── THE IDENTITY LINE ─────────────────────────────────────────── */

    const renderIdentity = () => {
        const line = $('editSetIdentity');
        if (!line) return;
        const open = roomSession();
        const focusInSet = doc.activeElement === overview;
        line.textContent = `${NOUN} ${document.idOf(document.docOf(record())) ?? '(unstamped)'}`
            + ` · overlay ${record().overlay.overlay_id ?? '(unstamped)'} · ${view.describe()}`
            + (open ? ` · ROOM ${open.room} open with ${open.ops} edit(s)` : ' · no room open')
            + ` · ⌨ Ctrl+Z here hits the ${focusInSet ? NOUN : 'ROOM'} session `
            + `(the strip owns its keys; focus it to undo the ${NOUN})`;
    };

    /* ── RENDER ────────────────────────────────────────────────────── */

    /**
     * ⛓⛓⛓ **ONE RENDER, AND THE DERIVATION HAPPENS IN IT — ONCE.**
     *
     * ⛔ §20.11 #4's bound is *"once per SELECTION change, never per
     * keystroke"*, and this is the honest reading of it: the rule targets are a
     * function of (the record, the selected room), so they are re-derived
     * exactly when one of those two can have moved — an applied op, an UNDO, or
     * a selection. ⚠ MEASURED, TWICE: a list refreshed only on selection went
     * stale behind a `disconnect`, and a list refreshed only on `onChange` went
     * stale behind an UNDO, and both times the COMMIT was refused for a list the
     * page itself had let rot. Typing in the rule box derives nothing.
     */
    function render() {
        const scan = bound();
        rows = coreRoomRowsOf(record(), {
            links: scan.ok,
            readSetCell: adapterFns.readSetCell,
            exitsOfRoom: adapterFns.exitsOfRoom,
            whatLinksHere: adapterFns.whatLinksHere,
            bounds: adapterFns.bounds,
            isRefusal,
        });
        if (selected >= roomCount()) selected = Math.max(0, roomCount() - 1);
        targets = ruleTargetsOver(record(), selected, deps,
            { deriveAtlasOf: adapterFns.deriveAtlasOf });
        renderRooms();
        paintStrip();
        /**
         * ⛓⛓⛓ **AND THE ARROWS FOLLOW THE STRIP — EDITOR v3 E3a, §31.1 #2.**
         *
         * ⛔ D2's shipped defect (§23.11 #5): `mountEditorView` paints its
         * overlay ONCE, at mount, when `#editSetOverview` is still the HTML's
         * `width="1" height="1"` and `rows` is still `[]` — and `paintStrip`,
         * which is what SIZES the canvas, never asked it to paint again. So the
         * exit arcs existed, reached the overlay and landed on a 1×1 surface
         * nobody could see until the first gesture repainted it. MEASURED on the
         * vanilla 116: strip 2088×132 / 181,674 ink, overlay 1×1 / 0.
         *
         * ⛔ HERE AND NOT INSIDE `paintStrip`: the strip painter draws room
         * boxes and knows nothing about a selection overlay, and the ORDER is
         * the contract — the canvas has to be sized before the overlay is asked
         * to match it. ⚠ `render()` is only ever entered after `const view` is
         * initialised (its first call is the last statement of this mount), so
         * this is not the mount-time call that hits the TDZ.
         */
        view.repaint();
        fillExitSelect('editSetExitList', selected);
        fillOrdinalSelect();
        fillEntitySelect(selected);
        renderRuleTargets();
        renderManifest();
        renderRoomForm();
        renderIdentity();
        const close = $('editRoomClose');
        if (close) close.disabled = roomSession() === null;
    }

    /* ── THE BUTTONS ───────────────────────────────────────────────── */

    const on = (id, run) => {
        const node = $(id);
        if (node) mine.on(node, 'click', run);
    };

    /**
     * ⛓ ADD ROOM applies the SUBSTRATE'S OWN op — Seedling's `add-room` takes
     * a blank `record` (EDITOR v3 E1b, §22.8) and the maze's takes a `payload`,
     * so the whole op is the binding's and this press only says WHERE. ⛔ No
     * render here: `add-room` refuses an `at` outside `0..rooms.length` on its
     * own, and it is APPENDED.
     */
    on('editSetAddRoom', () => {
        if (!addRoomOp) {
            say('no `addRoomOp` was injected — ADD ROOM is unavailable here', true);
            return;
        }
        const at = roomCount();
        /**
         * ⛔⛔ **THE MINT IS INSIDE THE GUARD, AND IT WAS NOT** (EDITOR v3 E6b).
         * `applySet(addRoomOp(at), …)` evaluates the binding AS AN ARGUMENT —
         * before `applySet`'s own `try` (`:647`) ever runs — so a binding that
         * REFUSES to mint threw straight out of this click listener: no
         * `#editSetNote`, no `say`, a console error, and the note left holding
         * the PREVIOUS press's sentence. Nothing could see it while `addRoomOp`
         * was Seedling-only (`emptyLevel()` never refuses); the maze's takes a
         * SIZE, and `createWorld` refuses a dimension below 2 by name.
         *
         * ⛓ The wording is `applySet`'s own, deliberately: one spelling of
         * *"refused"* on this page. What differs is the SUBJECT — the op does
         * not exist yet, so the sentence names the PRESS (`ADD ROOM`) rather
         * than an `op.op` there is none of.
         *
         * ⛔ AND NO SIZE CHECK HERE. What a blank room may be is the
         * substrate's, said once, by whatever the binding calls.
         */
        let op;
        try {
            op = addRoomOp(at);
        } catch (e) {
            if (!(e instanceof Error)) throw e;
            say(`the op was REFUSED by the MINT — ${e.message}`, true);
            setNote(`⛔ ADD ROOM could not be applied: ${e.message}`, true);
            return;
        }
        applySet(op, { renumber: addRoomMapping(at), what: 'ADD ROOM' });
    });

    /**
     * ⛔ **THERE IS NO SECOND "CONNECT" BUTTON.** A button that took the same two
     * rooms from two `<select>`s would be a second spelling of the gesture, and
     * the first slice to change one would leave the other saying something else.
     * The gesture is the one way; the SELECTS are its parameters.
     */

    on('editSetDisconnect', () => {
        applySet(exits.disconnectOp(selected, $('editSetExitList')?.value ?? 0));
    });

    on('editSetRuleCommit', () => {
        const tree = checkRuleJson();
        if (tree === null) return;
        applySet({
            op: 'set-access-rule',
            room: selected,
            target: $('editSetRuleTarget')?.value,
            rule: tree,
        });
    });

    /**
     * ⛔ **THE ENTITY IS PARSED BEHIND A GUARD.** `JSON.parse('')` THROWS, and an
     * empty `<select>` is exactly what a room with no bodies gives — so a press
     * with nothing selected would have thrown out of the handler before
     * `applySet` could turn anything into a refusal. Named here rather than
     * left to the disabled attribute, which is a hint and not a gate.
     */
    on('editSetMarkLocation', () => {
        const raw = $('editSetLocEntity')?.value ?? '';
        if (raw === '') {
            setNote(locations.emptyWhy, true);
            return;
        }
        let target;
        try {
            target = locations.targetOf(raw);
        } catch (e) {
            if (!(e instanceof Error)) throw e;
            setNote(`⛔ the entity could not be read — ${e.message}`, true);
            return;
        }
        applySet({
            op: 'mark-location',
            room: selected,
            ...target,
            name: $('editSetLocName')?.value ?? '',
            vanilla_item: $('editSetLocItem')?.value ?? '',
        });
    });

    /**
     * ⛓⛓⛓ **THE REPORT PATH NOTIFIES — THE SEAM'S OTHER FACE** (EDITOR v3 E3a,
     * §31.1 #1; the defect is §30.7's). It ran the report and re-rendered the
     * mount and told the page NOTHING, so no page could publish a REPORT
     * verdict without carrying the one from the previous render — which is why
     * `mazeLabView` published no `report` field at all and its gate read the
     * verdict off `#editSetReportOut`.
     */
    on('editSetReport', () => { runReport(); render(); onSetChange?.({ why: 'report' }); });

    /**
     * ⛓ ARMING THE GESTURE IS THE COMMAND TABLE'S OWN ROW — `view.setTool` —
     * so the button, the `c` key and `editorView`'s own vocabulary are one
     * list and not three (A2's law, kept one panel over).
     */
    on('editSetGesture', () => {
        armedExit = null;
        view.setTool('connect');
        say('CONNECT is ARMED — click the SOURCE room on the strip, then the TARGET. '
            + '⚠ Escape disarms.');
        render();
    });

    on('editSetUndo', () => view.run(UNDO_COMMAND_ID));

    on('editRoomClose', () => {
        const open = roomSession();
        if (!open) return;
        adapterFns.closeRoomSession(session, open.session, open.room);
        discardRoom();
        stills.clear();
        say(`the room session on room ${open.room} was CLOSED into the ${NOUN} — ${open.ops} room `
            + 'edit(s) became ONE `replace-room`');
        render();
        onSetChange?.({ why: 'close' });
    });

    /**
     * ⛓⛓⛓ **N DOCUMENTS, ONE STAMP, ONE PRESS** (§20.6). The substrate's
     * `download` validates, stamps ONCE and hands back its MEMBERS — Seedling's
     * three (the set, the overlay, the `apMappingInvalidation` companion), the
     * maze's two and a sentence about the companion a region library has no
     * reason to emit. Five ops then one press is ONE new id.
     *
     * ⛔ THE ERRORS ARE A **LIST**, through `validateForDownload` — §20.11 #5.
     * The adapter's own download quotes them into one throw, which is right for
     * a module and wrong for a form.
     *
     * ⛔ AND THE PAGE NEVER WRITES `fixtures/` — three browser blobs, like every
     * other download in this arm.
     */
    on('editDownloadSet', () => {
        /**
         * ⛔⛔ **AN OPEN ROOM SESSION WITH EDITS REFUSES THE DOWNLOAD BY NAME.**
         * C2 folded the open room into the download automatically, which was
         * right when the page had exactly ONE write path; a room's edits reach
         * the set through `closeRoomSession` now (ONE `replace-room`), so a
         * download that ignored them would hand somebody a set that is missing
         * work they can see on the canvas — and the stamp would say it is a
         * different set, truthfully, for the wrong reason.
         */
        const open = roomSession();
        if (open && open.ops > 0) {
            setNote(`⛔ NOT DOWNLOADED — room ${open.room} is open with ${open.ops} unwritten `
                + 'edit(s). Press CLOSE first: that makes them ONE `replace-room` in the '
                + `${NOUN} session, and the download stamps once over everything.`, true);
            return;
        }
        const check = adapterFns.validateForDownload(session);
        if (!check.ok) {
            const box = $('editSetReportOut');
            if (box) {
                box.innerHTML = '';
                const list = el(doc, 'ul', 'setReport');
                for (const e of check.errors) {
                    list.appendChild(el(doc, 'li', 'bad', `[download] ${e}`));
                }
                box.appendChild(list);
            }
            setNote(`⛔ NOT DOWNLOADED — the ${document.noun} does not validate `
                + `(${check.errors.length} error(s), listed in the REPORT box below)`, true);
            return;
        }
        const out = adapterFns.download(session);
        const indent = indentNow();
        /**
         * ⛓⛓⛓ **ONE BLOB PER MEMBER, ONE READOUT PER MEMBER** (§27.3 #5). The
         * substrate's `download` says WHICH documents one press produces —
         * Seedling's three (set · overlay · the `apMapping` companion), the
         * maze's two and a sentence about the companion it has no reason to
         * emit. ⛔ The mount writes them and NAMES them; it does not know how
         * many there are, which is the whole point of the shape.
         */
        for (const m of out.members) {
            download(m.name, `${JSON.stringify(m.doc, null, indent)}\n`, 'application/json');
            if (m.readout) globalThis[m.readout] = m.doc;
        }
        setNote(`DOWNLOADED ${out.members.map((m) => m.label).join(' · ')} — ONE stamp for `
            + `${out.report.edits} edit(s)`
            + (out.apMappingWhy ? ` ⛓ ${out.apMappingWhy}` : '')
            + (out.report.warnings.length ? ` ⚠ ${out.report.warnings.join(' | ')}` : ''));
        /**
         * ⛓ …AND WHAT IT WROTE IS READABLE. A browser download is a blob and a
         * click; the CLAIM is that the three documents round trip, so they are
         * put where a driver can read them (C2's own reason for `__editorSetOut`).
         */
        render();
        onSetChange?.({ why: 'download' });
    });

    /**
     * ⛓⛓ `rules.json` — through `stringifyRulesJson`, the MARKING TOOL's own
     * writer, so the bytes this page hands a person are the bytes
     * `region-atlas-compile` would have written for that atlas.
     *
     * ⛔ AND IT IS DISABLED WITH ITS REASON PRINTED while the graph does not
     * close or the set is invalid — "refuse before export" (§16.4). ⚠ The set
     * and overlay downloads stay OFFERED: a person may want to save work on a
     * graph that does not yet close.
     */
    const rulesBtn = $('editDownloadRules');
    if (rulesBtn) rulesBtn.disabled = true;
    on('editDownloadRules', () => {
        const rep = lastReport ?? runReport();
        if (!rep.download.rules.allowed) {
            setNote(rep.download.rules.why, true);
            return;
        }
        /**
         * ⛓ THE BYTES ARE THE WRITER'S, and BOTH are put where a driver can read
         * them: the document AND the exact text, so a row can ask node whether
         * they are the same bytes `region-atlas-compile` would have written.
         */
        const text = stringifyRulesJson(rep.rules, { indent: indentNow() });
        download('rules.json', text, 'application/json');
        globalThis.__editorSetRulesOut = rep.rules;
        globalThis.__editorSetRulesBytes = text;
        setNote(`DOWNLOADED rules.json — ${rep.report.ap_regions} AP region(s), `
            + `${rep.report.exits} exit(s), ${rep.report.locations} location(s)`);
        /**
         * ⛓ EDITOR v3 E3a — THE SAME FAMILY, THE SAME RULE. This press writes
         * two readout globals and a note and told the page nothing; the SET
         * download beside it always did. ⛔ `render()` here is what makes the
         * notification honest and NOT a second report run: `render` does not
         * touch `#editSetReportOut`, `#editSetReportNote` or the rules button's
         * disabled state — those are `runReport`'s alone.
         */
        render();
        onSetChange?.({ why: 'download' });
    });

    /**
     * ⛓⛓⛓ **THE BUNDLE — ONE PRESS, ONE `.zip`, THE SAME STAMP** (EDITOR v3 E1c,
     * §25; ⚖ the ruling at plan §22.8). A person who has edited a set now walks
     * away with FOUR documents in one file instead of four saves and a folder
     * they have to keep together — and the single `rules.json` is still
     * canonical, still downloadable on its own, still what everything reads.
     *
     * ⛔ **THE MEMBERS ARE THE FOUR DOCUMENTS AND NOTHING ELSE** (§24.12). The
     * `apMapping` companion is NOT one: `apMappingInvalidation` derives it from
     * the set on demand, and its own `reason` field says it is a DERIVED table
     * that can be regenerated per set. It stays a separate blob for the same
     * reason `.chunks.json` is refused as a member — a container that carried
     * everything derivable from its own contents would be describing itself.
     *
     * ⛓ **AND THE IDS ARE THE SEPARATE DOWNLOAD'S IDS.** It goes through the
     * SAME `adapterFns.download(session)` — validated, stamped ONCE — so the
     * ids inside the zip are the ones the separate presses write. §21.9 holds:
     * this is another WAY to press, not another stamp.
     *
     * ⛔ **THE RULES MEMBER IS REFUSED ON THE SAME THREE CONDITIONS**, and the
     * bundle is then written WITHOUT it, saying why — a person may still want to
     * save work on a graph that does not close, which is exactly why the set and
     * overlay downloads stay offered next door. The DERIVED ATLAS travels with
     * the rules or not at all: both are the compile's output, and an atlas
     * beside no rules.json would be half an answer with nothing to say so.
     */
    const bundleBtn = $('editDownloadBundle');
    if (bundleBtn) bundleBtn.disabled = true;
    on('editDownloadBundle', async () => {
        if (typeof loadZip !== 'function') {
            setNote('⛔ NOT BUNDLED — this mount was given no `loadZip`, and nothing here '
                + 'implements a zip container of its own', true);
            return;
        }
        const open = roomSession();
        if (open && open.ops > 0) {
            setNote(`⛔ NOT BUNDLED — room ${open.room} is open with ${open.ops} unwritten `
                + 'edit(s). Press CLOSE first: the bundle stamps once over everything, exactly '
                + 'as the download beside it does.', true);
            return;
        }
        const check = adapterFns.validateForDownload(session);
        if (!check.ok) {
            setNote(`⛔ NOT BUNDLED — the ${document.noun} does not validate `
                + `(${check.errors.length} error(s)): ${check.errors.join(' · ')}`, true);
            return;
        }
        const out = adapterFns.download(session);
        const rep = lastReport ?? runReport();
        const members = [];
        const notes = [];
        /**
         * ⛔⛔ **A MEMBER KIND `documentBundle` DOES NOT CARRY IS REFUSED BY
         * NAME, AND THE ROSTER IS QUOTED.** `BUNDLE_KINDS` is
         * `rules, level-set, overlay, region-atlas` (`documentBundle.js:66`) —
         * there is no `region-library` and no `ap-mapping` in it. ⛓ A silent
         * drop is the shape this refusal exists to prevent: a person would get
         * a zip that is missing the document they pressed the button for and
         * nothing would say so. E2c adds the fifth kind (§25.12 #1).
         */
        for (const m of out.members) {
            if (BUNDLE_KINDS.includes(m.kind)) {
                members.push({ kind: m.kind, doc: m.doc });
                continue;
            }
            notes.push(`the \`${m.kind}\` document is NOT a member — a bundle carries `
                + `${BUNDLE_KINDS.join(', ')} and nothing else`
                + (m.whyNotMember ? `; ${m.whyNotMember}` : ''));
        }
        if (rep.download.rules.allowed && rep.rules) {
            members.push({ kind: 'rules', doc: rep.rules });
            if (rep.atlas) members.push({ kind: 'region-atlas', doc: rep.atlas });
        } else {
            notes.push(`no \`rules.json\` member — ${rep.download.rules.why}`);
        }
        const indent = indentNow();
        let bytes;
        try {
            bytes = await writeBundle(members, { jszip: await loadZip(), indent });
        } catch (e) {
            setNote(`⛔ NOT BUNDLED — ${e.message}`, true);
            return;
        }
        download(`${bundleId(out)}.zip`, bytes, 'application/zip');
        /**
         * ⛓ …AND WHAT IT WROTE IS READABLE, like every other download on this
         * page (C2's own reason for `__editorSetOut`): the BYTES, so a row can
         * read the zip back in node, and the member kinds, so a row can ask what
         * the press decided without unzipping first.
         */
        globalThis.__editorSetBundleOut = bytes;
        globalThis.__editorSetBundleKinds = members.map((m) => m.kind);
        setNote(`BUNDLED ${bundleId(out)}.zip — ${members.length} member(s) `
            + `(${members.map((m) => m.kind).join(', ')}), ${bytes.length} bytes at indent `
            + `${indent}${indent === 0 ? ' (MINIFIED)' : ''} · ${notes.join(' | ')}`);
        render();
        onSetChange?.({ why: 'download' });
    });

    mine.on($('editSetRuleJson') ?? doc.createElement('textarea'), 'input', checkRuleJson);

    if ($('editSetRoom')) {
        mine.on($('editSetRoom'), 'change', () => {
            selectRoom(Number($('editSetRoom').value));
            render();
        });
    }

    render();
    selectRoom(0);

    return {
        get selected() { return selected; },
        get armedExit() { return armedExit; },
        view,
        render,
        runReport,
        rows: () => rows,
        applySet,
        selectRoom,
        report: () => lastReport,
        destroy() {
            view.destroy();
            stills.clear();
            mine.retire('this set editor was replaced by a new one');
        },
    };
}
