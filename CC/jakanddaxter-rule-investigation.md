# Jak and Daxter Rule Types Investigation

This document summarizes the investigation into rule types required by helper functions in Jak and Daxter: The Precursor Legacy.

## Current State

### Working Configuration (Orbsanity Off)
The default Jak and Daxter configuration works correctly:

| Helper | Implementation | Status |
|--------|----------------|--------|
| `can_fight` | Inlined in `expand_rule` | Working |
| `can_free_scout_flies` | Inlined in `expand_rule` | Working |
| `can_reach_orbs` | JavaScript helper | Working |

Spoiler tests pass with 197/197 events processed.

### Failing Configuration (Per-Level Orbsanity)
When per-level orbsanity is enabled (`enable_orbsanity: per_level`), the spoiler test fails:

```
Locations accessible in LOG but NOT in STATE:
- Forbidden Jungle Orb Bundle 1, 2, 3
- Geyser Rock Orb Bundle 1, 2
- Sandover Village Orb Bundle 1, 2
- Sentinel Beach Orb Bundle 1-5
ISSUE: Access rule evaluation failed
```

## Root Cause Analysis

### The Problem Helper: `can_reach_orbs_level`

Located in `worlds/jakanddaxter/rules.py:82-91`:

```python
def can_reach_orbs_level(state: CollectionState,
                         player: int,
                         world: "JakAndDaxterWorld",
                         level_name: str,
                         orb_amount: int) -> bool:
    if not state.prog_items[player]["Reachable Orbs Fresh"]:
        recalculate_reachable_orbs(state, player, world)
    return state.has(f"{level_name} Reachable Orbs", player, orb_amount)
```

This helper is being analyzed and converted to a complex rule structure containing:
- `for_iter` loops over `world.level_to_orb_regions`
- `function_call` for `region.can_reach()`
- `attribute` access for `region.orb_count`

### Why It Fails

The frontend cannot evaluate these rules because:

1. **Missing Data**: `world.level_to_orb_regions` is not available in the frontend
2. **Method Calls**: `region.can_reach()` requires the Python CollectionState
3. **Dynamic Iteration**: The loop pattern requires runtime region lookup

## Recommended Solution

### Implement `can_reach_orbs_level` in JavaScript

Following the pattern of the existing `can_reach_orbs` helper, add level-specific orb counting:

**File: `frontend/modules/shared/gameLogic/jakanddaxter/helpers.js`**

```javascript
/**
 * Check if player can reach enough orbs for a specific level.
 * Used when per-level orbsanity is enabled.
 *
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data (regions is a Map)
 * @param {string} levelName - The level to check (e.g., "Forbidden Jungle")
 * @param {number} requiredOrbs - Number of orbs required
 * @returns {boolean} True if player has enough reachable orbs in this level
 */
export function can_reach_orbs_level(snapshot, staticData, levelName, requiredOrbs) {
  try {
    if (!staticData || !staticData.regions) {
      console.warn('[can_reach_orbs_level] Missing staticData or regions');
      return false;
    }
    if (!snapshot.regionReachability) {
      console.warn('[can_reach_orbs_level] Missing regionReachability in snapshot');
      return false;
    }

    let totalReachableOrbs = 0;

    // Iterate through all regions and sum orb counts for reachable level regions
    for (const [regionName, region] of staticData.regions) {
      // Check if this region belongs to the specified level
      if (regionName.startsWith(levelName + ' ')) {
        const reachability = snapshot.regionReachability[regionName];
        if (reachability === 'reachable') {
          if (region && typeof region.orb_count === 'number' && region.orb_count > 0) {
            totalReachableOrbs += region.orb_count;
          }
        }
      }
    }

    return totalReachableOrbs >= requiredOrbs;
  } catch (error) {
    console.error('[can_reach_orbs_level] Error:', error);
    return false;
  }
}
```

**File: `frontend/modules/shared/gameLogic/jakanddaxter/jakanddaxterLogic.js`**

```javascript
import { can_reach_orbs, can_reach_orbs_level } from './helpers.js';

export const helperFunctions = {
  can_reach_orbs,
  can_reach_orbs_level
};
```

### Update the Exporter

**File: `exporter/games/jakanddaxter.py`**

Add handling in `expand_rule` to convert `can_reach_orbs_level` calls to helper calls:

```python
# In expand_rule method, after handling can_reach_orbs:
if rule.get('type') == 'function_call':
    # Check if this is a can_reach_orbs_level call
    func = rule.get('function', {})
    if (isinstance(func, dict) and
        func.get('type') == 'name' and
        func.get('name') == 'can_reach_orbs_level'):
        args = rule.get('args', [])
        # Extract level_name and orb_amount from args
        # args[0-2] are state, player, world (not needed)
        # args[3] is level_name, args[4] is orb_amount
        if len(args) >= 5:
            level_name = self._unwrap_constant(args[3])
            orb_amount = self._unwrap_constant(args[4])
            return {
                'type': 'helper',
                'name': 'can_reach_orbs_level',
                'args': [level_name, orb_amount]
            }
```

## Alternative: Blacklist Approach

If the JavaScript implementation is complex, the helper can be blacklisted:

```python
# In exporter/games/jakanddaxter.py
HELPERS_TO_EXPORT_BLACKLIST = {'can_reach_orbs_level'}
```

This prevents the analyzer from converting the helper to complex rules, but still requires the JavaScript implementation.

## Testing

After implementing the solution, test with:

```bash
# Create test template with per-level orbsanity
cat > Players/Templates/jak_perlevel.yaml << 'EOF'
name: Player{number}
game: 'Jak and Daxter: The Precursor Legacy'
'Jak and Daxter: The Precursor Legacy':
  enable_orbsanity: per_level
  level_orbsanity_bundle_size: 25_orbs
EOF

# Generate and test
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/jak_perlevel.yaml" --multi 1 --seed 2
npm test -- --mode=test-spoilers --game=jakanddaxter --seed=2
```

## Summary

| Issue | Status | Solution |
|-------|--------|----------|
| Default config (orbsanity off) | Working | No changes needed |
| Per-level orbsanity | Failing | Implement `can_reach_orbs_level` in JavaScript |
| Global orbsanity | Not tested | Likely same as default (uses `can_reach_orbs`) |

The infrastructure for orb counting helpers is already in place. The remaining work is extending the JavaScript helper to handle level-specific orb counting.
