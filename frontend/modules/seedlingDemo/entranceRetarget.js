/**
 * seedlingDemo/entranceRetarget — ENTRANCE RANDOMIZATION E5, DONE IN THE LEVEL DATA.
 *
 * An entrance-randomized Seedling world (`entrance_randomization[slot].placements`, written by
 * `procgenPipeline/entranceShuffleSteps.js`) moves stairs. The game takes a stairs' destination from the
 * level XML (`Stairs.as`: `@to`, `@playerx`, `@playery`, `@sign` → `Teleporter` → `new Game(to, px, py)`),
 * and the wasm build plays whatever level set the page delivers. So the shuffle is applied to the DELIVERED
 * set: each moved stairs' exit is rewritten to its shuffled destination, and the game loads the shuffled
 * room itself. No vanilla room is loaded in between, the region binding needs no redirect (it already
 * matches a level change on the sidecar's `target_level`, which names the shuffled level), and no build
 * changes.
 *
 * ── THE MAPPING, AND WHERE EACH FIELD COMES FROM ────────────────────────────
 *
 * For each placement `{exit, target}`:
 *   source room      the sidecar that carries the departure named `exit` (`preset_sidecars[slot][region]
 *                    .playable_payload`): its `level` is the room id in the set.
 *   exit ordinal     the room's exit the departure IS: the sidecar's `exit_id` is `out_<element>_<x>_<y>`
 *                    (`seedlingRegionBinding.outExitIdOf`, the id the game's own door report rebuilds), read
 *                    against the set's own record; a hand-named door falls back to its `exit_tiles`. The
 *                    ordinal is `parseRoomXml`'s / `retargetRoomRecord`'s (document order).
 *   to               the sidecar's `target_level`: the shuffled destination the AP graph was compiled with.
 *   playerx/playery  the landing of the DOORWAY the sidecar's `target_spawn` names, in PIXELS (the OEL's
 *                    unit: `new Game(to, playerx, playery)`). ⚠ `target_spawn` is TILE-SNAPPED and the game's
 *                    own landing need not be: MEASURED, the vanilla stairs into level 32 lands on (72, 120)
 *                    and its sidecar says (64, 112). So the doorway is found in the game's data: the vanilla
 *                    exit(s) into `target_level` landing on `target_spawn`'s tile, and THEIR `@playerx` /
 *                    `@playery` is written. A shuffled stairs therefore lands exactly where the vanilla
 *                    stairs it replaces landed. No vanilla exit on that tile (or two that disagree): the
 *                    sidecar's own `target_spawn` is written, and the plan row says so.
 *   sign             see below.
 * An exit whose data already says that is UNMOVED and gets no edit (seed 1's draw places one pair at its own
 * reverse), so an identity shuffle changes no byte.
 *
 * ── THE SIGN: THE LANDING DOORWAY'S, NEVER THE SOURCE'S OLD ONE ─────────────
 *
 * `sign` belongs to the TRANSITION (`levelSetExits.js`'s header, measured). The game's data states a
 * transition's announcement in one place only: on the vanilla exit that makes it. A shuffled stairs lands
 * on the arrival spawn of a vanilla doorway, so the announcement the data states for THAT ARRIVAL is the
 * sign of the vanilla exit(s) landing on that doorway (above):
 *
 *     doorway sign  = the one sign every vanilla exit landing there carries (0 when none lands there, or
 *                     when they disagree: announcing nothing beats announcing a guess)
 *     sign          = signForTransition(declared region of the source room, doorway sign)
 *
 * `declared region` is only what the data declares: the destination of a vanilla signed transition is in
 * that region (`levelSetExits.js`: no destination is entered with two different non-zero signs). So a
 * stairs that leaves a room of the very region its landing announces stays silent, and nothing is inferred
 * for the rooms the data says nothing about. On vanilla that reproduces every stairs' own sign (a vanilla
 * exit lands on its own landing), which a test holds over the whole set.
 *
 * ── REFUSALS ARE BY NAME ────────────────────────────────────────────────────
 *
 * A placement with no sidecar departure, a departure with no room exit, a destination with no level or
 * landing (an external exit), two placements on one exit, a room missing from the set: each throws an
 * `EntranceRetargetError` naming the placement. A half-retargeted set would play some stairs shuffled and
 * some vanilla under a logic that assumes all of them.
 *
 * Headless-safe: no `node:` imports and no DOM.
 */

import { EXIT_ELEMENTS, REGION_NONE, retargetRoomRecord, signForTransition } from './levelSetExits.js';
import { stampLevelSetIdentity } from './levelSetValidator.js';

export class EntranceRetargetError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EntranceRetargetError';
    }
}

const fail = (message) => { throw new EntranceRetargetError(message); };

/** `provenance.generator` of a set this module retargeted. */
export const ENTRANCE_RETARGET_GENERATOR = 'seedlingDemo/entranceRetarget.retargetSetForEntrances';

/**
 * The slot's entrance-randomization block when it PLACES anything, else null. A world with no block, or
 * with an empty `placements`, is not entrance-randomized.
 */
export function entranceShuffleBlock(rules, slot) {
    const block = rules?.entrance_randomization?.[String(slot)];
    return block && Array.isArray(block.placements) && block.placements.length > 0 ? block : null;
}

const attrsOf = (e) => (e?.attrs !== null && typeof e?.attrs === 'object' && !Array.isArray(e.attrs) ? e.attrs : {});
const isExit = (e) => EXIT_ELEMENTS.includes(e?.type) && attrsOf(e).to !== undefined && attrsOf(e).to !== '';
const signOf = (attrs) => {
    const n = Number(attrs.sign ?? REGION_NONE);
    return Number.isInteger(n) ? n : REGION_NONE;
};
const landingKey = (to, x, y) => `${to}|${x}|${y}`;

/**
 * Every exit of the set, as the game reads it: `{level, index, element, x, y, to, playerx, playery, sign}`
 * (`index` the exit ordinal in its room), plus the two tables the sign rule reads.
 */
export function exitsOfRecordSet(set) {
    const rooms = Array.isArray(set?.rooms) ? set.rooms : fail('entranceRetarget: the set has no `rooms`');
    const exits = [];
    const declared = new Map();      // room id -> Set of non-zero signs it is entered with
    const declare = (to, sign) => {
        if (sign === REGION_NONE || !Number.isInteger(to)) return;
        if (!declared.has(to)) declared.set(to, new Set());
        declared.get(to).add(sign);
    };
    for (const room of rooms) {
        const record = room?.source?.record;
        if (!record) continue;
        let index = 0;
        for (const e of record.entities ?? []) {
            const a = attrsOf(e);
            if (isExit(e)) {
                const row = { level: room.id, index, element: e.type, x: Number(e.x), y: Number(e.y),
                    to: Number(a.to), playerx: Number(a.playerx), playery: Number(a.playery), sign: signOf(a) };
                index += 1;
                exits.push(row);
                declare(row.to, row.sign);
            }
            if (a.fallthrough !== undefined && a.fallthrough !== '') declare(Number(a.fallthrough), signOf(a));
        }
    }
    const byTarget = new Map();      // room id -> the exits leading into it
    for (const ex of exits) {
        if (!byTarget.has(ex.to)) byTarget.set(ex.to, []);
        byTarget.get(ex.to).push(ex);
    }
    /** The region the DATA declares for a room: the one non-zero sign it is entered with, else none. */
    const regionOf = (level) => {
        const signs = declared.get(level);
        return signs && signs.size === 1 ? [...signs][0] : REGION_NONE;
    };
    /**
     * The doorway an arrival in room `to` on `spawn` is, read off the game's own exits:
     * `{x, y, sign, stated, agreed}`. The exits into `to` landing on `spawn`'s tile (`tileSize` px; no grid:
     * on `spawn` exactly) are the doorway; their landing and their sign are its landing and its announcement.
     * `stated` false: no exit lands there. `agreed` false: they land on different pixels or carry different
     * signs, and nothing is taken from them that they disagree on (`spawn` itself, sign 0).
     */
    const doorwayOf = (to, spawn, tileSize = null) => {
        const grid = Number.isInteger(tileSize) && tileSize > 0;
        const cell = (v) => (grid ? Math.floor(v / tileSize) : v);
        const here = (byTarget.get(to) ?? []).filter((ex) => cell(ex.playerx) === cell(spawn.x)
            && cell(ex.playery) === cell(spawn.y));
        if (here.length === 0) return { x: spawn.x, y: spawn.y, sign: REGION_NONE, stated: false, agreed: true };
        const landings = new Set(here.map((ex) => landingKey(to, ex.playerx, ex.playery)));
        const signs = new Set(here.map((ex) => ex.sign));
        const oneLanding = landings.size === 1;
        return {
            x: oneLanding ? here[0].playerx : spawn.x,
            y: oneLanding ? here[0].playery : spawn.y,
            sign: signs.size === 1 ? here[0].sign : REGION_NONE,
            stated: true,
            agreed: oneLanding && signs.size === 1,
        };
    };
    return { exits, regionOf, doorwayOf };
}

/** The sign a stairs from `level` arriving at `doorway` carries, under this module's rule. */
export function signForDoorway(tables, level, doorway) {
    return signForTransition(tables.regionOf(level), doorway.sign);
}

/** The room exit a sidecar departure is: by the id the game's door report rebuilds, else by its tile. */
function roomExitOf(roomExits, payload, exit) {
    const byId = roomExits.filter((r) => `out_${r.element}_${r.x}_${r.y}` === exit.exit_id);
    if (byId.length > 0) return byId;
    const size = payload?.tile_size;
    if (!Number.isInteger(size) || size <= 0) return [];
    return roomExits.filter((r) => (exit.exit_tiles ?? [])
        .some(([tx, ty]) => tx === Math.floor(r.x / size) && ty === Math.floor(r.y / size)));
}

/**
 * The retarget plan of an entrance-randomized world over a level set: which room exits move, and to what.
 *
 * @param {object} args
 * @param {object} args.rules  the rules.json (its `entrance_randomization` and `preset_sidecars`)
 * @param {string|number} args.slot
 * @param {object} args.set    a `record`-sourced level set whose room ids are the game's levels
 * @returns {null | {byLevel: Map<number, object[]>, moved: object[], unmoved: string[], placements: number}}
 *   null when the world is not entrance-randomized. `moved[]` rows are
 *   `{exit, target, region, level, door, index, from: {to, playerx, playery, sign},
 *     to: {to, playerx, playery, sign}, targetRegion, spawn: {x, y}, doorway: {x, y, sign, stated, agreed}}`
 *   (`spawn` the sidecar's tile-snapped `target_spawn`, `doorway` what the game's data says of it).
 */
export function planEntranceRetarget({ rules, slot, set } = {}) {
    const block = entranceShuffleBlock(rules, slot);
    if (!block) return null;
    const sidecars = rules?.preset_sidecars?.[String(slot)];
    if (!sidecars || typeof sidecars !== 'object') {
        fail('entranceRetarget: the rules place entrances but carry no `preset_sidecars` for slot '
            + `${JSON.stringify(slot)} — there is no room data to say which door each placement is`);
    }
    const departures = new Map();    // exitName -> {region, payload, exit}
    for (const [region, sidecar] of Object.entries(sidecars)) {
        const payload = sidecar?.playable_payload;
        for (const exit of payload?.exits ?? []) {
            if (!exit?.exitName || !exit.targetRegion) continue;
            const prior = departures.get(exit.exitName);
            if (prior && (prior.payload.level !== payload.level || prior.exit.exit_id !== exit.exit_id)) {
                fail(`entranceRetarget: the exit ${JSON.stringify(exit.exitName)} is a departure of two different `
                    + `doors (${prior.region}/${prior.exit.exit_id} and ${region}/${exit.exit_id})`);
            }
            if (!prior) departures.set(exit.exitName, { region, payload, exit });
        }
    }

    const tables = exitsOfRecordSet(set);
    const byRoom = new Map();
    for (const ex of tables.exits) {
        if (!byRoom.has(ex.level)) byRoom.set(ex.level, []);
        byRoom.get(ex.level).push(ex);
    }

    const byLevel = new Map();
    const moved = [];
    const unmoved = [];
    const claimed = new Map();       // "level|index" -> placement exit
    for (const placement of block.placements) {
        const name = placement?.exit;
        const dep = departures.get(name);
        if (!dep) {
            fail(`entranceRetarget: the placement ${JSON.stringify(name)} names no departure of any sidecar — `
                + 'its door cannot be found in the room data');
        }
        const { region, payload, exit } = dep;
        const level = payload.level;
        if (!Number.isInteger(level) || !byRoom.has(level)) {
            fail(`entranceRetarget: the placement ${JSON.stringify(name)} leaves level ${JSON.stringify(level)} `
                + `(${region}), which is not a room with exits in the set being retargeted`);
        }
        const hits = roomExitOf(byRoom.get(level), payload, exit);
        if (hits.length !== 1) {
            fail(`entranceRetarget: the placement ${JSON.stringify(name)} is the door ${JSON.stringify(exit.exit_id)} `
                + `of level ${level}, and ${hits.length === 0 ? 'no exit' : `${hits.length} exits`} of that room `
                + 'match it');
        }
        const [here] = hits;
        const key = `${level}|${here.index}`;
        if (claimed.has(key)) {
            fail(`entranceRetarget: the placements ${JSON.stringify(claimed.get(key))} and ${JSON.stringify(name)} `
                + `are both exit ${here.index} of level ${level}; one door has one destination`);
        }
        claimed.set(key, name);
        const to = exit.target_level;
        const spawn = exit.target_spawn;
        if (!Number.isInteger(to) || !Number.isFinite(spawn?.x) || !Number.isFinite(spawn?.y)) {
            fail(`entranceRetarget: the placement ${JSON.stringify(name)} lands in ${JSON.stringify(exit.targetRegion)} `
                + 'with no level or no landing spawn in its sidecar — the level data cannot name that destination');
        }
        const tileSize = sidecars[exit.targetRegion]?.playable_payload?.tile_size ?? payload.tile_size;
        const doorway = tables.doorwayOf(to, spawn, tileSize);
        const { x, y } = doorway;
        if (here.to === to && here.playerx === x && here.playery === y) {
            unmoved.push(name);
            continue;
        }
        const sign = signForDoorway(tables, level, doorway);
        const row = {
            exit: name,
            target: placement.target ?? null,
            region,
            level,
            door: exit.exit_id,
            index: here.index,
            from: { to: here.to, playerx: here.playerx, playery: here.playery, sign: here.sign },
            to: { to, playerx: x, playery: y, sign },
            targetRegion: exit.targetRegion,
            spawn: { x: spawn.x, y: spawn.y },
            doorway,
        };
        moved.push(row);
        if (!byLevel.has(level)) byLevel.set(level, []);
        byLevel.get(level).push({ index: here.index, to, playerx: x, playery: y, sign });
    }
    return { byLevel, moved, unmoved, placements: block.placements.length };
}

/**
 * The set with the plan applied: exactly the planned exits rewritten, every other byte of every room kept.
 * A CLONE (the rewriters' rule: the stamp writes in place), re-stamped, because a set whose stairs lead
 * elsewhere is a different set (a save from the vanilla layout must not resume on it).
 *
 * @returns {{set: object, retargeted: number}}
 */
export function retargetSetForEntrances(set, plan, { entranceRandomization = null } = {}) {
    if (!Array.isArray(set?.rooms)) fail('entranceRetarget: retargetSetForEntrances needs a level set with `rooms`');
    if (!plan || !(plan.byLevel instanceof Map)) fail('entranceRetarget: retargetSetForEntrances needs a plan');
    const out = JSON.parse(JSON.stringify(set));
    let retargeted = 0;
    const seen = new Set();
    for (const room of out.rooms) {
        const edits = plan.byLevel.get(room?.id);
        if (!edits) continue;
        if (seen.has(room.id)) fail(`entranceRetarget: two rooms of the set carry id ${room.id}`);
        seen.add(room.id);
        if (!room.source?.record) {
            fail(`entranceRetarget: room ${room.id} is not record-sourced; its exits cannot be rewritten here`);
        }
        const { record, applied } = retargetRoomRecord(room.source.record, { exits: edits });
        if (applied !== edits.length) {
            fail(`entranceRetarget: room ${room.id} took ${applied} of ${edits.length} exit edits — `
                + 'the plan was made against a different set');
        }
        room.source.record = record;
        retargeted += applied;
    }
    if (seen.size !== plan.byLevel.size) {
        fail(`entranceRetarget: the plan addresses ${plan.byLevel.size} room(s) and ${seen.size} were found in the set`);
    }
    if (retargeted === 0) return { set, retargeted };
    out.provenance = {
        ...(out.provenance ?? {}),
        generator: ENTRANCE_RETARGET_GENERATOR,
        derived_from: {
            set_id: set.set_id ?? null,
            content_hash: set.provenance?.content_hash ?? null,
        },
        entrance_randomization: {
            exits: retargeted,
            ...(entranceRandomization ? { seed: entranceRandomization.seed ?? null,
                algorithm: entranceRandomization.algorithm ?? null } : {}),
        },
    };
    stampLevelSetIdentity(out);
    return { set: out, retargeted };
}

/**
 * Plan and apply in one call, for the delivery. Returns the set it was given (same object, `retargeted` 0,
 * `plan` null) when the world is not entrance-randomized, so a vanilla load moves no byte.
 */
export function applyEntranceShuffle({ rules, slot, set } = {}) {
    const plan = planEntranceRetarget({ rules, slot, set });
    if (!plan) return { set, retargeted: 0, plan: null };
    const { set: out, retargeted } = retargetSetForEntrances(set, plan,
        { entranceRandomization: entranceShuffleBlock(rules, slot) });
    return { set: out, retargeted, plan };
}
