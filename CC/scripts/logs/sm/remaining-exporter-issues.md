# Super Metroid - Remaining Exporter Issues

## Issue 1: Cannot distinguish simple vs complex accessFrom patterns

**Status**: Blocked - Requires VARIA Logic Implementation

**Description**:
Super Metroid locations have rules combining `accessFrom` (which regions can access the location) and `Available` (item requirements once in the region). Many locations have `Available = SMBool(True)` (no item requirements), but differ in their `accessFrom` requirements:

- **Simple accessFrom**: Only requires reaching a region with no item checks (e.g., `lambda sm: SMBool(True)`)
  - Example: Morphing Ball - accessible in sphere 0
- **Complex accessFrom**: Requires items to pass from region to location (e.g., `lambda sm: sm.canPassTerminatorBombWall()`)
  - Example: Energy Tank, Terminator - requires Bomb item, accessible in sphere 1.2

**Current Behavior**:
- The analyzer converts `accessFrom` comprehensions but they hit recursion limits and get corrupted
- The exporter detects AND rules with (accessFrom, Available) patterns
- For locations with `Available = SMBool(True)`, we export as `False` to prevent incorrect accessibility
- This causes simple accessFrom locations (like Morphing Ball) to be incorrectly inaccessible

**Test Results**:
- Sphere 0: Missing 1 location (Morphing Ball) - should be accessible but is False

**Python Source Examples**:
```python
# Simple accessFrom - should be True
locationsDict["Morphing Ball"].AccessFrom = {
    'Blue Brinstar Elevator Bottom': lambda sm: SMBool(True)
}
locationsDict["Morphing Ball"].Available = lambda sm: SMBool(True)

# Complex accessFrom - should be False until items obtained
locationsDict["Energy Tank, Terminator"].AccessFrom = {
    'Landing Site': lambda sm: sm.canPassTerminatorBombWall(),
    'Lower Mushrooms Left': lambda sm: sm.canPassCrateriaGreenPirates(),
    'Gauntlet Top': lambda sm: sm.haveItem('Morph')
}
locationsDict["Energy Tank, Terminator"].Available = lambda sm: SMBool(True)
```

**Attempted Solutions**:
1. ✓ Converted `self.evalSMBool` function calls to helper type (fixed in analyzer)
2. ✓ Export complex accessFrom patterns as False instead of True
3. ✗ Use `_is_simple_accessFrom()` to detect simple patterns - doesn't work due to recursion corruption
4. ✗ Check for complex helpers in accessFrom - analyzer converts all helpers to generic "rule" helper during recursion, making detection impossible

**Current Workaround**:
Export all `SMBool(True) + accessFrom` locations as False (conservative approach). This prevents incorrect accessibility but means some locations like "Morphing Ball" that should be accessible in sphere 0 are marked as False.

**Root Cause**:
The analyzer hits Python recursion limits when processing accessFrom comprehensions and converts complex helper calls (like `sm.canPassTerminatorBombWall()`) into generic "rule" helpers, losing the information needed to distinguish simple from complex patterns.

**Recommended Solution**:
1. **Implement VARIA logic helpers**: Implement the full set of VARIA logic methods (sm.canPassTerminatorBombWall, etc.) in the frontend so accessFrom rules can be properly evaluated
2. **Improve recursion handling**: Fix the analyzer to handle accessFrom comprehensions without hitting recursion limits
3. **Pre-analysis detection**: Check the original Python lambda before analysis to determine if it's simple
4. **Export metadata**: Add metadata to rules indicating whether they're simple or complex

**Files Involved**:
- exporter/games/sm.py:285-292 (expand_rule method handling SMBool(True) + accessFrom)
- exporter/games/sm.py:218-245 (_is_simple_accessFrom method)
- worlds/sm/variaRandomizer/graph/vanilla/graph_locations.py (location definitions)
