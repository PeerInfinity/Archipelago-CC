# Solved Helper Issues for Lingo

## Issue 1: Mastery checking not implemented

**Status**: FIXED ✓

**Description**: The helper function `lingo_can_use_mastery_location` was not implemented, and `_lingo_can_satisfy_requirements` was skipping the_master check with a warning.

**Location**: frontend/modules/shared/gameLogic/lingo/lingoLogic.js:81

**Impact**: Caused Orange Tower Basement to be accessible too early because the Mastery door's the_master requirement was not enforced.

**Fix**:
1. Implemented lingo_can_use_mastery_location function (lines 81-113)
2. Updated _lingo_can_satisfy_requirements to call lingo_can_use_mastery_location when access.the_master is true (lines 197-202)
3. Exported lingo_can_use_mastery_location in helperFunctions (line 316)

The implementation counts how many mastery requirements are satisfied and returns true if the count meets or exceeds the mastery_achievements setting.
