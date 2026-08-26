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
import { roomRecordOf } from '../seedlingDemo/levelSetValidator.js';
import { emptyLevel } from '../seedlingDemo/procgenLevel.js';
import { parseOelLevel } from '../seedlingDemo/procgenLevelOel.js';
import { emptyOverlay } from '../seedlingDemo/seedlingSetOverlay.js';
import {
    createSeedlingSetAdapter, createSetSession, setRecord,
} from '../seedlingDemo/seedlingSetAdapter.js';
import { mountWatchSetEditor } from '../seedlingDemo/watchSetEditor.js';

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

class FakeDocument {
    constructor() {
        this.root = new FakeElement(this, 'div');
        this.activeElement = null;
        this.byId = new Map();
        for (const id of PANEL_IDS) {
            const tag = id === 'editSetOverview' ? 'canvas'
                : (id.startsWith('editSetRule') && id.endsWith('Json') ? 'textarea' : 'div');
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

const seedlingHarness = ({ rooms = ROOMS } = {}) => {
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
    const record = setRecord(generatedSet(rooms), emptyOverlay());
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
     * ⛓⛓ MUTANT: `ruleKeys.exit` replaced by the literal `'exit:'`. Seedling's
     * prefix IS `exit:`, so this row stays green and the MAZE one does not —
     * said out loud rather than left as a claim this file cannot make.
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
     * ⛓ MUTANT: `mountWatchSetEditor` re-exports `mountSetEditor` by the SAME
     * object instead of binding it — then it takes `mountSetEditor`'s options
     * and the page's call site is silently wrong. The surface is D2's.
     */
    it('the wrapper returns D2\'s own surface', () => {
        expect(runScript(seedlingHarness()).surface).toEqual(PIN.surface);
        expect(PIN.surface).toEqual([
            'applySet', 'armedExit', 'destroy', 'render', 'report', 'rows',
            'runReport', 'selectRoom', 'selected', 'view',
        ]);
    });
});
