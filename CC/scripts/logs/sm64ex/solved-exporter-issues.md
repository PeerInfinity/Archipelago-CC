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
- `exporter/games/sm64ex.py` - Main exporter handler (314 lines)
