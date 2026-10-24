# multiworld-alttp-p2 — the multiworld ALttP slot fails its spoiler test in Ganon's Tower

Cloud Opus slice, 2026-10-02, launched by `solver-derived-logic-planning`.

- **Branch:** `claude/multiworld-alttp-p2-spoiler-9i0klz` (the harness-designated branch; the brief's local name
  `multiworld-alttp-p2` was not used). Base `origin/main` = `d47baf6f6f` (as required).
- **Commits:** `32e1c40a` (the fix + 6 re-exported multiworld presets), `88f60fab` (regression test). This report is
  the last commit on top of them.
- **Outcome: FIXED.** It is a one-line exporter change at the step where the information was lost. The blast radius was
  measured: 6 preset files move, and every other committed document carrying the rule regenerates byte-identical.
  No `shared` submodule change, no frontend change.

## 1. Diagnosis

**Symptom (seed 1).** The results JSON has `Sphere 12.8: Location mismatch - missing: 9, extra: 0`
(`Ganons Tower - Big Key Chest`, `Big Key Room - Left/Right`, `Bob's Chest`, `Firesnake Room`, the four
`Randomizer Room` chests) and `Region mismatch - missing: 2`. In the sphere log, sphere 12.8 is when player 2 collects
its 5th `Small Key (Ganons Tower)`, and that opens `Ganons Tower (Bottom)` via the Compass Room.

**The rule (from the P2 document).** `Ganons Tower (Compass Room)` → exit `Ganons Tower (Bottom) (East)`:

```
Or( And( Has(Small Key (GT), 5),
         AST_placement_search{item: "Big Key (Ganons Tower)", player: 1,
                              locations: [["Ganons Tower - Bob's Chest", 2], …] } ),
    Has(Small Key (GT), 7) )
```

The pairs say player **2**, but the searched-for item's owner says **1**. On seed 1 the GT Big Key is at
`Ganons Tower - Randomizer Room - Top Left` with `item.player == 2`. The rule-builder evaluator
(`frontend/modules/shared/ruleEngine/ruleBuilderEvaluator.js:96–160`) requires `itemPlayer === searchPlayer`, so this
never matches. The 5-key branch is always false, and the frontend waits for 7 keys. Python's
`item_name_in_location_names` (`worlds/generic/Rules.py:141`) compares against `(item, player)` with the real slot id,
so the generator opens the room at 5 keys.

**Where the information is lost.** `exporter/games/base/handler.py:848–866`, `handle_special_function_call`.
`item_name_in_location_names(state, item, player, pairs)` comes in with `player` already filtered out (with
state/world, `call_visitor.py:217`), and the handler put back a constant:
`'player': {'type': 'constant', 'value': 1}  # use player 1 for single-player exports`. That only holds when the ALttP
world is player 1. This explains why single-world ALttP passes, and why seeds 1–3 fail on whatever GT room the Big Key
search guards (seed 3: GT Compass Room).

**Ruled out.** Options: the P2 options equal single-world ALttP seed 1 except for the medallions. Slicing: the
`_P2_rules.json` is the faithful slice; the combined `_rules.json` carried the same `player: 1`. Cross-world placement:
the GT Big Key is in P2's own world. The sibling pattern `location_item_name(...) == (item, player)` (Tower of Hera,
Thieves' Town, Misery Mire …) is exported as `Compare(AST_placement_lookup, ["…", 2])` and is already correct for P2.
Only `placement_search` had the hardcoded player.

## 2. The fix and its risk

```python
player = getattr(self.world, 'player', None) or 1
… 'player': {'type': 'constant', 'value': player},
```

Handlers are built per world and cached per `id(world)` (`exporter/games/__init__.py:185`;
`exporter.py:1688` passes `multiworld.worlds[player]`), so `self.world.player` is the slot whose rules are being
analysed. That is the same value as the filtered `player` argument. With no world (cleanup and helper paths), the
behaviour is the old default of 1.

**Blast radius, measured.** The only producer of `item_name_in_location_names` calls in `worlds/` is ALttP (`alttp`,
`alttp_worldgen`, `alttp_vanilla_worldgen`). Committed documents carrying `placement_search`
(`rg -a -l` over `frontend/presets`) are 12 directories:

| documents | ALttP player | result |
|---|---|---|
| `multiworld/AP_{14089…,01043…,84719…}` `_rules.json` + `_P2_rules.json` (6 files) | 2 | **moved**: re-exported, the diff is exactly 17 `"player": 1 → 2` per file (102/102), all of them `AST_placement_search` args. `_P1/_P3/_P4` and sphere logs are unchanged |
| `alttp` seeds 1–3, `alttp_worldgen`, `alttp_vanilla_worldgen` | 1 | **regenerated with the fix: `_rules.json` and sphere logs byte-identical** (`git status` showed no change to them) |
| `alttp_vanilla` | 1 | not regenerated (a separate script pipeline); single player, so the handler emits 1 as before |
| `procgen_topdown/AP_{7,8,9}` | 1 (all 306 `player` values are 1) | not produced by this handler path; unaffected |

`multiworld/AP_05594871498841892311` (the procgen-maze multiworld) has no ALttP slot and no `placement_search`.
Regeneration churn (`.archipelago`, `.apadvn`, `_Spoiler.txt`, `preset_files.json`, which change with the old
exporter too) was reverted, and nothing was left in `worlds/` or a new preset dir. The six moved files existed before,
so no derived roster changes.

## 3. Gates

| gate | result |
|---|---|
| `npm test -- --port=8200 --mode=test-spoilers --game=multiworld --seed={1,2,3} --player=2` | **3/3 pass** (red 3/3 before the fix; seed 1 reproduced first, identical to the `pool-max-keys` report) |
| same, default player 1 (AHIT) | **3/3 pass** |
| single-world ALttP regeneration (5 presets) | byte-identical, so their spoiler results cannot move |
| pytest: new `test_export_placement_search_player.py` + `test_export_player_slicing`, `test_rules_json_writer_agreement`, `test_rules_json_indent` | **26 passed, 307 subtests** (22 + 4 new); tree clean after. pytest was not installed in the venv; `pip install pytest` |
| vitest | not applicable: no JS changed |

## 4. Mutants

- **Exporter reverted** (`git show HEAD~:…/handler.py`), multiworld seed 1 re-exported: the `_P2_rules.json` is
  `cmp`-identical to the pre-fix preset, and the P2 spoiler test goes red again with
  `Sphere 12.8: Location mismatch - missing: 9, extra: 0`.
- **New test vs each half reverted:** handler reverted → the `world.player=2` unit row fails; seed 1 `_P2` preset
  reverted → the on-disk row (every committed multiworld ALttP slot searches for its own player's items) fails.
  Both restored.

## 5. Not done / notes

- `test-spoilers` for multiworld `--player=3/4` (Adventure, Short Hike) were not run. Their files did not change.
- The frontend evaluator's `searchPlayer ?? 1` / `locPlayer ?? 1` defaults (`shared`) were left alone. With the
  exporter fixed they are never reached for these documents.
