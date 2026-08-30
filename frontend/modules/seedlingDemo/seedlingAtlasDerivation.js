/**
 * seedlingDemo/seedlingAtlasDerivation — **THE ATLAS IS DERIVED FROM THE ROOMS**
 * (EDITOR v3 slice D0b; plan §16.3, ⚖ RULED by the user 2026-08-25).
 *
 * ── WHAT THIS IS, AND WHY IT IS NOT IN THE CORE ────────────────────────
 *
 * `make-seedling-playthrough-rules.mjs` proved the shape §16.3 asserts: an
 * atlas's regions, boundary exits and connections are a FUNCTION of the game's
 * rooms, and only three things are AUTHORED — locations, the access rules the
 * analyzer cannot derive, and names. This module is that function, LIFTED out
 * of the script so the vanilla 116 rooms and an EDITED level set go through one
 * derivation instead of two.
 *
 * It reads OEL entity types (`teleporter`, `stairsup`, `stairsdown`, `control`)
 * and Seedling's own pit arithmetic, so it is seedling-side and lives here. The
 * game-agnostic pieces are in `procgenCore/` (`atlasOps`, `contentIdentity`,
 * `rulesGraph`); nothing here belongs beside them.
 *
 * ── ⛓⛓ THE TWO INPUT SHAPES, MEASURED ─────────────────────────────────
 *
 * A `room` is `{ level, width, height, layers, entities }`. That is what the
 * MAP EXTRACT (`flashPanel/atlases/seedling-map.json`) presents and what a
 * LEVEL SET's parsed room (`procgenLevelOel.parseOelLevel`) presents — the same
 * record, measured field by field on 2026-08-25:
 *
 *   | field                             | map extract | parseOelLevel |
 *   |-----------------------------------|-------------|---------------|
 *   | `width`, `height` (TILES)          | ✓           | ✓             |
 *   | `layers[] {name, set, tiles}`      | ✓ (132)     | ✓             |
 *   | `entities[] {type, x, y, attrs?, nodes?}` | ✓ (2461) | ✓        |
 *   | `tiles_outside_level`              | ✓ when > 0  | ✓ when > 0    |
 *   | **`level`** (the room's id)        | **✓**       | **✗**         |
 *   | `class`, `path` (provenance)       | ✓           | ✗             |
 *
 * ⇒ EXACTLY ONE field differs in a way this module can see: `parseOelLevel`
 * does not carry the room's `level` id, because a parsed `.oel` does not know
 * its own index — the SET does. `class` and `path` are provenance nothing here
 * reads. So the adaptation is one line, and it belongs AT THE CALL SITE:
 *
 *   deriveAtlas(set.rooms.map((r, i) => ({ ...parseOelLevel(r.xml), level: i })), …)
 *
 * ⛔ NOT INSIDE. A module that guessed a missing id would be guessing which
 * numbering the caller meant, and the two callers mean different things (the
 * map extract's ids are the GAME's level numbers; a set's are its own indices).
 * Refusing a room with no `level` by name is the honest version of that.
 *
 * ── WHAT STAYS IN THE SCRIPT, AND WHY IT IS THE PROOF ──────────────────
 *
 * The vanilla OVERLAY — `applyLavaTrapPulls`, `applyHandRulings`,
 * `applyCrossingCostToBindings`, `pruneUnreachableSubRegions`, and the whole
 * analyzer pass — stays in `make-seedling-playthrough-rules.mjs`. That is not
 * leftovers: it is exactly what §16.3 means by "an authored overlay", and the
 * fact that the 116-room vanilla build needs one is the evidence the shape is
 * right. A derivation that had swallowed the hand rulings would have proved the
 * opposite — that the atlas is not derivable and the script is the only truth.
 */

import { AtlasSession, createEmptyAtlas } from '../regionMarkingTool/atlasSession.js';
import { substrateIdFor } from '../procgenPipeline/regionAtlasCompiler.js';
import { NAMED_ROOMS } from './levelSetValidator.js';

/**
 * ⛓ THE THREE LINK TAGS, and why every link is ONE-WAY.
 *
 * §2.1: there is ONE transition primitive and every level edge is an invisible
 * Teleporter. A transition writes `FP._goto` and the swap happens in
 * `Engine.checkWorld()` — a one-way jump to `(playerx, playery)` in the
 * destination, and the way BACK is a separate entity that may not exist at all
 * (L40's pits drop into L43; L43's stairs come back out somewhere else). So the
 * derivation emits one exit per link ENTITY on the source side, one arrival
 * exit on the destination side, and a ONE-WAY connection between them. Pairing
 * them into bidirectional connections would invent return edges the game does
 * not have, and AP would route a collectible through a door that only opens one
 * way.
 */
export const LINK_TAGS = Object.freeze(['teleporter', 'stairsup', 'stairsdown']);

/** The tile type a Pit paints, in `seedlingSemantics`' numbering. */
export const PIT_TILE_TYPE = 6;

/** Which AP item each ledger pickup tag grants. */
export const ITEM_FOR_TAG = Object.freeze({
    sword: 'Progressive Sword', shield: 'Progressive Shield',
    darkshield: 'Progressive Shield', conch: 'Progressive Swim',
    feather: 'Progressive Swim', wand: 'Wand', firewand: 'Fire Wand Fusion',
    ghostspear: 'Ghost Spear', ghostsword: 'Ghost Sword Fusion',
    darksuit: 'Dark Suit', torchpickup: 'Light', health: 'Health',
    totempart: 'Totem Shard', chest: 'Seal',
});
export const ITEM_FOR_KEY = Object.freeze(['Red Key', 'Green Key', 'Purple Key', 'Blue Key', 'Yellow Key']);
/** The ending. Not a Seedling pickup flag — the AP goal, so it needs its own item. */
export const VICTORY_ITEM = 'The Seed';

// ── the names ─────────────────────────────────────────────────────────────

export const regionIdFor = (level) => `level_${level}`;
/** A stable, readable name per level. Location names must be globally unique. */
export const levelName = (id) => `Level ${String(id).padStart(3, '0')}`;
export const outExitId = (e) => `out_${e.type}_${e.x}_${e.y}`;
export const inExitId = (from, e) => `in_L${from}_${e.x}_${e.y}`;
/**
 * ⛓⛓ EDITOR v3 E5 — **THE ARRIVAL ID OF A `named_rooms` WARP, AND WHY THE KEY
 * IS IN IT.** `inExitId` names an arrival by the room it came FROM and the
 * pixel it lands on, which is unique for a link entity because a link's
 * arrival is its own `@playerx/@playery`. A manifest arrival is the OPPOSITE
 * shape: ONE tile named by the manifest, reached from every room that holds
 * the trigger element — vanilla's `bloody_seed_ending` has ELEVEN sources
 * landing on the same tile of L1. Without the entry key two different entries
 * arriving on one tile from one room would collide silently; with it, the id
 * says which manifest fact the door is.
 *
 * ⛔ THE OUT SIDE NEEDS NO NEW SPELLING. `outExitId` already namespaces by the
 * entity's own `type`, and `LINK_TAGS` and the trigger elements are DISJOINT
 * sets — no trigger is a transition primitive — so `out_<trigger>_<x>_<y>`
 * cannot collide with a real teleporter's id. `namedRoomTriggersAreNotLinks()`
 * is that claim as a function rather than as a sentence.
 */
export const namedInExitId = (key, from, x, y) => `in_${key}_L${from}_${x}_${y}`;

/**
 * The OEL element whose presence makes each `named_rooms` entry live, BY ENTRY
 * KEY. ⛔ NOT `levelSetValidator.NAMED_ROOM_TRIGGERS`, which is the same facts
 * as a bare LIST: this side needs to know which trigger belongs to which entry,
 * because the entry is what supplies the arrival.
 */
export const TRIGGER_FOR_NAMED_ROOM = Object.freeze(Object.fromEntries(
    Object.entries(NAMED_ROOMS).map(([key, d]) => [key, d.trigger]),
));

/**
 * ⛓ Whether the out-side spelling is collision-free BY CONSTRUCTION. A trigger
 * that was also a link tag would make `out_<type>_<x>_<y>` ambiguous, and this
 * is the claim a row asserts instead of measuring one fixture and hoping.
 */
export const namedRoomTriggersAreNotLinks = () => Object.values(TRIGGER_FOR_NAMED_ROOM)
    .every((t) => !LINK_TAGS.includes(t));

export const labelFor = (row) => {
    /**
     * ⛓ EDITOR v3 D1 — the ENTITY-ADDRESSED row's label is AUTHORED, and it is
     * the one arm that does not derive its own name. An edited set has no
     * ledger to name rows out of, so the person who marked the location typed
     * the label; every other arm reads a `kind` whose naming is a fact about
     * the vanilla game.
     */
    if (row.kind === 'entity') return row.label;
    if (row.kind === 'chest') return 'Chest';
    if (row.kind === 'key') return `Boss Key ${/bosskey(\d)@/.exec(row.id)[1]}`;
    if (row.kind === 'totempart') return `Totem Part ${/:(\d+),(\d+)$/.exec(row.id).slice(1).join(',')}`;
    if (row.kind === 'ending') return 'The Seed';
    if (row.kind === 'encounter') return row.id.startsWith('fire@') ? 'Bob Boss' : 'Witch';
    return row.tag.replace(/^\w/, (c) => c.toUpperCase());
};

// ── the geometry ──────────────────────────────────────────────────────────

export const tileOf = (e, tileSize) => [Math.floor(e.x / tileSize), Math.floor(e.y / tileSize)];
export const arrivalTileOf = (e, tileSize) => [
    Math.floor(Number(e.attrs.playerx) / tileSize), Math.floor(Number(e.attrs.playery) / tileSize),
];

/**
 * ⛓ THE SECOND TRANSPORT CLASS, and leaving it out made four levels
 * unreachable — which is exactly the shape the standing instruction says to
 * treat as a defect in the logic.
 *
 * A Pit tile is not a wall and not a door: `Player.checkFallingInPit`
 * (`Player.as:718`) hands the player to the level `<control>` object's
 * `fallthrough` target. The transcription already marks the cells `sink` —
 * "enterable from anywhere, never leavable" — precisely so this could be wired
 * rather than guessed.
 *
 * ⛔ AND THE OFFSET IS SUBTRACTED FROM WHERE YOU FELL, NOT AN ARRIVAL POINT.
 * `Player.as:758-764`:
 *
 *     x = floor(max(fallInPitPos.x - Game.fallthroughOffset.x, 0) / Tile.w) * Tile.w
 *
 * with `fallthroughOffset = (control.x + xOff, control.y + yOff)`
 * (`Game.as:2125-2129`). So a level's pits are NOT one transport: each pit tile
 * lands somewhere different, translated by a constant. The first cut of this
 * read the offset as the destination and put L12's pit at tile (31,38) of an
 * 11x11 room — which the atlas session caught, because a tile outside its
 * region is an error there rather than a shrug.
 *
 * ⇒ one exit per DISTINCT ARRIVAL, carrying the pit tiles that produce it.
 */
export function pitOf(room, { roomById, tileSize, tileTypeForPlacement }) {
    const control = room.entities.find((e) => e.type === 'control');
    const to = Number(control?.attrs?.fallthrough);
    if (!Number.isInteger(to) || !roomById.has(to)) return null;
    const dest = roomById.get(to);
    const offX = Number(control.x) + Number(control.attrs.xOff);
    const offY = Number(control.y) + Number(control.attrs.yOff);
    if (!Number.isFinite(offX) || !Number.isFinite(offY)) return null;
    const byArrival = new Map();
    for (const layer of room.layers ?? []) {
        if (layer.name === 'cliffsides') continue;
        for (const p of layer.tiles ?? []) {
            if (tileTypeForPlacement(p) !== PIT_TILE_TYPE) continue;
            // The game's own arithmetic, then the clamp `Player.as:581-582`
            // applies to every arrival anyway (the level rect is hard).
            const ax = Math.min(dest.width - 1,
                Math.floor(Math.max(p[0] * tileSize - offX, 0) / tileSize));
            const ay = Math.min(dest.height - 1,
                Math.floor(Math.max(p[1] * tileSize - offY, 0) / tileSize));
            const key = `${ax},${ay}`;
            if (!byArrival.has(key)) byArrival.set(key, { arrival: [ax, ay], tiles: [] });
            byArrival.get(key).tiles.push([p[0], p[1]]);
        }
    }
    if (byArrival.size === 0) return null;
    const groups = [...byArrival.values()]
        .map((g) => ({ ...g, tiles: g.tiles.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0])) }))
        .sort((a, b) => (a.arrival[1] - b.arrival[1]) || (a.arrival[0] - b.arrival[0]));
    return { to, groups };
}

/** The link entities of one room, in a stable order, that name a room that exists. */
export function linksOf(room, { roomById }) {
    return room.entities
        .filter((e) => LINK_TAGS.includes(e.type) && e.attrs?.to !== undefined)
        .map((e) => ({ e, to: Number(e.attrs.to) }))
        .filter((l) => Number.isInteger(l.to) && roomById.has(l.to))
        .sort((a, b) => (a.e.x - b.e.x) || (a.e.y - b.e.y) || (a.to - b.to));
}

/**
 * ⛓⛓⛓ **EDITOR v3 E5 — A `named_rooms` ARRIVAL IS A CONNECTION, AND ITS SOURCE
 * IS DERIVED FROM THE TRIGGER ELEMENT** (plan §27.6, sharpened; §23.8/§23.11 #2
 * are the measurement that asked for it).
 *
 * `linksOf` sees a transition because a transition IS an entity with an `@to`.
 * A `named_rooms` arrival is not: it is a MANIFEST fact the AS3 dereferences
 * from inside one entity's own behaviour, and until this slice the derivation
 * never saw it. That is why the set editor's REPORT calls `level_58`
 * UNREACHABLE on the real game — vanilla's `tentacle_beast_mouth` is the only
 * thing in the whole 116 that reaches it, and it lives in the manifest.
 *
 * ⛓ **THE SOURCE IS NOT HAND-TYPED.** `levelSetValidator.NAMED_ROOMS` carries,
 * per entry, the OEL element whose presence makes the entry MANDATORY, with the
 * AS3 citation of the ONE reader (`moonrock` → `moonrock_target`, `oracle` →
 * `dark_shrum_death`, `watcher` → `bloody_seed_ending`, …). The validator needs
 * that to decide whether an entry may be omitted; this needs it to decide WHO
 * warps. ⇒ every room whose record holds the trigger element is a SOURCE, the
 * exit is that element's own tile, and the arrival is the entry's `{x, y}`.
 *
 * ⛔ **`position: false` DERIVES NOTHING, AND THE FIELD IS WHY.** `watcher_text`
 * is `persistence` — a cross-level tag index (`FinalDoor.as:50`), not a warp —
 * so it has no arrival to connect TO. `NAMED_ROOMS` states `position` as its
 * own field precisely because `kind` cannot be trusted for it
 * (`moonrock_target` is BOTH), and this reads the field.
 *
 * ⚠ **ONE ROOM CAN BE THE SOURCE OF SEVERAL, AND ELEVEN OF ONE.** Measured over
 * the vanilla 116: `bloody_seed_ending` has 11 sources (one `<watcher>` each in
 * L12 L32 L37 L43 L57 L69 L82 L89 L94 L103 L114), every other position entry
 * has exactly 1 — 15 warps over 13 rooms, because L57 and L69 hold two triggers
 * each. So the arrival exit is deduplicated the way `deriveAtlas` deduplicates
 * a link arrival — by id, and the id carries the SOURCE room.
 *
 * @param {Array} rooms rooms already sorted, each with an integer `level`
 * @param {object} namedRooms the SET manifest's own `named_rooms`
 * @param {{roomById: Map}} ctx
 * @returns {Array<{key,trigger,from,to,entity,arrival:{x,y}}>} sorted, stable
 */
export function namedRoomArrivals(rooms, namedRooms, { roomById }) {
    const out = [];
    for (const [key, entry] of Object.entries(namedRooms ?? {})) {
        const spec = NAMED_ROOMS[key];
        // ⛔ An unknown key is the VALIDATOR's refusal (`set-field` refuses one
        //    outside the closed six). A derivation that threw here would make a
        //    document two authorities disagree about; it derives nothing from
        //    what it does not recognise.
        if (!spec || !spec.position) continue;
        const to = Number(entry?.level);
        if (!Number.isInteger(to) || !roomById.has(to)) continue;
        const ax = Number(entry?.x);
        const ay = Number(entry?.y);
        if (!Number.isFinite(ax) || !Number.isFinite(ay)) continue;
        for (const room of rooms) {
            for (const e of room.entities ?? []) {
                if (e.type !== spec.trigger) continue;
                out.push({
                    key, trigger: spec.trigger, from: room.level, to, entity: e,
                    arrival: { x: ax, y: ay },
                });
            }
        }
    }
    return out.sort((a, b) => (a.from - b.from) || (a.to - b.to)
        || (a.entity.x - b.entity.x) || (a.entity.y - b.entity.y)
        || (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0)));
}

// ── the AUTHORED half: locations ──────────────────────────────────────────

/**
 * Which entity on the map each overlay location row is.
 *
 * ⛓ THE LEDGER IS NOT RETYPED. `overlay.locations` is the caller's own row
 * list — for the vanilla build that is `r7Acceptance.R7_GOAL_LEDGER`, the
 * frozen 41-row census slice 0 built and mutation-tested. A row whose entity
 * cannot be found is an ERROR, never a skip: a census that silently loses a row
 * is trap 110.
 */
/**
 * ⛓⛓⛓ **EDITOR v3 E5 — WHICH ENTITY A LEDGER ROW IS, ON ITS OWN.**
 *
 * This block was inline in `locationsFor` and is EXTRACTED VERBATIM — same
 * branches, same order, same messages. It is lifted because a SECOND caller
 * needs the answer and cannot get it from the finished location:
 * `make-seedling-vanilla-overlay.mjs` lifts the playthrough's 41 locations into
 * a D1 overlay, whose location ADDRESS is the entity's own `{type, x, y}` in
 * PIXELS — and a location row carries only its TILE. Five of the 41 sit on a
 * tile that holds more than one entity (L32 `stairsdown`+`fallrocklarge`, L38
 * `chest`+`cover`, L40 `wire`+`chest`, L67 `bosskey`+`orb`, L115
 * `lightray`+`shadow`+`seed`), so a by-tile join would pick whichever sorted
 * first. Asking the derivation which entity it MEANT is the derived answer; a
 * type table in the script would be the hardcoded one.
 *
 * ⛔ BYTE-INERT ON THE PRODUCER. `locationsFor` calls it and does the same thing
 * with the result, and `make-seedling-playthrough-rules --check` plus the atlas
 * md5 are what say so.
 *
 * @returns {{entity: object|undefined, item: string|undefined}} both may be
 *   absent — `locationsFor` owns the refusal, so that its message is unchanged.
 */
export function entityForLedgerRow(room, row) {
    let entity = null;
    let item = null;
    if (row.kind === 'pickup') {
        entity = room.entities.find((e) => e.type === row.tag);
        item = ITEM_FOR_TAG[row.tag];
    } else if (row.kind === 'key') {
        const kt = Number(/bosskey(\d)@/.exec(row.id)[1]);
        entity = room.entities.find((e) => e.type === 'bosskey' && Number(e.attrs.keyType) === kt);
        item = ITEM_FOR_KEY[kt];
    } else if (row.kind === 'totempart') {
        const [, x, y] = /:(\d+),(\d+)$/.exec(row.id).map(Number);
        entity = room.entities.find((e) => e.type === 'totempart' && e.x === x && e.y === y);
        item = ITEM_FOR_TAG.totempart;
    } else if (row.kind === 'chest') {
        const chests = room.entities.filter((e) => e.type === 'chest');
        if (chests.length !== 1) {
            throw new Error(`ledger row ${row.id} expects ONE chest in level ${room.level}, found ${chests.length}`);
        }
        [entity] = chests;
        item = ITEM_FOR_TAG.chest;
    } else if (row.kind === 'entity') {
        /**
         * ⛓⛓ EDITOR v3 D1 — **THE ARM A LEVEL-SET EDITOR NEEDS.** Every
         * other arm finds its entity by a KIND whose meaning is a fact about
         * the vanilla game (`the one chest`, `the bosskey of type 3`). An
         * edited set has no such vocabulary, and the address a person
         * clicking a room can actually produce is the entity's own
         * `{type, x, y}` in PIXELS — which is what the OEL element carries.
         *
         * ⛔ EXACT, never nearest. Two entities of one type in a room are
         * ordinary (L12 has three teleporters), so a tolerant match would
         * silently move a location to whichever one sorted first.
         */
        const want = row.entity ?? {};
        entity = room.entities.find((e) => e.type === want.type
            && e.x === want.x && e.y === want.y);
        item = row.vanilla_item;
    } else if (row.kind === 'ending') {
        entity = room.entities.find((e) => e.type === 'seed');
        item = VICTORY_ITEM;
    } else if (row.kind === 'encounter') {
        // The two grants with no pickup entity of their own: Fire is a
        // BobBoss DROP (`BobBoss.as:194`) and the Dark Sword is the Witch's
        // trade (`Witch.as:32-52`). The location is the thing that grants
        // it, which is what a player has to reach.
        //
        // ⛔ AND THE FIRST HALF IS A FINDING (R7 slice 4). The ledger cites
        // "BobBoss drop, L32", and **no .oel in the game places a bobboss
        // at all** — grep every `.oel` for the three tags and get nothing.
        // The fight is started by a FALLING ROCK:
        // `FallRockLarge.as:115-117`, `if (bossRock && thirdBoss)
        // FP.world.add(new BobBoss(72, 72))`. So the location that grants
        // Fire is L32's `fallrocklarge {bossrock 1, thirdboss 1}`, and the
        // three `bobboss*` construction cases in `Game.as:2143-2145` are
        // dead editor vocabulary.
        entity = row.id.startsWith('fire@')
            ? room.entities.find((e) => e.type === 'fallrocklarge'
                && e.attrs?.bossrock === '1' && e.attrs?.thirdboss === '1')
            : room.entities.find((e) => e.type === 'witch');
        item = row.id.startsWith('fire@') ? 'Fire' : 'Progressive Sword';
    }
    return { entity, item };
}

export function locationsFor(room, overlay = {}, deps = {}) {
    const { tileSize } = deps;
    const rows = overlay.locations ?? [];
    const guardOf = overlay.locationGuard ?? (() => null);
    const { resolveCondition, note } = deps;
    const out = [];
    for (const row of rows) {
        if (row.level !== room.level) continue;
        const { entity, item } = entityForLedgerRow(room, row);
        if (!entity) throw new Error(`ledger row ${row.id}: no entity for it in level ${row.level}`);
        if (!item) throw new Error(`ledger row ${row.id}: no AP item name`);
        const loc = {
            name: `${levelName(room.level)} - ${labelFor(row)}`,
            tile: tileOf(entity, tileSize),
            vanilla_item: item,
        };
        // ⛔ THE GATE THAT IS NOT A DOOR: an item guarded by something standing
        // in the same room has no crossing to hang a rule on.
        const guard = guardOf(row.id);
        if (guard) {
            const rule = resolveCondition?.(guard.condition);
            if (!rule) throw new Error(`location guard for ${row.id} does not resolve to a rule`);
            loc.access_rule = rule;
            deps.onGuard?.(loc, guard);
            note?.(`${regionIdFor(room.level)}: location "${loc.name}" GUARDED — ${guard.why} (${guard.cite})`);
        }
        out.push(loc);
    }
    return out;
}

// ── the derivation ────────────────────────────────────────────────────────

/**
 * Build a region atlas from a list of rooms plus an authored overlay.
 *
 * @param {Array<{level:number,width:number,height:number,layers:Array,entities:Array}>} rooms
 * @param {{locations?: Array, locationGuard?: Function,
 *          neverEnter?: {levels: number[], cite?: object}}} overlay
 *   the three AUTHORED things §16.3 names. Everything else is derived.
 * @param {{tileSize: number, tileTypeForPlacement: Function,
 *          resolveCondition?: Function, note?: Function, onGuard?: Function,
 *          atlas?: object, namedRooms?: object}} deps
 *   `atlas` is the envelope handed to `createEmptyAtlas` (game, name,
 *   description, mapSource, mapDocument). ⛓ `namedRooms` is the SET manifest's
 *   own `named_rooms` (EDITOR v3 E5) — OPTIONAL, and absent for the playthrough
 *   generator, which is what keeps the committed atlas's bytes where they are.
 * @returns {{atlas: object, dropped: string[], stats: object}} the atlas
 *   document, UNSTAMPED — the caller owns identity, and stamping on a path that
 *   did not stamp before would move ten committed ids (D0a §18.9 hard #3).
 */
export function deriveAtlas(rooms, overlay = {}, deps = {}) {
    const { tileSize, note } = deps;
    if (!Number.isInteger(tileSize) || tileSize <= 0) {
        throw new Error(`deriveAtlas: deps.tileSize must be a positive integer, got ${JSON.stringify(tileSize)}`);
    }
    const missing = rooms.findIndex((r) => !Number.isInteger(r?.level));
    if (missing >= 0) {
        throw new Error(`deriveAtlas: rooms[${missing}] carries no integer \`level\` id. A parsed .oel does `
            + 'not know its own index — the SET does, so the caller stamps it '
            + '(`{...parseOelLevel(xml), level: i}`). Guessing here would guess which numbering '
            + 'the caller meant, and the map extract and a level set mean different things.');
    }
    const ordered = [...rooms].sort((a, b) => a.level - b.level);
    const roomById = new Map(ordered.map((r) => [r.level, r]));
    const neverEnter = overlay.neverEnter?.levels ?? [];
    const neverEnterCite = overlay.neverEnter?.cite ?? {};

    /**
     * ⛓ `game: 'seedling'` IS SPELLED, not defaulted (E3b, §26.9). It is FIRST
     * so `deps.atlas` still overrides it — a caller deriving into a differently
     * named document (the editor's `seedling-watch-edit`, the arm's own) still
     * wins, which is the behaviour every existing caller already relies on.
     */
    const session = new AtlasSession(createEmptyAtlas({
        game: 'seedling', tileSize, ...(deps.atlas ?? {}),
    }));

    /**
     * ⛓⛓ THE SUBSTRATE IS DERIVED FROM THE ATLAS'S OWN GAME, NEVER SPELLED
     * (EDITOR INTEGRATION W1, plan §2.2 #1).
     *
     * `substrateIdFor` is the compiler's own function — the ONE spelling of
     * `flash_<game>` in the tree, and the standing per-game-substrate ruling of
     * 2026-07-25 lives in it. Writing `'flash_seedling'` here would be a SECOND
     * spelling that happens to agree today: the moment `deps.atlas.game`
     * overrides the default (the editor's `seedling-watch-edit`, the arm's own
     * document — every existing caller relies on that override), the literal
     * would name a substrate the compile is not defaulting to, and the compiler
     * would refuse the whole atlas by name because its table has no such row.
     * So it is read off the SESSION'S atlas, after the override has applied.
     */
    const substrate = substrateIdFor(session.atlas.game);

    // Regions first, so a connection can name any of them.
    for (const room of ordered) {
        session.addRegion({
            region_id: regionIdFor(room.level),
            name: levelName(room.level),
            bounds: { x: 0, y: 0, w: room.width, h: room.height },
            map_ref: room.level,
            substrate,
            rules_source: 'analyzer',
        });
    }

    // Exits: one per link on the source side, one arrival per link on the
    // destination side. Both sides deduplicated by id — two links arriving at
    // the same spot share one arrival exit.
    const seenArrival = new Set();
    for (const room of ordered) {
        for (const { e, to } of linksOf(room, { roomById })) {
            if (neverEnter.includes(to)) {
                note?.(`L${room.level} ${outExitId(e)} -> L${to}: NOT WIRED — trap room, `
                    + `never-enter (${neverEnterCite[to]})`);
                continue;
            }
            session.addExit(regionIdFor(room.level), {
                exit_id: outExitId(e), tiles: [tileOf(e, tileSize)], kind: 'teleporter',
            });
            const inId = inExitId(room.level, e);
            const key = `${to}/${inId}`;
            if (!seenArrival.has(key)) {
                seenArrival.add(key);
                session.addExit(regionIdFor(to), {
                    exit_id: inId, tiles: [arrivalTileOf(e, tileSize)], kind: 'teleporter',
                });
            }
            session.connect(
                [regionIdFor(room.level), outExitId(e)],
                [regionIdFor(to), inId],
                { one_way: true },
            );
        }
        const pit = pitOf(room, { roomById, tileSize, tileTypeForPlacement: deps.tileTypeForPlacement });
        if (pit && neverEnter.includes(pit.to)) {
            note?.(`L${room.level} pits -> L${pit.to}: NOT WIRED — trap room, never-enter`);
        } else if (pit) {
            for (const g of pit.groups) {
                const outId = `out_pit_${g.arrival[0]}_${g.arrival[1]}`;
                const inId = `in_pit_L${room.level}_${g.arrival[0]}_${g.arrival[1]}`;
                session.addExit(regionIdFor(room.level), {
                    exit_id: outId, tiles: g.tiles, kind: 'teleporter',
                });
                session.addExit(regionIdFor(pit.to), {
                    exit_id: inId, tiles: [g.arrival], kind: 'teleporter',
                });
                session.connect(
                    [regionIdFor(room.level), outId],
                    [regionIdFor(pit.to), inId],
                    { one_way: true },
                );
            }
        }
    }

    /**
     * ⛓⛓⛓ **THE `named_rooms` ARRIVALS — EDITOR PATH ONLY, AND THAT IS THE
     * WHOLE POINT OF THE OPTIONAL INPUT** (EDITOR v3 E5, plan §27.6).
     *
     * ⛔ **WHY `deps` AND NOT `overlay`.** `overlay` is the AUTHORED half — the
     * three things §16.3 names, and `overlayToDeriveInput` is the one function
     * that shapes an editor's overlay DOCUMENT into it. `named_rooms` is not
     * authored here at all: it is a field of the SET manifest
     * (`seedlingSetAdapter.SET_FIELDS`), and `seedling-level-set.schema.json`
     * is where its shape lives. Hanging it off `overlay` would invite somebody
     * to author it in a document whose schema has no place for it, and would
     * make `overlayToDeriveInput`'s output stop being the whole overlay input.
     * `deps` is already where a caller's non-overlay facts travel (`atlas`,
     * `tileSize`, `tileTypeForPlacement`).
     *
     * ⛔ **AND THE PRODUCER PASSES NOTHING, SO ITS BYTES DO NOT MOVE.**
     * `make-seedling-playthrough-rules.mjs` has exactly ONE `deriveAtlas` call
     * site and it names no `namedRooms`, so the committed
     * `seedling-playthrough.json` keeps §23.8's hole and its md5 is unmoved —
     * pinned by a row that compares the FILE's md5 across a `--check` run,
     * because an exit code is not an identity.
     *
     * ⛔ **A NEVER-ENTER SOURCE MAKES NO CONNECTION, AND IT IS NOTED RATHER
     * THAN THROWN.** The never-enter ruling is encoded in this derivation as an
     * ABSENCE (see the drop pass below), which is stronger than a rule: AP's
     * fill cannot route through a region that is not in the graph. A warp OUT of
     * a trap room would put that room back in the graph with an exit and undo
     * exactly that. ⚠ MEASURED on vanilla: `tentacle_beast_mouth`'s only source
     * is L57 and `light_boss_exit`'s only source is L69 — BOTH never-enter — so
     * under the playthrough's overlay this pass adds 11 connections and
     * `level_58` stays unreached, while under an EMPTY overlay (what the set
     * editor opens vanilla with) it adds 15 and `level_58` becomes reachable.
     * Two different true answers about one game, and the difference is the
     * overlay.
     */
    for (const row of namedRoomArrivals(ordered, deps.namedRooms, { roomById })) {
        const outId = outExitId(row.entity);
        if (neverEnter.includes(row.from)) {
            note?.(`L${row.from} ${outId} -> L${row.to}: NOT WIRED — the \`${row.key}\` warp `
                + `leaves a trap room, never-enter (${neverEnterCite[row.from]})`);
            continue;
        }
        if (neverEnter.includes(row.to)) {
            note?.(`L${row.from} ${outId} -> L${row.to}: NOT WIRED — the \`${row.key}\` warp `
                + `arrives in a trap room, never-enter (${neverEnterCite[row.to]})`);
            continue;
        }
        session.addExit(regionIdFor(row.from), {
            exit_id: outId, tiles: [tileOf(row.entity, tileSize)], kind: 'teleporter',
        });
        const inId = namedInExitId(row.key, row.from, row.arrival.x, row.arrival.y);
        const key = `${row.to}/${inId}`;
        if (!seenArrival.has(key)) {
            seenArrival.add(key);
            session.addExit(regionIdFor(row.to), {
                exit_id: inId,
                tiles: [[Math.floor(row.arrival.x / tileSize), Math.floor(row.arrival.y / tileSize)]],
                kind: 'teleporter',
            });
        }
        session.connect(
            [regionIdFor(row.from), outId],
            [regionIdFor(row.to), inId],
            { one_way: true },
        );
        note?.(`L${row.from} ${outId} -> L${row.to} ${inId}: the \`${row.key}\` warp `
            + `(${NAMED_ROOMS[row.key].cite})`);
    }

    for (const room of ordered) {
        for (const loc of locationsFor(room, overlay, deps)) {
            session.addLocation(regionIdFor(room.level), loc);
        }
    }

    session.setStart(regionIdFor(ordered[0].level));

    // ⛔ REGIONS WITH NO DOOR AT ALL, dropped and NAMED. In the vanilla 116
    // there are three, each for a reason the source states:
    //   L57 / L69 — the trap rooms. Their exit teleporter is CREATED ON DEATH
    //     (`TentacleBeast.as:213`, `LightBossController.as:104`), so the .oel
    //     holds no link out and this derivation wires none in. The never-enter
    //     ruling is thereby encoded as an ABSENCE, which is stronger than a
    //     rule: AP's fill cannot route through a region that is not in the graph.
    //   L81 — "an orphaned empty room" (§2.2's census, spot-verified at §8.2).
    // A dropped region holding a location would be a lost collectible, so that
    // is an error rather than a note.
    const dropped = [];
    for (const region of [...session.atlas.regions]) {
        if ((region.exits ?? []).length > 0) continue;
        if (session.atlas.vanilla_layout?.start_region === region.region_id) continue;
        if ((region.locations ?? []).length > 0) {
            throw new Error(`${region.region_id} has no entry point but holds `
                + `${region.locations.length} location(s) — that is a lost collectible, not a pocket`);
        }
        note?.(`${region.region_id}: DROPPED — no link in the whole map reaches it and it holds nothing`);
        dropped.push(region.region_id);
        session.removeRegion(region.region_id);
    }

    const atlas = session.atlas;
    return {
        atlas,
        dropped,
        stats: {
            rooms: ordered.length,
            regions: atlas.regions.length,
            exits: atlas.regions.reduce((n, r) => n + r.exits.length, 0),
            locations: atlas.regions.reduce((n, r) => n + r.locations.length, 0),
            connections: atlas.vanilla_layout.connections.length,
        },
    };
}

/**
 * ⛓⛓ **`applyOverlayRules` MOVED TO `procgenCore/setOverlay.js` (EDITOR v3
 * E3b), AND IS RE-EXPORTED HERE BY THE SAME FUNCTION OBJECT.**
 *
 * ⛔ RE-EXPORTED, NOT RE-WRAPPED — the E1c/E2b pattern. D1's rows, E2a's maze
 * derivation and `seedlingSetAdapter` all import this name from HERE, and a
 * copy would be a second function that could drift from the one the maze runs;
 * a row asserts the identity with `===` across all three paths.
 *
 * ⛓ WHY IT MOVED: §26.5 measured that it is a pure function of an atlas and a
 * `Map<room, Map<exit_id, rule>>` with nothing Seedling in it, and E2a's maze
 * derivation was already importing it across substrates. Its refusal — *"an
 * authored rule that vanished would leave the author believing a door is gated
 * and the compiler treating it as free"* — is every substrate's.
 */
export { applyOverlayRules } from '../procgenCore/setOverlay.js';
