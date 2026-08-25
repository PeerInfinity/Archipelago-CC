/**
 * seedlingDemo/watchSetEditor — **THE SET SESSION, ON THE PAGE.**
 *
 * EDITOR v3 arc, slice D2 (`NewDocs/plans/seedling-editor-v3.md` §16.4, §20.11).
 * D1 shipped `seedlingSetAdapter.js` — twelve ops over `{set, overlay}`, the
 * derivation, `rulesJsonOf`, `downloadSet`, `closeRoomSession` — with no DOM at
 * all. This file is the DOM: a rooms list, an overview strip with the exits
 * drawn as arrows, the two-click exit gesture, the manifest and room forms, the
 * rule authoring box, the REPORT and the three downloads.
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
 */

import {
    ROOM_FIELDS, SET_FIELDS, closeRoomSession, deriveAtlasOf, downloadSet, exitsOfRoom,
    readSetCell, rulesJsonOf, validateForDownload, whatLinksHere,
} from './seedlingSetAdapter.js';
import { exitRuleKey, locationRuleKey } from './seedlingSetOverlay.js';
import {
    MUSIC_COUNT, MUSIC_NONE, NAMED_ROOMS, roomRecordOf, roomSourceKind,
} from './levelSetValidator.js';
import {
    DEFAULT_PLAYER_ID, reachableRegions, regionsOf, startRegionsOf,
} from '../procgenCore/rulesGraph.js';
import { ruleSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { stringifyRulesJson } from '../shared/rulesJsonBuilder.js';
import {
    DEFAULT_RULES_JSON_INDENT, writeBundle,
} from '../presets/documentBundle.js';
import { UNDO_COMMAND_ID, mountEditorView } from '../procgenCore/editorView.js';
import { createLifetime } from '../procgenCore/pageLifetime.js';

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
 * ⛓ THE ROOMS LIST
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **ONE ROW PER ROOM, DERIVED FROM THE RECORD** — never from a list this
 * file keeps. `bounds().w` is `rooms.length` and `readSetCell` is the cell
 * descriptor, so the list is a view of exactly what the adapter addresses.
 *
 * ⛔ A ROOM THIS CANNOT READ IS NAMED, not dropped — `exitsOfRoom` refuses an
 * `embed`-sourced room by name and that sentence becomes the row's `why`, the
 * same law `whatLinksHere` keeps about `unreadable`.
 *
 * @param {object} record `{set, overlay}`
 * @param {object} [o]
 * @param {boolean} [o.links] compute the "links here" count for every room —
 *   `false` when `linkScanBound` says the scan does not fit, and the column
 *   reads `null` rather than `0`.
 */
export function roomRowsOf(record, { links = true } = {}) {
    const rooms = record?.set?.rooms ?? [];
    const inbound = links ? rooms.map((_, i) => whatLinksHere(record, i)) : null;
    return rooms.map((_room, index) => {
        const cell = readSetCell(record, index, 0);
        let exits = null;
        let why = null;
        try {
            exits = exitsOfRoom(record, index);
        } catch (e) {
            if (!isAdapterRefusal(e)) throw e;
            why = e.message;
        }
        const overlay = cell.overlay ?? null;
        return Object.freeze({
            index,
            name: cell.room.name ?? '',
            music: cell.room.music ?? null,
            openable: exits !== null,
            why,
            exits: exits === null ? null : exits.length,
            exitList: Object.freeze(exits ?? []),
            linkedFrom: inbound ? inbound[index].links.length : null,
            unreadable: inbound ? Object.freeze([...inbound[index].unreadable]) : null,
            locations: overlay?.locations?.length ?? 0,
            rules: Object.keys(overlay?.rules ?? {}).length,
        });
    });
}

/**
 * ⛓⛓ **MOVE ONE ROOM, AS THE `order` A SINGLE `reorder` TAKES.**
 *
 * ⛔ `order` IS THE NEW ARRAY IN OLD INDICES (`rooms_new[i] = rooms_old[order[i]]`,
 * D1 §20.4) — the inverse reading is equally natural, which is exactly why the
 * one place that builds it is here and it is pinned both ways.
 *
 * ⛓ ONE op, not two retargets that compose: a reader can count the edits in a
 * payload only if a move IS one.
 */
export function moveOrder(count, index, delta) {
    if (!Number.isInteger(count) || count < 1) {
        fail(`watchSetEditor: moveOrder needs a room count, got ${JSON.stringify(count)}`);
    }
    const to = index + delta;
    if (!Number.isInteger(index) || index < 0 || index >= count) {
        fail(`watchSetEditor: room ${index} is outside 0..${count - 1}`);
    }
    if (to < 0 || to >= count) {
        fail(`watchSetEditor: room ${index} cannot move ${delta > 0 ? 'DOWN' : 'UP'} — it is `
            + `already ${delta > 0 ? 'last' : 'first'} of ${count}.`);
    }
    const order = Array.from({ length: count }, (_, i) => i);
    order[index] = to;
    order[to] = index;
    return order;
}

/** The old → new room mapping a `reorder` with this `order` performs. */
export const reorderMapping = (order) => (old) => {
    const at = order.indexOf(old);
    return at === -1 ? null : at;
};

/** …and the two other renumbering ops', so ONE decision function serves all three. */
export const addRoomMapping = (at) => (old) => (old >= at ? old + 1 : old);
export const removeRoomMapping = (room) => (old) => {
    if (old === room) return null;
    return old > room ? old - 1 : old;
};

/**
 * ⛓⛓⛓ **§20.11 #2 — WHAT A RENUMBERING DOES TO AN OPEN ROOM SESSION.**
 *
 * *"A room session left open while the set is reordered is holding a record
 * whose room index no longer means what it did… nothing refuses that today, and
 * it would not be visible until the write-back."*
 *
 * ⛔ **THE RULING, AND IT IS THE PAGE'S TO MAKE:** a room session with EDITS in
 * it is **DISCARDED**, loudly, naming how many edits went; one with ZERO ops is
 * silently REOPENED on the room's new index.
 *
 * ⛔ NOT closed-and-written-back. Writing back would turn a press on MOVE UP
 * into a `replace-room` nobody asked for, and it would land in the same
 * group as the reorder — a person who moved a room would find an edit to its
 * contents in the payload. ⚠ And not kept open either: the base tag names a
 * room INDEX, and after the renumbering that index is a different room, so the
 * write-back would overwrite a room the reader never opened.
 *
 * @param {{room: number, ops: number}|null} open  the open room session, or null
 * @param {Function} mapOldToNew  `(old) => new|null`
 * @param {string} what           the op, for the sentence
 */
export function renumberDecision(open, mapOldToNew, what) {
    if (!open) return Object.freeze({ action: 'none', room: null, warning: null });
    const next = mapOldToNew(open.room);
    if (open.ops > 0) {
        return Object.freeze({
            action: 'discard',
            room: null,
            warning: `⛔ the room session on room ${open.room} was DISCARDED — ${what} renumbers `
                + `the rooms, so room ${open.room} no longer names the room that was open, and `
                + `${open.ops} unwritten edit(s) went with it. ⚠ Close a room BEFORE reordering `
                + 'and its edits become one `replace-room` in the set; a write-back after '
                + 'the renumbering would land on a room nobody opened.',
        });
    }
    if (next === null) {
        return Object.freeze({
            action: 'discard',
            room: null,
            warning: `⛓ the room session on room ${open.room} was closed — ${what} removed that `
                + 'room. It held no edits, so nothing was lost.',
        });
    }
    return Object.freeze({
        action: 'reopen',
        room: next,
        warning: next === open.room ? null
            : `⛓ the open room moved to index ${next} (it held no edits, so it was simply `
                + 'reopened there).',
    });
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE OVERVIEW — ROOMS AS A STRIP, EXITS AS ARROWS
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **THE OVERVIEW IS THE ADAPTER'S OWN GRID, AND THAT IS WHY IT IS A STRIP.**
 *
 * `bounds(record)` is `{w: rooms.length, h: 1}` — D1's honest statement that a
 * level set IS a positionally addressed LIST. ⛔ A square grid of rooms would
 * have needed a SECOND coordinate system: `editorView`'s painter derives its
 * cell size from `adapter.bounds`, `cellAt` must answer in the adapter's
 * coordinates, and `rectCopy`/`rectPasteOps` address rooms in them. A page that
 * laid the rooms out 6-across would be maintaining a mapping between the
 * picture and the document for no gain but the aspect ratio.
 *
 * ⇒ one row, one cell per room, and the strip SCROLLS.
 */
export const OVERVIEW = Object.freeze({
    /** The cell a room gets when there is room for it — wide enough for a still. */
    cellPx: 96,
    /** Below this a still is a smudge, so the cell is drawn as a labelled box. */
    minStillPx: 40,
    /** …and below THIS the strip stops shrinking and starts scrolling. */
    minCellPx: 18,
    /** The height of the strip, and the arrows arc above the rooms inside it. */
    heightPx: 132,
    /** How far down the strip the room boxes start — the rest is arrow space. */
    roomTop: 0.34,
});

/**
 * The strip's pixel size for a set of `count` rooms inside `availablePx`.
 * ⛓ It SHRINKS to fit and then SCROLLS — never below `minCellPx`, because a
 * two-pixel room is a room nobody can click.
 */
export function overviewLayout(count, availablePx) {
    const n = Math.max(1, count);
    const ideal = Math.floor(Math.max(0, availablePx) / n);
    const cellPx = Math.max(OVERVIEW.minCellPx, Math.min(OVERVIEW.cellPx, ideal || 0));
    return Object.freeze({
        rooms: n,
        cellPx,
        width: cellPx * n,
        height: OVERVIEW.heightPx,
        stills: cellPx >= OVERVIEW.minStillPx,
        scrolls: cellPx * n > availablePx,
    });
}

/** A room's centre in the view's CELL space — the strip is one row. */
export const roomCentre = (index) => Object.freeze({
    x: index + 0.5,
    y: OVERVIEW.roomTop + (1 - OVERVIEW.roomTop) / 2,
});

/**
 * ⛓⛓⛓ **THE EXITS, AS POLYLINES** — one line per PAIR of rooms, arced above
 * the strip so a long link does not run through every room it passes.
 *
 * ⛔ **A TWO-WAY DOOR IS ONE LINE WITH TWO HEADS**, not two lines. Drawing both
 * directions would put two arcs on the same span with the same colour and the
 * reader could not tell that from two separate one-way doors — which is the one
 * distinction `connect {one_way}` exists to make.
 *
 * ⛓ A SELF-JOIN gets a small loop rather than a zero-length line: `assertShape`
 * refuses a one-point polyline, and a degenerate segment would have no
 * direction to hang a head on.
 *
 * @param {object[]} rows      `roomRowsOf`'s rows — the exits are already read
 * @param {object} [o]
 * @param {number|null} [o.selected] highlight what links INTO this room
 */
export function exitArrowShapes(rows, { selected = null } = {}) {
    /** ⛓ ONE ENTRY PER ORDERED PAIR, so the fold below can see both directions. */
    const seen = new Map();
    for (const row of rows) {
        for (const exit of row.exitList) {
            if (!Number.isInteger(exit.to) || exit.to < 0 || exit.to >= rows.length) continue;
            const key = `${row.index}>${exit.to}`;
            if (!seen.has(key)) seen.set(key, { from: row.index, to: exit.to, n: 0 });
            seen.get(key).n += 1;
        }
    }
    const shapes = [];
    const drawn = new Set();
    for (const link of seen.values()) {
        const back = `${link.to}>${link.from}`;
        const key = `${link.from}>${link.to}`;
        if (drawn.has(key)) continue;
        const twoWay = seen.has(back) && link.from !== link.to;
        drawn.add(key);
        if (twoWay) drawn.add(back);
        const a = roomCentre(link.from);
        const b = roomCentre(link.to);
        const highlight = selected !== null
            && (link.to === selected || (twoWay && link.from === selected));
        if (link.from === link.to) {
            // ⛓ A LOOP, above its own room.
            shapes.push({
                kind: 'polyline',
                points: [
                    { x: a.x - 0.28, y: a.y - 0.06 },
                    { x: a.x - 0.2, y: OVERVIEW.roomTop * 0.45 },
                    { x: a.x + 0.2, y: OVERVIEW.roomTop * 0.45 },
                    { x: a.x + 0.28, y: a.y - 0.06 },
                ],
                arrow: true,
                highlight,
                label: `L${link.from} ↺`,
            });
            continue;
        }
        /**
         * ⛓ THE APEX RISES WITH THE SPAN, so two arcs over the same rooms are
         * distinguishable and a neighbour-to-neighbour link stays low.
         */
        const span = Math.abs(link.to - link.from);
        const apexY = Math.max(0.02, OVERVIEW.roomTop * (1 - Math.min(0.85, span / rows.length)));
        shapes.push({
            kind: 'polyline',
            points: [
                { x: a.x, y: a.y - 0.08 },
                { x: (a.x + b.x) / 2, y: apexY },
                { x: b.x, y: b.y - 0.08 },
            ],
            arrow: true,
            arrowBack: twoWay,
            highlight,
            label: twoWay ? `L${link.from} ↔ L${link.to}` : `L${link.from} → L${link.to}`,
        });
    }
    return shapes;
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ RULE AUTHORING — the targets, derived ONCE per selection (§20.11 #4)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **WHICH ENDPOINTS A RULE CAN ACTUALLY GATE — MEASURED, NOT ASSUMED.**
 *
 * ⛔⛔ **AN `in_*` ARRIVAL EXIT GATES NOTHING, AND THE ADAPTER ACCEPTS A RULE ON
 * ONE.** Measured 2026-08-25 against `regionAtlasCompiler.js:320-347`: for a
 * connection with `one_way: true` — which is EVERY connection the Seedling
 * derivation emits, because the game's one transition primitive is a one-way
 * jump — the `to` endpoint is recorded as `{apExitName: null, arrivalOnly:
 * true}` and **no AP exit is built for it**, so its `access_rule` reaches
 * nothing. An UNWIRED endpoint is omitted from the graph outright and reaches
 * nothing either.
 *
 * ⇒ a rule authored on one of those is exactly the failure `applyOverlayRules`
 * refuses in its own words: *"the author believing a door is gated and the
 * compiler treating it as free"*. The list therefore MARKS them, and the REPORT
 * names any that were authored anyway. ⛔ They are still OFFERED, because
 * refusing here would be a second authority over an op the adapter accepts.
 *
 * @returns {{id: string, gates: boolean, why: string|null}}
 */
function gateabilityOf(atlas, regionId, exitId) {
    for (const conn of atlas?.vanilla_layout?.connections ?? []) {
        if (conn.from?.[0] === regionId && conn.from?.[1] === exitId) {
            return { gates: true, why: null };
        }
        if (conn.to?.[0] === regionId && conn.to?.[1] === exitId) {
            return conn.one_way === true
                ? {
                    gates: false,
                    why: 'the ARRIVAL side of a ONE-WAY connection — the compiler builds no AP '
                        + 'exit for it (`regionAtlasCompiler.js:341`, `arrivalOnly`), so a rule '
                        + 'here gates nothing and the edge stays FREE',
                }
                : { gates: true, why: null };
        }
    }
    return {
        gates: false,
        why: 'UNWIRED — no connection in the layout covers this crossing, so it is OMITTED '
            + 'from the graph and a rule on it reaches nothing',
    };
}

/**
 * The rule targets of ONE room: every exit id the derivation gives it — each
 * marked with whether a rule on it can gate anything — and every location the
 * overlay has marked in it.
 *
 * ⛔ **THE EXITS COST A DERIVATION AND THE LOCATIONS DO NOT.** An exit id is the
 * derivation's (`out_<type>_<x>_<y>`…), so asking for one means building the
 * atlas — §20.11 #4's *"correct, and not free"*. A location is named by the
 * `mark-location` op's own `name` and lives in the overlay, so it is read
 * directly. ⇒ this is called on SELECTION CHANGE, never on a keystroke.
 *
 * @returns {{exits: object[], locations: string[], why: string|null}}
 */
export function ruleTargetsOf(record, room, deps) {
    const locations = (record?.overlay?.rooms?.[String(room)]?.locations ?? [])
        .map((l) => l.name);
    let exits = [];
    let why = null;
    try {
        const { atlas } = deriveAtlasOf(record, deps);
        for (const region of atlas.regions ?? []) {
            if (region.map_ref !== room) continue;
            exits = (region.exits ?? []).map((e) => Object.freeze({
                id: e.exit_id,
                ...gateabilityOf(atlas, region.region_id, e.exit_id),
            }));
        }
    } catch (e) {
        if (!(e instanceof Error)) throw e;
        why = `the exit targets could not be derived — ${e.message}`;
    }
    return { exits, locations, why };
}

/** The two rule-target spellings, as the overlay keys them. */
export const ruleTargetKeys = (targets) => [
    ...targets.exits.map((e) => exitRuleKey(e.id)),
    ...targets.locations.map((name) => locationRuleKey(name)),
];

/**
 * ⛓⛓ **EVERY AUTHORED EXIT RULE THAT GATES NOTHING** — the overlay's `rules`
 * map read against the derived atlas. ⛔ Named rather than counted, because
 * "3 rules do nothing" and "the rule on `in_L0_128_128` of room 1 does nothing"
 * are the same verdict and very different findings.
 */
export function inertRulesOf(record, atlas) {
    const out = [];
    for (const [key, entry] of Object.entries(record?.overlay?.rooms ?? {})) {
        const room = Number(key);
        const region = (atlas?.regions ?? []).find((r) => r.map_ref === room);
        for (const target of Object.keys(entry?.rules ?? {})) {
            if (!target.startsWith('exit:')) continue;
            const exitId = target.slice('exit:'.length);
            if (!region) {
                out.push({ room, exitId, why: 'the derivation kept no region for this room' });
                continue;
            }
            const g = gateabilityOf(atlas, region.region_id, exitId);
            if (!g.gates) out.push({ room, exitId, why: g.why });
        }
    }
    return out;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE REPORT — a LIST, and the refusal that rides on it
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **EVERY FREE EDGE, NAMED.** `atlases/README.md:117`: *"a FREE AP exit is a
 * logic obligation"*. The compiler writes `{rule: 'True_'}` for an edge nobody
 * gated, so the answer is read off the COMPILED rules rather than off the
 * atlas — the atlas is what an author typed and the rules are what the world
 * will do.
 */
export function freeEdgesOf(rules, playerId = DEFAULT_PLAYER_ID) {
    const free = [];
    for (const [regionName, region] of Object.entries(regionsOf(rules, playerId))) {
        for (const exit of region?.exits ?? []) {
            if (exit?.access_rule?.rule === 'True_' || exit?.access_rule === undefined) {
                free.push({ kind: 'exit', region: regionName, name: exit?.name ?? '(unnamed)' });
            }
        }
        for (const loc of region?.locations ?? []) {
            if (loc?.access_rule?.rule === 'True_' || loc?.access_rule === undefined) {
                free.push({ kind: 'location', region: regionName, name: loc?.name ?? '(unnamed)' });
            }
        }
    }
    return free;
}

/** How many locations the OVERLAY holds — §20.11 #3's tell. */
export function overlayLocationCount(record) {
    return Object.values(record?.overlay?.rooms ?? {})
        .reduce((n, r) => n + (r?.locations?.length ?? 0), 0);
}

/**
 * ⛓⛓⛓ **THE REPORT, AS DATA.** Every row is `{severity, kind, text}` and the
 * DOM below only renders them — which is what makes the whole verdict testable
 * in node and printable as a LIST rather than as a paragraph (§16.4:
 * *"an unreachable graph REFUSES the rules.json download by name"*).
 *
 * ⛔ **THE REFUSAL IS COMPUTED HERE AND NOTHING ELSE DECIDES IT.** `download`
 * carries `{rules: {allowed, why}}`; the button reads it. A page that disabled
 * the button on its own condition would be a second answer to *"may this be
 * exported"*.
 *
 * ⚠ THE SET AND OVERLAY DOWNLOADS ARE **NOT** GATED BY THIS. A person may want
 * to save work on a graph that does not yet close, and refusing that would make
 * the editor unusable exactly when it is most needed.
 */
export function reportOf(session, deps, {
    compileRegionAtlas, validateRegionAtlas, atlasSchema = undefined,
    playerId = DEFAULT_PLAYER_ID,
} = {}) {
    const rows = [];
    const add = (severity, kind, text) => rows.push(Object.freeze({ severity, kind, text }));
    const record = session.record();

    /* 1 ── the SET itself, through the same door the download uses */
    const setCheck = validateForDownload(session);
    for (const e of setCheck.errors) add('error', 'level-set', e);
    for (const w of setCheck.warnings) add('warn', 'level-set', w);
    if (setCheck.ok && setCheck.warnings.length === 0) {
        add('ok', 'level-set', `validateLevelSet: ok — ${record.set.rooms.length} room(s), `
            + `stamped ${setCheck.set_id}`);
    }

    /* 2 ── the DERIVED atlas */
    let derived = null;
    try {
        derived = deriveAtlasOf(record, deps);
    } catch (e) {
        if (!(e instanceof Error)) throw e;
        add('error', 'derive', `the atlas could not be derived — ${e.message}`);
        return Object.freeze({
            rows: Object.freeze(rows),
            rules: null,
            report: null,
            download: Object.freeze({
                rules: Object.freeze({
                    allowed: false,
                    why: 'the atlas does not derive, so there is nothing to compile',
                }),
            }),
        });
    }
    if (typeof validateRegionAtlas === 'function') {
        const v = validateRegionAtlas(derived.atlas,
            atlasSchema === undefined ? {} : { schema: atlasSchema });
        /**
         * ⛓ THE SUMMARY ROW IS ALWAYS ADDED, ok or not. It is the row that says
         * whether the STRUCTURAL pass ran at all — and a page that only printed
         * it on a clean atlas would go quiet about the schema exactly when the
         * atlas had something to say (⚖ a true sentence about the wrong
         * subject, printed only in the easy case).
         */
        add(v.ok ? 'ok' : 'error', 'region-atlas',
            `validateRegionAtlas: ${v.ok ? 'ok' : `${v.errors.length} error(s)`} — `
            + `${(derived.atlas.regions ?? []).length} region(s), ${v.warnings.length} `
            + `warning(s); ${atlasSchema === undefined
                ? '⚠ no schema was injected, so the STRUCTURAL pass did not run'
                : 'schema included'}`);
        for (const e of v.errors) add('error', 'region-atlas', e);
        for (const w of v.warnings) add('warn', 'region-atlas', w);
        /**
         * ⛔ **ONE OF THOSE WARNINGS IS EXPECTED HERE AND IT IS SAID SO**, from
         * the ATLAS itself rather than by matching the sentence: the derived
         * atlas is NEVER STAMPED (D1 §20.6, §19.10 hard #1), so a validator that
         * wants a `provenance.content_hash` will always warn. Left unexplained,
         * a permanent warning teaches a reader to ignore the warning list.
         */
        if (!derived.atlas.provenance?.content_hash) {
            add('ok', 'region-atlas', 'the derived atlas is DELIBERATELY UNSTAMPED — it is not '
                + 'a document anybody keeps, it is rebuilt from the set on every report, so the '
                + '`provenance.content_hash` warning above is expected here and only here');
        }
    }
    for (const id of derived.dropped ?? []) {
        add('warn', 'derive', `region "${id}" was DROPPED by the derivation — no link in the `
            + 'whole set reaches it and it holds nothing');
    }

    /* 3 ── the COMPILE, its unwired exits, its free edges, its reachability */
    let compiled = null;
    try {
        compiled = rulesJsonOf(session, deps, { compileRegionAtlas });
    } catch (e) {
        if (!(e instanceof Error)) throw e;
        add('error', 'compile', `compileRegionAtlas REFUSED — ${e.message}`);
        return Object.freeze({
            rows: Object.freeze(rows),
            rules: null,
            report: null,
            download: Object.freeze({
                rules: Object.freeze({
                    allowed: false,
                    why: 'the atlas does not compile, so there is no rules.json to write',
                }),
            }),
        });
    }
    const roomOf = new Map((derived.atlas.regions ?? []).map((r) => [r.region_id, r.map_ref]));
    for (const u of compiled.report.unwired_exits ?? []) {
        add('warn', 'unwired', `UNWIRED exit "${u.exit_id}" of region "${u.region_id}" (room `
            + `${roomOf.get(u.region_id) ?? '?'}) — a boundary crossing the layout does not `
            + 'cover, OMITTED from the graph');
    }
    if ((compiled.report.unwired_exits ?? []).length === 0) {
        add('ok', 'unwired', 'no unwired exits — every boundary crossing is in the graph');
    }

    const free = freeEdgesOf(compiled.rules, playerId);
    for (const f of free) {
        add('warn', 'free', `FREE ${f.kind} "${f.name}" in region "${f.region}" — its compiled `
            + '`access_rule` is `True_`, which is a logic obligation nobody has met');
    }
    if (free.length === 0) add('ok', 'free', 'no FREE edges — every exit and location is gated');

    /**
     * ⛓⛓⛓ **AND AN AUTHORED RULE THAT GATES NOTHING IS THE OTHER HALF OF THAT
     * SENTENCE.** A FREE edge is a rule nobody wrote; an INERT rule is one
     * somebody wrote onto an endpoint the compiler builds no exit for. Both end
     * with the compiler treating the door as free, and only one of them looks
     * like an omission.
     */
    const inert = inertRulesOf(record, derived.atlas);
    for (const r of inert) {
        add('error', 'inert-rule', `the rule authored on exit "${r.exitId}" of room ${r.room} `
            + `REACHES NOTHING — ${r.why}`);
    }
    if (inert.length === 0 && Object.keys(record.overlay.rooms ?? {}).length > 0) {
        add('ok', 'inert-rule', 'every authored exit rule sits on an endpoint the compiler '
            + 'builds an AP exit for');
    }

    /**
     * ⛔ **THE STRUCTURAL ANSWER, DELIBERATELY.** `reachableRegions` with no
     * `evaluate` treats every edge as free, so what it reports is *"which
     * regions are connected to the start at all"* — and an unreachable region
     * is unreachable under EVERY rule set, which is exactly the failure worth
     * refusing an export over. ⚠ It is NOT the logic answer: a region this
     * reaches may still sit behind an unobtainable item, and this editor owns
     * no interpreter to say so (`rulesGraph`'s own note).
     */
    const all = Object.keys(regionsOf(compiled.rules, playerId));
    const reached = reachableRegions(compiled.rules, playerId);
    const unreachable = all.filter((n) => !reached.has(n));
    for (const n of unreachable) {
        add('error', 'reach', `region "${n}" is UNREACHABLE from the start — no chain of exits `
            + 'gets there at all, under any rule set');
    }
    if (unreachable.length === 0) {
        add('ok', 'reach', `every one of the ${all.length} compiled region(s) is reachable from `
            + `"${startRegionsOf(compiled.rules, playerId).default.join(', ')}"`);
    }

    /* 4 ── §20.11 #3's TELL — the overlay's locations against the compiled ones */
    const overlayLocs = overlayLocationCount(record);
    const compiledLocs = compiled.report.locations ?? 0;
    add(overlayLocs === compiledLocs ? 'ok' : 'warn', 'locations',
        `${overlayLocs} location(s) in the OVERLAY, ${compiledLocs} compiled`
        + (overlayLocs === compiledLocs ? ''
            : ' ⚠ they DISAGREE — an overlay that did not travel with its set loses every '
              + 'location and every authored rule, and this count is the only thing that says so'));

    const allowed = setCheck.ok && unreachable.length === 0 && inert.length === 0;
    return Object.freeze({
        rows: Object.freeze(rows),
        rules: compiled.rules,
        report: compiled.report,
        atlas: derived.atlas,
        download: Object.freeze({
            rules: Object.freeze({
                allowed,
                why: allowed ? null : `⛔ REFUSED BEFORE EXPORT — ${[
                    setCheck.ok ? null
                        : `the set itself is not valid: ${setCheck.errors.join(' | ')}`,
                    unreachable.length === 0 ? null
                        : `${unreachable.length} region(s) (${unreachable.join(', ')}) cannot `
                          + 'be reached from the start; a rules.json whose graph does not close '
                          + 'is a world nobody can finish, and the seed that found out would be '
                          + 'the report',
                    inert.length === 0 ? null
                        : `${inert.length} authored rule(s) reach no compiled edge `
                          + `(${inert.map((r) => `room ${r.room} / ${r.exitId}`).join(', ')}); `
                          + 'exporting would ship a world whose author and whose compiler '
                          + 'disagree about which doors are gated',
                ].filter(Boolean).join(' · ')}`,
            }),
        }),
    });
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE MOUNT — every control in `#editOnly`, over ONE set session
 * ══════════════════════════════════════════════════════════════════════ */

const el = (doc, tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    // ⛔ `textContent`, never `innerHTML` — every sentence here is an adapter's
    // own, about data a person pasted in.
    if (text !== undefined) node.textContent = text;
    return node;
};

/**
 * ⛓⛓⛓ **MOUNT THE SET EDITOR.** One call per LOADED SET: the page destroys and
 * remounts when a different document arrives, exactly as `runEditor` does for a
 * room, so nothing here has to unpick a previous set's state.
 *
 * @param {object} o
 * @param {object} o.lifetime  the arm's — every listener rides it
 * @param {object} o.session   the SET session (`createSetSession`)
 * @param {object} o.adapter   the SET adapter
 * @param {object} o.deps      `{parseOel, tileSize, tileTypeForPlacement, rulesSchema}`
 * @param {Function} o.compileRegionAtlas  injected — `procgenPipeline/`
 * @param {Function} o.validateRegionAtlas injected — `procgenPipeline/`
 * @param {object}  [o.atlasSchema]  the fetched `region-atlas.schema.json`
 * @param {Function} [o.drawRoomStill] `(canvas, roomRecord) => why|null` — the
 *   PAGE's own renderer. Absent, the overview draws labelled boxes and says so.
 * @param {Function} o.emptyLevel  `(w, h) => record` — what an ADD ROOM starts from
 * @param {Function} o.say         the status line
 * @param {Function} o.roomSession `() => {room, ops}|null` — the OPEN room session
 * @param {Function} o.openRoomAt  `(index) => boolean`
 * @param {Function} o.discardRoom `() => void`
 * @param {Function} o.download    `(name, text, type) => void`
 * @param {Function} [o.onSetChange] the page re-renders its own readouts
 */
export function mountWatchSetEditor({
    lifetime, session, adapter, deps = {}, compileRegionAtlas, validateRegionAtlas,
    atlasSchema = undefined, drawRoomStill = null, emptyLevel = null,
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
    ]) {
        if (!v) fail(`watchSetEditor: \`${name}\` is required — refused by name.`);
    }
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
    const mine = createLifetime('watchSetEditor');
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
    const roomCount = () => record().set.rooms.length;
    const bound = () => linkScanBound(record());
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
        record().set.rooms.forEach((room, i) => {
            const x = i * layout.cellPx;
            ctx.save();
            ctx.fillStyle = i === selected ? '#204050' : '#181818';
            ctx.fillRect(x + 1, top + 1, layout.cellPx - 2, h - 2);
            /**
             * ⛓⛓ EDITOR v3 E1b — THE STILL READS `roomRecordOf`, so a `record`
             * room draws with no parse at all and a legacy `xml` room parses
             * exactly as it did. ⛔ THE CACHE IS KEYED ON THE `source` OBJECT,
             * not on a string: every op here is copy-on-write, so a room whose
             * document changed has a NEW `source` by construction — and a
             * record has no string to compare in the first place.
             */
            const source = room?.source ?? null;
            let drew = false;
            if (layout.stills && drawRoomStill && source !== null) {
                let still = stills.get(i);
                if (!still || still.source !== source) {
                    const c = doc.createElement('canvas');
                    let why = null;
                    try {
                        why = drawRoomStill(c, {
                            ...roomRecordOf(room, { parseOel: deps.parseOel }), level: i,
                        });
                    } catch (e) {
                        if (!(e instanceof Error)) throw e;
                        why = e.message;
                    }
                    still = { source, canvas: why ? null : c, why };
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
            if (typeof xml !== 'string') ctx.fillText('⛔embed', x + 4, top + 24);
            ctx.restore();
        });
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
        sel.innerHTML = '';
        for (let i = 0; i < Math.max(1, most); i += 1) {
            const o = el(doc, 'option', null, `#${i}`);
            o.value = String(i);
            sel.appendChild(o);
        }
        if (keep !== '' && Number(keep) < Math.max(1, most)) sel.value = keep;
        sel.disabled = most === 0;
    };

    const fillExitSelect = (id, room) => {
        const sel = $(id);
        if (!sel) return;
        sel.innerHTML = '';
        const row = rows[room];
        for (const ex of row?.exitList ?? []) {
            const o = el(doc, 'option', null,
                `#${ex.index} ${ex.element} → room ${ex.to} `
                + `@(${ex.playerx ?? '·'},${ex.playery ?? '·'})`);
            o.value = String(ex.index);
            sel.appendChild(o);
        }
        sel.disabled = (row?.exitList ?? []).length === 0;
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
        const target = record().set.rooms[room];
        let entities = [];
        if (target) {
            try {
                entities = roomRecordOf(target, { parseOel: deps.parseOel }).entities ?? [];
            } catch (e) {
                if (!(e instanceof Error)) throw e;
                entities = [];
            }
        }
        for (const ent of entities) {
            const value = JSON.stringify({ type: ent.type, x: ent.x, y: ent.y });
            const o = el(doc, 'option', null, `${ent.type} @(${ent.x},${ent.y})`);
            o.value = value;
            sel.appendChild(o);
        }
        sel.disabled = entities.length === 0;
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
        const fromExit = Number($('editSetExitList')?.value ?? 0);
        const toExit = Number($('editSetTargetExit')?.value ?? 0);
        applySet({
            op: 'connect',
            from: [armedExit.room, Number.isInteger(fromExit) ? fromExit : 0],
            to: [cell.tx, Number.isInteger(toExit) ? toExit : 0],
            one_way: Boolean($('editSetOneWay')?.checked),
        });
        armedExit = null;
        view.setTool(null);
    };

    const view = mountEditorView({
        canvas: overview,
        session,
        adapter,
        cellAt,
        /**
         * ⛔ A SET HAS NO BRUSH, AND THAT IS THE **THIRD ANSWER** rather than
         * `null`. "No brush is armed" would send the reader to a palette that
         * does not exist; this says what the strip is for.
         */
        brushOp: () => ({
            refused: 'a ROOM is not painted — the strip edits the SET. Use OPEN to edit a '
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
                onSetChange?.();
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
                onSetChange?.();
            }
            render();
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
            return { ok: false, applied: false, description: e.message };
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
             */
            onSetChange?.();
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
        selected = index;
        const sel = $('editSetRoom');
        if (sel) sel.value = String(index);
        render();
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

    const manifestRows = manifestFormRows(deps.levelSetSchema ?? null);
    const roomRows = roomFormRows();

    const renderManifest = () => {
        const box = $('editSetManifest');
        if (!box) return;
        const set = record().set;
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
        const cell = readSetCell(record(), selected, 0);
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
         * ⛔ **AN ENDPOINT THAT GATES NOTHING IS MARKED, NOT HIDDEN.** The op
         * accepts it, so hiding it would be a second authority; leaving it
         * unmarked would let a person gate a door the compiler will treat as
         * free. The option says which it is, in the derivation's own words.
         */
        for (const e of targets.exits) {
            const o = el(doc, 'option', null,
                `${exitRuleKey(e.id)}${e.gates ? '' : ' ⚠ gates NOTHING'}`);
            o.value = exitRuleKey(e.id);
            o.title = e.why ?? '';
            sel.appendChild(o);
        }
        for (const name of targets.locations) {
            const o = el(doc, 'option', null, locationRuleKey(name));
            o.value = locationRuleKey(name);
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
        const errs = deps.rulesSchema ? ruleSchemaErrors(tree, deps.rulesSchema) : [];
        out.textContent = errs.length === 0
            ? (deps.rulesSchema ? '⛓ the rule validates against `rules.schema.json`'
                : '⚠ no rules schema was fetched, so only the SHAPE is checked at commit')
            : `⛔ ${errs.join(' | ')}`;
        out.className = errs.length === 0 ? 'note' : 'note bad';
        return errs.length === 0 ? tree : null;
    };

    /* ── THE REPORT ────────────────────────────────────────────────── */

    let lastReport = null;

    const runReport = () => {
        const box = $('editSetReportOut');
        lastReport = reportOf(session, deps, {
            compileRegionAtlas, validateRegionAtlas, atlasSchema,
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
        line.textContent = `SET ${record().set.set_id ?? '(unstamped)'} · overlay `
            + `${record().overlay.overlay_id ?? '(unstamped)'} · ${view.describe()}`
            + (open ? ` · ROOM ${open.room} open with ${open.ops} edit(s)` : ' · no room open')
            + ` · ⌨ Ctrl+Z here hits the ${focusInSet ? 'SET' : 'ROOM'} session `
            + '(the strip owns its keys; focus it to undo the SET)';
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
        rows = roomRowsOf(record(), { links: scan.ok });
        if (selected >= roomCount()) selected = Math.max(0, roomCount() - 1);
        targets = ruleTargetsOf(record(), selected, deps);
        renderRooms();
        paintStrip();
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
     * ⛓ ADD ROOM starts from `emptyLevel` — the page's own blank record — and
     * hands it to `add-room` AS A RECORD (EDITOR v3 E1b). ⛔ No render: a new
     * room is exactly what the exporter would have written for it, and since
     * §22.8 that is the record itself. ⛔ APPENDED, and `add-room` refuses an
     * `at` outside `0..rooms.length` on its own.
     */
    on('editSetAddRoom', () => {
        if (!emptyLevel) {
            say('no `emptyLevel` was injected — ADD ROOM is unavailable here', true);
            return;
        }
        const at = roomCount();
        applySet({ op: 'add-room', record: emptyLevel(), name: `room ${at}` },
            { renumber: addRoomMapping(at), what: 'ADD ROOM' });
    });

    /**
     * ⛔ **THERE IS NO SECOND "CONNECT" BUTTON.** A button that took the same two
     * rooms from two `<select>`s would be a second spelling of the gesture, and
     * the first slice to change one would leave the other saying something else.
     * The gesture is the one way; the SELECTS are its parameters.
     */

    on('editSetDisconnect', () => {
        applySet({
            op: 'disconnect',
            room: selected,
            exitIndex: Number($('editSetExitList')?.value ?? 0),
        });
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
            setNote('⛔ pick an ENTITY first — `mark-location` names a body the room holds at '
                + 'exactly those pixels, and this room offers none', true);
            return;
        }
        let entity;
        try {
            entity = JSON.parse(raw);
        } catch (e) {
            setNote(`⛔ the entity could not be read — ${e.message}`, true);
            return;
        }
        applySet({
            op: 'mark-location',
            room: selected,
            entity,
            name: $('editSetLocName')?.value ?? '',
            vanilla_item: $('editSetLocItem')?.value ?? '',
        });
    });

    on('editSetReport', () => { runReport(); render(); });

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
        closeRoomSession(session, open.session, open.room);
        discardRoom();
        stills.clear();
        say(`the room session on room ${open.room} was CLOSED into the SET — ${open.ops} room `
            + 'edit(s) became ONE `replace-room`');
        render();
        onSetChange?.();
    });

    /**
     * ⛓⛓⛓ **THREE DOCUMENTS, ONE STAMP, ONE PRESS** (§20.6). `downloadSet`
     * validates, stamps ONCE and hands back the set, the overlay and the
     * `apMappingInvalidation` companion. Five ops then one press is ONE new
     * `set_id`.
     *
     * ⛔ THE ERRORS ARE A **LIST**, through `validateForDownload` — §20.11 #5.
     * `downloadSet` quotes them into one throw, which is right for a module and
     * wrong for a form.
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
                + 'SET session, and the download stamps once over everything.', true);
            return;
        }
        const check = validateForDownload(session);
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
            setNote(`⛔ NOT DOWNLOADED — the set does not validate (${check.errors.length} `
                + 'error(s), listed in the REPORT box below)', true);
            return;
        }
        const out = downloadSet(session);
        const indent = indentNow();
        download(`${out.set.set_id}.json`, `${JSON.stringify(out.set, null, indent)}\n`,
            'application/json');
        download(`${out.overlay.overlay_id}.overlay.json`,
            `${JSON.stringify(out.overlay, null, indent)}\n`, 'application/json');
        download(`${out.set.set_id}.apmapping.json`,
            `${JSON.stringify(out.apMapping, null, indent)}\n`, 'application/json');
        setNote(`DOWNLOADED ${out.set.set_id} · overlay ${out.overlay.overlay_id} · the `
            + `apMapping companion — ONE stamp for ${out.report.edits} edit(s)`
            + (out.report.warnings.length ? ` ⚠ ${out.report.warnings.join(' | ')}` : ''));
        /**
         * ⛓ …AND WHAT IT WROTE IS READABLE. A browser download is a blob and a
         * click; the CLAIM is that the three documents round trip, so they are
         * put where a driver can read them (C2's own reason for `__editorSetOut`).
         */
        globalThis.__editorSetOut = out.set;
        globalThis.__editorSetOverlayOut = out.overlay;
        globalThis.__editorSetMappingOut = out.apMapping;
        render();
        onSetChange?.();
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
     * ⛓ **AND THE IDS ARE THE THREE-BLOB DOWNLOAD'S IDS.** It goes through the
     * SAME `downloadSet(session)` — validated, stamped ONCE — so `set_id` and
     * `overlay_id` inside the zip are the ones the separate presses write. §21.9
     * holds: this is a fourth WAY to press, not a fourth stamp.
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
                + 'as the three-blob download does.', true);
            return;
        }
        const check = validateForDownload(session);
        if (!check.ok) {
            setNote(`⛔ NOT BUNDLED — the set does not validate (${check.errors.length} `
                + `error(s)): ${check.errors.join(' · ')}`, true);
            return;
        }
        const out = downloadSet(session);
        const rep = lastReport ?? runReport();
        const members = [
            { kind: 'level-set', doc: out.set },
            { kind: 'overlay', doc: out.overlay },
        ];
        const notes = [];
        if (rep.download.rules.allowed && rep.rules) {
            members.push({ kind: 'rules', doc: rep.rules });
            if (rep.atlas) members.push({ kind: 'region-atlas', doc: rep.atlas });
        } else {
            notes.push(`no \`rules.json\` member — ${rep.download.rules.why}`);
        }
        notes.push('the `apMapping` companion is NOT a member — it is a DERIVED table '
            + 'regenerated per set; press the three-blob download for it');
        const indent = indentNow();
        let bytes;
        try {
            bytes = await writeBundle(members, { jszip: await loadZip(), indent });
        } catch (e) {
            setNote(`⛔ NOT BUNDLED — ${e.message}`, true);
            return;
        }
        download(`${out.set.set_id}.zip`, bytes, 'application/zip');
        /**
         * ⛓ …AND WHAT IT WROTE IS READABLE, like every other download on this
         * page (C2's own reason for `__editorSetOut`): the BYTES, so a row can
         * read the zip back in node, and the member kinds, so a row can ask what
         * the press decided without unzipping first.
         */
        globalThis.__editorSetBundleOut = bytes;
        globalThis.__editorSetBundleKinds = members.map((m) => m.kind);
        setNote(`BUNDLED ${out.set.set_id}.zip — ${members.length} member(s) `
            + `(${members.map((m) => m.kind).join(', ')}), ${bytes.length} bytes at indent `
            + `${indent}${indent === 0 ? ' (MINIFIED)' : ''} · ${notes.join(' | ')}`);
        render();
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
