# VVVVVV Solved Exporter Issues

## Issue 1: Region access rules use unsupported block/for_range structure

**Status:** Solved

**Date Fixed:** 2025-12-08

**Description:**
The region access rules for Menu -> Laboratory, Menu -> The Tower, Menu -> Space Station 2, and Menu -> Warp Zone were exported as complex "block" structures with "for_range" loops and unresolved variable references. The frontend rule engine could not evaluate these rules.

**Root cause:**
The Python code uses `_has_trinket_range` in a lambda with closure variables:
```python
rule=lambda state, i=i: _has_trinket_range(state, player,
                                           options.door_cost * (area_cost_map[i] - 1),
                                           options.door_cost * area_cost_map[i])
```

The standard analyzer was recursively analyzing `_has_trinket_range` and serializing its body (which contains a for loop) instead of recognizing it as a helper call with resolvable arguments.

**Solution:**
Added a `post_process_data` method to `exporter/games/v6.py` that:
1. Retrieves the `door_cost` and `area_cost_map` settings saved during export
2. Identifies region exits from Menu to the four area regions (Laboratory, The Tower, Space Station 2, Warp Zone)
3. Calculates the correct start/end values for each area based on `door_cost` and `area_cost_map`
4. Replaces the complex "block" rules with simple helper calls to `_has_trinket_range` with pre-computed constant arguments

**Example of fixed rule:**
```json
{
  "type": "helper",
  "name": "_has_trinket_range",
  "args": [
    {"type": "constant", "value": 0},
    {"type": "constant", "value": 3}
  ]
}
```

**Files modified:**
- `exporter/games/v6.py` - Added `post_process_data` method and world data caching

**Test result:**
All spoiler tests now pass successfully.
