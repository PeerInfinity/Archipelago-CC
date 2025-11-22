# Super Metroid - Remaining Exporter Issues

This file tracks outstanding issues with the Super Metroid exporter (`exporter/games/sm.py`).

## Issue #2: Complex AccessFrom Requirements Not Exported (HIGH PRIORITY)

**Status:** Requires major refactor
**Discovered:** Sphere 1.2 test failure
**Impact:** Critical - many locations incorrectly inaccessible

### Problem

Locations with complex AccessFrom requirements are exported with `access_rule: false`, making them permanently inaccessible. This is a conservative fallback because AccessFrom requirements are not properly exported as region exit rules.

### Example: "Energy Tank, Terminator"

**Python definition:**
```python
AccessFrom = {
    'Landing Site': lambda sm: sm.canPassTerminatorBombWall(),
    'Lower Mushrooms Left': lambda sm: sm.canPassCrateriaGreenPirates(),
    'Gauntlet Top': lambda sm: sm.haveItem('Morph')
}
Available = lambda sm: SMBool(True)
```

**Current export:**
- Region exit: `Landing Site -> Energy Tank, Terminator` with `access_rule: true`
- Location rule: `access_rule: false`

**Problem:** The region exit doesn't include the AccessFrom requirement (`canPassTerminatorBombWall`), so the exporter conservatively marks the location as always inaccessible.

### Root Cause

1. AccessFrom requirements define how to reach a region from various source regions
2. These should be exported as region exit rules with the AccessFrom conditions
3. Currently, region exits are exported with generic `true` rules
4. The exporter has no mechanism to convert AccessFrom lambdas to exit rules

### Required Fix

This requires a major refactor of how regions and exits are built:

1. **Parse AccessFrom data BEFORE building regions:**
   - Use AST analysis to extract AccessFrom from graph_locations.py
   - For each location with AccessFrom, identify source regions and requirements

2. **Create region exits with AccessFrom requirements:**
   - When building region graph, add exits with proper access rules
   - Convert AccessFrom lambdas to exportable rule structures

3. **Handle location Available rules:**
   - If Available = SMBool(True) and AccessFrom exists, export location as `true`
   - The region connectivity handles the actual requirements

4. **Fallback for complex AccessFrom:**
   - If AccessFrom lambda cannot be converted, keep conservative `false` export
   - Document affected locations

### Affected Locations

Many locations are affected. Examples from Sphere 1.2 failure:
- Energy Tank, Terminator
- Missile (Crateria gauntlet left)
- Missile (Crateria gauntlet right)
- Power Bomb (blue Brinstar)
- Plus many more throughout the game

### Workaround

None currently. The test will fail until this is fixed.

### Files to Modify

- `exporter/games/sm.py` - major refactor of region/exit building
- `exporter/games/sm_accessfrom_extractor.py` - enhance to extract full AccessFrom data with requirements
- Possibly `exporter/exporter.py` - may need changes to region processing order
