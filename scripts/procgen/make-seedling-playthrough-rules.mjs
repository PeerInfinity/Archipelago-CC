#!/usr/bin/env node
/**
 * RULES v1 — the honest playthrough's Archipelago logic, GENERATED
 * (R7 kickoff §3.5, §4 slice 4; the firewall ruling §6.3).
 *
 * One region per level for all 116 levels, sub-regions where the terrain
 * splits, access rules read off the game's own tables, vanilla placement of
 * every collectible in the §2.2 census — compiled through the EXISTING atlas
 * pipeline into a rules.json that `world_generator` and `Generate.py` turn into
 * a sphere log. **The sphere log is the deliverable**: it is AP's own answer to
 * "what order can this game be collected in", and the segments follow it.
 *
 * THREE LAYERS, and each is somebody else's work reused:
 *
 *   1. TERRAIN — `flashPanel/seedlingSemantics.js`'s transcription of the
 *      game's collision rules + `procgenPipeline/regionAtlasAnalyzer.js`'s
 *      component/crossing analysis. Already built for the 4-region starter
 *      atlas; this scales it to 116 levels unchanged.
 *   2. ITEM-GATED ENTITIES — `flashPanel/seedlingPlaythroughOverlay.js`, which
 *      rules on every family the transcription refuses, with a source citation
 *      per row and the ruled PUZZLE POLICY as its spine.
 *   3. BOSSES, PIXEL MASKS AND CHOREOGRAPHY — the overlay again for the boss
 *      bodies, plus the PHYSICS MODEL's own pixel masks
 *      (`seedlingDemo/levelWorld.js` + `seedlingPixelMasks.js`) for the
 *      building outlines (the grid's `pixelMaskFootprints`, and the model
 *      oracles on the tiles a mask covers in part). ⛓ That import is the
 *      firewall's ALLOWED direction (§6.3): the generator reads the model, the
 *      model reads nothing back, and the artifact is one-way.
 *
 * NO `procgen_metadata` (§8.3). Vanilla placement travels on `location.item`
 * + `--canonical-seed 1`. The original ⛔ reason — emitting `procgen_metadata`
 * moved every placement into `LOCKED_PLACEMENTS`, always-locked for EVERY seed
 * — is retired (topdown-locked-items R1: `procgen_metadata` no longer changes
 * placement; only a location's `pinned` does). Whether to emit it here now is a
 * separate decision; until then the output stays as it is.
 *
 * Deterministic — no clock, no Math.random — so `--check` is an exact
 * regeneration gate, the shape every other generator in this tree uses.
 *
 * Usage:
 *   node scripts/procgen/make-seedling-playthrough-rules.mjs [--check] [--quiet]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';


import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));

const ATLAS_DIR = path.join(repoRoot, 'frontend/modules/flashPanel/atlases');
const MAP_FILE = path.join(ATLAS_DIR, 'seedling-map.json');
const ATLAS_OUT = path.join(ATLAS_DIR, 'seedling-playthrough.json');
const PRESET_OUT = path.join(repoRoot,
    'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const GAME_NAME = 'Seedling Playthrough';

const { AtlasSession } = await imp('frontend/modules/regionMarkingTool/atlasSession.js');
const { validateRegionAtlas, derivedRulesSource } = await imp('frontend/modules/procgenPipeline/regionAtlasValidator.js');
const { compactJsonFile } = await imp('frontend/modules/procgenPipeline/compactJson.js');
const { analyzeRegion, applyRegionAnalysis, simplifyRule, findComponents, componentForTile } = await imp('frontend/modules/procgenPipeline/regionAtlasAnalyzer.js');
const { compileRegionAtlas } = await imp('frontend/modules/procgenPipeline/regionAtlasCompiler.js');
const { stringifyRulesJson } = await imp('frontend/modules/shared/rulesJsonBuilder.js');
const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
const { substrateRegistryEntry: SEEDLING_ENTRY } = await imp('frontend/modules/flashPanel/flashSeedlingLibrary.js');
const OV = await imp('frontend/modules/flashPanel/seedlingPlaythroughOverlay.js');
const { R7_GOAL_LEDGER } = await imp('frontend/modules/seedlingDemo/r7Acceptance.js');
// ⛓ EDITOR v3 slice D0b — the derivation LIFTED out of this script (plan §16.3):
//   the atlas's regions, exits and connections are a FUNCTION of the rooms, and
//   only the OVERLAY below is authored. The vanilla 116 and an edited level set
//   now go through ONE `deriveAtlas`.
const {
    deriveAtlas, regionIdFor, outExitId, inExitId, LINK_TAGS, VICTORY_ITEM, levelName, BOSS_LOCATION_ITEM, BOSS_FILLER_ITEM,
} = await imp('frontend/modules/seedlingDemo/seedlingAtlasDerivation.js');
const { buildLevelWorld, ROLES, PERSISTENCE_RESPONSE, combatCensusOf, rectsOverlap } = await imp('frontend/modules/seedlingDemo/levelWorld.js');
const { censusFallsOntoDoors } = await imp('frontend/modules/seedlingDemo/fidelityDescent.js');
const { seedlingModelOracles, modelFloodTiles, refuseUnboundMembers, seedlingArrivalSpawn } = await imp('frontend/modules/seedlingDemo/seedlingModelOracles.js');
const { returnSpawnTable, returnKey } = await imp('frontend/modules/flashPanel/seedlingReturnSpawns.js');
const { lethalTerrainUnder, arrivalIsLethal } = await imp('frontend/modules/seedlingDemo/seedlingLethalArrivals.js');

const { patchedMapDocument, SEEDLING_SET_PATCHES } = await imp('frontend/modules/seedlingDemo/seedlingSetPatches.js');
const { arrivalSolidCensus, gameLandings } = await imp('frontend/modules/seedlingDemo/fidelityArrival.js');
const { levelSourceFromAtlas } = await imp('frontend/modules/seedlingDemo/atlasSource.js');
const {
    deriveObstacleEvents, deriveLockEvents, deriveButtonEvents, crossRoomButtonsOf, persistenceEffect, obstacleEventName, parseSolidId,
    deriveTalkEvents, crossRoomPrerequisitesOf,
    poleKillsOf, POLE_LIGHT_ARM, POLE_GHOST_ARM, poleThrustStances, poleSwingStances, inRoomPolesOf, deriveInRoomPoleEvents,
    ropesOf, ropeVerdict, deriveRopeEvents, ropeEventCondition, ropeEventName, ropeLaneCharges,
} = await imp('frontend/modules/flashPanel/seedlingObstacleEvents.js');
const { arrowLane, arrowTrapEntityPoint } = await imp('frontend/modules/seedlingDemo/arrowTrap.js');
const { contactRect } = await imp('frontend/modules/seedlingDemo/combat.js');
const { spearHitRect, pressRectTouches } = await imp('frontend/modules/seedlingDemo/presses.js');
const { swingHits } = await imp('frontend/modules/seedlingDemo/combatVerbs.js');
const { DARKTRAP_LIGHT_DEATH } = await imp('frontend/modules/seedlingDemo/enemyDamage.js');
const { FLAG_ACTIONS } = await imp('frontend/modules/seedlingDemo/arrivalSolid.js');
const { apRegionName } = await imp('frontend/modules/procgenPipeline/regionAtlasValidator.js');
const { pitChainsFromCensus } = await import('./seedlingPitChains.js');
const { PUSHABLE_KINDS, blockCrossingCost } = await imp('frontend/modules/flashPanel/seedlingBlockPaths.js');
const { deriveWeaponFootprint } = await imp('frontend/modules/flashPanel/seedlingWeaponFootprints.js');

/**
 * ⛓⛓ RULES patched-set — **THE PLAYTHROUGH READS THE DELIVERED SET.** `seedling_playthrough` is the one
 * game that RECEIVES a delivery (`levelSetExporter.vanillaRecordSet` applies `SEEDLING_SET_PATCHES`), so its
 * rules derive from the same patched rooms the player is handed — ⚖ the user (2026-10-05): the moonrock
 * event is removed, L110's fall is NOT repointed. The extract on disk stays faithful; the starter atlas and
 * the atlas arms keep reading it VANILLA (they run the built-in map, Moonrock included).
 */
export const VANILLA_MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const MAP = patchedMapDocument(VANILLA_MAP);
/** The map document this generator derives from — the DELIVERED (patched) set. */
export const PLAYTHROUGH_MAP = MAP;
const GAME_CONFIG = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const TILE = MAP.tile_size;
const LEVELS = [...MAP.levels].sort((a, b) => a.level - b.level);
const levelOf = (id) => LEVELS.find((l) => l.level === id);

const notes = [];
const note = (s) => notes.push(s);

// ── layer 3a: the pixel-mask outlines — see ⛔ THE MASK EXPANSION below ─────
//
// ⛓ PIXELMASK FOOTPRINTS (session tile-primitives-pixelmask-l86): the grid takes a
// Building's outline from its Pixelmask (`seedlingSemantics.buildSeedlingRegionGrid`'s
// `pixelMaskFootprints`, passed in `baseGridFor`), tile by tile.

// ── the analyzer's options, with the overlay's vocabulary folded in ─────────

const baseOptions = (await imp('frontend/modules/flashPanel/seedlingAtlasAnalysis.js'))
    .seedlingAnalyzerOptions(GAME_CONFIG);

// ⛔ THE OVERLAY HAS TO BE TRIED AT EVERY LEVEL OF A COMPOSITE, not only at the
// top. `seedlingSemantics.resolveCondition` recurses into `all`/`any` with the
// FLAG table alone, so an overlay-only leaf (`hasTotemPartsAll`) inside an
// `allOf(...)` resolves to null and the whole rule disappears — silently, in the
// permissive direction. This resolver interleaves the two.
const resolveFull = (c) => {
    if (c == null) return null;
    const own = OV.resolveOverlayCondition(c);
    if (own) return own;
    for (const [op, ruleName] of [['any', 'Or'], ['all', 'And']]) {
        if (!Array.isArray(c[op])) continue;
        const children = [];
        const seen = new Set();
        for (const part of c[op]) {
            const resolved = resolveFull(part);
            if (!resolved) return null;
            const flat = resolved.rule === ruleName && Array.isArray(resolved.children)
                ? resolved.children : [resolved];
            for (const child of flat) {
                const k = JSON.stringify(child);
                if (seen.has(k)) continue;
                seen.add(k);
                children.push(child);
            }
        }
        if (children.length === 0) return null;
        return children.length === 1 ? children[0] : { rule: ruleName, children };
    }
    return baseOptions.resolveCondition(c);
};

const analyzerOptions = {
    conditionKey: (c) => (c?.seals !== undefined ? `seals:${c.seals}` : SEM.conditionKey(c)),
    resolveCondition: resolveFull,
};

const CROSS_LEVEL_OPENERS = OV.buildCrossLevelOpeners(MAP);
const GROUP_OPENERS = OV.buildGroupOpeners(MAP);
// ⛓ RULES l112-owl-rocklock — the group openers that are scripts, not buttons (`OV.SCRIPT_GROUP_OPENERS`): a grouped
// lock whose level holds no in-level opener is priced by one of these or throws.
const SCRIPT_OPENERS = OV.buildScriptOpeners(MAP);
/** ⛓ RULES kill-locks — every kill-lock room's census and ruling (`OV.killLockRoomRuling`). */
const KILL_LOCKS = OV.buildKillLockRulings(MAP);
// ⛓ RULES block-path — who can hold each re-closing lock's button (the room's pushables; ⚖ enemies don't
// count). The grid builder prices an entry by the block paths where `seedlingBlockPaths.blockHolderVerdict`
// decides it.
const BLOCK_HOLDERS = OV.buildBlockHolders(MAP);
/** ⛓ RULES kill-locks — the census, for a reader that reports it. Additive. */
export const playthroughKillLocks = KILL_LOCKS;
const entityOverride = (entity, base, level) => {
    return OV.overlayEntitySemantics(entity, base, {
        level: level.level, crossLevelOpeners: CROSS_LEVEL_OPENERS, groupOpeners: GROUP_OPENERS, scriptOpeners: SCRIPT_OPENERS, killLocks: KILL_LOCKS, blockHolders: BLOCK_HOLDERS,
    });
};

// ⛔⛔⛔ THE MASK EXPANSION WAS OFF BY DEFAULT, AND THAT WAS A MEASUREMENT (kept as history; the expansion is RETIRED).
//
// Layer 3 originally ran `expandPixelMasks` on every level: ask the physics
// model for a building's real per-pixel outline and hand the analyzer exact
// 1x1 walls instead of the transcription's sprite rect. More accurate, and
// **strictly worse**, because tile-granular masking can only ever ADD walls —
// a tile whose CENTRE is inside the mask becomes solid even when its walkable
// part is at the edge, and a chain of those seals a path.
//
// It sealed the first one. With masks on, L0's Owl's Nest stairs — the way to
// Dungeon 1 and the sword — landed in a different component from the player's
// own start, and AP's fixpoint stalled at 13 regions with every exit out of
// the start needing an item it could not yet have. With masks off:
//
//     13 -> 178 of 266 AP regions, 3 -> 30 of 41 locations, and the SEED
//
// ⛓ `seedlingSemantics`' own comment predicted this in advance and was not
// read carefully enough: *"Everything walks THROUGH it in the flood, so a
// house standing in open ground costs nothing, and a building that is
// genuinely the only way between two areas becomes a hand-authoring row
// instead of an invented wall."* A permissive refusal that produces a
// hand-authoring row beats an accurate wall that produces a sealed map.
//
// ⛓ PIXELMASK FOOTPRINTS (session tile-primitives-pixelmask-l86, ⚖ 2026-10-25 "3-way by coverage", "Retire
// --masks") replaced it. The coarsening was the PLAYER BOX at each tile's centre, which walls a tile whose edge is
// walkable. The grid now claims only what is certain — a tile wholly inside the mask is a wall, a tile with no
// mask pixel is not claimed — and leaves a tile the mask covers in PART `manual`, exactly as before, so the
// physics model still decides every crossing through one. That removed every one of L0's 23 building cells
// (16 wall, the rest free — among them (10,18), where L86 lands the player) and moved no location's sphere.
// `expandPixelMasks` and `--masks` are gone.
// ⛓ SWIM T4 (plan R-j) — THE ONE-SIDED LOCKS. `bosslock`'s `probe: 'S'`
// (BossLock.as:62 tests the key only against a player on the row BELOW the
// lock) is read as `enter` gates, so each lock crosses one way, south -> north.
// REFUTATION_LOG entry 3 is the row this retires.
// ON BY DEFAULT, because it was measured before it was turned on
// (CC/docs/cloud-reports/seedling-swim-t4.md § D4):
// - the seed-1 sphere order is byte-identical;
// - the survey's 21-step route (`--derive-only`) is byte-identical;
// - 9 reverse entrances go, and one Or narrows;
// - `--through=2.2`'s leg 2.2 now arrives at L30 from L31 (the south).
// `--no-directional-locks` rebuilds the two-way v1 rows, for comparison only
// (its output is not what `--check` compares against).
const DIRECTIONAL_LOCKS = !process.argv.includes('--no-directional-locks');
// ⛓ RULES re-closing locks — where the game can PUT the player in each level:
// the landing tile of every one-way connection's `to` end in the derived atlas.
// A re-closing lock lets its far side back only when that side holds none of
// these (whoever stands there came in through the held lock, this visit).
// Derived once, `quiet`: the real derivation's notes and guards belong to `main`.
let arrivalTilesByLevel = null;
const arrivalTilesFor = (levelNumber) => {
    if (!arrivalTilesByLevel) {
        const { atlas } = derivePlaythroughLayer(LEVELS, { quiet: true });
        const byRegion = new Map(atlas.regions.map((r) => [r.region_id, r]));
        arrivalTilesByLevel = new Map();
        for (const { to: [regionId, exitId] } of atlas.vanilla_layout?.connections ?? []) {
            const region = byRegion.get(regionId);
            const exit = region?.exits.find((x) => x.exit_id === exitId);
            if (!exit?.entrance_tile) continue;
            if (!arrivalTilesByLevel.has(region.map_ref)) arrivalTilesByLevel.set(region.map_ref, []);
            arrivalTilesByLevel.get(region.map_ref).push(exit.entrance_tile);
        }
    }
    return arrivalTilesByLevel.get(levelNumber) ?? [];
};
// ⛓⛓ RULES rope-events — the ropes of the delivered set, and which are MINTED (every peer of the cut's group opens
// something: `seedlingObstacleEvents.ropeVerdict`). A minted rope's silenced traps charge their LANES its event
// (`ropeLaneCharges`), so a crossing of an armed lane costs the cut (⚖ the user, 2026-10-21: no tank-a-hit crossing).
const ROPES = ropesOf(MAP).map((row) => ({ ...row, verdict: ropeVerdict(row, levelOf(row.level)) }));
/** `"tx,ty"` of a level's game landings and its links: the doors a lane leaves open (`ropeLaneCharges`). */
const doorTilesOf = (level) => new Set([
    ...gameLandings(MAP).filter((g) => g.level === level.level).map((g) => `${Math.floor(g.x / TILE)},${Math.floor(g.y / TILE)}`),
    ...(level.entities ?? []).filter((e) => LINK_TAGS.includes(e.type)).map((e) => `${Math.floor(e.x / TILE)},${Math.floor(e.y / TILE)}`),
]);
const ropeChargesFor = (level, baseGrid) => ROPES.filter((r) => r.level === level.level && !r.verdict.refuse).flatMap((r) => {
    const lanes = r.verdict.effects.filter((e) => e.effect === 'silences')
        .map((e) => arrowLane({ id: `${e.peer.type}@${e.peer.x},${e.peer.y}`, t: r.tset, ...arrowTrapEntityPoint(e.peer.x, e.peer.y) }));
    return lanes.length ? ropeLaneCharges(baseGrid, lanes, ropeEventCondition(r), doorTilesOf(level), TILE) : [];
});
/**
 * ⛓ RULES l55-waterfall — **AN ALL-WATER LEVEL IS FLOORED BY ITS ENTRY GATE.**
 *
 * The analyzer's components are DRY cells, so a level whose every exit and location stands on water binds
 * nothing ("binds to NO walkable component") and shipped as ONE undivided region, its crossings never priced.
 * L52 is three pools split by waterfalls (`dirs: {N: hasFeather}`; `Player.as:1557` adds `v.y += 0.8` on a
 * waterfall unless the Feather is held and the player climbs): undivided, the bottom pool (L51/L56) reached the
 * L55 door on Swim alone, where the game needs the Feather (probe-seedling-l55-waterfall.mjs, 8/8).
 *
 * So when NO binding of a level reaches a dry component on the base grid, and every binding's own cell carries
 * the SAME gate set G, the cells gated by exactly G are FLOOR for the analysis. G is already charged on every way
 * in (a landing on water drowns without Swim: `playthroughLandingGates`; CHECKED on the compiled rules by
 * `playthroughEntryGateUncharged`, which the producer refuses on), and every other cell keeps its kind,
 * so a waterfall stays `directional` and the analyzer's own crossings price it per direction. A level whose
 * bindings sit on different gates (L57: water and the tentacle beast's manual cell) is left as it was.
 *
 * Decided HERE, per level and memoized, so every reader of `playthroughGridFor` (the partition, the maze, the
 * census) sees the grid the atlas was analysed on. A kinds-only call (`arrivals: false`, made from inside the
 * derivation) is never lifted: lifting needs the derived region, and floor is standable either way.
 */
const ENTRY_GATE_PENDING = Symbol('pending');
const entryGateMemo = new Map();
const entryGateConditions = new Map();
let derivedRegionsByLevel = null;
const gateKeyOf = (cell) => cell.conditions.map((c) => JSON.stringify(c)).sort().join('+');
function entryGateOf(level, base) {
    const memo = entryGateMemo.get(level.level);
    if (memo !== undefined) return memo === ENTRY_GATE_PENDING ? null : memo;
    entryGateMemo.set(level.level, ENTRY_GATE_PENDING);
    if (!derivedRegionsByLevel) {
        const { atlas } = derivePlaythroughLayer(LEVELS, { quiet: true });
        derivedRegionsByLevel = new Map(atlas.regions.map((r) => [r.map_ref, r]));
    }
    const region = derivedRegionsByLevel.get(level.level);
    const tiles = region ? [...(region.exits ?? []).map((e) => e.entrance_tile), ...(region.locations ?? []).map((l) => l.tile)] : [];
    const cellAt = ([x, y]) => base.cells[(y - (base.origin?.y ?? 0)) * base.width + (x - (base.origin?.x ?? 0))];
    let gate = null;
    if (tiles.length > 0 && tiles.every((t) => cellAt(t)?.kind === 'gated')) {
        const keys = new Set(tiles.map((t) => gateKeyOf(cellAt(t))));
        if (keys.size === 1) {
            const options = playthroughAnalyzerOptionsFor(level);
            const comps = findComponents(base);
            if (!tiles.some((t) => componentForTile(base, comps, t, options).component)) {
                gate = [...keys][0];
                entryGateConditions.set(level.level, cellAt(tiles[0]).conditions);
            }
        }
    }
    entryGateMemo.set(level.level, gate);
    return gate;
}
/** ⛓ RULES l55-waterfall — the gate set a level is floored by (`entryGateOf`), or null. For the unit rows. */
export const playthroughEntryGate = (level) => entryGateOf(level, baseGridFor(level));
/**
 * ⛓ RULES l55-waterfall — the floor's PREMISE, checked (tile-primitives-design-2's review): G is charged on every
 * way in. Lists each exit of the compiled `rules` that enters a floored level (its region or a sub-region) from
 * OUTSIDE it and whose access rule does not imply every condition of G. A door added later that lands dry would
 * otherwise admit a G-free walk into cells the analysis treated as floor. The producer refuses on a non-empty list.
 */
export function playthroughEntryGateUncharged(rules, levels = LEVELS) {
    const regions = rules.regions?.['1'] ?? rules.regions;
    const implies = (rule, want) => {
        if (!rule) return false;
        if (want.rule === 'And') return want.children.every((w) => implies(rule, w));
        if (rule.rule === 'And') return rule.children.some((c) => implies(c, want));
        if (rule.rule === 'Or') return rule.children.length > 0 && rule.children.every((c) => implies(c, want));
        return rule.rule === 'Has' && want.rule === 'Has' && rule.args.item_name === want.args.item_name
            && (rule.args.count ?? 1) >= (want.args.count ?? 1);
    };
    const uncharged = [];
    for (const level of levels) {
        if (playthroughEntryGate(level) === null) continue;
        const options = playthroughAnalyzerOptionsFor(level);
        const wants = entryGateConditions.get(level.level).map((c) => options.resolveCondition(c));
        const inside = (name) => name === `level_${level.level}` || name.startsWith(`level_${level.level}__`);
        for (const [from, region] of Object.entries(regions)) {
            if (inside(from)) continue;
            for (const exit of region.exits ?? []) {
                if (!inside(exit.connected_region)) continue;
                if (!wants.every((w) => implies(exit.access_rule, w))) uncharged.push({ level: level.level, exit: exit.name });
            }
        }
    }
    return uncharged;
}
const gridFor = (level, options = {}) => {
    const base = baseGridFor(level, options);
    if (options.arrivals === false) return base;
    const gate = entryGateOf(level, baseGridFor(level));
    if (gate === null) return base;
    return { ...base, cells: base.cells.map((c) => (c.kind === 'gated' && gateKeyOf(c) === gate ? { ...c, kind: 'open', conditions: [] } : c)) };
};
const baseGridFor = (level, { directionalLocks = DIRECTIONAL_LOCKS, arrivals = true } = {}) => {
    const build = (extra) => SEM.buildSeedlingRegionGrid(
        { x: 0, y: 0, w: level.width, h: level.height }, level,
        {
            entityOverride,
            tileOverride: OV.overlayTileSemantics,
            pixelMaskFootprints: true,
            ...(directionalLocks ? { directionalLocks, ...(arrivals ? { arrivalTiles: arrivalTilesFor(level.level) } : {}) } : {}),
            ...extra,
        },
    );
    const base = build({});
    if (!ROPES.some((r) => r.level === level.level && !r.verdict.refuse)) return stampOffGridGatedSolids(level, base);
    const cellCharges = ropeChargesFor(level, base);
    return stampOffGridGatedSolids(level, cellCharges.length ? build({ cellCharges }) : base);
};

/**
 * ⛓ RULES l66-door — **AN ITEM-GATED SOLID THAT CLAIMS NO WHOLE TILE STILL COSTS THE DOOR UNDER IT.**
 *
 * `SEM.entitySealedTiles` claims a tile only when the hitbox covers it COMPLETELY, and that rounding is
 * right for the grid (a partly-covered tile is walkable; `planttorch@120,152` once sealed L62). But it
 * left one gated solid with NO tile at all: L66's `bosslock@72,64 {keyType 4}` (`Puzzlements/BossLock.as:29-36`,
 * 16x16 at 72..88 x 64..80, `normType "Solid"` :17) fills building8's doorway notch (`Building8Mask.png`
 * x 72-87, y 64-79), half a tile off the grid, so the grid never carried its key and `chargeSealedDoor`
 * never saw `out_teleporter_72_64` as sealed: the only door into Dungeon 6 shipped True_. The game refuses
 * it without the Yellow Key (`probe-seedling-l66-door.mjs`, CI 40221632410, 64/0).
 *
 * So such an entity contributes its condition to every tile its hitbox OVERLAPS — but only to a cell that
 * is already material the grid cannot walk on its own (`gated`, `sink`, `manual`: the kinds
 * `regionAtlasAnalyzer.sealedInOf` reads). An `open` cell is left alone: there the player's box goes round,
 * which is exactly the rounding `entitySealedTiles` protects. Whether the body has a place is still the
 * physics model's answer (`tileSolid`), never this list's. Read off `ENTITY_SEMANTICS` (no overlay), like
 * `gameGatedSolidTiles`.
 *
 * ⛔ WHY LEAVING AN OPEN CELL UNCHARGED IS NOT LOOSER. A partly-covered tile is walkable only while the free
 * remainder fits the player's 4x5 box; `SEM.entityStrandedTiles` names every tile where it does not, and for
 * these entities it is EMPTY (pinned in `seedlingPlaythroughOffGridLock.test.js`), so on an open footprint cell
 * the player can stand beside the lock without crossing it, and the cell costs nothing the game charges. Today
 * the case is vacuous: L66's two footprint cells are both building8 `manual`, so no open cell is in the census
 * (pinned too), and no game witness covers one; the probe's game truth is the door itself
 * (`probe-seedling-l66-door.mjs`: `bare` stalls at y 82.05 under the lock, `yellow-key` enters L70).
 */
export function offGridGatedSolids(level) {
    const out = [];
    for (const entity of level.entities ?? []) {
        const base = SEM.entitySemantics(entity);
        if (base?.kind !== 'gated' || !base.condition) continue;
        if (SEM.entityClaims(entity, base, { pixelMaskFootprints: true }).map((c) => c.tile).length > 0) continue;
        const f = SEM.entityFootprint(entity, base);
        const tiles = [];
        for (let ty = f.y; ty < f.y + f.h; ty += 1) for (let tx = f.x; tx < f.x + f.w; tx += 1) tiles.push([tx, ty]);
        out.push({ entity, condition: base.condition, tiles });
    }
    return out;
}
const OFF_GRID_STAMPED_KINDS = new Set(['gated', 'sink', 'manual']);
function stampOffGridGatedSolids(level, grid) {
    const solids = offGridGatedSolids(level);
    if (solids.length === 0) return grid;
    const cells = grid.cells.slice();
    for (const { condition, tiles } of solids) {
        const key = SEM.conditionKey(condition);
        for (const [tx, ty] of tiles) {
            const x = tx - (grid.origin?.x ?? 0);
            const y = ty - (grid.origin?.y ?? 0);
            if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
            const cell = cells[y * grid.width + x];
            if (!OFF_GRID_STAMPED_KINDS.has(cell.kind)) continue;
            if (cell.conditions.some((c) => SEM.conditionKey(c) === key)) continue;
            cells[y * grid.width + x] = { ...cell, conditions: [...cell.conditions, condition] };
        }
    }
    return { ...grid, cells };
}
/** ⛓ SWIM T4 — the analyzer grid this generator builds for one level (the census's read). Additive. */
export const playthroughGridFor = (level, options) => gridFor(level, options);
/**
 * ⛓ L40's HAND RULING ON THE GRID (session tile-primitives-sphere-order-6, ⚖ 2026-10-28 "Static now, mechanism later") — the
 * grid a cell-level reader (the maze world) plays, with `OV.L40_EAST_RULE` applied as this generator applies it to the
 * atlas: every L40 crossing whose rule is FIRE_RULE becomes Fire AND a weapon (the IceTurret's corpse on the t2 button
 * costs a kill), so every L40 cell whose conditions resolve to FIRE_RULE takes the ruling's condition. The corpse, the
 * fire-pushed block and the grouped locks are not modelled. Every other level's grid is `playthroughGridFor`'s.
 */
export const playthroughHandRuledGridFor = (level, options) => {
    const grid = gridFor(level, options);
    if (level.level !== OV.L40_EAST_RULE.level) return grid;
    const ruled = resolveFull(OV.L40_EAST_RULE.condition);
    if (JSON.stringify(ruled) !== JSON.stringify({ rule: 'And', children: [FIRE_RULE, WEAPON_RULE] })) {
        throw new Error(`L40_EAST_RULE resolves to ${JSON.stringify(ruled)}, not the Fire AND weapon its crossings take`);
    }
    // A cell's rule as the projection reads it (`occupancyRule`): its conditions resolved and conjoined.
    const cellRule = (c) => {
        const parts = (c.conditions ?? []).map(resolveFull);
        if (parts.length === 0 || parts.some((r) => !r)) return null;
        return simplifyRule(parts.length === 1 ? parts[0] : { rule: 'And', children: parts });
    };
    const fireOnly = (c) => JSON.stringify(cellRule(c)) === JSON.stringify(FIRE_RULE);
    return { ...grid, cells: grid.cells.map((c) => (fireOnly(c) ? { ...c, conditions: [OV.L40_EAST_RULE.condition] } : c)) };
};
/**
 * ⛓ LOGICAL LINKS — the analyzer options this generator runs with, so a reader that re-runs the analysis
 * (`make-seedling-subregion-partition.mjs`: which tile is in which sub-region) gets this run's components
 * exactly. Additive.
 */
export const playthroughAnalyzerOptions = analyzerOptions;

// ── ⛓ RULES logical-links: the PHYSICS MODEL answers what the transcription cannot ──
//
// The two oracles (`manualCrossingVerdict`, `modelReach`) and the refusal of an
// unbound member live in `seedlingDemo/seedlingModelOracles.js`, SHARED with the
// starter atlas producer (`make-seedling-starter-atlas.mjs`), so every Seedling
// atlas asks the model the same question the same way. Re-exported here for the
// readers that import them from this generator.
export { modelFloodTiles, refuseUnboundMembers };

/**
 * ⛓ RULES burnable-trees — the tiles an ITEM-GATED SOLID of the game's own
 * transcription seals in `level` (`seedlingSemantics.ENTITY_SEMANTICS` rows of
 * kind `gated`, read WITHOUT the overlay). A door inside one is used only once
 * the item has removed it (a burnable tree, a breakable rock, a magical lock).
 * The overlay's puzzle-policy rulings are left out on purpose: a `lock` it prices
 * as a weapon is a POLICY about a room-clear puzzle, and charging a door under
 * one (L5's way to L6, before the Sword) seals the map — measured, this slice.
 *
 * ⛓ RULES kill-locks — EXCEPT a kill-lock whose room the census DECIDED
 * (`OV.killLockRoomRuling` verdict `gated`): its rule is the game's own, read
 * off the room's counted bodies, so a door under it costs it. L5 (the
 * burnable-trees seal) is now decided FREE (the arrows kill its bobs), so it
 * is never charged; an UNDECIDED room still keeps its door uncharged.
 */
function gameGatedSolidTiles(level) {
    const tiles = new Set();
    const room = KILL_LOCKS.get(level.level);
    for (const entity of level.entities ?? []) {
        const base = SEM.entitySemantics(entity);
        const killLock = room?.verdict === 'gated' && Number(entity.attrs?.tset) === -1
            && room.locks.includes(`${entity.type}@${entity.x},${entity.y}`);
        // ⛓ RULES location-crossing — and a body the OVERLAY marks `solidBody`: solid in the game
        // (`Mobile.solids`) and removed only by its item (the ShieldBoss, the FinalDoor, Karlore). Each
        // row cites the source for both halves; a policy pricing (a puzzle, a kill-lock) is never marked.
        const solidBody = Boolean(OV.PLAYTHROUGH_ENTITY_OVERLAY[entity.type]?.solidBody);
        if (base?.kind !== 'gated' && !killLock && !solidBody) continue;
        for (const [tx, ty] of SEM.entityClaims(entity, base, { pixelMaskFootprints: true }).map((c) => c.tile)) tiles.add(`${tx},${ty}`);
    }
    // ⛓ RULES l66-door — and the overlapped tiles of a gated solid that claims no whole tile (`offGridGatedSolids`).
    for (const { tiles: overlapped } of offGridGatedSolids(level)) for (const [tx, ty] of overlapped) tiles.add(`${tx},${ty}`);
    return tiles;
}

/**
 * ⛓ RULES lock-events — the LATCHING locks of one level, by tile: every placed entity whose semantics mark it
 * `persists` (a one-sided lock whose persistence tag keeps it open: today the BossLock, `persistAttr: 'tag'`), as
 * `"x,y"` -> `{level, tag, cls, x, y, name}`. Read off the semantics, never a class list here.
 */
const latchLocksMemo = new Map();
function latchLocksOf(level) {
    if (latchLocksMemo.has(level.level)) return latchLocksMemo.get(level.level);
    const out = new Map();
    for (const e of level.entities ?? []) {
        const sem = SEM.entitySemantics(e);
        if (!sem?.persists) continue;
        const lock = { level: level.level, tag: Number(e.attrs[sem.persistAttr]), cls: e.type, x: e.x, y: e.y };
        lock.name = obstacleEventName(lock);
        for (const [tx, ty] of SEM.entityClaims(e, sem, { pixelMaskFootprints: true }).map((c) => c.tile)) out.set(`${tx},${ty}`, lock);
    }
    latchLocksMemo.set(level.level, out);
    return out;
}

/** The analyzer options for ONE level: the shared ones plus the model oracles. */
export function playthroughAnalyzerOptionsFor(level) {
    const oracles = seedlingModelOracles(level, gridFor(level), { tileSize: TILE });
    const gated = gameGatedSolidTiles(level);
    const locks = latchLocksOf(level);
    return {
        ...analyzerOptions,
        ...oracles,
        tileSolid: ({ tile }) => gated.has(`${tile[0]},${tile[1]}`) && oracles.tileSolid({ tile }),
        // ⛓ RULES lock-events: a latched cell is opened once its lock's flag is cleared — the lock's event.
        latchEvent: ([x, y]) => {
            const lock = locks.get(`${x},${y}`);
            return lock ? { rule: 'Has', args: { item_name: lock.name } } : null;
        },
        // ⛓ RULES waterfall-door: a landing is a way in, so an approach cost is never charged past one.
        arrivalTiles: () => arrivalTilesFor(level.level),
    };
}

// ── what the derivation needs, and what this script keeps ─────────────────
//
// ⛓⛓ EDITOR v3 slice D0b — `linksOf`, `pitOf`, `tileOf`/`arrivalTileOf`,
// `regionIdFor`/`outExitId`/`inExitId`, `locationsFor`, `levelName`/`labelFor`
// and the region-building core of `buildPlaythroughAtlas` all LIVE IN
// `seedlingDemo/seedlingAtlasDerivation.js` now (plan §16.3, ⚖ ruled). They
// were never about THIS generator: they are what turns a list of Seedling
// rooms into an atlas, and a level-set editor needs exactly the same function.
//
// ⛔ WHAT STAYED HERE IS THE POINT, NOT THE LEFTOVERS. Everything below —
// the analyzer pass, `applyCrossingCostToBindings`, `applyLavaTrapPulls`,
// `applyHandRulings`, `pruneUnreachableSubRegions` — is the VANILLA OVERLAY,
// and §16.3 says an atlas is `derive(rooms) + authored overlay`. That the
// 116-room vanilla build needs one is the evidence the shape is right; a
// derivation that had swallowed the hand rulings would have proved the
// opposite.

// ── build ──────────────────────────────────────────────────────────────────

/**
 * ⛓ EDITOR v3 E1 — **THE DERIVED LAYER, ON ITS OWN.** Everything below this
 * call in `buildPlaythroughAtlas` is the VANILLA OVERLAY (the analyzer pass,
 * the lava-trap pulls, the hand rulings, the pocket pruning), so a caller that
 * wants to know what the ROOMS alone say had no way to ask: the only export was
 * the finished document with all four layers folded in.
 *
 * ⛔ ADDITIVE AND BYTE-INERT — `buildPlaythroughAtlas` calls it, so there is
 * exactly ONE `deriveAtlas` call site with exactly one set of arguments, and
 * `--check` still regenerates both committed files byte for byte.
 *
 * ⛓ `rooms` DEFAULTS TO THE MAP EXTRACT'S LEVELS, and the parameter exists for
 * exactly one caller: E1's cross-check runs this SAME derivation, with the SAME
 * authored overlay and the SAME deps, over the same 116 rooms arriving as
 * `parseOelLevel(recordToOel(record))` instead of as map records, and compares
 * the region set, the boundary exits and the connections — the three fact-sets
 * this function owns and the overlay never touches. Passing the rooms in is what
 * makes that a difference of ONE variable instead of a second derivation.
 */
/**
 * ⛓ RULES game-truth-gaps — the `named_rooms` warps this generator wires: ONLY the exits created on an
 * arena boss's death (`OV.DEATH_EXIT_ARENAS`), each read off the vanilla set's manifest (the runtime-exit
 * census as data). The rest of the manifest (the Moonrock's, the Oracle's, the Watcher's warps) stays out:
 * none is an arena's exit.
 */
const VANILLA_NAMED_ROOMS = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), 'utf8')).named_rooms;
export const ARENA_NAMED_ROOMS = Object.freeze(Object.fromEntries(OV.DEATH_EXIT_ARENAS.map((a) => {
    const entry = VANILLA_NAMED_ROOMS[a.namedRoom];
    if (!entry) throw new Error(`death-exit arena L${a.level}: the vanilla manifest has no ${a.namedRoom}`);
    return [a.namedRoom, entry];
})));

export function derivePlaythroughLayer(rooms = LEVELS, { quiet = false } = {}) {
    // `quiet` (the re-closing locks' arrival tiles) takes the chains' outcome WITHOUT the notes/records.
    const { pitOutcome: loud, pure } = pitChainsFor(rooms);
    const pitOutcome = quiet ? pure : loud;
    return deriveAtlas(rooms, {
        locations: R7_GOAL_LEDGER,
        locationGuard: OV.locationGuard,
        neverEnter: { levels: OV.NEVER_ENTER_LEVELS, cite: OV.NEVER_ENTER_CITE },
    }, {
        tileSize: TILE,
        tileTypeForPlacement: SEM.tileTypeForPlacement,
        resolveCondition: (c) => analyzerOptions.resolveCondition(c),
        note: quiet ? () => {} : note,
        onGuard: quiet ? () => {} : (loc, guard) => locationGuards.push(`${loc.name} — ${guard.cite}`),
        pitOutcome,
        namedRooms: ARENA_NAMED_ROOMS,
        atlas: {
            game: 'seedling',
            name: 'Seedling — the honest playthrough (rules v1)',
            description: 'GENERATED — do not edit. One region per level for all 116 levels, '
                + 'sub-regions and their crossing rules computed by the Phase-5a reachability '
                + 'analyzer over seedlingSemantics\' transcription, with seedlingPlaythroughOverlay '
                + 'supplying the item rulings the transcription refuses and the physics model\'s '
                + 'own pixel masks supplying the building outlines. Every link is ONE-WAY, because '
                + 'the game has exactly one transition primitive and it is a one-way jump. '
                + 'Regenerate with scripts/procgen/make-seedling-playthrough-rules.mjs.',
            mapSource: 'ogmo-extract',
            mapDocument: path.basename(MAP_FILE),
        },
    });
}

/**
 * ⛓ RULES patched-set — **A FALL ENDS WHERE THE GAME ENDS IT.** The fidelity DESCENT census
 * (`censusFallsOntoDoors`, the model's own descent) over THESE rooms names every pit whose fall fires a live
 * door; `seedlingPitChains` turns it into the derivation's `pitOutcome`, so such a pit exits to the door's
 * target, not the intermediate landing. No hand row. A chain ending on a cell the analyzer grid does not
 * stand on refuses by name. Memoized per rooms array (the census builds every level's world).
 */
const STANDABLE_KINDS = new Set(['open', 'gated', 'directional']);
const pitChainMemo = new WeakMap();
export const pitChains = [];
function pitChainsFor(rooms) {
    if (pitChainMemo.has(rooms)) return pitChainMemo.get(rooms);
    const census = censusFallsOntoDoors(rooms);
    const byId = new Map(rooms.map((r) => [r.level, r]));
    const out = pitChainsFromCensus(census, {
        tileSize: TILE,
        standable: (n, [tx, ty]) => {
            const room = byId.get(n);
            if (!room) return `L${n} is not in the set`;
            // Kinds only, which arrival tiles never change — and asking for them would derive the atlas this
            // census is part of (the re-closing locks' arrivals), a cycle.
            const grid = gridFor(room, { arrivals: false });
            const kind = grid.cells[ty * grid.width + tx]?.kind;
            return STANDABLE_KINDS.has(kind) ? true : `the analyzer grid reads it as ${JSON.stringify(kind ?? null)}`;
        },
    });
    const wrapped = {
        census,
        pure: out.pitOutcome,
        pitOutcome: (room, group) => {
            const end = out.pitOutcome(room, group);
            if (end) {
                const c = out.chains.at(-1);
                pitChains.push(c);
                note(`${regionIdFor(c.from)}: pit [${c.tiles.map((t) => t.join(',')).join(' ')}] CHAINS — lands in `
                    + `L${c.landing.level} [${c.landing.tile}], the descent fires ${c.via} at t${c.t}, the fall ends `
                    + `in L${c.ends.level} [${c.ends.tile}] (fidelityDescent.censusFallsOntoDoors)`);
            }
            return end;
        },
    };
    pitChainMemo.set(rooms, wrapped);
    return wrapped;
}

export function buildPlaythroughAtlas() {
    notes.length = 0;
    prunedPockets.length = 0;
    droppedRegions.length = 0;
    lavaTrapLifts.length = 0;
    locationGuards.length = 0;
    permissiveBindings.length = 0;
    modelVerdicts.length = 0;
    crossingCharged.length = 0;
    sealedDoorsCharged.length = 0;
    directionalDoorsCharged.length = 0;
    pocketDoorsCharged.length = 0;
    sealedLocationsCharged.length = 0;
    arrivalsUncharged.length = 0;
    exitComponents.clear();
    regionAnalyses.clear();
    pitChains.length = 0;
    /**
     * ⛓⛓ THE ATLAS IS DERIVED; ONLY THE OVERLAY IS AUTHORED (plan §16.3, ⚖
     * ruled by the user 2026-08-25). Everything this call produces — one region
     * per room, the boundary exits from the link entities and the pits, the
     * one-way connections, the ledger locations — is a FUNCTION of the rooms.
     * The three authored things travel in `overlay`.
     *
     * ⚠ THE MAP EXTRACT'S LEVELS ARE ALREADY THE RECORD SHAPE `deriveAtlas`
     * TAKES: `{level, width, height, layers, entities}`. A level set's parsed
     * room (`procgenLevelOel.parseOelLevel`) presents the same record MINUS
     * `level`, which the set supplies — the adaptation is at the call site, by
     * design, because the two sources mean different numberings.
     */
    const derived = derivePlaythroughLayer();
    droppedRegions.push(...derived.dropped);
    const session = new AtlasSession(derived.atlas);

    // ── the analysis pass ────────────────────────────────────────────────
    for (const region of [...session.atlas.regions]) {
        const regionId = region.region_id;
        const level = levelOf(region.map_ref);
        const levelOptions = playthroughAnalyzerOptionsFor(level);
        const analysis = analyzeRegion(region, gridFor(level), levelOptions);
        const floor = entryGateOf(level, baseGridFor(level));
        if (floor !== null) {
            note(`${regionId}: no binding reaches a dry component — FLOORED by its entry gate ${floor} `
                + `(${analysis.components.length} sub-region(s); the gate is charged on every way in)`);
        }
        const applied = applyRegionAnalysis(session.atlas, analysis, { stamp: false });
        for (const p of applied.problems) note(`${regionId}: ${p.message}`);
        for (const n of analysis.needs_authoring) {
            note(`${regionId}: ${n.from} ${n.bidirectional ? '<->' : '->'} ${n.to} `
                + `NEEDS A HAND-WRITTEN RULE — ${n.reasons.join('; ')}`);
        }
        for (const v of analysis.model_verdicts) {
            const ways = v.ways.map((w) => (w.length === 0 ? 'free' : w.map((c) => SEM.conditionKey(c)).join(' + ')));
            modelVerdicts.push(`${regionId}/${v.from}->${v.to} ${v.walkable ? `WALKABLE [${ways.join(' | ')}]` : 'SEALED'}`);
            note(`${regionId}: ${v.from} -> ${v.to} through ${v.reasons.join('; ')} — the physics model's flood `
                + (v.walkable
                    ? `walks it: an analyzer row costing ${ways.join(' OR ')} (${v.sealed} way(s) sealed)`
                    : 'cannot walk any way of it: NO crossing (was a True_ hand-authoring default)'));
        }
        const unbound = analysis.bindings.filter((b) => !b.component);
        for (const b of unbound) note(`${regionId}: ${b.kind} "${b.id}" binds to NO walkable component — ${b.reason}`);
        for (const b of analysis.bindings) {
            if (b.model) note(`${regionId}: ${b.kind} "${b.id}" at [${b.tile}] bound to "${b.component.id}" by the physics model — ${b.reason}`);
        }
        exitComponents.set(regionId, componentTestsFor(level, analysis));
        regionAnalyses.set(regionId, analysis);
        applyCrossingCostToBindings(session.atlas, regionId, analysis);
        chargeDirectionalApproaches(session.atlas, regionId, level, analysis);
        chargeSealedPockets(session.atlas, regionId, level, analysis, levelOptions);
        applyLavaTrapPulls(session.atlas, regionId, level, analysis);
        pruneUnreachableSubRegions(session.atlas, regionId);
        refuseUnboundMembers(session.atlas.regions.find((r) => r.region_id === regionId), unbound);
    }
    applyHandRulings(session.atlas);
    return session.toDocument();
}

/**
 * ⛔⛔ THE COST OF STANDING ON THE DOOR (R7 slice 5).
 *
 * An exit drawn on crossing material is not free to use: you have to get onto
 * that material first. The analyzer now says which component reaches such a
 * tile AND what the crossing charges (`binding.conditionSets`); dropping the
 * charge is a PERMISSIVENESS defect with teeth, and the sphere log is where it
 * showed:
 *
 *   L12's teleporter to L83 sits on a cave tile whose only approach is the
 *   stacked `bosslock{key 4}` + `magicallock` cell one south. Bound to the
 *   component and charged NOTHING, it opened all of Dungeon 7 in sphere 1 and
 *   put the DARK SHIELD twelve steps before the Ghost Spear that
 *   `worlds/seedling/Rules.py` says it needs.
 *
 * So the crossing's own Pareto-minimal ways are ORed, ANDed onto whatever the
 * exit already carries, and the row says where it came from.
 *
 * ⛔⛔ AND IT IS OFF BY DEFAULT, BECAUSE IT IS MEASURED AND IT SEALS THE MAP.
 * Charging all 21 such exits (departures only; arrivals measure the mirror
 * question and were excluded first) takes the fill from **240 of 250 AP regions
 * to 19**, with the SWORD unreachable. The cause is visible in one row:
 * `level_3/out_teleporter_0_64` stands on a water cell whose cheapest approach
 * the search prices as `And(Ghost Sword Fusion, Ghost Spear, Progressive Sword,
 * Progressive Swim)` — a CONJUNCTION of everything one path crosses, which is a
 * sound cost for that path and a wrong cost for the door.
 *
 * So the general charge stays behind `--charge-crossings`, runnable by whoever
 * makes the cost per-approach rather than per-path, and the ONE door whose
 * dropped cost visibly distorts the sphere order is hand-ruled instead
 * (`OV.D7_APPROACH_RULE`). Everything else is counted in `permissiveBindings`
 * and named as a bound rather than folded into the green.
 *
 * ⚠ THE OTHER BOUND: the analyzer answers "which component can REACH this
 * tile", the DEPARTURE question. An ARRIVAL needs the mirror of it, the two
 * differ across a one-way face, and the atlas exit row carries no direction —
 * so arrivals are never charged and are counted in `arrivalsUncharged`.
 */
const CHARGE_CROSSINGS = process.argv.includes('--charge-crossings');

function applyCrossingCostToBindings(atlas, regionId, analysis) {
    const region = atlas.regions.find((r) => r.region_id === regionId);
    for (const b of analysis.bindings) {
        if (b.kind === 'location') {
            if (b.sealedIn) chargeSealedLocation(region, regionId, b);
            else if (b.conditionSets?.length > 0) countUnchargedLocation(region, regionId, b);
            continue;
        }
        if (b.kind !== 'exit' || !b.component || !b.reachable) continue;
        if (!b.conditionSets || b.conditionSets.length === 0) {
            // ⛓ RULES l66-door — a departure bound THROUGH material (no priced way at all) but sealed inside
            // its own cell still costs that cell: the solid has to be gone before the door is touched.
            if (b.sealedIn && b.id.startsWith('out_')) chargeSealedDoor(region, regionId, b);
            continue;
        }
        // ⛔ DEPARTURES ONLY. The analyzer answers "which component can REACH
        // this tile", which is the DEPARTURE question. Charging an ARRIVAL the
        // same cost measured the wrong direction and sealed the map — 19 of 250
        // regions, with the SWORD unreachable — so the arrival side is left
        // permissive and counted instead.
        if (!b.id.startsWith('out_')) { arrivalsUncharged.push(`${regionId}/${b.id}`); continue; }
        if (!CHARGE_CROSSINGS) {
            chargeSealedDoor(region, regionId, b);
            continue;
        }
        const ways = [];
        for (const set of b.conditionSets) {
            const parts = set.conditions.map((c) => analyzerOptions.resolveCondition(c));
            if (parts.some((p) => !p)) { ways.length = 0; break; }
            ways.push(parts.length === 1 ? parts[0] : { rule: 'And', children: parts });
        }
        if (ways.length === 0) {
            permissiveBindings.push(`${regionId}/${b.id}`);
            note(`${regionId}: exit "${b.id}" stands on gated material whose conditions do NOT `
                + 'resolve to items — the approach cost is DROPPED, which is permissive');
            continue;
        }
        const cost = ways.length === 1 ? ways[0] : { rule: 'Or', children: ways };
        const exit = (region.exits ?? []).find((e) => e.exit_id === b.id);
        if (!exit) continue;
        exit.access_rule = exit.access_rule === undefined
            ? cost
            : { rule: 'And', children: [exit.access_rule, cost] };
        crossingCharged.push(`${regionId}/${b.id}`);
    }
}

/**
 * ⛓ RULES burnable-trees — **A DOOR INSIDE AN ITEM-GATED SOLID COSTS ITS SOLID.**
 *
 * The general charge above stays off (it prices one PATH's whole conjunction).
 * What is always sound is narrower: when the physics model has no place for the
 * player's body on the door's own tile (`binding.sealedIn`, the analyzer's
 * `tileSolid` oracle), the door is touched only once that solid is gone, so its
 * own cell's conditions are NECESSARY on every way in. L24's two teleporters to
 * L12 sit inside `burnabletree@32,128` and shipped True_; this charges them Fire.
 * Only the transcription's OWN item-gated solids count (`gameGatedSolidTiles`), plus the overlay bodies the
 * game makes solid that only an item removes (`solidBody`: the ShieldBoss, the FinalDoor, Karlore).
 * The departure is still counted permissive when the rest of its approach costs
 * more than its own cell.
 */
function chargeSealedDoor(region, regionId, b) {
    const own = b.sealedIn?.conditions ?? [];
    const parts = own.map((c) => analyzerOptions.resolveCondition(c));
    const exit = (region.exits ?? []).find((e) => e.exit_id === b.id);
    if (own.length === 0 || parts.some((p) => !p) || !exit) {
        permissiveBindings.push(`${regionId}/${b.id}`);
        return;
    }
    const cost = parts.length === 1 ? parts[0] : { rule: 'And', children: parts };
    exit.access_rule = exit.access_rule === undefined ? cost : { rule: 'And', children: [exit.access_rule, cost] };
    sealedDoorsCharged.push(`${regionId}/${b.id}`);
    const ownKey = own.map((c) => analyzerOptions.conditionKey(c)).sort().join('+');
    const whole = b.conditionSets.length === 1
        && b.conditionSets[0].conditions.map((c) => analyzerOptions.conditionKey(c)).sort().join('+') === ownKey;
    if (!whole) permissiveBindings.push(`${regionId}/${b.id}`);
    note(`${regionId}: exit "${b.id}" at [${b.tile}] sits INSIDE an item-gated solid (the physics model has no `
        + `place for the body on it) — CHARGED its own cell (${own.map((c) => SEM.conditionKey(c)).join(' + ')})`
        + (whole ? '' : '; the rest of its approach stays uncharged (permissive)'));
}

/**
 * ⛓ RULES waterfall-door — **A DOOR ONLY REACHED BY MOVING A GATED WAY COSTS THAT WAY.**
 *
 * The general charge stays off (one path's conjunction). What the analyzer also answers is the binding's
 * `necessary`: the conditions EVERY way onto the door's tile pays, from every component and every landing
 * (`arrivalTiles`), so charging any of them is never stricter than the game. Of those, a departure is charged
 * the ones a DIRECTION gate of its grid prices (`cell.dirs`, today the waterfall's `N: hasFeather`,
 * `Player.as:1557`): the door is touched only by moving that way on that tile. L89's teleporter to L91 sits atop a
 * two-tile fall whose one way up is the fall itself, and shipped on Swim alone; the game needs the Feather
 * (probe-seedling-l89-waterfall.mjs). Other necessary conditions (the water the fall stands in) are the region's
 * entry gates, already charged on every way in, and are left alone.
 */
function chargeDirectionalApproaches(atlas, regionId, level, analysis) {
    const region = atlas.regions.find((r) => r.region_id === regionId);
    const directional = new Set(gridFor(level).cells
        .flatMap((c) => Object.values(c.dirs ?? {}))
        .flatMap((g) => (Array.isArray(g) ? g : g ? [g] : []))
        .map((c) => analyzerOptions.conditionKey(c)));
    if (directional.size === 0) return;
    for (const b of analysis.bindings) {
        if (b.kind !== 'exit' || !b.id.startsWith('out_') || !b.reachable || b.exact) continue;
        const own = new Set((b.sealedIn?.conditions ?? []).map((c) => analyzerOptions.conditionKey(c)));
        const due = (b.necessary ?? []).filter((c) => directional.has(analyzerOptions.conditionKey(c))
            && !own.has(analyzerOptions.conditionKey(c)));
        const exit = (region.exits ?? []).find((e) => e.exit_id === b.id);
        if (due.length === 0 || !exit) continue;
        const parts = due.map((c) => analyzerOptions.resolveCondition(c));
        if (parts.some((p) => !p)) {
            note(`${regionId}: exit "${b.id}" is reached only by moving a direction-gated way whose conditions do NOT `
                + 'resolve to items — left uncharged (permissive)');
            continue;
        }
        const cost = parts.length === 1 ? parts[0] : { rule: 'And', children: parts };
        exit.access_rule = exit.access_rule === undefined ? cost : { rule: 'And', children: [exit.access_rule, cost] };
        directionalDoorsCharged.push(`${regionId}/${b.id}`);
        note(`${regionId}: exit "${b.id}" at [${b.tile}] is reached only by moving a direction-gated way — CHARGED `
            + `${due.map((c) => SEM.conditionKey(c)).join(' + ')} (every way onto the tile pays it)`);
    }
}

/**
 * ⛓ RULES location-crossing — **A LOCATION INSIDE AN ITEM-GATED SOLID COSTS ITS SOLID.**
 *
 * `chargeSealedDoor`'s family, for a location: a pickup is taken only on OVERLAP, so when the physics
 * model has no place for the body on the location's own tile (`binding.sealedIn`), the solid has to be
 * gone first and its own cell's conditions are NECESSARY on every way in. Never the binding's whole
 * `conditionSets` (one path's conjunction — the `--charge-crossings` defect above): only the cell the
 * body must occupy. L19's Boss Key 0 lies inside `shieldboss@80,32`'s 48x48 body and shipped True_;
 * this charges it the Sword. Unlike a door it has no direction, so it needs no departure test.
 */
function chargeSealedLocation(region, regionId, b) {
    const own = b.sealedIn.conditions;
    const parts = own.map((c) => analyzerOptions.resolveCondition(c));
    const loc = (region.locations ?? []).find((l) => l.name === b.id);
    if (parts.some((p) => !p) || !loc) {
        permissiveBindings.push(`${regionId}/${b.id}`);
        note(`${regionId}: location "${b.id}" sits INSIDE an item-gated solid whose conditions do NOT resolve `
            + 'to items — left uncharged (permissive)');
        return;
    }
    const cost = parts.length === 1 ? parts[0] : { rule: 'And', children: parts };
    loc.access_rule = loc.access_rule === undefined ? cost : { rule: 'And', children: [loc.access_rule, cost] };
    sealedLocationsCharged.push(`${regionId}/${b.id}`);
    note(`${regionId}: location "${b.id}" at [${b.tile}] sits INSIDE an item-gated solid (the physics model has `
        + `no place for the body on it) — CHARGED its own cell (${own.map((c) => SEM.conditionKey(c)).join(' + ')})`);
}

/**
 * ⛓ RULES location-crossing — a location on FREE material that the analyzer binds through a gated way is NOT
 * charged that way: it is one approach's conjunction (the `--charge-crossings` class), not a cell the body must
 * occupy. L89's Feather lies on water between two waterfalls; the binder's nearest component climbs the south
 * one (Swim + Feather), but the arrivals from L90/L91 come DOWN the north one on Swim alone, which every way
 * into its sub-region already costs. Counted in `permissiveBindings` and named, unless a rule already rides
 * on the location (a boss kill the overlay rules).
 */
function countUnchargedLocation(region, regionId, b) {
    const loc = (region.locations ?? []).find((l) => l.name === b.id);
    if (!loc || loc.access_rule !== undefined) return;
    permissiveBindings.push(`${regionId}/${b.id}`);
    note(`${regionId}: location "${b.id}" at [${b.tile}] is bound through gated material on one approach `
        + `(${b.conditionSets.map((s) => s.conditions.map((c) => SEM.conditionKey(c)).join(' + ')).join(' OR ')}) `
        + '— not charged: a path\'s conjunction, not its own cell (permissive)');
}

/**
 * ⛓ RULES obstacle-events — **A DOOR WHOSE POCKET ONLY A SOLID OPENS COSTS THAT SOLID.**
 *
 * The same family as `chargeSealedDoor`, one step out: the door's own tile is free, but the analyzer
 * binds it only THROUGH material it cannot price (a building's sprite rect), so `conditionSets` is
 * empty and nothing was charged. The physics model is asked for the door's pocket
 * (`seedlingModelOracles.sealedPocket`): when it reaches no component and every gated cell around it
 * is a model SOLID, one of those solids must be gone first, so their conditions (Or over the cells)
 * are necessary on every way in. L0's door to L1 stands in the house's doorway behind
 * breakablerock@80,112 — the binding defect `rules-footprints` found ("binds through material, never
 * charging the rock"). Departures only: an arrival is not charged (see `arrivalsUncharged`); one that
 * lands inside a saved solid is the obstacle EVENTS' business.
 */
function chargeSealedPockets(atlas, regionId, level, analysis, options) {
    if (typeof options.sealedPocket !== 'function') return;
    const region = atlas.regions.find((r) => r.region_id === regionId);
    const grid = gridFor(level);
    const { indexOf } = analysis.componentsResult;
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const cellAt = ([x, y]) => (x - ox < 0 || y - oy < 0 || x - ox >= grid.width || y - oy >= grid.height
        ? null : (y - oy) * grid.width + (x - ox));
    const enterable = (x, y) => {
        const i = cellAt([x, y]);
        return i !== null && ['open', 'wall', 'manual'].includes(grid.cells[i].kind);
    };
    const inComponent = (t) => {
        const i = cellAt(t);
        return i !== null && indexOf[i] >= 0;
    };
    for (const b of analysis.bindings) {
        if (b.kind !== 'exit' || !b.manual || !b.id.startsWith('out_')) continue;
        const border = options.sealedPocket({ tile: b.tile, enterable, inComponent });
        if (!border) continue;
        const ways = border.map((cell) => {
            const parts = cell.conditions.map((c) => analyzerOptions.resolveCondition(c));
            if (parts.some((p) => !p)) return null;
            return parts.length === 1 ? parts[0] : { rule: 'And', children: parts };
        });
        const exit = (region.exits ?? []).find((e) => e.exit_id === b.id);
        if (ways.some((w) => !w) || !exit) {
            note(`${regionId}: exit "${b.id}" sits in a pocket only solids open, and they do NOT resolve to items — `
                + 'left uncharged (permissive)');
            continue;
        }
        const cost = ways.length === 1 ? ways[0] : { rule: 'Or', children: ways };
        exit.access_rule = exit.access_rule === undefined ? cost : { rule: 'And', children: [exit.access_rule, cost] };
        pocketDoorsCharged.push(`${regionId}/${b.id}`);
        note(`${regionId}: exit "${b.id}" at [${b.tile}] is bound through material the transcription cannot price, `
            + `and the physics model's pocket around it opens only through ${border.map((c) => `[${c.tile}]`).join(', ')} `
            + `— CHARGED ${border.map((c) => c.conditions.map((x) => SEM.conditionKey(x)).join(' + ')).join(' OR ')}`);
    }
}

/**
 * ⛓ THE LAVATRAP LIFTS — a transport the tile grid has no vocabulary for.
 *
 * This is NOT a weakened rule (the shape `applyHandRulings` forbids): it is an
 * EDGE the source proves exists and terrain analysis cannot see, the same class
 * as the pits the link pass wires from `<control>`. `LavaTrap.as` reels the
 * player onto the trap's own tile with `onGround = false` — crossing a pit that
 * would otherwise kill — and the arrival is survivable only with the Dark Suit
 * (`OV.LAVATRAP_PULL` carries the citation).
 *
 * One ONE-WAY internal exit per (source sub-region -> trap sub-region) pair,
 * gated on the Dark Suit. A pull inside one sub-region is nothing to add.
 */
function applyLavaTrapPulls(atlas, regionId, level, analysis) {
    const pulls = OV.lavaTrapPulls(level, TILE);
    if (pulls.length === 0) return;
    const region = atlas.regions.find((r) => r.region_id === regionId);
    const subs = new Set(region?.subgraph?.sub_regions ?? []);
    if (subs.size < 2) return;
    const { indexOf, components } = analysis.componentsResult;
    const subOf = ([x, y]) => {
        const i = indexOf[y * level.width + x];
        return i >= 0 && subs.has(components[i].id) ? components[i].id : null;
    };
    const added = new Set();
    for (const pull of pulls) {
        const to = subOf(pull.tile);
        if (!to) continue;
        for (const tile of pull.from) {
            const from = subOf(tile);
            if (!from || from === to || added.has(`${from}>${to}`)) continue;
            added.add(`${from}>${to}`);
            region.subgraph.internal_exits.push({
                from, to, bidirectional: false, source: 'manual', access_rule: DARKSUIT_RULE,
            });
        }
    }
    if (added.size === 0) return;
    region.subgraph.internal_exits.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    region.annotations.rules_source = 'mixed';
    lavaTrapLifts.push(...[...added].map((k) => `${regionId}/${k}`));
    note(`${regionId}: ${added.size} LavaTrap lift(s) added, one-way and gated on the Dark Suit — `
        + `${OV.LAVATRAP_PULL.why} (${OV.LAVATRAP_PULL.cite})`);
}

/**
 * The two rows a hand ruled, each STRICTLY STRONGER than what the general rule
 * produced — which is the only shape a hand ruling is allowed to take here. A
 * hand ruling that WEAKENED a computed rule would be an unwitnessed claim that
 * the game is easier than the tables say.
 */
function applyHandRulings(atlas) {
    // ── L40, from slice 3's measured route (§12.2-12.4) ───────────────────
    //
    // Under the puzzle policy the general rule already says the right thing
    // about the wandlock (a grouped lock is choreography), and the analyzer
    // already gates L40's interior on FIRE through link 2's burnable tree. What
    // the general rule cannot see is the other half of the measured route: the
    // second holder on `button@480,384 {t 2}` is the ICETURRET'S CORPSE, and a
    // corpse costs a kill. So every fire-gated crossing inside L40 gains the
    // weapon term, and nothing else moves.
    const l40 = atlas.regions.find((r) => r.region_id === regionIdFor(OV.L40_EAST_RULE.level));
    let strengthened = 0;
    for (const row of l40?.subgraph?.internal_exits ?? []) {
        if (JSON.stringify(row.access_rule) !== JSON.stringify(FIRE_RULE)) continue;
        row.access_rule = { rule: 'And', children: [FIRE_RULE, WEAPON_RULE] };
        row.source = 'manual';
        strengthened += 1;
    }
    if (strengthened > 0) l40.annotations.rules_source = 'mixed';
    note(`level_40: ${strengthened} fire-gated crossing(s) strengthened to fire AND a weapon `
        + `— ${OV.L40_EAST_RULE.why} (${OV.L40_EAST_RULE.cite})`);

    // ── ⛔ THE L76 IGNEOUS RULING IS GONE, AND ITS DELETION IS THE SLICE'S
    //    FIRST REFUTATION (`OV.REFUTATION_LOG[0]`, R7 §14).
    //
    // §13.5 ruled the Igneous-to-Lava crossing DARK SUIT on a worst-case
    // reading. It put the Dark Suit behind ITSELF: L76 is the only door into
    // D7, the suit is the only collectible past it, and AP refused seven
    // locations for it. At source the tile is walkable until eight frames of
    // proximity start a conversion that the next level entry rebuilds away, so
    // the ruling now lives in the overlay as `IGNEOUS_IS_FREE` and applies to
    // every igneous tile in the game rather than to one level's leftovers.
    // ── the hand-charged doors (§14): the exits whose dropped approach cost
    //    the SPHERE LOG caught — D7's entrance (the endgame door's two rows
    //    retired in RULES location-crossing: the FinalDoor is a `solidBody`, so
    //    `chargeSealedDoor` charges them) — and the LavaBoss arena's doors.
    for (const door of OV.CHARGED_DOORS) {
        const region = atlas.regions.find((r) => r.region_id === regionIdFor(door.level));
        const exit = (region?.exits ?? []).find((e) => e.exit_id === door.exitId);
        if (!exit) {
            throw new Error(`charged door ${door.level}/${door.exitId} is not in the atlas — `
                + 'a hand ruling whose target vanished is a silent hole, not a no-op');
        }
        const rule = analyzerOptions.resolveCondition(door.condition);
        if (!rule) throw new Error(`charged door ${door.level}/${door.exitId} does not resolve to a rule`);
        exit.access_rule = exit.access_rule === undefined
            ? rule : { rule: 'And', children: [exit.access_rule, rule] };
        // `rules_source` is DERIVED from the internal exits (the validator's
        // rule); a charged EXIT is not one, so it only fills the gap.
        region.annotations.rules_source = derivedRulesSource(region) ?? 'mixed';
        crossingCharged.push(`${regionIdFor(door.level)}/${door.exitId}`);
        note(`${regionIdFor(door.level)}: ${door.exitId} CHARGED its approach by hand — `
            + `${door.why} (${door.cite})`);
    }

    // ── ⛓ RULES game-truth-gaps: the arenas whose exit is created on death (`OV.DEATH_EXIT_ARENAS`) — every
    //    connection INTO or OUT OF the arena's level costs the arena (the L82 precedent: gated both ways).
    for (const arena of OV.DEATH_EXIT_ARENAS) {
        const arenaRegion = regionIdFor(arena.level);
        const rule = analyzerOptions.resolveCondition(arena.condition);
        if (!rule) throw new Error(`death-exit arena L${arena.level} does not resolve to a rule`);
        const conns = (atlas.vanilla_layout?.connections ?? [])
            .filter((c) => c.from[0] === arenaRegion || c.to[0] === arenaRegion);
        const out = conns.filter((c) => c.from[0] === arenaRegion && c.to[1].startsWith(`in_${arena.namedRoom}_`));
        if (out.length === 0) {
            throw new Error(`death-exit arena L${arena.level}: the atlas wires no ${arena.namedRoom} warp out of it`);
        }
        for (const c of conns) {
            const region = atlas.regions.find((r) => r.region_id === c.from[0]);
            const exit = (region?.exits ?? []).find((e) => e.exit_id === c.from[1]);
            if (!exit) throw new Error(`death-exit arena L${arena.level}: ${c.from.join('/')} is not in the atlas`);
            exit.access_rule = exit.access_rule === undefined ? rule : { rule: 'And', children: [exit.access_rule, rule] };
            region.annotations.rules_source = derivedRulesSource(region) ?? 'mixed';
            crossingCharged.push(`${c.from[0]}/${c.from[1]}`);
            note(`${c.from[0]}: ${c.from[1]} -> ${c.to.join('/')} CHARGED the L${arena.level} arena — ${arena.why} (${arena.cite})`);
        }
    }

    note(`igneous tiles: ruled OPEN everywhere — ${OV.IGNEOUS_IS_FREE.why} `
        + `(${OV.IGNEOUS_IS_FREE.cite}). ⛔ This REFUTES the level_76 Dark Suit row shipped at `
        + 'R7 §13.5; the refutation log carries it.');
}

const FIRE_RULE = { rule: 'Has', args: { item_name: 'Fire' } };
const WEAPON_RULE = {
    rule: 'Or',
    children: [
        { rule: 'Has', args: { item_name: 'Progressive Sword' } },
        { rule: 'Has', args: { item_name: 'Ghost Spear' } },
    ],
};
const DARKSUIT_RULE = { rule: 'Has', args: { item_name: 'Dark Suit' } };

/**
 * ⛔ THE POCKETS, PRUNED — and the bound NAMED rather than folded into the
 * green (`feedback_bounded_sweep_must_name_what_it_bounded`).
 *
 * A 4-connected flood over a 60x58 dungeon finds every walkable cluster,
 * including the one-tile nook behind a wall that no door reaches and nothing
 * stands in. The analyzer is right to find them and the atlas validator is
 * right to refuse them ("sub_region X is unreachable from any entry point") —
 * an AP region nothing can enter is not a place.
 *
 * So they are dropped HERE, deliberately, with two rules:
 *   - a pocket that hosts a LOCATION is never dropped. It is a target our logic
 *     cannot reach, which is a DEFECT IN THE LOGIC and gets said out loud
 *     (the user's standing instruction, §3.5) instead of being tidied away.
 *   - every drop is counted and the count is printed.
 */
function pruneUnreachableSubRegions(atlas, regionId) {
    const region = atlas.regions.find((r) => r.region_id === regionId);
    const subs = region.subgraph?.sub_regions;
    if (!subs) return;
    const rows = region.subgraph.internal_exits ?? [];
    const entries = new Set((region.exits ?? []).map((e) => e.sub_region).filter(Boolean));
    if (atlas.vanilla_layout?.start_region === regionId && atlas.vanilla_layout.start_sub_region) {
        entries.add(atlas.vanilla_layout.start_sub_region);
    }
    const out = new Map();
    for (const r of rows) {
        if (!out.has(r.from)) out.set(r.from, []);
        out.get(r.from).push(r.to);
        if (r.bidirectional === true) {
            if (!out.has(r.to)) out.set(r.to, []);
            out.get(r.to).push(r.from);
        }
    }
    const reachable = new Set(entries);
    const queue = [...entries];
    while (queue.length > 0) {
        for (const next of out.get(queue.pop()) ?? []) {
            if (reachable.has(next)) continue;
            reachable.add(next);
            queue.push(next);
        }
    }
    const held = new Set((region.locations ?? []).map((l) => l.sub_region).filter(Boolean));
    const dropped = subs.filter((s) => !reachable.has(s) && !held.has(s));
    const stranded = subs.filter((s) => !reachable.has(s) && held.has(s));
    for (const s of stranded) {
        note(`⛔ ${regionId}: sub-region "${s}" holds a LOCATION and NO entry point reaches it — `
            + 'a target unreachable in our logic is a defect in the logic, not a fact about the game');
    }
    if (dropped.length === 0) return;
    prunedPockets.push(...dropped.map((s) => `${regionId}/${s}`));
    const keep = new Set(subs.filter((s) => !dropped.includes(s)));
    region.subgraph.sub_regions = subs.filter((s) => keep.has(s));
    region.subgraph.internal_exits = rows.filter((r) => keep.has(r.from) && keep.has(r.to));
    if (region.subgraph.sub_regions.length <= 1) {
        delete region.subgraph;
        for (const e of region.exits ?? []) delete e.sub_region;
        for (const l of region.locations ?? []) delete l.sub_region;
        if (atlas.vanilla_layout?.start_region === regionId) delete atlas.vanilla_layout.start_sub_region;
    }
}

/** Every manual crossing the physics model settled (walkable or sealed). */
export const modelVerdicts = [];

/** Every pocket this run dropped, so the count is derived and never typed. */
export const prunedPockets = [];

/** Every region this run dropped for having no door at all. */
export const droppedRegions = [];

/** Every LavaTrap lift this run added, so the count is derived and never typed. */
export const lavaTrapLifts = [];

/** Every ledger location this run gave a guard rule (OV.LOCATION_GUARDS). */
export const locationGuards = [];

/**
 * Every exit or location whose tile is reachable only THROUGH gated crossing
 * material — the binding carries the component, the rules row does NOT carry
 * the gate. A named PERMISSIVENESS bound, counted rather than assumed.
 */
export const permissiveBindings = [];

/** Every exit this run CHARGED its approach cost to (applyCrossingCostToBindings). */
export const crossingCharged = [];

/** ⛓ RULES burnable-trees — every departure charged its OWN cell because it sits inside an item-gated solid. */
export const sealedDoorsCharged = [];

/** ⛓ RULES waterfall-door — every departure charged the direction gate every way onto its tile pays. */
export const directionalDoorsCharged = [];

/** ⛓ RULES obstacle-events — every departure charged the solids that alone open its model pocket. */
export const pocketDoorsCharged = [];
/** ⛓ RULES location-crossing — every LOCATION this run charged the item-gated solid it sits inside. */
export const sealedLocationsCharged = [];

/**
 * Every ARRIVAL exit standing on gated material whose approach cost was NOT
 * charged. The analyzer measures reach-TO, an arrival needs reach-FROM, and the
 * two differ across a one-way face — so this is the permissive side, counted.
 */
export const arrivalsUncharged = [];

/**
 * ⛓ RULES arrival-spawns — per region, per exit: "is this tile in the component the analyzer bound the exit
 * to?" (walkable in the transcription, same component). The approach cell of a door that cannot be stood on
 * must be on the door's own side, not across a wall in another sub-region.
 */
export const exitComponents = new Map();

function componentTestsFor(level, analysis) {
    const grid = gridFor(level);
    const { indexOf, components } = analysis.componentsResult;
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const byExit = new Map();
    for (const b of analysis.bindings) {
        if (b.kind !== 'exit') continue;
        const id = b.component?.id ?? null;
        byExit.set(b.id, ([tx, ty]) => {
            const gx = tx - ox;
            const gy = ty - oy;
            if (id === null || gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) return false;
            const c = indexOf[gy * grid.width + gx];
            return c >= 0 && components[c].id === id;
        });
    }
    return byExit;
}

/** ⛓ RULES obstacle-events — each region's analysis from the last `buildPlaythroughAtlas` (its components). */
const regionAnalyses = new Map();

/**
 * ⛓⛓ RULES obstacle-events — **THE SAVED OBSTACLES AS AP EVENTS** (`flashPanel/seedlingObstacleEvents.js`
 * holds the schema and the why). The rows are the fidelity ARRIVAL census over THESE rooms (the delivered
 * set), so the set is derived, never typed; this function answers the three atlas-side questions:
 *   - DEPARTURE: the landing's door is `out_<door>` in its own level, and the atlas must connect it to
 *     `in_L<from>_<door>` in the landing's level (else a refusal by name);
 *   - PLACE, the obstacle's OPEN side: the sub-regions touching the solid's footprint, less the pocket the
 *     back door (the landing level's door to `from`, the in-order way on) stands in — the side the player
 *     breaks it from before ever using the edge. One answer or a refusal by name; an unsplit level has one;
 *   - RULE: the solid's own crossing cost as this generator prices it (the transcription + the overlay), so
 *     the event costs what crossing the obstacle costs; none (a rock-placement puzzle) = True_.
 * Run after `buildPlaythroughAtlas(…)` on the document it returned.
 */
export function playthroughObstacleEvents(doc, { rows = arrivalSolidCensus(MAP, levelSourceFromAtlas(MAP)) } = {}) {
    const regionOf = (id) => doc.regions.find((r) => r.region_id === id);
    const conns = new Set((doc.vanilla_layout?.connections ?? [])
        .map((c) => `${c.from[0]}/${c.from[1]}>${c.to[0]}/${c.to[1]}`));
    const entityOf = (level, { cls, x, y }) => {
        const e = (level.entities ?? []).find((en) => en.type === cls && en.x === x && en.y === y);
        if (!e) throw new Error(`obstacle events: L${level.level} has no ${cls}@${x},${y}`);
        return e;
    };
    const rowOf = (entity, level) => {
        const base = SEM.entitySemantics(entity);
        return entityOverride(entity, base, level) ?? base;
    };
    return deriveObstacleEvents(rows, {
        departure: (L) => {
            const door = parseSolidId(L.door);
            const dep = { region_id: regionIdFor(L.from), exit_id: outExitId({ type: door.cls, x: door.x, y: door.y }) };
            const arr = `${regionIdFor(L.level)}/${inExitId(L.from, { x: door.x, y: door.y })}`;
            if (!conns.has(`${dep.region_id}/${dep.exit_id}>${arr}`)) {
                throw new Error(`obstacle events: the atlas has no connection ${dep.region_id}/${dep.exit_id} -> ${arr}`);
            }
            return dep;
        },
        place: (row, solid) => {
            const regionId = regionIdFor(row.flag.level);
            const region = regionOf(regionId);
            if (!region) throw new Error(`obstacle events: ${regionId} is not in the atlas`);
            const subs = region.subgraph?.sub_regions;
            if (!subs) return { region_id: regionId, side: apRegionName(regionId), across: [] };
            const level = levelOf(row.flag.level);
            const grid = gridFor(level);
            const analysis = regionAnalyses.get(regionId);
            const { indexOf, components } = analysis.componentsResult;
            const ox = grid.origin?.x ?? 0;
            const oy = grid.origin?.y ?? 0;
            const componentAt = ([x, y]) => {
                const gx = x - ox;
                const gy = y - oy;
                if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) return null;
                const i = indexOf[gy * grid.width + gx];
                return i >= 0 && subs.includes(components[i].id) ? components[i].id : null;
            };
            const entity = entityOf(level, solid);
            const tiles = SEM.entityClaims(entity, rowOf(entity, level), { pixelMaskFootprints: true }).map((c) => c.tile);
            const own = new Set(tiles.map(([x, y]) => `${x},${y}`));
            const touching = new Set();
            for (const [x, y] of tiles) {
                for (const n of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
                    if (own.has(`${n[0]},${n[1]}`)) continue;
                    const c = componentAt(n);
                    if (c) touching.add(c);
                }
            }
            const backDoors = (level.entities ?? []).filter((e) => LINK_TAGS.includes(e.type)
                && Number(e.attrs?.to) === row.landing.from).map((e) => outExitId(e));
            const behind = new Set(analysis.bindings.filter((b) => b.kind === 'exit' && backDoors.includes(b.id))
                .map((b) => b.component?.id).filter(Boolean));
            const open = [...touching].filter((c) => !behind.has(c));
            const side = open.length > 0 ? open : [...touching];
            if (side.length !== 1) {
                throw new Error(`obstacle events: ${row.solid} in ${regionId} has ${side.length} open side(s) `
                    + `[${side.join(', ')}] (touching [${[...touching].join(', ')}], back door pocket [${[...behind].join(', ')}])`);
            }
            return {
                region_id: regionId, sub_region: side[0], side: apRegionName(regionId, side[0]),
                across: [...touching].filter((c) => c !== side[0]).sort().map((c) => apRegionName(regionId, c)),
            };
        },
        rule: (row, solid) => {
            const level = levelOf(row.flag.level);
            const r = rowOf(entityOf(level, solid), level);
            if (r?.kind !== 'gated' || r.condition == null) return null;
            const rule = analyzerOptions.resolveCondition(r.condition);
            if (!rule) throw new Error(`obstacle events: ${row.solid}'s condition does not resolve to items`);
            return rule;
        },
    });
}

/**
 * ⛓⛓ RULES lock-events — **THE LATCHING LOCKS AS AP EVENTS** (`flashPanel/seedlingObstacleEvents.js`
 * `deriveLockEvents` holds the schema and the why). The rows are the analyzer's `latch_projection` from the
 * last `buildPlaythroughAtlas` (the internal exits whose rule changes when each latched cell is priced as its
 * lock's event), so the set is derived: a lock no return crosses mints nothing. This answers the atlas-side
 * questions:
 *   - PLACE: the ONE component the analyzer saw OPEN the lock (its `latches` openers; several = a refusal by
 *     name), and `across` = the other sub-regions its footprint touches;
 *   - RULE: Or over that opener's condition sets, resolved as every crossing is (the key, and whatever the
 *     step into the lock crossed);
 *   - ACTION: the census's `FLAG_ACTIONS` row for the class.
 * The atlas keeps RULES (A)'s rows; the compiler swaps them (`internalExitRules`, refused when a row moved).
 */
export function playthroughLockEvents(doc, { existing = [] } = {}) {
    const projection = [];
    for (const [regionId, analysis] of regionAnalyses) {
        for (const row of analysis.latch_projection ?? []) projection.push({ region_id: regionId, ...row });
    }
    const regionOf = (id) => doc.regions.find((r) => r.region_id === id);
    const locksOfRegion = (regionId) => latchLocksOf(levelOf(regionOf(regionId).map_ref));
    const tilesOf = (lock, regionId) => [...locksOfRegion(regionId)].filter(([, l]) => l === lock)
        .map(([k]) => k.split(',').map(Number));
    const openersOf = (lock, regionId) => tilesOf(lock, regionId)
        .flatMap(([x, y]) => regionAnalyses.get(regionId).latches?.get(`latch:${x},${y}`) ?? []);
    return deriveLockEvents(projection, {
        existing,
        lockOf: (name, regionId) => [...locksOfRegion(regionId).values()].find((l) => l.name === name),
        place: (lock, regionId) => {
            const region = regionOf(regionId);
            const subs = region.subgraph?.sub_regions ?? [];
            const from = [...new Set(openersOf(lock, regionId).map((o) => o.from))];
            if (from.length !== 1 || !subs.includes(from[0])) {
                throw new Error(`lock events: ${lock.name} in ${regionId} is opened from [${from.join(', ')}] — `
                    + `one sub-region of [${subs.join(', ')}] was expected`);
            }
            const { indexOf, components } = regionAnalyses.get(regionId).componentsResult;
            const grid = gridFor(levelOf(region.map_ref));
            const own = new Set(tilesOf(lock, regionId).map(([x, y]) => `${x},${y}`));
            const touching = new Set();
            for (const [x, y] of tilesOf(lock, regionId)) {
                for (const [nx, ny] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
                    if (own.has(`${nx},${ny}`) || nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
                    const i = indexOf[ny * grid.width + nx];
                    if (i >= 0 && subs.includes(components[i].id)) touching.add(components[i].id);
                }
            }
            return {
                region_id: regionId, sub_region: from[0], side: apRegionName(regionId, from[0]),
                across: [...touching].filter((c) => c !== from[0]).sort().map((c) => apRegionName(regionId, c)),
            };
        },
        rule: (lock, regionId) => {
            const ways = openersOf(lock, regionId).flatMap((o) => o.conditionSets).map((set) => {
                const parts = set.map((c) => analyzerOptions.resolveCondition(c));
                if (parts.some((p) => !p)) return null;
                return parts.length === 0 ? null : simplifyRule(parts.length === 1 ? parts[0] : { rule: 'And', children: parts });
            });
            if (ways.some((w) => w === null)) throw new Error(`lock events: ${lock.name}'s opening cost does not resolve to items`);
            return simplifyRule(ways.length === 1 ? ways[0] : { rule: 'Or', children: ways });
        },
        action: (cls) => ({ verb: FLAG_ACTIONS[cls]?.action ?? null, item: FLAG_ACTIONS[cls]?.item ?? null }),
    });
}

/**
 * ⛓⛓ RULES l38-button-event — **THE CROSS-ROOM BUTTON PRESSES AS AP EVENTS** (`flashPanel/seedlingObstacleEvents.js`
 * `deriveButtonEvents` holds the schema and the why). The rows are every cross-room `ButtonRoom` of the delivered
 * map (`crossRoomButtonsOf`), so the set is derived; this answers the atlas-side questions:
 *   - EFFECT: what a cleared tag does to the target, from the model's `PERSISTENCE_RESPONSE`;
 *   - PRICED BY THE BUTTON: the overlay rules the target FREE with the cross-level openers and NOT without them
 *     (`OV.lockRuling`'s cross-level arm) — the one ruling that assumed the press;
 *   - PLACE: the presser's sub-region (the component its tile is in; none = a refusal by name);
 *   - KILLS (RULES darktrap-events): a target solid in neither state whose clear removes other bodies — a model
 *     `LightPole` (`pressResponders`, as3 `LightPole`) not `invert`ed, whose light then reaches the level's census
 *     `DarkTrap`s (`poleLightReaches`). Those bodies are the barrier; `inRoom` is the pole's own arm
 *     (`POLE_LIGHT_ARM`: a Spear thrust), and every gate is `Or(<event>, <arm>)`;
 *   - GATES, measured on the physics model: for every game landing into the target's level, the box's flood with
 *     the barrier standing (the default build: the flag held — the target itself, or the killed bodies' contact
 *     rects, `modelFloodTiles`' `avoid`) against the level without it (the build once the flag is cleared). A
 *     landing whose standing flood is strictly smaller is CUT OFF by the barrier. The cut-off landings group into
 *     the barrier's SIDES (landings whose standing floods share a tile). A side is a POCKET when it holds no
 *     location and no kill-lock body, borders no item crossing (⛓ RULES l63-darktrap: a `gated`/`directional` cell
 *     is another way out), stays in one sub-region, and every door of it — the landings' departures and
 *     the `out_` exits standing in it — connects ONE outside AP region: then crossing the barrier is exactly
 *     entering or leaving the pocket (a round trip into a location-free dead end is the one walk the gate
 *     forbids that the game allows, and it gains nothing). Its doors cost the event. One side: it must be a pocket
 *     (L38's plug: the landing sealed in 2 tiles). Several sides (a darktrap cutting its room in two, both halves
 *     with landings): the pockets are gated and at least one side must not be one. Refused by name: one side that
 *     is not a pocket, several sides of which none or all are pockets (the crossing would be internal: an atlas
 *     split, not a gate), or a barrier that cuts off no landing.
 * The atlas carries NO event or gate (a rules-layer projection, as for the obstacle and lock events).
 */
export function playthroughButtonEvents(doc, { existing = [] } = {}) {
    const B = barrierAnalysis(doc);
    const { entityOf, killsOf } = B;
    const ruling = (t, crossLevelOpeners) => OV.overlayEntitySemantics(entityOf(t), SEM.entitySemantics(entityOf(t)), {
        level: t.level, crossLevelOpeners, groupOpeners: GROUP_OPENERS, scriptOpeners: SCRIPT_OPENERS, killLocks: KILL_LOCKS, blockHolders: BLOCK_HOLDERS,
    });
    return deriveButtonEvents(crossRoomButtonsOf(MAP), {
        existing,
        effect: (t) => persistenceEffect(t, PERSISTENCE_RESPONSE[t.type]),
        kills: (t) => {
            const k = killsOf(t);
            return k && { bodies: k.map((b) => b.id), why: B.killsWhy(k) };
        },
        inRoom: (t) => (killsOf(t) ? B.arm : null),
        pricedByButton: (t) => {
            const k = killsOf(t);
            if (k) {
                // The rules price a crossing through a body free when the overlay rules the body OPEN — then nothing
                // in the rules asks whether the pole was lit.
                // (The overlay answers only what it overrides; the rest is the base semantics.)
                const kinds = k.map((b) => {
                    const body = { level: t.level, type: b.type, x: b.x, y: b.y };
                    return (ruling(body, CROSS_LEVEL_OPENERS) ?? SEM.entitySemantics(entityOf(body)))?.kind ?? 'no ruling';
                });
                return { free: kinds.every((x) => x === 'open'), why: `the killed bodies are ruled [${kinds.join(', ')}]` };
            }
            const withButton = ruling(t, CROSS_LEVEL_OPENERS);
            const without = ruling(t, new Set());
            return {
                free: withButton?.kind === 'open' && without?.kind !== 'open',
                why: `with the button: ${withButton?.kind ?? 'no ruling'}; without: ${without?.kind ?? 'no ruling'}`,
            };
        },
        place: (p) => {
            const regionId = regionIdFor(p.level);
            const region = B.regionOf(regionId);
            if (!region) throw new Error(`button events: ${regionId} is not in the atlas`);
            const subs = region.subgraph?.sub_regions;
            if (!subs) return { region_id: regionId, side: apRegionName(regionId) };
            const c = B.subRegionAt(regionId, p.level, B.tileOf(p));
            if (!c || !subs.includes(c)) {
                throw new Error(`button events: L${p.level} buttonroom@${p.x},${p.y} stands in no sub-region of ${regionId} `
                    + `(tile [${B.tileOf(p)}]) — where the event sits cannot be said`);
            }
            return { region_id: regionId, sub_region: c, side: apRegionName(regionId, c) };
        },
        // ButtonRoom.update: any body on it presses it — standing in its sub-region is the whole cost.
        reach: () => null,
        // A pole's doors carry their `arm` (⛓ RULES l63-darktrap: the Spear way only where a stance stands).
        gates: (t, eventName) => B.barrierCut(t, eventName).pockets.flatMap((v) => v.doors),
    });
}

/**
 * ⛓⛓ RULES l63-darktrap — **THE POLES ONLY THE ROOM'S OWN SPEAR LIGHTS, AS AP EVENTS** (`flashPanel/seedlingObstacleEvents.js`
 * `deriveInRoomPoleEvents` holds the schema and the why). The rows are `inRoomPolesOf(MAP)`; the barrier, its sides
 * and pockets are the cross-room presses' (`barrierAnalysis`), and the stances decide the rest:
 *   - GATES: each pocket's doors, a door INTO the pocket with the arm when the pocket holds a stance, a door OUT of it
 *     (reached by crossing from the far side) with the arm when the far side does — ⛓ RULES l63-pole-crossings: and
 *     with the Ghost Sword swing's arm (`POLE_GHOST_ARM`) when that side holds no thrust stance but a swing one;
 *   - PLACE: where a stance stands, in this order — the far side's sub-region when the far side holds one (the pocket
 *     is entered from outside only with the event, so the event is lit from beyond the barrier); else a stance on
 *     NEITHER side, elsewhere in the room (L101's pole is lit through a wall from its r4c2 column — the vanilla
 *     route to L109); else the pocket's ONE outside sub-region, whose door is the only way to the pocket's stance
 *     (placing it in the pocket's own sub-region would let the far side, which holds no stance, collect it). ONE
 *     place: a stance in another sub-region is a way the rules drop, never one they add (the safe direction).
 *     REACH = the arm. Refused by name: no stance anywhere, pockets that disagree on the place, or stances of one
 *     rank spanning sub-regions.
 * The atlas carries NO event or gate.
 */
export function playthroughInRoomPoleEvents(doc, { existing = [] } = {}) {
    const B = barrierAnalysis(doc);
    return deriveInRoomPoleEvents(inRoomPolesOf(MAP), {
        existing,
        kills: (p) => {
            const k = B.killsOf(p);
            return k && { bodies: k.map((b) => b.id), why: B.killsWhy(k) };
        },
        arm: B.arm,
        action: { verb: POLE_LIGHT_ARM.verb, item: POLE_LIGHT_ARM.item },
        cut: (p, eventName) => {
            const { pockets } = B.barrierCut(p, eventName);
            const places = pockets.map((v) => {
                const regionId = regionIdFor(p.level);
                for (const [subs, where] of [[v.farStanceSubs, 'beyond the barrier'], [v.elsewhereSubs, 'on neither side of it']]) {
                    if (subs.length > 1) {
                        throw new Error(`in-room pole events: ${eventName}'s stances ${where} span sub-regions `
                            + `[${subs.join(', ')}] — where the event sits cannot be said`);
                    }
                    if (subs.length === 1) return { region_id: regionId, sub_region: subs[0], side: apRegionName(regionId, subs[0]) };
                }
                if (v.pocketStances.length === 0) {
                    throw new Error(`in-room pole events: ${eventName} — no tile of its room is a stance `
                        + '(no Spear thrust reaches the pole), so nothing lights it');
                }
                const outside = v.outsideSubs;
                if (outside.length !== 1) {
                    throw new Error(`in-room pole events: ${eventName}'s pocket opens on [${outside.map((o) => o.side).join(', ')}], `
                        + 'not one outside sub-region — where the event sits cannot be said');
                }
                return outside[0];
            });
            const keyOf = (x) => `${x.region_id}|${x.sub_region ?? ''}`;
            if (new Set(places.map(keyOf)).size !== 1) {
                throw new Error(`in-room pole events: ${eventName}'s pockets disagree on where it is lit `
                    + `[${places.map((x) => x.side).join(', ')}]`);
            }
            return { place: places[0], reach: B.arm, gates: pockets.flatMap((v) => v.doors) };
        },
    });
}

/**
 * ⛓⛓ RULES l63-pole-crossings — **A STRUCK BLOCK'S CROSSING, PRICED BY ITS PUSH PATHS.** The transcription claims a
 * fire/spear block's start cell as a crossing gated on its push item; the analyzer joins the sub-regions on either side
 * with that item and nothing else. `seedlingBlockPaths.blockCrossingCost` holds the model and the why: a block stops at
 * a body that never moves and cannot be killed by a hit (the model's combat rows: `aggro.kind` static, `speed` 0, `kill`
 * null — a DarkTrap), so a crossing whose only way pushes the block onto one needs that body GONE, which only the light
 * of a pole that kills it does (`poleKillsOf`): that pole's event. Per pushable whose start cell borders two
 * sub-regions, per direction of the atlas row between them, the Pareto-minimal stopper sets the crossing needs; a
 * direction that needs one is gated `Or` over them (`internalExitGates`, ANDed onto that one direction by the compiler,
 * so the atlas row is not edited). The stances are the push action's weapon footprint (`deriveWeaponFootprint`); a
 * walk-in block (no item) claims no crossing and is not read, and a room with no stopper is left to the claim (named).
 * Refused by name: a row between the two sides whose rule is not the push item's (another crossing joins them too),
 * a stopper whose body is not one tile, and a direction no stopper set opens (the model and the analyzer disagree).
 */
export function playthroughBlockCrossings(doc, { events = [] } = {}) {
    const minted = new Set(events.map((e) => e.name));
    const internalExitGates = [];
    const notes = [];
    const key = ([x, y]) => `${x},${y}`;
    for (const level of MAP.levels) {
        const pushables = (level.entities ?? []).filter((e) => PUSHABLE_KINDS[e.type]?.push);
        if (pushables.length === 0) continue;
        const regionId = regionIdFor(level.level);
        const region = doc.regions.find((r) => r.region_id === regionId);
        const analysis = regionAnalyses.get(regionId);
        if (!region?.subgraph?.sub_regions || !analysis) continue;
        const grid = gridFor(level);
        if ((grid.origin?.x ?? 0) !== 0 || (grid.origin?.y ?? 0) !== 0) throw new Error(`block crossings: L${level.level}'s grid is not whole-level`);
        const { indexOf, components } = analysis.componentsResult;
        const subOf = (i) => (indexOf[i] >= 0 && region.subgraph.sub_regions.includes(components[indexOf[i]].id) ? components[indexOf[i]].id : null);
        const tileTypes = new Map();
        for (const layer of level.layers ?? []) {
            if (layer.name === 'cliffsides') continue;
            for (const placement of layer.tiles ?? []) {
                const t = SEM.tileTypeForPlacement(placement);
                if (t !== null) tileTypes.set(placement[1] * grid.width + placement[0], t);
            }
        }
        // The stoppers: static, unkillable bodies, each removed by the events of the poles whose light kills it.
        const poles = (level.entities ?? []).filter((e) => e.type === 'lightpole');
        const kills = poles.map((p) => ({ pole: p, bodies: poleKillsOf(level, p, { buildLevelWorld, combatCensusOf, contactRect, DARKTRAP_LIGHT_DEATH }) ?? [] }));
        const stoppers = combatCensusOf(level).enemies.filter((e) => e.row?.aggro?.kind === 'static' && e.row?.speed === 0 && e.row?.kill === null)
            .map((e) => {
                const r = contactRect(e);
                const [tx, ty] = [r.x / TILE, r.y / TILE];
                if (!Number.isInteger(tx) || !Number.isInteger(ty) || r.w !== TILE || r.h !== TILE) {
                    throw new Error(`block crossings: L${level.level} ${e.tag}@${e.x},${e.y}'s body ${JSON.stringify(r)} is not one tile`);
                }
                const keys = kills.filter((k) => k.bodies.some((b) => b.id === `${e.tag}@${e.x},${e.y}`))
                    .map((k) => obstacleEventName({ level: level.level, tag: Number(k.pole.attrs?.tag), cls: k.pole.type, x: k.pole.x, y: k.pole.y }))
                    .filter((n) => minted.has(n));
                return { tx, ty, keys, label: `${e.tag}@${e.x},${e.y}` };
            });
        // No stopper in the room: the transcription's claim is all a push could cost here (this derivation adds nothing).
        if (stoppers.length === 0) { notes.push(`L${level.level}: ${pushables.length} struck block(s), no stopper`); continue; }
        for (const b of pushables) {
            const [bx, by] = [Math.floor(b.x / TILE), Math.floor(b.y / TILE)];
            const at = by * grid.width + bx;
            const label = `L${level.level} ${b.type}@${b.x},${b.y}`;
            const pushFlag = PUSHABLE_KINDS[b.type].push;
            const pushRule = analyzerOptions.resolveCondition(SEM.flag(pushFlag));
            const fp = deriveWeaponFootprint(pushFlag.replace(/^has/, '').toLowerCase(), 'block');
            const sides = new Map();
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const [nx, ny] = [bx + dx, by + dy];
                if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
                const sub = subOf(ny * grid.width + nx);
                if (sub && !sides.has(sub)) sides.set(sub, ny * grid.width + nx);
            }
            if (sides.size < 2) { notes.push(`${label}: its cell borders ${sides.size} sub-region(s) — no crossing`); continue; }
            for (const [from, start] of sides) {
                for (const to of sides.keys()) {
                    if (to === from) continue;
                    const row = region.subgraph.internal_exits.find((r) => (r.from === from && r.to === to) || (r.bidirectional && r.from === to && r.to === from));
                    if (!row) { notes.push(`${label}: no internal exit ${from} -> ${to}`); continue; }
                    if (JSON.stringify(row.access_rule) !== JSON.stringify(pushRule)) {
                        throw new Error(`block crossings: ${label}'s crossing ${regionId} ${from} -> ${to} is priced `
                            + `${JSON.stringify(row.access_rule)}, not its push item's ${JSON.stringify(pushRule)} — another crossing joins the sides`);
                    }
                    const goal = new Set();
                    for (let i = 0; i < indexOf.length; i += 1) if (subOf(i) === to) goal.add(i);
                    const cost = blockCrossingCost(grid, {
                        block: { tx: bx, ty: by, condition: SEM.flag(pushFlag) }, stances: fp, stoppers, tileTypes,
                        keyOf: SEM.conditionKey, held: [SEM.conditionKey(SEM.flag(pushFlag))],
                    }, start, goal);
                    if (cost.refused) throw new Error(`block crossings: ${label} ${from} -> ${to}: ${cost.refused}`);
                    if (cost.sets.length === 0) {
                        throw new Error(`block crossings: ${label} ${from} -> ${to}: no stopper set opens the crossing the analyzer `
                            + `prices ${JSON.stringify(pushRule)} — the push model and the analyzer disagree`);
                    }
                    if (cost.sets.some((set) => set.length === 0)) { notes.push(`${label}: ${from} -> ${to} free beyond the push item`); continue; }
                    const ways = cost.sets.map((set) => simplifyRule(set.length === 1 ? { rule: 'Has', args: { item_name: set[0] } }
                        : { rule: 'And', children: set.map((n) => ({ rule: 'Has', args: { item_name: n } })) }));
                    const rule = ways.length === 1 ? ways[0] : { rule: 'Or', children: ways };
                    const named = new Set(cost.sets.flat());
                    const why = `${label}: pushed from ${from} it stops at ${stoppers.filter((st) => st.keys.some((k) => named.has(k))).map((st) => st.label).join(', ')} unless `
                        + `${cost.sets.map((set) => set.join(' + ')).join(' OR ')}`;
                    internalExitGates.push({ region_id: regionId, from, to, rule, why });
                    notes.push(why);
                }
            }
        }
    }
    return { internalExitGates, notes };
}

/**
 * ⛓ The barrier analysis the cross-room presses and the in-room poles share: the atlas lookups, the bodies a pole's
 * light kills (`poleKillsOf`) and `barrierCut` — the GATES measurement of `playthroughButtonEvents`' doc (the
 * landings a barrier cuts off, their SIDES and POCKETS), each pocket with its DOORS (`{region_id, exit_id, arm}`) and,
 * for a pole, its STANCES (`poleThrustStances`): those in the pocket, those beyond the barrier (the tiles the
 * pocket's landings reach once it is cleared and not before), and the sub-regions they stand in.
 */
function barrierAnalysis(doc) {
    const regionOf = (id) => doc.regions.find((r) => r.region_id === id);
    const conns = (doc.vanilla_layout?.connections ?? []);
    const entityOf = (t) => {
        const e = (levelOf(t.level)?.entities ?? []).find((x) => x.type === t.type && x.x === t.x && x.y === t.y);
        if (!e) throw new Error(`button events: L${t.level} has no ${t.type}@${t.x},${t.y}`);
        return e;
    };
    const tileOf = ({ x, y }) => [Math.floor(x / TILE), Math.floor(y / TILE)];
    const key = ([x, y]) => `${x},${y}`;
    /** The analyzer's sub-region holding a level tile, or null (a cell no component holds). */
    const subRegionAt = (regionId, n, [x, y]) => {
        const grid = gridFor(levelOf(n));
        const { indexOf, components } = regionAnalyses.get(regionId).componentsResult;
        const gx = x - (grid.origin?.x ?? 0);
        const gy = y - (grid.origin?.y ?? 0);
        const i = gx >= 0 && gy >= 0 && gx < grid.width && gy < grid.height ? indexOf[gy * grid.width + gx] : -1;
        return i >= 0 ? components[i].id : null;
    };
    // ⛓ darktrap-events: the bodies a cleared target removes besides itself (a lit pole's darktraps), from the
    // model's own rows: its press responders (which entity is a `LightPole`) and its combat census (the bodies,
    // their centres and contact rects). null = the target removes nothing but itself.
    const killsOf = (t) => poleKillsOf(levelOf(t.level), t, { buildLevelWorld, combatCensusOf, contactRect, DARKTRAP_LIGHT_DEATH });
    const killsWhy = (k) => `lit, its light reaches ${k.map((b) => `${b.id} (${b.min.toFixed(1)}–${b.max.toFixed(1)} px)`).join(', ')} `
        + `within \`radiusMin\` ${DARKTRAP_LIGHT_DEATH.pole.radiusMin}: DarkTrap.update kills them`;
    const arm = analyzerOptions.resolveCondition(SEM.flag(POLE_LIGHT_ARM.item));
    const ghostArm = analyzerOptions.resolveCondition(SEM.flag(POLE_GHOST_ARM.item));
    const barrierCut = (t, eventName) => {
        const level = levelOf(t.level);
        const killed = killsOf(t);
        const regionId = regionIdFor(t.level);
        const region = regionOf(regionId);
        // The flood enters only the cells the analyzer walks for FREE — `open`, and `manual` (a blocker the
        // transcription leaves to the model, which is what this flood asks). A `gated`/`directional` cell is an
        // item's crossing the rules price themselves, and a `sink` is a pit drop, so the flood measures the
        // barrier and nothing else (L63's halves would otherwise join across its Spear-gated cells, and L62's
        // across the pit corners its darktrap sits between).
        const grid = gridFor(level);
        const all = (tx, ty) => {
            const gx = tx - (grid.origin?.x ?? 0);
            const gy = ty - (grid.origin?.y ?? 0);
            const kind = gx >= 0 && gy >= 0 && gx < grid.width && gy < grid.height ? grid.cells[gy * grid.width + gx]?.kind : null;
            return kind === 'open' || kind === 'manual';
        };
        const standing = killed
            ? (seeds) => modelFloodTiles(level, seeds, all, { avoid: killed.map((b) => b.rect) })
            : (seeds) => modelFloodTiles(level, seeds, all);
        const without = killed ? level : { ...level, entities: level.entities.filter((e) => e !== entityOf(t)) };
        // ⛓ RULES l63-darktrap: where the pole's own Spear way can be taken from (a pole only; none otherwise).
        const pole = killed
            ? buildLevelWorld(level).pressResponders.find((r) => r.as3 === 'LightPole' && r.x === t.x && r.y === t.y) : null;
        const stances = pole ? poleThrustStances(pole.rect, {
            width: grid.width, height: grid.height, origin: grid.origin, tile: TILE, walkable: all,
            avoid: killed.map((b) => b.rect), spearHitRect, pressRectTouches, rectsOverlap,
        }) : [];
        // ⛓ RULES l63-pole-crossings: the Ghost Sword swing's stances (`POLE_GHOST_ARM`), for a side no thrust reaches.
        const swings = pole ? poleSwingStances(pole.rect, {
            width: grid.width, height: grid.height, origin: grid.origin, tile: TILE, walkable: all,
            avoid: killed.map((b) => b.rect), swingHits, rectsOverlap,
        }) : [];
        const cut = [];
        for (const L of gameLandings(MAP).filter((g) => g.level === t.level)) {
            const held = standing([tileOf(L)]);
            const cleared = modelFloodTiles(without, [tileOf(L)], all);
            if (held.length >= cleared.length) continue;
            const door = parseSolidId(L.door);
            const dep = { region_id: regionIdFor(L.from), exit_id: outExitId({ type: door.cls, x: door.x, y: door.y }) };
            if (!conns.some((c) => c.from[0] === dep.region_id && c.from[1] === dep.exit_id && c.to[0] === regionId)) {
                throw new Error(`button events: the atlas has no connection ${dep.region_id}/${dep.exit_id} -> ${regionId} for ${eventName}`);
            }
            const tiles = new Set(held.map(key));
            cut.push({ dep, tiles, beyond: new Set(cleared.map(key).filter((k) => !tiles.has(k))) });
        }
        if (cut.length === 0) {
            throw new Error(`button events: ${eventName} cuts off no landing of L${t.level} on the model — its crossing would be `
                + 'internal to the region (an atlas split, not a gate)');
        }
        // The SIDES: cut-off landings whose standing floods share a tile.
        const sides = [];
        for (const c of cut) {
            const joined = sides.filter((sd) => [...c.tiles].some((k) => sd.tiles.has(k)));
            const merged = {
                deps: [c.dep, ...joined.flatMap((sd) => sd.deps)],
                tiles: new Set([...c.tiles, ...joined.flatMap((sd) => [...sd.tiles])]),
                beyond: new Set([...c.beyond, ...joined.flatMap((sd) => [...sd.beyond])]),
            };
            for (const sd of joined) sides.splice(sides.indexOf(sd), 1);
            sides.push(merged);
        }
        const verdicts = sides.map((sd) => {
            const has = (tile) => sd.tiles.has(key(tile));
            const exits = (region.exits ?? []).filter((e) => e.exit_id.startsWith('out_') && has(e.entrance_tile))
                .map((e) => ({ region_id: regionId, exit_id: e.exit_id,
                    to: conns.find((c) => c.from[0] === regionId && c.from[1] === e.exit_id)?.to[0] ?? null }));
            const outside = [...new Set([...sd.deps.map((d) => d.region_id), ...exits.map((e) => e.to)])];
            const subs = region.subgraph?.sub_regions
                ? [...new Set([...sd.tiles].map((k) => subRegionAt(regionId, t.level, k.split(',').map(Number))).filter(Boolean))] : [];
            // ⛓ RULES l63-darktrap: an item crossing bordering the side (a `gated`/`directional` cell, which the
            // flood does not enter) is another way out of it — the side is no dead end (L63's darktrap@32,272 cuts
            // its column below the Spear bridge [2,9]: the half with the bridge is not a pocket).
            const crossings = [...new Set([...sd.tiles].flatMap((k) => {
                const [x, y] = k.split(',').map(Number);
                return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => {
                    const gx = nx - (grid.origin?.x ?? 0);
                    const gy = ny - (grid.origin?.y ?? 0);
                    const kind = gx >= 0 && gy >= 0 && gx < grid.width && gy < grid.height ? grid.cells[gy * grid.width + gx]?.kind : null;
                    return kind === 'gated' || kind === 'directional';
                }).map(key);
            }))];
            const why = [
                ...(region.locations ?? []).filter((loc) => has(loc.tile)).map((loc) => `holds "${loc.name}"`),
                ...(crossings.length ? [`it borders the item crossing(s) [${crossings.join('; ')}]`] : []),
                ...(KILL_LOCKS.get(t.level)?.bodies ?? []).filter((b) => has(tileOf(parseSolidId(b.at)))).map((b) => `holds kill-lock body ${b.at}`),
                ...(outside.length !== 1 ? [`its doors connect [${outside.join(', ')}], not one region`] : []),
                ...(subs.length > 1 ? [`it spans sub-regions [${subs.join(', ')}]`] : []),
            ];
            return { side: sd, exits, outside, why };
        });
        const name = (v) => `the side of [${v.side.deps.map((d) => `${d.region_id}/${d.exit_id}`).join(', ')}]`;
        const pockets = verdicts.filter((v) => v.why.length === 0);
        if (sides.length === 1 && pockets.length === 0) {
            throw new Error(`button events: ${eventName} cuts off ${name(verdicts[0])}, which is not a pocket — `
                + `${verdicts[0].why.join('; ')}`);
        }
        if (sides.length > 1 && (pockets.length === 0 || pockets.length === sides.length)) {
            throw new Error(`button events: ${eventName} cuts L${t.level} into ${sides.length} sides and `
                + `${pockets.length === 0 ? 'none' : 'every one'} of them is a pocket (${verdicts.map((v) => `${name(v)}: `
                + `${v.why.join('; ') || 'pocket'}`).join(' · ')}) — the crossing is internal: an atlas split, not a gate`);
        }
        return {
            pockets: pockets.map((v) => {
                const pocketStances = stances.filter((st) => v.side.tiles.has(key(st.tile)));
                const farStances = stances.filter((st) => v.side.beyond.has(key(st.tile)));
                // A stance on neither side: the pole is lit from somewhere else in its room (L101's [7,4], a thrust E
                // through the wall [8,4] — `collideRectInto` tests no Solid between — from the r4c2 column).
                const elsewhere = stances.filter((st) => !v.side.tiles.has(key(st.tile)) && !v.side.beyond.has(key(st.tile)));
                // A door INTO the pocket leads to its crossing from inside; a door OUT of it was reached by crossing
                // from beyond. A target that is not a pole has no arm to place (`arm` stays unsaid).
                // ⛓ RULES l63-pole-crossings: a side with no thrust stance but a Ghost Sword swing stance takes the swing's arm.
                const onPocket = (st) => v.side.tiles.has(key(st.tile));
                const onFar = (st) => v.side.beyond.has(key(st.tile));
                const arm = (here, on) => (!pole ? {} : here.length > 0 ? { arm: true }
                    : swings.some(on) ? { arm: true, armRule: ghostArm } : { arm: false });
                return {
                    doors: [
                        ...v.side.deps.map((d) => ({ ...d, ...arm(pocketStances, onPocket) })),
                        ...v.exits.map((e) => ({ region_id: e.region_id, exit_id: e.exit_id, ...arm(farStances, onFar) })),
                    ],
                    pocketStances,
                    farStances,
                    farStanceSubs: [...new Set(farStances.map((st) => subRegionAt(regionId, t.level, st.tile)).filter(Boolean))],
                    elsewhereSubs: [...new Set(elsewhere.map((st) => subRegionAt(regionId, t.level, st.tile)).filter(Boolean))],
                    outsideSubs: [...new Map(v.side.deps.map((d) => {
                        const exit = regionOf(d.region_id)?.exits?.find((e) => e.exit_id === d.exit_id);
                        const sub = exit?.sub_region;
                        const place = { region_id: d.region_id, ...(sub === undefined ? {} : { sub_region: sub }), side: apRegionName(d.region_id, sub) };
                        return [`${place.region_id}|${sub ?? ''}`, place];
                    })).values()],
                };
            }),
        };
    };
    return { regionOf, conns, entityOf, tileOf, key, subRegionAt, killsOf, killsWhy, arm, barrierCut };
}

/**
 * ⛓⛓ RULES watcher-event — **THE CROSS-ROOM PREREQUISITES AS AP EVENTS** (`flashPanel/seedlingObstacleEvents.js`
 * `deriveTalkEvents` holds the schema and the why). The rows are the overlay's `CROSS_ROOM_PREREQUISITES` read
 * against the delivered map and the vanilla set's named rooms (`crossRoomPrerequisitesOf`), so the writer, its room
 * and the gated solids are derived; this answers the atlas-side questions:
 *   - PLACE: the writer's sub-region (the component its tile is in; none = a refusal by name);
 *   - REACH: True_ — a speaking Watcher opens its dialogue on entering its circle, with nothing held
 *     (`keyNeeded = !checkPersistence(tag)`, false until the talk); the L58 Yeti (⛓ RULES yeti-event) on the talk
 *     key inside the same circle (`NPC.keyNeeded` stays true), still with nothing held;
 *   - GATES: every departure of the gated solid's region whose entrance tile lies ON the solid's sealed footprint
 *     (the FinalDoor's two teleporters to L115 stand on its cells; the Yeti's tag-1 portal IS its own footprint)
 *     — a crossing there passes through the solid.
 * The atlas carries NO event or gate (a rules-layer projection, as for the other events).
 */
export function playthroughTalkEvents(doc, { existing = [] } = {}) {
    const regionOf = (id) => doc.regions.find((r) => r.region_id === id);
    const tileOf = ({ x, y }) => [Math.floor(x / TILE), Math.floor(y / TILE)];
    return deriveTalkEvents(crossRoomPrerequisitesOf(MAP, OV.CROSS_ROOM_PREREQUISITES, VANILLA_NAMED_ROOMS), {
        existing,
        place: (w) => {
            const regionId = regionIdFor(w.level);
            const region = regionOf(regionId);
            if (!region) throw new Error(`talk events: ${regionId} is not in the atlas`);
            const subs = region.subgraph?.sub_regions;
            if (!subs) return { region_id: regionId, side: apRegionName(regionId) };
            const grid = gridFor(levelOf(w.level));
            const { indexOf, components } = regionAnalyses.get(regionId).componentsResult;
            const [x, y] = tileOf(w);
            const gx = x - (grid.origin?.x ?? 0);
            const gy = y - (grid.origin?.y ?? 0);
            const i = gx >= 0 && gy >= 0 && gx < grid.width && gy < grid.height ? indexOf[gy * grid.width + gx] : -1;
            const c = i >= 0 ? components[i].id : null;
            if (!c || !subs.includes(c)) {
                throw new Error(`talk events: L${w.level} ${w.type}@${w.x},${w.y} stands in no sub-region of ${regionId} `
                    + `(tile [${x},${y}]) — where the event sits cannot be said`);
            }
            return { region_id: regionId, sub_region: c, side: apRegionName(regionId, c) };
        },
        reach: () => null,
        gates: (g) => {
            const level = levelOf(g.level);
            const entity = (level?.entities ?? []).find((e) => e.type === g.type && e.x === g.x && e.y === g.y);
            if (!entity) throw new Error(`talk events: L${g.level} has no ${g.type}@${g.x},${g.y}`);
            const base = SEM.entitySemantics(entity);
            const footprint = new Set(SEM.entityClaims(entity, entityOverride(entity, base, level) ?? base, { pixelMaskFootprints: true }).map((c) => c.tile)
                .map(([x, y]) => `${x},${y}`));
            const regionId = regionIdFor(g.level);
            return (regionOf(regionId)?.exits ?? [])
                .filter((e) => e.exit_id.startsWith('out_') && e.entrance_tile && footprint.has(`${e.entrance_tile[0]},${e.entrance_tile[1]}`))
                .map((e) => ({ region_id: regionId, exit_id: e.exit_id }));
        },
    });
}

/**
 * ⛓⛓ RULES rope-events — **THE ROPE CUTS AS AP EVENTS** (`flashPanel/seedlingObstacleEvents.js` `deriveRopeEvents`
 * holds the schema and the why). The rows are every rope of the delivered map (`ROPES`), so the set is derived. The
 * GATES are not here: the analyzer prices them, since a minted rope's silenced lanes are charged its event in the grid
 * (`gridFor`) and its rock on a holder is a block-path holder through the event (`OV.buildBlockHolders`). This answers:
 *   - PLACE: the ONE sub-region the rope's own tile borders (several or none = a refusal by name);
 *   - RULE: the rope's own cut condition (`SEM.entitySemantics`'s rope row), resolved as every crossing is.
 * One gate IS here: a game LANDING on a charged lane cell (or a door the lane leaves open) stands in the armed lane on
 * arrival, so its departure costs the cut too (`exitGates`, as a landing inside an obstacle costs its event) — ⚖ the
 * user 2026-10-21: logic never expects tanking a hit. (L17's stairs land on L16's (7,3), in `arrowtrap@112,32`'s lane.)
 * Refused ropes are printed by name; a rope event NAME in the rules that this mints nowhere is refused (`main`).
 *
 * `place` (optional) answers PLACE without this run's analysis (`regionAnalyses`, filled by `buildPlaythroughAtlas`):
 * the maze preset (`make-seedling-playthrough-maze.mjs`, session tile-primitives-arrow-rope) places the rope by the
 * atlas's PERSISTED partition instead — the same rule, the one sub-region the rope's tile borders.
 */
export function playthroughRopeEvents(doc, { place = null } = {}) {
    const regionOf = (id) => doc.regions.find((r) => r.region_id === id);
    const conns = doc.vanilla_layout?.connections ?? [];
    const derived = deriveRopeEvents(ROPES, {
        level: (n) => levelOf(n),
        place: place ?? ((row) => {
            const regionId = regionIdFor(row.level);
            const region = regionOf(regionId);
            if (!region) throw new Error(`rope events: ${regionId} is not in the atlas`);
            const subs = region.subgraph?.sub_regions;
            if (!subs) return { region_id: regionId, side: apRegionName(regionId) };
            const grid = gridFor(levelOf(row.level));
            const { indexOf, components } = regionAnalyses.get(regionId).componentsResult;
            const [x, y] = [Math.floor(row.x / TILE), Math.floor(row.y / TILE)];
            const beside = new Set();
            for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
                if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
                const i = indexOf[ny * grid.width + nx];
                if (i >= 0 && subs.includes(components[i].id)) beside.add(components[i].id);
            }
            if (beside.size !== 1) {
                throw new Error(`rope events: L${row.level} rope@${row.x},${row.y} borders sub-regions [${[...beside].join(', ')}] of `
                    + `${regionId} — one was expected`);
            }
            const [c] = beside;
            return { region_id: regionId, sub_region: c, side: apRegionName(regionId, c) };
        }),
        rule: (row) => {
            const entity = levelOf(row.level).entities.find((e) => e.type === 'rope' && e.x === row.x && e.y === row.y);
            const rule = analyzerOptions.resolveCondition(SEM.entitySemantics(entity)?.condition);
            if (!rule) throw new Error(`rope events: L${row.level} rope@${row.x},${row.y}'s cut does not resolve to items`);
            return rule;
        },
    });
    const exitGates = [];
    for (const row of derived.minted) {
        const level = levelOf(row.level);
        const lane = new Set(ropeChargesFor(level, gridFor(level, {})).filter((c) => c.condition.event === ropeEventName(row))
            .map((c) => `${c.tile[0]},${c.tile[1]}`));
        for (const L of gameLandings(MAP).filter((g) => g.level === row.level)) {
            if (!lane.has(`${Math.floor(L.x / TILE)},${Math.floor(L.y / TILE)}`)) continue;
            const door = parseSolidId(L.door);
            const dep = { region_id: regionIdFor(L.from), exit_id: outExitId({ type: door.cls, x: door.x, y: door.y }) };
            if (!conns.some((c) => c.from[0] === dep.region_id && c.from[1] === dep.exit_id)) {
                throw new Error(`rope events: the atlas has no connection ${dep.region_id}/${dep.exit_id} for L${L.from} ${L.door}`);
            }
            exitGates.push({ ...dep, rule: { rule: 'Has', args: { item_name: ropeEventName(row) } } });
        }
    }
    return { ...derived, exitGates };
}

/** `events` with each `eventGates` row's `Has(<item_name>)` ANDed onto its event's access rule (a new object; none = as is). */
export function withEventGates(events, eventGates) {
    return events.map((e) => {
        const has = eventGates.filter((g) => g.event_id === e.fields.event_id)
            .map((g) => ({ rule: 'Has', args: { item_name: g.item_name } }));
        if (has.length === 0) return e;
        const children = [...(e.access_rule ? [e.access_rule] : []), ...has];
        return { ...e, access_rule: children.length === 1 ? children[0] : { rule: 'And', children } };
    });
}

/**
 * ⛓ THE EVENT LAYER (session tile-primitives-events-as-locations, ⚖ 2026-10-23 "Extract one producer fn") — the
 * obstacle, lock, button and talk events of `doc`, in the order each derivation needs the ones before it, with the
 * exit gates and internal exit rules they bring. ONE function, so this producer's compile and the maze preset's
 * (`make-seedling-playthrough-maze.mjs`) read the same events in the same order. Ropes and landing gates are not in
 * it: each caller places those itself. Run after `buildPlaythroughAtlas(…)` on the document it returned, and after
 * `setPlaythroughLandingAtlas(doc)`.
 */
export function playthroughEventLayer(doc) {
    const obstacle = playthroughObstacleEvents(doc);
    const locks = playthroughLockEvents(doc, { existing: obstacle.events });
    const buttons = playthroughButtonEvents(doc, { existing: [...obstacle.events, ...locks.events] });
    // ⛓ RULES l63-darktrap: the poles only their own room's Spear lights.
    const poles = playthroughInRoomPoleEvents(doc, { existing: [...obstacle.events, ...locks.events, ...buttons.events] });
    // ⛓ RULES watcher-event: the gated solid's OWN event needs the prerequisite too (its flag cannot clear first).
    const talks = playthroughTalkEvents(doc, { existing: [...obstacle.events, ...locks.events, ...buttons.events, ...poles.events] });
    const priorEvents = withEventGates([...obstacle.events, ...locks.events, ...buttons.events, ...poles.events], talks.eventGates);
    // ⛓ RULES l63-pole-crossings: a struck block's crossing costs the events that clear the bodies it would stop at.
    const blocks = playthroughBlockCrossings(doc, { events: [...priorEvents, ...talks.events] });
    return {
        obstacle, locks, buttons, poles, talks, blocks,
        events: [...priorEvents, ...talks.events],
        // ⛓ RULES lock-events: a latched lock's far-side return costs its event, not the reach of its open side.
        internalExitRules: locks.internalExitRules,
        internalExitGates: blocks.internalExitGates,
        exitGates: [...obstacle.exitGates, ...buttons.exitGates, ...poles.exitGates, ...talks.exitGates],
    };
}

/** Every exit whose arrival spawn is NOT its entrance tile, and why — derived, printed, never typed. */
export const movedArrivalSpawns = [];

const RETURN_SPAWNS = returnSpawnTable(MAP);

/**
 * ⚖ (user, 2026-10-04) a door tile is kept as a spawn ONLY where a real game link lands on it: the tiles of a
 * region's LANDING exits (the `to` end of each one-way connection), from the atlas this run compiles.
 */
const landingTiles = new Map();
let landingTilesAtlas = null;
export function setPlaythroughLandingAtlas(atlasDoc) {
    landingTilesAtlas = atlasDoc;
    landingTiles.clear();
}
function landingTilesOf(regionId) {
    if (!landingTilesAtlas) throw new Error('playthroughArrivalSpawn: setPlaythroughLandingAtlas(doc) first');
    if (landingTiles.size === 0) {
        const exitOf = new Map(landingTilesAtlas.regions.flatMap((r) => r.exits.map((e) => [`${r.region_id}|${e.exit_id}`, e])));
        for (const c of landingTilesAtlas.vanilla_layout?.connections ?? []) {
            const [region, exitId] = c.to;
            const e = exitOf.get(`${region}|${exitId}`);
            if (!e) continue;
            if (!landingTiles.has(region)) landingTiles.set(region, new Set());
            landingTiles.get(region).add(`${e.entrance_tile[0]},${e.entrance_tile[1]}`);
        }
    }
    return landingTiles.get(regionId) ?? new Set();
}

/**
 * ⛓ RULES arrival-spawns — the compiler's `arrivalSpawn` hook for this atlas: a landing as the game has it; a
 * door's own tile only where a game link lands on it and the physics model can stand there; else the game's
 * own landing beside the door, else the door's approach cell, else a named refusal (`seedlingModelOracles.seedlingArrivalSpawn`). Run after `buildPlaythroughAtlas`, whose
 * analysis pass recorded each exit's component.
 */
export function playthroughArrivalSpawn(region, exit, { entranceSpawn, landing }) {
    const spawn = arrivalSpawnFor(region, exit, { entranceSpawn, landing });
    if (spawn.via !== 'entrance' && spawn.via !== 'landing') {
        movedArrivalSpawns.push(`${region.region_id}/${exit.exit_id}: (${entranceSpawn.x}, ${entranceSpawn.y}) is `
            + `${spawn.why} → ${spawn.via} (${spawn.x}, ${spawn.y})`);
    }
    return spawn;
}

/** `playthroughArrivalSpawn`'s answer without the bookkeeping (the landing gates ask it again). */
function arrivalSpawnFor(region, exit, { entranceSpawn, landing }) {
    const level = levelOf(region.map_ref);
    const [tx, ty] = exit.entrance_tile;
    const back = RETURN_SPAWNS.get(returnKey(region.map_ref, tx, ty)) ?? null;
    const inComponent = exitComponents.get(region.region_id)?.get(exit.exit_id) ?? (() => false);
    const landedOn = landingTilesOf(region.region_id).has(`${tx},${ty}`);
    return seedlingArrivalSpawn(level, exit, entranceSpawn, {
        landing, landedOn, returnSpawn: back, inComponent, tileSize: TILE,
    });
}

/** Does `own` already require `gate` (equal, a conjunct of it, or the same item at a count at least as high)? */
function ruleImplies(own, gate) {
    if (!own) return false;
    if (JSON.stringify(own) === JSON.stringify(gate)) return true;
    if (own.rule === 'Has' && gate.rule === 'Has' && own.args.item_name === gate.args.item_name) {
        return (own.args.count ?? 1) >= (gate.args.count ?? 1);
    }
    if (own.rule === 'And') return own.children.some((c) => ruleImplies(c, gate));
    return false;
}

/** ⛓ RULES game-truth-gaps (R2) — the landings `playthroughLandingGates` measured, gated or not, and why. */
export const lethalLandings = [];

/**
 * ⛓⛓ RULES game-truth-gaps (R2) — **A LANDING ON LETHAL TERRAIN COSTS THE ITEM THAT SURVIVES IT**
 * (`seedlingDemo/seedlingLethalArrivals.js` holds the why and the game source). For every atlas connection,
 * each direction the graph wires: the landing is where the runtime binding puts the player
 * (`seedlingRegionBinding.resolveArrivalSpawn`: the game's return spawn for the landing tile, else this
 * generator's arrival spawn). When the physics model says an item-less arrival there dies IDLE on lethal
 * terrain (⚖ game truth first: no walk-off exemption), the DEPARTURE door is gated (`exitGates`) on that terrain's own transcription cost. A
 * gate the departure's own rule already requires is not written twice. The arrival-side mirror of
 * `chargeSealedDoor`: never the whole approach path, only the cell the game puts the body on.
 * Run after `buildPlaythroughAtlas(…)` and `setPlaythroughLandingAtlas(…)` on the document it returned.
 */
export function playthroughLandingGates(doc, { levelSource = levelSourceFromAtlas(MAP) } = {}) {
    lethalLandings.length = 0;
    const exitOf = new Map(doc.regions.flatMap((r) => (r.exits ?? []).map((e) => [`${r.region_id}|${e.exit_id}`, { region: r, exit: e }])));
    const verdicts = new Map();
    const gates = [];
    const legs = [];
    for (const c of doc.vanilla_layout?.connections ?? []) {
        legs.push({ from: c.from, to: c.to, oneWay: c.one_way === true });
        if (c.one_way !== true) legs.push({ from: c.to, to: c.from, oneWay: false });
    }
    for (const leg of legs) {
        const dep = exitOf.get(`${leg.from[0]}|${leg.from[1]}`);
        const arr = exitOf.get(`${leg.to[0]}|${leg.to[1]}`);
        if (!dep || !arr) continue;
        const level = levelOf(arr.region.map_ref);
        const [tx, ty] = arr.exit.entrance_tile;
        const back = RETURN_SPAWNS.get(returnKey(arr.region.map_ref, tx, ty)) ?? null;
        const spawn = back ?? arrivalSpawnFor(arr.region, arr.exit, { entranceSpawn: { x: tx * TILE, y: ty * TILE }, landing: leg.oneWay });
        const terrain = lethalTerrainUnder(level, spawn.x, spawn.y, { tileSize: TILE });
        if (!terrain) continue;
        const key = `${level.level},${spawn.x},${spawn.y}`;
        if (!verdicts.has(key)) verdicts.set(key, arrivalIsLethal(level, spawn.x, spawn.y, { levelSource }));
        const { lethal, outcome } = verdicts.get(key);
        const where = `${dep.region.region_id}/${dep.exit.exit_id} -> L${level.level} (${spawn.x}, ${spawn.y})`;
        if (!lethal) {
            lethalLandings.push({ where, gated: false, why: `an idle item-less arrival lives (${outcome})` });
            continue;
        }
        const placement = (level.layers ?? []).filter((l) => l.name !== 'cliffsides')
            .flatMap((l) => l.tiles ?? []).find(([x, y]) => x === terrain.tile[0] && y === terrain.tile[1]);
        const type = placement ? SEM.tileTypeForPlacement(placement) : null;
        const base = type === null ? null : SEM.tileSemantics(type);
        const ruled = base && (OV.overlayTileSemantics(type, base, level) ?? base);
        const rule = ruled?.kind === 'gated' && ruled.condition != null ? analyzerOptions.resolveCondition(ruled.condition) : null;
        if (!rule) {
            throw new Error(`landing gates: ${where} is lethal terrain (model tile type ${terrain.type} at `
                + `[${terrain.tile}]) whose transcription cost does not resolve to items`);
        }
        if (ruleImplies(dep.exit.access_rule, rule)) {
            lethalLandings.push({ where, gated: false, why: `the departure already requires ${JSON.stringify(rule)}` });
            continue;
        }
        gates.push({ region_id: dep.region.region_id, exit_id: dep.exit.exit_id, rule });
        lethalLandings.push({ where, gated: true, rule, why: `${ruled.label} at [${terrain.tile}]; idle ${outcome}` });
    }
    return gates;
}

export const analysisNotes = notes;
export const PLAYTHROUGH_ATLAS_PATH = ATLAS_OUT;
export const PLAYTHROUGH_PRESET_PATH = PRESET_OUT;

/** The provenance block the artifact carries. Every input, named. */
export function provenanceOf(atlasDoc) {
    return {
        generator: 'scripts/procgen/make-seedling-playthrough-rules.mjs',
        map_document: path.basename(MAP_FILE),
        map_generator: MAP.generator ?? null,
        map_source: MAP.source ?? null,
        set_patches: SEEDLING_SET_PATCHES.map((p) => p.id),
        pit_chains: 'frontend/modules/seedlingDemo/fidelityDescent.js censusFallsOntoDoors',
        semantics: 'frontend/modules/flashPanel/seedlingSemantics.js',
        overlay: 'frontend/modules/flashPanel/seedlingPlaythroughOverlay.js',
        pixel_masks: 'frontend/modules/seedlingDemo/seedlingPixelMasks.js (via levelWorld)',
        ledger: 'frontend/modules/seedlingDemo/r7Acceptance.js R7_GOAL_LEDGER',
        never_enter_levels: OV.NEVER_ENTER_LEVELS,
        overlay_rows: Object.entries(OV.PLAYTHROUGH_ENTITY_OVERLAY)
            .map(([tag, row]) => ({ tag, kind: row.kind, cite: row.cite })),
        hand_rulings: [{ id: 'L40_EAST', cite: OV.L40_EAST_RULE.cite, why: OV.L40_EAST_RULE.why }],
        refutations: OV.REFUTATION_LOG,
        atlas_id: atlasDoc.atlas_id,
    };
}

/**
 * ⛓⛓ R4b (rules-boss-locations; ⚖ the user 2026-10-19, "Both, default Seal/16") — THE TWO OPTIONS.
 *
 * - `boss_location_items` (`seal` | `filler`, default `seal`): what the seven boss kills hold. `seal` is
 *   upstream parity (`boss_locations` adds a Seal per boss: 23 in the pool); `filler` puts upstream's filler
 *   (`BOSS_FILLER_ITEM`) there instead, leaving the 16 chest Seals.
 * - `seals_required` (1–23, default 16): the Seals the FinalDoor event and so the goal need. With `filler`
 *   only 16 exist, and the generated world REFUSES N > 16 by name (`generate_early`: the item's pooled
 *   count is the bound, measured, never a second constant).
 *
 * ⛔ THIS FILE'S RULES STAY THE DEFAULT, LITERALLY. Every JS evaluator of AP_1 (the solver, the runtime, the
 * stateManager) reads `Has(Seal, 16)` as it always has; the options act in the WORLD only, through
 * `world[p].option_effects`, which `world_generator` reads (an opt-in block: a document without one
 * generates as before). The Generate.py export resolves the options to constants, as for any world.
 *
 * The HOST CONTRACT (R4b part 2) rides in `world[p].slot_data` (→ the world's `fill_slot_data`, from the
 * options): `seals_required` = N and `boss_location_items` = 0 (seal) | 1 (filler).
 */
function applyBossLocationOptions(rules) {
    const p = '1';
    const items = rules.items[p];
    const bossRows = R7_GOAL_LEDGER.filter((r) => r.kind === 'boss');
    const locs = Object.values(rules.regions[p]).flatMap((r) => r.locations ?? []);
    const bossLocations = bossRows.map((row) => {
        const name = `${levelName(row.level)} - ${row.label}`;
        const loc = locs.find((l) => l.name === name);
        if (!loc) throw new Error(`R4b: boss row ${row.id} compiled no location "${name}"`);
        if (loc.item?.name !== BOSS_LOCATION_ITEM) {
            throw new Error(`R4b: boss location "${name}" holds ${loc.item?.name}, not ${BOSS_LOCATION_ITEM}`);
        }
        return name;
    }).sort();
    const sealItem = BOSS_LOCATION_ITEM;
    const sealsInPool = rules.itempool_counts[p][sealItem];
    const required = OV.PLAYTHROUGH_ENTITY_OVERLAY.finaldoor.condition.seals;
    if (!Number.isInteger(required) || !Number.isInteger(sealsInPool) || required > sealsInPool - bossLocations.length) {
        throw new Error(`R4b: the FinalDoor needs ${required} ${sealItem}s, but only ${sealsInPool} are pooled `
            + `(${bossLocations.length} of them on bosses): the default must hold under both options`);
    }
    if (items[BOSS_FILLER_ITEM]) throw new Error(`R4b: ${BOSS_FILLER_ITEM} is already an item of this world`);
    // ⛔ APPENDED after the sorted block (`regionAtlasCompiler` ids by sorted NAME): no existing item id moves.
    const nextId = Math.max(...Object.values(items).map((i) => i.id).filter(Number.isInteger)) + 1;
    items[BOSS_FILLER_ITEM] = {
        name: BOSS_FILLER_ITEM, id: nextId, groups: [], classification: 'filler', type: null, max_count: 0,
    };
    const world = rules.world[p];
    world.options = { ...world.options, boss_location_items: 0, seals_required: required };
    world.option_definitions = {
        boss_location_items: {
            type: 'choice', name_lookup: { 0: 'seal', 1: 'filler' }, default: 0, display_name: 'Boss Location Items',
        },
        seals_required: {
            type: 'range', range_start: 1, range_end: sealsInPool, default: required, display_name: 'Seals Required',
        },
    };
    world.slot_data = { boss_location_items: 0, seals_required: required };
    world.option_effects = [
        {
            kind: 'item_count', option: 'seals_required', item: sealItem, count: required,
            why: 'every Has(Seal, default) in these rules (the FinalDoor event, the doorway behind it) reads N',
        },
        {
            kind: 'location_items', option: 'boss_location_items', value: 1, item: BOSS_FILLER_ITEM,
            locations: bossLocations,
            why: 'with `filler`, the seven boss kills hold the filler and the pool keeps the 16 chest Seals',
        },
    ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
    const check = process.argv.includes('--check');
    const quiet = process.argv.includes('--quiet');
    const doc = buildPlaythroughAtlas();
    const atlasText = compactJsonFile(doc);

    const result = validateRegionAtlas(doc, { mapDoc: MAP });
    if (!quiet) for (const n of notes) console.log(`ANALYSIS: ${n}`);
    for (const e of result.errors) console.error(`ERROR: ${e}`);
    if (!result.ok) process.exit(1);

    movedArrivalSpawns.length = 0;
    setPlaythroughLandingAtlas(doc);
    const layer = playthroughEventLayer(doc);
    const { obstacle, locks, buttons, poles, talks } = layer;
    const landingGates = playthroughLandingGates(doc);
    const ropes = playthroughRopeEvents(doc);
    const { rules, report } = compileRegionAtlas(doc, {
        mapDoc: MAP,
        gameName: GAME_NAME,
        seed: 1,
        completionItem: VICTORY_ITEM,
        provenance: provenanceOf(doc),
        // ⛓ RULES RA: the graph is DIRECTED and MEASURED so — `strand.py` reads
        // 0 of 242 stranded since fixes (A)+(B). Declared, it stops the runtime's
        // auto-detection from covering the one-way pits and locks with reverse
        // edges that do not exist in the game.
        assumeBidirectionalExits: false,
        arrivalSpawn: playthroughArrivalSpawn,
        // ⛓ RETURN TO MENU (⚖ the user, 2026-10-05): the Menu panel's Restart warps to the start, so returning to
        // the menu is always possible — a per-player flag, never an edge. Read off the substrate's declaration.
        returnToMenu: Boolean(SEEDLING_ENTRY.restartWarp),
        // ⛓ RULES obstacle-events: the saved obstacles' events and the landing edges they gate.
        // ⛓ RULES l38-button-event: and the cross-room button presses (obstacle = the target, side = the button).
        // ⛓ RULES watcher-event: and the cross-room prerequisites (the Watcher's talk, read by the FinalDoor).
        // ⛓ RULES rope-events: and the rope cuts (their gates are priced by the analyzer).
        events: [...layer.events, ...ropes.events],
        // ⛓ RULES lock-events: a latched lock's far-side return costs its event, not the reach of its open side.
        internalExitRules: layer.internalExitRules,
        // ⛓ RULES l63-pole-crossings: and a struck block's crossings, priced by its push paths.
        internalExitGates: layer.internalExitGates,
        // ⛓ RULES game-truth-gaps (R2): and the landings on lethal terrain.
        exitGates: [...layer.exitGates, ...landingGates, ...ropes.exitGates],
    });
    applyBossLocationOptions(rules);
    // ⛓ RULES l55-waterfall: a floored level is sound only if its entry gate is charged on every way in.
    const uncharged = playthroughEntryGateUncharged(rules);
    if (uncharged.length) {
        console.error(`ERROR: a way into a floored level is not charged its entry gate: ${uncharged.map((u) => u.exit).join(', ')}`);
        process.exit(1);
    }
    const rulesText = stringifyRulesJson(rules);
    // ⛓ RULES rope-events: a rope event the rules NAME must be one this run minted (a refused rope's name in a
    // block-path or lane condition would be an item nothing places).
    const mintedRopes = new Set(ropes.events.map((e) => e.name));
    const named = [...new Set(ROPES.map((r) => ropeEventName(r)).filter((n) => rulesText.includes(JSON.stringify(n))))];
    const stray = named.filter((n) => !mintedRopes.has(n));
    if (stray.length) {
        console.error(`ERROR: the rules name rope event(s) never minted: ${stray.join(', ')}`);
        process.exit(1);
    }

    if (check) {
        let bad = 0;
        for (const [file, text] of [[ATLAS_OUT, atlasText], [PRESET_OUT, rulesText]]) {
            const committed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
            if (committed !== text) {
                console.error(`ERROR: ${path.relative(repoRoot, file)} differs from a fresh build`);
                bad += 1;
            } else {
                console.log(`OK: ${path.relative(repoRoot, file)} matches a fresh build`);
            }
        }
        if (bad) process.exit(1);
    } else {
        fs.mkdirSync(path.dirname(PRESET_OUT), { recursive: true });
        fs.writeFileSync(ATLAS_OUT, atlasText);
        fs.writeFileSync(PRESET_OUT, rulesText);
        console.log(`wrote ${path.relative(repoRoot, ATLAS_OUT)}`);
        console.log(`wrote ${path.relative(repoRoot, PRESET_OUT)}`);
    }

    const s = result.stats;
    const rows = doc.regions.flatMap((r) => r.subgraph?.internal_exits ?? []);
    console.log(
        `${doc.atlas_id} — ${s.regions} regions, ${s.sub_regions} sub-regions, ${s.exits} exits, `
        + `${s.locations} locations, ${s.connections} one-way connections; `
        + `${rows.filter((e) => e.source === 'analyzer').length} computed internal exit(s), `
        + `${rows.filter((e) => (e.source ?? 'manual') !== 'analyzer').length} awaiting a hand-written rule`,
    );
    console.log(`rules.json — ${report.ap_regions} AP regions, ${report.exits} exits, `
        + `${report.locations ?? s.locations} locations, ${report.unwired_exits?.length ?? 0} unwired exit(s)`);
    console.log(`${movedArrivalSpawns.length} departure-door spawn(s) moved off the door tile (no game link lands there, or the model cannot stand there)`
        + `${quiet ? '' : movedArrivalSpawns.map((m) => `\n  ${m}`).join('')}`);
    console.log(`${obstacle.events.length} obstacle event(s), ${obstacle.exitGates.length} landing edge(s) gated`
        + `${quiet ? '' : obstacle.events.map((e) => `\n  ${e.fields.event_id} ${e.name} @ ${e.fields.side}`).join('')}`
        + `${obstacle.skipped.length ? `; ${obstacle.skipped.length} skipped: ${obstacle.skipped.join('; ')}` : ''}`);
    console.log(`${locks.events.length} lock event(s), ${locks.internalExitRules.length} far-side return(s) priced as their event`
        + `${locks.reused.length ? ` (${locks.reused.join(', ')} reused from the obstacle events)` : ''}`
        + `${quiet ? '' : locks.events.map((e) => `\n  ${e.fields.event_id} ${e.name} @ ${e.fields.side} `
            + `across [${e.fields.across.join(', ')}] rule ${JSON.stringify(e.access_rule)}`).join('')}`
        + `${quiet ? '' : locks.internalExitRules.map((r) => `\n  ${r.region_id} ${r.from} -> ${r.to}: ${JSON.stringify(r.rule)}`).join('')}`);
    console.log(`${buttons.events.length} cross-room button event(s), ${buttons.exitGates.length} crossing(s) through their targets gated`
        + `${buttons.reused.length ? ` (${buttons.reused.join(', ')} reused)` : ''}`
        + `${quiet ? '' : buttons.events.map((e) => `\n  ${e.fields.event_id} ${e.name} @ ${e.fields.side} `
            + `(pressed at L${e.fields.action.presser.level} buttonroom@${e.fields.action.presser.x},${e.fields.action.presser.y})`).join('')}`
        + `${quiet ? '' : buttons.exitGates.map((g) => `\n  gated ${g.region_id}/${g.exit_id}`).join('')}`
        + `${buttons.skipped.length ? `; ${buttons.skipped.length} skipped: ${buttons.skipped.join('; ')}` : ''}`);
    console.log(`${poles.events.length} in-room pole event(s), ${poles.exitGates.length} crossing(s) through the bodies they kill gated`
        + `${quiet ? '' : poles.events.map((e) => `\n  ${e.fields.event_id} ${e.name} @ ${e.fields.side}`).join('')}`
        + `${quiet ? '' : poles.exitGates.map((g) => `\n  gated ${g.region_id}/${g.exit_id}: ${JSON.stringify(g.rule)}`).join('')}`
        + `${poles.skipped.length ? `; ${poles.skipped.length} skipped: ${poles.skipped.join('; ')}` : ''}`);
    console.log(`${ropes.events.length} rope cut event(s) [${ropes.events.map((e) => `${e.name} @ ${e.fields.side}`).join('; ')}]; `
        + `${ropes.exitGates.length} landing(s) in a lane gated${quiet ? '' : ropes.exitGates.map((g) => `\n  gated ${g.region_id}/${g.exit_id}`).join('')}; `
        + `${ropes.refused.length} rope(s) refused${quiet ? '' : ropes.refused.map((r) => `\n  refused ${r}`).join('')}`);
    console.log(`${talks.events.length} cross-room prerequisite event(s), ${talks.exitGates.length} crossing(s) and `
        + `${talks.eventGates.length} event(s) gated on them`
        + `${quiet ? '' : talks.events.map((e) => `\n  ${e.fields.event_id} ${e.name} @ ${e.fields.side} (${e.fields.action.verb}; gates `
            + `${e.fields.action.gates.map((g) => `L${g.level} ${g.class}@${g.x},${g.y}`).join(', ')})`).join('')}`
        + `${quiet ? '' : talks.exitGates.map((g) => `\n  gated ${g.region_id}/${g.exit_id}`).join('')}`
        + `${quiet ? '' : talks.eventGates.map((g) => `\n  gated event ${g.event_id}`).join('')}`);
    console.log(`${landingGates.length} landing edge(s) gated on the lethal terrain they land on; `
        + `${lethalLandings.filter((l) => !l.gated).length} lethal-terrain landing(s) not gated`
        + `${quiet ? '' : lethalLandings.map((l) => `\n  ${l.gated ? 'GATED' : 'not gated'} ${l.where}: ${l.why}`).join('')}`);
    console.log(`${pocketDoorsCharged.length} departure(s) charged the solids that alone open their pocket`
        + `${quiet ? '' : pocketDoorsCharged.map((m) => `\n  ${m}`).join('')}`);
    console.log(`${notes.length} analysis note(s)${quiet ? ' (suppressed; drop --quiet to read them)' : ''}`);
}
