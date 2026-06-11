/**
 * Sphere planner — build-order step 1 of the sphere-driven growth
 * driver (NewDocs/plans/procedural-generation/sphere-driven-growth.md).
 *
 * A pure function: item pool + parameters → a sphere plan, the
 * item→sphere assignment that drives wave growth AND doubles as the
 * expected sphere log (the verification oracle: a fixpoint sweep over
 * the emitted rules.json must reproduce it exactly, and so must the
 * Python sphere log for the canonical seed).
 *
 * The plan deliberately fixes item→sphere ONLY (decision 2026-06-10);
 * region counts per wave, filler counts, locations-per-region, and
 * topology are grower parameters, not plan content.
 *
 * Item identifiers are opaque to the planner — it distributes whatever
 * names the pool uses (AP item names for bounce, itemLib ids for
 * maze). Substrates that use internal ids map at their own boundary.
 *
 * Sphere semantics (1-indexed, matching AP's spoiler convention):
 * sphere-s items sit at locations that become reachable exactly when
 * all items from spheres < s are collectable. The grower's
 * stratification rule makes this exact: wave-(s-1) regions host
 * sphere-s items and their entry gates include ≥1 sphere-(s-1) item.
 * That rule is why gateability matters here: spheres 1..N-1 are the
 * gate vocabulary, so when every gate-owning substrate is restricted
 * (e.g. a bounce-only run can only gate on its six ability items),
 * each of spheres 1..N-1 must carry at least one gateable item —
 * `gateableItems` lets the planner enforce that, failing loudly when
 * the pool can't support it. Final-sphere items never gate anything.
 */

import { createRng } from '../shared/rng.js';
import { generateSphereLog } from '../shared/procgen/forwardSimulator.js';

/**
 * Plan the spheres.
 *
 * @param {object} opts
 * @param {Object<string, number>} opts.itemPool - item name → count.
 *   Every instance is assigned to exactly one sphere.
 * @param {number} [opts.sphereCount] - explicit number of spheres N.
 * @param {number} [opts.itemsPerSphere] - alternative sizing:
 *   N = ceil(totalItems / itemsPerSphere). Exactly one of
 *   sphereCount / itemsPerSphere is required.
 * @param {Object<string, number>} [opts.pins] - item name → sphere
 *   (1-based). Pins ALL instances of that item to the sphere.
 * @param {Object<number, string[]>} [opts.exclusiveSpheres] - sphere
 *   (1-based) → item names. That sphere contains EXACTLY those items
 *   (all pool instances of each) and is closed to distribution — e.g.
 *   bounce's entry sphere holds a single arrow and nothing else.
 * @param {string|null} [opts.victoryItem] - convenience pin of all of
 *   this item's instances to the FINAL sphere. Conflicting explicit
 *   pin of the same item is an error.
 * @param {Iterable<string>|null} [opts.gateableItems] - when given,
 *   every sphere 1..N-1 must end up with ≥1 instance whose name is in
 *   this set (see header). Throws when the pool can't satisfy it.
 * @param {number} [opts.seed]
 * @returns {{seed: number, spheres: Array<{sphere: number, items: string[]}>}}
 */
export function planSpheres({
    itemPool,
    sphereCount = null,
    itemsPerSphere = null,
    pins = {},
    exclusiveSpheres = {},
    victoryItem = null,
    gateableItems = null,
    seed = 1,
} = {}) {
    if (!itemPool || typeof itemPool !== 'object') {
        throw new Error('planSpheres: itemPool required');
    }
    const instances = [];
    for (const [name, count] of Object.entries(itemPool)) {
        if (!Number.isInteger(count) || count < 0) {
            throw new Error(`planSpheres: itemPool['${name}'] must be a non-negative integer`);
        }
        for (let i = 0; i < count; i++) instances.push(name);
    }
    const total = instances.length;
    if (total === 0) throw new Error('planSpheres: itemPool is empty');

    if ((sphereCount == null) === (itemsPerSphere == null)) {
        throw new Error('planSpheres: exactly one of sphereCount / itemsPerSphere required');
    }
    let n;
    if (sphereCount != null) {
        if (!Number.isInteger(sphereCount) || sphereCount < 1) {
            throw new Error('planSpheres: sphereCount must be a positive integer');
        }
        n = sphereCount;
    } else {
        if (!Number.isInteger(itemsPerSphere) || itemsPerSphere < 1) {
            throw new Error('planSpheres: itemsPerSphere must be a positive integer');
        }
        n = Math.ceil(total / itemsPerSphere);
    }
    if (total < n) {
        throw new Error(`planSpheres: ${n} spheres need at least ${n} items; pool has ${total}`);
    }

    // Exclusive spheres: validate shape, then express each as pins of
    // its listed items; the sphere is additionally CLOSED to any other
    // assignment (gateability cover and even distribution skip it).
    const closedSpheres = new Set();
    const allPins = { ...pins };
    for (const [key, items] of Object.entries(exclusiveSpheres)) {
        const s = Number(key);
        if (!Number.isInteger(s) || s < 1 || s > n) {
            throw new Error(`planSpheres: exclusive sphere ${key} out of range (valid: 1..${n})`);
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error(`planSpheres: exclusive sphere ${s} needs a non-empty item list`);
        }
        closedSpheres.add(s);
        for (const name of items) {
            if (allPins[name] != null && allPins[name] !== s) {
                throw new Error(`planSpheres: exclusive sphere ${s} item '${name}' conflicts `
                    + `with its pin to sphere ${allPins[name]}`);
            }
            allPins[name] = s;
        }
    }
    for (const [name, s] of Object.entries(pins)) {
        if (closedSpheres.has(s) && !(exclusiveSpheres[s] ?? []).includes(name)) {
            throw new Error(`planSpheres: pin for '${name}' targets exclusive sphere ${s}`);
        }
    }

    // Merge the victory convenience pin into the pin map.
    if (victoryItem != null) {
        if (allPins[victoryItem] != null && allPins[victoryItem] !== n) {
            throw new Error(`planSpheres: victoryItem '${victoryItem}' conflicts with its `
                + `explicit pin to sphere ${allPins[victoryItem]} (final sphere is ${n})`);
        }
        if (closedSpheres.has(n) && !(exclusiveSpheres[n] ?? []).includes(victoryItem)) {
            throw new Error(`planSpheres: the final sphere is exclusive and does not `
                + `include the victory item '${victoryItem}'`);
        }
        if ((itemPool[victoryItem] ?? 0) === 0) {
            throw new Error(`planSpheres: victoryItem '${victoryItem}' is not in the pool`);
        }
        allPins[victoryItem] = n;
    }
    for (const [name, s] of Object.entries(allPins)) {
        if (!Number.isInteger(s) || s < 1 || s > n) {
            throw new Error(`planSpheres: pin for '${name}' targets sphere ${s} (valid: 1..${n})`);
        }
        if ((itemPool[name] ?? 0) === 0) {
            throw new Error(`planSpheres: pinned item '${name}' is not in the pool`);
        }
    }

    const rng = createRng(seed);
    const spheres = Array.from({ length: n }, () => []);

    // 1. Pins: all instances of a pinned item go to its sphere.
    const remaining = [];
    for (const name of instances) {
        if (allPins[name] != null) spheres[allPins[name] - 1].push(name);
        else remaining.push(name);
    }
    rng.shuffle(remaining);

    // 2. Gateability: spheres 1..N-1 each need ≥1 gateable instance
    //    (they form the gate vocabulary for waves 1..N-1). Pinned
    //    gateables already in place count; cover the rest from the
    //    unpinned remainder, drawing in shuffled order. Closed
    //    (exclusive) spheres can't receive items — they must already
    //    satisfy the constraint.
    const gateSet = gateableItems ? new Set(gateableItems) : null;
    if (gateSet && gateSet.size > 0) {
        for (let k = 0; k < n - 1; k++) {
            if (spheres[k].some((name) => gateSet.has(name))) continue;
            if (closedSpheres.has(k + 1)) {
                throw new Error(`planSpheres: exclusive sphere ${k + 1} has no gateable item`);
            }
            const idx = remaining.findIndex((name) => gateSet.has(name));
            if (idx < 0) {
                throw new Error(`planSpheres: sphere ${k + 1} has no gateable item and no `
                    + 'unpinned gateable instances remain — the pool cannot support '
                    + `${n} spheres under this gateability constraint`);
            }
            spheres[k].push(remaining.splice(idx, 1)[0]);
        }
    }

    // 3. Even distribution of the remainder across the OPEN spheres:
    //    fill each toward a balanced target (earlier spheres take the
    //    modulo extras), then drain anything left — overflow from
    //    pin-heavy spheres — onto the currently-smallest open sphere.
    const open = [...Array(n).keys()].filter((k) => !closedSpheres.has(k + 1));
    if (open.length === 0 && remaining.length > 0) {
        throw new Error('planSpheres: every sphere is exclusive but unassigned items remain');
    }
    const closedCount = spheres.reduce(
        (s, arr, k) => (closedSpheres.has(k + 1) ? s + arr.length : s), 0);
    const openTotal = total - closedCount;
    const base = open.length > 0 ? Math.floor(openTotal / open.length) : 0;
    const extras = open.length > 0 ? openTotal % open.length : 0;
    open.forEach((k, i) => {
        const target = base + (i < extras ? 1 : 0);
        while (spheres[k].length < target && remaining.length > 0) {
            spheres[k].push(remaining.pop());
        }
    });
    while (remaining.length > 0) {
        let smallest = open[0];
        for (const k of open) {
            if (spheres[k].length < spheres[smallest].length) smallest = k;
        }
        spheres[smallest].push(remaining.pop());
    }

    for (let k = 0; k < n; k++) {
        if (spheres[k].length === 0) {
            throw new Error(`planSpheres: sphere ${k + 1} ended up empty — too many spheres `
                + 'for this pool given the pins');
        }
    }

    return {
        seed,
        spheres: spheres.map((items, k) => ({ sphere: k + 1, items })),
    };
}

/**
 * Structural + semantic validation of a sphere plan. Returns a list of
 * error strings (empty = valid) — same convention as validateLevel.
 * Used by tests now and by the grower / fixpoint oracle later.
 *
 * @param {object} plan - planSpheres output shape
 * @param {object} [opts]
 * @param {Object<string, number>} [opts.itemPool] - when given, the
 *   plan's items must equal the pool as a multiset.
 * @param {Iterable<string>} [opts.gateableItems] - when given, every
 *   sphere except the last must contain ≥1 gateable item.
 * @returns {string[]}
 */
export function validateSpherePlan(plan, { itemPool = null, gateableItems = null } = {}) {
    const errors = [];
    if (!plan || !Array.isArray(plan.spheres) || plan.spheres.length === 0) {
        return ['plan.spheres must be a non-empty array'];
    }
    const n = plan.spheres.length;
    plan.spheres.forEach((entry, k) => {
        if (entry.sphere !== k + 1) {
            errors.push(`spheres[${k}].sphere is ${entry.sphere}, expected ${k + 1}`);
        }
        if (!Array.isArray(entry.items) || entry.items.length === 0) {
            errors.push(`sphere ${k + 1} has no items`);
        }
    });

    if (itemPool) {
        const counts = {};
        for (const entry of plan.spheres) {
            for (const name of entry.items ?? []) {
                counts[name] = (counts[name] ?? 0) + 1;
            }
        }
        for (const [name, count] of Object.entries(itemPool)) {
            if ((counts[name] ?? 0) !== count) {
                errors.push(`item '${name}': plan has ${counts[name] ?? 0}, pool has ${count}`);
            }
            delete counts[name];
        }
        for (const name of Object.keys(counts)) {
            errors.push(`item '${name}' is in the plan but not in the pool`);
        }
    }

    if (gateableItems) {
        const gateSet = new Set(gateableItems);
        if (gateSet.size > 0) {
            for (let k = 0; k < n - 1; k++) {
                const items = plan.spheres[k].items ?? [];
                if (!items.some((name) => gateSet.has(name))) {
                    errors.push(`sphere ${k + 1} has no gateable item`);
                }
            }
        }
    }

    return errors;
}

// ── The verification oracle ──────────────────────────────────────────
//
// The sphere plan doubles as the EXPECTED sphere log: a fixpoint sweep
// over the emitted rules.json must bucket items into exactly the
// planned spheres. generateSphereLog already implements AP's
// get_spheres semantics (snapshot reachability at each sphere
// boundary), so the oracle is bucket-and-compare.

/**
 * Bucket the items of a rules.json by sphere, using the same
 * AP-faithful sweep the pipeline embeds as sphere_log. Returns
 * [{ sphere: 1, items: [...] }, ...] in planSpheres' shape (the log's
 * 0-indexed pick batches map to 1-indexed plan spheres).
 */
export function computeItemSpheres(rulesJson, { playerId = '1' } = {}) {
    const entries = generateSphereLog(rulesJson, { playerId });
    const buckets = new Map();
    for (const e of entries) {
        if (e.type !== 'state_update') continue;
        if (typeof e.sphere_index !== 'string' || !e.sphere_index.includes('.')) continue;
        const sphere = parseInt(e.sphere_index.split('.')[0], 10) + 1;
        const baseItems = e.player_data?.[playerId]?.new_inventory_details?.base_items ?? {};
        if (!buckets.has(sphere)) buckets.set(sphere, []);
        for (const [name, count] of Object.entries(baseItems)) {
            for (let i = 0; i < count; i++) buckets.get(sphere).push(name);
        }
    }
    return [...buckets.keys()].sort((a, b) => a - b)
        .map((sphere) => ({ sphere, items: buckets.get(sphere) }));
}

/**
 * Compare computed sphere buckets against the plan (multisets per
 * sphere). Returns error strings; empty = the world realises the plan
 * exactly.
 */
export function compareSpheresToPlan(computed, plan) {
    const errors = [];
    if (computed.length !== plan.spheres.length) {
        errors.push(`sphere count mismatch: computed ${computed.length}, `
            + `planned ${plan.spheres.length}`);
    }
    const n = Math.min(computed.length, plan.spheres.length);
    for (let i = 0; i < n; i++) {
        const got = [...computed[i].items].sort();
        const want = [...plan.spheres[i].items].sort();
        if (got.length !== want.length || got.some((x, j) => x !== want[j])) {
            errors.push(`sphere ${i + 1}: computed [${got.join(', ')}] != `
                + `planned [${want.join(', ')}]`);
        }
    }
    return errors;
}
