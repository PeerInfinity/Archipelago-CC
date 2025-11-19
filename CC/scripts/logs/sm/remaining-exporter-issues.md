# Super Metroid - Remaining Exporter Issues

This document tracks unresolved issues with the Super Metroid exporter (exporter/games/sm.py).

---

## Issue 1: Cannot distinguish simple vs complex accessFrom patterns

**Status**: Partially Fixed
**Location**: `exporter/games/sm.py`, `expand_rule()` method
**Priority**: HIGH

**Description**:
Super Metroid uses `accessFrom` comprehensions to check location accessibility from multiple access points. The pattern is:
```python
any((state.can_reach(accessName) and self.evalSMBool(rule(sm), maxDiff)) for accessName, rule in accessFrom.items())
```

The exporter detects these patterns and attempts to distinguish between:
- Simple patterns: where `rule` is `SMBool(True)` (no item requirements)
- Complex patterns: where `rule` has actual requirements (e.g., `sm.canPassTerminatorBombWall()`)

However, even simple patterns create deeply nested `any_of` structures due to recursion limits in the analyzer. This makes it impossible to reliably detect simple patterns in the current implementation.

**Current Behavior**:
- Locations with complex accessFrom + `SMBool(True)` Available: Correctly exported as `false`
- Locations with simple accessFrom + `SMBool(True)` Available: Incorrectly exported as `false` (should be accessible)

**Impact**:
- "Morphing Ball" location is not accessible in Sphere 0 (should be accessible)
- This prevents progression beyond Sphere 0 in spoiler tests

**Example**:
"Morphing Ball" has:
```python
AccessFrom = {'Blue Brinstar Elevator Bottom': lambda sm: SMBool(True)}
Available = lambda sm: SMBool(True)
```
Should be accessible from Blue Brinstar Elevator Bottom with no requirements, but is exported as `constant: false`.

**Possible Solutions**:
1. **Implement VARIA logic helpers** in frontend to properly evaluate accessFrom requirements
2. **Move accessFrom logic to region entrance rules** instead of location access rules
3. **Create special handling** for locations known to have simple accessFrom patterns
4. **Modify the analyzer** to preserve information about whether accessFrom rules are simple
5. **Hardcode exceptions** for specific locations like "Morphing Ball" (not ideal but practical)

**Files Affected**:
- `exporter/games/sm.py` (lines 218-301)
- `frontend/modules/shared/gameLogic/sm/smLogic.js` (VARIA helpers)

---

## Issue 2: Missing VARIA Logic Helpers

**Status**: Partially Implemented
**Location**: `frontend/modules/shared/gameLogic/sm/smLogic.js`
**Priority**: HIGH

**Description**:
Super Metroid uses the VARIA randomizer logic system which includes many specialized helper functions. Only a subset are currently implemented.

**Implemented**:
- `evalSMBool()`, `SMBool()`, `wor()`, `wand()`, `haveItem()`
- `knowsCeilingDBoost()` (stub returning true)
- `canUsePowerBombs()`, `canFly()`, `canSimpleShortCharge()` (stubs returning false)

**Not Implemented** (examples from generation output):
- `canPassTerminatorBombWall()`
- `canPassCrateriaGreenPirates()`
- `knowsGravLessLevel3()`
- `canSpringBallJump()`
- Many others referenced in VARIA logic

**Impact**:
- Locations with complex Available rules can be partially evaluated
- Locations relying on accessFrom logic cannot be properly evaluated
- Missing helpers default to false, preventing correct accessibility

**Solution**:
Systematically implement VARIA logic helpers by:
1. Analyzing `worlds/sm/variaRandomizer/` Python code
2. Identifying all helper functions used in location access rules
3. Translating logic to JavaScript equivalents
4. Testing with actual game progression

**Reference**:
- Python VARIA logic: `worlds/sm/variaRandomizer/logic/`
- Location definitions: `worlds/sm/variaRandomizer/graph/vanilla/graph_locations.py`

---
