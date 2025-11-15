# Remaining KDL3 Helper Issues

## Summary
Current testing status: 4/10 seeds passing (seeds 1, 2, 6, 7)
Failing seeds: 3, 4, 5, 8, 9, 10

## Issue 1: can_assemble_rob accessing copy_abilities
**Location**: Seed 3, Sphere 4.1
**Description**: The `can_assemble_rob` helper function is making "Sand Canyon 6 - Professor Hector & R.O.B" accessible when it shouldn't be. The function receives `copy_abilities` as a parameter but needs to ensure it's correctly reading the value from the exported settings.

**Error Message**:
```
STATE MISMATCH found for: {"type":"state_update","sphere_number":"4.1","player_id":"1"}
> Locations accessible in STATE (and unchecked) but NOT in LOG: Sand Canyon 6 - Professor Hector & R.O.B
```

**Analysis Needed**:
- Verify `copy_abilities` is being passed from settings to the helper function
- Check if the helper logic correctly matches the Python implementation
- Debug the specific bukiset checking logic for seed 3's randomization

**Python Reference**: worlds/kdl3/rules.py:89-103
**JavaScript Implementation**: frontend/modules/shared/gameLogic/kdl3/kdl3Logic.js:268-337

## Affected Seeds Analysis
- Seed 3: Fails at sphere 4.1 (R.O.B. issue)
- Seed 4: Fails at sphere 6.39
- Seed 5: Fails at sphere 4.37
- Seed 8: Fails at sphere 6.64
- Seed 9: Fails at sphere 5.17
- Seed 10: Fails at sphere 4.1

Multiple seeds fail, suggesting the issue may affect various locations or have multiple root causes.
