# Solved Exporter Issues

## Issue 1: Space Zone 2 - Boss - Incomplete rule export

**Location:** Space Zone 2 - Boss
**Status:** FIXED
**Priority:** High
**Sphere:** 1.1

### Problem Description
The exporter was only capturing the first branch of the `space_zone_2_boss` logic function, missing the alternative conditions that make the location accessible.

### Solution
Fixed in two parts:

**Part 1: Multistatement if-body processing**
- Added `should_process_multistatement_if_bodies()` support to the analyzer
- Modified `visit_If` in `ast_visitors.py` to process all statements in if-bodies when enabled
- Updated `visit_FunctionDef` to delegate to `visit_If` for proper multistatement handling
- Added simplification logic to extract test conditions from simple if/return patterns
- Combines multiple conditions using OR logic

**Part 2: Settings resolution**
- Added pattern recognition for `state.multiworld.worlds[player].options.*` in marioland2 exporter
- Implemented recursive expansion of OR, AND, conditional, and NOT rules
- Added caching of option values in `get_settings_data` for use in `expand_rule`
- Added fallback default values for known options (shuffle_midway_bells = 0)
- Exported shuffle_midway_bells setting to rules.json

### Files Modified
- `exporter/analyzer/ast_visitors.py`: Multistatement processing
- `exporter/games/marioland2.py`: Settings resolution and recursive expansion

### Test Result
Spoiler test now passes for Super Mario Land 2!
