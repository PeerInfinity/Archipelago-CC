# SC2 Helper Issues - Remaining

## Issue 1: Access rule evaluation fails for 9 locations at sphere 12.6

**Locations affected:**
- Beat Evacuation
- Beat Smash and Grab
- Evacuation: Flawless
- Evacuation: Victory
- Smash and Grab: First Forcefield Area Busted
- Smash and Grab: Fourth Relic
- Smash and Grab: Second Forcefield Area Busted
- Smash and Grab: Third Relic
- Smash and Grab: Victory

**Symptom:**
The JavaScript rule engine reports "Access rule evaluation failed" for all these locations.
The Python backend (sphere log) says these should be accessible at sphere 12.6 after getting "ATX Laser Battery (Battlecruiser)".

**Root cause investigation:**
These locations have access rules that include:
1. `terran_early_tech` helper (should work)
2. `terran_defense_rating` helper with compare operation (>=)
3. `terran_basic_anti_air` or `terran_competent_anti_air` helpers (should work)

The `terran_defense_rating` helper is implemented and returns a numeric defense score.
The access rule uses a `compare` type with `>=` operator.

**Next steps:**
- Add debug logging to see what `terran_defense_rating` returns
- Check if the helper is being called correctly
- Verify the compare operation works with numeric results

