# Solved Helper Issues

## Issue 1: Form level unlocks (form_list_unlock) - SOLVED

**Error**: Locations accessible too early (Master levels 4-7 in Sphere 0.2)
**Root Cause**: form_list_unlock was being expanded to simple item_check, not counting total forms

**Solution**:
1. Created frontend/modules/shared/gameLogic/kh2/kh2Logic.js with form_list_unlock helper
2. Implemented form counting logic that matches Python's get_form_level_requirement
3. Updated KH2 exporter to preserve form_list_unlock as helper instead of expanding it
4. Added attribute resolution for helper arguments
5. Registered KH2 in gameLogicRegistry.js

**Files Modified**:
- frontend/modules/shared/gameLogic/kh2/kh2Logic.js (new file)
- exporter/games/kh2.py (lines 29-32)
- exporter/exporter.py (lines 43-83 - resolve_attribute function)
- frontend/modules/shared/gameLogic/gameLogicRegistry.js (added KH2 import and registry entry)

**Result**: Sphere 0.2 now passes, test progresses to Sphere 0.3

