# `unplaced-pool-starting` — the Placements tab's "pool items placed nowhere" vs starting items and locked events

Cloud Opus build slice, 2026-10-01/02. Brief from `solver-derived-logic-planning`; defect found by
`topdown-apcalc-fill` (§6 of its report).

- **Branch:** `claude/fix-unplaced-pool-starting-hk4r3n` (the harness-designated branch; the brief's local name
  `unplaced-pool-starting` was not used). Base `origin/main` = `267f561776` (includes it).
- **Fix commit:** `9fa2bb5`. This report is the last commit on top of it.

## 1. The lost step and the fix

The pool's contract is set by the exporter: `exporter/games/base/world_data.py:51` `get_itempool_counts` counts every
**precollected** copy plus every **filled location** (events included). world_generator reads it back as
`count − _always_placed − starting_items` (`world_generator/_template_init.py:913–944`, `_always_placed` at `:203`),
and the hub's own grant writer already says the same (`rulesDocOps.js:2936`: *"the pool is precollected + placed"*).

`frontend/modules/apworldEditor/regionContent.js` `unplacedPoolItems` (now `:853–905`) subtracted only
`canonical_placements[p]`. So it lost two things, both measured:

| what was double-counted | measured before | after |
|---|---|---|
| **starting items** | 172 rows across the presets (apcalc ×4 / procgen_topdown AP_4–6: the 4 starting buttons each; metamath, ahit, …) | 0 rows where the starting copies cover the pool; 17 rows remain, each a genuine extra copy (kh1/kh2/paint/… — docs with no canonical placements; the starting copy IS subtracted there, see §4) |
| **locked events** (`_always_placed`) | 4410 event rows (apcalc / topdown AP_4–6: ~75 `Checked N` each; every exporter doc's `Victory`) | 0 |

The fix mirrors world_generator exactly:
- `starting_items[p]` counted **per entry** — a name, or `{name, count}` as `extract_starting_items`
  (`world_generator/extractors.py:624`) reads it;
- the **always-placed locations**, keyed by location together with `canonical_placements[p]` (a location in both
  counts once): a `locked` location's item — with canonical placements only an *event* lock (item `id == null` or
  `event: true`, or location `id == null`, as `extractors.py:376/434` define `is_event`); without them every lock —
  plus every `pinned` location.
- The return rows gained a `starting` field (`{item, pool, placed, starting, unplaced}`); the UI reads only
  `item`/`unplaced`.

The hub's `set-starting-count` op is untouched (it edits the starting list independently of `pool_count` by design).

## 2. Every other reader of `itempool_counts` in the editor / hub (`rg -a itempool_counts frontend/modules/apworldEditor`)

| reader | assumption | verdict |
|---|---|---|
| `regionContent.js:668/752` `applyZoneContent` | ±1 per added placement / displaced filler | consistent — no "unplaced" arithmetic; unchanged |
| `rulesDocOps.js:246/252` `poolOf`/`withPool`, `:733` rename, `:2936` `withGrants` | edit the raw field; grants add 1 pool + 1 starting | already honour the contract; unchanged |
| `rulesUtils.js:245` `validateRules` | pool keys must be defined items | membership only; unchanged (but see §4 `__max_*`) |
| `apworldEditorUI.js:1408/5948` the Items tab's pool input | shows/edits the raw count | raw field editor, no arithmetic; unchanged. Its tooltip "Number of this item placed in the item pool" is imprecise (the count includes starting copies) — left as is |
| `apworldEditorUI.js:2989` the Placements readout | — | reads `unplacedPoolItems`; fixed by the fix |

No other reader made the assumption.

## 3. Gates

- **Bounded vitest** `npx vitest run frontend/modules/apworldEditor/regionContent.test.js`: **77/77** passed
  (73 before + 4 new: starting copies cover the pool → `[]`; a starting item with an extra unplaced copy → that one
  row; event-item / event-location / pinned / non-event lock / location-in-both, with and without canonical
  placements; procgen_topdown AP_4–6 list no starting item and no event). One existing expectation updated for the
  new `starting` field. Callers of the changed function (`rg -a "unplacedPoolItems"`): `apworldEditorUI.js` and the
  in-app `apworldEditorTests.js` only — covered by the in-app run below.
- **Mutants:** A — starting subtraction reverted (`s = 0`) ⇒ **3 fail** (the two starting tests + the topdown preset
  test). B — always-placed reverted ⇒ **2 fail** (the always-placed test + the topdown preset test). Both restored.
- **In-app** `npm test -- --port=8160 --mode=test-substrates --batch=apworld`: with the fix **139/140**; baseline
  (the two files at `origin/main`) **139/140**. The one failure is the same in both:
  `apworld-build-downloads-a-loadable-apworld` (pyodide CDN, environmental). `compare-runs.js`: *"No differences in
  status, roster, or duration."* The zone-generate row that draws the readout
  (`apworld-a-zone-generate-shows-the-elapsed-ticker-and-lands`) passes.
- **Byte-neutrality:** only `regionContent.js`, `regionContent.test.js` and this report changed. No preset,
  producer or roster touched; no pytest / Generate.py run, so no preset dirt.

## 4. Questions for the user (not acted on — design choices)

1. **`__max_*` pseudo-keys.** The exporter writes `__max_progressive_bottle` / `__max_boss_heart_container` /
   `__max_heart_piece` into `itempool_counts` for ALttP-family docs (`world_data.py:76–82`). They are limits, not items,
   and the readout lists them as "placed nowhere" (497 rows across the presets; e.g. alttp_vanilla_worldgen:
   `__max_heart_piece ×24`). `validateRules` also flags them as unknown items. world_generator does not filter them
   either. Options: (a) the readout skips pool keys absent from `items[p]` (recommended — a key that is not an item
   cannot be placed); (b) skip `__`-prefixed keys only; (c) fix at the source — the exporter moves the limits out of
   `itempool_counts` (the family rule's choice, but it changes every ALttP-family preset and world_generator's
   reader). **Recommendation: (c) if the limits are wanted elsewhere, otherwise (a).**
2. **Docs with no canonical placements** (most original-world exports: adventure, kh1, …) list every pool item
   their exported seed placed as "placed nowhere" (6616 rows), because the editor's placement model is
   `canonical_placements` and those docs carry none. This is the readout's premise, not this defect; left as is.
3. **depgraph** docs list one `Node N` each: a non-event `locked` location missing from `canonical_placements`.
   world_generator also leaves it in the pool (randomised), so the readout now agrees with it; left as is.
