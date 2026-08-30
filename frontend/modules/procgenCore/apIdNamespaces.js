// frontend/modules/procgenCore/apIdNamespaces.js
//
// THE TABLE of AP numeric id namespaces in this repository, and the ONE
// allocator that mints ids from a base.
//
// §15 D11 / gap 10 called for "a location-id allocation policy". A policy that
// MOVED an id would be a breaking change to committed data, so this is not a
// policy that decides — it is a REGISTER that records, with provenance, every
// base that already exists and what pins it. Its job is to make a FOURTH
// namespace impossible to add silently: `apIdNamespaces.test.js` greps
// `frontend/modules` for id-base literals and for `ap_id_offset` in the game
// configs, and fails naming any value that is not a row here.
//
// ⛓ WHY IDS MAY NOT MOVE. `LOCATION_ID_BASE = 1000` is pinned by 29 preset
// byte-identity dumps; `30000000` by `verify-seedling-atlas-preset.mjs` and by
// `regionAtlasCompiler.test.js` (symbolically, so that test would follow a
// move — the DUMPS are what would not); `20000000` by the committed
// `worlds/seedling` presets. Nothing here changes a base. `pinnedBy` on each
// row says what would go red if one did.
//
// ⛓ ITEM IDS AND LOCATION IDS ARE SEPARATE AP ID SPACES. Archipelago keeps
// `item_name_to_id` and `location_name_to_id` apart, so a row whose
// `itemBase` EQUALS its `locationBase` (the atlas compiler: both 30000000) is
// not a collision, and the pipeline's `itemBase: 1` running into
// `locationBase: 1000` after 999 items is not one either. What must not
// overlap is TWO ROWS in the SAME space — which is why the two Seedling rows
// (`worlds/seedling` at 20000000, the atlas compiler at 30000000) are
// deliberately 10 million apart and `regionAtlasCompiler.test.js:156` asserts
// the gap.
//
// ⚠ ONE GENUINE INCONSISTENCY IS RECORDED, NOT FIXED (out of D0a's scope, and
// fixing it would move ids): APCALC's Python world numbers items from
// 234810000 and locations from 234810100, while the JS generator that writes
// its rules.json emits `id: node.index + 1` for locations and `itemId = 1` for
// items. The two halves of the same game do not agree. See the `apcalc-*` rows.

/**
 * @typedef {object} ApIdNamespace
 * @property {string} name
 * @property {number|null} locationBase  null = this producer mints no location ids
 * @property {number|null} itemBase      null = this producer mints no item ids
 * @property {string} owner              which producer mints from it
 * @property {string} declaredAt         path:line where the literal lives
 * @property {string} pinnedBy           what goes red if the base moves
 * @property {number} [nonApBase]       a base that is NOT an AP id namespace at
 *                                       all, recorded only so the census can
 *                                       account for the literal BY NAME instead
 *                                       of by an exception list.
 * @property {boolean} [reference]       true = declared OUTSIDE this module's
 *                                       reach (Python, or a submodule); recorded
 *                                       so the census can recognise it, never
 *                                       imported.
 * @property {string} [note]
 */

/** @type {readonly ApIdNamespace[]} */
export const AP_ID_NAMESPACES = Object.freeze([
    Object.freeze({
        name: 'procgen-pipeline',
        locationBase: 1000,
        itemBase: 1,
        owner: 'procgenPipelineEngine.buildRulesJson — a running counter in region-iteration order',
        declaredAt: 'frontend/modules/procgenPipeline/procgenPipelineEngine.js:2182-2183',
        pinnedBy: '29 preset byte-identity dumps (dump-topdown-byteidentity.mjs, dump-spiral-byteidentity.mjs, verify-topdown-steps.mjs)',
        note: 'The ONLY row whose two bases share a decade; harmless, see the docblock on separate id spaces.',
    }),
    Object.freeze({
        name: 'region-atlas',
        locationBase: 30000000,
        itemBase: 30000000,
        owner: 'regionAtlasCompiler.compileRegionAtlas — base + index in SORTED NAME order (allocateIdsBySortedName)',
        declaredAt: 'frontend/modules/procgenPipeline/regionAtlasCompiler.js:74-75',
        pinnedBy: 'verify-seedling-atlas-preset.mjs; regionAtlasCompiler.test.js:150-152 (symbolic — it would FOLLOW a move, the preset would not)',
    }),
    Object.freeze({
        name: 'flashpanel-seedling',
        locationBase: 20000000,
        itemBase: 20000000,
        owner: 'flashPanel per-game engine binding (`ap_id_offset`), mirrored by the hand-written Python world',
        declaredAt: 'frontend/modules/flashPanel/games/seedling.json:6 (+ worlds/seedling/{Items,Locations}.py:15/16 `offset`)',
        pinnedBy: 'the committed worlds/seedling presets; regionAtlasCompiler.test.js:156-160 asserts region-atlas ids clear it by >1e6',
    }),
    Object.freeze({
        name: 'flashpanel-robotkitty',
        locationBase: 21000000,
        itemBase: 21000000,
        owner: 'flashPanel per-game engine binding (`ap_id_offset`)',
        declaredAt: 'frontend/modules/flashPanel/games/robotkitty.json:6',
        pinnedBy: 'nothing yet — no committed robotkitty preset',
    }),
    Object.freeze({
        name: 'apcalc-world',
        locationBase: 234810100,
        itemBase: 234810000,
        owner: 'worlds/apcalc (Python)',
        declaredAt: 'worlds/apcalc/Locations.py:16, worlds/apcalc/Items.py:13',
        pinnedBy: 'the AP world itself',
        reference: true,
        note: '⚠ The JS generator for the SAME game does not use these — see apcalc-generator.',
    }),
    Object.freeze({
        name: 'apcalc-generator',
        locationBase: 1,
        itemBase: 1,
        owner: 'apcalcGeneratorEngine — `node.index + 1` for locations, a running `itemId` from 1',
        declaredAt: 'frontend/modules/apcalcGenerator/apcalcGeneratorEngine.js:949, :975',
        pinnedBy: 'nothing — the ids are emitted, never compared',
        note: '⚠ Disagrees with apcalc-world for the same game. Recorded, not fixed: changing either moves ids.',
    }),
    Object.freeze({
        name: 'jta-synthetic-task',
        locationBase: null,
        itemBase: null,
        nonApBase: 10000,
        owner: 'jtaSubstrateWrapper/bridge.js — SYNTHETIC_TASK_ID_BASE, a fork task id',
        declaredAt: 'frontend/modules/jtaSubstrateWrapper/bridge.js:87 (= 10000)',
        pinnedBy: 'jtaSubstrateWrapperTests.js:629 mirrors the constant',
        note: '⛔ NOT an AP namespace. It is in the table because the census grep sees `_ID_BASE = 10000` and must be able to account for it BY NAME rather than by an exception list.',
    }),
    Object.freeze({
        name: 'jta-artifact-task',
        locationBase: null,
        itemBase: null,
        nonApBase: 1_000_000,
        owner: 'journey-to-ascension/build/simulation.js — ARTIFACT_TASK_ID_BASE',
        declaredAt: 'frontend/modules/journey-to-ascension/build/simulation.js:250 (= 1_000_000)',
        pinnedBy: 'the fork',
        reference: true,
        note: '⛔ NOT an AP namespace, and inside a git SUBMODULE — recorded, never imported.',
    }),
]);

/**
 * Every distinct numeric base the table declares — what the census checks
 * against. `nonApBase` values are in here too: the census sweeps LITERALS, and
 * a literal it cannot name is a literal nobody has looked at, whether or not it
 * turns out to be an AP id.
 */
export const DECLARED_ID_BASES = Object.freeze(new Set(
    AP_ID_NAMESPACES.flatMap((n) => [n.locationBase, n.itemBase, n.nonApBase])
        .filter((v) => typeof v === 'number'),
));

/** The rows that really are AP id namespaces (the others are recorded, not owned). */
export const AP_NAMESPACE_ROWS = Object.freeze(
    AP_ID_NAMESPACES.filter((n) => n.locationBase != null || n.itemBase != null),
);

/** The row of a given name, or undefined. */
export const namespaceNamed = (name) => AP_ID_NAMESPACES.find((n) => n.name === name);

/**
 * `Map<name, id>` = base + the name's index in SORTED order.
 *
 * This is `regionAtlasCompiler`'s scheme, extracted verbatim: sorting means the
 * ids are a function of the NAME SET alone, with no dependence on authoring or
 * iteration order — which is what makes the compiled presets byte-stable across
 * an atlas edit that only reorders. Duplicate names collapse to one id (the
 * atlas validator enforces global uniqueness upstream, so a duplicate here
 * would be a caller's bug, not a silent double-allocation).
 *
 * ⛔ NOT every producer allocates this way. `procgenPipelineEngine` uses a
 * running counter in region-iteration order and must keep doing so — its 29
 * byte-identity dumps encode that order. It imports the BASE from this table
 * and nothing else.
 *
 * @param {Iterable<string>} names
 * @param {number} base
 * @returns {Map<string, number>}
 */
export function allocateIdsBySortedName(names, base) {
    return new Map([...new Set(names)].sort().map((name, i) => [name, base + i]));
}
