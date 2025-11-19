# Remaining Exporter Issues for Blasphemous

## Test Results Summary

Spoiler test failed at Sphere 0 (starting sphere). Many locations are accessible in STATE but NOT in the expected sphere log.

### Primary Issue: All locations accessible from the start

The spoiler test shows that hundreds of locations are marked as accessible from the start when they should require items/abilities.

**Test Output Sample:**
```
Locations accessible in STATE but NOT in LOG: [very long list including D01Z02S01, D01Z02S01[Cell3], D01Z02S01[Cell6], ...]
```

### Root Cause Analysis

1. **Exit Rules**: Most exit rules are being exported as `{"type": "constant", "value": true}`, making all regions immediately accessible
   - Sample from first 10 regions: 12 out of 13 exits have `constant: true` rule

2. **Location Logic**: Locations DO have proper logic requirements in the Python region_data.py:
   - Example: RB07 requires `blood` OR `doubleJump`
   - Example: QI55 requires `blood` AND `dash` AND `canWaterJump`

3. **String Rule Expansion**: The exporter uses `_expand_string_rule()` to convert item requirement strings like "blood", "dash", "canWaterJump" into proper rules. This may not be working correctly.

### Specific Issues to Investigate

1. **Missing/incorrect string rule mappings**: Check if all item requirements from region_data.py are properly mapped in the exporter's `string_rule_expansions` dict
2. **Exit logic not being exported**: Most exits have empty logic arrays `[]` in region_data.py, which should mean "no requirements", but some regions should only be accessible with certain abilities
3. **Helper function calls not being recognized**: Item requirements like "can Water Jump", "canEnemyBounce", etc. may not be properly converted to helper function calls

### Investigation Results

#### Location Rules Are Correct
Tested RB07 ("THL: Across blood platforms"):
- Python logic: requires `blood` OR `doubleJump`
- Exported rule: `{"type": "or", "conditions": [...]}`  ✅ CORRECT
- Rule correctly converts to:
  - `{"type": "item_check", "item": "Blood Perpetuated in Sand"}` OR
  - `{"type": "item_check", "item": "Purified Hand of the Nun"}`

#### Starting Inventory
- Player starts with: `Dash Ability`, `Wall Climb Ability`
- Player does NOT start with: `Blood Perpetuated in Sand` or `Purified Hand of the Nun`
- Therefore RB07 should NOT be accessible at start

#### Region Connectivity
- Starting region: `Menu`
- Menu -> D17Z01S01 (constant true)
- Most inter-region exits have `constant: true` rules
- This allows reaching most regions from the start

### Current Hypothesis

The issue is NOT with exporter - location rules are being exported correctly. The issue appears to be with how the JavaScript frontend evaluates the rules or manages region/location accessibility.

Possible causes:
1. JavaScript helper functions not implemented correctly (e.g., `blood()`, `double_jump()`)
2. JavaScript StateManager not properly checking location access rules
3. JavaScript RuleEngine evaluation bug
4. Helper functions receiving wrong parameters or context

### Next Steps

1. ~~Check if location rules are exported correctly~~ ✅ VERIFIED - rules are correct
2. Check if JavaScript helper functions exist and work correctly
3. Add console logging to JavaScript to see why locations are marked accessible
4. Test specific helper functions like `blood()` and `double_jump()`
5. Verify StateManager properly combines region accessibility + location rules
