/**
 * regionMarkingTool/atlasEditAdapter — the region ATLAS as an `editCore`
 * adapter (EDITOR INTEGRATION slice B-a; plan §3.1's marking-tool row).
 *
 * ── WHAT WAS ALREADY THERE, AND WHAT WAS MISSING ───────────────────────
 *
 * `procgenCore/atlasOps.applyAtlasOp` has BEEN `adapter.apply` since EDITOR v3
 * D0b in all but its return shape: pure, copy-on-write, `{ok, atlas, value,
 * description}` with the refusal sentences the marking tool's UI copy and
 * `atlasSession.test.js` pin. This file adds the other four members so an
 * `editSession` — and therefore UNDO — can be opened on an atlas.
 *
 * ── ⛔⛔ THE THREE THINGS MEASUREMENT OVERTURNED IN THE BRIEF ───────────
 *
 *  1. **`equal` is NOT `computeAtlasContentHash`.** The brief asked for the
 *     validator's own identity on the grounds that `canonicalJson` "sorts
 *     keys". Measured: `contentIdentity.stableStringify` (what the hash is
 *     computed over) and `editCore.canonicalJson` are the SAME algorithm —
 *     both `Object.keys(v).sort()` at every depth — and the identity module
 *     says so in its own header: *"Key ORDER in the document is therefore NOT
 *     content"*. The hash is strictly WEAKER than `canonicalJson`: it also
 *     STRIPS `provenance` and `atlas_id`, and folds to 32 bits, so two
 *     documents that differ can collide. Either one would tell `foldEdits`
 *     that a key-order-only op moved nothing and drop it from the identity —
 *     on a document whose committed bytes (`check-region-marking-tool`
 *     Phases D/E/G, the playthrough `--check`) are gated WITH their key order,
 *     and whose op module spells out that its spreads are "key-order-exact on
 *     purpose". So `equal` is `atlasesEqual` below: a deep equality in which
 *     KEY ORDER IS CONTENT.
 *  2. **A TILE has no sub-region.** The brief's descriptor carried
 *     `subRegion`. Measured: `subgraph.sub_regions` is a flat list of ids and
 *     nothing in the document maps a tile to one (membership is recomputed by
 *     the analyzer from the terrain, deliberately not persisted —
 *     `regionMarkingToolUI`'s own note). A top-level `subRegion` would be
 *     `null` at every cell of every committed atlas, which is the shape a
 *     reader mistakes for a mechanism. It rides INSIDE the location
 *     descriptor, where the document actually stores it.
 *  3. **`bounds` is a MAP-document fact, and so is the LEVEL.** Region
 *     `bounds` are level-local (measured: all four committed regions start at
 *     0,0 on four different `map_ref`s), so a cell (x, y) means nothing
 *     without the level it is on. `levelView()` therefore answers
 *     `{level, width, height}` and not just a size — `readCell` filters
 *     regions by `map_ref` exactly as `_onPlainClick` does.
 *
 * ── ⛓ WHAT `writeOps` WRITES, AND WHAT IT REFUSES BY NAME ──────────────
 *
 * The atlas's nouns are NAMED: a region is a rectangle with an id, an exit is
 * a run of tiles whose `side` is DERIVED from which bounds line it sits on,
 * and a location's `name` is a GLOBAL AP id. None of the three can be
 * reconstructed from one cell without inventing something. What IS a per-tile
 * fact, and has an atomic op:
 *
 *   · the LOCATION at the tile   → `add-location` (its global-name refusal is
 *     the existing op's, verbatim, when the name is already taken);
 *   · the ENTRANCE of an exit    → `set-entrance-tile` (which refuses unless
 *     the tile is already one of that exit's tiles).
 *
 * and what it refuses by name: a descriptor with no `region` to write into,
 * and one carrying a region or an exit as an OBJECT rather than an id.
 *
 * ⚠ THE TILE'S MEMBERSHIP OF `exit_tiles` IS NOT WRITABLE, and that is a
 * measurement rather than an omission: the vocabulary (`ATLAS_OP_KINDS`, 18
 * kinds) has `add-exit`/`remove-exit` and nothing that grows an existing run,
 * and re-creating the exit from one tile would re-derive its `side` from a
 * bounds line that tile may not be on. `writeOps` emits nothing for it and
 * says so here rather than inventing a nineteenth op for a gesture the
 * marking tool does not offer.
 */

import { applyAtlasOp } from '../procgenCore/atlasOps.js';
import { deepEqualKeyOrder } from '../procgenCore/deepEqualKeyOrder.js';

/**
 * ⛓⛓⛓ **EQUALITY IN WHICH KEY ORDER IS CONTENT** — see overturn 1 above.
 *
 * ⛓ THE TWENTY LINES MOVED (EDITOR INTEGRATION B-c, plan §15.11): they are
 * `procgenCore/deepEqualKeyOrder.js` now, shared with the bounce level's
 * adapter and the rules document's — the third copy was the point at which the
 * import stopped costing more than it saved. ⛔ THE NAME STAYS, so every row in
 * this file's test and every reader of `adapter.equal` is unmoved; the hoist's
 * own test asserts `atlasesEqual === deepEqualKeyOrder`, which is what makes it
 * provably the same function rather than the same behaviour.
 *
 * ⚠ `a === b` FIRST, at every depth, is still the reason it is affordable here:
 * `atlasOps` rebuilds only the spine from the root to what an op changed and
 * SHARES every untouched node, so comparing two documents that differ by one
 * region costs the depth of that spine rather than a walk of a 271 KB
 * playthrough atlas.
 */
export const atlasesEqual = deepEqualKeyOrder;

const isTile = (t) => Array.isArray(t) && t.length === 2
    && Number.isInteger(t[0]) && Number.isInteger(t[1]);
const contains = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o ?? {}, k);

/**
 * ⛓ THE SMALLEST REGION OF THIS LEVEL CONTAINING THE TILE — `_onPlainClick`'s
 * body (`regionMarkingToolUI.js:330-342`), moved here whole so the panel's
 * "what is under the pointer" and the adapter's `readCell` cannot disagree.
 */
export function regionAt(atlas, level, x, y) {
    return (atlas.regions ?? [])
        .filter((r) => r.map_ref === level && contains(r.bounds, x, y))
        .sort((a, b) => a.bounds.w * a.bounds.h - b.bounds.w * b.bounds.h)[0] ?? null;
}

/**
 * ⛓ THE CELL, AS A DESCRIPTOR. Ids, never objects — see the file docblock:
 * an id is what a cell can honestly carry and what an op addresses.
 */
export function readAtlasCell(atlas, level, x, y) {
    const region = regionAt(atlas, level, x, y);
    if (!region) return { region: null, exit: null, entrance: false, location: null };
    const exit = (region.exits ?? []).find(
        (e) => e.exit_tiles.some((t) => t[0] === x && t[1] === y),
    ) ?? null;
    const loc = (region.locations ?? []).find(
        (l) => isTile(l.tile) && l.tile[0] === x && l.tile[1] === y,
    ) ?? null;
    const location = loc === null ? null : {
        name: loc.name,
        ...(loc.vanilla_item !== undefined ? { vanilla_item: loc.vanilla_item } : {}),
        ...(loc.sub_region !== undefined ? { sub_region: loc.sub_region } : {}),
        ...(loc.access_rule !== undefined ? { access_rule: loc.access_rule } : {}),
    };
    return {
        region: region.region_id,
        exit: exit === null ? null : exit.exit_id,
        entrance: exit !== null && isTile(exit.entrance_tile)
            && exit.entrance_tile[0] === x && exit.entrance_tile[1] === y,
        location,
    };
}

/** ⛓ THE INVERSE, for the two facts a cell can honestly carry. */
export function atlasWriteOps(desc, x, y) {
    if (desc === null || typeof desc !== 'object' || Array.isArray(desc)) {
        throw new Error(`atlasEditAdapter: writeOps takes a cell descriptor object, got ${JSON.stringify(desc)}`);
    }
    if (desc.region !== null && typeof desc.region !== 'string') {
        throw new Error('atlasEditAdapter: writeOps REFUSES a descriptor whose `region` is not an '
            + `id (got ${JSON.stringify(desc.region)}) — a region is a RECTANGLE WITH AN ID, and `
            + 'writing one from a cell would have to invent both. `readCell` reports the id of '
            + 'the region a tile falls in; that id is the ADDRESS the per-tile ops write to, '
            + 'never a region to create.');
    }
    if (desc.exit !== null && desc.exit !== undefined && typeof desc.exit !== 'string') {
        throw new Error('atlasEditAdapter: writeOps REFUSES a descriptor whose `exit` is not an '
            + `id (got ${JSON.stringify(desc.exit)}) — an exit is a NAMED run of tiles whose `
            + '`side` is DERIVED from the bounds line it sits on, so re-creating one from a '
            + 'single cell would invent its geometry.');
    }
    if (typeof desc.region !== 'string' || desc.region === '') {
        throw new Error('atlasEditAdapter: writeOps REFUSES a descriptor with no `region` — a '
            + `tile at (${x},${y}) that falls in no region of this level has nothing to write `
            + 'into, and every per-tile op in the vocabulary is addressed BY REGION.');
    }
    const out = [];
    if (has(desc, 'location') && desc.location) {
        const l = desc.location;
        out.push({
            op: 'add-location',
            region: desc.region,
            name: l.name,
            tile: [x, y],
            ...(l.vanilla_item !== undefined ? { vanilla_item: l.vanilla_item } : {}),
            ...(l.sub_region !== undefined ? { sub_region: l.sub_region } : {}),
            ...(l.access_rule !== undefined ? { access_rule: l.access_rule } : {}),
        });
    }
    if (has(desc, 'entrance') && desc.entrance === true && typeof desc.exit === 'string') {
        out.push({
            op: 'set-entrance-tile', region: desc.region, exit: desc.exit, tile: [x, y],
        });
    }
    return out;
}

/**
 * ⛓⛓ THE ADAPTER. `levelView` is the one thing an atlas op does not carry —
 * which LEVEL's cell space (x, y) names — so it is a construction parameter
 * here rather than a default this file invents, exactly as
 * `createMazeEditAdapter({locationNameFormat})` takes its page convention.
 *
 * @param {{levelView: () => ({level: number, width: number, height: number}|null)}} deps
 */
export function createAtlasEditAdapter({ levelView } = {}) {
    if (typeof levelView !== 'function') {
        throw new Error('createAtlasEditAdapter: `levelView` is REQUIRED and answers the '
            + 'CURRENT level `{level, width, height}` — region bounds are level-local (every '
            + 'committed region starts at 0,0 on a different `map_ref`), so a cell (x, y) '
            + 'means nothing without it. There is no level this module can guess.');
    }
    const view = (what) => {
        const v = levelView();
        if (!v || !Number.isInteger(v.width) || !Number.isInteger(v.height)
            || v.width <= 0 || v.height <= 0) {
            throw new Error(`atlasEditAdapter: ${what} needs the current level, and \`levelView\` `
                + `answered ${JSON.stringify(v)}. The map document is not loaded yet — a cell `
                + 'space is a fact about the MAP, not about the atlas.');
        }
        return v;
    };

    /**
     * ⛓ **THE VALUE CHANNEL, AND WHY IT IS A SLOT.** `applyAtlasOp` answers
     * `value` — the live node the op created or touched — and all sixteen
     * `AtlasSession` methods have RETURNED it since Phase 2 (`const r =
     * session.addRegion(…)`). `createEditSession`'s own `apply` answers
     * `{ok, applied, op, description}` and drops it. So the adapter records it
     * and the session drains it in the same tick.
     *
     * ⛔ NOT A CACHE. It is meaningful only IMMEDIATELY after an `apply` that
     * returned `ok`, and every fold (an undo re-applies the whole list)
     * overwrites it. Nothing reads it except `AtlasSession.apply`, one line
     * later.
     */
    let lastValue;

    return Object.freeze({
        name: 'atlas',

        /**
         * ⛓ ONE ATOMIC OP. ⛔ The refusal sentence is `atlasOps`' OWN, verbatim
         * and unprefixed: `AtlasSession` throws it, `atlasSession.test.js` pins
         * it and the marking tool's status line prints it, so a `atlas: `
         * prefix here (the maze adapter's shape) would move eleven pinned
         * strings for cosmetics.
         */
        apply(record, op) {
            const res = applyAtlasOp(record, op);
            if (!res.ok) return { ok: false, description: res.error };
            lastValue = res.value;
            return { ok: true, description: res.description, record: res.atlas };
        },
        equal: atlasesEqual,
        bounds: () => {
            const v = view('bounds');
            return { w: v.width, h: v.height };
        },
        readCell: (record, x, y) => readAtlasCell(record, view('readCell').level, x, y),
        writeOps: atlasWriteOps,

        /** ⛓ Drain the value slot — see `lastValue`. */
        takeLastValue() {
            const v = lastValue;
            lastValue = undefined;
            return v;
        },
    });
}
