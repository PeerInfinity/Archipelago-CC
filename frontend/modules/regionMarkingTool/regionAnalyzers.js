// Per-game region analyzers — the ONE registry the marking tool's Analyze
// button and the batch CLI (scripts/procgen/region-atlas-analyze.mjs) both
// read, so the panel proposes exactly what the CLI's `--check` reproduces.
//
// ⚖ (the user, 2026-10-04): the button passes the PHYSICS MODEL oracles for a
// Seedling atlas, as the atlas producers do (RULES starter-atlas-links). Before
// this, the button re-proposed the starter atlas's model-sealed r1c6 <-> r8c0
// as an open hand-authoring row. A game with no entry here has no analyzer,
// exactly as before.

import { analyzeSeedlingRegion } from '../flashPanel/seedlingAtlasAnalysis.js';
import { seedlingModelOracles } from '../seedlingDemo/seedlingModelOracles.js';

/**
 * game -> { analyze(atlas, regionId, deps), modelOracles? }. One entry today;
 * Phase 7 adds RWK.
 */
export const REGION_ANALYZERS = {
    seedling: { analyze: analyzeSeedlingRegion, modelOracles: seedlingModelOracles },
};

/**
 * The analyzer for `game`, with that game's oracles folded into its deps, or
 * null when the game has none.
 *
 * @returns {((atlas:object, regionId:string, deps:{mapDoc:object, gameConfig:object}) => object) | null}
 */
export function regionAnalyzerFor(game) {
    const entry = REGION_ANALYZERS[game];
    if (!entry) return null;
    return (atlas, regionId, deps) => entry.analyze(atlas, regionId,
        entry.modelOracles ? { ...deps, modelOracles: entry.modelOracles } : deps);
}
