# Shapez Remaining Helper Issues

## Issue 1: Logic progression regions not reachable at sphere 4.9

**Status:** Not Fixed
**Priority:** Medium
**Type:** Helper Function Logic

### Description
At sphere 4.9, the test fails because regions "Levels with 3/4/5 buildings" and "Upgrades with 3/4/5 buildings" are not reachable, even though they should be accessible.

### Symptoms
- Test fails at sphere 4.9
- Multiple locations are inaccessible: Level 12-25, Belt/Miner/Painting/Processors Upgrade Tier V-VIII, Wires, Even faster, Faster, Goal
- Regions not reachable: Levels with 3/4/5 buildings, Upgrades with 3/4/5 buildings
- No exits found from currently accessible regions to these regions

### Possible Causes
1. The `has_logic_list_building` helper may have incorrect logic
2. The buildings list or early_useful parameters may not be passed correctly from the rules.json
3. There may be a mismatch between Python logic and JavaScript implementation
4. The helper might not be receiving the correct arguments from the access rules

### Next Steps
1. Check the rules.json to see how the logic progression regions' access rules are structured
2. Verify the `has_logic_list_building` helper is being called with correct arguments
3. Add logging to the helper to understand what's happening
4. Compare the Python logic in worlds/shapez/regions.py lines 195-229 with the JavaScript implementation
5. Check if the buildings lists and early_useful flags are being passed through the rules properly

### Test Impact
Test progresses to sphere 4.9 (24 events) out of 31 total events, indicating significant progress but incomplete logic coverage.
