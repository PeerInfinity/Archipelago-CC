# Remaining Exporter Issues for Ocarina of Time

## CRITICAL: Massive State Mismatch - Hundreds of Locations Not Accessible

**Status**: CRITICAL - Exporter logic is fundamentally broken

**Description**:
Spoiler test reveals that the exported rules.json has severe logic errors. In sphere 0 alone, 600+ locations that should be accessible from the start are not being marked as accessible by the state manager.

**Test Results**:
- Test command: `npm test --mode=test-spoilers --game=oot --seed=1`
- Error: "STATE MISMATCH found for: {\"type\":\"state_update\",\"sphere_number\":0,\"player_id\":\"1\"}"
- Locations accessible in STATE (and unchecked) but NOT in LOG: 600+ locations including:
  - Basic collectibles (rupees, hearts, pots, crates)
  - Gossip stones and fairies
  - Gold Skulltulas
  - Many overworld locations
  - Song locations (Sheik in Forest, Song from Saria, Song from Impa, etc.)
  - Dungeon locations and boss rewards

**Root Cause**:
The OOT exporter at exporter/games/oot.py is not correctly parsing and exporting the access rules. This could be due to:
1. parse_oot_rule() function (lines 261-299) returning placeholder helpers instead of actual logic
2. Missing implementation for OOT-specific rule DSL parsing
3. Rule strings not being properly converted to JSON format
4. Subrules and logic helpers not being correctly resolved

**Evidence**:
Looking at oot.py:291-299, the parser currently returns a placeholder:
```python
return {
    "type": "helper",
    "name": "parse_oot_rule",
    "args": [{"type": "constant", "value": rule_string}]
}
```

This is not actual logic - it's just passing the rule string as a constant argument to a helper that doesn't exist in the frontend. The frontend can't evaluate these rules, so it treats almost all locations as inaccessible.

**Impact**:
- Spoiler test completely fails
- Frontend cannot correctly determine location accessibility
- Progress tracking is completely broken
- Cannot proceed with any OOT testing until this is fixed

**Next Steps**:
1. Implement proper OOT rule DSL parser in parse_oot_rule_string()
2. Create comprehensive test suite for OOT rule parsing
3. Verify all location access rules export correctly
4. Re-run spoiler test to confirm fix

**Priority**: HIGHEST - This blocks all OOT functionality

