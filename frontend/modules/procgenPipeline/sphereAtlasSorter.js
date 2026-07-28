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
// --- the vocabulary lift (Phase-6 fence 1, lifted) ---------------------------
//
// v1 accepted only a conjunction of single-instance `Has` terms, so three of the
// ten Seedling sub-regions — the ones behind "Progressive Sword OR Ghost Spear"
// — were declined. The requirement is now normalized to DNF over `Has` terms
// (regionAtlasPool.requirementDnf), which changes three things and nothing else:
//
//   - **The honest wave** is `min over disjuncts of (max over that disjunct's
//     items' spheres)` — the first sphere in which SOME way through the rule is
//     satisfiable. Computed against the FINISHED plan, in a second pass, so a
//     requirement another group happened to complete is not missed.
//   - **Scheduling picks ONE disjunct** — the cheapest, then lexical, so it is
//     rng-free — and pushes its items into an earlier sphere. A `Has(x, 2)`
//     pushes two instances. A disjunct the plan ALREADY satisfies is reused, and
//     then nothing is scheduled at all.
//   - **The gate the world sees stays the AUTHORED rule**, verbatim. The
//     scheduled disjunct is bookkeeping (which items to inject, and what the
//     grower's item-level gate accounting sees); re-synthesising the gate from
//     it would narrow an OR to the one branch the sorter happened to pick and
//     kill the other, which is exactly the lie this module exists to avoid.
//
// What it still will not do:
//   - **Force a region in.** A requirement outside the DNF vocabulary (Compare,
//     Count*, a helper) is DECLINED with a reason, not encoded wrong.
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

import {
    entryRequirement, atlasSourceId, requirementDnf, requirementKey, conjunctKey,
    conjunctCost, schedulingDisjunct,
} from './regionAtlasPool.js';

/**
 * Sort a game's atlas regions into the sphere plan.
 *
 * @param {object} plan     the sphere plan — MUTATED (required items appended)
 * @param {object} pool     the atlas pool document
 * @param {object} [opts]
 * @param {number} [opts.quota]  how many regions may be placed (default: all)
 * @returns {{
 *   sourceId: string,
 *   assignments: Array<{ entry_id, wave, gate, gateCounts, gateRule, sourceId }>,
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

    /** How many instances of `item` the plan carries through sphere `k` (all if null). */
    const instancesThrough = (item, k = null) => {
        let n = 0;
        const upTo = k == null ? spheres.length : Math.min(k, spheres.length);
        for (let i = 0; i < upTo; i += 1) {
            for (const it of spheres[i].items) if (it === item) n += 1;
        }
        return n;
    };
    /** The sphere the `count`-th instance of `item` becomes obtainable in, or null. */
    const sphereOf = (item, count = 1) => {
        let seen = 0;
        for (let i = 0; i < spheres.length; i += 1) {
            for (const it of spheres[i].items) if (it === item) seen += 1;
            if (seen >= count) return i + 1;
        }
        return null;
    };

    /**
     * What it would take to make one disjunct satisfiable, WITHOUT touching the
     * plan: the wave it would then open in, and the instances that must be
     * pushed into `target` to get there. `null` = this way in is unusable.
     *
     * An item the plan already provides at the demanded count is REUSED at the
     * sphere it is obtainable in (a frontier the plan already covers is not a
     * new requirement) — and if that sphere is the final one, the disjunct is
     * unusable, because a final-sphere item gates nothing.
     */
    const planConjunct = (conj, target) => {
        let wave = 0;
        const toInject = [];
        for (const term of conj) {
            if (instancesThrough(term.item) >= term.count) {
                const s = sphereOf(term.item, term.count);
                if (s > lastGatingSphere) return { unusable: term.item };
                wave = Math.max(wave, s);
                continue;
            }
            // Under-provided: push enough instances into `target` that the
            // count-th one is obtainable there.
            const need = term.count - instancesThrough(term.item, target);
            toInject.push({ item: term.item, n: need });
            wave = Math.max(wave, target);
        }
        return { wave, toInject };
    };

    /**
     * The HONEST wave of a whole requirement against the plan as it now stands:
     * the earliest sphere in which any disjunct is satisfiable. `null` when none
     * is (which only happens before scheduling).
     */
    const honestWave = (dnf) => {
        let best = null;
        for (const conj of dnf) {
            let wave = 0;
            let ok = true;
            for (const term of conj) {
                const s = sphereOf(term.item, term.count);
                if (s === null) { ok = false; break; }
                wave = Math.max(wave, s);
            }
            if (ok && (best === null || wave < best)) best = wave;
        }
        return best;
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
    // cost then key, so the assignment is stable against pool reordering.
    const groups = new Map();
    for (const w of wanted) {
        const key = requirementKey(w.req.dnf);
        if (!groups.has(key)) groups.set(key, { key, dnf: w.req.dnf, members: [] });
        groups.get(key).members.push(w);
    }
    const ordered = [...groups.values()]
        .sort((a, b) => (conjunctCost(schedulingDisjunct(a.dnf))
                - conjunctCost(schedulingDisjunct(b.dnf)))
            || a.key.localeCompare(b.key));

    // --- pass A: schedule ----------------------------------------------------
    // Decide (and apply) every injection first, so pass B can read the finished
    // plan. A group is refused BEFORE anything is scheduled for it: an item
    // injected for a group that then turns out to be unplaceable would sit in
    // the plan gating nothing.
    let nextFreshSphere = 1;
    const placeable = [];
    for (const group of ordered) {
        const isFree = group.key === '';
        if (isFree) {
            // Nothing to schedule: the map lets you walk straight in, so the
            // region rides at wave 0 like any ungated attachment.
            placeable.push(group);
            continue;
        }
        if (lastGatingSphere < 1) {
            for (const m of group.members) {
                declined.push({
                    entry_id: m.entry.entry_id,
                    reason: `entering needs [${describeDnf(group.dnf)}], but a plan with `
                        + `${spheres.length} sphere(s) has no sphere that can gate anything `
                        + '(final-sphere items gate nothing) — plan more spheres',
                });
            }
            continue;
        }
        const target = Math.min(nextFreshSphere, lastGatingSphere);
        const attempts = group.dnf.map((conj) => planConjunct(conj, target));
        // A way in the plan ALREADY opens costs nothing and is taken first.
        const covered = attempts.find((a) => a.toInject && a.toInject.length === 0);
        const chosen = covered ?? attempts.find((a) => a.toInject);
        if (!chosen) {
            const item = attempts.find((a) => a.unusable)?.unusable;
            for (const m of group.members) {
                declined.push({
                    entry_id: m.entry.entry_id,
                    reason: `"${item}" is a final-sphere item and final-sphere items `
                        + 'gate nothing',
                });
            }
            continue;
        }
        let scheduled = false;
        for (const inj of chosen.toInject) {
            for (let i = 0; i < inj.n; i += 1) {
                spheres[target - 1].items.push(inj.item);
                injected.push({ item: inj.item, sphere: target });
                scheduled = true;
            }
        }
        // Distinct frontiers spread across the spheres rather than all piling
        // into sphere 1 — the "come back with the new item" texture, read off
        // the map instead of drawn. Only a group that actually scheduled
        // something moves the cursor: a frontier the plan already covered is not
        // a new requirement.
        if (scheduled && nextFreshSphere <= lastGatingSphere) nextFreshSphere += 1;
        placeable.push(group);
    }

    /**
     * The EXIT ENVELOPE of one entry: its outbound exits in payload order —
     * which is exactly the order the maze hook assigns them to child sides
     * (mazeLibraryEntry.js), so the k-th child of this region lands behind
     * envelope[k] and the planner knows which rule that is before it commits.
     *
     * Each slot carries the wave a child hung there would OPEN in: `access_rule`
     * null is a free exit (the engine draws the child's gate and ANDs it on),
     * otherwise the map's own rule IS the child's gate and `wave` is the sphere
     * it becomes satisfiable in. `wave: null` = out of vocabulary; nothing may
     * hang there, because its reachability cannot be reasoned about at all.
     */
    const envelopeFor = (entry) => (entry.exits ?? []).map((ex) => {
        const dnf = ex.access_rule == null ? [[]] : requirementDnf(ex.access_rule);
        const chosen = dnf ? schedulingDisjunct(dnf) : [];
        return {
            exit_id: ex.exit_id,
            access_rule: ex.access_rule ?? null,
            wave: dnf ? honestWave(dnf) : null,
            gate: chosen.map((t) => t.item),
            gateCounts: Object.fromEntries(chosen.filter((t) => t.count > 1)
                .map((t) => [t.item, t.count])),
        };
    });

    // --- pass B: the honest wave, read off the FINISHED plan ------------------
    // The exit envelope is read here too: an exit's rule can name an item THIS
    // sort scheduled, so its wave is only knowable once every injection is in.
    for (const group of placeable) {
        const wave = honestWave(group.dnf) ?? 0;
        for (const m of group.members) {
            assignments.push({
                entry_id: m.entry.entry_id,
                wave,
                // The disjunct the grower's item-level accounting sees. The gate
                // the WORLD sees is `gateRule` — the authored rule, so an OR
                // keeps both ways in.
                gate: [...m.req.gate],
                gateCounts: { ...m.req.counts },
                gateRule: m.req.rule ?? null,
                exitEnvelope: envelopeFor(m.entry),
                sourceId,
            });
        }
    }

    return { sourceId, assignments, injected, declined };
}

/** `A + B` / `A | B` — a requirement in one line, for reports and decline reasons. */
export function describeDnf(dnf) {
    return (dnf ?? []).map(conjunctKey).join(' | ') || 'nothing';
}

/** Does this assignment's authored gate say more than its scheduled disjunct? */
const isDisjunctive = (a) => a.gateRule?.rule === 'Or'
    || (a.gateRule?.rule === 'HasAny' && (a.gateRule.args?.items?.length ?? 0) > 1);

/** One-line-per-item human summary of a sort, for CLIs and verifiers. */
export function formatAtlasSortReport({ assignments, injected, declined }) {
    const lines = [
        `atlas sorter: ${assignments.length} placed, ${injected.length} item(s) scheduled, `
        + `${declined.length} declined`,
    ];
    for (const a of assignments) {
        lines.push(`  wave ${a.wave} ${a.entry_id}`
            + (a.gate.length ? ` behind [${a.gate.join(', ')}]` : ' (free)')
            + (isDisjunctive(a) ? ' (one of several ways in — the world keeps the OR)' : ''));
    }
    for (const i of injected) lines.push(`  scheduled ${i.item} into sphere ${i.sphere}`);
    for (const d of declined) lines.push(`  DECLINED ${d.entry_id}: ${d.reason}`);
    return lines;
}
