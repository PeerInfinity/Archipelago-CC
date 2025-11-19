# Super Metroid - Remaining Exporter Issues

This document tracks outstanding issues with the Super Metroid exporter (`exporter/games/sm.py`).

## Issues

### Issue 1: accessFrom comprehension pattern incorrectly simplified to constant True

**Severity:** Critical
**Status:** Identified
**Location:** `exporter/games/sm.py` - `_check_accessFrom_pattern()` and `expand_rule()`

**Description:**
The exporter detects the `accessFrom` comprehension pattern (used for location access rules) and simplifies it to `{"type": "constant", "value": true}`. This causes all locations to have trivial access rules even when they should require specific items or abilities.

**Evidence from generation output:**
```
analyze_rule: Function <function SMWorld.set_rules.<locals>.add_accessFrom_rule.<locals>.<lambda> at 0x7eaf2dba8720> (id=139290851575584) seen 11 times, stopping recursion.
SM: Found accessFrom comprehension pattern, simplifying to constant True
[SM] Simplifying accessFrom pattern to constant True
```

**Impact:**
- Locations that should require items (e.g., "Energy Tank, Terminator" requires Bomb) are exported with access_rule = constant true
- This causes the JavaScript frontend to think they're accessible from the start
- Sphere 0 test shows:
  - **Expected accessible:** Energy Tank, Brinstar Ceiling, Morphing Ball
  - **Actually accessible in STATE:** Energy Tank, Terminator, Missile (Crateria gauntlet right), Missile (Crateria gauntlet left), Power Bomb (blue Brinstar), etc.

**Example affected location:**
```json
{
  "name": "Energy Tank, Terminator",
  "id": 82008,
  "access_rule": {
    "type": "and",
    "conditions": [
      {"type": "constant", "value": true},
      {"type": "constant", "value": true}
    ]
  }
}
```

**Root cause:**
The exporter's `_check_accessFrom_pattern()` method detects comprehensions that iterate over `accessFrom.items()` and returns True. Then in `expand_rule()`, when this pattern is detected, it returns `{"type": "constant", "value": True}`.

The logic in Python is:
```python
lambda state: any((state.can_reach(accessName, player=player) and
                   self.evalSMBool(rule(state.smbm[player]), state.smbm[player].maxDiff))
                  for accessName, rule in accessFrom.items()))
```

This needs to be properly exported, not simplified to constant true.

**Proposed fix:**
1. Remove or modify the `_check_accessFrom_pattern()` check
2. Try to export the actual structure of the comprehension
3. Or, preserve the evalSMBool calls within the comprehension instead of simplifying

**Files affected:**
- `exporter/games/sm.py` (lines 80-108, 126-129)
