/**
 * seedlingDemo/watchSetEditor — **THE SET SESSION, ON THE PAGE — AS BINDINGS.**
 *
 * EDITOR v3 arc, slice D2 (`NewDocs/plans/seedling-editor-v3.md` §16.4, §20.11);
 * ⛓⛓ **SLICE E2b MOVED THE DOM ITSELF** (§27, §28). D1 shipped
 * `seedlingSetAdapter.js` — twelve ops over `{set, overlay}`, the derivation,
 * `rulesJsonOf`, `downloadSet`, `closeRoomSession` — with no DOM at all; D2
 * built the DOM here; E2a moved the substrate-free CALCULATIONS to
 * `procgenCore/setEditorCore.js`; and E2b moved the MOUNT to
 * `procgenCore/setEditorView.js`, because it was already ~90 % substrate-free
 * and `lab.html`'s maze SET arm (E2c) would otherwise have been a 1,000-line
 * copy of it.
 *
 * ⇒ **WHAT IS LEFT HERE IS BINDINGS.** The pure half is re-exported by the same
 * function object (twelve names, the `===` roster below); five names are BOUND
 * over the core; and `mountWatchSetEditor` is the sixth binding — Seedling's
 * readers, its exit ORDINALS, its OEL entity list, its three-document download
 * and its `closeRoomSession`, handed to `mountSetEditor`.
 *
 * ⚠ **THE FIVE THINGS §20.11 CALLED HARD ARE NOW `setEditorView.js`'s**, and
 * the notes below are kept because they say WHY the mount is shaped as it is:
 *
 * ── ⛔⛔ THE FIVE THINGS §20.11 CALLED HARD, AND WHERE EACH ONE LANDED ──
 *
 *  1. **POLYLINES.** Shipped in `procgenCore/editorView.js` this slice; the
 *     overview contributes its arrows through the new `shapes()` door and the
 *     view still owns the overlay.
 *  2. **TWO SESSIONS, AND WHICH ONE `Ctrl+Z` HITS.** The set has its own
 *     `editorView` on the overview strip, mounted with the OVERVIEW CANVAS as
 *     its key target — so the DOM's own focus is the router and there is no
 *     second one. ⛔ A keydown stopper on that canvas is what keeps the two
 *     views from both answering one press (see `mountWatchSetEditor`).
 *     And a renumbering op CLOSES OR DISCARDS an open room session, by
 *     `renumberDecision`, printed either way.
 *  3. **THE OVERLAY IS A THIRD DOCUMENT.** The LOAD box sniffs one by shape and
 *     the identity line prints `overlay_id` beside `set_id`, because a page that
 *     forgets to carry the overlay through a reload silently loses every
 *     location and every authored rule.
 *  4. **`set-access-rule` DERIVES ON EVERY CALL**, so the target list is
 *     computed ONCE PER SELECTION CHANGE (`ruleTargetsOf`) and never per
 *     keystroke. The JSON box checks itself with `ruleSchemaErrors`, which
 *     derives nothing.
 *  5. **THE DOWNLOAD'S ERRORS ARE A LIST**, through D1's additive
 *     `validateForDownload` — measured NOT recoverable from the throw's
 *     ` · `-joined sentence.
 *
 * ── ⚖ THE LAWS THIS FILE KEEPS ───────────────────────────────────────
 *
 *  · **ONE RENDERER.** The overview's room stills are drawn by the PAGE's own
 *    `previewLevel`, injected as `drawRoomStill`; this file blits what it is
 *    handed and draws no substrate of its own.
 *  · **THE PAGE INJECTS.** `compileRegionAtlas` and `validateRegionAtlas` live
 *    in `procgenPipeline/` and are handed in, exactly as `seedlingSetAdapter`
 *    refuses to name a pipeline dependency of its own.
 *  · **EVERY REFUSAL IS PRINTED VERBATIM.** An adapter sentence names the room,
 *    the ordinal and the list; a paraphrase is where the evidence channel stops
 *    being evidence.
 *  · **`edit*` IDS, INSIDE `#editOnly`** (§13.4) — asserted over the live DOM by
 *    `check-seedling-editor-arm.mjs`, never against a list here.
 *
 * ⛔ **`LINK_SCAN` / `linkScanCost` / `linkScanKb` / `linkScanBound` STAY**, and
 * so do `manifestFormRows` / `roomFormRows` and `isAdapterRefusal`: they price
 * or shape SEEDLING quantities (§26.2's list). Each is handed to the mount by
 * name — `linkBound`, `forms`, `isRefusal`.
 */

import {
    ROOM_FIELDS, SET_FIELDS, closeRoomSession, createSeedlingSetAdapter, deriveAtlasOf,
    downloadSet, exitsOfRoom, readSetCell, rulesJsonOf, validateForDownload, whatLinksHere,
} from './seedlingSetAdapter.js';
import { exitRuleKey, locationRuleKey } from './seedlingSetOverlay.js';
import {
    MUSIC_COUNT, MUSIC_NONE, NAMED_ROOMS, roomRecordOf, roomSourceKind,
} from './levelSetValidator.js';
import { DEFAULT_PLAYER_ID } from '../procgenCore/rulesGraph.js';
import {
    inertRulesOf as coreInertRulesOf, reportOver, roomRowsOf as coreRoomRowsOf,
    ruleTargetKeys as coreRuleTargetKeys, ruleTargetsOver,
} from '../procgenCore/setEditorCore.js';
import { mountSetEditor } from '../procgenCore/setEditorView.js';

export class WatchSetEditorError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WatchSetEditorError';
    }
}

const fail = (message) => { throw new WatchSetEditorError(message); };
const isAdapterRefusal = (e) => e?.name === 'SeedlingSetAdapterError'
    || e?.name === 'SeedlingSetOverlayError' || e?.name === 'LevelSetExitError';

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE COST OF READING THE LINK GRAPH — MEASURED, NOT GUESSED
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **`whatLinksHere` READS THE WHOLE SET, SO ASKING IT PER ROOM IS n × the
 * set** — and the QUANTITY the set is measured in depends on the kind of
 * document its rooms carry.
 *
 * ⛔ **THE TEXT HALF, MEASURED 2026-08-25** over the 116 committed rooms
 * exported to OEL: `parseRoomXml` costs **0.034 ms/KB on the smallest room
 * (1,243 B), 0.047 ms/KB over the whole set (1,332 KB in 63 ms) and 0.039 ms/KB
 * on the widest single room (133 KB)** — a 1.4× spread over a corpus whose
 * widest room is 107× the smallest. Bytes ARE the quantity; a room COUNT would
 * have been the proxy trap ([[feedback_proxy_constant_fails_worst_window]]).
 *
 * ⛓⛓⛓ **THE RECORD HALF — RE-MEASURED FOR EDITOR v3 E1b, AND IT IS A DIFFERENT
 * QUANTITY.** A `record` room parses NOTHING: `indexRoom` walks `entities[]`.
 * MEASURED 2026-08-25 over the same 116, carried as records (node, loadavg
 * 0.45):
 *
 *   ·  the widest room (346 entities)     369.9 µs  → **1.069 µs/entity**
 *   ·  the whole set (2,461 entities)       3.46 ms → **1.405 µs/entity**
 *   ·  the smallest room (0 entities)       0.80 µs → the per-room floor
 *
 * a 1.31× spread in µs/entity — the same shape the byte measurement has. ⛔ AND
 * A ROOM COUNT IS AGAIN THE PROXY TRAP, harder here than for text: the widest
 * room costs **464×** the narrowest (369.9 µs vs 0.797 µs), because one has 346
 * entities and the other has none.
 *
 * ⇒ `msPerEntity` is the ceiling of the measured spread, and a MIXED set sums
 * both halves — an `embed` room costs nothing here and is named by `unreadable`.
 *
 * ⚠⚠ **AND THE BOUND STILL BITES ON THE VANILLA 116 — RE-PRICING DID NOT
 * DELETE IT.** The whole column is 116 × 116 room visits: measured **365 ms**,
 * against the same 250 ms budget. What changed is the SIZE of the refused work,
 * not the verdict: E1 measured the text column at **16,989–19,390 ms**, so the
 * record path is **~47× cheaper** and the bound now bites at about **89 rooms**
 * instead of about **21**. ⛓ The remaining cost is STRUCTURAL rather than
 * per-room: `roomRowsOf` asks `whatLinksHere` once per room and each answer is
 * a full pass, so the column is O(n²) over a graph that ONE pass could bucket —
 * measured, that one pass is **3.5 ms** at n=116, a hundredfold under budget.
 * ⛔ NOT DONE HERE: it changes `whatLinksHere`'s contract, which is the
 * adapter's vocabulary and E3's. §24 names it with this number.
 */
export const LINK_SCAN = Object.freeze({
    msPerKb: 0.05,
    msPerEntity: 0.0015,
    budgetMs: 250,
});

/**
 * What a full link scan of this record would read: n × the set, priced in the
 * quantity each room's KIND is actually measured in.
 */
export function linkScanCost(record) {
    const rooms = record?.set?.rooms ?? [];
    let bytes = 0;
    let entities = 0;
    for (const r of rooms) {
        const kind = roomSourceKind(r?.source);
        if (kind === 'record') entities += (r.source.record.entities ?? []).length;
        else if (kind === 'xml') bytes += r.source.xml.length;
        // an `embed` room is UNREADABLE here and costs nothing — `whatLinksHere`
        // names it in `unreadable` rather than pretending it was scanned.
    }
    const n = rooms.length;
    const kb = (n * bytes) / 1024;
    const scanned = n * entities;
    return {
        rooms: n,
        kb,
        entities: scanned,
        ms: kb * LINK_SCAN.msPerKb + scanned * LINK_SCAN.msPerEntity,
    };
}

/** ⛓ Kept: the TEXT half alone, which is what §21.4's bound was made of. */
export function linkScanKb(record) {
    return linkScanCost(record).kb;
}

/**
 * Whether the whole-set link scan fits the budget, and — when it does not — the
 * sentence that says so. ⛔ NAMED, never silently skipped: a rooms list whose
 * "links here" column was blank for a reason nobody printed would read as a set
 * in which nothing links anywhere.
 */
export function linkScanBound(record) {
    const cost = linkScanCost(record);
    const { kb, entities, ms } = cost;
    if (ms <= LINK_SCAN.budgetMs) return { ok: true, kb, entities, ms, why: null };
    const what = [
        kb > 0 ? `${Math.round(kb)} KB of OEL text` : null,
        entities > 0 ? `${entities} record entities` : null,
    ].filter(Boolean).join(' + ') || 'nothing readable';
    return {
        ok: false,
        kb,
        entities,
        ms,
        why: `the whole-set link scan would read ${what} (every room, once per room) `
            + `≈ ${Math.round(ms)} ms, over the ${LINK_SCAN.budgetMs} ms budget — so the `
            + '"links here" COLUMN is not computed and reads `(bounded)`. ⛔ Bounded and said, '
            + 'not skipped. ⚠ The overview ARROWS are UNAFFECTED: they come from each room\'s '
            + 'own exit list, which is ONE pass over the set and not n of them.',
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SUBSTRATE-FREE HALF — MOVED TO `procgenCore/setEditorCore.js`,
 *      AND RE-EXPORTED HERE BY THE SAME FUNCTION OBJECT
 * ══════════════════════════════════════════════════════════════════════
 *
 * EDITOR v3 slice E2a. §22.1 #7 measured which of this file's functions read
 * anything a LEVEL SET owns, and the answer was: the rooms strip, the reorder
 * permutation, the renumbering ruling, the arrow shapes, the gateability
 * answer, the free-edge scan and the REPORT's sections 3–4 read NONE of it.
 * They moved so the maze can have them (`mazeRoom/mazeSetAdapter.js` is the
 * second caller); this file is where Seedling BINDS them.
 *
 * ⛔ **RE-EXPORTED, NOT RE-WRAPPED, WHEREVER NOTHING IS BOUND.** D2's 45 rows,
 * E1/E1b/E1c's rows and `check-seedling-editor-arm.mjs` all import these names
 * from HERE, and a copy would be a second function that could drift from the
 * one the maze runs. `setEditorCore.test.js` and `watchSetEditor.test.js`
 * assert the identity with `===` for exactly that reason.
 *
 * ⚠ `LINK_SCAN`/`linkScanCost`/`linkScanBound` above did NOT move: they price
 * SEEDLING quantities (OEL bytes, then record entities — §24.7). The maze
 * prices its own scan; the column the price gates is the core's.
 */

export {
    OVERVIEW, addRoomMapping, exitArrowShapes, freeEdgesOf, gateabilityOf, moveOrder,
    overlayLocationCount, overviewLayout, removeRoomMapping, renumberDecision, reorderMapping,
    roomCentre,
} from '../procgenCore/setEditorCore.js';

/**
 * ⛓ THE FOUR THINGS THE CORE IS HANDED, IN ONE PLACE.
 *
 * ⛔ `bounds` IS THE ADAPTER'S OWN, read off a freshly constructed adapter
 * rather than re-spelled as `record.set.rooms.length` here. The strip, the
 * arrows and the REPORT's room count must all agree with what `rectCopy` and
 * `editorView` address, and one spelling is how that stays true.
 */
const SET_BOUNDS = createSeedlingSetAdapter().bounds;

/** ⛓ The rule-target key BUILDERS — so no prefix literal is typed anywhere. */
const RULE_KEYS = Object.freeze({ exit: exitRuleKey, location: locationRuleKey });

/**
 * ⛓ WHAT SECTION 1 OF THE REPORT CALLS THE DOCUMENT IT VALIDATED. Every word
 * of that row is about a LEVEL SET, which the core has never heard of.
 */
const SET_DOCUMENT = Object.freeze({
    kind: 'level-set',
    noun: 'set',
    validator: 'validateLevelSet',
    idOf: (check) => check.set_id,
});

const SET_ADAPTER_FNS = Object.freeze({
    validateForDownload, deriveAtlasOf, rulesJsonOf, bounds: SET_BOUNDS,
});

/** ⛓ The rooms list, over the SEEDLING adapter's three readers. */
export const roomRowsOf = (record, { links = true } = {}) => coreRoomRowsOf(record, {
    links,
    readSetCell,
    exitsOfRoom,
    whatLinksHere,
    bounds: SET_BOUNDS,
    isRefusal: isAdapterRefusal,
});

/** ⛓ The rule targets of one room, over the SEEDLING derivation. */
export const ruleTargetsOf = (record, room, deps) => ruleTargetsOver(record, room, deps, {
    deriveAtlasOf,
});

/** ⛓ …and their overlay keys, in the overlay module's own spelling. */
export const ruleTargetKeys = (targets) => coreRuleTargetKeys(targets, RULE_KEYS);

/** ⛓ Every authored exit rule that gates nothing, keyed by Seedling's prefix. */
export const inertRulesOf = (record, atlas) => coreInertRulesOf(record, atlas, {
    ruleKeys: RULE_KEYS,
});

/**
 * ⛓⛓ **THE REPORT — three lines of binding over `reportOver`.** The verdict,
 * the row list and the export refusal are the core's; the four adapter
 * functions and the document's own noun are Seedling's.
 */
export function reportOf(session, deps, {
    compileRegionAtlas, validateRegionAtlas, atlasSchema = undefined,
    playerId = DEFAULT_PLAYER_ID,
} = {}) {
    return reportOver({
        session,
        deps,
        adapterFns: SET_ADAPTER_FNS,
        document: SET_DOCUMENT,
        ruleKeys: RULE_KEYS,
        compileRegionAtlas,
        validateRegionAtlas,
        atlasSchema,
        playerId,
    });
}


/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE FORMS — SCHEMA-DERIVED, never typed here
 * ══════════════════════════════════════════════════════════════════════ */

const schemaOf = (schema, field) => schema?.properties?.[field] ?? null;

/**
 * ⛓⛓⛓ **THE MANIFEST FORM, FROM `SET_FIELDS` AND THE SCHEMA.**
 *
 * ⛔ `named_rooms`' SHAPE IS READ OFF `levelSetValidator.NAMED_ROOMS`, NOT off
 * the JSON schema, and the schema itself is what says so: *"REQUIREDNESS IS
 * DERIVED FROM THE ROOM DATA AND JSON SCHEMA CANNOT EXPRESS IT — see
 * levelSetValidator.js, which is the authority"*. The six keys and whether each
 * carries an arrival POSITION are facts about `Game.as` call sites, and the
 * table that holds them holds their citations too.
 *
 * ⚠ The order is `SET_FIELDS`', which is the order `set-field` accepts — so a
 * field added to the op vocabulary appears here by existing.
 */
export function manifestFormRows(schema) {
    return SET_FIELDS.map((field) => {
        const decl = schemaOf(schema, field);
        if (field === 'name' || field === 'description') {
            return Object.freeze({
                field, control: 'text', label: field, help: decl?.description ?? '',
            });
        }
        if (field === 'start') {
            return Object.freeze({
                field, control: 'spawn', label: 'start', position: true,
                help: decl?.description ?? '',
            });
        }
        if (field === 'menu_rooms') {
            return Object.freeze({
                field,
                control: 'roomlist',
                label: 'menu_rooms',
                minItems: decl?.minItems ?? 1,
                help: decl?.description ?? '',
            });
        }
        return Object.freeze({
            field,
            control: 'named',
            label: 'named_rooms',
            keys: Object.freeze(Object.entries(NAMED_ROOMS).map(([key, d]) => Object.freeze({
                key, position: Boolean(d.position), cite: d.cite, kind: d.kind,
            }))),
            help: decl?.description ?? '',
        });
    });
}

/**
 * ⛓ THE ROOM FORM, from `ROOM_FIELDS` — and `music`'s range is `Music.songs`'
 * own, through the constants the op refuses against, so the form and the
 * refusal cannot disagree.
 */
export function roomFormRows() {
    return ROOM_FIELDS.map((field) => {
        if (field === 'name') return Object.freeze({ field, control: 'text', label: 'name' });
        if (field === 'music') {
            return Object.freeze({
                field, control: 'number', label: 'music', min: MUSIC_NONE, max: MUSIC_COUNT - 1,
            });
        }
        return Object.freeze({ field, control: 'checkbox', label: field });
    });
}

/**
 * ⛓⛓⛓ **THE MOUNT — SEEDLING'S BINDINGS, AND NOTHING ELSE** (EDITOR v3 E2b,
 * §27/§28). The 1,051 lines that were here MOVED to
 * `procgenCore/setEditorView.js`; what is left is the ~26 call sites that knew
 * they were on Seedling, each now a named parameter. ⛔ It is a BINDING and not
 * a re-export of the same function object: `mountSetEditor` takes the
 * substrate's readers and this signature is the one `watchViewer.js` calls, so
 * handing the core's function straight out would silently change the page's own
 * call site (and `setEditorView.test.js` asserts the returned surface is D2's).
 */

/** ⛓ WHAT SECTION 1 OF THE REPORT CALLS THE DOCUMENT — plus which HALF of the
 *  record that document is, which is what the manifest form edits and what the
 *  identity line stamps. */
const SET_DOCUMENT_FULL = Object.freeze({ ...SET_DOCUMENT, docOf: (record) => record.set });

/**
 * ⛓⛓ **THE EXIT VOCABULARY — SEEDLING ADDRESSES AN EXIT BY ITS ORDINAL.**
 * `connect` lands on the DESTINATION's return door and which room that is is not
 * known until the second click, so the target list is a range DERIVED from the
 * widest room in the set and a target that has no such exit is refused BY NAME
 * by the adapter with its real count in the sentence — one authority, not two.
 */
const SET_EXITS = Object.freeze({
    valueOf: (ex) => String(ex.index),
    labelOf: (ex) => `#${ex.index} ${ex.element} → room ${ex.to} `
        + `@(${ex.playerx ?? '·'},${ex.playery ?? '·'})`,
    addressOf: (value) => {
        const n = Number(value);
        return Number.isInteger(n) ? n : 0;
    },
    targetOptions: (rows) => {
        const most = rows.reduce((n, r) => Math.max(n, r.exitList.length), 0);
        return Array.from({ length: Math.max(1, most) },
            (_, i) => ({ value: String(i), label: `#${i}` }));
    },
    disconnectOp: (room, value) => ({ op: 'disconnect', room, exitIndex: Number(value) }),
});

/**
 * ⛓⛓ **A SEEDLING LOCATION IS AN OEL ENTITY AT EXACT PIXELS.** ⛔ Read out of
 * the room's own document through the injected parser — `mark-location` refuses
 * an entity the room does not hold AT EXACTLY THOSE PIXELS, so a list built from
 * anything else would offer choices the op rejects.
 */
const setLocations = (deps) => Object.freeze({
    options: (cell) => {
        let entities = [];
        try {
            entities = roomRecordOf(cell.room, { parseOel: deps.parseOel }).entities ?? [];
        } catch (e) {
            if (!(e instanceof Error)) throw e;
            entities = [];
        }
        return entities.map((ent) => ({
            value: JSON.stringify({ type: ent.type, x: ent.x, y: ent.y }),
            label: `${ent.type} @(${ent.x},${ent.y})`,
        }));
    },
    emptyWhy: '⛔ pick an ENTITY first — `mark-location` names a body the room holds at '
        + 'exactly those pixels, and this room offers none',
    targetOf: (value) => ({ entity: JSON.parse(value) }),
});

/**
 * ⛓⛓⛓ **THE DOWNLOAD, AS MEMBERS** (§27.3 #5). `downloadSet` validates, stamps
 * ONCE and hands back three documents; this says what each one is CALLED, what
 * FILE it becomes, what the note calls it and which readout a browser row reads
 * it back from.
 *
 * ⛔ **`ap-mapping` IS DELIBERATELY NOT A `BUNDLE_KINDS` NAME.** The zip carries
 * `rules, level-set, overlay, region-atlas` and nothing else (§24.12), so the
 * bundle button refuses this member BY NAME and prints why — where a silent drop
 * would hand somebody a zip missing the document they pressed for.
 */
function downloadSetMembers(session) {
    const out = downloadSet(session);
    return {
        members: [
            {
                kind: 'level-set',
                doc: out.set,
                name: `${out.set.set_id}.json`,
                label: out.set.set_id,
                readout: '__editorSetOut',
            },
            {
                kind: 'overlay',
                doc: out.overlay,
                name: `${out.overlay.overlay_id}.overlay.json`,
                label: `overlay ${out.overlay.overlay_id}`,
                readout: '__editorSetOverlayOut',
            },
            {
                kind: 'ap-mapping',
                doc: out.apMapping,
                name: `${out.set.set_id}.apmapping.json`,
                label: 'the apMapping companion',
                readout: '__editorSetMappingOut',
                whyNotMember: 'it is a DERIVED table regenerated per set; press the separate '
                    + 'download for it',
            },
        ],
        report: out.report,
    };
}

/**
 * ⛓⛓⛓ **MOUNT THE SET EDITOR OVER SEEDLING.** The signature is D2's, unchanged,
 * so `watchViewer.js`'s call site did not move.
 *
 * @param {object} o — see `procgenCore/setEditorView.js`; `deps` is
 *   `{parseOel, tileSize, tileTypeForPlacement, rulesSchema, levelSetSchema}`,
 *   `drawRoomStill` is `(canvas, roomRecord) => why|null` (the PAGE's own
 *   `previewLevel`) and `emptyLevel` is `() => record`.
 */
export function mountWatchSetEditor({
    deps = {}, drawRoomStill = null, emptyLevel = null, ...rest
} = {}) {
    return mountSetEditor({
        ...rest,
        deps,
        adapterFns: {
            readSetCell,
            exitsOfRoom,
            whatLinksHere,
            bounds: SET_BOUNDS,
            validateForDownload,
            deriveAtlasOf,
            rulesJsonOf,
            closeRoomSession,
            download: downloadSetMembers,
        },
        document: SET_DOCUMENT_FULL,
        ruleKeys: RULE_KEYS,
        /**
         * ⛓ MEASURED (§28): neither form reads the RECORD — the manifest's rows
         * come from `SET_FIELDS` + the schema + `NAMED_ROOMS`, the room's from
         * `ROOM_FIELDS` + the `MUSIC_*` constants — so neither takes one.
         */
        forms: {
            manifestRows: () => manifestFormRows(deps.levelSetSchema ?? null),
            roomRows: () => roomFormRows(),
        },
        exits: SET_EXITS,
        locations: setLocations(deps),
        linkBound: (record) => linkScanBound(record),
        isRefusal: isAdapterRefusal,
        rulesSchema: deps.rulesSchema ?? null,
        /**
         * ⛓ ⚖ THE ONE-RENDERER LAW — the page's own `previewLevel` draws the
         * still, and this hands it the ROOM RECORD the descriptor carries.
         * ⛔ THE CACHE IS KEYED ON THE `source` OBJECT, not on a string: every
         * op here is copy-on-write, so a room whose document changed has a NEW
         * `source` by construction — and a `record` room has no string to
         * compare in the first place.
         */
        drawRoomStill: drawRoomStill === null ? null : (canvas, cell, index) => drawRoomStill(
            canvas, { ...roomRecordOf(cell.room, { parseOel: deps.parseOel }), level: index },
        ),
        stillKey: (cell) => cell.room.source ?? null,
        /**
         * ⛓ ADD ROOM starts from `emptyLevel` — the page's own blank record —
         * and hands it to `add-room` AS A RECORD (EDITOR v3 E1b, §22.8).
         */
        addRoomOp: emptyLevel === null ? null : (at) => ({
            op: 'add-room', record: emptyLevel(), name: `room ${at}`,
        }),
    });
}
