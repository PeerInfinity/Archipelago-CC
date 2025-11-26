# The Witness - Solved Issues

## Issue: Region reachability requirements lost during rule export (Fixed 2025-11-26)

### Problem
The spoiler test was failing at Sphere 5.1 with mismatches like:
- Locations accessible in STATE but NOT in LOG: Mountain Bottom Floor Giant Puzzle, etc.
- Regions accessible in STATE but NOT in LOG: Mountain Floor 2 Elevator Room, etc.

### Root Cause
Exit rules in The Witness often require:
1. Having certain items
2. Being able to reach other regions (where the panels that unlock the exit are located)

The Witness uses `region.can_reach` bound methods to check if a region is reachable. These bound methods were being incorrectly handled in multiple ways:

1. **`_is_all_of_comprehension_with_bound_methods`**: Was matching ANY `all_of` rule that contained at least one bound method and simplifying the ENTIRE rule to `True`, losing all requirements.

2. **`_simplify_region_reachability_pattern`**: For conditional patterns from bound method analysis, the region name was lost (showed as `self` instead of actual region name).

3. **Lambda closure extraction**: The `fully_converted_rules` variable in lambda closures is a nested list structure that wasn't being searched recursively for bound methods.

### Fix Applied (exporter/games/witness.py)

1. **Renamed function**: `_is_all_of_comprehension_with_bound_methods` -> `_is_all_of_comprehension_with_only_bound_methods`
   - Now only matches when ALL items in the comprehension are bound methods

2. **Added `_simplify_all_of_with_mixed_conditions`**: Handles `all_of` rules with both bound methods and item checks
   - Extracts region names from bound methods and converts them to `reach_region` rules
   - Preserves item check conditions

3. **Added `_extract_region_names_from_lambda`**: Pre-extracts region names from lambda closures BEFORE analysis
   - Recursively searches nested lists in closure variables
   - Looks for bound methods with Region objects (identified by having `entrances` attribute)

4. **Updated `_simplify_region_reachability_pattern`**: Uses pre-extracted region names
   - When encountering conditionals that would simplify to True, creates `reach_region` rules instead
   - Maintains a queue of extracted region names to ensure correct matching

### Frontend Support (frontend/modules/shared/ruleEngine.js)

Added support for `reach_region` rule type in the rule evaluator:
```javascript
case 'can_reach':
case 'reach_region': {
    // Evaluates whether a region is reachable
    result = context.isRegionReachable(regionName);
    break;
}
```

### Result
Exit rules now correctly include both item requirements AND region reachability requirements:
```json
{
  "name": "Mountain Floor 2 Above The Abyss to Mountain Floor 2 Elevator Room",
  "connected_region": "Mountain Floor 2 Elevator Room",
  "access_rule": {
    "type": "and",
    "conditions": [
      {"type": "reach_region", "region": "Mountain Floor 2 Light Bridge Room Far"},
      {"type": "reach_region", "region": "Mountain Floor 2 Light Bridge Room Near"},
      {"type": "state_method", "method": "has_all_counts", "args": [{"type": "constant", "value": {"Eraser": 1, "Progressive Stars": 2, "Rotated Shapers": 1}}]}
    ]
  }
}
```

### Tests
- Seed 2: PASS
- Seed 5: PASS
- Seed 10: PASS
