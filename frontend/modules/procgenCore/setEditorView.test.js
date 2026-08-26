/**
 * procgenCore/setEditorView — **THE SET EDITOR'S DOM HALF, PINNED AND BOUND TWICE.**
 *
 * EDITOR v3 arc, slice E2b (`NewDocs/plans/seedling-editor-v3.md` §27, §28).
 * `mountWatchSetEditor` moved out of `seedlingDemo/watchSetEditor.js` and into
 * `setEditorView.js` as `mountSetEditor(opts)`; what stayed behind is a BINDING
 * that hands Seedling's readers, ops and sentences in. Two things are proved
 * here and each needs its own kind of row:
 *
 *  1. ⛔⛔ **THE LIFT IS BYTE-INERT ON SEEDLING, AND IT IS PINNED RATHER THAN
 *     ASSERTED.** The `PIN` literal below was CAPTURED at the pre-lift head
 *     (`956af2029`) by driving `mountWatchSetEditor` — the real function, before
 *     it moved — over the hand-built DOM with a fixed op script, and the same
 *     script through the BINDING has to reproduce it byte for byte. A row that
 *     asked the moved code whether it agreed with itself would pass for ever
 *     (trap 250), which is E2a's own method one layer up (§26.3).
 *  2. ⛓⛓ **THE SECOND BINDING IS REAL, AND IT NEEDS NO PAGE.** The same mount
 *     is driven over `mazeRoom/mazeSetAdapter` and the committed
 *     `demo-maze-pack` — four rooms, endpoint-addressed links, a `region-library`
 *     document, a download with no AP companion. ⛔ That is the existence proof
 *     E2c's `lab.html` arm rests on: a lift whose only witness is a page that
 *     does not exist yet cannot be verified in isolation.
 *
 * ⛓ **THE DOM IS HAND-BUILT** — this repo's vitest is `environment: 'node'`
 * (see `vitest.config.js`), exactly as `editorView.test.js` says, and the fake
 * below honours the things the mount actually relies on: `addEventListener(type,
 * fn, {signal})` detaching on abort, `getElementById` finding only ATTACHED
 * nodes (so a rebuilt table does not answer for its predecessor), `innerHTML =
 * ''` detaching children, and a recording 2D context.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT — the change to `setEditorView.js` that reds it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadAtlasSchema, loadRulesSchema } from './jsonSchemaFiles.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { createLifetime } from './pageLifetime.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { buildLevelSet } from '../seedlingDemo/levelSetExporter.js';
import { roomRecordOf, roomSourceKind } from '../seedlingDemo/levelSetValidator.js';
import { emptyLevel } from '../seedlingDemo/procgenLevel.js';
import { parseOelLevel } from '../seedlingDemo/procgenLevelOel.js';
import { emptyOverlay } from '../seedlingDemo/seedlingSetOverlay.js';
import {
    createSeedlingSetAdapter, createSetSession, setRecord,
} from '../seedlingDemo/seedlingSetAdapter.js';
import { mountWatchSetEditor } from '../seedlingDemo/watchSetEditor.js';
import { SET_CHANGE_WHY, mountSetEditor } from './setEditorView.js';
import { exitArrowShapes } from './setEditorCore.js';
import { BUNDLE_KINDS } from '../presets/documentBundle.js';
import { loadJSZipNode } from '../../../scripts/procgen/loadJSZipNode.mjs';
import {
    createMazeSetAdapter, createSetSession as createMazeSetSession,
    emptyMazeOverlay, setRecord as mazeSetRecord,
} from '../mazeRoom/mazeSetAdapter.js';
/**
 * ⛓⛓⛓ EDITOR v3 E2c — **THE BINDING LIST MOVED, IT DID NOT GET COPIED.** §28.9
 * left it here as a literal for E2c to copy; a copy would have been two answers
 * to *"what is the maze's `exits.addressOf`"*, and the first slice to change one
 * would leave the other saying something else. It lives in
 * `mazeRoom/mazeSetLab.js` now, `lab.html`'s SET arm hands the SAME object to
 * the SAME mount, and the ten rows below are that module's rows too.
 */
import { mazeSetBindings } from '../mazeRoom/mazeSetLab.js';

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE HAND-BUILT DOM — `editorView.test.js`'s discipline, widened to
 *   the handful of things a FORM needs
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ A recording 2D context: the claims are about what the mount DID. */
const recordingContext = (calls) => new Proxy({}, {
    get(_t, prop) {
        if (prop === 'canvas') return undefined;
        return (...args) => { calls.push(`${String(prop)}(${args.map((a) => (typeof a === 'object' ? '<obj>' : String(a))).join(',')})`); };
    },
    set(_t, prop, value) { calls.push(`${String(prop)}=${String(value)}`); return true; },
});

class FakeElement {
    constructor(doc, tag) {
        this.ownerDocument = doc;
        this.tagName = String(tag).toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.handlers = new Map();
        this.style = {};
        this.id = '';
        this.className = '';
        this._text = undefined;
        this.disabled = false;
        this.checked = false;
        this.value = '';
        this.clientWidth = 800;
        this.clientHeight = 200;
        if (this.tagName === 'CANVAS') {
            this.width = 1;
            this.height = 1;
            this.calls = [];
        }
    }

    /** ⛓ A canvas answers a RECORDING context; nothing else answers one at all. */
    getContext(kind) {
        if (this.tagName !== 'CANVAS' || kind !== '2d') return null;
        return recordingContext(this.calls);
    }

    getBoundingClientRect() {
        return { left: 0, top: 0, width: this.width ?? this.clientWidth, height: this.height ?? this.clientHeight };
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        /**
         * ⛓⛓ **A `<select>` ADOPTS ITS FIRST OPTION** (EDITOR v3 E3a). ⛔ Added
         * because the fake DOM was MORE FORGIVING THAN A BROWSER and that is
         * what let §30.12 #1 hide here: a real `<select>` whose options are
         * replaced reports the FIRST option's value, and one whose options are
         * cleared reports `''`. Modelling neither meant a value simply persisted
         * across `innerHTML = ''`, so a row could not tell a panel that
         * PRESERVES its selection from one that merely never lost it.
         */
        if (this.tagName === 'SELECT' && child.tagName === 'OPTION' && this.value === '') {
            this.value = child.value;
        }
        return child;
    }

    removeChild(child) {
        this.children = this.children.filter((c) => c !== child);
        child.parentNode = null;
        return child;
    }

    /** ⛔ The ONE thing the mount uses it for — emptying a box. */
    set innerHTML(v) {
        if (v !== '') throw new Error(`FakeElement: innerHTML = ${JSON.stringify(v)} is not supported; the mount only ever empties a box`);
        for (const c of this.children) c.parentNode = null;
        this.children = [];
        // ⛓ …and an EMPTIED `<select>` has no value — see `appendChild`.
        if (this.tagName === 'SELECT') this.value = '';
    }

    get innerHTML() { return ''; }

    set textContent(v) {
        for (const c of this.children) c.parentNode = null;
        this.children = [];
        this._text = String(v);
    }

    get textContent() {
        if (this._text !== undefined) return this._text;
        return this.children.map((c) => c.textContent).join('');
    }

    /** ⛓ `<select>.options` — the mount reads its LENGTH to disable itself. */
    get options() { return this.children.filter((c) => c.tagName === 'OPTION'); }

    addEventListener(type, fn, options = undefined) {
        if (!this.handlers.has(type)) this.handlers.set(type, new Set());
        this.handlers.get(type).add(fn);
        if (options?.signal) {
            options.signal.addEventListener('abort', () => { this.handlers.get(type)?.delete(fn); });
        }
    }

    removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }

    listeners() { return [...this.handlers.values()].reduce((n, s) => n + s.size, 0); }

    dispatch(type, event = {}) {
        for (const fn of [...(this.handlers.get(type) ?? [])]) fn({ target: this, ...event });
    }
}

/** ⛓ Every element id `mountSetEditor` looks up, in the shape `watch.html` gives it. */
const PANEL_IDS = Object.freeze([
    'editSetOverview', 'editSetNote', 'editSetRooms', 'editSetRoom', 'editSetManifest',
    'editSetRoomForm', 'editSetExitList', 'editSetTargetExit', 'editSetOneWay',
    'editSetLocEntity', 'editSetLocName', 'editSetLocItem', 'editSetRuleTarget',
    'editSetRuleNote', 'editSetRuleJson', 'editSetRuleErrors', 'editSetReportOut',
    'editSetReportNote', 'editSetIdentity', 'editMinify',
    'editSetAddRoom', 'editSetDisconnect', 'editSetRuleCommit', 'editSetMarkLocation',
    'editSetReport', 'editSetGesture', 'editSetUndo', 'editRoomClose',
    'editDownloadSet', 'editDownloadRules', 'editDownloadBundle',
]);

/** ⛓ The ids that are `<select>` in both documents this mount is bound in. */
const SELECT_IDS = Object.freeze([
    'editSetRoom', 'editSetExitList', 'editSetTargetExit', 'editSetLocEntity',
    'editSetRuleTarget',
]);

class FakeDocument {
    constructor() {
        this.root = new FakeElement(this, 'div');
        this.activeElement = null;
        this.byId = new Map();
        for (const id of PANEL_IDS) {
            /**
             * ⛓⛓ **THE `<select>`s ARE `<select>`s** (EDITOR v3 E3a). ⛔ They
             * were `div`s, which is why §30.12 #1 could not be seen from node:
             * a `div`'s `value` is an ordinary property that survives
             * `innerHTML = ''`, and a browser's `<select>` loses it. The five
             * ids below are `<select>` on `watch.html` and on `lab.html`.
             */
            const tag = id === 'editSetOverview' ? 'canvas'
                : (SELECT_IDS.includes(id) ? 'select'
                    : (id.startsWith('editSetRule') && id.endsWith('Json') ? 'textarea' : 'div'));
            const node = this.createElement(tag);
            node.id = id;
            // ⛓ the overview lives in a sized parent — `overviewLayout` reads it
            const holder = this.createElement('div');
            holder.clientWidth = 900;
            holder.appendChild(node);
            this.root.appendChild(holder);
        }
    }

    createElement(tag) { return new FakeElement(this, tag); }

    /** ⛔ ATTACHED nodes only — a rebuilt table must not answer for its predecessor. */
    getElementById(id) {
        const walk = (node) => {
            if (node.id === id) return node;
            for (const c of node.children) {
                const hit = walk(c);
                if (hit) return hit;
            }
            return null;
        };
        return walk(this.root);
    }
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE SEEDLING HARNESS — D2's own fixture shape
 * ══════════════════════════════════════════════════════════════════════ */

const TILE = 16;
const ROOMS = 6;
const DEPS = Object.freeze({
    parseOel: parseOelLevel,
    tileSize: TILE,
    tileTypeForPlacement,
    rulesSchema: loadRulesSchema(),
    atlas: { game: 'set-editor-view-test', mapDocument: 'set-editor-view-test.json' },
});
const ATLAS_SCHEMA = loadAtlasSchema();

/**
 * ⛔ **THE SET IS GENERATED, NOT AUTHORED** — `buildLevelSet({link: true})` over
 * `emptyLevel` rooms, exactly as D2's own rows are (and `watchSetEditor.test.js`
 * says why: a document written to make a row pass is a row that measures
 * nothing). ⚠ THE BRIEF SAID `fixtures/seedling-demo-set*.json`; there is no
 * such fixture and D2's tests use this. §28.
 */
const generatedSet = (n = ROOMS, setId = 'set-editor-view-test') => buildLevelSet(
    Array.from({ length: n }, (_, level) => emptyLevel({ level })), { setId, link: true },
).set;

const seedlingHarness = ({ rooms = ROOMS, onSetChange = null, embeds = [] } = {}) => {
    const adapter = createSeedlingSetAdapter(DEPS);
    /**
     * ⛓ A ROOM SESSION STUB — the mount reads `{room, ops}` and
     * `adapterFns.closeRoomSession` reads `roomSession.record()`, and those
     * three are the whole surface (§20.7). ⛔ Not a second edit session: what
     * §21.5's rules route on is the OP COUNT, and a real session would make the
     * pin depend on a room adapter this file is not about.
     */
    let open = null;
    /**
     * ⛓ The stub's record is the room's OWN, with one entity appended — so the
     * `replace-room` `closeRoomSession` commits is a real change and the fold
     * cannot report `applied: false` for a session that edited nothing.
     */
    const openStub = (index) => {
        const room = session.record().set.rooms[index];
        const base = roomRecordOf(room, { parseOel: parseOelLevel });
        const edited = {
            ...base,
            entities: [...(base.entities ?? []),
                { type: 'Coin', x: 48, y: 48, values: {} }],
        };
        return { room: index, ops: 1, session: { record: () => edited } };
    };
    /**
     * ⛓⛓ **AND SOME ROOMS MAY BE MADE `embed`s** (EDITOR v3 E3a). The generated
     * set is all `record`-sourced, which is the document where the `⛔embed`
     * badge fix is VISIBLE; the committed vanilla fixture is 116 rooms and all
     * 116 ARE embeds, so a row over that one would be green under both builds.
     * ⛔ The source is REPLACED in the document rather than applied as an op:
     * there is no adapter op that turns a room into an embed, and inventing one
     * for a row would be a second way to write a set.
     */
    const built = generatedSet(rooms);
    const record = setRecord(embeds.length === 0 ? built : {
        ...built,
        rooms: built.rooms.map((r, i) => (embeds.includes(i)
            ? { ...r, source: { embed: `levels/room_${i}.oel` } } : r)),
    }, emptyOverlay());
    const session = createSetSession(adapter, record,
        { base: { kind: 'set', set_id: record.set.set_id } });
    const doc = new FakeDocument();
    const said = [];
    const downloads = [];
    const stillCalls = [];
    const ui = mountWatchSetEditor({
        lifetime: createLifetime('setEditorView.test'),
        session,
        adapter,
        deps: DEPS,
        compileRegionAtlas,
        validateRegionAtlas,
        atlasSchema: ATLAS_SCHEMA,
        drawRoomStill: (canvas, roomRecord) => {
            stillCalls.push(roomRecord.level);
            canvas.width = 32;
            canvas.height = 32;
            return null;
        },
        emptyLevel: () => emptyLevel({ level: session.record().set.rooms.length }),
        say: (text, bad) => said.push({ text, bad: Boolean(bad) }),
        roomSession: () => open,
        openRoomAt: (index) => { open = openStub(index); return true; },
        discardRoom: () => { open = null; },
        download: (name, text) => downloads.push({ name, bytes: String(text).length }),
        /**
         * ⛓ EDITOR v3 E3a — the page seam, RECORDABLE. ⛔ `null` by default, so
         * every row that predates this slice drives the SAME mount it always
         * did (`mountSetEditor`'s own default is `null` too), and the byte-inert
         * PIN is untouched by the existence of this option.
         */
        onSetChange,
        doc,
    });
    return {
        adapter, session, doc, said, downloads, stillCalls, ui,
        openRoom: (i) => { open = openStub(i); },
    };
};


/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE FIXED OP SCRIPT, AND WHAT IT CAPTURES
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **THE READOUT ROSTER, PINNED BY NAME** (§27.3 #4). Four of these are the
 * MOUNT's own (`rules`, `bundle`) and the rest are written one per DOWNLOAD
 * MEMBER, so the roster is where a substrate's members and the mount's two
 * derived documents are visible in one list. ⛔ The `-arm` gate reads every one
 * of them by name; shrinking this roster is a mutant with no other witness.
 */
const READOUT_NAMES = Object.freeze([
    '__editorSetOut', '__editorSetOverlayOut', '__editorSetMappingOut',
    '__editorSetRulesOut', '__editorSetRulesBytes',
    '__editorSetBundleOut', '__editorSetBundleKinds',
]);

const $ = (h, id) => h.doc.getElementById(id);
const textOf = (h, id) => $(h, id)?.textContent ?? null;
/** ⛓ Rows of a table / list / select — the DOM's own account, as text. */
const rowsOf = (h, id) => {
    const box = $(h, id);
    if (!box) return null;
    const out = [];
    const walk = (node) => {
        if (node.tagName === 'TR' || node.tagName === 'LI') { out.push(node.textContent); return; }
        if (node.tagName === 'OPTION') { out.push(`${node.value}=${node.textContent}`); return; }
        for (const c of node.children) walk(c);
    };
    walk(box);
    return out;
};

/** ⛓ The FORMS, as `id:type=value` lines — their SHAPE is what moves with the mount. */
const formOf = (h, id) => {
    const box = $(h, id);
    if (!box) return null;
    const out = [];
    const walk = (node) => {
        if (node.tagName === 'INPUT') {
            out.push(`${node.id}:${node.type ?? 'text'}=${node.value}${node.checked ? ':checked' : ''}`);
            return;
        }
        if (node._text !== undefined && node._text !== '') out.push(`«${node._text}»`);
        for (const c of node.children) walk(c);
    };
    walk(box);
    return out;
};

const snapshot = (h) => ({
    note: textOf(h, 'editSetNote'),
    identity: textOf(h, 'editSetIdentity'),
    rooms: rowsOf(h, 'editSetRooms'),
    manifest: formOf(h, 'editSetManifest'),
    roomForm: formOf(h, 'editSetRoomForm'),
    ruleTargets: rowsOf(h, 'editSetRuleTarget'),
    ruleNote: textOf(h, 'editSetRuleNote'),
    exits: rowsOf(h, 'editSetExitList'),
    ordinals: rowsOf(h, 'editSetTargetExit'),
    entities: rowsOf(h, 'editSetLocEntity'),
    report: rowsOf(h, 'editSetReportOut'),
    reportNote: textOf(h, 'editSetReportNote'),
    closeDisabled: $(h, 'editRoomClose')?.disabled ?? null,
    rulesDisabled: $(h, 'editDownloadRules')?.disabled ?? null,
});

const click = (h, id) => $(h, id)?.dispatch('click');
const setValue = (h, id, v) => { const n = $(h, id); if (n) n.value = v; };

/** ⛓ A click ON THE STRIP at room `i` — `cellAt` reads `clientX` against the rect. */
const clickRoom = (h, i, n) => {
    const c = $(h, 'editSetOverview');
    c.dispatch('click', { clientX: ((i + 0.5) / n) * c.width, clientY: 4 });
};

/**
 * ⛓⛓⛓ **THE SCRIPT** — select 2 · CONNECT 0→3 through the two-click gesture ·
 * MOVE UP room 3 · commit a rule · mark a location · open room 1 and CLOSE it ·
 * REPORT. ⛔ Every step goes through the DOM (a button's `click`, a canvas's
 * `click`, a `<select>`'s value) rather than through `ui.applySet`, because
 * what this file pins is the MOUNT and not the adapter.
 */
const runScript = (h) => {
    for (const k of READOUT_NAMES) delete globalThis[k];
    const steps = [];
    const step = (what) => steps.push({
        what,
        ops: h.session.ops().length,
        describe: h.session.describe ? undefined : undefined,
        note: textOf(h, 'editSetNote'),
        said: h.said.length ? h.said[h.said.length - 1].text : null,
    });

    h.ui.selectRoom(2);
    step('select 2');

    click(h, 'editSetGesture');
    setValue(h, 'editSetExitList', '0');
    setValue(h, 'editSetTargetExit', '0');
    clickRoom(h, 0, 6);
    clickRoom(h, 3, 6);
    step('connect 0→3 (two clicks)');

    click(h, 'editSetRowUp_3');
    step('MOVE UP room 3');

    const target = rowsOf(h, 'editSetRuleTarget')[0];
    setValue(h, 'editSetRuleTarget', target.split('=')[0]);
    setValue(h, 'editSetRuleJson', '{"rule":"Reachable","region":"level_0"}');
    $(h, 'editSetRuleJson').dispatch('input');
    click(h, 'editSetRuleCommit');
    step('set-access-rule');

    const ent = rowsOf(h, 'editSetLocEntity')[0] ?? null;
    if (ent !== null) {
        setValue(h, 'editSetLocEntity', ent.slice(0, ent.indexOf('=')));
        setValue(h, 'editSetLocName', 'a coin');
        setValue(h, 'editSetLocItem', 'Coin');
        click(h, 'editSetMarkLocation');
    }
    step(`mark-location (${ent === null ? 'no entity offered' : 'offered'})`);

    h.openRoom(1);
    h.ui.render();
    step('room 1 OPEN with 1 edit');

    click(h, 'editRoomClose');
    step('room 1 CLOSED');

    click(h, 'editSetReport');
    step('REPORT');

    /**
     * ⛓⛓⛓ **§21.5's THIRD RULE, DRIVEN** — a renumbering with an EDITED room
     * session open DISCARDS it, loudly. ⛔ Not written back: a press on MOVE UP
     * would otherwise become a `replace-room` nobody asked for.
     */
    h.openRoom(2);
    h.ui.render();
    click(h, 'editSetRowUp_4');
    step('MOVE UP with room 2 open and edited');

    click(h, 'editDownloadSet');
    step('DOWNLOAD');

    /**
     * ⛓ THE STILLS CACHE STILL HITS — two more renders over a set nothing
     * touched must draw NOTHING. ⛔ MUTANT: `stillKey` returns a fresh object
     * (or the cache is keyed on the index alone) — this count moves.
     */
    const before = h.stillCalls.length;
    h.ui.render();
    h.ui.render();

    return {
        steps,
        dom: snapshot(h),
        ruleErrors: textOf(h, 'editSetRuleErrors'),
        stills: h.stillCalls.slice(0, before),
        stillsAfterTwoIdleRenders: h.stillCalls.length - before,
        ops: h.session.ops().map((o) => o.op),
        downloads: h.downloads.map((d) => d.name),
        readouts: READOUT_NAMES.filter((k) => globalThis[k] !== undefined),
        surface: Object.keys(h.ui).sort(),
        said: h.said.map((s) => s.text),
    };
};

/**
 * ⛔⛔⛔ **THE PIN — CAPTURED AT THE PRE-LIFT HEAD, BEFORE ONE LINE MOVED.**
 *
 * Every literal below came out of `mountWatchSetEditor` as it stood at
 * `956af2029` (E1..E2a merged, `watchSetEditor.js` still 1,452 lines), driven
 * by `runScript` over the fake DOM. After the lift the SAME script through
 * `mountWatchSetEditor` — now a BINDING over `mountSetEditor` — has to
 * reproduce it byte for byte.
 *
 * ⛔ **THIS IS WHY THE CAPTURE CAME FIRST.** A row that asked the moved code
 * whether it agreed with itself would pass for ever (trap 250); a row that
 * quotes what the code said BEFORE the change is the only kind that can fail.
 */
const PIN = Object.freeze({
        "steps": [
            {
                "what": "select 2",
                "ops": 0,
                "note": "",
                "said": null
            },
            {
                "what": "connect 0→3 (two clicks)",
                "ops": 1,
                "note": "",
                "said": "connect room 0 exit 0 ↔ room 3 exit 0, arriving at (128, 128)"
            },
            {
                "what": "MOVE UP room 3",
                "ops": 2,
                "note": "",
                "said": "reorder 6 rooms to [0, 1, 3, 2, 4, 5]"
            },
            {
                "what": "set-access-rule",
                "ops": 3,
                "note": "",
                "said": "set the access rule on exit:out_teleporter_128_128 in room 0 to Reachable"
            },
            {
                "what": "mark-location (offered)",
                "ops": 4,
                "note": "",
                "said": "mark room 0 <teleporter> at (128, 128) as location \"a coin\" holding Coin"
            },
            {
                "what": "room 1 OPEN with 1 edit",
                "ops": 4,
                "note": "",
                "said": "mark room 0 <teleporter> at (128, 128) as location \"a coin\" holding Coin"
            },
            {
                "what": "room 1 CLOSED",
                "ops": 5,
                "note": "",
                "said": "the room session on room 1 was CLOSED into the SET — 1 room edit(s) became ONE `replace-room`"
            },
            {
                "what": "REPORT",
                "ops": 5,
                "note": "",
                "said": "the room session on room 1 was CLOSED into the SET — 1 room edit(s) became ONE `replace-room`"
            },
            {
                "what": "MOVE UP with room 2 open and edited",
                "ops": 6,
                "note": "⛔ the room session on room 2 was DISCARDED — MOVE UP renumbers the rooms, so room 2 no longer names the room that was open, and 1 unwritten edit(s) went with it. ⚠ Close a room BEFORE reordering and its edits become one `replace-room` in the set; a write-back after the renumbering would land on a room nobody opened.",
                "said": "reorder 6 rooms to [0, 1, 2, 4, 3, 5]"
            },
            {
                "what": "DOWNLOAD",
                "ops": 6,
                "note": "DOWNLOADED set-editor-view-test-21854d21 · overlay overlay-684a125f · the apMapping companion — ONE stamp for 6 edit(s) ⚠ this set has 6 rooms; the LIVE debug warps on keys 1-9 (Player.as:1827-1999, each preceded by Main.clearSave()) reach levels 2, 13, 12, 37, 45, 95, 12, 93, 110, of which 13, 12, 37, 45, 95, 93, 110 are out of range here and would boot as \"everything already cleared\" (§8.3). Guarded by a debug keypress, so this is not a refusal.",
                "said": "reorder 6 rooms to [0, 1, 2, 4, 3, 5]"
            }
        ],
        "dom": {
            "note": "DOWNLOADED set-editor-view-test-21854d21 · overlay overlay-684a125f · the apMapping companion — ONE stamp for 6 edit(s) ⚠ this set has 6 rooms; the LIVE debug warps on keys 1-9 (Player.as:1827-1999, each preceded by Main.clearSave()) reach levels 2, 13, 12, 37, 45, 95, 12, 93, 110, of which 13, 12, 37, 45, 95, 93, 110 are out of range here and would boot as \"everything already cleared\" (§8.3). Guarded by a debug keypress, so this is not a refusal.",
            "identity": "SET set-editor-view-test-2e3dc7c0 · overlay (unstamped) · 6 edit(s) · no room open · ⌨ Ctrl+Z here hits the ROOM session (the strip owns its keys; focus it to undo the SET)",
            "rooms": [
                "#namemusicexitslinks herelocrules",
                "0Procgen0_00001211OPEN▲▼REMOVE",
                "1Procgen1_00102100OPEN▲▼REMOVE",
                "2Procgen3_00302300OPEN▲▼REMOVE",
                "3Procgen4_00402200OPEN▲▼REMOVE",
                "4Procgen2_00202100OPEN▲▼REMOVE",
                "5Procgen5_00501100OPEN▲▼REMOVE"
            ],
            "manifest": [
                "«name»",
                "editSetField_name:text=",
                "«description»",
                "editSetField_description:text=",
                "«start»",
                "« level »",
                "editSetStart_level:number=0",
                "« x »",
                "editSetStart_x:number=",
                "« y »",
                "editSetStart_y:number=",
                "«menu_rooms»",
                "editSetField_menu_rooms:text=0",
                "« ⚠ minItems 1: the title screen advances `menuIndex % menuLevels.length`, so an empty list makes that index NaN»",
                "«named_rooms»",
                "«moonrock_target (Scenery/Moonrock.as:134 (teleporter) and :135 (persistence))»",
                "editSetNamed_moonrock_target:number=",
                "«watcher_text (Scenery/FinalDoor.as:50)»",
                "editSetNamed_watcher_text:number=",
                "«dark_shrum_death (Player.as:491)»",
                "editSetNamed_dark_shrum_death:number=",
                "«bloody_seed_ending (Pickups/Seed.as:73)»",
                "editSetNamed_bloody_seed_ending:number=",
                "«light_boss_exit (Enemies/LightBossController.as:104)»",
                "editSetNamed_light_boss_exit:number=",
                "«tentacle_beast_mouth (Enemies/TentacleBeast.as:213)»",
                "editSetNamed_tentacle_beast_mouth:number="
            ],
            "roomForm": [
                "«room 0»",
                "«name»",
                "editSetRoomField_name:text=Procgen0_000",
                "«music»",
                "editSetRoomField_music:number=0",
                "«music_override_exempt»",
                "editSetRoomField_music_override_exempt:checkbox=",
                "«snow_gradient»",
                "editSetRoomField_snow_gradient:checkbox="
            ],
            "ruleTargets": [
                "exit:out_teleporter_128_128=exit:out_teleporter_128_128",
                "exit:in_L1_128_128=exit:in_L1_128_128 ⚠ gates NOTHING",
                "exit:in_L2_128_128=exit:in_L2_128_128 ⚠ gates NOTHING",
                "loc:a coin=loc:a coin"
            ],
            "ruleNote": "3 exit target(s) and 1 location target(s) for this room — DERIVED once per selection, never per keystroke (building the atlas is what an exit id costs). ⚠ 2 of the exits GATE NOTHING: the ARRIVAL side of a ONE-WAY connection — the compiler builds no AP exit for it (`regionAtlasCompiler.js:341`, `arrivalOnly`), so a rule here gates nothing and the edge stays FREE",
            "exits": [
                "0=#0 teleporter → room 2 @(128,128)"
            ],
            "ordinals": [
                "0=#0",
                "1=#1"
            ],
            "entities": [
                "{\"type\":\"teleporter\",\"x\":128,\"y\":128}=teleporter @(128,128)"
            ],
            "report": [
                "[level-set] this set has 6 rooms; the LIVE debug warps on keys 1-9 (Player.as:1827-1999, each preceded by Main.clearSave()) reach levels 2, 13, 12, 37, 45, 95, 12, 93, 110, of which 13, 12, 37, 45, 95, 93, 110 are out of range here and would boot as \"everything already cleared\" (§8.3). Guarded by a debug keypress, so this is not a refusal.",
                "[region-atlas] validateRegionAtlas: ok — 6 region(s), 1 warning(s); schema included",
                "[region-atlas] provenance.content_hash missing — stamp with --restamp",
                "[region-atlas] the derived atlas is DELIBERATELY UNSTAMPED — it is not a document anybody keeps, it is rebuilt from the set on every report, so the `provenance.content_hash` warning above is expected here and only here",
                "[unwired] no unwired exits — every boundary crossing is in the graph",
                "[free] FREE location \"Level 000 - a coin\" in region \"level_0\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_1 -> level_3\" in region \"level_1\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_1 -> level_0\" in region \"level_1\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_2 -> level_4\" in region \"level_2\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_2 -> level_0\" in region \"level_2\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_3 -> level_2\" in region \"level_3\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_3 -> level_1\" in region \"level_3\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_4 -> level_5\" in region \"level_4\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_4 -> level_2\" in region \"level_4\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"level_5 -> level_4\" in region \"level_5\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[free] FREE exit \"GameStart\" in region \"Menu\" — its compiled `access_rule` is `True_`, which is a logic obligation nobody has met",
                "[inert-rule] every authored exit rule sits on an endpoint the compiler builds an AP exit for",
                "[reach] region \"level_1\" is UNREACHABLE from the start — no chain of exits gets there at all, under any rule set",
                "[reach] region \"level_3\" is UNREACHABLE from the start — no chain of exits gets there at all, under any rule set",
                "[locations] 1 location(s) in the OVERLAY, 1 compiled"
            ],
            "reportNote": "⛔ REFUSED BEFORE EXPORT — 2 region(s) (level_1, level_3) cannot be reached from the start; a rules.json whose graph does not close is a world nobody can finish, and the seed that found out would be the report",
            "closeDisabled": true,
            "rulesDisabled": true
        },
        "ruleErrors": "⛓ the rule validates against `rules.schema.json`",
        "stills": [
            0,
            1,
            2,
            3,
            4,
            5,
            0,
            1,
            2,
            3,
            4,
            5,
            0,
            1,
            2,
            3,
            4,
            5,
            0,
            1,
            2,
            3,
            4,
            5,
            0,
            1,
            2,
            3,
            4,
            5,
            0,
            1,
            2,
            3,
            4,
            5,
            0,
            1,
            2,
            3,
            4,
            5
        ],
        "stillsAfterTwoIdleRenders": 0,
        "ops": [
            "connect",
            "reorder",
            "set-access-rule",
            "mark-location",
            "replace-room",
            "reorder"
        ],
        "downloads": [
            "set-editor-view-test-21854d21.json",
            "overlay-684a125f.overlay.json",
            "set-editor-view-test-21854d21.apmapping.json"
        ],
        "readouts": [
            "__editorSetOut",
            "__editorSetOverlayOut",
            "__editorSetMappingOut"
        ],
        "surface": [
            "applySet",
            "armedExit",
            "destroy",
            "render",
            "report",
            "rows",
            "runReport",
            "selectRoom",
            "selected",
            "view"
        ],
        "said": [
            "CONNECT is ARMED — click the SOURCE room on the strip, then the TARGET. ⚠ Escape disarms.",
            "CONNECT — source is room 0; pick WHICH exit in the list, then click the TARGET room (its RETURN DOOR is the ordinal beside the list). ⚠ Escape disarms.",
            "connect room 0 exit 0 ↔ room 3 exit 0, arriving at (128, 128)",
            "reorder 6 rooms to [0, 1, 3, 2, 4, 5]",
            "set the access rule on exit:out_teleporter_128_128 in room 0 to Reachable",
            "mark room 0 <teleporter> at (128, 128) as location \"a coin\" holding Coin",
            "the room session on room 1 was CLOSED into the SET — 1 room edit(s) became ONE `replace-room`",
            "reorder 6 rooms to [0, 1, 2, 4, 3, 5]"
        ]
    });

describe('⛔⛔ EDITOR v3 E2b — the lift is BYTE-INERT on Seedling, and it is PINNED', () => {
    /**
     * ⛓⛓⛓ THE WHOLE CAPTURE, IN ONE COMPARISON. ⛔ MUTANT: any of the eight
     * below, and this row is the one that catches a ninth nobody thought of.
     */
    it('the fixed op script reproduces the PRE-LIFT capture in full', () => {
        expect(runScript(seedlingHarness())).toEqual(PIN);
    });

    /**
     * ⛓ MUTANT: `renumberDecision` computed AFTER the op instead of before —
     * the decision then reads the room session against the NEW numbering and
     * the discard sentence names the wrong room (or does not fire at all).
     */
    it('§21.5 — a renumbering DISCARDS an edited room session, loudly and by name', () => {
        const out = runScript(seedlingHarness());
        const discard = out.steps.find((x) => x.what.startsWith('MOVE UP with room 2'));
        expect(discard.note).toBe(PIN.steps.find((x) => x.what.startsWith('MOVE UP with room 2')).note);
        expect(discard.note).toContain('DISCARDED');
    });

    /**
     * ⛓⛓ MUTANT: `roomCount()` reads `record().set.rooms.length` instead of
     * `adapterFns.bounds(record()).w`. Seedling is unmoved (the two agree), so
     * THIS row cannot see it — the MAZE binding below is where it reds, and
     * that asymmetry is the whole reason the second binding exists.
     */
    it('the rooms table, the strip note and the identity line are unchanged', () => {
        const out = runScript(seedlingHarness());
        expect(out.dom.rooms).toEqual(PIN.dom.rooms);
        expect(out.dom.identity).toBe(PIN.dom.identity);
        expect(out.dom.note).toBe(PIN.dom.note);
    });

    /**
     * ⛓ MUTANT: `forms.manifestRows`/`roomRows` re-derived per render instead
     * of once at mount, or the `named_rooms` keys read off the JSON schema
     * rather than off `levelSetValidator.NAMED_ROOMS` (§21.7) — the rows move.
     */
    it('both FORMS keep their shape, their ids and their values', () => {
        const out = runScript(seedlingHarness());
        expect(out.dom.manifest).toEqual(PIN.dom.manifest);
        expect(out.dom.roomForm).toEqual(PIN.dom.roomForm);
    });

    /**
     * ⛔⛔ **AND ONE MUTANT NEITHER BINDING CAN CATCH, SAID RATHER THAN
     * CLAIMED.** `ruleKeys.exit` replaced by the literal `'exit:'` is GREEN on
     * both substrates: ⛓ MEASURED — `mazeSetAdapter.exitRuleKey('')` and
     * `seedlingSetOverlay.exitRuleKey('')` are both `exit:`, because both
     * overlays are built by `createSetOverlay`. The parameter is still the law
     * (E2a's reason stands: a literal reports ZERO inert rules for any
     * substrate that spells it differently), but the two substrates that exist
     * today cannot discriminate it, and a row asserting otherwise would be a
     * claim about a build nobody has. Trap 713's lesson.
     */
    it('the rule targets, their note and the REPORT rows are unchanged', () => {
        const out = runScript(seedlingHarness());
        expect(out.dom.ruleTargets).toEqual(PIN.dom.ruleTargets);
        expect(out.dom.ruleNote).toBe(PIN.dom.ruleNote);
        expect(out.dom.report).toEqual(PIN.dom.report);
        expect(out.dom.reportNote).toBe(PIN.dom.reportNote);
        expect(out.ruleErrors).toBe(PIN.ruleErrors);
    });

    /**
     * ⛓⛓⛓ MUTANT: the two-click gesture emits its `connect` with the ordinals
     * swapped, or `exits.addressOf` drops the `Number.isInteger` guard — the op
     * list or the sentence moves.
     */
    it('the OP LIST and every sentence the mount said are unchanged', () => {
        const out = runScript(seedlingHarness());
        expect(out.ops).toEqual(PIN.ops);
        expect(out.said).toEqual(PIN.said);
    });

    /**
     * ⛓⛓ MUTANT: `stillKey(cell)` defaults to something fresh per call (an
     * object literal, or the index) — `stillsAfterTwoIdleRenders` stops being 0
     * and every re-render redraws all six rooms.
     */
    it('the stills cache HITS across a re-render of an unedited set', () => {
        const out = runScript(seedlingHarness());
        expect(out.stills).toEqual(PIN.stills);
        expect(out.stillsAfterTwoIdleRenders).toBe(0);
        expect(PIN.stillsAfterTwoIdleRenders).toBe(0);
    });

    /**
     * ⛓⛓ MUTANT: the readout roster shrinks, or a member writes to a global
     * the `-arm` gate does not read. ⛔ The DOWNLOAD note is pinned with it,
     * because the note is what names the members a person actually got.
     */
    it('the DOWNLOAD writes the same three blobs, the same readouts and the same note', () => {
        const out = runScript(seedlingHarness());
        expect(out.downloads).toEqual(PIN.downloads);
        expect(out.readouts).toEqual(PIN.readouts);
        expect(out.steps.at(-1).note).toBe(PIN.steps.at(-1).note);
    });

    /**
     * ⛓⛓⛓ **THE ROW E2b LEFT SO THE FIX COULD NOT BE SILENT — FLIPPED, NOT
     * DELETED** (EDITOR v3 E3a, §31.1 #3, trap 722).
     *
     * The strip's `⛔embed` label was drawn behind `typeof xml !== 'string'`,
     * and `xml` had been an UNDECLARED free variable since E1b replaced the
     * room's `xml` with its `source`. `typeof <undeclared>` is `'undefined'` and
     * never throws, so the test was TRUE on every pass and EVERY room carried
     * the label whether it drew a still or not — six labels against six `L${i}`
     * captions, measured here.
     *
     * ⛔⛔ **AND THE SUBJECT IS WHAT MAKES THIS A MEASUREMENT.** The committed
     * vanilla fixture is 116 rooms and ALL 116 ARE `embed`s, so on that document
     * the badge is under every room BOTH before and after the fix and a row over
     * it would be green for the wrong reason. This harness's set is GENERATED —
     * every room `record`-sourced (E1b, §22.8) — which is the document where the
     * two builds differ: six badges before, ZERO after.
     * ⛓ MUTANT: key the badge on `typeof xml` again, or bind `sourceKind` to a
     * constant `'embed'` — this row goes red on the first expectation.
     */
    it('⛓ the `⛔embed` badge is drawn on EMBED rooms only — ZERO on a generated set', () => {
        const h = seedlingHarness();
        runScript(h);
        const calls = $(h, 'editSetOverview').calls;
        const labels = calls.filter((c) => c.startsWith('fillText(⛔embed'));
        const captions = calls.filter((c) => c.startsWith('fillText(L'));
        const drew = calls.filter((c) => c.startsWith('drawImage('));
        expect(captions.length).toBeGreaterThan(0);
        expect(drew.length).toBeGreaterThan(0);
        // ⛓ every room of this set is `record`-sourced, and none is an embed
        expect(h.session.record().set.rooms
            .map((r) => roomSourceKind(r.source))).toEqual(Array(6).fill('record'));
        expect(labels.length).toBe(0);
    });

    /**
     * ⛓⛓ **AND ON ROOMS THAT REALLY ARE EMBEDS THE BADGE IS STILL DRAWN** — the
     * fix is a CONDITION, not a deletion. ⛔ This is the half the row above
     * cannot see on its own: a `sourceKind` bound to a constant `'record'`, or
     * a badge simply removed, would pass *"zero on a generated set"* and lose
     * the label for ever. ⛓ EXACTLY the embed rooms, by index — a count alone
     * cannot tell six badges spread over the right two rooms from six over the
     * wrong ones.
     */
    it('⛓ …and EXACTLY the `embed` rooms carry it — by index, not by count', () => {
        const h = seedlingHarness({ embeds: [0, 3] });
        // ⛔ ONE render's worth of calls: the mount renders twice on its way up
        //   (`render()` then `selectRoom(0)`), and a count over the accumulated
        //   log would be a multiple of the answer rather than the answer.
        const calls = $(h, 'editSetOverview').calls;
        calls.length = 0;
        h.ui.render();
        expect(h.session.record().set.rooms.map((r) => roomSourceKind(r.source)))
            .toEqual(['embed', 'record', 'record', 'embed', 'record', 'record']);
        /**
         * ⛓ THE BADGE'S `x` IS THE CELL'S — `paintStrip` draws it at
         * `x + 4` where `x = i * cellPx`, and the caption `L${i}` is drawn at
         * the same `x + 4`. So the rooms that carry a badge are the rooms whose
         * caption shares its x, and THAT is an index claim rather than a count.
         */
        const xOf = (c) => Number(c.slice(c.indexOf(',') + 1, c.lastIndexOf(',')));
        const badgeX = calls.filter((c) => c.startsWith('fillText(⛔embed')).map(xOf);
        const captionX = new Map(calls.filter((c) => c.startsWith('fillText(L'))
            .map((c) => [xOf(c), Number(c.slice('fillText(L'.length, c.indexOf(',')))]));
        expect(badgeX.length).toBe(2);
        expect([...new Set(badgeX.map((x) => captionX.get(x)))].sort()).toEqual([0, 3]);
    });

    /**
     * ⛓⛓⛓ **THE KEYDOWN STOPPER IS STILL ON THE STRIP** (§21.5). ⛔ MUTANT: the
     * `mine.on(overview, 'keydown', …)` line is dropped in the move — a key
     * pressed on the strip then BUBBLES to the document, both undo rows run on
     * one press, and a reader cannot tell which session answered.
     * ⚠ The fake DOM deliberately does NOT bubble (the PIN was captured against
     * it, and adding bubbling would move every click through the rooms table),
     * so what this row measures is the CALL: the handler exists and it calls
     * `stopPropagation` on the event it is handed.
     */
    it('§21.5 — a keydown on the strip is STOPPED before it can reach the document', () => {
        const h = seedlingHarness();
        const overview = $(h, 'editSetOverview');
        let stopped = 0;
        overview.dispatch('keydown', {
            key: 'z', ctrlKey: true, stopPropagation: () => { stopped += 1; }, preventDefault: () => {},
        });
        expect(stopped).toBe(1);
    });

    /**
     * ⛓ MUTANT: `mountWatchSetEditor` re-exports `mountSetEditor` by the SAME
     * object instead of binding it — then it takes `mountSetEditor`'s options,
     * refuses `adapterFns` by name at the page's own call site, and the surface
     * below never exists. The surface is D2's.
     */
    it('the wrapper returns D2\'s own surface, and is NOT the core\'s function', () => {
        expect(mountWatchSetEditor).not.toBe(mountSetEditor);
        expect(() => mountSetEditor({
            lifetime: createLifetime('x'), session: {}, adapter: {}, compileRegionAtlas: () => {},
        })).toThrow(/`document` is required/);
        expect(runScript(seedlingHarness()).surface).toEqual(PIN.surface);
        expect(PIN.surface).toEqual([
            'applySet', 'armedExit', 'destroy', 'render', 'report', 'rows',
            'runReport', 'selectRoom', 'selected', 'view',
        ]);
    });
});


/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 E3a — **`fillExitSelect` KEEPS ITS VALUE** (§31.1 #4)
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ EDITOR v3 E3a — the exit list preserves its selection, as the ordinal list does', () => {
    /** ⛓ The `<option>` VALUES of a select, in order — `rowsOf` gives
     *  `value=label`, and what a gesture reads back is the value. */
    const valuesOf = (h, id) => (rowsOf(h, id) ?? []).map((r) => r.slice(0, r.indexOf('=')));
    /**
     * ⛓ THE ROOM WITH THE MOST EXITS — DERIVED, never a literal index. The set
     * is a generated CHAIN, so its end rooms have ONE exit and a row that
     * hard-coded room 0 would be asserting the shape of the linker's output.
     */
    const widestRoom = (h) => h.ui.rows()
        .reduce((best, r) => ((r.exits ?? 0) > (best.exits ?? 0) ? r : best)).index;

    /**
     * ⛔⛔ **D2's ASYMMETRY, NAMED IN §30.12 #1 AND MEASURED HERE.**
     * `fillOrdinalSelect` preserved its value across a render and this one did
     * not, so a value chosen before the first click of the CONNECT gesture was
     * gone by the second — and E2c's browser row had to pick the exit BETWEEN
     * the two clicks to work at all.
     *
     * ⛓⛓ MUTANT: drop the `keep`/restore pair from `fillExitSelect` — the
     * value falls back to the FIRST option and this row goes red.
     * ⚠ It could only go red once the fake `<select>`s became `<select>`s: a
     * `div`'s `value` is an ordinary property that survives `innerHTML = ''`,
     * which is exactly why node saw nothing while the browser row worked around
     * it (⚖ a fixture only gates a change it can DISTINGUISH).
     */
    it('the chosen exit SURVIVES a render that does not change the list', () => {
        const h = seedlingHarness();
        h.ui.selectRoom(widestRoom(h));
        const values = valuesOf(h, 'editSetExitList');
        expect(values.length).toBeGreaterThan(1);
        setValue(h, 'editSetExitList', values[1]);
        h.ui.render();
        expect($(h, 'editSetExitList').value).toBe(values[1]);
        // …and again, over an op that leaves room 0's exits alone
        click(h, 'editSetReport');
        expect($(h, 'editSetExitList').value).toBe(values[1]);
        expect(valuesOf(h, 'editSetExitList')).toEqual(values);
    });

    /**
     * ⛓⛓⛓ **A ROOM CHANGE DOES NOT CARRY THE VALUE ACROSS, AND THAT IS WHY
     * THIS IS NOT `fillOrdinalSelect`'s THREE LINES COPIED.** The ordinal list
     * is the SET's distinct target exits and does not depend on the selection;
     * this list IS *"the selected room's exits"*, so a value preserved across a
     * room change would be an exit id belonging to a different room.
     */
    it('…but a change of ROOM refills from scratch — the list is the SELECTED room\'s', () => {
        const h = seedlingHarness();
        const wide = widestRoom(h);
        h.ui.selectRoom(wide);
        const room0 = valuesOf(h, 'editSetExitList');
        setValue(h, 'editSetExitList', room0[room0.length - 1]);
        h.ui.selectRoom(wide === 0 ? 1 : 0);
        const room1 = valuesOf(h, 'editSetExitList');
        expect($(h, 'editSetExitList').value).toBe(room1[0]);
        expect(h.said.some((x) => /no longer on room/.test(x.text))).toBe(false);
    });

    /**
     * ⛔⛔ **AND A VANISHED SELECTION FALLS BACK *AND SAYS SO*.** A `disconnect`
     * deletes the very door a person picked; falling back to the first option in
     * silence would leave the next press addressing an exit nobody chose.
     * ⛓ Said through `say`, never `setNote` — the note is where the op that
     * removed it is explaining itself.
     */
    it('a render that REMOVES the chosen exit falls back to the first, and SAYS so', () => {
        const h = seedlingHarness();
        const wide = widestRoom(h);
        h.ui.selectRoom(wide);
        const before = valuesOf(h, 'editSetExitList');
        expect(before.length).toBeGreaterThan(1);
        setValue(h, 'editSetExitList', before[before.length - 1]);
        click(h, 'editSetDisconnect');
        const after = valuesOf(h, 'editSetExitList');
        expect(after.length).toBe(before.length - 1);
        expect(after).not.toContain(before[before.length - 1]);
        expect($(h, 'editSetExitList').value).toBe(after[0]);
        const fell = h.said.filter((x) => new RegExp(`no longer on room ${wide}`).test(x.text));
        expect(fell.length).toBe(1);
        expect(fell[0].bad).toBe(true);
        // ⛔ …and it is said ONCE: the next render's kept value is a live one
        h.ui.render();
        expect(h.said.filter((x) => /no longer on room/.test(x.text)).length).toBe(1);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 E3a — **ONE ORDERING RULE FOR `onSetChange`** (§31.1 #1)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ A RECORDING PAGE. ⛔ The DOM is read INSIDE the callback, which is the
 * whole point: what §30.8 measured was not *"the readout is wrong"* but
 * *"the readout is written at the wrong MOMENT"*, and only a probe that looks
 * at that moment can tell the two builds apart.
 */
const recordingHarness = () => {
    const seen = [];
    let H = null;
    const h = seedlingHarness({
        onSetChange: (arg) => seen.push({
            why: arg?.why ?? null,
            arg,
            rooms: H === null ? null : rowsOf(H, 'editSetRooms'),
            note: H === null ? null : textOf(H, 'editSetNote'),
            identity: H === null ? null : textOf(H, 'editSetIdentity'),
            report: H === null ? null : rowsOf(H, 'editSetReportOut'),
            closeDisabled: H === null ? null : ($(H, 'editRoomClose')?.disabled ?? null),
        }),
    });
    H = h;
    h.seen = seen;
    return h;
};

describe('⛓⛓⛓ EDITOR v3 E3a — the mount renders FIRST, then tells the page why', () => {
    /**
     * ⛔⛔⛔ **THE DEFECT, AS A ROW.** Before E3a the applied-op path was
     * `onChange: ({result}) => { if (applied) { stills.clear(); onSetChange?.(); } render(); }`
     * — the page was told BEFORE the mount had re-rendered, so a snapshot
     * written from the callback carried the PREVIOUS op's rooms table. MEASURED
     * on `lab.html` (§30.8): `set.links` read 1 off the session while a `strip`
     * field read `linkedFrom: [0,0,0,0]`, one op behind.
     *
     * ⛓⛓ MUTANT: move `onSetChange?.({why: 'op'})` back inside the `applied`
     * branch, above `render()` — the recorded "links here" column becomes the
     * PRE-op one and this row goes red on the first expectation.
     */
    it('the applied-op callback sees the rooms table ALREADY carrying the new link', () => {
        const h = recordingHarness();
        const linksColumn = (rows) => rows.slice(1).map((r) => r.split('\n')[0]);
        const before = rowsOf(h, 'editSetRooms');
        click(h, 'editSetGesture');
        setValue(h, 'editSetExitList', '0');
        setValue(h, 'editSetTargetExit', '0');
        clickRoom(h, 0, 6);
        clickRoom(h, 3, 6);
        const op = h.seen.filter((c) => c.why === 'op');
        expect(op.length).toBe(1);
        // the callback's own view of the table IS the post-render one …
        expect(op[0].rooms).toEqual(rowsOf(h, 'editSetRooms'));
        // … and it is NOT the table as it stood before the op landed.
        expect(op[0].rooms).not.toEqual(before);
        expect(linksColumn(op[0].rooms)).not.toEqual(linksColumn(before));
    });

    /**
     * ⛓⛓⛓ **THE `why` ROSTER IS A CONTRACT, AND IT IS EXPORTED.** ⛔ MUTANT:
     * the roster SHRINKS (a value is dropped from `SET_CHANGE_WHY`, or a call
     * site stops passing one) — the second expectation names exactly which.
     */
    it('`SET_CHANGE_WHY` is the SIX reasons, and every call site passes one of them', () => {
        expect(SET_CHANGE_WHY)
            .toEqual(['op', 'report', 'close', 'select', 'room', 'download']);
        const h = recordingHarness();
        runScript(h);
        click(h, 'editSetReport');
        h.ui.selectRoom(0);
        expect(h.seen.length).toBeGreaterThan(0);
        for (const c of h.seen) expect(SET_CHANGE_WHY).toContain(c.why);
        click(h, 'editSetRowOpen_0');
        expect([...new Set(h.seen.map((c) => c.why))].sort())
            .toEqual(['close', 'download', 'op', 'report', 'room', 'select']);
    });

    /**
     * ⛓⛓⛓ **THE OPEN BUTTON'S OWN HOLE, FOUND BY APPLYING THE RULE.** The rooms
     * table's OPEN runs `selectRoom` · the PAGE's `openRoomAt` · the mount's
     * `render()`, so the page re-rendered ITSELF one step before the identity
     * line and `#editRoomClose` caught up. ⛔ CLOSE always had a notification
     * and OPEN never did — one control apart, opposite behaviours.
     * ⛓ MUTANT: drop `onSetChange?.({why: 'room'})` — the roster row above goes
     * red and this one reports `[]`.
     */
    it('the OPEN button notifies with `why: \'room\'`, after the identity line moved', () => {
        const h = recordingHarness();
        h.seen.length = 0;
        click(h, 'editSetRowOpen_1');
        const room = h.seen.filter((c) => c.why === 'room');
        expect(room.length).toBe(1);
        expect(room[0].identity).toMatch(/ROOM 1 open with 1 edit\(s\)/);
        expect(room[0].closeDisabled).toBe(false);
    });

    /**
     * ⛔⛔ **THE SEAM'S OTHER FACE** (§30.7): the REPORT press ran `runReport()`
     * and the mount's own `render()` and told the page NOTHING, so a page could
     * only publish a verdict one press stale. ⛓ MUTANT: drop the
     * `onSetChange?.({why: 'report'})` — `report.length` is 0 and this row goes
     * red without any other row moving.
     */
    it('the REPORT press notifies, and the report box is already filled at that moment', () => {
        const h = recordingHarness();
        click(h, 'editSetReport');
        const report = h.seen.filter((c) => c.why === 'report');
        expect(report.length).toBe(1);
        expect(report[0].report.length).toBeGreaterThan(0);
        expect(report[0].report).toEqual(rowsOf(h, 'editSetReportOut'));
        // the mount's own `report()` is what a page publishes, and it is current
        expect(h.ui.report().rows.map((r) => `[${r.kind}] ${r.text}`))
            .toEqual(rowsOf(h, 'editSetReportOut'));
    });

    /**
     * ⛓ CLOSE ALREADY FIRED AFTER ITS RENDER and still fires exactly ONCE —
     * the ordering rule did not turn one press into two notifications. ⛔ And
     * the callback sees `#editRoomClose` ALREADY disabled, which is the mount
     * state a page would publish as *"no room open"*.
     */
    it('CLOSE fires once, with `why: \'close\'`, after the button went disabled', () => {
        const h = recordingHarness();
        h.openRoom(1);
        h.ui.render();
        h.seen.length = 0;
        click(h, 'editRoomClose');
        const close = h.seen.filter((c) => c.why === 'close');
        expect(close.length).toBe(1);
        expect(close[0].closeDisabled).toBe(true);
        expect(close[0].identity).toMatch(/no room open/);
    });

    /**
     * ⛓⛓ **`select` FIRES ON A MOVE AND ONLY ON A MOVE**, and never at mount.
     * ⛔ The mount ends with `selectRoom(0)` while `selected` is already 0; an
     * unguarded notification there would reach a page whose own `setUi` handle
     * is still unassigned — the mount-time call that hits the TDZ.
     */
    it('`select` fires only when `selected` actually moves, and never during mount', () => {
        const h = recordingHarness();
        expect(h.seen).toEqual([]);
        h.ui.selectRoom(3);
        expect(h.seen.map((c) => c.why)).toEqual(['select']);
        h.ui.selectRoom(3);
        expect(h.seen.map((c) => c.why)).toEqual(['select']);
        h.ui.selectRoom(99);
        expect(h.seen.map((c) => c.why)).toEqual(['select']);
        h.ui.selectRoom(1);
        expect(h.seen.map((c) => c.why)).toEqual(['select', 'select']);
    });

    /**
     * ⛓⛓⛓ **THE RENUMBERING PATH RENDERS AGAIN BEFORE IT NOTIFIES.**
     * `view.apply` fires `onChange` INSIDE the op — before the decision
     * discards the open room session — so the first notification's
     * `#editRoomClose` still reads "a room is open". ⛔ The SECOND one, after
     * the decision, is the one a page can trust, and E3a is what puts a
     * `render()` in front of it. MUTANT: drop that `render()` — the last
     * callback still reports the discarded room session as open.
     */
    it('a renumbering that DISCARDS the open room notifies with the mount already current', () => {
        const h = recordingHarness();
        h.openRoom(2);
        h.ui.render();
        h.seen.length = 0;
        click(h, 'editSetRowUp_3');
        expect(h.seen.length).toBe(2);
        expect(h.seen.every((c) => c.why === 'op')).toBe(true);
        expect(h.seen[0].closeDisabled).toBe(false);
        expect(h.seen.at(-1).closeDisabled).toBe(true);
        expect(h.seen.at(-1).identity).toMatch(/no room open/);
        expect(h.seen.at(-1).note).toMatch(/DISCARDED/);
    });

    /**
     * ⛓ EVERY DOWNLOAD PRESS IN THE FAMILY NOTIFIES, and says `download`. ⛔ The
     * SET press already did and the rules press did not — one family, two
     * behaviours, which is the asymmetry item 1 exists to end.
     */
    it('the SET download and the rules download BOTH notify with `why: \'download\'`', () => {
        const h = recordingHarness();
        click(h, 'editSetReport');
        h.seen.length = 0;
        click(h, 'editDownloadSet');
        expect(h.seen.map((c) => c.why)).toEqual(['download']);
        const rulesBtn = $(h, 'editDownloadRules');
        if (!rulesBtn.disabled) {
            h.seen.length = 0;
            click(h, 'editDownloadRules');
            expect(h.seen.map((c) => c.why)).toEqual(['download']);
        }
        expect(h.downloads.length).toBeGreaterThan(0);
    });
});


/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SECOND BINDING — THE SAME MOUNT, OVER `mazeSetAdapter`, WITH
 *   NO PAGE. E2c's `lab.html` arm rests on exactly this.
 * ══════════════════════════════════════════════════════════════════════ */

const MAZE_LIB = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../region-libraries/demo-maze-pack.json', import.meta.url)), 'utf8'));

/**
 * ⛓ **THE MAZE'S BINDINGS — `mazeSetLab.mazeSetBindings`, AND THIS FILE NO
 * LONGER OWNS THEM.** ⛔ The wrapper stays so the ten rows below read exactly as
 * they did before the move: what they assert is the mount's behaviour OVER this
 * binding, and rewriting them at the same time as the code under them would
 * have made the move unverifiable.
 *
 * ⚠ `drawRoomStill` is left `null` here and STUBBED by the harness — the claim
 * these rows make is *which room the mount asked for*, not what it looked like.
 * `mazeSetLab.test.js` drives the REAL one against a recording context.
 */
const mazeBindings = (rulesSchema) => mazeSetBindings({ rulesSchema });

const mazeHarness = ({ overlay = emptyMazeOverlay(), loadZip = null, extraMember = null } = {}) => {
    for (const k of READOUT_NAMES) delete globalThis[k];
    const adapter = createMazeSetAdapter({ rulesSchema: DEPS.rulesSchema });
    const record = mazeSetRecord(MAZE_LIB, overlay);
    const session = createMazeSetSession(adapter, record);
    const doc = new FakeDocument();
    const said = [];
    const downloads = [];
    const stillCalls = [];
    let open = null;
    const ui = mountSetEditor({
        lifetime: createLifetime('setEditorView.test.maze'),
        session,
        adapter,
        deps: {},
        compileRegionAtlas,
        validateRegionAtlas,
        atlasSchema: ATLAS_SCHEMA,
        ...(() => {
            const b = mazeBindings(DEPS.rulesSchema);
            if (!extraMember) return b;
            /** ⛓ ONE EXTRA MEMBER, to drive the by-name refusal path. */
            const inner = b.adapterFns.download;
            return {
                ...b,
                adapterFns: {
                    ...b.adapterFns,
                    download: (s) => {
                        const out = inner(s);
                        return { ...out, members: [...out.members, extraMember] };
                    },
                },
            };
        })(),
        /** ⛓ A RECORDING STILL — E2c points this at `mazeRoomRender.drawWorld`. */
        drawRoomStill: (canvas, cell, index) => {
            stillCalls.push({ index, width: cell.payload.width, height: cell.payload.height });
            canvas.width = 32;
            canvas.height = 32;
            return null;
        },
        say: (text, bad) => said.push({ text, bad: Boolean(bad) }),
        roomSession: () => open,
        openRoomAt: () => false,
        discardRoom: () => { open = null; },
        download: (name, text) => downloads.push({ name, bytes: String(text).length }),
        loadZip,
        doc,
    });
    return {
        adapter,
        session,
        doc,
        said,
        downloads,
        stillCalls,
        ui,
        openRoom: (room, ops = 1) => { open = { room, ops, session: { record: () => null } }; },
    };
};

/** ⛓ The 4-link RING over the demo pack, built through the adapter's own op. */
const RING = Object.freeze([
    { from: [0, 'exit_1'], to: [1, 'exit_3'] },
    { from: [1, 'exit_1'], to: [2, 'exit_3'] },
    { from: [2, 'exit_1'], to: [3, 'exit_3'] },
    { from: [3, 'exit_1'], to: [0, 'exit_3'] },
]);

const connectAll = (h, links) => links.map((l) => h.ui.applySet({
    op: 'connect', from: l.from, to: l.to, one_way: false,
}));

describe('⛓⛓⛓ EDITOR v3 E2b — the SAME mount, bound to `mazeSetAdapter`, with no page', () => {
    /**
     * ⛓⛓⛓ **THE MUTANT THIS BINDING EXISTS TO CATCH.** `roomCount()` reading
     * `record().set.rooms.length` is GREEN over Seedling for ever and THROWS
     * here — a maze record has no `set` key at all. The Seedling pin cannot see
     * it; this row is the whole reason the second binding is not optional.
     */
    it('the STRIP is four rooms, and every one drew a still', () => {
        const h = mazeHarness();
        expect(h.ui.rows()).toHaveLength(4);
        expect(h.ui.rows().map((r) => r.name)).toEqual(
            MAZE_LIB.entries.map((e) => e.name));
        expect(h.stillCalls.slice(0, 4).map((c) => c.index)).toEqual([0, 1, 2, 3]);
        expect(h.stillCalls[0]).toMatchObject({ width: 11, height: 11 });
    });

    /**
     * ⛓⛓ MUTANT: `exitsOfRoom`'s overlay JOIN is dropped — `row.exitList[].to`
     * is `null` everywhere and `exitArrowShapes` draws nothing, on a library
     * whose links are the WHOLE graph.
     */
    /**
     * ⛓⛓ **AND THE `⛔embed` BADGE IS DRAWN ON NONE OF THEM** (EDITOR v3 E3a,
     * trap 722). A region-library entry carries its captured world INLINE as
     * `payload`, so `mazeSetBindings.sourceKind` answers `'record'` for every
     * one and the strip has no reason to warn about anything. ⛔ E2b shipped
     * this badge under all FOUR maze rooms, because the condition read an
     * undeclared `xml` and `typeof <undeclared>` is `'undefined'`.
     * ⛓ The CAPTIONS are counted beside it: a row that only asserted "no
     * badges" would be green over a strip that drew nothing at all.
     */
    it('⛓ NO room carries the `⛔embed` badge — the maze has no embeds at all', () => {
        const h = mazeHarness();
        const calls = $(h, 'editSetOverview').calls;
        calls.length = 0;
        h.ui.render();
        expect(calls.filter((c) => c.startsWith('fillText(L')).length)
            .toBe(MAZE_LIB.entries.length);
        expect(calls.filter((c) => c.startsWith('fillText(⛔embed')).length).toBe(0);
    });

    it('the ARROWS are `exitArrowShapes` over the JOINED exits — none, then two', () => {
        const h = mazeHarness();
        expect(exitArrowShapes(h.ui.rows(), { selected: 0 })).toHaveLength(0);
        connectAll(h, RING.slice(0, 2));
        const shapes = exitArrowShapes(h.ui.rows(), { selected: 0 });
        expect(shapes.length).toBeGreaterThan(0);
        expect(h.ui.rows()[0].exitList.filter((e) => e.to !== null).map((e) => e.to))
            .toEqual([1]);
        expect(h.ui.rows()[1].exitList.filter((e) => e.to !== null).map((e) => e.to).sort())
            .toEqual([0, 2]);
    });

    /**
     * ⛓⛓⛓ **THE TWO-CLICK GESTURE EMITS ONE `connect`, ENDPOINT-ADDRESSED.**
     * ⛔ MUTANT: `exits.addressOf` coerces with `Number()` (Seedling's spelling)
     * — every endpoint becomes `NaN` and `connect` refuses by name, listing the
     * exits the entry really has.
     */
    it('the two-click gesture lands ONE `connect` whose endpoints are [room, exit_id]', () => {
        const h = mazeHarness();
        click(h, 'editSetGesture');
        setValue(h, 'editSetExitList', 'exit_1');
        setValue(h, 'editSetTargetExit', 'exit_3');
        clickRoom(h, 0, 4);
        clickRoom(h, 1, 4);
        expect(h.session.ops()).toHaveLength(1);
        expect(h.session.ops()[0]).toEqual({
            op: 'connect', from: [0, 'exit_1'], to: [1, 'exit_3'], one_way: false,
        });
        expect(h.session.record().overlay.links).toHaveLength(1);
    });

    /**
     * ⛓ MUTANT: the exit `<option>`'s value is built by one binding and read
     * back by another — the select offers `exit_1` and the op carries `0`.
     */
    it('the exit SELECT offers `exit_id`s and the target list is the DISTINCT set', () => {
        const h = mazeHarness();
        expect(rowsOf(h, 'editSetExitList')).toEqual([
            'exit_0=exit_0 (N) → unlinked', 'exit_1=exit_1 (E) → unlinked',
            'exit_2=exit_2 (S) → unlinked', 'exit_3=exit_3 (W) → unlinked',
        ]);
        expect(rowsOf(h, 'editSetTargetExit')).toEqual([
            'exit_0=exit_0', 'exit_1=exit_1', 'exit_2=exit_2', 'exit_3=exit_3',
        ]);
    });

    /**
     * ⛓⛓⛓ §21.5's third rule, on the SECOND substrate — ⛔ MUTANT:
     * `renumberDecision` computed AFTER the op, or the decision not routed at
     * all: the note stops being `bad` and the room session survives a
     * renumbering that moved the room out from under its index.
     */
    it('MOVE UP with an edited room session open DISCARDS it, and the note is `bad`', () => {
        const h = mazeHarness();
        h.openRoom(2, 1);
        h.ui.render();
        click(h, 'editSetRowUp_2');
        const note = $(h, 'editSetNote');
        expect(note.textContent).toContain('DISCARDED');
        expect(note.className).toBe('note bad');
        expect(h.session.ops().map((o) => o.op)).toEqual(['reorder']);
    });

    /**
     * ⛓⛓⛓ **THE REPORT REFUSES AN UNCLOSED GRAPH BY NAME AND ALLOWS A CLOSED
     * ONE.** ⛔ MUTANT: `document` not threaded through to `reportOver` — §1 of
     * the verdict names `validateLevelSet` and a `set`, over a library.
     */
    it('the REPORT refuses an UNCLOSED graph by name and allows the 4-link ring', () => {
        const two = mazeHarness();
        connectAll(two, RING.slice(0, 2));
        const r2 = two.ui.runReport();
        expect(r2.download.rules.allowed).toBe(false);
        expect(r2.download.rules.why).toMatch(/cannot be reached from the start/);
        expect(r2.rows.some((row) => /validateRegionLibrary: ok/.test(row.text))).toBe(true);
        // ⛓ the row's KIND is the DOCUMENT's, so §1 of the verdict cannot be
        //   about a level set on a substrate that has none.
        expect(r2.rows.some((row) => row.kind === 'region-library')).toBe(true);
        expect(r2.rows.some((row) => row.kind === 'level-set')).toBe(false);

        const four = mazeHarness();
        connectAll(four, RING);
        const r4 = four.ui.runReport();
        expect(r4.download.rules.allowed).toBe(true);
        expect(r4.rows.filter((row) => row.severity === 'error')).toEqual([]);
    });

    /**
     * ⛓ MUTANT: the identity line reads `record().set.set_id` — `undefined` on
     * a library, printed as `(unstamped)` over a document that IS stamped.
     */
    it('the IDENTITY line prints `library_id` and the document NOUN', () => {
        const h = mazeHarness();
        const line = textOf(h, 'editSetIdentity');
        expect(line.startsWith(`LIBRARY ${MAZE_LIB.library_id} · overlay (unstamped)`)).toBe(true);
        expect(line).toContain('focus it to undo the LIBRARY');
    });

    /**
     * ⛓⛓⛓ **THE DOWNLOAD IS TWO MEMBERS AND A SENTENCE ABOUT THE THIRD.**
     * ⛔ MUTANT: `apMappingWhy` dropped — a person reads two files where
     * Seedling gives three and nothing says a region library has no vanilla
     * mapping to invalidate (E2a's §26.6: an empty companion would read as
     * "checked, nothing to say").
     */
    it('the DOWNLOAD writes library + overlay, and PRINTS `apMappingWhy`', () => {
        const h = mazeHarness();
        connectAll(h, RING);
        click(h, 'editDownloadSet');
        expect(h.downloads.map((d) => d.name.replace(/-[0-9a-f]{8}/g, '-<hash>'))).toEqual([
            'demo-maze-pack-<hash>.json', 'maze-overlay-<hash>.overlay.json',
        ]);
        const note = textOf(h, 'editSetNote');
        expect(note).toMatch(/^DOWNLOADED demo-maze-pack-[0-9a-f]{8} · overlay maze-overlay-/);
        expect(note).toContain('ONE stamp for 4 edit(s)');
        expect(note).toContain('a region library has no VANILLA mapping to invalidate');
        expect(READOUT_NAMES.filter((k) => globalThis[k] !== undefined))
            .toEqual(['__editorSetOut', '__editorSetOverlayOut']);
    });

    /**
     * ⛓⛓⛓ **THE BUNDLE CARRIES THE LIBRARY — THIS ROW FLIPPED IN E2c's FIRST
     * COMMIT.** Until then `BUNDLE_KINDS` was `rules, level-set, overlay,
     * region-atlas` and the mount refused the maze's own PRIMARY document by
     * name, quoting that roster (§28.9: the flip has to be a deliberate edit and
     * not a silence). ⛔ The `region-library` kind is `documentBundle`'s now —
     * one predicate and one entry, §25.12 #1 — so the four documents a person
     * pressing this button has are library · overlay · rules · region-atlas,
     * and NOTHING is refused.
     *
     * ⛔ MUTANT (still live): the button pushes an unknown kind silently —
     * `writeBundle` then either throws about a document the reader never named
     * or writes a zip missing the very document the press was for. The refusal
     * PATH is still asserted, one row down, against a kind that really is not a
     * member.
     */
    it('the BUNDLE button carries `region-library` · overlay · rules · region-atlas', async () => {
        const h = mazeHarness({ loadZip: async () => loadJSZipNode() });
        connectAll(h, RING);
        h.ui.runReport();
        click(h, 'editDownloadBundle');
        for (let i = 0; i < 200 && globalThis.__editorSetBundleKinds === undefined; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => { setTimeout(r, 5); });
        }
        const note = textOf(h, 'editSetNote');
        expect(BUNDLE_KINDS).toContain('region-library');
        expect(note).not.toContain('is NOT a member');
        expect(globalThis.__editorSetBundleKinds)
            .toEqual(['region-library', 'overlay', 'rules', 'region-atlas']);
        expect(note).toMatch(/^BUNDLED demo-maze-pack-[0-9a-f]{8}\.zip — 4 member\(s\)/);
        // ⛓ the zip's NAME is the primary document's own id — `document.idOf` of
        //   the member whose kind IS the document's kind, derived and not passed.
        expect(h.downloads.at(-1).name).toMatch(/^demo-maze-pack-[0-9a-f]{8}\.zip$/);
    });

    /**
     * ⛓⛓ **AND THE BY-NAME REFUSAL IS STILL THERE, ASSERTED AGAINST A KIND THAT
     * IS REALLY NOT A MEMBER.** ⛔ Without this row, flipping the one above would
     * have DELETED the only witness that an unknown member kind is NAMED rather
     * than dropped — an E1c claim retired by a slice that was only supposed to
     * widen the roster. The subject is `ap-mapping`, the companion §24.12
     * refuses on purpose and which no roster will ever carry.
     */
    it('a member kind OUTSIDE `BUNDLE_KINDS` is still refused BY NAME, quoting the roster', async () => {
        const h = mazeHarness({
            loadZip: async () => loadJSZipNode(),
            extraMember: {
                kind: 'ap-mapping',
                doc: { reason: 'a DERIVED table, regenerated per set' },
                name: 'ap-mapping.json',
                label: 'the apMapping companion',
                whyNotMember: 'it is DERIVED from the set on demand',
            },
        });
        connectAll(h, RING);
        h.ui.runReport();
        click(h, 'editDownloadBundle');
        for (let i = 0; i < 200 && globalThis.__editorSetBundleKinds === undefined; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => { setTimeout(r, 5); });
        }
        const note = textOf(h, 'editSetNote');
        expect(BUNDLE_KINDS).not.toContain('ap-mapping');
        expect(note).toContain('the `ap-mapping` document is NOT a member');
        expect(note).toContain(BUNDLE_KINDS.join(', '));
        expect(note).toContain('it is DERIVED from the set on demand');
        // ⛓ …and the rest still travels: the refusal drops ONE member, not the zip.
        expect(globalThis.__editorSetBundleKinds)
            .toEqual(['region-library', 'overlay', 'rules', 'region-atlas']);
    });

    /**
     * ⛓ MUTANT: `locations.options` reads an OEL entity list — a maze cell has
     * no `entities` and the picker is empty, so `mark-location` can never be
     * pressed on the substrate whose whole location model is the slot ordinal.
     */
    it('the LOCATION picker offers `items[]` ORDINALS, and `mark-location` takes one', () => {
        const h = mazeHarness();
        expect(rowsOf(h, 'editSetLocEntity')).toEqual([
            '0=slot_0 @(0,5)', '1=slot_1 @(8,7)', '2=slot_2 @(1,8)',
        ]);
        setValue(h, 'editSetLocEntity', '1');
        setValue(h, 'editSetLocName', 'the hub chest');
        setValue(h, 'editSetLocItem', 'Coin');
        click(h, 'editSetMarkLocation');
        expect(h.session.ops()).toEqual([{
            op: 'mark-location', room: 0, item: 1, name: 'the hub chest', vanilla_item: 'Coin',
        }]);
    });
});
