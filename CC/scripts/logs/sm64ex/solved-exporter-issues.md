# SM64EX Solved Exporter Issues

## Issue 1: No custom exporter exists - SOLVED

**Status:** SOLVED
**Solution:** Created `exporter/games/sm64ex.py`

### Problem
Super Mario 64 had NO custom exporter. The generic exporter failed to export the custom rules correctly.

### Solution
Created a custom exporter at `exporter/games/sm64ex.py` that:
1. Parses the Rules.py file directly to extract rule expressions before they're converted to lambdas
2. Implements a parser for the RuleFactory expression language
3. Handles all special syntax:
   - `&` for AND
   - `|` for OR
   - `/` for OR (alternative, within tokens)
   - `+` for AND with has_all (within tokens)
   - `{}` for region reachability
   - `{{}}` for location reachability
4. Resolves tokens to item names (TJ → Triple Jump, etc.)
5. Handles special flags (MOVELESS, CAPLESS, CANNLESS, NAR)

### Implementation Details
- Uses `override_rule_analysis()` to intercept rule analysis
- Parses Rules.py with regex to extract `rf.assign_rule()` calls
- Stores original expressions in `_rule_expressions` dict
- Parses expressions recursively: OR → AND → tokens
- Extracts world options during initialization to resolve flags

### Result
Rules are now correctly exported in JSON format. For example:
```python
# Python rule
rf.assign_rule("WF: Fall onto the Caged Island", "CL & {WF: Tower} | MOVELESS & TJ | MOVELESS & LJ | MOVELESS & CANN")

# Exported JSON (simplified)
{
  "type": "or",
  "conditions": [
    {"type": "and", "conditions": [
      {"type": "item_check", "item": "Climb"},
      {"type": "helper", "name": "can_reach_region", "args": ["WF: Tower"]}
    ]},
    # ... more conditions
  ]
}
```

### Files Created
- `exporter/games/sm64ex.py` - Main exporter handler (320 lines)

## Issue 2: Move randomizer logic not handling disabled state - SOLVED

**Status:** SOLVED
**Solution:** Added enable_move_rando setting export and logic

### Problem
The exporter was treating all movement tokens (CL, TJ, etc.) as item requirements even when move randomizer was disabled. In the test seed, move randomizer was disabled (`enable_move_rando: false`), meaning all moves should be available from the start, but the exporter was still requiring them as items.

### Evidence
- Spoiler shows "Enable Move Randomizer: No"
- Settings had `strict_move_requirements: True` but moves were not actually randomized
- Location "WF: Fall onto the Caged Island" required Climb item but should have been accessible with just region access

### Root Cause
The Python `parse_token` function checks `move_rando_bitvec` to determine if a move is randomized. If not randomized, it returns `True` (always available). The exporter wasn't checking `enable_move_rando` setting.

### Solution
1. Added `enable_move_rando` to settings export in `get_settings_data()`
2. Added `enable_move_rando` extraction in `extract_world_options()`
3. Updated `resolve_token()` to return `True` for all move tokens when `enable_move_rando` is False

### Result
Movement tokens now correctly resolve to `True` when move randomizer is disabled, making rules simpler and matching Python logic. Test progressed from failing at sphere 0.1 to sphere 0.3.

### Files Modified
- `exporter/games/sm64ex.py` - Added move randomizer logic (3 methods changed)
