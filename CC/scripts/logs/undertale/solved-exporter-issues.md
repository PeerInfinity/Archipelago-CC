# Undertale - Solved Exporter Issues

## Issue 1: Entrance reachability checks not handled properly ✅ SOLVED

**Sphere:** 3.2
**Location:** Mettaton Plot
**Problem:** The location uses `state.can_reach("Core Exit", "Entrance", player)` which was being exported as a `state_method` with method "can_reach". The frontend didn't know how to evaluate entrance reachability.

**Python rule (Rules.py:250-251):**
```python
set_rule(multiworld.get_location("Mettaton Plot", player),
         lambda state: state.can_reach("Core Exit", "Entrance", player))
```

**Original exported rule:**
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {"type": "constant", "value": "Core Exit"},
    {"type": "constant", "value": "Entrance"}
  ]
}
```

**Solution:**
1. Created Undertale exporter (`exporter/games/undertale.py`) to convert entrance reachability checks to `can_reach_entrance` type
2. Added support for `can_reach_entrance` rule type in the frontend rule engine (`frontend/modules/shared/ruleEngine.js:1426-1486`)
3. The implementation searches through the regions Map to find the entrance, checks if the source region is reachable, and evaluates the entrance's access rule

**Final exported rule:**
```json
{
  "type": "can_reach_entrance",
  "entrance": "Core Exit"
}
```

**Files modified:**
- `exporter/games/undertale.py` (created)
- `frontend/modules/shared/ruleEngine.js` (added can_reach_entrance case)

**Test result:** ✅ All 16 spheres pass
