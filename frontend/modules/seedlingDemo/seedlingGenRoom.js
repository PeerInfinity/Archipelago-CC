/**
 * seedlingDemo/seedlingGenRoom — **A GENERATED SEEDLING ROOM, AS A PIPELINE
 * REGION** (seedling generated levels G1; ⚖ Q1–Q7 ruled 2026-09-23).
 *
 * The pipeline SPECIFIES a room — its size, the exits it must have, the AP
 * locations it must hold — and this module answers with a room the Seedling
 * generator built for that spec (`generateSeedlingLevel`, the one producer
 * `export-seedling-level-set.mjs` uses), doors bound to the exits, locations on
 * cells the player can reach. The registry entry `flash_seedling_gen`
 * (`flashPanel/flashSeedlingGenLibrary.js`) calls these through its install
 * seam; this module imports no engine and no registry.
 *
 *   world = {
 *     region_id, seed, size: {width, height}, record, start: {tx, ty},
 *     goalCell: {tx, ty}, generation: {…the knobs that built it},
 *     exits: Map<exit_id, {exit_id, door_id, side, exitName, targetRegion,
 *                          isBackExit, isTeleporter, kind: 'teleporter',
 *                          exit_tiles, entrance_tile, entrance_spawn}>,
 *     locations: [{id, item?, cell, tag, name?, access_rule?, kind?}],   (kind: a door chest's, LAST)
 *     summary,
 *   }
 *
 * ── ⛓ THE MAP KEY IS THE AP EXIT NAME; THE DOOR IS `door_id` ──────────────
 *
 * The engine keys a region's exit Map by the extracted exit id — the id
 * `exits_placed` names and `stitchGrid` / `wallOffUnusedExits` /
 * `insertBackExit` address — so that is the AP exit's name, and it is the
 * caller's `exit_id` when given, else the maze's default (`exit` for one exit,
 * `exit_<i>` for several: the text adventure's rule, so a region's exit names
 * do not move with its substrate). The DOOR the exit becomes is spelled
 * `out_teleporter_<px>_<py>` (`seedlingAtlasDerivation.outExitId`'s spelling, so
 * the binding's departure arm 1 matches it) and rides `door_id` on the world and
 * `exit_id` in the sidecar, beside `exitName` = the AP name — flash_seedling's
 * T1 shape.
 *
 * ── ⛓ THE k-TH EXIT TAKES THE k-TH DOOR (T1's relabel law) ────────────────
 *
 * A Seedling door has no side. The doors are minted by the LINKER's own rule
 * (`levelSetExits.pickDoorCells`: one flood from the start with every solid
 * live, farthest first, never adjacent to another door, never the start), and
 * the k-th exit asked for takes the k-th door. An exit the ENGINE adds after
 * the core ran — sphere growth's back exit to the parent, top-down's reverse
 * exits — has no door yet; `serializeGenRoom` mints one for it from the same
 * picker, clear of every door already bound and of the location cells.
 *
 * ── ⛓ AN ARRIVAL LANDS ON THE DOOR'S APPROACH CELL ────────────────────────
 *
 * `entrance_spawn` is the flood predecessor of the door cell, in pixels — never
 * the door tile: a door the player is booted onto does not fire until they
 * step off it (trap 973's latch), and the game does not draw the player on a
 * teleporter tile (T2b U2b). Free and adjacent by construction.
 *
 * ── ⛓ LOCATION 0 IS THE GOAL CELL ────────────────────────────────────────
 *
 * The generator certifies ONE reach: its goal pickup (`torchpickup`). The first
 * AP location stands on that cell, so the certification IS "the check is
 * reachable"; the rest stand on the flood's cells nearest the start, never on a
 * door, next to one, or on the start. Each takes a tag from
 * `procgenSeedling.placementTagId` (the one writer), read against the room
 * WITHOUT its goal pickup — the assembler replaces that pickup with location 0.
 * ⛔ The record in the sidecar stays the BARE generated room (no door entities,
 * no `apitem`s): G2's assembler emits both from the sidecar's own lists.
 *
 * ⛓ The PLAY-TIME half — the payload's shape, its refusal, `deserializeWorld`,
 * the knob defaults and the door spelling — is `seedlingGenRoomPayload.js`,
 * which imports no generator, so the light registry entry can reach it.
 *
 * Headless-safe: no `node:` imports and no DOM.
 */

import { chestDoorLocationName, generateSeedlingLevel, placementTagId, seedlingOracle } from './procgenSeedling.js';
import { VERDICT, collectGoal } from './procgenOracle.js';
import {
    CALDERA_PALETTE, ENDGAME_PALETTE, FLOODED_RUINS_PALETTE, FROZEN_FORGE_PALETTE,
    POST_DARK_SUIT_PALETTE, POST_FEATHER_PALETTE, POST_FIRE_PALETTE, POST_SHIELD_PALETTE,
    POST_SPEAR_PALETTE, POST_SWIM_PALETTE, PRE_SWORD_PALETTE, POST_SWORD_PALETTE, parseTerrainList, withTerrains,
} from './procgenPalette.js';
import { pickDoorCells } from './levelSetExits.js';
import { TILE_SIZE, buildLevelWorld, tagOf } from './levelWorld.js';
import { ROOM_TILES_MAX, ROOM_TILES_MIN } from './procgenLevel.js';
import { GEN_LOOK_NAMES, applyLook } from './procgenLook.js';
import { coreLevelRecord } from './levelSetValidator.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';
import { makeLocationName } from '../procgenCore/apLocationNaming.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import {
    ELEMENT_LIST_SEP, REQUIRE_DIRECTIVE_REFUSALS, STRATEGY_REQUIRE_PREFIX, parseElementSpec, parseItemRequireList,
} from '../procgenCore/elementSpec.js';
import { KEY_GATE } from '../procgenCore/elements/keyGate.js';
import { parseAreaSpec } from '../procgenCore/areaSpec.js';
import { markAuthoredRule } from '../procgenCore/authoredRule.js';
import { GEN_ROOM_LOCATION_CEILING, genRoomFloorCells } from './seedlingGenCapacity.js';
import {
    BOSS_KEY_ITEM_NAMES, GEN_ROOM_BIOME_NAMES, GEN_ROOM_DEFAULTS, GEN_ROOM_REFUSALS, GEN_ROOM_TILE_SIZE, genDoorId,
} from './seedlingGenRoomPayload.js';

export {
    GEN_ROOM_BIOME_NAMES, GEN_ROOM_DEFAULTS, GEN_ROOM_REFUSALS, GEN_ROOM_TILE_SIZE, genDoorId,
    deserializeGenRoom, genRoomRefusal, genRoomApLocationNames,
} from './seedlingGenRoomPayload.js';

/** The rule every ungated exit / location compiles to. */
const TRUE_RULE = Object.freeze({ rule: 'True_' });
const isTrueRule = (rule) => rule?.rule === 'True_';
const cloneRule = (rule) => structuredClone(rule);

/** The biomes a room can be built in — the palettes `watchGenerate.GENERATE_BIOMES` offers
 *  (S1 added `post-shield`, T4-swim `post-feather`; `GEN_ROOM_BIOME_NAMES` is the same list by name). */
export const GEN_ROOM_BIOMES = Object.freeze({ 'pre-sword': PRE_SWORD_PALETTE, 'post-sword': POST_SWORD_PALETTE,
    'post-shield': POST_SHIELD_PALETTE, 'post-swim': POST_SWIM_PALETTE, 'post-feather': POST_FEATHER_PALETTE,
    // ⛓ seedling-gen-biomes-1 (C2) — the census boots of D4, D7, D8 and the End.
    'post-fire': POST_FIRE_PALETTE, 'post-spear': POST_SPEAR_PALETTE, 'post-dark-suit': POST_DARK_SUIT_PALETTE,
    endgame: ENDGAME_PALETTE,
    // ⛓ seedling-gen-new-biomes (C4) — the three new biomes (design §3.4).
    caldera: CALDERA_PALETTE, 'frozen-forge': FROZEN_FORGE_PALETTE, 'flooded-ruins': FLOODED_RUINS_PALETTE });
if (Object.keys(GEN_ROOM_BIOMES).join() !== GEN_ROOM_BIOME_NAMES.join()) {
    throw new Error('seedlingGenRoom: GEN_ROOM_BIOMES and GEN_ROOM_BIOME_NAMES disagree — one list, two spellings');
}

const cellKey = (c) => `${c.tx},${c.ty}`;

/**
 * ⛓⛓ seedling-gen-chestdoor-ap — **EACH DOOR CHEST IS AN AP LOCATION** (⚖ the user, 2026-10-30: chests as
 * DOORS, and each door chest IS an Archipelago location — it always drops a seal piece). The draw's
 * `summary.chestDoors` (`procgenSeedling.chestDoorLocationsOf`, ABSENT on a room without one) becomes one
 * location row per chest, added AFTER the draw: the chest's own cell and its FIXED tag (the binding allocated
 * it, and it is the game's check address — opening the chest clears it). Nothing re-rolls for a chest door:
 * the element is opt-in and may not place, and a room without one has no row.
 *
 *   · `kind: 'chest-door'` marks the row everywhere it travels (the world, the payload, the set's table), so
 *     the placers never SEAT it (its cell and tag are the chest's), location 0 stays the GOAL, and the set
 *     assembler never replaces the chest with an `apitem` (`seedlingGeneratedSet.placeApItems`).
 *   · its `item` is the engine's slot filler (`procgenPipelineEngine.LIBRARY_SLOT_FILLER_ITEM`, the same
 *     string; this module imports no engine), so the compiled pool gains ONE item per door chest and items
 *     == locations (`compileLocation` pools a location's item).
 *   · the name is `chestDoorLocationName(<region>)`, vanilla's `Level NNN - Chest` shape; a second chest in
 *     one room (no element places one today) would be `… - Chest 2`.
 */
export const CHEST_DOOR_KIND = 'chest-door';
export const CHEST_DOOR_ITEM = 'Region Library Filler';
/**
 * ⛓⛓ seedling gen B1 — **A LOOT CHEST IS AN AP LOCATION THE SAME WAY** (⚖ the user 2026-11-01, *"(e)
 * Loot/goal chests"*): the draw's `summary.lootChests` (`procgenSeedling.lootChestLocationsOf`) becomes one
 * row per chest, `kind: 'chest-loot'`, the chest's own cell and FIXED tag, the same filler item (pool +1), never
 * seated, never replaced by an `apitem`.
 *
 * ⛓ THE NAMES ARE UNIQUE PER ROOM BY ONE NUMBERING: every chest of a room is `<region> - Chest`, door chests
 * first and loot chests after them, the second and later ones suffixed ` 2`, ` 3`, … (`chestRows`). A level
 * holds one element, so today a room has at most ONE chest and every name is the plain vanilla shape; a room
 * that held a door chest AND a loot chest would name them `… - Chest` and `… - Chest 2`. A door-chest room's
 * rows are byte-identical to `chestDoorRows`'.
 */
export const CHEST_LOOT_KIND = 'chest-loot';
/**
 * ⛓⛓ strategy elements round 2 — **THE KEY GATE'S KEY SPOT IS AN AP LOCATION, AND THE KEY AN AP ITEM** (⚖ the
 * user 2026-11-03: *"a randomized AP item whose vanilla placement is the key"*). The draw's `summary.bossKeys`
 * (`procgenSeedling.bossKeyLocationsOf`) becomes one row per key: `kind: 'boss-key'`, the key's own cell and
 * FIXED tag (never seated: the element chose the cell, the binding the tag), named the vanilla way
 * (`Level 019 - Boss Key 0` → `<region> - Boss Key <t>`), holding the Seedling world's key ITEM for its type
 * (`Red Key` for type 0; `BOSS_KEY_ITEMS` is `seedlingAtlasDerivation.ITEM_FOR_KEY`, pinned equal). So the
 * compiled pool gains that item (+1 location, +1 item) and VANILLA PLACEMENT puts the key on its own spot.
 *
 * ⛔ UNLIKE A CHEST the assembler REPLACES the `bosskey` with an `apitem` like any location (⚖ no special
 * grants: the key reaches the player only through that location's item). And the lock is a LOGIC rule: every
 * location on the goal cell — behind the lock by the element's cut — requires the key item (`keyRuleOf`).
 */
export const BOSS_KEY_KIND = 'boss-key';
/** The Seedling world's key items by `keyType` (`seedlingAtlasDerivation.ITEM_FOR_KEY`, pinned equal). */
export const BOSS_KEY_ITEMS = BOSS_KEY_ITEM_NAMES;
/** `<room> - Boss Key <t>`, vanilla's `Level 019 - Boss Key 0` shape. */
export const bossKeyLocationName = (regionId, keyType) => `${regionId} - Boss Key ${keyType}`;
const isChestDoor = (l) => l?.kind === CHEST_DOOR_KIND;
const isLootChest = (l) => l?.kind === CHEST_LOOT_KIND;
const isBossKey = (l) => l?.kind === BOSS_KEY_KIND;
/** A row whose cell and tag are a CHEST's (door or loot): never seated, never replaced. */
const isChestRow = (l) => isChestDoor(l) || isLootChest(l);
/** A row whose cell and tag the DRAW fixed (a chest's, or a key spot's): never seated, kept LAST. */
const isFixedRow = (l) => isChestRow(l) || isBossKey(l);
/** The locations a placer seats (every row but a fixed one). */
const seatedOf = (world) => world.locations.filter((l) => !isFixedRow(l));

/** One location row per door chest of the draw's `summary` — `[]` without one. */
export function chestDoorRows(regionId, summary) {
    return chestRows(regionId, { chestDoors: summary?.chestDoors });
}

/** One location row per chest (door chests, then loot chests) of the draw's `summary` — `[]` without one. */
export function chestRows(regionId, summary) {
    const all = [
        ...(summary?.chestDoors ?? []).map((c) => ({ c, kind: CHEST_DOOR_KIND, id: 'chest_door' })),
        ...(summary?.lootChests ?? []).map((c) => ({ c, kind: CHEST_LOOT_KIND, id: 'chest_loot' })),
    ];
    const perKind = new Map();
    return all.map(({ c, kind, id }, n) => {
        const k = perKind.get(kind) ?? 0;
        perKind.set(kind, k + 1);
        return {
            id: k === 0 ? id : `${id}_${k + 1}`,
            name: n === 0 ? chestDoorLocationName(regionId) : `${chestDoorLocationName(regionId)} ${n + 1}`,
            kind,
            item: CHEST_DOOR_ITEM,
            cell: { tx: c.cell.tx, ty: c.cell.ty },
            tag: c.tag,
        };
    });
}

/** One location row per key spot of the draw's `summary` — `[]` without one. ⛓ ONE key gate per level, so
 *  the name is unique per room; a second key (none is placed today) would take ` 2` after the type. */
export function bossKeyRows(regionId, summary) {
    return (summary?.bossKeys ?? []).map((k, n) => ({
        id: n === 0 ? 'boss_key' : `boss_key_${n + 1}`,
        name: n === 0 ? bossKeyLocationName(regionId, k.keyType) : `${bossKeyLocationName(regionId, k.keyType)} ${n + 1}`,
        kind: BOSS_KEY_KIND,
        item: BOSS_KEY_ITEMS[k.keyType],
        cell: { tx: k.cell.tx, ty: k.cell.ty },
        tag: k.tag,
    }));
}

/** Every FIXED row of a draw: its chests (`chestRows`), then its key spots (`bossKeyRows`). */
export function fixedRows(regionId, summary) {
    return [...chestRows(regionId, summary), ...bossKeyRows(regionId, summary)];
}

/**
 * ⛓ THE LOCK AS A RULE — a location standing on the GOAL cell of a room with a key spot requires that key's
 * item (`Has(<key item>)`, ANDed onto its own rule; `True_` becomes the bare `Has`). The goal is behind the lock
 * BY CONSTRUCTION (the key gate is a CUT between the start and the goal) and every other location stands on
 * the start side (`locationCells` floods with the lock solid). `null`: no key spot, or not the goal cell.
 */
function keyRuleOf(world, loc) {
    const key = (world.locations ?? []).find(isBossKey);
    if (!key || !world.goalCell || isFixedRow(loc) || cellKey(loc.cell) !== cellKey(world.goalCell)) return null;
    return { rule: 'Has', args: { item_name: key.item } };
}

/** Does `rule` REQUIRE `item` — `Has(item)` itself, or an `And` with it among its children? */
function ruleHas(rule, item) {
    if (!rule) return false;
    if (rule.rule === 'Has' && rule.args?.item_name === item) return true;
    return rule.rule === 'And' && (rule.children ?? []).some((c) => ruleHas(c, item));
}

/** `rule` with the room's own key requirement for `loc` ANDed on (unchanged without one). */
function withKeyRule(world, loc, rule) {
    const need = keyRuleOf(world, loc);
    if (!need) return rule;
    // ⛓ keygate colours — a location the PLANNER already ruled behind the key keeps its rule as is.
    if (ruleHas(rule, need.args.item_name)) return rule;
    if (!rule || isTrueRule(rule)) return need;
    return { rule: 'And', children: [cloneRule(rule), need] };
}

/** The world's `summary` from a draw's: `stop`, `keptCount`, and `chestDoors` / `lootChests` / `bossKeys` ONLY
 *  when the draw placed one. */
const summaryOf = (out) => ({ stop: out.summary.stop ?? null, keptCount: out.summary.keptCount ?? null,
    ...(out.summary.chestDoors ? { chestDoors: out.summary.chestDoors } : {}),
    ...(out.summary.lootChests ? { lootChests: out.summary.lootChests } : {}),
    ...(out.summary.bossKeys ? { bossKeys: out.summary.bossKeys } : {}) });
const around = (c) => [[0, -1], [-1, 0], [1, 0], [0, 1]].map(([dx, dy]) => ({ tx: c.tx + dx, ty: c.ty + dy }));

/** Read one knob of the bag, falling back to the default; strings are trimmed. */
function knobsOf(params) {
    const bag = { ...GEN_ROOM_DEFAULTS, ...(params?.seedlingGen ?? {}) };
    return {
        biome: String(bag.biome),
        obstacleTarget: Number(bag.obstacleTarget),
        triesPerStep: Number(bag.triesPerStep),
        saturationK: Number(bag.saturationK),
        skeleton: String(bag.skeleton ?? '').trim(),
        elements: String(bag.elements ?? '').trim(),
        areas: String(bag.areas ?? '').trim(),
        fill: String(bag.fill ?? 'dense'),
        /** ⛓ S1, D4 — ONLY WHEN GIVEN: an absent (or empty) `require` adds no key,
         *  so `generation` — which spreads these knobs — is byte-identical. */
        ...(String(bag.require ?? '').trim() !== '' ? { require: String(bag.require).trim() } : {}),
        /** ⛓ seedling-gen-biomes-1 (C1) — the look, ONLY WHEN GIVEN, as `require`. */
        ...(String(bag.look ?? '').trim() !== '' ? { look: String(bag.look).trim() } : {}),
        /** ⛓ seedling-gen-terrains (C3) — the opted-in terrains (`'ice'`, `'stairs,ghoststep'`), ONLY WHEN
         *  GIVEN, as `require`: absent, `generation` is byte-identical. Normalized sorted, comma-joined. */
        ...(parseTerrainList(bag.terrains).length > 0 ? { terrains: parseTerrainList(bag.terrains).join(',') } : {}),
    };
}

/** The key gate's element head (`ELEMENT_TABLE` key = the element's family). */
const KEYGATE_HEAD = KEY_GATE.family;
const KEYLOCK_REQUIRE = `${STRATEGY_REQUIRE_PREFIX}keylock`;
const headOf = (member) => member.split(';')[0].trim();

/**
 * ⛓⛓ keygate colours (slice 2) — **WHICH ITEMS A ROOM UNDER `params` CAN INTRODUCE** (the entry's
 * `itemIntroduction.introducibleItems`; vocabulary `procgenCore/itemIntroduction.js`). It is the key items of the
 * colours its key gate may take: all five, in `keyType` order, for a `keygate` with no `type`; the ONE colour of an
 * explicit `keygate;type=N`; and `[]` when the elements name no key gate. A knob that does not parse answers `[]`
 * here, because the draw refuses it by name.
 */
export function introducibleGenItems(params) {
    const { elements } = knobsOf(params);
    if (elements === '') return [];
    let spec;
    try { spec = parseElementSpec(elements); } catch { return []; }
    const gate = (spec.any ?? [spec]).find((m) => m.name === KEYGATE_HEAD);
    if (!gate) return [];
    return Number.isInteger(gate.params?.type) ? [BOSS_KEY_ITEMS[gate.params.type]] : [...BOSS_KEY_ITEMS];
}

/**
 * The knobs a REQUESTED room draws with (`input.introduce`, `procgenCore/itemIntroduction.js`):
 *   · asked for key K: the elements become `keygate;type=<K's colour>`, and `strategy:keylock` joins `require`, so
 *     every draw the budget keeps is a key-gate room the solver grades REQUIRED;
 *   · asked for NONE (requests on, this room not chosen): the key gate is dropped from the elements, because a key
 *     the planner did not schedule would move every later sphere.
 * `generation` spreads these knobs, so a payload re-draws (`redrawGenRoom`) the room it was built as.
 */
function requestedKnobs(regionId, knobs, introduce) {
    const keys = Object.keys(introduce?.items ?? {});
    if (keys.length > 1) throw new Error(GEN_ROOM_REFUSALS.keygateTwoKeys(regionId, keys));
    if (keys.length === 0) {
        const kept = knobs.elements.split(ELEMENT_LIST_SEP).filter((m) => headOf(m) !== KEYGATE_HEAD);
        return { ...knobs, elements: kept.join(ELEMENT_LIST_SEP) };
    }
    const type = BOSS_KEY_ITEMS.indexOf(keys[0]);
    if (type < 0) throw new Error(GEN_ROOM_REFUSALS.keygateRequest(regionId, keys[0], 'it is not a key item'));
    const asked = knobs.require ? knobs.require.split(',').map((r) => r.trim()) : [];
    return {
        ...knobs,
        elements: `${KEYGATE_HEAD};type=${type}`,
        require: [...asked.filter((r) => r !== KEYLOCK_REQUIRE), KEYLOCK_REQUIRE].join(','),
    };
}

/** The one key item a request asks for, or `null`. */
const requestedKey = (introduce) => Object.keys(introduce?.items ?? {})[0] ?? null;

/**
 * A draw's fixed rows with a REQUESTED key spot under the pipeline's own location id: the planner placed the key
 * at that location (`world.introducedIds`), so a re-roll keeps the id the AP logic names.
 */
function introducedFixedRows(world, regionId, summary) {
    const ids = world.introducedIds ?? {};
    return fixedRows(regionId, summary).map((r) => (isBossKey(r) && ids[r.item] ? { ...r, id: ids[r.item] } : r));
}

/**
 * The generator's input for one knob set. A string spec is parsed by the ONE
 * parser of its grammar and passed only when given, so an absent knob reaches
 * the generator as `undefined` — its own default, the CLI's.
 */
function generatorInput(regionId, seed, size, knobs) {
    const biomePalette = GEN_ROOM_BIOMES[knobs.biome];
    if (!biomePalette) {
        throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, 'biome', knobs.biome,
            `the biomes are [${Object.keys(GEN_ROOM_BIOMES).join(', ')}]`));
    }
    let palette = biomePalette;
    try { palette = withTerrains(biomePalette, knobs.terrains); } catch (e) {
        throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, 'terrains', knobs.terrains, e.message));
    }
    if (knobs.look !== undefined && !GEN_LOOK_NAMES.includes(knobs.look)) {
        throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, 'look', knobs.look,
            `the looks are [${GEN_LOOK_NAMES.join(', ')}]`));
    }
    for (const key of ['obstacleTarget', 'triesPerStep', 'saturationK']) {
        if (!Number.isInteger(knobs[key]) || knobs[key] < 0) {
            throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, key, knobs[key], 'it must be a non-negative integer'));
        }
    }
    const parsed = (key, parse) => {
        if (knobs[key] === '') return undefined;
        try { return parse(knobs[key]); } catch (e) {
            throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, key, knobs[key], e.message));
        }
    };
    return {
        seed,
        palette,
        bounds: { obstacleTarget: knobs.obstacleTarget, triesPerStep: knobs.triesPerStep, saturationK: knobs.saturationK },
        defaults: { width: size.width, height: size.height },
        skeleton: parsed('skeleton', (v) => parseSkeleton(v, { substrate: 'seedling' })),
        elements: parsed('elements', parseElementSpec),
        areas: parsed('areas', parseAreaSpec),
        ...(knobs.fill !== 'dense' ? { fill: knobs.fill } : {}),
        /** ⛓ S1, D4 — through the CLI's ONE parser, and only when given. */
        ...(knobs.require !== undefined
            ? { require: parsed('require', parseItemRequireList) } : {}),
    };
}

/**
 * ⛓ region-editor-launch S2 — **THE GENERATOR'S OWN DRAW OF A STORED ROOM.** A
 * payload keeps the seed it was drawn with (after any re-roll), its final
 * `size` and its knobs (`generation` spreads them), so one call reproduces the
 * draw — and with it the `model` the generator certified the room under, which
 * is what an EDITED room is re-certified against.
 */
export function redrawGenRoom(payload, regionId = '?') {
    const knobs = knobsOf({ seedlingGen: payload?.generation ?? {} });
    return generateSeedlingLevel(generatorInput(regionId, payload.seed, payload.size, knobs));
}

/**
 * ⛓⛓ region-editor-launch S2 (⚖ the user, 2026-10-19: an edited generated room
 * is re-checked at Save; a failing room is SAVED and FLAGGED, never refused) —
 * **IS THIS ROOM STILL WHAT THE GENERATOR GUARANTEED?** The generator's own
 * oracle (never the hammer-phase solver: a tape producer whose legs take
 * minutes), under the model of the room's own draw (`redrawGenRoom`), with
 * every door as a WALL — the G2 rule `goalHoldsWithDoorsAsWalls` applies — once
 * per goal: the generator's own (`goal_cell`) and then every other location's,
 * each as a collect goal on a pickup placed there.
 *
 * ⛓ MEASURED (2026-10-19): 18–69 ms a solve; every committed generated room
 * certifies unedited.
 *
 * @returns {{certified: boolean, failures: string[]}} `failures` names each
 *   location whose solve did not come back SOLVED, with the verdict
 */
export function certifyGenRoom(payload, regionId = '?') {
    const drawn = redrawGenRoom(payload, regionId);
    const items = bootItems(payload.generation?.biome);
    const doorKeys = new Set(payload.exits.flatMap((e) => (e.exit_tiles ?? []).map(([tx, ty]) => cellKey({ tx, ty }))));
    const layers = payload.record.layers.map((layer) => {
        if (!Array.isArray(layer.tiles)) return layer;
        const wall = layer.tiles.find(([tx, ty]) => tx === 0 && ty === 0)?.[2];
        return { ...layer, tiles: layer.tiles.map((t) => (doorKeys.has(cellKey({ tx: t[0], ty: t[1] }))
            ? [t[0], t[1], wall, ...t.slice(3)] : t)) };
    });
    const failures = [];
    // ⛓ The GOAL first — `goal_cell`, where the draw's pickup stands (location 0
    //   when the room has locations; a room may have none) — then every other
    //   location, each given a pickup of its own.
    const goal = payload.goal_cell;
    const targets = [{ name: 'the goal', cell: goal, own: true },
        // ⛓ seedling-gen-chestdoor-ap — a door chest is no pickup cell: the generator's own seam
        //   (`chestDoorBypassRefusal`) is what certifies it; a pickup there would replace the door.
        //   ⛓ B1 — nor is a loot chest: its row is certified by the generator (a second collect goal).
        //   ⛓ strategy elements r2 — nor is a key spot: it is the goal solve's FIRST collect (below).
        ...payload.locations.filter((l) => cellKey(l.cell) !== cellKey(goal) && !isFixedRow(l))
            .map((l) => ({ name: l.name, cell: l.cell, own: false }))];
    for (const t of targets) {
        const x = t.cell.tx * TILE_SIZE;
        const y = t.cell.ty * TILE_SIZE;
        // ⛓ The draw's own record fields (`level`, …) under the payload's room:
        //   the sidecar keeps only the core record (`coreLevelRecord`).
        let record = { ...drawn.record, ...payload.record, layers };
        if (!t.own) {
            record = { ...record, entities: [...(record.entities ?? []).filter((e) => !(e.x === x && e.y === y)),
                { type: 'torchpickup', x, y, attrs: {} }] };
        }
        // ⛓ strategy elements r2 — a key gate's lock opens only with its key IN HAND: every target is solved
        //   after collecting the key spot first (the generator's own goal list, `keyGateGoals`).
        //   ⛔ ONLY for the goal (the one target behind the lock): a start-side target is certified alone, as
        //   before — a pickup standing in the corridor would otherwise read as an obstacle on the walk to the key.
        const keyGoals = !t.own ? [] : payload.locations.filter(isBossKey)
            .map((k) => collectGoal(k.cell.tx * TILE_SIZE, k.cell.ty * TILE_SIZE));
        const model = { boot: drawn.model.boot, goals: Object.freeze([...keyGoals, collectGoal(x, y)]) };
        const verdict = seedlingOracle({ model, items }).solve(record).verdict;
        if (verdict !== VERDICT.SOLVED) failures.push(`${t.name} (${String(verdict)})`);
    }
    return { certified: failures.length === 0, failures };
}

/**
 * The side a side-less exit takes (the text adventure's `sideAssigner`): the
 * still-FREE sides first, then cycling — a Seedling side is only a label, so a
 * room may hold two exits on one side, and a seven-exit room is legal.
 */
function sideAssigner(requested) {
    const free = SIDES.filter((s) => !requested.some((e) => e.side === s));
    let cycle = 0;
    return () => free.shift() ?? SIDES[cycle++ % SIDES.length];
}

/** The fields `doorFields` writes — what a re-roll replaces on an exit record in place. */
const DOOR_FIELDS = Object.freeze(['door_id', 'kind', 'exit_tiles', 'entrance_tile', 'entrance_spawn']);

/** The door fields one cell contributes to an exit record. */
function doorFields(cell) {
    return {
        door_id: genDoorId(cell),
        kind: 'teleporter',
        exit_tiles: [[cell.tx, cell.ty]],
        entrance_tile: [cell.tx, cell.ty],
        // ⛓ the APPROACH cell (the flood predecessor), never the door tile
        entrance_spawn: { x: cell.from.tx * TILE_SIZE, y: cell.from.ty * TILE_SIZE },
    };
}

/**
 * ⛓ HOW MANY TIMES a room is re-rolled before it refuses — ONE budget per room,
 * whichever case asks (G2: its doors cannot be seated without sealing an
 * approach or its hazards; G5: an ENGINE-added door cannot be, or its locations
 * find too few safe cells). Measured: the registry's 8×6 drive room needs 2,
 * top-down `seedling_atlas` at 10×10 at most 4, seeds 1–8.
 */
export const GEN_ROOM_DOOR_REROLLS = 8;

/**
 * ⛓ G5 — WHICH CASE CAUSED THE LAST RE-ROLL, as `generation.rerollCause`
 * (written only when `rerolls` > 0, so a first-draw room's `generation` is
 * unchanged): the core's own doors (G2), an engine-added door (the sphere's back
 * exit, grid growth's links — re-rolled at serialize time), or the locations.
 */
export const GEN_ROOM_REROLL_CAUSES = Object.freeze({
    doors: 'doors',
    /** ⛓ S1, D4 — the draw's `require` directive was not met (see `drawRoom`). */
    require: 'require',
    engineDoors: 'engine-added door',
    locations: 'locations',
});

/**
 * ⛓ G8 — **A ROOM THE BUDGET CANNOT SEAT GROWS.** After `GEN_ROOM_DOOR_REROLLS`
 * re-rolls at a size, the room grows by this many tiles on each side (each side
 * capped at `GEN_ROOM_MAX_SIDE`) and the budget runs again there. Measured (G8 W0):
 * 2 closes the census's core refusals in fewer grows than 1.
 */
export const GEN_ROOM_GROW_STEP = 2;

/**
 * ⛓ G8 — the largest side a room grows to: the room contract's own maximum
 * (`procgenLevel.ROOM_TILES_MAX`, measured over the shipped atlas). A room the
 * budget cannot seat at this size REFUSES, naming every size it tried.
 */
export const GEN_ROOM_MAX_SIDE = ROOM_TILES_MAX;

/**
 * ⛓ G8 — THE SIZE OF ATTEMPT `a`: the room's own (`origin`) for the first
 * `GEN_ROOM_DOOR_REROLLS + 1` attempts, then grown one step per spent budget,
 * each side capped. Attempts 0…K are the pre-G8 sequence, byte for byte.
 */
export function sizeOfAttempt(origin, a) {
    const grows = Math.floor(a / (GEN_ROOM_DOOR_REROLLS + 1));
    const side = (v) => (v >= GEN_ROOM_MAX_SIDE ? v : Math.min(GEN_ROOM_MAX_SIDE, v + GEN_ROOM_GROW_STEP * grows));
    return { width: side(origin.width), height: side(origin.height) };
}

/** ⛓ G8 — the LAST attempt of a room of size `origin`: the whole budget spent at the capped size. */
export function lastAttempt(origin) {
    const short = Math.max(0, GEN_ROOM_MAX_SIDE - Math.min(origin.width, origin.height));
    return (Math.ceil(short / GEN_ROOM_GROW_STEP) + 1) * (GEN_ROOM_DOOR_REROLLS + 1) - 1;
}

/**
 * ⛓ G8 — CAN A ROOM OF `size` HOLD `demand` CELLS AT ALL? Its interior (the
 * border is wall by construction) less the start. A size that cannot is SKIPPED
 * without a draw: no draw there could seat them, so the first attempt that
 * builds is unchanged, and a demand no size up to the cap holds refuses at once
 * instead of generating every size (measured G8 W0: a 30×30 room ≈ 15 s).
 */
export function roomCanHold(size, demand) {
    // ⛓ G9 — the count is the declaration's (`seedlingGenCapacity.genRoomFloorCells`), so the two cannot drift.
    return demand <= genRoomFloorCells(size);
}

/**
 * A size the room contract allows — only such a size is ever SKIPPED; one
 * outside it is drawn, so the generator refuses it in its own sentence (a bad
 * size is the caller's, and no growth rescues it).
 */
const inContract = (z) => [z.width, z.height].every((v) => Number.isInteger(v) && v >= ROOM_TILES_MIN && v <= ROOM_TILES_MAX);

/** The error of an attempt skipped by `roomCanHold`, in `pickDoorCells`' words. */
const cannotHold = (regionId, size, demand) => new Error(`levelSetExits: room '${regionId}' needs ${demand} cell(s) `
    + `for its doors and locations, more than a ${size.width}x${size.height} room's interior holds`);

/** ⛓ G8 — every size a room tried from attempt `from` to `to` (inclusive), in order, each once. */
export function sizesTried(origin, to, from = 0) {
    const seen = [];
    for (let a = from; a <= to; a += 1) {
        const { width, height } = sizeOfAttempt(origin, a);
        if (!seen.some((z) => z.width === width && z.height === height)) seen.push({ width, height });
    }
    return seen;
}

/** The sizes a refusal names, and the budget spent at each. */
const grownRefusal = (origin, to) => ({
    sizes: sizesTried(origin, to).map((z) => `${z.width}x${z.height}`),
    step: GEN_ROOM_GROW_STEP,
    max: GEN_ROOM_MAX_SIDE,
    budget: GEN_ROOM_DOOR_REROLLS,
});

/**
 * The room seed of attempt `k`: the drawn seed itself at 0, then a fixed integer
 * hash of (drawn, k) — never 0 (Seedling refuses seed 0), never the engine's rng.
 */
export function rerollSeed(drawn, k) {
    if (k === 0) return drawn;
    return (((Math.imul(drawn, 2654435761) + Math.imul(k, 40503)) >>> 1) % 0x7fffffff) || 1;
}

/**
 * ⛓ DOES THE GOAL STILL CERTIFY WITH THE DOORS AS WALLS? One solve of the
 * generator's own oracle over a COPY of the room whose door tiles are the room's
 * wall tile (its corner — the border is wall by construction, never a typed id).
 * `true`, or the solve's verdict as a string.
 */
export function goalHoldsWithDoorsAsWalls(out, doors, items) {
    const doorKeys = new Set(doors.map((d) => cellKey(d)));
    const layers = out.record.layers.map((layer) => {
        if (!Array.isArray(layer.tiles)) return layer;
        const wall = layer.tiles.find(([tx, ty]) => tx === 0 && ty === 0)?.[2];
        return { ...layer, tiles: layer.tiles.map((t) => (doorKeys.has(cellKey({ tx: t[0], ty: t[1] }))
            ? [t[0], t[1], wall, ...t.slice(3)] : t)) };
    });
    const cert = seedlingOracle({ model: out.model, items }).solve({ ...out.record, layers });
    return cert.verdict === VERDICT.SOLVED ? true : String(cert.verdict);
}

/**
 * ⛓ G2 — THE CELLS NO PLAYER SURVIVES STANDING ON: water and lava (lethal
 * without the conch / the dark suit — `lethalTerrainTiles`) and pits. They are
 * not SOLID, so the flood walks them; MEASURED on the box (seedling generated G2):
 * a walk through a pit cell respawned the player at the checkpoint, and G1's
 * `region_0_1` had door 1 AND its approach on water — an arrival there drowns and
 * respawns onto the same cell. So no door, approach or location stands on one,
 * and the seal flood treats them as walls.
 *
 * ⛓⛓ SWIM T1 — **BOOT-AWARE.** With `items` (the biome's boot inventory,
 * `GEN_ROOM_BIOMES[biome].items`) water is NOT a hazard when `items.canSwim` and
 * lava is not when `items.hasDarkSuit` — the planner's own arm
 * (`botDriverV2.js`, `lethalSafe`); pits always are. Without it a `post-swim`
 * room's `watergate` sealed its goal off on every draw (S1's residue: 83
 * re-rolls, grown 10×10 → 28×28; T1's W0 draw: 173, grown to 48×48). No other biome grants either, so every other
 * room reads the set it always read.
 *
 * ⛔ The boot-aware set is for the SEAL floods only (may the goal, a location, be
 * reached). A door, its approach and a location never STAND on a lethal cell:
 * those read the item-less set (`hazardCells(record)`), because an arrival lands
 * with whatever the player holds, not with the biome's boot.
 */
export function hazardCells(record, items = null) {
    const world = buildLevelWorld(record);
    const lethal = world.lethalTerrainTiles.filter((t) => !((t.t === WATER_TILE && items?.canSwim)
        || (t.t === LAVA_TILE && items?.hasDarkSuit)));
    return new Set([...lethal, ...world.pitTiles]
        .map((t) => cellKey({ tx: Math.floor(t.x / TILE_SIZE), ty: Math.floor(t.y / TILE_SIZE) })));
}

/** ⛓ SWIM T1 — the tile types `lethalTerrainTiles` carries (`levelWorld.js` WATER_STATE / LAVA_STATE). */
const WATER_TILE = 1;
const LAVA_TILE = 17;

/** The boot inventory of a room's biome (`generation.biome`), or null. */
const bootItems = (biome) => GEN_ROOM_BIOMES[biome]?.items ?? null;

/**
 * The cells reachable from the start with every door and every hazard (boot-aware,
 * SWIM T1) a wall — never a lethal cell itself (a location does not stand on one).
 */
function safeReach(world) {
    const { flood } = pickDoorCells(world.record, world.start, 0, { room: `'${world.region_id}'` });
    const lethal = hazardCells(world.record);
    const wall = hazardCells(world.record, bootItems(world.generation?.biome));
    for (const e of world.exits.values()) for (const [tx, ty] of e.exit_tiles ?? []) wall.add(cellKey({ tx, ty }));
    const seen = new Set([cellKey(world.start)]);
    const queue = [world.start];
    for (let i = 0; i < queue.length; i += 1) {
        for (const n of around(queue[i])) {
            if (seen.has(cellKey(n)) || wall.has(cellKey(n)) || !flood.has(cellKey(n))) continue;
            seen.add(cellKey(n));
            queue.push(n);
        }
    }
    for (const key of lethal) seen.delete(key);
    return seen;
}

/**
 * ⛓ strategy elements r2 — **THE KEY GATE'S CELLS A DOOR MAY NOT SEAL OR TAKE**: the cell BELOW each `bosslock`
 * (the stance its key line is walked from) and each `bosskey`'s cell. MEASURED (hook room, drawn seed 0.5): a
 * door on the stance's only approach left the doors-as-walls re-certification throwing in `keylock` ("the key line
 * was NEVER touched") instead of refusing. Read off the RECORD, so a room without a key gate gets `[]`.
 */
function keyGateCells(record) {
    return (record.entities ?? []).flatMap((e) => {
        const tx = Math.floor(e.x / TILE_SIZE);
        const ty = Math.floor(e.y / TILE_SIZE);
        if (e.type === 'bosslock') return [{ tx, ty: ty + 1 }];
        if (e.type === 'bosskey') return [{ tx, ty }];
        return [];
    });
}

/** The goal cell's neighbours: no door may stand there (the approach would be the check). */
function goalGuard(goalCell) {
    return new Set(around(goalCell).map(cellKey));
}

/**
 * ⛓ THE CORE'S DOORS for one draw (G2), `pickDoorCells`' doors or its
 * `LevelSetExitError`. ⛓ SWIM T1: the goal is kept reachable WITH the boot
 * `items` (a swimmer crosses the watergate); a door stays off every lethal cell
 * and its approach is reached from the start WITHOUT crossing one
 * (`hazardCells`' ⛔) — so an arrival lands on the start's side of the gate.
 */
export function pickGenRoomDoors(record, start, goalCell, doorCount, items, room = '?') {
    const lethal = hazardCells(record);
    const hazards = hazardCells(record, items);
    // ⛓ strategy elements r2 — a key gate's stance and key: never a door, always reachable (`[]` without one).
    const keyCells = keyGateCells(record);
    return pickDoorCells(record, start, doorCount, {
        room, exclude: new Set([...goalGuard(goalCell), ...lethal, ...keyCells.map(cellKey)]),
        keepReachable: { walls: hazards, approachWalls: lethal, cells: [goalCell, ...keyCells] },
    }).doors;
}

/**
 * ⛓ ONE DRAW of the room: the generator's record for attempt `k`'s seed, with
 * `doorCount` doors seated unsealed and the goal re-certified with them as walls.
 * `{seed, out, record, start, goalCell, doors}`, plus `err` when the draw cannot
 * seat them (then `doors` is absent). A generator refusal THROWS (no re-roll
 * rescues a bad knob).
 */
function drawRoom(regionId, drawn, k, size, knobs, doorCount) {
    const seed = rerollSeed(drawn, k);
    let out;
    try {
        out = generateSeedlingLevel(generatorInput(regionId, seed, size, knobs));
    } catch (e) {
        if (e.message.startsWith('generated Seedling room')) throw e;
        throw new Error(GEN_ROOM_REFUSALS.generator(regionId, seed, size, e.message));
    }
    const record = coreLevelRecord(out.record);
    /**
     * ⛓⛓ S1, D4 — A DIRECTIVE THIS DRAW DID NOT MEET IS A RE-ROLL, like a door
     * that would not seat: the room the preset asked for is one the differential
     * grades REQUIRED, and a draw that is not is not that room. ⛔ Marked
     * `requireUnmet` so the caller can bound it and name it (a directive that
     * can never be met must not spin through every size the room could grow to).
     */
    /** ⛔ A directive refused at RESOLUTION (an item no element needs, a biome
     *  that lacks it, …) is the KNOB's fault on every draw — refused at once,
     *  never re-rolled (`elementSpec.REQUIRE_DIRECTIVE_REFUSALS`). */
    if (out.require && REQUIRE_DIRECTIVE_REFUSALS.includes(out.require.refused?.reason)) {
        throw new Error(GEN_ROOM_REFUSALS.badKnob(regionId, 'require', knobs.require,
            `${out.require.refused.reason}: ${out.require.refused.detail}`));
    }
    if (out.require && out.require.met !== true) {
        const why = `${out.require.refused?.reason ?? 'not met'}`;
        const err = new Error(`seedlingGenRoom: room '${regionId}' seed ${seed}: require `
            + `[${knobs.require}] not met — ${why}`);
        err.requireUnmet = why;
        return { seed, out, record, err };
    }
    const start = { ...out.summary.startCell };
    const goalCell = { ...out.summary.goalCell };
    let doors;
    try {
        doors = pickGenRoomDoors(record, start, goalCell, doorCount, bootItems(knobs.biome), `'${regionId}'`);
    } catch (e) {
        if (e.name !== 'LevelSetExitError') throw e;
        return { seed, out, record, start, goalCell, err: e };
    }
    // ⛓ G2 (⚖ planner): the flood check ignores a goal past a solid the solver
    //   clears, so the GOAL is re-certified with the doors as WALLS — one solve.
    const unsealed = goalHoldsWithDoorsAsWalls(out, doors, bootItems(knobs.biome));
    if (unsealed !== true) {
        return { seed, out, record, start, goalCell, err: new Error(`levelSetExits: room '${regionId}' seats its `
            + `${doorCount} door(s), but with them as walls the generator's own solver no longer reaches the goal `
            + `(${unsealed})`) };
    }
    return { seed, out, record, start, goalCell, doors };
}

/**
 * `generation` after attempt `k` — `rerollCause` only when the room was re-rolled,
 * `grownFrom` (the size the pipeline asked for) only when it GREW (G8).
 */
const generationAfter = (knobs, k, cause, origin = null, size = null) => ({
    ...knobs, rerolls: k, ...(k > 0 ? { rerollCause: cause } : {}),
    ...(origin && size && (size.width !== origin.width || size.height !== origin.height)
        ? { grownFrom: { width: origin.width, height: origin.height } } : {}),
});

/** The size a room was ASKED for: its `grownFrom` when it grew, else its own. */
const originOf = (world) => world.generation?.grownFrom ?? world.size;

/**
 * `generateRegionCore` — the room: the generator's record for a seed drawn from
 * the engine's rng (Seedling refuses seed 0, so `|| 1`, as
 * `generateRegionZoneGen` derives one), one door per requested exit, no location
 * yet. `entrances`, the libraries and `biome` are accepted and IGNORED.
 */
export function generateGenRoom(input = {}) {
    const { region_id: regionId, exits = [], size = { width: 10, height: 10 }, rng, params, introduce } = input;
    if (!regionId) throw new Error(GEN_ROOM_REFUSALS.noRegionId());
    const drawn = ((rng.next() * 0x7fffffff) | 0) || 1;
    // ⛓ keygate colours — a REQUESTED room draws the asked-for gate (or none); an unrequested one is unchanged.
    const knobs = introduce ? requestedKnobs(regionId, knobsOf(params), introduce) : knobsOf(params);
    const askedKey = requestedKey(introduce);
    let draw; let rerolls = 0;
    // ⛓ G2 (⚖ planner): a room that cannot seat its doors UNSEALED is re-rolled —
    //   `rerollSeed(drawn, k)`, no engine rng consumed, so a room that seats on the
    //   first draw is byte-unchanged and no other region moves.
    // ⛓ G8: after the budget at a size, the room GROWS (`sizeOfAttempt`) and the
    //   same sequence runs on — still inside this one core call, never short.
    const last = lastAttempt(size);
    let cause = GEN_ROOM_REROLL_CAUSES.doors;
    for (let k = 0; k <= last; k += 1) {
        const at = sizeOfAttempt(size, k);
        draw = roomCanHold(at, exits.length) || !inContract(at)
            ? drawRoom(regionId, drawn, k, at, knobs, exits.length)
            : { seed: rerollSeed(drawn, k), record: at, err: cannotHold(regionId, at, exits.length) };
        if (!draw.err) { rerolls = k; break; }
        /** ⛓ S1, D4 — a `require` gets the per-size budget and no growth (a bigger
         *  room is not a likelier sword gate), then it is refused BY NAME. */
        cause = draw.err.requireUnmet ? GEN_ROOM_REROLL_CAUSES.require : GEN_ROOM_REROLL_CAUSES.doors;
        // ⛓ keygate colours — a REQUESTED key gate is not a sword gate: a bigger room IS a likelier one (the
        //   element needs a cut with a stance pocket below it), so it takes the WHOLE ladder, growth included,
        //   and is refused by its own name only after the last attempt (below).
        if (draw.err.requireUnmet && k >= GEN_ROOM_DOOR_REROLLS && !askedKey) {
            throw new Error(GEN_ROOM_REFUSALS.requireNotMet(regionId, draw.seed, draw.record, knobs.require,
                GEN_ROOM_DOOR_REROLLS, draw.err.requireUnmet));
        }
    }
    if (draw.err?.requireUnmet && askedKey) {
        throw new Error(GEN_ROOM_REFUSALS.keygateRequest(regionId, askedKey, draw.err.requireUnmet));
    }
    if (draw.err) {
        throw new Error(GEN_ROOM_REFUSALS.tooManyDoors(regionId, draw.seed, draw.record, exits.length, draw.err.message,
            grownRefusal(size, last)));
    }
    const { seed, out, record, start, goalCell, doors } = draw;
    if (askedKey && !(out.summary.bossKeys ?? []).some((k) => BOSS_KEY_ITEMS[k.keyType] === askedKey)) {
        throw new Error(GEN_ROOM_REFUSALS.keygateRequest(regionId, askedKey, 'the kept draw placed no key gate of that colour'));
    }
    const nextSide = sideAssigner(exits);
    const defaultExitId = (i) => (exits.length === 1 ? 'exit' : `exit_${i}`);
    const roomExits = new Map();
    exits.forEach((e, k) => {
        const exitId = e.exit_id ?? defaultExitId(k);
        if (roomExits.has(exitId)) throw new Error(GEN_ROOM_REFUSALS.duplicateExit(regionId, exitId));
        roomExits.set(exitId, {
            exit_id: exitId,
            ...doorFields(doors[k]),
            side: e.side ?? nextSide(),
            exitName: e.exitName ?? exitId,
            targetRegion: e.targetRegion ?? null,
            isBackExit: false,
            isTeleporter: false,
        });
    });
    return {
        world: {
            region_id: regionId,
            seed,
            size: { width: record.width, height: record.height },
            record,
            start,
            goalCell,
            // ⛓ `rerolls`: how many re-rolls it took (0 = the first draw) — `seed` is the one used.
            generation: generationAfter(knobs, rerolls, cause, size, record),
            // ⛓ G5: the drawn seed, so a later re-roll (a location the room cannot
            //   seat, an engine-added door) continues THIS room's sequence. Never serialized.
            drawnSeed: drawn,
            exits: roomExits,
            // ⛓ seedling-gen-chestdoor-ap — the door chests' rows, AFTER the draw (`[]` without one).
            locations: fixedRows(regionId, out.summary),
            summary: summaryOf(out),
            // ⛓ keygate colours — the pipeline's request, ONLY when there is one (never serialized).
            ...(introduce ? { introduce } : {}),
        },
        exits_placed: [...roomExits.values()].map(({ exit_id: exitId, side }) => ({ exit_id: exitId, side })),
    };
}

/** The cells a location may take, nearest the start first (flood order). */
function locationCells(world) {
    const { flood, taken } = pickDoorCells(world.record, world.start, 0, { room: `'${world.region_id}'` });
    const blocked = new Set(taken);
    for (const e of world.exits.values()) {
        for (const [tx, ty] of e.exit_tiles ?? []) {
            blocked.add(cellKey({ tx, ty }));
            for (const n of around({ tx, ty })) blocked.add(cellKey(n));
        }
    }
    for (const l of world.locations) blocked.add(cellKey(l.cell));
    // ⛓ G2: only cells the player reaches SAFELY — no hazard, no door crossed on the way.
    const safe = safeReach(world);
    return [...flood.values()].filter((c) => !blocked.has(cellKey(c)) && safe.has(cellKey(c)))
        .map((c) => ({ tx: c.tx, ty: c.ty }));
}

/** The record the tags are allocated against: the room without its goal pickup. */
function recordWithoutGoal(world) {
    const gx = world.goalCell.tx * TILE_SIZE;
    const gy = world.goalCell.ty * TILE_SIZE;
    return { ...world.record, entities: (world.record.entities ?? []).filter((e) => !(e.x === gx && e.y === gy)) };
}

/**
 * ⛓ G9 — the persistence tags a location may still take in this room: the
 * level's `TAGS_PER_LEVEL`, less every tag the room WITHOUT its goal pickup
 * uses (its own elements'), less the locations already seated. Location 0 takes
 * the goal's own tag, which is why the goal is left out.
 */
function freeTags(world) {
    const used = new Set(world.locations.map((l) => l.tag));
    for (const e of recordWithoutGoal(world).entities ?? []) {
        const t = tagOf(e.type, e.attrs);
        if (t >= 0) used.add(t);
    }
    return GEN_ROOM_LOCATION_CEILING - used.size;
}

/**
 * The cells `rows` would take — `short` when the room has too few cells, OR
 * (G9) too few free persistence tags: a draw whose own elements spend the tags
 * the rows need is re-rolled exactly like one without the floor for them.
 */
function seatsFor(world, rows) {
    // ⛓ location 0 is the GOAL — a door chest's row (seated by the draw itself) does not count.
    const free = seatedOf(world).length === 0 ? [world.goalCell] : [];
    free.push(...locationCells(world));
    const tags = freeTags(world);
    if (rows.length > tags) return { short: true, free, tags };
    return rows.length > free.length ? { short: true, free } : { free };
}

/** The sentence of a room that cannot seat `rows` beside what it holds — short of TAGS (G9) or of cells. */
function locationsRefusal(world, rows, seats, grown = null) {
    const want = world.locations.length + rows.length;
    if (seats.tags !== undefined) {
        return GEN_ROOM_REFUSALS.tooFewTags(world.region_id, want, world.locations.length + seats.tags,
            GEN_ROOM_LOCATION_CEILING, grown);
    }
    return GEN_ROOM_REFUSALS.tooManyLocations(world.region_id, want,
        [...world.locations.map((l) => l.cell), ...seats.free].map((c) => `(${c.tx},${c.ty})`), grown);
}

/** A placed location as the row it was placed from: its cell and tag are the room's, re-derived on a re-roll. */
const rowOf = ({ cell: _cell, tag: _tag, ...row }) => row;

/**
 * ⛓⛓ G5 — **THE ROOM RE-ROLLED, THE AP LOGIC KEPT** (⚖ planner 2026-09-26: one
 * function for both cases, one counter, one budget, no engine rng). The next
 * draws of THIS room's sequence (`rerollSeed(drawnSeed, k)`, k after the last
 * one used — growing past each spent budget, G8 — up to `lastAttempt`) until one seats a door for EVERY exit
 * in `entries` (the k-th exit the k-th door, re-certified with them all as walls)
 * AND every location in `rows` (the first on the goal cell). What moves: `seed`,
 * `record`, `start`, `goalCell`, the doors' cells and every location's cell and
 * tag. What never does: the exit keys, ids, AP names and rules, the location ids,
 * items, names and rules — so the rules the engine extracted from the room (no
 * cell in them) stay true. G8: the room's `size` moves when it grows, and
 * `generation.grownFrom` keeps the size it was asked for. `{room, bound}` (a NEW
 * world and its exits bound to doors, the argument untouched), or `{err, grown}`
 * after the last attempt (`grown`: the sizes tried, for the refusal).
 */
export function rerollGenRoom(world, entries, rows, cause) {
    const knobs = knobsOf({ seedlingGen: world.generation });
    // ⛓ seedling-gen-chestdoor-ap — the door chests the room already declared: a re-roll must keep as many
    //   (their location ids are the AP logic's, which a re-roll never moves). Their rows are re-derived from
    //   the new draw, never seated.
    const chests = world.locations.filter(isChestDoor).length;
    // ⛓ B1 — and as many loot chests, by the same law.
    const loots = world.locations.filter(isLootChest).length;
    // ⛓ strategy elements r2 — and as many key spots, by the same law.
    const keys = world.locations.filter(isBossKey).length;
    rows = rows.filter((r) => !isFixedRow(r));
    const origin = originOf(world);
    const last = lastAttempt(origin);
    let err = null;
    for (let k = (world.generation?.rerolls ?? 0) + 1; k <= last; k += 1) {
        const at = sizeOfAttempt(origin, k);
        if (inContract(at) && !roomCanHold(at, entries.length + rows.length)) {
            err = cannotHold(world.region_id, at, entries.length + rows.length);
            continue;
        }
        const draw = drawRoom(world.region_id, world.drawnSeed, k, at, knobs, entries.length);
        if (draw.err) { err = draw.err; continue; }
        if ((draw.out.summary.chestDoors?.length ?? 0) !== chests) {
            err = new Error(`levelSetExits: room '${world.region_id}' seed ${draw.seed} holds `
                + `${draw.out.summary.chestDoors?.length ?? 0} door chest(s), and the room declared ${chests}`);
            continue;
        }
        if ((draw.out.summary.lootChests?.length ?? 0) !== loots) {
            err = new Error(`levelSetExits: room '${world.region_id}' seed ${draw.seed} holds `
                + `${draw.out.summary.lootChests?.length ?? 0} loot chest(s), and the room declared ${loots}`);
            continue;
        }
        if ((draw.out.summary.bossKeys?.length ?? 0) !== keys) {
            err = new Error(`levelSetExits: room '${world.region_id}' seed ${draw.seed} holds `
                + `${draw.out.summary.bossKeys?.length ?? 0} key spot(s), and the room declared ${keys}`);
            continue;
        }
        const bound = entries.map(([key, e], i) => [key, { ...e, ...doorFields(draw.doors[i]) }]);
        const size = { width: draw.record.width, height: draw.record.height };
        const room = {
            ...world,
            seed: draw.seed,
            size,
            record: draw.record,
            start: draw.start,
            goalCell: draw.goalCell,
            generation: generationAfter(knobs, k, cause, origin, size),
            exits: new Map(bound),
            locations: introducedFixedRows(world, world.region_id, draw.out.summary),
            summary: summaryOf(draw.out),
        };
        const seats = seatsFor(room, rows);
        if (seats.short) { err = new Error(locationsRefusal(room, rows, seats)); continue; }
        seatRows(room, rows, seats.free);
        return { room, bound };
    }
    return { grown: grownRefusal(origin, last), err: err ?? new Error(`levelSetExits: room '${world.region_id}' has `
        + `no re-roll left (${last} used)`) };
}

/**
 * Put `ids` (with their items and rules) into the room: the first on the goal
 * cell (if the room holds none yet), the rest on free flood cells nearest the
 * start. ⛓ G5: a room with too few cells is RE-ROLLED in place (`rerollGenRoom` —
 * the engine's world object keeps its identity and its exit records theirs),
 * and refused by name when no draw seats them at any size up to the cap (G8) —
 * never returned short, so the engine's own retry-then-grow loop is never entered.
 */
function addLocations(world, rows) {
    // ⛓ G9 — past the level's tag budget no draw at any size seats them: refused by
    //   name at once, never re-rolled or grown (the entry's declared ceiling).
    const want = world.locations.length + rows.length;
    if (want > GEN_ROOM_LOCATION_CEILING) {
        throw new Error(GEN_ROOM_REFUSALS.tagBudget(world.region_id ?? '?', want, GEN_ROOM_LOCATION_CEILING));
    }
    const seats = seatsFor(world, rows);
    if (!seats.short) { seatRows(world, rows, seats.free); return; }
    if (!Number.isInteger(world.drawnSeed)) throw new Error(locationsRefusal(world, rows, seats));
    const all = [...seatedOf(world).map(rowOf), ...rows];
    const { room, bound, err, grown } = rerollGenRoom(world, [...world.exits.entries()], all,
        GEN_ROOM_REROLL_CAUSES.locations);
    if (err) throw new Error(locationsRefusal(world, rows, seats, grown));
    // ⛓ G8: `size` too — a room that grew is the engine's world at its new size.
    for (const key of ['seed', 'size', 'record', 'start', 'goalCell', 'generation', 'summary']) world[key] = room[key];
    for (const [key, e] of bound) {
        const record = world.exits.get(key);
        for (const field of DOOR_FIELDS) record[field] = e[field];
    }
    world.locations = room.locations;
}

/**
 * Seat `rows` on `free` (in order), each with a fresh tag. ⛓ seedling-gen-chestdoor-ap: the door chests'
 * rows stay LAST, so location 0 is still the goal's and the seated rows keep their order.
 */
function seatRows(world, rows, free) {
    const bare = recordWithoutGoal(world);
    const reserved = world.locations.map((l) => l.tag);
    const seated = seatedOf(world);
    rows.forEach((row, k) => {
        const tag = placementTagId(bare, reserved);
        reserved.push(tag);
        seated.push({ ...row, cell: { ...free[k] }, tag });
    });
    world.locations = [...seated, ...world.locations.filter(isFixedRow)];
}

/**
 * `placeFromItems` — the spiral / grid-growth placer: each item becomes a
 * location holding it, named the maze's way (`<item>_pickup`, then `_2`, `_3`…).
 * ⚠ A room places NO obstacle — a maze key/door pair has no geometry here — so
 * every `obstacles_to_place` entry is reported unplaced by omission (the text
 * adventure's law; the caller's pool keeps it).
 */
export function placeGenItems(world, input = {}) {
    const { items_to_place: items = [] } = input;
    const taken = new Set(world.locations.map((l) => l.id));
    const rows = [];
    const placed = [];
    for (const itemId of items) {
        let id = `${itemId}_pickup`;
        for (let n = 2; taken.has(id); n++) id = `${itemId}_pickup_${n}`;
        taken.add(id);
        rows.push({ id, item: itemId });
        placed.push({ item_id: itemId, location_id: id });
    }
    addLocations(world, rows);
    return { placed_items: placed, placed_obstacles: [] };
}

/**
 * `placeFromRules` — the sphere / top-down placer: every exit rule is RECORDED
 * on its exit (`True_` as absent), and every location — ruled first, then
 * item-only, the maze's order — is placed with its item and rule. No location
 * reports a tile position, so the engine matches them by id; a room that cannot
 * hold them all REFUSES (it never skips one, so the engine's retry loop never
 * re-rolls it).
 */
export function placeGenRules(world, input = {}) {
    const { exit_rules: exitRules = {}, location_rules: locationRules = {}, item_placements: placements = [] } = input;
    for (const [exitId, rule] of Object.entries(exitRules)) {
        const exit = world.exits.get(exitId);
        if (!exit) throw new Error(GEN_ROOM_REFUSALS.unknownExit(world.region_id ?? '?', exitId));
        if (isTrueRule(rule)) delete exit.access_rule;
        else exit.access_rule = cloneRule(rule);
    }
    const itemByLocation = Object.fromEntries(placements.map((p) => [p.location_id, p.item_id]));
    let order = [...new Set([...Object.keys(locationRules), ...placements.map((p) => p.location_id)])];
    // ⛓⛓ keygate colours — A REQUESTED KEY (`world.introduce`): the spec location holding the key IS the draw's key
    //   spot (it takes that row's cell and tag, under the spec's id), and the location(s) ruled behind the key are
    //   seated FIRST, so location 0 (the goal cell, behind the lock) is one of them.
    const askedKey = requestedKey(world.introduce);
    const introduced = [];
    if (askedKey) {
        const keyId = order.find((id) => itemByLocation[id] === askedKey);
        const spot = world.locations.find((l) => isBossKey(l) && l.item === askedKey);
        if (keyId === undefined || !spot) {
            throw new Error(GEN_ROOM_REFUSALS.keygateRequest(world.region_id ?? '?', askedKey,
                keyId === undefined ? 'no spec location holds the key' : 'the room holds no key spot of that colour'));
        }
        spot.id = keyId;
        world.introducedIds = { [askedKey]: keyId };
        introduced.push({ id: keyId, item: askedKey });
        const behind = (id) => ruleHas(locationRules[id], askedKey);
        order = [...order.filter((id) => id !== keyId && behind(id)), ...order.filter((id) => id !== keyId && !behind(id))];
    }
    const rows = order.map((id) => {
        const rule = locationRules[id];
        return {
            id,
            ...(itemByLocation[id] != null ? { item: itemByLocation[id] } : {}),
            ...(rule && !isTrueRule(rule) ? { access_rule: cloneRule(rule) } : {}),
        };
    });
    addLocations(world, rows);
    const all = [...introduced, ...rows];
    return {
        placed_logic_gates: [],
        placed_items: all.filter((r) => r.item != null).map((r) => ({ item_id: r.item, location_id: r.id })),
        placed_locations: all.map((r) => ({ location_id: r.id })),
    };
}

/**
 * `extractPathsAndObstacles` — the room's rules, straight off the room: each
 * exit (by its MAP KEY, the AP name) and location with its recorded rule,
 * `True_` where none. A location that carries its AP `name` hands it on as
 * `global_name`, so a rebuild compiles the document's own name.
 */
export function extractGenRules(world, opts = {}) {
    const entries = world.exits instanceof Map ? [...world.exits.entries()]
        : (world.exits ?? []).map((e) => [e.exitName ?? e.exit_id, e]);
    return {
        region_id: opts.regionId ?? world.region_id ?? 'seedling_gen_room',
        exits: entries.map(([key, e]) => ({
            id: key,
            target_region: e.targetRegion ?? null,
            access_rule: cloneRule(e.access_rule ?? TRUE_RULE),
        })),
        // ⛓ procgen-region-authored-rules — the key requirement is the room's OWN rule, MARKED so a driver that
        //   replaces the extracted rule with its spec's (sphere growth, top-down) ANDs it on instead.
        locations: world.locations.map((l) => markAuthoredRule({
            id: l.id,
            item: l.item ?? null,
            // ⛓ strategy elements r2 — the lock as a rule: the goal cell requires the room's key item.
            access_rule: cloneRule(withKeyRule(world, l, l.access_rule ?? TRUE_RULE)),
            ...(l.name ? { global_name: l.name } : {}),
        }, keyRuleOf(world, l))),
    };
}

/**
 * Bind a door to every exit that has none (an exit the engine added after the
 * core ran), in exit order, clear of the doors already bound and their
 * neighbours, of the goal's neighbours, and of every location cell and its
 * neighbours. Returns `{bound}` — `[key, record-with-door]` pairs — or
 * `{unseated, err}` when the room as built has no unsealing cell for them; the
 * world is untouched.
 */
function bindAllDoors(world, entries) {
    const unbound = entries.filter(([, e]) => !Array.isArray(e.exit_tiles));
    if (unbound.length === 0) return { bound: entries };
    const exclude = goalGuard(world.goalCell);
    const guard = (c) => { exclude.add(cellKey(c)); for (const n of around(c)) exclude.add(cellKey(n)); };
    for (const [, e] of entries) for (const [tx, ty] of e.exit_tiles ?? []) guard({ tx, ty });
    for (const l of world.locations) guard(l.cell);
    // ⛓ G2: the doors already bound are WALLS, and their approaches, the goal and
    //   every location stay reachable from the start (`keepReachable`).
    const bound = entries.filter(([, e]) => Array.isArray(e.exit_tiles));
    // ⛓ SWIM T1: as `drawRoom` — boot-aware seal walls, item-less cells to stand on.
    const lethal = hazardCells(world.record);
    const hazards = hazardCells(world.record, bootItems(world.generation?.biome));
    for (const h of lethal) exclude.add(h);
    const doorWalls = bound.flatMap(([, e]) => e.exit_tiles.map(([tx, ty]) => cellKey({ tx, ty })));
    const walls = new Set([...hazards, ...doorWalls]);
    const keepReachable = {
        walls,
        approachWalls: new Set([...lethal, ...doorWalls]),
        // ⛓ a door chest's cell is SOLID (the chest): it is never a cell to keep reachable.
        //   ⛓ B1 — a loot chest's is solid too, and its STANCE (the cell below) is what must stay reachable.
        cells: [world.goalCell, ...seatedOf(world).map((l) => l.cell),
            ...world.locations.filter(isLootChest).map((l) => ({ tx: l.cell.tx, ty: l.cell.ty + 1 })),
            // ⛓ strategy elements r2 — a key gate's stance and key (`[]` without one).
            ...keyGateCells(world.record),
            ...bound.map(([, e]) => ({ tx: e.entrance_spawn.x / TILE_SIZE, ty: e.entrance_spawn.y / TILE_SIZE }))],
    };
    const pick = (ex) => pickDoorCells(world.record, world.start, unbound.length, {
        room: `'${world.region_id ?? '?'}'`, exclude: ex, keepReachable,
    });
    /**
     * ⛓ G2: first in the room AS BUILT (its locations placed). When the neighbour
     * guards leave no unsealing cell, the second try keeps only the cells
     * themselves (goal, locations, doors): `keepReachable` already rejects a door
     * whose approach is a door or that seals one, which is what the guards were
     * for. Neither → `null` and the reason: the caller re-rolls the room (G5).
     */
    let doors;
    try {
        ({ doors } = pick(exclude));
    } catch (first) {
        if (first.name !== 'LevelSetExitError') throw first;
        try {
            ({ doors } = pick(new Set([cellKey(world.goalCell), ...world.locations.map((l) => cellKey(l.cell)), ...walls, ...lethal])));
        } catch (e) {
            if (e.name !== 'LevelSetExitError') throw e;
            return { unseated: unbound.length, err: e };
        }
    }
    const fresh = new Map(unbound.map(([key], k) => [key, doors[k]]));
    return { bound: entries.map(([key, e]) => (fresh.has(key) ? [key, { ...e, ...doorFields(fresh.get(key)) }] : [key, e])) };
}

/**
 * ⛓⛓ G5 case 1 — **AN ENGINE-ADDED DOOR THE ROOM CANNOT SEAT RE-ROLLS THE ROOM**
 * (⚖ planner 2026-09-26, design (i): measured at W0, grid growth adds 0–2 such
 * doors per room and walls off core exits, so no reserved count is right). The
 * room as built first (`bindAllDoors` — every world that seats there is
 * byte-unchanged); else `rerollGenRoom` over the FINAL exit list, every door
 * re-seated and every location re-placed. A world with no drawn seed (a
 * deserialized payload) cannot re-roll and refuses as before.
 */
function bindOrReroll(world, entries) {
    const first = bindAllDoors(world, entries);
    if (first.bound) return { room: world, bound: first.bound };
    const refuse = (grown, err) => new Error(GEN_ROOM_REFUSALS.engineDoors(world.region_id ?? '?', world.seed,
        world.size, entries.length, first.unseated, grown, err.message));
    if (!Number.isInteger(world.drawnSeed)) {
        throw new Error(GEN_ROOM_REFUSALS.tooManyDoors(world.region_id ?? '?', world.seed, world.size,
            entries.length, first.err.message));
    }
    const rows = seatedOf(world).map(rowOf);
    const bare = entries.map(([key, e]) => [key, Object.fromEntries(Object.entries(e)
        .filter(([field]) => !DOOR_FIELDS.includes(field)))]);
    const again = rerollGenRoom(world, bare, rows, GEN_ROOM_REROLL_CAUSES.engineDoors);
    if (again.err) throw refuse(again.grown, again.err);
    return again;
}

/**
 * `serializeWorld` — the room → its sidecar payload. The engine's exits (core
 * and engine-added, Map order) joined onto their doors: the payload's `exit_id`
 * is the DOOR, `exitName` the AP name, `external: true` with `target_level` /
 * `target_spawn` null (the far side is the world's, resolved at assembly) and
 * `target_substrate` from the 5th argument. `level` is the region's ordinal
 * among this substrate's regions (`context.ordinalOfRegion`), else the world's
 * own (a deserialized room), else null. A clone: nothing of the world is shared.
 */
export function serializeGenRoom(world, extractedRules, _obstacleLib, _itemLib, context) {
    const extractedExits = new Map((extractedRules?.exits ?? []).map((e) => [e.id, e]));
    const extractedLocations = new Map((extractedRules?.locations ?? []).map((l) => [l.id, l]));
    const entries = world.exits instanceof Map ? [...world.exits.entries()]
        : (world.exits ?? []).map((e) => [e.exitName ?? e.exit_id, e]);
    const exits = [];
    const exitGates = {};
    // ⛓ G5: `room` is the world, or its re-roll when an engine-added door could not be seated.
    const { room, bound } = bindOrReroll(world, entries);
    for (const [key, e] of bound) {
        const ext = extractedExits.get(key);
        exits.push({
            exit_id: e.door_id ?? e.exit_id,
            kind: e.kind,
            side: e.side ?? null,
            exit_tiles: structuredClone(e.exit_tiles),
            entrance_tile: [...e.entrance_tile],
            entrance_spawn: { ...e.entrance_spawn },
            exitName: key,
            targetRegion: ext?.target_region ?? e.targetRegion ?? null,
            targetExitId: e.targetExitId ?? null,
            isTeleporter: !!e.isTeleporter,
            external: true,
            target_level: null,
            target_spawn: null,
            target_substrate: context?.substrateOfRegion?.(ext?.target_region ?? e.targetRegion)
                ?? e.target_substrate ?? null,
        });
        if (e.access_rule && !isTrueRule(e.access_rule)) exitGates[key] = cloneRule(e.access_rule);
    }
    const locations = room.locations.map((l) => {
        const ext = extractedLocations.get(l.id);
        const name = ext?.global_name ?? l.name
            ?? (extractedRules?.region_id ? makeLocationName(extractedRules.region_id, l.id, null) : l.id);
        return {
            name,
            ...(l.item != null ? { item: l.item } : {}),
            // ⛓ seedling-gen-chestdoor-ap — ONLY on a door chest's row, so no other payload moves.
            ...(isFixedRow(l) ? { kind: l.kind } : {}),
            cell: { ...l.cell },
            tag: l.tag,
            ...(() => {
                // ⛓ strategy elements r2 — the goal cell's key requirement rides the payload's rule too.
                const rule = withKeyRule(room, l, l.access_rule ?? null);
                return rule && !isTrueRule(rule) ? { access_rule: cloneRule(rule) } : {};
            })(),
        };
    });
    const ordinal = context?.ordinalOfRegion?.(world.region_id);
    // ⛓ strategy elements r2 — ⚖ "B: Distinct colour per room", until the pipeline allocates colours: a key gate
    //   past generated room #0 is REFUSED BY NAME (`keygate-colour-not-allocated`), never shipped in a colour
    //   another room may also hold. Conservative: a world whose room #0 placed none is refused too (named limit).
    // ⛓ keygate colours — LIFTED for a REQUESTED key: the planner gave this room a colour no other room holds.
    if (room.locations.some(isBossKey) && !requestedKey(room.introduce) && Number.isInteger(ordinal) && ordinal > 0) {
        throw new Error(GEN_ROOM_REFUSALS.keygateColour(world.region_id, ordinal));
    }
    // ⛓ strategy elements r2 — the lock as a rule MUST reach the world: every location behind the lock carries
    //   `Has(<key item>)` in its FINAL rule (the one the engine compiles), else refused by name.
    for (const l of room.locations) {
        const need = keyRuleOf(room, l);
        const final = extractedLocations.get(l.id)?.access_rule;
        if (need && !ruleHas(final, need.args.item_name)) {
            throw new Error(GEN_ROOM_REFUSALS.keygateRule(world.region_id,
                extractedLocations.get(l.id)?.global_name ?? l.name ?? l.id, need.args.item_name));
        }
    }
    return {
        gameId: 'seedling',
        generated: true,
        seed: room.seed,
        size: { ...room.size },
        // ⛓ seedling-gen-biomes-1 (C1) — the look is painted HERE, on the finished room, and nowhere
        //   earlier: every door, location and re-roll above read the generator's own terrain names.
        record: structuredClone(applyLook(room.record, room.generation?.look)),
        start: { ...room.start },
        goal_cell: { ...room.goalCell },
        generation: { ...room.generation },
        locations,
        level: Number.isInteger(ordinal) ? ordinal : (Number.isInteger(world.level) ? world.level : null),
        tile_size: GEN_ROOM_TILE_SIZE,
        exits,
        exitGates,
    };
}
