/**
 * procgenCore/setEditorCore — **THE SET EDITOR'S SUBSTRATE-FREE HALF.**
 *
 * EDITOR v3 arc, slice E2a (`NewDocs/plans/seedling-editor-v3.md` §22.3, §26).
 * D2 built the whole set editor inside `seedlingDemo/watchSetEditor.js`, and
 * §22.1 #7 then MEASURED how much of it was Seedling-shaped: the rooms strip,
 * the reorder permutation, the renumbering ruling, the arrow shapes, the
 * gateability answer, the free-edge scan and the REPORT's sections 3–4 read
 * NOTHING a level set owns — they read a positionally addressed LIST of rooms,
 * an overlay keyed by room index, a derived region atlas and a compiled
 * rules.json, all four of which are the toolkit's own documents.
 *
 * ⇒ this file is that half MOVED (not copied) so a SECOND substrate can have
 * it. `watchSetEditor.js` re-exports every name below by the SAME function
 * object, so D2's rows and `check-seedling-editor-arm.mjs` are byte-inert;
 * `mazeRoom/mazeSetAdapter.js` is the first caller that is not Seedling's.
 *
 * ── ⛔⛔ WHAT "SUBSTRATE-FREE" IS ENFORCED BY, AND IT IS NOT THIS DOCBLOCK ──
 *
 * `procgenCore/bindingContract.test.js` reads this DIRECTORY and asserts every
 * shipping module imports nothing from `seedlingDemo/`, `mazeRoom/` or
 * `flashPanel/`. This file arrived under that law the moment it existed. The
 * four things it would otherwise have reached for are therefore PARAMETERS:
 *
 *   ·  the adapter's readers — `readSetCell`, `exitsOfRoom`, `whatLinksHere`
 *      and the substrate's own refusal test (`roomRowsOf`);
 *   ·  the adapter's document functions — `validateForDownload`,
 *      `deriveAtlasOf`, `rulesJsonOf`, `bounds` (`reportOver`);
 *   ·  the rule-target key SPELLING — `ruleKeys.exit` / `ruleKeys.location`,
 *      the builders, so nothing here types a `'exit:'` literal;
 *   ·  the document's own NOUN — what §1 of the report calls the thing it
 *      validated, which is a level set for Seedling and a region library for
 *      the maze.
 *
 * ⚠ **`linkScanBound` DELIBERATELY DID NOT MOVE.** It prices a SEEDLING
 * quantity (OEL bytes, then record entities — §24.7's re-measurement), and the
 * maze's analogue is a different quantity over a different structure. Each
 * substrate prices its own scan; the COLUMN the price gates is here.
 */

import {
    DEFAULT_PLAYER_ID, reachableRegions, regionsOf, startRegionsOf,
} from './rulesGraph.js';

export class SetEditorCoreError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SetEditorCoreError';
    }
}

const fail = (message) => { throw new SetEditorCoreError(message); };

const need = (fn, what, where) => {
    if (typeof fn !== 'function') {
        fail(`setEditorCore: ${where} needs \`${what}\` injected — this module may not import a `
            + 'substrate binding (`bindingContract.test.js` is the gate), so every reader of a '
            + 'set document is handed in by the adapter that owns it.');
    }
    return fn;
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE ROOMS LIST
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **ONE ROW PER ROOM, DERIVED FROM THE RECORD** — never from a list a page
 * keeps. `bounds().w` is the room count and `readSetCell` is the cell
 * descriptor, so the list is a view of exactly what the adapter addresses.
 *
 * ⛔ A ROOM THE ADAPTER CANNOT READ IS NAMED, not dropped — `exitsOfRoom`
 * refuses by name and that sentence becomes the row's `why`, the same law
 * `whatLinksHere` keeps about `unreadable`.
 *
 * @param {object} record the adapter's record
 * @param {object} o
 * @param {boolean} [o.links] compute the "links here" count for every room —
 *   `false` when the substrate's own scan bound says it does not fit, and the
 *   column reads `null` rather than `0`.
 * @param {Function} o.readSetCell   `(record, x, 0) => {room, overlay}`
 * @param {Function} o.exitsOfRoom   `(record, room) => exits[]`, may REFUSE
 * @param {Function} o.whatLinksHere `(record, room) => {links, unreadable}`
 * @param {Function} o.bounds        `(record) => {w, h}`
 * @param {Function} o.isRefusal     `(e) => boolean` — the substrate's own
 *   refusal classes; anything else is re-thrown, because swallowing a
 *   `TypeError` here would make a defect look like a room the adapter declined.
 */
export function roomRowsOf(record, {
    links = true, readSetCell, exitsOfRoom, whatLinksHere, bounds, isRefusal,
} = {}) {
    need(readSetCell, 'readSetCell', 'roomRowsOf');
    need(exitsOfRoom, 'exitsOfRoom', 'roomRowsOf');
    need(whatLinksHere, 'whatLinksHere', 'roomRowsOf');
    need(bounds, 'bounds', 'roomRowsOf');
    need(isRefusal, 'isRefusal', 'roomRowsOf');
    const count = bounds(record).w;
    const indices = Array.from({ length: count }, (_, i) => i);
    const inbound = links ? indices.map((i) => whatLinksHere(record, i)) : null;
    return indices.map((index) => {
        const cell = readSetCell(record, index, 0);
        let exits = null;
        let why = null;
        try {
            exits = exitsOfRoom(record, index);
        } catch (e) {
            if (!isRefusal(e)) throw e;
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
        fail(`setEditorCore: moveOrder needs a room count, got ${JSON.stringify(count)}`);
    }
    const to = index + delta;
    if (!Number.isInteger(index) || index < 0 || index >= count) {
        fail(`setEditorCore: room ${index} is outside 0..${count - 1}`);
    }
    if (to < 0 || to >= count) {
        fail(`setEditorCore: room ${index} cannot move ${delta > 0 ? 'DOWN' : 'UP'} — it is `
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
 * into a room replacement nobody asked for, and it would land in the same
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
 * level set IS a positionally addressed LIST, and the maze's region LIBRARY is
 * the same shape one substrate over. ⛔ A square grid of rooms would have needed
 * a SECOND coordinate system: `editorView`'s painter derives its cell size from
 * `adapter.bounds`, `cellAt` must answer in the adapter's coordinates, and
 * `rectCopy`/`rectPasteOps` address rooms in them. A page that laid the rooms
 * out 6-across would be maintaining a mapping between the picture and the
 * document for no gain but the aspect ratio.
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
 * ⛓ IT CONSUMES INTEGER ROOM INDICES AND NOTHING ELSE — `row.exitList[].to` is
 * a room index whatever produced it, which is why this function crossed to the
 * core unchanged.
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
 * ⛓⛓⛓ RULE AUTHORING — the targets, derived ONCE per selection (§20.11 #4)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **WHICH ENDPOINTS A RULE CAN ACTUALLY GATE — MEASURED, NOT ASSUMED.**
 *
 * ⛔⛔ **AN ARRIVAL ENDPOINT GATES NOTHING, AND SEEDLING'S ADAPTER ACCEPTS A
 * RULE ON ONE.** Measured 2026-08-25 against `regionAtlasCompiler.js:320-347`:
 * for a connection with `one_way: true` the `to` endpoint is recorded as
 * `{apExitName: null, arrivalOnly: true}` and **no AP exit is built for it**, so
 * its `access_rule` reaches nothing. An UNWIRED endpoint is omitted from the
 * graph outright and reaches nothing either.
 *
 * ⇒ a rule authored on one of those is exactly the failure `applyOverlayRules`
 * refuses in its own words: *"the author believing a door is gated and the
 * compiler treating it as free"*. The list therefore MARKS them, and the REPORT
 * names any that were authored anyway.
 *
 * ⛓ THIS IS THE ANSWER `mazeSetAdapter.set-access-rule` REFUSES ON (E2a) and
 * that E3 will make Seedling's op refuse on: ONE reading of the atlas, two
 * readers.
 *
 * @returns {{gates: boolean, why: string|null}}
 */
export function gateabilityOf(atlas, regionId, exitId) {
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
 * derivation's, so asking for one means building the atlas — §20.11 #4's
 * *"correct, and not free"*. A location is named by the `mark-location` op's
 * own `name` and lives in the overlay, so it is read directly. ⇒ this is called
 * on SELECTION CHANGE, never on a keystroke.
 *
 * @returns {{exits: object[], locations: string[], why: string|null}}
 */
export function ruleTargetsOver(record, room, deps, { deriveAtlasOf } = {}) {
    need(deriveAtlasOf, 'deriveAtlasOf', 'ruleTargetsOver');
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

/**
 * The two rule-target spellings, as the overlay keys them.
 *
 * ⛓ `ruleKeys` is the pair of BUILDERS the substrate's overlay module exports
 * (`exitRuleKey` / `locationRuleKey`), so no prefix is ever typed here.
 */
export function ruleTargetKeys(targets, ruleKeys = {}) {
    need(ruleKeys.exit, 'ruleKeys.exit', 'ruleTargetKeys');
    need(ruleKeys.location, 'ruleKeys.location', 'ruleTargetKeys');
    return [
        ...targets.exits.map((e) => ruleKeys.exit(e.id)),
        ...targets.locations.map((name) => ruleKeys.location(name)),
    ];
}

/**
 * ⛓⛓ **EVERY AUTHORED EXIT RULE THAT GATES NOTHING** — the overlay's `rules`
 * map read against the derived atlas. ⛔ Named rather than counted, because
 * "3 rules do nothing" and "the rule on `in_L0_128_128` of room 1 does nothing"
 * are the same verdict and very different findings.
 *
 * ⛔ **THE `exit:` PREFIX IS THE INJECTED BUILDER'S, NOT A LITERAL.** It was a
 * literal in `watchSetEditor` and a second substrate is exactly the thing that
 * would have made it wrong silently — `ruleKeys.exit('')` is the prefix by
 * construction, so the reader and the writer cannot disagree.
 */
export function inertRulesOf(record, atlas, { ruleKeys } = {}) {
    need(ruleKeys?.exit, 'ruleKeys.exit', 'inertRulesOf');
    const prefix = ruleKeys.exit('');
    const out = [];
    for (const [key, entry] of Object.entries(record?.overlay?.rooms ?? {})) {
        const room = Number(key);
        const region = (atlas?.regions ?? []).find((r) => r.map_ref === room);
        for (const target of Object.keys(entry?.rules ?? {})) {
            if (!target.startsWith(prefix)) continue;
            const exitId = target.slice(prefix.length);
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
 * ⛓⛓⛓ **THE REPORT, AS DATA, OVER ANY SET SUBSTRATE.** Every row is
 * `{severity, kind, text}` and a DOM only renders them — which is what makes
 * the whole verdict testable in node and printable as a LIST rather than as a
 * paragraph (§16.4: *"an unreachable graph REFUSES the rules.json download by
 * name"*).
 *
 * ⛔ **THE REFUSAL IS COMPUTED HERE AND NOTHING ELSE DECIDES IT.** `download`
 * carries `{rules: {allowed, why}}`; the button reads it. A page that disabled
 * the button on its own condition would be a second answer to *"may this be
 * exported"*.
 *
 * ⚠ THE SET AND OVERLAY DOWNLOADS ARE **NOT** GATED BY THIS. A person may want
 * to save work on a graph that does not yet close, and refusing that would make
 * the editor unusable exactly when it is most needed.
 *
 * ── ⛓ WHAT SECTION 1 TAKES FROM THE SUBSTRATE, AND WHY IT IS FOUR STRINGS ──
 *
 * Section 1 validates the SET DOCUMENT, and every word of that row is about a
 * document this module has never heard of: which validator ran, what the thing
 * is called, and which id it stamps. `document` carries exactly those, so the
 * sentence stays the substrate's own and the STRUCTURE stays here.
 *
 * @param {object} o
 * @param {object} o.session      the set session
 * @param {object} [o.deps]       the derivation deps, passed through verbatim
 * @param {object} o.adapterFns   `{validateForDownload, deriveAtlasOf, rulesJsonOf, bounds}`
 * @param {object} o.document     `{kind, noun, validator, idOf}`
 * @param {object} o.ruleKeys     `{exit, location}` — the key BUILDERS
 * @param {Function} o.compileRegionAtlas
 * @param {Function} [o.validateRegionAtlas]
 * @param {object} [o.atlasSchema]
 * @param {string} [o.playerId]
 */
export function reportOver({
    session, deps = {}, adapterFns = {}, document: doc = {}, ruleKeys,
    compileRegionAtlas, validateRegionAtlas, atlasSchema = undefined,
    playerId = DEFAULT_PLAYER_ID,
} = {}) {
    const validateForDownload = need(adapterFns.validateForDownload, 'adapterFns.validateForDownload', 'reportOver');
    const deriveAtlasOf = need(adapterFns.deriveAtlasOf, 'adapterFns.deriveAtlasOf', 'reportOver');
    const rulesJsonOf = need(adapterFns.rulesJsonOf, 'adapterFns.rulesJsonOf', 'reportOver');
    const bounds = need(adapterFns.bounds, 'adapterFns.bounds', 'reportOver');
    const idOf = need(doc.idOf, 'document.idOf', 'reportOver');
    if (typeof doc.kind !== 'string' || typeof doc.noun !== 'string'
        || typeof doc.validator !== 'string') {
        fail('setEditorCore: reportOver needs `document` = {kind, noun, validator, idOf} — the '
            + 'row that says whether the SET DOCUMENT is valid names the validator that ran and '
            + 'the thing it validated, and neither is this module\'s to invent.');
    }

    const rows = [];
    const add = (severity, kind, text) => rows.push(Object.freeze({ severity, kind, text }));
    const record = session.record();

    /* 1 ── the SET DOCUMENT itself, through the same door the download uses */
    const setCheck = validateForDownload(session);
    for (const e of setCheck.errors) add('error', doc.kind, e);
    for (const w of setCheck.warnings) add('warn', doc.kind, w);
    if (setCheck.ok && setCheck.warnings.length === 0) {
        add('ok', doc.kind, `${doc.validator}: ok — ${bounds(record).w} room(s), `
            + `stamped ${idOf(setCheck)}`);
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
    const inert = inertRulesOf(record, derived.atlas, { ruleKeys });
    for (const r of inert) {
        add('error', 'inert-rule', `the rule authored on exit "${r.exitId}" of room ${r.room} `
            + `REACHES NOTHING — ${r.why}`);
    }
    /**
     * ⛓ `record.overlay?.rooms` — OPTIONAL, and EDITOR INTEGRATION W2's
     * measurement 4 is why. This was the ONE unguarded read of the overlay half
     * in this function, beside two (`inertRulesOf`, `overlayLocationCount`)
     * that already went through `?.`, so a record with no `overlay` at all died
     * here with a `TypeError` about `rooms` rather than reporting anything. A
     * WORLD's record is `{world, parts}` — its parts' overlays live INSIDE the
     * world document, keyed by part — so it is the first such record, and the
     * crash would have been in the REPORT rather than in the thing under test.
     * ⚠ The row it guards then simply does not fire: a substrate whose record
     * carries no overlay has no authored exit rules for this scan to find, and
     * saying "every authored rule gates something" over nothing would be a true
     * sentence about the wrong subject.
     */
    if (inert.length === 0 && Object.keys(record.overlay?.rooms ?? {}).length > 0) {
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
                        : `the ${doc.noun} itself is not valid: ${setCheck.errors.join(' | ')}`,
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
