# Solved Exporter Issues - Bomb Rush Cyberfunk

This file tracks resolved exporter issues for Bomb Rush Cyberfunk.

## Resolved Issues

### Variable Resolution in Helper Arguments (FIXED)

**Issue:** The `limit` variable in helper function arguments was not being resolved to its actual value.

**Previous behavior:**
```json
{
  "type": "helper",
  "name": "versum_hill_ch1_roadblock",
  "args": [
    {
      "type": "name",
      "name": "limit"
    }
  ]
}
```

**Fixed behavior:**
```json
{
  "type": "helper",
  "name": "versum_hill_ch1_roadblock",
  "args": [
    {
      "type": "constant",
      "value": false
    }
  ]
}
```

**Solution:** Modified the `expand_rule` method in `exporter/games/bomb_rush_cyberfunk.py` to resolve variable references for ALL helper functions, not just specific ones.

**Changed:** Line 58 from `if rule.get('type') == 'helper' and rule.get('name') == 'graffiti_spots':` to `if rule.get('type') == 'helper':`

**Result:** All variable arguments (movestyle, limit, glitched) are now properly resolved to their constant values in the generated rules.json file.

**Test Result:** Spoiler test now passes all 186 spheres with 0 mismatches.
