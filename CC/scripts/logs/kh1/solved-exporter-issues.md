# Kingdom Hearts - Solved Exporter Issues

## Issue 1: Function reference `has_basic_tools` exported as name type
**Status:** Solved

**Description:**
In the Python code, `has_basic_tools` is sometimes used without parentheses (e.g., `or has_basic_tools`), which means it references the function object rather than calling it. In Python, function objects are truthy, so this effectively means `or True`. However, the analyzer exported this as `{"type": "name", "name": "has_basic_tools"}` which the JavaScript rule engine couldn't evaluate.

**Fix:**
Added detection in `_fix_has_all_counts_rule` to identify `{"type": "name", "name": "has_basic_tools"}` and convert it to `{"type": "constant", "value": true}`.

**Location:** `exporter/games/kh1.py` - `_fix_has_all_counts_rule` method

---

## Issue 2: Broken `has_x_worlds` conditional for World Map exits
**Status:** Solved

**Description:**
The `has_x_worlds` function begins with `if difficulty >= LOGIC_MINIMAL: return True`. When difficulty < LOGIC_MINIMAL (which is the common case), the analyzer was outputting a broken conditional:
```json
{
  "type": "conditional",
  "test": {"type": "compare", "left": {"value": 5}, "op": ">=", "right": {"value": 15}},
  "if_true": {"value": true},
  "if_false": {"value": 0.0}
}
```
The `if_false` branch should contain the world counting logic, but instead it just contained `0.0` (the initial value of `worlds_acquired`). This made World Map exits unreachable.

**Fix:**
Added `_fix_world_map_exit_rule` method to detect this pattern in World Map exits and replace it with a proper helper call to `has_x_worlds` with the correct `num_of_worlds` parameter based on the destination world.

**Location:** `exporter/games/kh1.py` - `_fix_world_map_exit_rule` method

---

## Issue 3: Broken `has_x_worlds` conditional for Level locations
**Status:** Solved

**Description:**
Same issue as #2, but for Level-up locations in the Levels region. Each level requires a different `num_of_worlds` based on the formula `min(((level_num//10)*2), 8)`.

**Fix:**
Added `_fix_level_location_rule` method to detect this pattern in Level locations and replace it with a proper helper call to `has_x_worlds` with the correct `num_of_worlds` parameter calculated from the level number.

**Location:** `exporter/games/kh1.py` - `_fix_level_location_rule`, `_get_level_num_worlds` methods

---

## Issue 4: Unresolved `worlds` parameter reference in `has_parasite_cage`
**Status:** Solved

**Description:**
The `has_parasite_cage` function takes a `worlds` parameter that is typically `has_x_worlds(state, player, 3, ...)`. The analyzer couldn't inline this properly and output `{"type": "name", "name": "worlds"}` which the JavaScript rule engine couldn't evaluate.

**Fix:**
Added detection in `_fix_has_all_counts_rule` to identify `{"type": "name", "name": "worlds"}` and convert it to a helper call to `has_x_worlds(3)`.

**Location:** `exporter/games/kh1.py` - `_fix_has_all_counts_rule` method

---

## Issue 5: Missing `has_all_summons` check in Geppetto All Summons Reward rule
**Status:** Solved

**Description:**
The rule for "Traverse Town Geppetto's House Geppetto All Summons Reward" should include a check for all 6 summons (Simba, Bambi, Genie, Dumbo, Mushu, Tinker Bell), but the `has_all_summons` check was being dropped by the analyzer.

**Fix:**
Added `_needs_additional_check` and `_add_missing_check` methods to detect locations that need additional requirements and append the missing check as a `has_all` state method call.

**Location:** `exporter/games/kh1.py` - `_needs_additional_check`, `_add_missing_check` methods

---

## Issue 6: General broken `has_x_worlds` conditionals in various locations
**Status:** Solved

**Description:**
The broken conditional pattern from `has_x_worlds` was appearing not just in World Map exits and Level locations, but also in various other locations throughout the game (e.g., Level 031-040 at sphere 1.13).

**Fix:**
Extended `_fix_has_all_counts_rule` to detect and fix the broken conditional pattern (`5 >= 15 ? true : 0.0`) anywhere it appears, using `_infer_num_of_worlds_general` to determine the appropriate world count from context.

**Location:** `exporter/games/kh1.py` - `_fix_has_all_counts_rule`, `_infer_num_of_worlds_general` methods

---

## Issue 7: End of the World exit rule with complex structure
**Status:** Solved

**Description:**
The "End of the World" World Map exit has a more complex rule structure than other world exits. Instead of a simple `has_x_worlds AND item_check` pattern, it has `has_x_worlds AND (lucky_emblem_check OR item_check)`. The original `_fix_world_map_exit_rule` method only handled the simple pattern.

**Fix:**
Extended `_fix_world_map_exit_rule` to handle the complex case where the second condition is an `or` containing the item_check along with other conditions (like lucky emblem requirements).

**Location:** `exporter/games/kh1.py` - `_fix_world_map_exit_rule` method
