# LADX Solved Exporter Issues

## Issue 1: isinstance helper not found - FULLY FIXED

**Status:** All isinstance errors eliminated and region accessibility now 99%+ accurate!

**What was fixed:**
1. **Direct condition extraction**: Implemented `handle_complex_exit_rule` to extract entrance.condition directly from entrance objects using `__self__` attribute
2. **LADXR AND/OR conversion**: Added `_convert_ladxr_condition_to_rule` to convert LADXR's AND and OR condition objects to rule structures using Python name mangling
3. **String condition parsing**: Implemented parser for LADXR's "and['X', 'Y']" and "or['X', 'Y']" string formats
4. **Item name mapping**: Created mapping from LADXR internal names to Archipelago item names

**Results:**
- Exit rule distribution: 12 null, 279 item_check, 151 constant, 157 and, 192 or (was 589 null!)
- Test accuracy: 99%+ (1 mismatch down from 40+ regions)
- isinstance errors: 0 (was 237)

**Files modified:**
- `exporter/games/ladx.py`: Complete implementation with all three extraction methods

**Remaining:** Single Rooster Cave accessibility issue (documented separately)
