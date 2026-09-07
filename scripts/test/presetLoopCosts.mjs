/**
 * The ONE loop-cost algorithm, for the `scripts/test/generate-*-preset.mjs`
 * writers.
 *
 * ⛓ WHY: these writers used to stamp a hand-authored block —
 * `{regions: {}, locations: {}, defaultRegionCost, defaultLocationCost}` —
 * whose only job was to EXIST, because the loops module enters loop mode when
 * `loop_costs` is present. The consequence (loop-costs plan §13, L3's finding)
 * is that a maze region the planner prices at 16 answers the root default 50,
 * because the block states no entry for it. A block with no simulation behind
 * it is not an economy; it is a switch wearing an economy's clothes.
 *
 * So a writer calls `generateLoopCosts` — the same function
 * `procgenPipelineEngine.buildRulesJson` calls when `enableLoopMode` is set —
 * against the sphere log the preset already embeds. Write-by-class then does
 * the rest: coarse (maze) regions get real prices, a substrate with its own
 * mana economy (jta, omsi) gets no entry at all, and the start region gets a
 * zero by rule.
 *
 * ⛔ `generatedAt` IS DROPPED, DELIBERATELY, AND THAT IS NOT A COSMETIC CHOICE.
 * `generateLoopCosts` stamps `new Date().toISOString()`. In a preset that is
 * REGENERATED and DIFFED, a wall clock makes every regeneration differ, which
 * would silently retire a property this tree measures and states out loud: all
 * five omsi presets regenerate byte-identical today, and two writer headers
 * assert exactly that (`generate-omsi-randomized-test-preset.mjs` — the
 * emission-OFF reference; `generate-omsi-scaled-test-preset.mjs` — "Do NOT
 * modify omsi_randomized_test … it is the byte-inertness witness"). Nothing in
 * CI re-runs these writers and diffs, so a timestamp would break those claims
 * with no gate to notice. Dropping the field is also what the corpus already
 * does: all twelve tracked `loop_costs` blocks on disk carry no `generatedAt`.
 * `version` and `generatedFrom` are kept — both are deterministic, and
 * `generatedFrom` is the provenance a reader can act on: it names the writer.
 * ⚠ The field cannot be suppressed at the source instead: `loopCostGenerator.js`
 * lives in the `frontend/modules/shared/` submodule.
 */

import { generateLoopCosts } from '../../frontend/modules/shared/procgen/loopCostGenerator.js';

/**
 * Plan and stamp `rules.loop_costs` in place.
 *
 * @param {Object} rules — a built rules.json scaffold, sphere log already embedded
 * @param {Object} args
 * @param {string} args.sourceFileName — repo-relative path of the calling writer
 * @param {string} [args.playerId] — defaults to the scaffold's only player slot
 * @returns {Object} the block that was stamped
 * @throws if the scaffold carries no usable sphere log — a writer that reaches
 *         here without one must STOP rather than stamp an unsimulated block.
 */
export function stampLoopCosts(rules, { sourceFileName, playerId = null } = {}) {
    const pid = playerId ?? Object.keys(rules?.regions ?? {})[0];
    if (!pid) throw new Error('stampLoopCosts: rules.json has no player slot');
    if (!Array.isArray(rules.sphere_log) || rules.sphere_log.length === 0) {
        throw new Error(
            'stampLoopCosts: no sphere log on the scaffold — call this AFTER '
            + 'buildRulesJson has embedded one. A loop_costs block with no '
            + 'simulation behind it is what this helper exists to remove.');
    }

    const block = generateLoopCosts({
        rulesJson: rules,
        sphereLog: rules.sphere_log,
        playerId: pid,
        sourceFileName,
    });
    delete block.generatedAt;   // see the header — determinism, not cosmetics

    rules.loop_costs = block;
    return block;
}
