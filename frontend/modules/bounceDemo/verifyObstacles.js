/**
 * Per-obstacle gating verifier — topdown-bounce-obstacle-refactor.md
 * Phase 3.
 *
 * The generate-and-test loop (generator.js + deriveRules.js) already
 * proves, by exhaustive conservative subset simulation, that each goal's
 * derived minimal ability sets equal its target requirement. This module
 * adds the OBSTACLE-FRAMED guard that the emitted paths-and-obstacles
 * representation faithfully encodes that verified result:
 *
 *  1. FAITHFULNESS — the emitted paths, run back through the shared
 *     compiler with the region's obstacle lib, reproduce exactly the rule
 *     the legacy derivation built (physics AND authored). A mismatch means
 *     the obstacle representation has drifted from the proven rule.
 *
 *  2. PER-OBSTACLE NECESSITY — every physics obstacle on a path
 *     corresponds to an ability in that path's minimal set, and a minimal
 *     set has no reachable proper subset (deriveRules' definition), so
 *     each such obstacle GENUINELY gates its ability: dropping it makes the
 *     goal unreachable. Authored obstacles are AND terms, necessary by
 *     construction.
 *
 * Conservative: the underlying reachability never over-claims (canJump is
 * conservative; an unreachable goal derives [] minimal sets → no paths →
 * the compiler emits False_). This verifier only confirms the obstacle
 * encoding is faithful; it never relaxes a gate. Violations THROW — the
 * "hard error in verify, never silent drop" channel (D3).
 */

import { compileAccessRule } from '../shared/procgen/pathsAndObstaclesCompiler.js';

// ── Logical equivalence of two Rule Builder rules ────────────────────
//
// Faithfulness is a LOGICAL property: the obstacle paths must encode the
// same access predicate as the proven rule, not the same JSON tree. The
// two legitimately differ in shape — composeAuthoredRule nests the physics
// rule under an outer And (And(And(R,S), key)) while the compiler flattens
// the path's obstacles (And(R,S,key)). Both are the same predicate, so a
// byte compare would false-positive on a correct encoding.
//
// These rules only ever use True_/False_/Has/And/Or, so evaluate both over
// every inventory state that can flip a Has(item,count) threshold and
// require agreement everywhere.

function evalRule(rule, inv) {
    switch (rule?.rule) {
        case 'True_': return true;
        case 'False_': return false;
        case 'Has': return (inv[rule.args.item_name] ?? 0) >= (rule.args.count ?? 1);
        case 'And': return (rule.children ?? []).every((c) => evalRule(c, inv));
        case 'Or': return (rule.children ?? []).some((c) => evalRule(c, inv));
        case 'AtLeast': {
            const required = rule.count ?? 0;
            if (required <= 0) return true;
            let satisfied = 0;
            for (const c of rule.children ?? []) {
                if (evalRule(c, inv) && ++satisfied >= required) return true;
            }
            return false;
        }
        default:
            throw new Error(`verifyObstacleGating: unsupported rule '${rule?.rule}'`);
    }
}

// item -> sorted distinct count thresholds the rules branch on. A Has's
// truth only changes at its own threshold, so { 0 } ∪ thresholds per item
// is a complete set of distinguishing inventory levels.
function collectThresholds(rule, acc) {
    if (rule?.rule === 'Has') {
        const set = acc.get(rule.args.item_name) ?? new Set([0]);
        set.add(rule.args.count ?? 1);
        acc.set(rule.args.item_name, set);
    }
    for (const c of rule?.children ?? []) collectThresholds(c, acc);
    return acc;
}

function rulesLogicallyEqual(a, b) {
    const thresholds = collectThresholds(b, collectThresholds(a, new Map()));
    const items = [...thresholds.keys()];
    const levels = items.map((it) => [...thresholds.get(it)].sort((x, y) => x - y));
    // Cross product over per-item candidate counts.
    const total = levels.reduce((n, lv) => n * lv.length, 1);
    for (let i = 0; i < total; i++) {
        const inv = {};
        let rem = i;
        for (let k = 0; k < items.length; k++) {
            const lv = levels[k];
            inv[items[k]] = lv[rem % lv.length];
            rem = Math.floor(rem / lv.length);
        }
        if (evalRule(a, inv) !== evalRule(b, inv)) return false;
    }
    return true;
}

/**
 * Verify a region's emitted obstacle goals against their proven rules.
 *
 * @param {Array<{ kind: string, id: string, minimalSets: string[][],
 *   paths: Array, rule: object }>} goals — one per emitted exit/location.
 *   `rule` is the legacy composed rule (the proven target); `paths` is the
 *   obstacle encoding to validate; `minimalSets` is the verifier's output.
 * @param {Object} obstacleLib — the merged lib the compiler will use
 *   (physics defs + authored logic gates).
 * @throws on any faithfulness or necessity violation.
 */
export function verifyObstacleGating(goals, obstacleLib) {
    for (const goal of goals) {
        const where = `${goal.kind} '${goal.id}'`;

        // (1) Faithfulness: paths recompile to the same predicate as the
        // proven rule (logical equivalence — shapes legitimately differ).
        const recompiled = compileAccessRule(goal.paths, obstacleLib);
        if (!rulesLogicallyEqual(recompiled, goal.rule)) {
            throw new Error(`verifyObstacleGating: ${where} obstacle paths are unfaithful — `
                + `compiled ${JSON.stringify(recompiled)} != proven ${JSON.stringify(goal.rule)}`);
        }

        // One path per minimal set, in order (emitObstaclePaths invariant).
        if (goal.paths.length !== goal.minimalSets.length) {
            throw new Error(`verifyObstacleGating: ${where} has ${goal.paths.length} paths `
                + `but ${goal.minimalSets.length} minimal sets`);
        }

        goal.paths.forEach((path, i) => {
            const set = goal.minimalSets[i];
            const physicsAbilities = [];
            for (const obstacleId of path.obstacles) {
                const def = obstacleLib[obstacleId];
                if (!def) {
                    throw new Error(`verifyObstacleGating: ${where} references unknown `
                        + `obstacle '${obstacleId}'`);
                }
                // (2) Physics obstacles must map to an ability in this
                // path's minimal set; authored gates (clear_set_type
                // 'rule') are AND terms, necessary by construction.
                if (def.bounce_ability) physicsAbilities.push(def.bounce_ability);
            }
            const wantPhysics = [...set].sort().join('+');
            const gotPhysics = [...physicsAbilities].sort().join('+');
            if (wantPhysics !== gotPhysics) {
                throw new Error(`verifyObstacleGating: ${where} path ${i} physics obstacles `
                    + `[${gotPhysics}] != minimal set [${wantPhysics}] — an obstacle does not `
                    + 'gate a necessary ability');
            }
        });
    }
}
