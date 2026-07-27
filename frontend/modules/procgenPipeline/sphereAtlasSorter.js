// Region-atlas → sphere SORTER (CC/docs/plans/region-atlas-plan.md, Phase 6,
// slice 2 — the design ruling 1 calls primary).
//
// The quota route (slice 1) hands sphere growth a pool and lets the grower pick
// regions at random, gating each one with a SYNTHETIC gate drawn from the plan.
// That works, but it throws away what the map knows: Seedling's water crossings
// really do want the swim, and a generated world that gates the far bank on
// `key_blue` instead is telling a lie the player can see.
//
// The sorter reverses the direction. It reads each pool entry's INTRINSIC entry
// requirement — the cheapest way in, priced by the atlas's own rows — and makes
// that requirement the region's sphere gate. On its own that would break the
// stratification invariant the sphere log oracle checks (a wave-k region must
// attach behind a gate whose items are sphere-k items, and "Progressive Swim" is
// in no sphere at all), so the sorter also SCHEDULES each required item into a
// sphere, and places the region in the wave that sphere gates. The gate is then
// legitimate by construction: it is the real game's requirement AND a proper
// sphere-k gate, and the oracle stays exact.
//
// What it will not do:
//   - **Force a region in.** A requirement outside the gate vocabulary (an OR, a
//     count) is DECLINED with a reason, not encoded wrong — three of the ten
//     Seedling sub-regions sit behind "Progressive Sword OR Ghost Spear".
//   - **Gate on a final-sphere item.** Final-sphere items gate nothing (nothing
//     comes after them), so a requirement that could only land there is declined.
//   - **Carry items.** A sorted atlas node is item-free: a real map offers
//     exactly the locations it was marked with, and the grower's round-robin
//     knows nothing about that capacity. Making the placement capacity-aware is
//     the natural next step, not a v1 claim.
//
// Pure and rng-free. `plan` IS mutated (items are appended to spheres) because
// the plan is also the oracle: the caller must verify the world against the SAME
// object the growth used, or the injected items read as unplanned.
//
// Headless-safe: no top-level await, no literal node: imports.

import { entryRequirement, atlasSourceId } from './regionAtlasPool.js';

/**
 * Sort a game's atlas regions into the sphere plan.
 *
 * @param {object} plan     the sphere plan — MUTATED (required items appended)
 * @param {object} pool     the atlas pool document
 * @param {object} [opts]
 * @param {number} [opts.quota]  how many regions may be placed (default: all)
 * @returns {{
 *   sourceId: string,
 *   assignments: Array<{ entry_id, wave, gate, sourceId }>,
 *   injected: Array<{ item, sphere }>,
 *   declined: Array<{ entry_id, reason }>,
 * }}
 */
export function sortAtlasRegionsIntoSpheres(plan, pool, opts = {}) {
    const sourceId = atlasSourceId(pool.game);
    const entries = Array.isArray(pool.entries) ? pool.entries : [];
    const quota = Number.isInteger(opts.quota) ? opts.quota : entries.length;
    const assignments = [];
    const injected = [];
    const declined = [];

    const spheres = plan.spheres ?? [];
    // Final-sphere items gate nothing, so the last wave that can carry a gate is
    // spheres.length - 1 (1-indexed sphere numbers).
    const lastGatingSphere = spheres.length - 1;

    // Which sphere an item is already obtainable in (1-indexed), or null. `Has`
    // is satisfied by the FIRST instance, so the earliest sphere wins.
    const sphereOf = (item) => {
        for (let i = 0; i < spheres.length; i += 1) {
            if (spheres[i].items.includes(item)) return i + 1;
        }
        return null;
    };

    // Requirements, in declaration order — the pool's order is the atlas's, so
    // "which regions get placed when the quota bites" is reproducible.
    const wanted = [];
    for (const entry of entries) {
        const req = entryRequirement(entry);
        if (req.declined) {
            declined.push({ entry_id: entry.entry_id, reason: req.declined });
            continue;
        }
        wanted.push({ entry, req });
        if (wanted.length >= quota) break;
    }

    // Group by requirement so every region behind the same frontier lands in the
    // same wave — which is what the map says about them. Free first, then by
    // cost then name, so the assignment is stable against pool reordering.
    const groups = new Map();
    for (const w of wanted) {
        const key = [...w.req.gate].sort().join('|');
        if (!groups.has(key)) groups.set(key, { gate: [...w.req.gate].sort(), members: [] });
        groups.get(key).members.push(w);
    }
    const ordered = [...groups.values()]
        .sort((a, b) => (a.gate.length - b.gate.length)
            || a.gate.join('|').localeCompare(b.gate.join('|')));

    let nextFreshSphere = 1;
    for (const group of ordered) {
        if (group.gate.length === 0) {
            // Nothing to schedule: the map lets you walk straight in, so the
            // region rides at wave 0 like any ungated attachment.
            for (const m of group.members) {
                assignments.push({
                    entry_id: m.entry.entry_id, wave: 0, gate: [], sourceId,
                });
            }
            continue;
        }
        if (lastGatingSphere < 1) {
            for (const m of group.members) {
                declined.push({
                    entry_id: m.entry.entry_id,
                    reason: `entering needs [${group.gate.join(', ')}], but a plan with `
                        + `${spheres.length} sphere(s) has no sphere that can gate anything `
                        + '(final-sphere items gate nothing) — plan more spheres',
                });
            }
            continue;
        }
        // Schedule every required item, then take the LATEST of them: the region
        // opens exactly when the last one becomes obtainable.
        let wave = 0;
        let failed = null;
        for (const item of group.gate) {
            let s = sphereOf(item);
            if (s === null) {
                s = Math.min(nextFreshSphere, lastGatingSphere);
                spheres[s - 1].items.push(item);
                injected.push({ item, sphere: s });
            } else if (s > lastGatingSphere) {
                failed = `"${item}" is a final-sphere item and final-sphere items gate nothing`;
                break;
            }
            wave = Math.max(wave, s);
        }
        if (failed) {
            for (const m of group.members) {
                declined.push({ entry_id: m.entry.entry_id, reason: failed });
            }
            continue;
        }
        // Distinct frontiers spread across the spheres rather than all piling
        // into sphere 1 — the "come back with the new item" texture, read off
        // the map instead of drawn.
        if (nextFreshSphere <= lastGatingSphere) nextFreshSphere += 1;
        for (const m of group.members) {
            assignments.push({
                entry_id: m.entry.entry_id, wave, gate: [...group.gate], sourceId,
            });
        }
    }

    return { sourceId, assignments, injected, declined };
}

/** One-line-per-item human summary of a sort, for CLIs and verifiers. */
export function formatAtlasSortReport({ assignments, injected, declined }) {
    const lines = [
        `atlas sorter: ${assignments.length} placed, ${injected.length} item(s) scheduled, `
        + `${declined.length} declined`,
    ];
    for (const a of assignments) {
        lines.push(`  wave ${a.wave} ${a.entry_id}`
            + (a.gate.length ? ` behind [${a.gate.join(', ')}]` : ' (free)'));
    }
    for (const i of injected) lines.push(`  scheduled ${i.item} into sphere ${i.sphere}`);
    for (const d of declined) lines.push(`  DECLINED ${d.entry_id}: ${d.reason}`);
    return lines;
}
