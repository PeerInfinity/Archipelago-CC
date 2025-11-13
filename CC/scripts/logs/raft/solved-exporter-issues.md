# Solved Exporter Issues for Raft

## Issue 1: Access rules not properly resolved from regionChecks dictionary

**Status**: SOLVED
**Severity**: Critical
**Type**: Exporter Bug

### Description
Location access rules that use `regionChecks[location["region"]]` were being exported as complex `function_call` structures with nested `subscript` operations, instead of being resolved to their actual lambda functions.

### Solution
Implemented `override_rule_analysis()` method in the Raft exporter that:
1. Loads the locations.json file to get region and item requirement data for each location
2. For each location, looks up its region and required items
3. Returns the appropriate access rule based on the region and item requirements
4. Generates helper function calls for item checks (e.g., `raft_itemcheck_Plank`)

### Implementation
File: `exporter/games/raft.py`
- Added `__init__` method to load locations.json
- Added `override_rule_analysis()` to custom analyze location access rules
- Added `_get_region_access_rule()` to map regions to their access rules
- Created helper names like `raft_itemcheck_{item_name}` for item requirements

### Result
Access rules are now properly exported as helper function calls instead of complex unresolvable structures.
