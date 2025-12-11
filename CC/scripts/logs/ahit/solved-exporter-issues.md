# A Hat in Time - Solved Exporter Issues

## Issue #1: Telescope Chapter Costs Not Resolving Correctly (SOLVED 2025-12-11)

### Problem Description
The telescope rules from Spaceship to various chapters were exporting incorrect Time Piece requirements. For example:
- Mafia Town required 2 Time Pieces instead of 0
- Battle of the Birds required 3 Time Pieces instead of 17
- Subcon Forest required 4 Time Pieces instead of 12
- Alpine Skyline required 5 Time Pieces instead of 8

This caused the rule engine to fail at Sphere 0 because regions like "Mafia Town Area", "Subcon Forest Area", etc. were not accessible when they should have been.

### Root Cause
The issue was in the `visit_Attribute` method in `exporter/analyzer/ast_visitors.py`. When accessing a dict attribute like `world.chapter_timepiece_costs`, the code converted the dict to a list of its keys (for iteration purposes). However, this broke subscript access.

When analyzing `world.chapter_timepiece_costs[ChapterIndex.MAFIA]`:
1. `visit_Attribute` for `world.chapter_timepiece_costs` returned `{'type': 'constant', 'value': [1, 2, 3, 4, 5, 6, 7]}` (the keys as integers)
2. `visit_Subscript` then did `[1, 2, 3, 4, 5, 6, 7][1]` = 2 (wrong!)
3. The correct behavior should be `chapter_timepiece_costs[ChapterIndex.MAFIA]` = `chapter_timepiece_costs[1]` = 0

### Solution
Added a direct resolution optimization to `visit_Subscript` in `exporter/analyzer/ast_visitors.py` (around line 1849). Before the normal visitor path (which triggers the dict-to-keys conversion), we now:
1. Check if the subscript is on an attribute of an object in closure_vars
2. Directly get the dict from the closure without going through visit_Attribute's conversion
3. Properly subscript the dict with the resolved index

### Files Modified
- `exporter/analyzer/ast_visitors.py`: Added direct resolution for dict subscripts in `visit_Subscript`

### Verification
After the fix, the generated rules.json shows correct chapter costs:
- Mafia Town: 0 (correct)
- Battle of the Birds: 17 (correct)
- Subcon Forest: 12 (correct)
- Alpine Skyline: 8 (correct)
- Time's End: 35 (correct)

Spoiler test now passes all 118 spheres.
