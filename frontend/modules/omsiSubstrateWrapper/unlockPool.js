/**
 * AP location/item pool derivation for the omsi unlock discretization
 * (unlock-discretization plan §7, AP-V1). Reads the FORK's own table
 * artifact — `frontend/modules/omsi-loops/data/unlockTable.json`, the
 * single source of truth — and turns its 620 loot-batch quantity rows
 * into the per-town locations, items and access rules the substrate
 * library emits.
 *
 * v1 pool = discovery quantity steps ONLY. Predicate rows (`u:` action
 * unlocks) are NOT locations in v1; hauls are already excluded by the
 * generator (`meta.excludedVars`).
 *
 * ── The loader (ruling (b)) ──────────────────────────────────────────
 * Env-branched and LAZY: a 262 KB artifact must never join the default
 * boot path, so nothing here runs until a world actually turns
 * `emitUnlockLocations` on. In the browser the fetch is PAGE-relative,
 * deliberately NOT `import.meta.url`-relative — under bundled mode
 * `import.meta.url` is the bundle's URL, not this module's, so a
 * module-relative URL resolves to garbage there (see
 * reference_bundled_modules_registration). In node `import.meta.url` IS
 * a real file URL, so the sibling-relative read is correct.
 *
 * `extractZoneRules` is synchronous and the pipeline's ① seam
 * (spiralSteps.js applySubstrateConfig, inside the sync stepArrange)
 * cannot await, so callers that enable emission must
 * `await ensureUnlockTable()` BEFORE running the pipeline. Emission
 * with an unloaded table throws a pointed error rather than silently
 * emitting an empty pool — a world that asked for locations and
 * silently got none is the worse failure.
 *
 * ── The access rules (ruling (c)) ────────────────────────────────────
 * Locations are ordered town-major by `(town, step/rowCount, var,
 * step)`; a location with global 0-indexed ordinal `i` in town `T`
 * carries `HasFromList(<supply-step names of towns ≤ T>, floor(i ×
 * K_≤T / L_≤T))`, where `L_≤T` counts supply-step locations in towns
 * ≤ T and `K_≤T` counts progression supply-step item copies in the
 * same towns. With the v1 1:1 pool the factor is 1 and the count
 * degenerates to `i` — the general form is written out anyway so a
 * later non-1:1 pool needs no re-derivation.
 *
 * `HasFromList`, never `HasFromListUnique`: the items are progressive
 * DUPLICATE COPIES of one name per var (14 names game-wide), so the
 * unique variant would cap every count at 14 and strand every deep
 * location as unreachable-in-logic. HasFromList sums copies in both
 * engines (rule_builder/rules.py; shared/ruleEngine/
 * ruleBuilderEvaluator.js).
 *
 * Town-scoping is the point of the user ruling: a deep town's copies
 * must not satisfy an early town's requirement.
 *
 * Soundness: the rule is deliberately CONSERVATIVE. The locations fire
 * on base-rate dimension crossings, which are grindable with zero items
 * — so logic understates real reachability, which is the safe direction
 * and is exactly what mints a usable sphere order.
 */

// ────────────────────────────────────────────────────────────────
// Loader
// ────────────────────────────────────────────────────────────────

// Page-relative in the browser (see header). The app is served with
// `frontend/` as the document root, the same base every preset fetch
// uses.
const BROWSER_TABLE_URL = './modules/omsi-loops/data/unlockTable.json';

let _table = null;          // the resolved artifact
let _tablePromise = null;   // in-flight load (idempotence)

function _isNode() {
    return typeof window === 'undefined'
        && typeof process !== 'undefined'
        && process.versions?.node != null;
}

async function _loadTable() {
    if (_isNode()) {
        const fs = await import('node:fs');
        const url = new URL('../omsi-loops/data/unlockTable.json', import.meta.url);
        return JSON.parse(fs.readFileSync(url, 'utf8'));
    }
    const res = await fetch(BROWSER_TABLE_URL);
    if (!res.ok) {
        throw new Error(`omsi unlockTable fetch failed: ${res.status} ${BROWSER_TABLE_URL}`);
    }
    return res.json();
}

/**
 * Resolve the fork's unlock table. Idempotent — concurrent and repeat
 * callers share one load. Callers that enable `emitUnlockLocations`
 * MUST await this before running the procgen pipeline (the ① seam is
 * synchronous).
 * @returns {Promise<object>} the parsed artifact
 */
export function ensureUnlockTable() {
    if (_table) return Promise.resolve(_table);
    if (!_tablePromise) {
        _tablePromise = _loadTable().then((t) => {
            _table = t;
            return t;
        }).catch((err) => {
            _tablePromise = null;   // let a later caller retry
            throw err;
        });
    }
    return _tablePromise;
}

/** The loaded table, or null. Synchronous — for the emission path. */
export function getUnlockTableSync() {
    return _table;
}

/** Test seam: install a table directly / clear the cache. */
export function _setUnlockTableForTests(table) {
    _table = table ?? null;
    _tablePromise = null;
    _poolCache = null;
}

// ────────────────────────────────────────────────────────────────
// Pool derivation
// ────────────────────────────────────────────────────────────────

export const OMSI_FILLER_ITEM_NAME = 'Bonus Seconds';

/**
 * Map an AP item copy `count` to capacity BATCHES for a var with native
 * rowCount `R` and item count `I` (arc A ruling (c)/(d)). The bridge's
 * `_qBatchesFromInventory` calls this so the multiplier has ONE home.
 *
 * `round(count × R / I)`: even distribution — every copy grants ≥1 batch
 * (no wasted tail copies), and a full set (`count = I`) = `round(R) = R`
 * batches = exactly baseMax capacity. The fork's `min(batches, rowCount)`
 * cap is belt-and-braces (`count ≤ I ⇒ batches ≤ R`).
 *
 * Degrades to `count` when `R`/`I` is missing or ≤0 — the scale-1
 * (itemCount absent ⇒ `I = R`) and unmanaged cases both land here as the
 * identity, keeping the AP-V1 behavior byte-identical.
 */
export function qBatchesForCount(count, R, I) {
    const r = Number(R);
    const i = Number(I) || r;   // itemCount absent ⇒ 1:1 with rowCount
    return r > 0 && i > 0 ? Math.round((count * r) / i) : count;
}

/** The AP item name carrying one capacity batch for `varName`. */
export function supplyStepItemName(varName) {
    return `${varName} Supply Step`;
}

/**
 * AP-safe location id for a quantity row: `q:0:Pots:1` → `q_0_Pots_1`.
 * compileRegionGraph mints the AP location name `${region_id}__${id}`,
 * and colons in AP names travel badly through the yaml/spoiler layers.
 * The RAW row id is preserved as the `ap_locations` KEY, because that
 * is what the fork's seedReportedLocations/onUnlockAchieved speak.
 */
export function sanitizeRowId(rowId) {
    return String(rowId).replace(/[^A-Za-z0-9_]/g, '_');
}

/**
 * Selected step set for a var with native rowCount `R` and target
 * location count `L` (arc A ruling (a)). Steps are evenly-spaced in the
 * step index (≡ base-rate total, since row k's base total is
 * k × oneInEvery): `k_j = round(j × R / L)`, forced strictly increasing,
 * with the deepest pinned to `R` so a full item set's last location
 * fires at exactly 100% Explored.
 *
 * Collisions cannot occur while `L ≤ R` (target spacing `R/L ≥ 1`); the
 * loop bumps a colliding index to the next higher row defensively, then
 * clamps at `R`. The returned Set's size is the ACTUAL location count for
 * the var (`= L` in every non-pathological case) and is what the pool
 * reports as `itemCount` — keeping `|items| = |locations|` exact.
 */
function _selectSteps(R, L) {
    const set = new Set();
    let prev = 0;
    for (let j = 1; j <= L; j++) {
        let k = Math.round((j * R) / L);
        if (k <= prev) k = prev + 1;   // defensive: strictly increasing
        if (k > R) k = R;
        set.add(k);
        prev = k;
    }
    set.add(R);   // pin the deepest location to the native ceiling
    return set;
}

let _poolCache = null;   // { towns, scale, table, pool }

/**
 * Build the whole emitted pool for a world of `townCount` towns, scaled
 * by `scale ∈ (0, 1]` (arc A). `scale = 1` selects every native row and
 * reproduces the AP-V1 pool EXACTLY — the byte-inertness witness.
 *
 * Per (town, var) with native rowCount `R_v`:
 *   `L_v = I_v = clamp(round(scale × R_v), 1, R_v)`
 * locations = the `L_v` selected rows (see `_selectSteps`); items =
 * `I_v = L_v` in v1 (one supply-step copy per selected location). The
 * native `R_v` is computed BEFORE selection and is what
 * `unlockMeta.rowCount` reports (the capacity grain) and the denominator
 * of the town-major normalized-rank sort — neither shrinks with scale.
 *
 * Note each var lives in exactly ONE town (verified against the
 * artifact: 14 vars, disjoint town assignment), so "the supply-step
 * names of towns ≤ T" is simply the vars of those towns and no
 * cross-town var deduping is needed.
 *
 * @returns {{
 *   townCount: number,
 *   zones: Array<{town: number, locations: Array<object>}>,
 *   varsByTown: Map<number, string[]>,
 *   itemNames: string[],
 *   totalCopies: number,
 *   rowCount: Map<string, number>,
 *   itemCount: Map<string, number>,
 * }}
 */
export function buildUnlockPool(townCount, scale = 1) {
    const towns = Math.max(0, Math.trunc(townCount));
    const s = Number.isFinite(scale) && scale > 0 ? Math.min(1, scale) : 1;
    if (_poolCache && _poolCache.towns === towns
        && _poolCache.scale === s && _poolCache.table === _table) {
        return _poolCache.pool;
    }
    const table = _table;
    if (!table) {
        throw new Error(
            'omsi unlock emission requested before the unlock table loaded — '
            + 'await ensureUnlockTable() from omsiSubstrateWrapper/unlockPool.js '
            + 'before running the procgen pipeline',
        );
    }

    // Native (pre-selection) rows for the included towns.
    const nativeRows = (table.quantities ?? []).filter(
        (r) => r.apEligible !== false && r.town < towns,
    );

    // Native rowCount per (town, var) — R_v. Computed BEFORE selection:
    // it is the capacity grain (unlockMeta.rowCount) and the normalized-
    // rank sort denominator, neither of which shrinks with scale.
    const rowCount = new Map();
    for (const r of nativeRows) {
        const key = `${r.town}:${r.var}`;
        rowCount.set(key, (rowCount.get(key) ?? 0) + 1);
    }

    // The selection: L_v = I_v = clamp(round(scale·R_v), 1, R_v), and the
    // selected step set per var. `itemCount` is the actual selected count
    // (= L_v), carried through as its own field so the later L ≠ I split
    // touches only this computation and the `K = L` line, not the plumbing.
    const itemCount = new Map();      // town:var → I_v (= L_v in v1)
    const selectedSteps = new Map();  // town:var → Set<step>
    for (const [key, R] of rowCount) {
        const L = Math.min(R, Math.max(1, Math.round(s * R)));
        const set = _selectSteps(R, L);
        selectedSteps.set(key, set);
        itemCount.set(key, set.size);
    }

    // Keep only the selected rows. Everything downstream sees fewer rows
    // but is otherwise unchanged (scale 1 ⇒ every row selected).
    const rows = nativeRows.filter(
        (r) => selectedSteps.get(`${r.town}:${r.var}`)?.has(r.step),
    );

    // Town-major order: (town, normalized rank, var, step).
    const ordered = [...rows].sort((a, b) => {
        if (a.town !== b.town) return a.town - b.town;
        const ra = a.step / rowCount.get(`${a.town}:${a.var}`);
        const rb = b.step / rowCount.get(`${b.town}:${b.var}`);
        if (ra !== rb) return ra - rb;
        if (a.var !== b.var) return a.var < b.var ? -1 : 1;
        return a.step - b.step;
    });

    // Vars per town, in a stable (alphabetical) order within the town;
    // the cumulative item list is built town by town, so the resulting
    // list is town-ordered as the ruling requires.
    const varsByTown = new Map();
    for (const r of rows) {
        if (!varsByTown.has(r.town)) varsByTown.set(r.town, new Set());
        varsByTown.get(r.town).add(r.var);
    }
    for (const [town, set] of varsByTown) {
        varsByTown.set(town, [...set].sort());
    }

    // L_≤T and K_≤T. The v1 pool is 1:1 (one progression copy per
    // supply-step location), so K_≤T === L_≤T; the ratio is carried
    // explicitly so a later non-1:1 pool only changes THIS line.
    const locsPerTown = new Map();
    for (const r of rows) locsPerTown.set(r.town, (locsPerTown.get(r.town) ?? 0) + 1);

    const cumulativeLocs = new Map();   // town → L_≤town
    const cumulativeItems = new Map();  // town → names of towns ≤ town
    let runningLocs = 0;
    const runningNames = [];
    for (let t = 0; t < towns; t++) {
        runningLocs += locsPerTown.get(t) ?? 0;
        for (const v of (varsByTown.get(t) ?? [])) runningNames.push(supplyStepItemName(v));
        cumulativeLocs.set(t, runningLocs);
        cumulativeItems.set(t, [...runningNames]);
    }
    const totalLocs = runningLocs;
    const totalCopies = totalLocs;   // 1:1 pool

    const zones = [];
    for (let t = 0; t < towns; t++) zones.push({ town: t, locations: [] });

    ordered.forEach((row, i) => {
        const T = row.town;
        const L = cumulativeLocs.get(T) ?? 0;
        // K_≤T: 1:1 with the locations of those towns.
        const K = L;
        const count = L > 0 ? Math.floor((i * K) / L) : 0;
        zones[T].locations.push({
            rowId: row.id,
            id: sanitizeRowId(row.id),
            varName: row.var,
            town: T,
            step: row.step,
            ordinal: i,
            item: supplyStepItemName(row.var),
            count,
            itemNames: cumulativeItems.get(T) ?? [],
        });
    });

    const itemNames = [];
    for (let t = 0; t < towns; t++) {
        for (const v of (varsByTown.get(t) ?? [])) itemNames.push(supplyStepItemName(v));
    }

    const pool = {
        townCount: towns, zones, varsByTown, itemNames, totalCopies, rowCount, itemCount,
    };
    _poolCache = { towns, scale: s, table: _table, pool };
    return pool;
}

/**
 * The access rule for one emitted location. `count === 0` → null, and
 * the caller omits `access_rule` entirely so the engine applies its
 * `True_` default (jta precedent, jtaSubstrateWrapperLibrary.js).
 */
export function accessRuleFor(loc) {
    if (!loc || !(loc.count > 0)) return null;
    return { rule: 'HasFromList', args: { item_names: loc.itemNames, count: loc.count } };
}

/**
 * The victory access rule: every supply-step copy but one. Ruling (f) —
 * victory rides the LAST included town's `travel_onward`.
 */
export function victoryAccessRule(pool) {
    const count = Math.max(0, (pool.totalCopies ?? 0) - 1);
    if (count <= 0) return null;
    return { rule: 'HasFromList', args: { item_names: pool.itemNames, count } };
}

/**
 * `{itemName: varName}` + `{var: {town, rowCount[, itemCount]}}` for the
 * WHOLE world. `itemCount` (I_v) is present only on a SCALED var
 * (I_v ≠ R_v); the bridge reads it to map item copies → capacity batches
 * as `round(count × R_v / I_v)`.
 *
 * Deliberately world-scoped, not zone-scoped, even though it rides each
 * zone's payload. The unlock overlay is GLOBAL engine state, and a var
 * absent from `qBatches` is UNMANAGED (native capacity) — so the
 * bridge's overlay push must name every var of every included town no
 * matter which town's region the player happens to be standing in.
 * Handing a zone only its own town's vars would leave towns 1..N-1
 * running native capacity until the player walked into them. Each var
 * carries its own `town`, so per-zone information is not lost.
 *
 * (For the shipped towns=1 fixture, world scope and zone scope
 * coincide.)
 */
export function unlockMetaForWorld(pool) {
    const itemToVar = {};
    const varMeta = {};
    for (const [town, vars] of [...pool.varsByTown.entries()].sort((a, b) => a[0] - b[0])) {
        for (const v of vars) {
            itemToVar[supplyStepItemName(v)] = v;
            const key = `${town}:${v}`;
            const R = pool.rowCount.get(key) ?? 0;
            const I = pool.itemCount?.get(key) ?? R;
            // `itemCount` rides only when the pool is scaled (I ≠ R). Its
            // ABSENCE at scale 1 is what keeps the shipped
            // omsi_randomized_test payload byte-identical.
            varMeta[v] = (I !== R)
                ? { town, rowCount: R, itemCount: I }
                : { town, rowCount: R };
        }
    }
    return { itemToVar, vars: varMeta };
}
