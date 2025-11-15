# Remaining SMZ3 Helper Issues

## Current Status

All 21 SMZ3 helper functions have been implemented with correct item names. However, there is one remaining issue:

### Issue: Tower of Hera Not Accessible in Sphere 0.3

**Status:** Under investigation
**Priority:** High

**Description:**
The spoiler test fails because "Tower of Hera" is not accessible in Sphere 0.3, even though all requirements appear to be met:

**Tower of Hera Entrance Requirements:**
1. (Mirror OR (Hookshot AND Hammer)) ✓ - Player has Mirror (acquired in Sphere 0.1)
2. Light World Death Mountain West is accessible ✓ - Player has Flute (acquired in Sphere 0.3)

**Items Available by Sphere 0.3:**
- Mirror (Sphere 0.1)
- Somaria (Sphere 0.2)
- Flute (Sphere 0.3)

**Suspected Root Cause:**
The entrance rule uses a `region_accessible` check for "Light World Death Mountain West". This might not be evaluated correctly, or there could be a timing issue where the region hasn't been marked accessible yet when Tower of Hera's entrance is being evaluated.

**Next Steps:**
1. Investigate how `region_accessible` checks are processed in the rule engine
2. Check if there's a proper reachability update mechanism
3. May need to trigger region reachability calculations after each sphere update
4. Consider if the region evaluation order matters

**Test Output:**
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"0.3","player_id":"1"}
> Regions accessible in LOG but NOT in STATE: Tower of Hera
```

---

## Potential Item Name Issues

Some item names may still need verification:
- Progressive items (ProgressiveSword, ProgressiveGlove) - check if count-based logic is correct
- Key cards - verify exact names match (CardMaridiaL1, etc.)
- Super Metroid beams and suits - verify Charge, Wave, Ice, Plasma, Varia, Gravity

These will be validated as more regions become accessible in testing.
