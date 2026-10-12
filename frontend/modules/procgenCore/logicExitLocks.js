/**
 * A sphere-growth gate on a zone substrate whose runtime does not enforce exit rules (jta, noiz2sa), expressed as
 * LOGIC ONLY (⚖ the user, 2026-10-11: "gates as logic-only access_rule overlays"; the region-library F6a precedent).
 * Nothing stops a player from physically leaving early; doing so is out of logic, never a soft lock.
 *
 * Sphere growth's zone path compiles `exitPaths[side]` against `obstacleDefs`, so each requirement term becomes one
 * pure rule LOCK (`clear_set_type: 'rule'`, `Has(item[, count])`) and the side's one path crosses all of them. The
 * compiled exit rule is then the AND of the terms, which is the tree's gate exactly. An empty requirement is one path
 * with no obstacle (`True_`). This is the encoding `flashSeedlingLibrary.seedlingDoorLocks` uses, with the id prefix
 * the caller names.
 *
 * Pure.
 */

import { makeHasRule } from '../shared/rulesJsonBuilder.js';

function lockId(prefix, item, count) {
    const slug = String(item).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return count > 1 ? `${prefix}${slug}__x${count}` : `${prefix}${slug}`;
}

/**
 * @param {Array<{side: string, requirement?: string[], counts?: object}>} exitSpecs - the zone path's exit specs
 * @param {string} prefix - the obstacle id prefix (one per substrate, so two substrates' locks never share an id)
 * @returns {{exitPaths: object, obstacleDefs: object}}
 */
export function logicOnlyExitLocks(exitSpecs, prefix) {
    const exitPaths = {};
    const obstacleDefs = {};
    for (const { side, requirement = [], counts = {} } of exitSpecs) {
        const obstacles = requirement.map((item) => {
            const count = counts?.[item] ?? 1;
            const id = lockId(prefix, item, count);
            obstacleDefs[id] = {
                id,
                name: `${item}${count > 1 ? ` x${count}` : ''} lock`,
                clear_set_type: 'rule',
                clear_rule: makeHasRule(item, count),
            };
            return id;
        });
        exitPaths[side] = [{ path_id: 'p1', obstacles }];
    }
    return { exitPaths, obstacleDefs };
}
