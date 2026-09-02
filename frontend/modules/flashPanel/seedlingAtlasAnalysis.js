// Seedling <-> region-atlas analyzer glue
// (CC/docs/plans/region-atlas-plan.md, Phase 5a, Deliverable 2).
//
// The analyzer core (procgenPipeline/regionAtlasAnalyzer.js) is game-agnostic:
// it takes a cell grid and two helpers that give conditions identity and turn
// them into Rule Builder trees. seedlingSemantics.js is the transcription that
// produces all three. This file is the one place they are wired together, so
// neither module has to know the other exists — the analyzer stays reusable for
// RWK in Phase 7, and the semantics tables stay a clean data module for the
// Phase-5b maze projection.
//
// Headless-safe: no top-level await, no literal node: imports.

import { analyzeRegion, applyRegionAnalysis } from '../procgenPipeline/regionAtlasAnalyzer.js';
import { indexLevels } from '../seedlingDemo/atlasSource.js';

import {
    buildSeedlingRegionGrid,
    buildFlagItemRules,
    resolveCondition,
    conditionKey,
} from './seedlingSemantics.js';

/**
 * Index a Seedling map document (the `seedling-map.json` extract) by level id.
 * Accepts the document or an already-built Map.
 *
 * ⛔⛔ **THE KEY IS THE NUMBER NOW, AND THAT IS THE POINT** (maze-lab arms F-a /
 * plan §17.1 F11). This was the only one of the repo's four "index rooms by
 * level" maps that keyed by `String(level.level)`; the other three use the
 * number the documents actually carry. Since this function has always accepted
 * "the document or an already-built Map", a number-keyed Map from any of the
 * other three looked up as a string and MISSED — silently, as `undefined`. One
 * spelling, in `seedlingDemo/atlasSource.js`, and the lookups below convert.
 */
export function indexSeedlingLevels(mapDoc) {
    return indexLevels(mapDoc);
}

/**
 * The number-keyed index's key for a region's `map_ref`.
 *
 * ⛓ WHY THIS IS NOT `Number(mapRef)`. `region-atlas.schema.json:126-128` allows
 * `map_ref` to be *"an integer or non-empty string level id"*, and a Seedling
 * level id IS an integer — so a region written `map_ref: "19"` names level 19
 * and hit this index when it was string-keyed. Dropping that would be a
 * behaviour change shipped under a "nothing observable moved" claim.
 *
 * ⛔ But a naive `Number()` would be a WORSE change in the other direction:
 * `Number(null)` is 0, so a region with `map_ref: null` — three of them in
 * `atlases/seedling-fixture.json` — would start resolving to LEVEL 0. So the
 * conversion is a round trip: only a string that `Number` maps back to itself
 * is a level number. `null`, `undefined`, `'mz_3'`, `''`, `'007'` and `' 19'`
 * are returned as-is and miss, which is exactly what `String(…)` did.
 */
const levelKeyOf = (mapRef) => {
    if (Number.isInteger(mapRef)) return mapRef;
    if (typeof mapRef === 'string' && String(Number(mapRef)) === mapRef) return Number(mapRef);
    return mapRef;
};

/**
 * The analyzer options for Seedling: condition identity and condition -> rule,
 * both closed over the per-game engine binding (`games/seedling.json`).
 *
 * `unresolved` carries whatever the binding could not explain, so a caller can
 * say so rather than quietly producing rules with holes in them.
 */
export function seedlingAnalyzerOptions(gameConfig) {
    const flagRules = buildFlagItemRules(gameConfig);
    return {
        conditionKey,
        resolveCondition: (condition) => resolveCondition(condition, flagRules),
        flagRules,
        unresolved: flagRules.unresolved,
    };
}

/**
 * Analyze one region of a Seedling atlas. Pure — it proposes, and nothing is
 * committed until applySeedlingRegionAnalysis runs.
 *
 * A region with no `map_ref` has no tiles to analyze at all: it is graph-only
 * (the Phase-4 compiler already names those), so this reports that rather than
 * inventing an empty grid whose "no split" answer would look like a result.
 *
 * @param {object} atlas    the atlas document
 * @param {string} regionId which region
 * @param {{ mapDoc:object, gameConfig:object }} deps
 */
export function analyzeSeedlingRegion(atlas, regionId, { mapDoc, gameConfig }) {
    const region = (atlas.regions ?? []).find((r) => r.region_id === regionId);
    if (!region) throw new Error(`atlas has no region "${regionId}"`);
    if (region.map_ref === undefined || region.map_ref === null) {
        return { region_id: regionId, skipped: 'region has no map_ref — graph-only, there is no tile map to analyze' };
    }
    const level = indexSeedlingLevels(mapDoc).get(levelKeyOf(region.map_ref));
    if (!level) {
        throw new Error(`region "${regionId}" names map_ref ${JSON.stringify(region.map_ref)}, which is not a level in the map document`);
    }
    const grid = buildSeedlingRegionGrid(region.bounds, level);
    const options = seedlingAnalyzerOptions(gameConfig);
    const analysis = analyzeRegion(region, grid, options);
    return { ...analysis, grid, level: region.map_ref, binding_unresolved: options.unresolved };
}

/** Commit a proposal produced by analyzeSeedlingRegion. */
export function applySeedlingRegionAnalysis(atlas, analysis, options = {}) {
    if (analysis.skipped) throw new Error(`nothing to apply: ${analysis.skipped}`);
    return applyRegionAnalysis(atlas, analysis, options);
}

/**
 * Analyze every region of an atlas, in declared order. Regions with no map_ref
 * come back as `skipped` entries rather than being dropped — the same
 * discipline the compiler applies to unwired exits.
 */
export function analyzeSeedlingAtlas(atlas, deps) {
    return (atlas.regions ?? []).map((r) => analyzeSeedlingRegion(atlas, r.region_id, deps));
}

/**
 * The maze-projection deps for a Seedling atlas (Phase 5b) — the same three
 * things the analyzer needs, since the projection recomputes the partition
 * through it: a cell grid per region plus the condition vocabulary.
 *
 * `gridFor` returns null for a region whose `map_ref` is not in the map document
 * (the projection then leaves it graph-only and names it) rather than throwing,
 * because a partial atlas grown region by region is the normal state.
 *
 * @param {{ mapDoc:object, gameConfig:object }} deps
 * @returns {{ gridFor:Function, conditionKey:Function, resolveCondition:Function, unresolved:string[] }}
 */
export function seedlingMazeProjectionDeps({ mapDoc, gameConfig }) {
    const levels = indexSeedlingLevels(mapDoc);
    const options = seedlingAnalyzerOptions(gameConfig);
    return {
        conditionKey: options.conditionKey,
        resolveCondition: options.resolveCondition,
        unresolved: options.unresolved,
        gridFor: (region) => {
            const level = levels.get(levelKeyOf(region.map_ref));
            return level ? buildSeedlingRegionGrid(region.bounds, level) : null;
        },
    };
}
