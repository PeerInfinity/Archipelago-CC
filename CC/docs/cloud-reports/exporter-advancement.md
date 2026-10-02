# exporter-advancement — cloud report (2026-10-02)

**Branch:** `claude/fix-exporter-advancement-stamping-fdbab7` (the harness's designated branch), cut from `origin/main`
at `267f561776`. Work commits:

| commit | what |
|---|---|
| `c7ee0fc5e` | fix: the exporter writes the placed item's own `advancement`; drop world_generator's dead `canonical_advancement_content` |
| `97096652c` | re-record `apcalc_worldgen` seed 1 (`_rules.json` only, 28 placements) |

The report is the last commit. Nothing is left for the user to decide (§2).

## 1. The lost step and the fix

**Lost step:** `exporter/exporter.py` (was ~2071–2075, in the region/location export). For each placed item it read
`world.__class__.canonical_placement_advancements` (keyed by LOCATION) and, when the location was in it, overwrote the
item's `advancement` with the canonical value. Whenever the placed item is not the canonical one, that writes another
item's `advancement`.

**Fix:** `exporter/exporter.py:2071–2081`. The placement now carries `getattr(location.item, 'advancement', False)`. That
is AP's own `Item.advancement` for the item actually placed, the same value Fill and the sphere log use.

Also: `world_generator/_template_init.py` built `canonical_advancement_content`, commented "used by the exporter to
preserve original advancement values during cross-validation". Nothing read it, so the 9 dead lines are gone. A world
regenerated with the old and new generator is `diff -r` identical, for both procgen_topdown AP_1/AP_4 and ALTTP. The
ALTTP one is also identical to the committed `worlds/alttp_worldgen` (ignoring `__pycache__`).

The generated class attribute `canonical_placement_advancements` stays. `_place_original_items` uses it to pick the
right pool copy of a mixed-classification item. **That is where per-instance advancement really lives.**

## 2. Why the override existed, measured, and why removal and not a guard

- The history is not available. The clone is shallow: `git log -S` reaches only the squashed import commit, and an
  `--unshallow` fetch did not finish. So this is measured, not read from history.
- **"Cross-validation"** is `scripts/test/test-world-generator.py` step 7/7. It runs a worldgen world's seed‑1 export
  against the ORIGINAL world's sphere log (plus step 5, a rules.json comparison with `ignore_canonical`). Both are seed 1
  only.
- **Per-instance advancement already travels with the item.** ALTTP's `Boss Heart Container` is defined as
  `ItemData(..., progression, ..., {"progression": 1, "useful": 9})`. The pool holds one progression copy and nine
  useful copies. `_place_original_items` selects the copy whose `advancement` matches `canonical_placement_advancements`.
- **Mutant "override removed entirely", all 15 committed worldgen presets at seed 1:** 14 are byte-identical
  (`_rules.json` and `_sphere_log.jsonl`) to a baseline regeneration at unchanged HEAD. That includes `alttp_worldgen`
  and `alttp_vanilla_worldgen`, with their 9 per-instance `Boss Heart Container advancement:false` placements. Only
  `apcalc_worldgen` moves.
- **Across all 14 worlds with the map:** wherever the placed item IS the canonical item, its own `advancement` equals
  the canonical value, with **0 exceptions**. Placements whose name differs from the canonical one: 34 in apcalc,
  57 in depgraph, 9 in metamath, 0 in the rest. So the override only ever acted where it stamps onto a DIFFERENT item.
- **A "same-name, same-player" guard** would therefore export the same bytes as removal at seed 1 everywhere. It could
  differ only at another seed, when Fill lands a different copy of a mixed-class item on a same-name canonical location.
  There the guard would be wrong (the export would disagree with the item Fill and the sphere log used). **That is not
  a real design fork, so I did not stop to ask.** Removal is the brief's "move per-instance advancement onto the item"
  option, and that option was already in place.

## 3. What moved

- `exporter/exporter.py`, `world_generator/_template_init.py`.
- **One committed preset:** `frontend/presets/apcalc_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json`.
  - 28/28 lines change, all `advancement`.
  - Its seed‑1 placement already differs from the canonical one at 34/161 locations, so the committed file carried 28
    stamped values that disagreed with the item placed (for example `Reach 6: Button: 1 advancement:false`,
    `Reach 145 L1: Junk advancement:true`).
  - Measured against AP (`'progression' in` the item's exported classification): **28 → 0 mismatches**. Item names with
    mixed `advancement`: 7 → 0.
  - Its sphere log, `.archipelago` and Spoiler are not committed changes. The `.archipelago`/Spoiler drift on
    regeneration is pre-existing and also appears at unchanged HEAD, so it was reverted.
- **Derived rosters:**
  - `rg -a apcalc_worldgen` outside presets and worlds finds `world-mapping.json`, `conftest.py` (where it is in
    `KNOWN_FLAKY_WORLDS`, excluded from pytest), docs file lists and stored `scripts/output/*` result JSONs.
  - None of these pins the rules.json bytes.

## 4. Gates

| gate | result |
|---|---|
| seed 1, all 15 committed worldgen templates (incl. ALTTP ×2), `Generate.py` at HEAD vs fixed, `cmp` `_rules.json` + `_sphere_log.jsonl` | 29/30 files identical. The one that differs is apcalc_worldgen `_rules.json` (§3), and the fixed output equals the override-removed mutant |
| seeds 2, 3 × procgen_topdown AP_1, AP_4 (world_generator `--canonical-seed 1` → `Generate.py` → export): placements whose `advancement` ≠ AP's for the item placed | **before** 14 / 10 / 22 / 26 (AP_1 s2, s3; AP_4 s2, s3), with 1/1/8/5 item names exporting mixed `advancement`, e.g. `Freeincarnate`. **After: 0 / 0 / 0 / 0**, 0 mixed |
| same runs, by location: re-exported `advancement` == canonical | before 25/25, 25/25, 161/161, 161/161 (the stamping); after 11/25, 15/25, 139/161, 135/161 |
| same runs, before vs after, every non-`advancement` line | identical in all 4 |
| apcalc_worldgen spoiler test (own sphere log), `npm test --mode=test-spoilers` | PASS (1/1) |
| cross-validation, apcalc_worldgen rules + ORIGINAL apcalc sphere log | FAIL before **and** after, identically (sphere 0, location/region missing=4 extra=4). Pre-existing: its seed‑1 placement does not reproduce the canonical one, and `scripts/output/world-generator/test-results-canonical.json` already records APCalc cross-validation as `fail`. Not changed by this slice |
| cross-validation, the other 13 worlds with the map | their seed‑1 exports are byte-identical, so no change is possible |
| pytest, every `test/*.py` naming the exporter or world_generator (`test_rules_json_writer_agreement`, `test_world_generator_apworld`, `test_loop_costs_export_roundtrip`, `test_rules_json_indent`, `test_export_player_slicing`) | **28 passed, 307 subtests**. The tree was clean afterwards. `pytest` had to be pip-installed into the venv |
| vitest | not applicable: no JS changed |

Generate runs used scratch `--player_files_path` / `--outputpath` with `< /dev/null`. The topdown worlds were in
`worlds/` only for each run. Presets were moved out and `preset_files.json` was reverted. The tree was checked clean
after each batch.

## 5. Mutant

The fix reverted: the HEAD exporter swapped back in, which is the "before" rows above.
- Seeds 2/3 re-stamp the canonical value: 25/25 and 161/161 by location, and 14/10/22/26 mismatches against AP.
- At seed 1, apcalc_worldgen regenerates the old committed `_rules.json` byte-for-byte (the baseline run).

## 6. Noted, not changed

`apcalc_worldgen` (and, at the name level only, `depgraph_worldgen` and `metamath_worldgen`) does not reproduce the
canonical placement at seed 1. `_place_original_items` leaves 34, 57 and 9 locations with a different item. That is why
APCalc's cross-validation fails. APCalc is parked (`conftest.py`: user, 2026-07-17), so it is out of scope here.

**Final SHA:** the commit that adds this report, on `claude/fix-exporter-advancement-stamping-fdbab7`.
