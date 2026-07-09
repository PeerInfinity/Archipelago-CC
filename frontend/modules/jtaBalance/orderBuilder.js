/**
 * Pass-B WALK-ORDER BUILDER (plan §2.1–2.2).
 *
 * ENV-AGNOSTIC. Like balanceCore.js, this module never imports the game or
 * touches the DOM: every input is caller-supplied so one implementation serves
 * the Pass-B Web Worker, the Node verify script, and vitest units.
 *
 * ── What it does ──────────────────────────────────────────────────────────
 * The post-fill sphere log is a total order over the progression locations it
 * contains, but AP can only split spheres by progression items (~21 perks =>
 * ~22 integer spheres), so a per-task order finer than that must be built
 * frontend-side. This module turns the log into a total order over EVERY v1
 * task:
 *
 *   1. Flatten the log (`extractLocationEntries`), keep only entries that map
 *      to a jta task, dedup to the FIRST occurrence, and group by INTEGER
 *      sphere into buckets. Perk grants ride their entries.
 *   2. Complete the universe: every jta task in `apLocations` absent from the
 *      log is SYNTHESIZED into the bucket whose preceding cumulative perk
 *      grants first satisfy its access-rule count (gate 0 => first bucket).
 *   3. Within each bucket, seeded shuffle (deterministic per world seed) then
 *      a STABLE constraint repair that disturbs the shuffle minimally:
 *        (a) an unlockER precedes every task it unlocks (transitively);
 *        (b) a zone's Mandatory/Prestige tasks precede that zone's Travel task.
 *      Repair is deterministic and throws on a constraint cycle rather than
 *      looping.
 *
 * Milestone detection is intentionally NOT done here — balancePass computes
 * `items ∩ perkItemNames` from the entries this module emits.
 */

import { extractLocationEntries, TASK_TYPE } from './balanceCore.js';
import { createRng } from '../shared/rng.js';

// Types the fork's `has_unfinished_mandatory_task` counts (simulation.ts:850):
// while any such task is unfinished, Travel is disabled. So a zone's blocking
// tasks must precede that zone's Travel task in the walk (plan §1.3). Prestige
// is included for fidelity; v1 (zones 0-14) has no Prestige tasks, so it is
// inert on real data.
const BLOCKS_TRAVEL = new Set([TASK_TYPE.Mandatory, TASK_TYPE.Prestige]);

// Read a key from a Map or a plain object. Task ids are numbers; object keys
// are strings, so fall back to the stringified key for Maps keyed either way.
function readEntry(mapOrObj, key) {
    if (mapOrObj == null) return undefined;
    if (mapOrObj instanceof Map) {
        return mapOrObj.has(key) ? mapOrObj.get(key) : mapOrObj.get(String(key));
    }
    return mapOrObj[key];
}

// Integer sphere ("bucket") for a log entry. `sphere_index` arrives as a string
// ("0.1", "1.2") from a file-loaded log or as a number from other JSON paths;
// both emitters label the FIRST integer sphere's sub-entries "0.M" (Python:
// `main_sphere_index_counter - 1`; JS forwardSimulator: `sphereIdx` base 0), so
// Math.floor(Number(...)) buckets both consistently.
function integerSphere(sphereIndex) {
    const n = Number(sphereIndex);
    return Number.isFinite(n) ? Math.floor(n) : 0;
}

/**
 * Build the within-bucket "before" edges from task metadata:
 *   - an unlockER (`unlocksTask` -> U) precedes U;
 *   - within a zone, each Mandatory/Prestige task precedes each Travel task.
 * Only edges between tasks present in `order` (this bucket) are emitted;
 * cross-bucket order is already correct by construction (plan §2.1).
 * Returns Map<taskId, Set<taskId>>: key must come before every id in its set.
 */
function buildBucketEdges(order, taskMeta) {
    const inBucket = new Set(order);
    const edges = new Map();
    const addEdge = (a, b) => {
        if (a === b) return;
        if (!edges.has(a)) edges.set(a, new Set());
        edges.get(a).add(b);
    };

    // Unlock chains: transitivity falls out of the topological repair below —
    // T->U and U->V yield the order T,U,V without an explicit closure.
    for (const id of order) {
        const meta = readEntry(taskMeta, id);
        const u = meta?.unlocksTask;
        if (u != null && inBucket.has(u)) addEdge(id, u);
    }

    // Mandatory/Prestige before Travel, per zone.
    const byZone = new Map();
    for (const id of order) {
        const meta = readEntry(taskMeta, id) ?? {};
        const z = meta.zone;
        let g = byZone.get(z);
        if (!g) { g = { travel: [], blocking: [] }; byZone.set(z, g); }
        if (meta.type === TASK_TYPE.Travel) g.travel.push(id);
        if (BLOCKS_TRAVEL.has(meta.type)) g.blocking.push(id);
    }
    for (const { travel, blocking } of byZone.values()) {
        for (const m of blocking) for (const t of travel) addEdge(m, t);
    }
    return edges;
}

/**
 * Stable, minimal-disturbance topological repair of a single bucket's task
 * order. Respects every "before" edge in `edges` while preferring each task's
 * current position as the tie-breaker, so a shuffle that already satisfies the
 * constraints is returned UNCHANGED. Throws on a constraint cycle.
 *
 * `order`: array of task ids (the shuffled bucket).
 * `edges`: Map<taskId, Set<taskId>> from buildBucketEdges.
 * Returns { order, moved } where `moved` counts positions that changed.
 */
export function repairBucketOrder(order, edges) {
    const pos = new Map(order.map((id, i) => [id, i]));
    const indeg = new Map(order.map((id) => [id, 0]));
    const succ = new Map(order.map((id) => [id, []]));
    for (const [a, outs] of edges) {
        if (!pos.has(a)) continue;
        for (const b of outs) {
            if (!pos.has(b)) continue;
            succ.get(a).push(b);
            indeg.set(b, indeg.get(b) + 1);
        }
    }

    const result = [];
    const remaining = new Set(order);
    while (result.length < order.length) {
        // Kahn's algorithm, selecting the earliest-position ready node: stable,
        // deterministic, and identity on an already-valid order.
        let pick = null;
        let pickPos = Infinity;
        for (const id of remaining) {
            if (indeg.get(id) === 0 && pos.get(id) < pickPos) {
                pick = id;
                pickPos = pos.get(id);
            }
        }
        if (pick === null) {
            throw new Error('repairBucketOrder: cycle in ordering constraints');
        }
        result.push(pick);
        remaining.delete(pick);
        for (const b of succ.get(pick)) indeg.set(b, indeg.get(b) - 1);
    }

    let moved = 0;
    for (let i = 0; i < result.length; i++) if (result[i] !== order[i]) moved++;
    return { order: result, moved };
}

/**
 * Build the Pass-B walk order (plan §2.1).
 *
 * Inputs:
 *   sphereLog     — post-fill sphere log (array of log records).
 *   playerId      — this player's id (string or number; both accepted).
 *   apLocations   — object taskId -> AP location name (payload-native
 *                   direction, value `${region_id}__${taskId}`); inverted
 *                   internally. Its key set is the v1 task universe.
 *   perkItemNames — iterable of perk item names (progression milestones).
 *   taskMeta      — Map|object taskId -> { type (TASK_TYPE int), zone,
 *                   unlocksTask (taskId|null) }.
 *   gateCounts    — Map|object taskId -> access-rule count (0 = no gate).
 *   seed          — world seed; a given seed always yields the same order.
 *
 * Returns { entries, report }:
 *   entries — total order, each { taskId, location, items: string[], bucket,
 *             synthesized }. `items` are the grants riding a log entry (empty
 *             for synthesized). `bucket` is the integer-sphere ordinal.
 *   report  — { buckets, logCovered, synthesized, repairsApplied }:
 *             buckets        = number of distinct buckets in the output,
 *             logCovered     = tasks sourced from the log (deduped),
 *             synthesized    = tasks added to complete the universe,
 *             repairsApplied = total entry positions moved by constraint repair.
 */
export function buildWalkOrder({
    sphereLog, playerId, apLocations, perkItemNames, taskMeta, gateCounts, seed,
}) {
    const perks = new Set(perkItemNames ?? []);

    // Invert apLocations (taskId -> name) into name -> taskId; its key set is
    // the universe the walk must cover.
    const nameToTask = new Map();
    const universeTaskIds = [];
    const locationForTask = new Map();
    for (const [taskId, locName] of Object.entries(apLocations ?? {})) {
        const id = Number(taskId);
        nameToTask.set(locName, id);
        locationForTask.set(id, locName);
        universeTaskIds.push(id);
    }

    // 1. Flatten -> dedup (first occurrence) -> group by integer sphere.
    const flat = extractLocationEntries(sphereLog ?? [], playerId);
    const seen = new Set();
    const logTaskIds = new Set();
    const bucketMap = new Map();   // bucketKey -> entry[]
    for (const e of flat) {
        const taskId = nameToTask.get(e.location);
        if (taskId == null) continue;      // other player / non-jta location
        if (seen.has(taskId)) continue;    // dedup: keep the first entry
        seen.add(taskId);
        logTaskIds.add(taskId);
        const bk = integerSphere(e.sphereIndex);
        if (!bucketMap.has(bk)) bucketMap.set(bk, []);
        bucketMap.get(bk).push({
            taskId,
            location: e.location,
            items: e.items.slice(),
            bucket: bk,
            synthesized: false,
        });
    }

    let bucketKeys = [...bucketMap.keys()].sort((a, b) => a - b);

    // 2. Cumulative perk grants BEFORE each bucket (grants in earlier buckets).
    const cumBefore = new Map();
    let acc = 0;
    for (const bk of bucketKeys) {
        cumBefore.set(bk, acc);
        for (const ent of bucketMap.get(bk)) {
            for (const it of ent.items) if (perks.has(it)) acc += 1;
        }
    }

    // Guarantee a bucket exists for a log with no jta progression (all
    // synthesized / empty log).
    if (bucketKeys.length === 0) {
        bucketKeys = [0];
        bucketMap.set(0, []);
        cumBefore.set(0, 0);
    }

    // 3. Synthesize every universe task absent from the log into the bucket
    //    whose preceding cumulative perks first satisfy its gate count.
    let synthesized = 0;
    for (const id of universeTaskIds) {
        if (logTaskIds.has(id)) continue;
        const raw = readEntry(gateCounts, id);
        const gate = raw == null ? 0 : Number(raw);
        let target = null;
        for (const bk of bucketKeys) {
            if (cumBefore.get(bk) >= gate) { target = bk; break; }
        }
        // Gate satisfied only after the final bucket's grants (or never in the
        // log): fall to the last bucket.
        if (target == null) target = bucketKeys[bucketKeys.length - 1];
        bucketMap.get(target).push({
            taskId: id,
            location: locationForTask.get(id) ?? null,
            items: [],
            bucket: target,
            synthesized: true,
        });
        synthesized += 1;
    }

    // 4. Per-bucket seeded shuffle (one deterministic stream over buckets, in
    //    order) then stable constraint repair.
    const rng = createRng(seed | 0);
    let repairsApplied = 0;
    const entries = [];
    for (const bk of bucketKeys) {
        const bucketEntries = bucketMap.get(bk);
        rng.shuffle(bucketEntries);
        const order = bucketEntries.map((e) => e.taskId);
        const edges = buildBucketEdges(order, taskMeta);
        const { order: repaired, moved } = repairBucketOrder(order, edges);
        repairsApplied += moved;
        const byId = new Map(bucketEntries.map((e) => [e.taskId, e]));
        for (const id of repaired) entries.push(byId.get(id));
    }

    return {
        entries,
        report: {
            buckets: bucketKeys.length,
            logCovered: logTaskIds.size,
            synthesized,
            repairsApplied,
        },
    };
}
