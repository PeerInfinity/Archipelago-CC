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
 * ⛔ NO `procgen_metadata` (§8.3, verified by generating). Vanilla placement
 * travels on `location.item` + `--canonical-seed 1`; emitting
 * `procgen_metadata` would move every placement into `LOCKED_PLACEMENTS`,
 * which is always-locked for EVERY seed and would kill the randomisability the
 * AP path exists for.
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
const { validateRegionAtlas } = await imp('frontend/modules/procgenPipeline/regionAtlasValidator.js');
const { compactJsonFile } = await imp('frontend/modules/procgenPipeline/compactJson.js');
const { analyzeRegion, applyRegionAnalysis } = await imp('frontend/modules/procgenPipeline/regionAtlasAnalyzer.js');
const { compileRegionAtlas } = await imp('frontend/modules/procgenPipeline/regionAtlasCompiler.js');
const { stringifyRulesJson } = await imp('frontend/modules/shared/rulesJsonBuilder.js');
const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
const OV = await imp('frontend/modules/flashPanel/seedlingPlaythroughOverlay.js');
const { R7_GOAL_LEDGER } = await imp('frontend/modules/seedlingDemo/r7Acceptance.js');
// ⛓ EDITOR v3 slice D0b — the derivation LIFTED out of this script (plan §16.3):
//   the atlas's regions, exits and connections are a FUNCTION of the rooms, and
//   only the OVERLAY below is authored. The vanilla 116 and an edited level set
//   now go through ONE `deriveAtlas`.
const { deriveAtlas, regionIdFor, VICTORY_ITEM } = await imp('frontend/modules/seedlingDemo/seedlingAtlasDerivation.js');
const { buildLevelWorld, ROLES, maskHitsBox } = await imp('frontend/modules/seedlingDemo/levelWorld.js');
const { playerBoxAt } = await imp('frontend/modules/seedlingDemo/playerPhysicsV2.js');

const MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
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
const entityOverride = (entity, base, level) => {
    if (entity.type === MASK_TAG) {
        return {
            kind: 'wall',
            cite: 'seedlingDemo/levelWorld.ENTITY_CLASSES + seedlingPixelMasks.js',
            why: 'the real per-pixel outline, from the model that drives the game byte-exact',
        };
    }
    return OV.overlayEntitySemantics(entity, base, { level: level.level, crossLevelOpeners: CROSS_LEVEL_OPENERS });
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
const gridFor = (level) => SEM.buildSeedlingRegionGrid(
    { x: 0, y: 0, w: level.width, h: level.height }, MASKS ? expandPixelMasks(level) : level,
    { entityOverride, tileOverride: OV.overlayTileSemantics },
);

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

export function buildPlaythroughAtlas() {
    notes.length = 0;
    prunedPockets.length = 0;
    droppedRegions.length = 0;
    lavaTrapLifts.length = 0;
    locationGuards.length = 0;
    permissiveBindings.length = 0;
    crossingCharged.length = 0;
    arrivalsUncharged.length = 0;
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
    const derived = deriveAtlas(LEVELS, {
        locations: R7_GOAL_LEDGER,
        locationGuard: OV.locationGuard,
        neverEnter: { levels: OV.NEVER_ENTER_LEVELS, cite: OV.NEVER_ENTER_CITE },
    }, {
        tileSize: TILE,
        tileTypeForPlacement: SEM.tileTypeForPlacement,
        resolveCondition: (c) => analyzerOptions.resolveCondition(c),
        note,
        onGuard: (loc, guard) => locationGuards.push(`${loc.name} — ${guard.cite}`),
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
    droppedRegions.push(...derived.dropped);
    const session = new AtlasSession(derived.atlas);

    // ── the analysis pass ────────────────────────────────────────────────
    for (const region of [...session.atlas.regions]) {
        const regionId = region.region_id;
        const level = levelOf(region.map_ref);
        const analysis = analyzeRegion(region, gridFor(level), analyzerOptions);
        const applied = applyRegionAnalysis(session.atlas, analysis, { stamp: false });
        for (const p of applied.problems) note(`${regionId}: ${p.message}`);
        for (const n of analysis.needs_authoring) {
            note(`${regionId}: ${n.from} ${n.bidirectional ? '<->' : '->'} ${n.to} `
                + `NEEDS A HAND-WRITTEN RULE — ${n.reasons.join('; ')}`);
        }
        for (const b of analysis.bindings) {
            if (!b.component) note(`${regionId}: ${b.kind} "${b.id}" binds to NO walkable component — ${b.reason}`);
        }
        applyCrossingCostToBindings(session.atlas, regionId, analysis);
        applyLavaTrapPulls(session.atlas, regionId, level, analysis);
        pruneUnreachableSubRegions(session.atlas, regionId);
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
        if (!CHARGE_CROSSINGS) { permissiveBindings.push(`${regionId}/${b.id}`); continue; }
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
        region.annotations.rules_source = 'mixed';
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

/**
 * Every ARRIVAL exit standing on gated material whose approach cost was NOT
 * charged. The analyzer measures reach-TO, an arrival needs reach-FROM, and the
 * two differ across a one-way face — so this is the permissive side, counted.
 */
export const arrivalsUncharged = [];

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

    const { rules, report } = compileRegionAtlas(doc, {
        mapDoc: MAP,
        gameName: GAME_NAME,
        seed: 1,
        completionItem: VICTORY_ITEM,
        provenance: provenanceOf(doc),
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
    console.log(`${notes.length} analysis note(s)${quiet ? ' (suppressed; drop --quiet to read them)' : ''}`);
}
