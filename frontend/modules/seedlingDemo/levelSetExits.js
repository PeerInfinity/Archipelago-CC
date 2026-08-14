/**
 * seedlingDemo/levelSetExits — EXIT DESTINATIONS AS DATA.
 *
 * Phase 5b of `CC/docs/plans/seedling-external-level-sets.md` (§4.6, §5). The
 * last slice of the arc, and the one that makes a generated set a GAME rather
 * than a pile of rooms.
 *
 * ── ⛔ §4.6 SAYS "REWRITE". FOR THE CASE THAT BLOCKS, THERE IS NOTHING TO ─────
 *
 * §4.6 was written when vanilla was the only set in existence, so it describes
 * randomizing exits that already exist: *rewrite* `to`/`playerx`/`playery`/
 * `sign`. Phase 5 then measured that **no generated room has an exit at all**
 * (§14.2 #4) — the palette places obstacles, not transitions — and a six-room
 * export reports **1/6 reachable**. Rewriting nothing produces nothing.
 *
 * ⇒ THIS MODULE DOES BOTH, and they are one operation seen twice. The primitive
 * is *"give this exit a destination"*: `(to, playerx, playery, sign)` written
 * onto one exit in one room's data. A vanilla-derived set has exits to point
 * elsewhere (RETARGET, `retargetRoomXml`); a generated set has none, so it must
 * be given them first (EMIT, `linkGeneratedRooms`). Neither is a superset of the
 * other and neither alone closes §5.
 *
 * ── ⛔⛔ AND `sign` IS NOT DESTINATION METADATA. MEASURED, AND §4.6 IS WRONG ──
 *
 * §4.6: *"`sign` is destination metadata and lives on the SOURCE teleporter…
 * Rewrite `to` and leave `sign` and the new room announces the old room's
 * name."* The diagnosis is right and the rule it implies — *rewrite `sign` with
 * the destination* — is not implementable as stated, because `sign` is not a
 * function of the destination. Measured over the vanilla 116 (all 280 exits and
 * all 12 fallthroughs):
 *
 *   ·  8 transitions carry a non-zero sign, into 7 distinct destination rooms
 *   ·  those 8 use all seven values of `Message.as`'s closed table
 *   ·  **no destination is entered with two different non-zero signs** — so a
 *      room's region, where it is stated at all, is unambiguous
 *   ·  **all 7 of those destinations are ALSO entered by UNSIGNED exits** (7/7)
 *
 * If `sign` were a property of the destination, every entrance to room 13 would
 * carry sign 1. One of three does. `sign` is a property of the TRANSITION: room
 * 0 is outside Gundernourd and room 13 is inside, so that doorway announces —
 * the other two entrances come from rooms already inside the region and say
 * nothing.
 *
 * ⇒ THE RULE THIS MODULE IMPLEMENTS:
 *
 *     sign(A -> B) = region(B)  when region(B) != region(A) and region(B) != 0
 *                    0          otherwise
 *
 * and `region` is an INPUT, never inferred. Vanilla names the region of 7 of its
 * 116 rooms and says nothing about the other 109, so there is no honest way to
 * derive the map from the data. When no region is declared, every rewritten exit
 * announces NOTHING and the count is REPORTED — because announcing the wrong
 * region is worse than announcing none, and carrying the source's old sign
 * (which is what "rewrite `to` and leave `sign`" does) is worst of all: it names
 * the room the player did not go to.
 *
 * ── ⛓ ARRIVING ON THE RETURN PORTAL IS LEGAL, AND VANILLA DEPENDS ON IT ──────
 *
 * The obvious hazard of a two-way link is the warp loop: land on the portal that
 * sends you back and bounce forever. It does not happen, and the reason is a
 * latch rather than luck:
 *
 *   ·  `Teleporter.update()` warps only `if (collide(Player) && !playerTouching)`
 *   ·  `Teleporter.check()` sets `playerTouching = true` when the player overlaps
 *   ·  `Game.update()` runs EVERY entity's `check()` behind a `!checked` latch
 *      **before** `super.update()` — so on the first frame of a new world the
 *      portal under the player is already latched, and its own `update()` that
 *      same frame does not fire.
 *
 * MEASURED, not assumed: **vanilla does this four times** — 11↔3, 88↔87, 97↔37
 * (`stairsup` onto `stairsdown`) and 107↔102, in every case landing the player
 * exactly on the exit that points back. A validator rule refusing it would have
 * refused the real game, which is this arc's §9.3 lesson for the third time.
 *
 * ⇒ this module lands each arrival ON the destination's return door. It is what
 * the game itself does, it needs no second free cell, and it makes a two-way
 * link symmetric by construction. ⚠ It is also a DEPENDENCY ON THAT LATCH: a
 * change to the order of `check()` and `update()` in `Game.update()` turns every
 * two-way link in every generated set into an infinite warp, so it is written
 * down here rather than left to be rediscovered.
 *
 * ── WHAT THE FLOOD PROVES, AND WHAT IT DOES NOT ──────────────────────────────
 *
 * `reachabilityOf` (the exporter) walks the DATA: it says a `to` exists and is
 * in range. It cannot see whether the player can stand on the thing carrying it,
 * so on its own it would report 6/6 for six rooms whose exits are sealed inside
 * walls. Door cells are therefore chosen from `walkableCellsFrom` — a flood over
 * the room's real collision world (`buildLevelWorld` + `playerBoxAt`), from the
 * room's own start cell, with **every solid live**: locks closed, blocks
 * unpushed, nothing cleared.
 *
 * ⚠ THAT IS CONSERVATIVE, AND THE BOUND IS A DESIGN CONSEQUENCE WORTH SAYING:
 * an exit reachable with no puzzle solved means a room's own obstacle does not
 * GATE its exit. Gating exits behind the room's puzzle is a level-design
 * decision this slice does not make, and making it would need a solver run per
 * candidate — which `procgenOracle:503` makes non-deterministic under load, so
 * it would trade a stated bound for a set that does not reproduce.
 *
 * ⚠ AND THE FLOOD IS CELL-CENTRE, 4-CONNECTED. That is exact for this corpus
 * (every generated solid is a tile-aligned 16x16 and the player's box is 4x5, so
 * an orthogonal step between two free cell centres crosses only those two
 * cells) and would NOT be exact for a room containing off-grid geometry. The
 * bound is named because a later palette that places a half-tile solid breaks
 * the argument silently.
 *
 * Headless-safe: no `node:` imports and no DOM.
 */

import { buildLevelWorld, TILE_SIZE, rect } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import {
    SIGN_NONE, SIGN_TABLE_SIZE, parseRoomXml, stampLevelSetIdentity,
} from './levelSetValidator.js';

export class LevelSetExitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LevelSetExitError';
    }
}

const fail = (message) => { throw new LevelSetExitError(message); };

/**
 * The three elements that carry `@to`/`@playerx`/`@playery`/`@sign`.
 * `Stairs extends Teleporter` and `Game.as:2261-2263` builds all three from the
 * same four attributes — measured: 228 teleporters + 52 stairs over the 116.
 */
export const EXIT_ELEMENTS = Object.freeze(['teleporter', 'stairsup', 'stairsdown']);

/** A region a set never names. `sign="0"` means "announce nothing". */
export const REGION_NONE = SIGN_NONE;

/** `Message.as` holds exactly seven titles; the table is CLOSED (§8.2c). */
export const MAX_REGION = SIGN_TABLE_SIZE;

/**
 * The sign a transition carries — the rule this module exists to get right.
 *
 * ⛔ NOT `region(to)`. A room entered from inside its own region announces
 * nothing; vanilla's 7 signed destinations are each entered by unsigned exits
 * too. See the header.
 */
export function signForTransition(fromRegion, toRegion) {
    const a = Number.isInteger(fromRegion) ? fromRegion : REGION_NONE;
    const b = Number.isInteger(toRegion) ? toRegion : REGION_NONE;
    if (b === REGION_NONE) return SIGN_NONE;
    if (b === a) return SIGN_NONE;
    if (b < 0 || b > MAX_REGION) {
        fail(`levelSetExits: region ${b} is outside 1..${MAX_REGION} — Message.as holds `
            + `exactly ${MAX_REGION} titles and the table is CLOSED (a set cannot name an `
            + 'eighth region without an AS3 change)');
    }
    return b;
}

const cellKey = (tx, ty) => `${tx},${ty}`;

/**
 * The cells a player can stand on, flooded from `start`, with every solid LIVE.
 *
 * @returns {Map<string, {tx, ty, dist, from: {tx,ty}|null}>} in flood order;
 *          `from` is the neighbour it was reached through, which is what lets a
 *          caller walk INTO a door cell from a cell it knows is free.
 */
export function walkableCellsFrom(record, start) {
    if (record === null || typeof record !== 'object') {
        fail('levelSetExits: walkableCellsFrom needs a level record');
    }
    if (!start || !Number.isInteger(start.tx) || !Number.isInteger(start.ty)) {
        fail('levelSetExits: walkableCellsFrom needs an integer {tx, ty} start cell');
    }
    const world = buildLevelWorld(record);
    const free = (tx, ty) => {
        if (tx < 0 || ty < 0 || tx >= record.width || ty >= record.height) return false;
        const cx = tx * TILE_SIZE + TILE_SIZE / 2;
        const cy = ty * TILE_SIZE + TILE_SIZE / 2;
        return world.collidesSolid(playerBoxAt(cx, cy), {}) === null;
    };
    const out = new Map();
    if (!free(start.tx, start.ty)) {
        fail(`levelSetExits: the start cell (${start.tx}, ${start.ty}) is SOLID in this room — `
            + 'a room whose own start is inside a wall cannot be the origin of a reachability '
            + 'claim, and every door this module places would be reachable from nowhere');
    }
    // Breadth-first, so `dist` is a real hop count and the order is stable.
    const queue = [{ tx: start.tx, ty: start.ty, dist: 0, from: null }];
    out.set(cellKey(start.tx, start.ty), queue[0]);
    for (let head = 0; head < queue.length; head += 1) {
        const at = queue[head];
        // ⚠ FIXED ORDER, because the flood's order decides which cell wins a
        // distance tie and therefore which cell becomes a door. A set that
        // reordered this would still validate and would not reproduce.
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const tx = at.tx + dx;
            const ty = at.ty + dy;
            const key = cellKey(tx, ty);
            if (out.has(key) || !free(tx, ty)) continue;
            const next = { tx, ty, dist: at.dist + 1, from: { tx: at.tx, ty: at.ty } };
            out.set(key, next);
            queue.push(next);
        }
    }
    return out;
}

/** The cells an entity already occupies, so a door never lands on one. */
export function occupiedCells(record) {
    const out = new Set();
    for (const e of record?.entities ?? []) {
        if (!Number.isInteger(e?.x) || !Number.isInteger(e?.y)) continue;
        out.add(cellKey(Math.floor(e.x / TILE_SIZE), Math.floor(e.y / TILE_SIZE)));
    }
    return out;
}

/** The direction key that walks from `a` to the orthogonally adjacent `b`. */
export function approachKey(a, b) {
    if (a.tx === b.tx && a.ty === b.ty - 1) return 'down';
    if (a.tx === b.tx && a.ty === b.ty + 1) return 'up';
    if (a.ty === b.ty && a.tx === b.tx - 1) return 'right';
    if (a.ty === b.ty && a.tx === b.tx + 1) return 'left';
    return fail(`levelSetExits: (${a.tx}, ${a.ty}) and (${b.tx}, ${b.ty}) are not orthogonally `
        + 'adjacent, so there is no single direction that walks between them');
}

/**
 * The undirected links of a set's exit graph.
 *
 * ⛔ TWO-WAY BY DEFAULT AND THAT IS NOT A STYLE CHOICE: a one-way chain is a set
 * the player cannot leave, `validateLevelSet` warns on every one of them, and
 * §4.6's own pairing note asks for the check. `chain` connects 0-1-…-N-1;
 * `ring` closes it. Both give full reachability; the ring costs every room two
 * door cells, which a small room with many obstacles may not have.
 */
export function planTopology(roomCount, { kind = 'chain' } = {}) {
    if (!Number.isInteger(roomCount) || roomCount < 1) {
        fail(`levelSetExits: planTopology needs a room count, got ${JSON.stringify(roomCount)}`);
    }
    if (kind !== 'chain' && kind !== 'ring') {
        fail(`levelSetExits: topology "${kind}" is not one of chain, ring`);
    }
    const links = [];
    for (let i = 0; i + 1 < roomCount; i += 1) links.push({ a: i, b: i + 1 });
    if (kind === 'ring' && roomCount > 2) links.push({ a: roomCount - 1, b: 0 });
    return links;
}

/**
 * GIVE A SET OF GENERATED ROOMS ITS EXITS — the EMIT arm.
 *
 * @param {Array<{record: object, start?: {tx,ty}}>} rooms  in SET ORDER; index is the level id
 * @param {object} [options]
 * @param {string} [options.topology]        `chain` (default) or `ring`
 * @param {Array<{a,b}>} [options.links]     an explicit link list, overriding `topology`
 * @param {number[]} [options.regions]       room -> region (0 = unnamed); see the header
 * @param {string} [options.element]         which exit element to emit; default `teleporter`
 * @returns {{records: object[], doors: object[], report: object}}
 */
export function linkGeneratedRooms(rooms, options = {}) {
    if (!Array.isArray(rooms) || rooms.length === 0) {
        fail('levelSetExits: linkGeneratedRooms needs a non-empty array of rooms');
    }
    const element = options.element ?? 'teleporter';
    if (!EXIT_ELEMENTS.includes(element)) {
        fail(`levelSetExits: "${element}" does not carry @to — the exit elements are `
            + `${EXIT_ELEMENTS.join(', ')} (Game.as:2261-2263)`);
    }
    const regions = options.regions ?? [];
    const links = options.links ?? planTopology(rooms.length, { kind: options.topology });
    for (const l of links) {
        if (!Number.isInteger(l?.a) || !Number.isInteger(l?.b)
            || l.a < 0 || l.b < 0 || l.a >= rooms.length || l.b >= rooms.length) {
            fail(`levelSetExits: link ${JSON.stringify(l)} names a room outside 0..${rooms.length - 1}`);
        }
        if (l.a === l.b) {
            fail(`levelSetExits: link ${JSON.stringify(l)} joins room ${l.a} to itself`);
        }
    }

    // --- pass 1: every room's walkable component, and one door cell per link ---
    //
    // ⛓ ALL OF A ROOM'S DOORS COME OUT OF ONE FLOOD, which is the property that
    // makes the SET traversable rather than merely connected in the data: a
    // player arriving at any door of a room is in the same component as every
    // other door of that room, so they can always leave again.
    const needs = rooms.map(() => []);
    links.forEach((l, i) => { needs[l.a].push(i); needs[l.b].push(i); });

    const floods = [];
    const doorOf = new Map();          // `${room}:${linkIndex}` -> cell
    rooms.forEach((room, id) => {
        const record = room?.record ?? room;
        const start = room?.start ?? { tx: 1, ty: 1 };
        const flood = walkableCellsFrom(record, start);
        floods.push({ flood, start });
        const taken = occupiedCells(record);
        // ⛔ THE ROOM'S OWN START IS NEVER A DOOR. Room 0's start is where the
        // player boots; a door there is a portal the player is standing on
        // before they have pressed anything, and stepping off and back on warps
        // them out of the set's first room by accident.
        taken.add(cellKey(start.tx, start.ty));
        const candidates = [...flood.values()]
            .filter((c) => !taken.has(cellKey(c.tx, c.ty)))
            // Farthest first, so two doors of one room end up apart rather than
            // adjacent. Ties broken by (ty, tx) — a total order, so the choice
            // does not depend on Map iteration.
            .sort((p, q) => (q.dist - p.dist) || (p.ty - q.ty) || (p.tx - q.tx));
        if (candidates.length < needs[id].length) {
            fail(`levelSetExits: room ${id} needs ${needs[id].length} door cell(s) and its `
                + `walkable component offers ${candidates.length} free cell(s) (flood of `
                + `${flood.size} from (${start.tx}, ${start.ty}), ${taken.size} occupied). `
                + 'A door outside the component would be an exit the player cannot reach, '
                + 'which is exactly what reachabilityOf cannot see.');
        }
        needs[id].forEach((linkIndex, n) => {
            doorOf.set(`${id}:${linkIndex}`, candidates[n]);
        });
    });

    // --- pass 2: the exits themselves ----------------------------------------
    //
    // Each direction of a link is one exit: A's door -> B, landing the player on
    // B's door for the same link. See the header on why landing ON it is right.
    const added = rooms.map(() => []);
    const doors = [];
    let announced = 0;
    let silent = 0;
    links.forEach((l, i) => {
        for (const [from, to] of [[l.a, l.b], [l.b, l.a]]) {
            const here = doorOf.get(`${from}:${i}`);
            const there = doorOf.get(`${to}:${i}`);
            const sign = signForTransition(regions[from] ?? REGION_NONE, regions[to] ?? REGION_NONE);
            if (sign === SIGN_NONE) silent += 1; else announced += 1;
            added[from].push({
                type: element,
                x: here.tx * TILE_SIZE,
                y: here.ty * TILE_SIZE,
                attrs: {
                    to,
                    playerx: there.tx * TILE_SIZE,
                    playery: there.ty * TILE_SIZE,
                    // `Game.as:2263` reads an ABSENT tag as -1; written out so a
                    // reader does not have to know that. -1 = never deactivated.
                    tag: -1,
                    // Visible, because a generated room has no other cue that a
                    // cell is a door (`Teleporter`'s `_show` gates the sprite).
                    show: 1,
                    sign,
                },
            });
            // ⛓ THE WITNESS THE ROUND TRIP DRIVES. `approach` is the flood's own
            // predecessor of the door cell — free by construction and adjacent —
            // so a tape can boot there, hold `key`, and walk into the portal.
            const approach = here.from;
            doors.push({
                room: from,
                to,
                link: i,
                cell: { tx: here.tx, ty: here.ty },
                oel: { x: here.tx * TILE_SIZE, y: here.ty * TILE_SIZE },
                arrival: { x: there.tx * TILE_SIZE, y: there.ty * TILE_SIZE },
                sign,
                approach: approach === null ? null : { tx: approach.tx, ty: approach.ty },
                key: approach === null ? null : approachKey(approach, here),
            });
        }
    });

    const records = rooms.map((room, id) => {
        const record = room?.record ?? room;
        return { ...record, entities: [...(record.entities ?? []), ...added[id]] };
    });

    return {
        records,
        doors,
        report: {
            topology: options.links ? 'explicit' : (options.topology ?? 'chain'),
            links: links.length,
            exits: doors.length,
            // ⛔ REPORTED, NOT SILENT. With no regions declared every exit
            // announces nothing, and a reader must be able to tell that from a
            // set whose regions genuinely all match.
            announced,
            silent,
            regions_declared: regions.filter((r) => Number.isInteger(r) && r > 0).length,
            components: floods.map((f, id) => ({ room: id, walkable: f.flood.size })),
        },
    };
}

// --- the RETARGET arm ---------------------------------------------------------

// The same shape `levelSetValidator.parseRoomXml` scans with. Kept separate on
// purpose: the two are cross-checked against each other in the tests (the parse
// must find exactly as many exits as the rewrite addresses), which is the
// "two independent methods agree" property §9.4 built the fixture for.
const ELEMENT_RE = /<([A-Za-z_][\w.-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
const ATTR_RE = /([\w.:-]+)\s*=\s*"([^"]*)"/g;

const attrsOf = (raw) => {
    const out = {};
    ATTR_RE.lastIndex = 0;
    let m = ATTR_RE.exec(raw);
    while (m !== null) { out[m[1]] = m[2]; m = ATTR_RE.exec(raw); }
    return out;
};

/**
 * Set one attribute inside an element's attribute text, preserving everything
 * else byte for byte.
 *
 * ⛔ ABSENT + DEFAULT STAYS ABSENT. Vanilla writes `sign="0"` on teleporters and
 * omits it on stairs; adding the attribute where it was not would make a
 * retarget that changed no destination still change the bytes, and every
 * byte-level claim about a retargeted set would then be about this function's
 * taste rather than about the retarget.
 */
function setAttr(attrText, name, value, { omitWhen = null } = {}) {
    const re = new RegExp(`(\\s${name}\\s*=\\s*")([^"]*)(")`);
    if (re.test(attrText)) return attrText.replace(re, `$1${value}$3`);
    if (omitWhen !== null && String(value) === String(omitWhen)) return attrText;
    return `${attrText} ${name}="${value}"`;
}

/**
 * RETARGET the exits of one room's OEL — the arm §4.6 asked for.
 *
 * Exits are addressed by ORDINAL in document order, the same order
 * `parseRoomXml` yields them, so a caller that read the room with the validator
 * can write it with this. Fallthroughs are addressed the same way.
 *
 * @param {string} xml
 * @param {object} edits
 * @param {object[]} [edits.exits]         sparse: `{index, to, playerx, playery, sign}`
 * @param {object[]} [edits.fallthroughs]  sparse: `{index, to, sign}`
 * @returns {{xml: string, applied: number, seen: {exits: number, fallthroughs: number}}}
 */
export function retargetRoomXml(xml, edits = {}) {
    if (typeof xml !== 'string') fail('levelSetExits: retargetRoomXml needs OEL text');
    const byExit = new Map((edits.exits ?? []).map((e) => [e.index, e]));
    const byFall = new Map((edits.fallthroughs ?? []).map((e) => [e.index, e]));

    let exitIndex = 0;
    let fallIndex = 0;
    let applied = 0;
    ELEMENT_RE.lastIndex = 0;
    const out = xml.replace(ELEMENT_RE, (whole, el, attrText, selfClose) => {
        let text = attrText;
        const a = attrsOf(attrText);
        if (EXIT_ELEMENTS.includes(el) && a.to !== undefined && a.to !== '') {
            const edit = byExit.get(exitIndex);
            exitIndex += 1;
            if (edit) {
                applied += 1;
                if (edit.to !== undefined) text = setAttr(text, 'to', edit.to);
                if (edit.playerx !== undefined) text = setAttr(text, 'playerx', edit.playerx);
                if (edit.playery !== undefined) text = setAttr(text, 'playery', edit.playery);
                // ⛔ THE SIGN IS REWRITTEN WITH THE DESTINATION OR NOT AT ALL.
                // Leaving it is what makes the new room announce the old room's
                // name (§4.6), so an edit that moves `to` and omits `sign` is
                // refused rather than quietly half-applied.
                if (edit.to !== undefined && edit.sign === undefined) {
                    fail(`levelSetExits: exit ${exitIndex - 1} is retargeted to room ${edit.to} `
                        + 'with no sign. `sign` is a property of the TRANSITION, not of the '
                        + 'source, so an unchanged sign announces the region of the room the '
                        + 'player did NOT go to. Pass sign: 0 to announce nothing.');
                }
                if (edit.sign !== undefined) text = setAttr(text, 'sign', edit.sign, { omitWhen: SIGN_NONE });
            }
        }
        if (a.fallthrough !== undefined && a.fallthrough !== '') {
            const edit = byFall.get(fallIndex);
            fallIndex += 1;
            if (edit) {
                applied += 1;
                if (edit.to !== undefined) text = setAttr(text, 'fallthrough', edit.to);
                if (edit.to !== undefined && edit.sign === undefined) {
                    fail(`levelSetExits: fallthrough ${fallIndex - 1} is retargeted to room `
                        + `${edit.to} with no sign. \`Game.as:2148\` reads its own @sign as `
                        + '`int(o.@sign) - 1`, exactly as a teleporter does, so the same rule '
                        + 'applies (plan §8.2b).');
                }
                if (edit.sign !== undefined) text = setAttr(text, 'sign', edit.sign, { omitWhen: SIGN_NONE });
            }
        }
        return text === attrText ? whole : `<${el}${text}${selfClose ? '/' : ''}>`;
    });

    return { xml: out, applied, seen: { exits: exitIndex, fallthroughs: fallIndex } };
}

/**
 * Retarget a whole SET under a room permutation — the "randomized vanilla"
 * shape §4.6 was written about.
 *
 * `destinationOf(room, exitIndex, currentTo)` returns the new destination, or
 * `null`/`undefined` to leave the exit alone. `arrivalOf` supplies the arrival
 * position; when it returns nothing, the exit's existing `playerx`/`playery` are
 * kept — which is right when only the LABEL of the destination changed (a
 * permuted set whose rooms are the same rooms) and wrong when the geometry did,
 * so the caller decides rather than this function guessing.
 *
 * ⚠ `regions` has the same meaning as in `linkGeneratedRooms`, and the same
 * consequence when it is empty: every retargeted exit announces nothing, which
 * is reported rather than hidden.
 */
export function retargetLevelSet(set, {
    destinationOf, arrivalOf = () => null, regions = [],
} = {}) {
    if (typeof destinationOf !== 'function') {
        fail('levelSetExits: retargetLevelSet needs a destinationOf(room, exitIndex, currentTo)');
    }
    const rooms = Array.isArray(set?.rooms) ? set.rooms : fail('levelSetExits: set has no rooms');
    let retargeted = 0;
    let announced = 0;
    const unreadable = [];
    const outRooms = rooms.map((room, id) => {
        const xml = room?.source?.xml;
        if (typeof xml !== 'string') {
            // ⛔ NAMED, NOT SKIPPED. An embed-sourced room's exits are invisible
            // here, and a retarget that quietly left them pointing at the old
            // layout is the graceful-skip failure this repo keeps recording.
            unreadable.push({ id, name: room?.name ?? null });
            return room;
        }
        const doc = parseRoomXml(xml);
        const exits = [];
        doc.exits.forEach((ex, index) => {
            const to = destinationOf(id, index, ex.to);
            if (to === null || to === undefined || to === ex.to) return;
            const arrival = arrivalOf(id, index, to) ?? null;
            const sign = signForTransition(regions[id] ?? REGION_NONE, regions[to] ?? REGION_NONE);
            retargeted += 1;
            if (sign !== SIGN_NONE) announced += 1;
            exits.push({
                index,
                to,
                sign,
                ...(arrival === null ? {} : { playerx: arrival.x, playery: arrival.y }),
            });
        });
        if (exits.length === 0) return room;
        const { xml: next } = retargetRoomXml(xml, { exits });
        return { ...room, source: { ...room.source, xml: next } };
    });

    // ⛔ RE-STAMPED, AND NOT AS A COURTESY. A retargeted set IS A DIFFERENT SET:
    // its rooms lead somewhere else. Keeping the old `set_id`/`content_hash`
    // would make a save from before the retarget match after it, and the game
    // would resume with a persistence table describing a layout that no longer
    // exists — the precise silent reinterpretation §9.1 put the hash in the id
    // to close. `validateLevelSet` refuses a stale hash by name, so an omission
    // here is loud rather than silent; it is still this function's to fix.
    // ⚠ `provenance` IS COPIED, not shared. `stampLevelSetIdentity` writes
    // `content_hash` INTO the object it is given, and a shallow `{...set}`
    // hands it the caller's own provenance — so a "pure" retarget would stamp
    // the INPUT set with the OUTPUT's hash and leave the caller holding a
    // document whose id no longer matches its own rooms.
    const before = set.set_id;
    const out = stampLevelSetIdentity({
        ...set,
        provenance: { ...(set.provenance ?? {}) },
        rooms: outRooms,
    });
    return {
        set: out,
        report: {
            retargeted,
            announced,
            silent: retargeted - announced,
            unreadable,
            regions_declared: regions.filter((r) => Number.isInteger(r) && r > 0).length,
            set_id_before: before,
            set_id_after: out.set_id,
        },
    };
}

/** Exported for the tests that assert the flood's geometry claim directly. */
export const cellRect = (tx, ty) => rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
