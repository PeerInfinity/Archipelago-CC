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

