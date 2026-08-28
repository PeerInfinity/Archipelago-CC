/**
 * procgenCore/deepEqualKeyOrder — **A DEEP EQUALITY IN WHICH KEY ORDER IS
 * CONTENT**, shared by every cell-less `editCore` adapter (EDITOR INTEGRATION
 * slice B-c; §15.11's ONE decision, executed).
 *
 * ── ⛔⛔ WHY THIS IS NOT `editCore.canonicalJson` ──────────────────────
 *
 * The core ships `canonicalJson`, which SORTS keys at every depth, and it ships
 * it on purpose: a CELL DESCRIPTOR assembled by a spread has whatever order its
 * source object happened to have, and a flood keyed on the unsorted text would
 * stop at the first cell built differently. ⛔ A DOCUMENT is the opposite case.
 * Three substrates pin their key order in bytes somebody reads:
 *
 *   · the ATLAS — `verify-region-marking-tool` Phases D/E/G and the playthrough
 *     `--check` compare SAVED BYTES, and `atlasOps`' spreads are "key-order-exact
 *     on purpose";
 *   · the BOUNCE LEVEL — `_exportLevel` writes `JSON.stringify(level, null, 2)`
 *     to `<region>.level.json` and a `bounceDemo/fixtures/` file is hand-authored
 *     and diffed;
 *   · the RULES DOCUMENT — the APWorld editor's Apply publishes the doc the
 *     exporter round-trips, and `cloneFullRulesDoc` exists precisely to preserve
 *     every top-level key IN PLACE (`procgen_metadata`, `loop_costs`,
 *     `preset_sidecars`).
 *
 * A sorting `equal` would tell `foldEdits` that a key-order-only op moved
 * nothing, DROP it from the identity, and let the published bytes move
 * underneath a record that says they did not.
 *
 * ── ⛓ WHY IT LIVES HERE, AND WHY IT DID NOT BEFORE ────────────────────
 *
 * It shipped TWICE as the same twenty lines — `atlasEditAdapter.atlasesEqual`
 * and `bounceEditAdapter.levelsEqual` — and B-b measured that the second copy
 * was cheaper than the import it would have cost: importing the atlas one drags
 * `procgenCore/atlasOps.js`, a different substrate's whole op vocabulary, in for
 * a twenty-line predicate. ⛔ A THIRD COPY is the point at which that stops
 * being true, and B-c is the third (`rulesEditAdapter`). It lands in
 * `procgenCore/` — beside the core, not INSIDE it — because the core's own
 * comparison ships the opposite convention and a second exported equality in
 * `editCore.js` would read as a choice the core offers rather than a fact about
 * documents.
 *
 * ⛓ The two adapters keep their OWN NAMES for it (`export const atlasesEqual =
 * deepEqualKeyOrder`), so every row in their test files and every reader of
 * `adapter.equal` is unmoved — which is what makes the hoist provably
 * byte-inert rather than merely believed to be.
 *
 * ── ⛓ `a === b` FIRST, AT EVERY DEPTH ─────────────────────────────────
 *
 * Not a micro-optimisation. All three op modules are copy-on-write: they
 * rebuild the SPINE from the root to what changed and SHARE every untouched
 * node. The reference check therefore makes a comparison of two documents that
 * differ by one region cost the depth of that spine rather than a walk of a
 * 271 KB atlas or a multi-megabyte `rules.json`. It is what lets `equal` be
 * EXACT instead of cheap.
 *
 * ⚠ `undefined` is a VALUE here, not an absence: `{a:1}` and `{a:1, b:undefined}`
 * differ, because `Object.keys` sees the second key. That is the same answer
 * `JSON.stringify` would give a reader only by accident (it drops the key), and
 * both adapters' test files pin it.
 */

/**
 * ⛓ Deep equality over JSON-shaped values, with OBJECT KEY ORDER as content.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function deepEqualKeyOrder(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) if (!deepEqualKeyOrder(a[i], b[i])) return false;
        return true;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i += 1) {
        if (ka[i] !== kb[i]) return false;
        if (!deepEqualKeyOrder(a[ka[i]], b[kb[i]])) return false;
    }
    return true;
}

export default deepEqualKeyOrder;
