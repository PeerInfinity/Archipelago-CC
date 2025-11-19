# Zillion Exporter Issues

## Issue 1: Access rules cannot be properly analyzed

**Status**: Blocked - requires zilliandomizer integration

**Description**:
Zillion uses the zilliandomizer library for its logic system. Access rules are implemented as `functools.partial` objects that call `logic_cache.cs_to_zz_locs(cs)`, which uses zilliandomizer's complex internal logic system.

**Problem Details**:
1. Static analysis fails because `functools.partial` objects cannot be inspected with `inspect.getsource()`
2. Runtime testing fails because the logic cache uses sophisticated area/gate tracking beyond simple item checks
3. The location's `zz_loc.req` attribute only contains PARTIAL requirements (within-region requirements), not full access logic

**Evidence**:
- Both "A-4 bottom far left" (sphere 0) and "C-3 mid far right" (sphere 0.3) have identical `req` values (gun=1, jump=0)
- But "A-4 bottom far left" is accessible with no items while "C-3 mid far right" requires 1 Zillion
- Runtime testing shows both as accessible with empty CollectionState

**Current Behavior**:
- All 1555 Zillion locations export with `access_rule: null`
- JavaScript state manager treats them as always accessible
- Spoiler test fails at Sphere 0 with 135 locations incorrectly accessible

**Required Solution**:
One of the following approaches:
1. Deep integration with zilliandomizer library to export its internal logic
2. Contribute to zilliandomizer to add a JSON export feature
3. Implement a Zillion-specific logic system in JavaScript that mirrors zilliandomizer
4. Use a different approach entirely (e.g., pre-compute accessibility for all item combinations)

**Files Affected**:
- `exporter/games/zillion.py` - attempted runtime testing, doesn't work
- `worlds/zillion/__init__.py:212-222` - creates functools.partial access rules
- All generated Zillion rules.json files

**Test Command**:
```bash
npm test --mode=test-spoilers --game=zillion --seed=1
```

**Expected**: Sphere 0 should have only 12 accessible locations
**Actual**: Sphere 0 has 135+ accessible locations (all locations with null access rules)
