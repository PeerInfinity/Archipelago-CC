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
 *      building outlines the transcription cannot carry. ⛓ That import is the
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
const { analyzeRegion, applyRegionAnalysis } = await imp('frontend/modules/procgenPipeline/regionAtlasAnalyzer.js');
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
const { deriveAtlas, regionIdFor, VICTORY_ITEM } = await imp('frontend/modules/seedlingDemo/seedlingAtlasDerivation.js');
const { buildLevelWorld, ROLES, maskHitsBox } = await imp('frontend/modules/seedlingDemo/levelWorld.js');
const { censusFallsOntoDoors } = await imp('frontend/modules/seedlingDemo/fidelityDescent.js');
const { playerBoxAt } = await imp('frontend/modules/seedlingDemo/playerPhysicsV2.js');
const { seedlingModelOracles, modelFloodTiles, refuseUnboundMembers, seedlingArrivalSpawn } = await imp('frontend/modules/seedlingDemo/seedlingModelOracles.js');
const { returnSpawnTable, returnKey } = await imp('frontend/modules/flashPanel/seedlingReturnSpawns.js');

const { patchedMapDocument, SEEDLING_SET_PATCHES } = await imp('frontend/modules/seedlingDemo/seedlingSetPatches.js');
const { pitChainsFromCensus } = await import('./seedlingPitChains.js');

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

// ── layer 3a: the pixel-mask outlines, taken from the PHYSICS MODEL ─────────
//
// `seedlingSemantics` calls a Building `manual` because its collider is a
// per-pixel mask it does not carry — "neither rectangle approximation is safe:
// the sprite rect swallows the building's OWN doorway". The model DOES carry
// them, extracted from the PNGs and verified against the real game, so the
// generator asks it and hands the analyzer the answer as ordinary 1x1 walls.
//
// The synthetic tag is private to this generator and registered in the overlay
// lookup below; the map extract is never written.
const MASK_TAG = '__playthrough_mask_solid';

function expandPixelMasks(level) {
    const masked = new Set(OV.PIXEL_MASK_TAGS);
    if (!level.entities.some((e) => masked.has(e.type))) return level;
    const world = buildLevelWorld(level, { roles: ROLES });
    if (world.pixelmasks.length === 0) return level;
    const extra = [];
    for (let ty = 0; ty < level.height; ty += 1) {
        for (let tx = 0; tx < level.width; tx += 1) {
            const box = playerBoxAt(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
            for (const p of world.pixelmasks) {
                if (!maskHitsBox(p.mask, p.maskX, p.maskY, box)) continue;
                extra.push({ type: MASK_TAG, x: tx * TILE, y: ty * TILE, attrs: {} });
                break;
            }
        }
    }
    // The masked entities themselves drop out — their cells are now stated
    // exactly, and leaving the sprite rect behind would re-add the wall the
    // mask says is a doorway.
    return {
        ...level,
        entities: [...level.entities.filter((e) => !masked.has(e.type)), ...extra],
    };
}

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
const entityOverride = (entity, base, level) => {
    if (entity.type === MASK_TAG) {
        return {
            kind: 'wall',
            cite: 'seedlingDemo/levelWorld.ENTITY_CLASSES + seedlingPixelMasks.js',
            why: 'the real per-pixel outline, from the model that drives the game byte-exact',
        };
    }
    return OV.overlayEntitySemantics(entity, base, {
        level: level.level, crossLevelOpeners: CROSS_LEVEL_OPENERS, groupOpeners: GROUP_OPENERS,
    });
};

// ⛔⛔⛔ THE MASK EXPANSION IS OFF BY DEFAULT, AND THAT IS A MEASUREMENT.
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
// `--masks` keeps the code alive and runnable for whoever wants to make it
// sub-tile (where it would be a genuine improvement rather than a coarsening).
const MASKS = process.argv.includes('--masks');
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
const gridFor = (level, { directionalLocks = DIRECTIONAL_LOCKS, arrivals = true } = {}) => SEM.buildSeedlingRegionGrid(
    { x: 0, y: 0, w: level.width, h: level.height }, MASKS ? expandPixelMasks(level) : level,
    {
        entityOverride,
        tileOverride: OV.overlayTileSemantics,
        ...(directionalLocks ? { directionalLocks, ...(arrivals ? { arrivalTiles: arrivalTilesFor(level.level) } : {}) } : {}),
    },
);
/** ⛓ SWIM T4 — the analyzer grid this generator builds for one level (the census's read). Additive. */
export const playthroughGridFor = (level, options) => gridFor(level, options);
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
 */
function gameGatedSolidTiles(level) {
    const tiles = new Set();
    for (const entity of level.entities ?? []) {
        const base = SEM.entitySemantics(entity);
        if (base?.kind !== 'gated') continue;
        for (const [tx, ty] of SEM.entitySealedTiles(entity, base)) tiles.add(`${tx},${ty}`);
    }
    return tiles;
}

/** The analyzer options for ONE level: the shared ones plus the model oracles. */
export function playthroughAnalyzerOptionsFor(level) {
    const oracles = seedlingModelOracles(level, gridFor(level), { tileSize: TILE });
    const gated = gameGatedSolidTiles(level);
    return {
        ...analyzerOptions,
        ...oracles,
        tileSolid: ({ tile }) => gated.has(`${tile[0]},${tile[1]}`) && oracles.tileSolid({ tile }),
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
    arrivalsUncharged.length = 0;
    exitComponents.clear();
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
        const analysis = analyzeRegion(region, gridFor(level), playthroughAnalyzerOptionsFor(level));
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
        applyCrossingCostToBindings(session.atlas, regionId, analysis);
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
        if (b.kind !== 'exit' || !b.component || !b.reachable) continue;
        if (!b.conditionSets || b.conditionSets.length === 0) continue;
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
 * Only the transcription's OWN item-gated solids count (`gameGatedSolidTiles`).
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
    // ── the hand-charged doors (§14): the two exits whose dropped approach
    //    cost the SPHERE LOG caught — D7's entrance and the endgame door.
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
    const level = levelOf(region.map_ref);
    const [tx, ty] = exit.entrance_tile;
    const back = RETURN_SPAWNS.get(returnKey(region.map_ref, tx, ty)) ?? null;
    const inComponent = exitComponents.get(region.region_id)?.get(exit.exit_id) ?? (() => false);
    const landedOn = landingTilesOf(region.region_id).has(`${tx},${ty}`);
    const spawn = seedlingArrivalSpawn(level, exit, entranceSpawn, {
        landing, landedOn, returnSpawn: back, inComponent, tileSize: TILE,
    });
    if (spawn.via !== 'entrance' && spawn.via !== 'landing') {
        movedArrivalSpawns.push(`${region.region_id}/${exit.exit_id}: (${entranceSpawn.x}, ${entranceSpawn.y}) is `
            + `${spawn.why} → ${spawn.via} (${spawn.x}, ${spawn.y})`);
    }
    return spawn;
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
    });
    const rulesText = stringifyRulesJson(rules);

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
    console.log(`${notes.length} analysis note(s)${quiet ? ' (suppressed; drop --quiet to read them)' : ''}`);
}
