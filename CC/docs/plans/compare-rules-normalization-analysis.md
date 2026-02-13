# Normalization Analysis: compare_rules_json.py

Analysis of normalizations in `scripts/test/compare_rules_json.py` and whether they could be moved upstream into the generation process (exporter or world generator).

## Category A: Fixable in the Exporter (original side is inconsistent)

| Normalizer | Issue | Proposed Fix | Safe? | Notes |
|---|---|---|---|---|
| `normalize_toggle_defaults` | Exporter sometimes exports `0` instead of `false` for toggle defaults | Make exporter consistently use `bool` for toggle defaults | **YES** | `world_data.py:200,203` — Frontend uses truthiness checks, not strict type |
| `normalize_rule_format` (event: false) | Exporter includes `event: false` (default) on all non-event items | Only include `event: true` for event items | **YES** | `exporter.py:2070,2128,2175`, `handler.py:1232,1979` — Frontend checks `event === true` or truthiness |
| `normalize_item_check_count_default` | Exporter sometimes includes `count: 1` (default) | Strip `count` when value is 1 during export | **Deferred** | Core converters already omit count=1 correctly; edge cases come from game-specific handlers, hard to fix exhaustively |
| `normalize_all_of_iterable` | Exporter includes `iterable` field alongside `iterator_info.iterator` | Remove redundant `iterable` from `all_of` export | **NO** | Frontend `ruleEngine.js` uses `rule.iterable` in ~15 places. NOT redundant from frontend's perspective. Fix would be to ADD `iterable` to WorldGen exports instead. |
| `normalize_none_to_null` | Exporter sometimes uses `{"type": "constant", "value": null}` instead of `None` for `if_false` | Normalize to `None` during export | **Deferred** | Would require tracing all conditional expression paths; moderate effort |
| `normalize_rule_format` (metadata) | Exporter includes `_converted_from_ast`, `_original_ast_type` metadata | Strip these metadata fields during export | **NO** | **Heavily consumed** by frontend JS (`ruleEngine.js`, `commonUI.js`, `helperUI.js`, `pathAnalyzerLogic.js`) and game handlers (`rule_expansion.py`, `pizza_tower.py`, `ss2.py`, `waterywords.py`, `minishoot.py`, `yugiohddm.py`, etc.) |

## Category B: Fixable in the World Generator (WorldGen produces different format)

| Normalizer | Issue | Proposed Fix | Safe? | Notes |
|---|---|---|---|---|
| `normalize_tuple_wrapped_generator` | WorldGen wraps generators in `tuple()` because generators don't support `.count()` | Use list comprehension instead | **Deferred** | `rule_codegen.py:8774-8779` — Could change to list comprehension but risk subtle behavior changes |
| `normalize_option_display_name` | WorldGen adds `display_name` that original doesn't have | Don't add `display_name` if absent in source | **N/A** | Working as designed: WorldGen includes `display_name` when present in source rules.json. Difference is inherent to roundtrip. |
| `normalize_math_functions` | WorldGen emits `function_call` with `math.sqrt` instead of `helper` with `sqrt` | Use helper format for math functions | **Deferred** | `rule_codegen.py:8435-8440` — Would require changing Python code generation patterns; moderate risk |

## Category C: Format unification (need to pick one format and make both sides use it)

Cases where both sides represent the same thing differently. Fix requires choosing a canonical format and updating one or both sides:

| Normalizer | Original format | WorldGen format | Recommended fix |
|---|---|---|---|
| `normalize_string_constant_wrapper` | `{"type": "constant", "value": "X"}` | `"X"` (plain string) | Fix in exporter: unwrap string constants |
| `normalize_list_representation` | `{"type": "constant", "value": [200, 400]}` | `{"type": "list", "value": [{...}, {...}]}` | Fix in WorldGen: use constant format for simple lists |
| `normalize_tuple_list_types` | `{"type": "list", "value": [...]}` | `{"type": "tuple", "elements": [...]}` | Fix in WorldGen: use list format instead of tuple |
| `normalize_and_or_args_to_children` | `{"rule": "And", "args": {"rules": [...]}}` | `{"rule": "And", "children": [...]}` | Fix in exporter: use `children` format |
| `normalize_not_expression_format` | `{"type": "not", "operand": X, "condition": null}` | `{"type": "not", "condition": X}` | Fix in exporter: use `condition` key, drop null fields |
| `normalize_helper_body` | `location_check` / `can_reach_entrance` types | `state_method` equivalents | Fix in exporter: use state_method format |
| `normalize_nested_world_attribute` | Nested `attribute` chain | Flat `world_attribute` | Fix in WorldGen: flatten attribute chains |
| `normalize_world_attribute_format` | `{"type": "attribute", "object": {"name": "world"}, "attr": "X"}` | `{"type": "world_attribute", "attribute": "X"}` | Fix in WorldGen: use world_attribute format |
| `normalize_setting_types` | `option_value` / `world_attribute` | `setting_value` | Unify to one type (probably `setting_value`) |
| `normalize_setting_to_world_attribute` | `setting_value` | `world_attribute` | Same as above — needs a single canonical type |
| `normalize_sum_of_helpers` | `{"params": [], "body": X}` + `method_call` | bare body + `function_call` | Fix both sides to use same format |

## Category D: Optimization differences (both sides should optimize the same way)

These normalizations exist because one side optimizes rule trees more aggressively:

| Normalizer | What it does |
|---|---|
| `normalize_hasall_single_item` | `HasAll([X])` → `Has(X)` |
| `normalize_hasany_single_item` | `HasAny([X])` → `Has(X)` |
| `normalize_hasall_duplicate_items` | `HasAll([X, X, Y])` → `HasAll([X, Y])` |
| `normalize_and_has_patterns` | `And(Has(A), Has(B))` → `HasAll(A, B)` |
| `normalize_or_has_patterns` | `Or(Has(A), Has(B))` → `HasAny(A, B)` |
| `normalize_and_with_true/false` | Remove `True_`/`False_` from `And` |
| `normalize_or_with_true/false` | Remove `True_`/`False_` from `Or` |
| `normalize_and_or_structure` | Flatten nested `And`/`Or`, sort children |
| `normalize_state_method_to_rule` | `StateMethod(has_any, X)` → `HasAny(X)` |
| `normalize_ast_function_call` | `AST_function_call` → Rule Builder equivalents |
| `make_setting_value_normalizer` | Evaluate `SettingValue` to `True_`/`False_` |

These could be addressed by adding a common "rule optimizer" pass that runs on the JSON after export from either side. The AST→Rule Builder converter (`exporter/converter/ast_to_rule_builder.py`) already does some of this (lines 804-830, 852-878), but the optimizations aren't consistently applied.

## Category E: Inherent/expected differences (cannot be fixed)

| Normalizer / area | Why it can't be fixed |
|---|---|
| `normalize_worldgen_names` | " WorldGen" suffix is by design |
| `is_canonical_difference` (bulk of it) | WorldGen bakes in option values at generation time — this is fundamental to how it works |
| Game-specific allowlists (helpers, world attributes) | Different world implementations produce different internal state |
| `classification_counts`, `progression_mapping`, `item_groups` | Metadata differences between original and generated worlds |

## Summary

**Verified safe (Categories A + B):** 2 normalizers can be safely eliminated now:
- `normalize_toggle_defaults` — fix in exporter
- `normalize_rule_format` event:false — fix in exporter

**Not safe:** 2 normalizers have consumers that depend on the current format:
- `_converted_from_ast` / `_original_ast_type` — frontend and game handlers
- `all_of.iterable` — frontend ruleEngine.js

**Deferred (need more investigation):** 5 normalizers are potentially fixable but need more work:
- `normalize_item_check_count_default` — edge cases in game handlers
- `normalize_none_to_null` — need to trace all conditional paths
- `normalize_tuple_wrapped_generator` — subtle behavior change risk
- `normalize_math_functions` — moderate risk code generation change
- `normalize_option_display_name` — inherent to roundtrip, not a bug

**Medium effort (Category C):** ~11 normalizers require picking a canonical format and updating one or both sides. The biggest win here would be unifying the `setting_value`/`world_attribute`/`option_value` types and the `children` vs `args.rules` format.

**Larger effort (Category D):** ~11 normalizers deal with optimization differences. A shared "rule normalizer" module that both the exporter and world generator use after producing their output could handle all of these at once.

**Cannot be fixed (Category E):** The `is_canonical_difference` function (lines 1646-2300+) and game-specific allowlists will always be needed since they handle inherent semantic differences between original and WorldGen worlds.
