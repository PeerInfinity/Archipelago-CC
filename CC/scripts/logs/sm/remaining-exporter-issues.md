# Remaining Exporter Issues

## Issue 1: accessFrom comprehensions cannot be exported

**Status:** Blocked - requires VARIA logic implementation

**Problem:**
Super Metroid uses the VARIA Randomizer logic system, which employs complex `accessFrom` comprehensions. These comprehensions specify which regions can access each location and what items/techniques are needed to traverse from each region to the location.

The analyzer hits recursion limits (11 iterations) when trying to analyze these comprehensions, making it impossible to properly export the access rules.

**Current behavior:**
The exporter detects AND patterns combining accessFrom and Available, skips the accessFrom part (due to recursion), and exports only the Available part. When Available is `evalSMBool(SMBool(True), ...)`, this means "no item requirements WITHIN the region" but accessFrom may still have requirements for REACHING the region.

**Impact:**
We cannot distinguish between:
- Locations truly accessible from start (like "Morphing Ball")
- Locations requiring items despite being in accessible regions (like "Energy Tank, Terminator")

**Test results - Sphere 0:**
- FAIL: 4 locations incorrectly accessible (Energy Tank Terminator, Missile Crateria gauntlet left/right, Power Bomb blue Brinstar)
- These should require items (Bomb, Reserve Tank, Power Bomb respectively) but are marked accessible with just SMBool(True)

**Recommendation:**
This requires full VARIA logic implementation - a substantial effort. Focus on simpler games first, return to Super Metroid later with better infrastructure.

