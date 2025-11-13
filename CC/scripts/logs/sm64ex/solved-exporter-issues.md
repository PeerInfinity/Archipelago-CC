# Solved Exporter Issues

## Issue 1: Wing Cap, Metal Cap, and Vanish Cap treated as movement abilities

**Location:** `BoB: Mario Wings to the Sky` (and other locations requiring caps)

**Problem:** The exporter incorrectly treats Wing Cap, Metal Cap, and Vanish Cap as movement abilities that become "always available" when `enable_move_rando` is false. These are actually collectible items that should always require checking.

**Expected behavior:** Wing Cap, Metal Cap, and Vanish Cap should always be exported as `item_check` rules, regardless of the `enable_move_rando` setting.

**Actual behavior:** When `enable_move_rando` is false, WC/MC/VC tokens were resolved to `True`, causing locations like "BoB: Mario Wings to the Sky" to be accessible too early.

**Rule in Python:** `"CANN & WC | CAPLESS & CANN"` should require both Cannon Unlock BoB AND Wing Cap (when CAPLESS is false).

**Fix:** Modified `exporter/games/sm64ex.py` to separate movement abilities (`MOVEMENT_TOKENS`) from cap items (`CAP_TOKENS`). Now only movement abilities are treated as "always available" when `enable_move_rando` is false, while cap items always require checking.

**Files changed:** `exporter/games/sm64ex.py`

**Result:** Test now passes Sphere 0.3 and progresses to Sphere 1.13.

## Issue 2: Incorrect OR and AND boolean logic simplification

**Location:** `MIPS 1`, `MIPS 2` (and other locations with boolean expressions)

**Problem:** The exporter's OR and AND expression simplification logic was incorrect. For OR expressions, it was filtering out `True` constants and keeping `False` constants, resulting in incorrect simplification. For example, "True | False" was being simplified to "False" instead of "True".

**Expected behavior:** 
- OR: If any condition is True, the whole expression is True. Filter out False conditions.
- AND: If any condition is False, the whole expression is False. Filter out True conditions.

**Actual behavior:** 
- OR: Was filtering out True and keeping False, causing "DV | MOVELESS" (True | false) to become false
- AND: Was filtering out True but not short-circuiting on False

**Rule in Python:** `"DV | MOVELESS"` should resolve to True when enable_move_rando is false (DV becomes True, MOVELESS is false).

**Fix:** Modified `parse_rule_expression` and `parse_and_expression` methods to:
1. Check for short-circuit values first (True for OR, False for AND)
2. Filter out non-affecting constants (False for OR, True for AND)
3. Return correct default when all conditions are filtered

**Files changed:** `exporter/games/sm64ex.py`

**Result:** Test now correctly evaluates boolean expressions and progresses further.

## Issue 3: MIPS locations missing additional rules

**Location:** `MIPS 1`, `MIPS 2`, `Toad (Basement)`, `Toad (Second Floor)`, `Toad (Third Floor)`

**Problem:** These locations have multiple rules applied - one via `rf.assign_rule` and additional rules via `add_rule`. The exporter's `override_rule_analysis` only captured the first rule from the parsed expressions, missing the additional constraints.

**Expected behavior:** These locations should have all their rules combined (ANDed together).

**Actual behavior:** Only the first rule was being exported, making locations accessible too early.

**Fix:** Modified `override_rule_analysis` to skip these specific locations and let the generic analyzer handle them, which correctly captures all rules applied to the location.

**Files changed:** `exporter/games/sm64ex.py`

**Result:** Test now passes Sphere 0 through Sphere 2.5 and stops at Sphere 2.6 with a different issue.


## Issue 4: Location and region reachability exported as helper instead of state_method

**Location:** `DDD: Pole-Jumping for Red Coins` (and other locations using `{{location}}` or `{region}` syntax)

**Sphere:** 2.6

**Problem:** The exporter was converting `{{location}}` and `{region}` syntax to custom `helper` function calls (`can_reach_location` and `can_reach_region`) instead of the core `state_method` calls that match the Python implementation.

**Expected behavior:** `{{location}}` should export as `state.can_reach(location, 'Location')` and `{region}` should export as `state.can_reach(region, 'Region')`, using the `state_method` rule type.

**Actual behavior:** Rules were exported as `helper` type with custom function names, which either didn't exist or didn't match the core state engine behavior.

**Rule in Python:** `"{{Bowser in the Fire Sea Key}}"` becomes `lambda state: state.can_reach("Bowser in the Fire Sea Key", "Location", player)`

**Fix:** Modified `parse_token_expression` to export `{{location}}` and `{region}` as `state_method` calls with the `can_reach` method, matching the Python implementation exactly.

**Files changed:** `exporter/games/sm64ex.py`

**Result:** Test now passes all spheres (121 events, 5.4 spheres). Super Mario 64 is fully working!

