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

import {
    buildSeedlingRegionGrid,
    buildFlagItemRules,
    resolveCondition,
    conditionKey,
} from './seedlingSemantics.js';

/**
 * Index a Seedling map document (the `seedling-map.json` extract) by level id.
 * Accepts the document or an already-built Map.
 */
export function indexSeedlingLevels(mapDoc) {
    if (mapDoc instanceof Map) return mapDoc;
    const byId = new Map();
    for (const level of mapDoc?.levels ?? []) byId.set(String(level.level), level);
    return byId;
}

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
    const level = indexSeedlingLevels(mapDoc).get(String(region.map_ref));
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
