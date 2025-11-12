# LADX Solved Exporter Issues

## Issue 1: isinstance helper not found - PARTIALLY FIXED

**Status:** isinstance errors eliminated, but region accessibility still incorrect

**What was fixed:**
- Removed all isinstance checks from entrance access rules
- Implemented `postprocess_entrance_rule` in LADX exporter
- Added LADXR condition string parsing for "and['X', 'Y']" and "or['X', 'Y']" formats
- Simple item checks (like "Progressive Power Bracelet") now work correctly

**Files modified:**
- `exporter/games/ladx.py`: Added postprocess_entrance_rule and LADXR parsing methods

**Next steps:**
- Verify LADXR complex condition parsing is working correctly
- Fix over-accessible regions issue (589 exits are null/always accessible)
