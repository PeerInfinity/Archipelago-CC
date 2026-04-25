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

import { makeHasRule, makeAndRule, makeOrRule, makeTrueRule } from '../rulesJsonBuilder.js';

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
    const type = obstacle.clear_set_type ?? 'combo_list';
    if (type === 'rule') {
        // Logic-gate-style obstacle: the clear condition is already a
        // Rule Builder rule. Inline it unchanged. Missing clear_rule ≡
        // never clearable, same convention as an empty combo_list.
        return obstacle.clear_rule ?? makeFalseRule();
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
 *
 * If an exit or location entry carries an `access_rule` field (a
 * Rule Builder rule), it's used verbatim and the path-walked
 * derivation is skipped. The top-down driver uses this to emit the
 * source's rules unchanged, sidestepping the cut-vertex problem that
 * BFS-derived rules suffer when a gate placed for one location lands
 * on another's path.
 */
export function compileRegion(extracted, opts = {}) {
    const obstacleLib = opts.obstacleLib;
    if (!obstacleLib) throw new Error('compileRegion: opts.obstacleLib is required');

    const exits = (extracted.exits ?? []).map((exit) => ({
        id: exit.id,
        target_region: exit.target_region ?? null,
        rule: exit.access_rule ?? compileAccessRule(exit.paths, obstacleLib),
    }));

    const locations = (extracted.locations ?? []).map((loc) => ({
        id: loc.id,
        item: loc.item ?? null,
        position: loc.position ?? null,
        rule: loc.access_rule ?? compileAccessRule(loc.paths, obstacleLib),
        // Top-down sets global_name to the AP-canonical source
        // location name so the round-tripped rules.json uses the
        // original naming verbatim (e.g. "Slay Yorgle"). Grid-growth
        // omits it; compileRegionGraph falls back to Region__id__x_y.
        ...(loc.global_name ? { global_name: loc.global_name } : {}),
    }));

    return {
        region_name: extracted.region_id,
        exits,
        locations,
    };
}
