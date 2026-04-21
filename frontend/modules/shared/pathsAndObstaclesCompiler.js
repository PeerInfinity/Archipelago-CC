/**
 * Paths-and-obstacles → Rule Builder compiler.
 *
 * Implements the four-nested-loop expansion from
 * NewDocs/plans/procedural-generation/pipeline-overview.md
 * §"Authored rules: paths and obstacles":
 *
 *     reach(target) =
 *       OR over paths p:
 *         AND over obstacles o in p.obstacles:
 *           OR over combinations c in o.clear_set:
 *             AND over items i in c:
 *               has(i)
 *
 * Genre-agnostic. The caller supplies the obstacle library; the
 * compiler emits Rule Builder JSON consumable by world_generator via
 * rules.json (frontend/schema/rules.schema.json).
 */

import { makeHasRule, makeAndRule, makeOrRule, makeTrueRule } from './rulesJsonBuilder.js';

function makeFalseRule() {
    return { rule: 'False_' };
}

function compileCombination(combination) {
    if (!combination || combination.length === 0) return makeTrueRule();
    return makeAndRule(combination.map((itemId) => makeHasRule(itemId)));
}

function compileObstacle(obstacleId, obstacleLib) {
    const obstacle = obstacleLib[obstacleId];
    if (!obstacle) {
        throw new Error(`compileObstacle: unknown obstacle '${obstacleId}'`);
    }
    const clearSet = obstacle.clear_set ?? [];
    // Empty clear_set ≡ no item combination ever clears this obstacle
    // ≡ path through it is never valid. Emit False_ so the surrounding
    // AND short-circuits.
    if (clearSet.length === 0) return makeFalseRule();
    return makeOrRule(clearSet.map(compileCombination));
}

function compilePath(path, obstacleLib) {
    const obstacles = path.obstacles ?? [];
    if (obstacles.length === 0) return makeTrueRule();
    return makeAndRule(obstacles.map((o) => compileObstacle(o, obstacleLib)));
}

/**
 * Compile a list of paths (OR-of-AND of obstacles, each obstacle an
 * OR-of-AND of items) into a Rule Builder rule.
 *
 * Empty `paths` ≡ the target has no known route ≡ unreachable. Returns
 * a False_ rule rather than defaulting to True_, so silent
 * extraction failures can't masquerade as "trivially reachable."
 */
export function compileAccessRule(paths, obstacleLib) {
    if (!paths || paths.length === 0) return makeFalseRule();
    return makeOrRule(paths.map((p) => compilePath(p, obstacleLib)));
}

/**
 * Compile an extracted region (as produced by a substrate's
 * paths-and-obstacles extractor, e.g. mazeRoom's
 * `extractPathsAndObstacles`) into a shape with Rule Builder rules on
 * each exit and location. The output is intentionally *not* a full
 * rules.json — that comes later, when per-region compiled outputs are
 * combined across a region graph.
 *
 *   input:  { region_id, entrance, exits, locations }  // extracted form
 *   output: { region_name, exits: [{id, target_region, rule}],
 *             locations: [{id, item, rule}] }
 */
export function compileRegion(extracted, opts = {}) {
    const obstacleLib = opts.obstacleLib;
    if (!obstacleLib) throw new Error('compileRegion: opts.obstacleLib is required');

    const exits = (extracted.exits ?? []).map((exit) => ({
        id: exit.id,
        target_region: exit.target_region ?? null,
        rule: compileAccessRule(exit.paths, obstacleLib),
    }));

    const locations = (extracted.locations ?? []).map((loc) => ({
        id: loc.id,
        item: loc.item ?? null,
        position: loc.position ?? null,
        rule: compileAccessRule(loc.paths, obstacleLib),
    }));

    return {
        region_name: extracted.region_id,
        exits,
        locations,
    };
}
