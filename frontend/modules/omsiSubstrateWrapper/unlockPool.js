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

let _poolCache = null;   // { towns, pool }

/**
 * Build the whole emitted pool for a world of `townCount` towns.
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
 * }}
 */
export function buildUnlockPool(townCount) {
    const towns = Math.max(0, Math.trunc(townCount));
    if (_poolCache && _poolCache.towns === towns && _poolCache.table === _table) {
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

    const rows = (table.quantities ?? []).filter(
        (r) => r.apEligible !== false && r.town < towns,
    );

    // rowCount per (town, var) — the denominator of the normalized rank.
    const rowCount = new Map();
    for (const r of rows) {
        const key = `${r.town}:${r.var}`;
        rowCount.set(key, (rowCount.get(key) ?? 0) + 1);
    }

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

    const pool = { townCount: towns, zones, varsByTown, itemNames, totalCopies, rowCount };
    _poolCache = { towns, table: _table, pool };
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
 * `{itemName: varName}` + `{var: {town, rowCount}}` for the WHOLE world.
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
            varMeta[v] = { town, rowCount: pool.rowCount.get(`${town}:${v}`) ?? 0 };
        }
    }
    return { itemToVar, vars: varMeta };
}
