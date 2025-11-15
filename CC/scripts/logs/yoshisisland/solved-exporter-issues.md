# Solved Exporter Issues

## Issue 1: logic.method attribute access not converted to helper calls

**Status:** SOLVED
**Locations affected:**
- Touch Fuzzy Get Dizzy: Stars (lines 37, 265 in worlds/yoshisisland/Rules.py)

**Description:**
The Python code has a pattern where `logic.cansee_clouds` is accessed as an attribute without calling it as a function (missing `(state)`). This creates an attribute access rule in the JSON:

```json
{
  "type": "attribute",
  "object": {"type": "name", "name": "logic"},
  "attr": "cansee_clouds"
}
```

This fails in the JavaScript rule engine because "logic" is not available in the context.

**Root cause:**
The Python code has a bug where it accesses `logic.cansee_clouds` instead of calling `logic.cansee_clouds(state)`. This appears to be checking if the method exists rather than calling it.

**Solution implemented:**
Added `post_process_data` method to the Yoshi's Island exporter (`exporter/games/yoshisisland.py`) to convert `logic.<method>` attribute access patterns into helper function calls. This pattern:
```json
{"type": "attribute", "object": {"type": "name", "name": "logic"}, "attr": "method_name"}
```

Is now converted to:
```json
{"type": "helper", "name": "method_name", "args": []}
```

The transformation is done recursively across all location and exit rules in the exported data.

**File modified:** `exporter/games/yoshisisland.py`

## Issue 2: Helper functions incorrectly auto-expanded to item checks

**Status:** SOLVED
**Affected helpers:**
- has_midring, reconstitute_luigi, bandit_bonus, item_bonus, combat_item, melon_item, default_vis, cansee_clouds, bowserdoor_1-4

**Description:**
The GenericGameExportHandler was auto-expanding Yoshi's Island helper functions based on naming patterns. For example, `has_midring` was being converted to an item check for "Midring" item instead of being preserved as a helper function call.

**Root cause:**
The generic exporter's `_is_common_helper_pattern` method matches helpers starting with "has_", "can_", etc., and automatically expands them to item checks or other inferred rules. This is incorrect for Yoshi's Island, which has custom helper implementations.

**Solution implemented:**
Override `_is_common_helper_pattern` in YoshisIslandGameExportHandler to exclude Yoshi's Island-specific helpers from auto-expansion. Added a YOSHI_HELPERS set containing all custom helper names that should be preserved as helper calls. Also added pattern matching to exclude level-specific helpers (pattern: `_[0-9]{2}[A-Z][a-z]+`) such as `_14Clear`, `_17Game`, etc.

**File modified:** `exporter/games/yoshisisland.py`

