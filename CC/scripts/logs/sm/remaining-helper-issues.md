# Super Metroid - Remaining Helper Issues

## Issue 1: Full spoiler test fails at Sphere 0.2 (Bomb location) - INVESTIGATING

### Problem
When running with `extend_sphere_log_to_all_locations = True` (full spoiler test), the test fails at Sphere 0.2 because the "Bomb" location is not marked accessible when it should be.

### Context
- Minimal spoiler test (extend_sphere_log_to_all_locations = False) passes
- Full spoiler test (extend_sphere_log_to_all_locations = True) fails
- Error: "Access rule evaluation failed" for "Bomb" location at Sphere 0.2
- At Sphere 0.2, player has Missile + Morph Ball

### Expected Behavior
The Bomb location access rule requires:
1. CanReachRegion("Landing Site") - should pass (starting region)
2. wand(haveItem("Morph"), traverse("FlywayRight")) - should pass (Morph Ball + red door with Missile)
3. wor(knowsAlcatrazEscape, canPassBombPassages) - should pass (knowsAlcatrazEscape is enabled)

### Possible Causes
1. StaticData may not be fully populated when analysisReporter evaluates the rule
2. game_info.doors data might not be accessible during analysis phase
3. Timing issue with how the comparison engine gets the snapshot
4. SMBool return value handling issue in the analysis context

### Impact
- Minimal spoiler test: PASSES (primary use case)
- Full spoiler test: FAILS (extended accessibility tracking)

### Workaround
Use minimal spoiler test mode for now.

Last updated: 2025-12-27
Last test: Seed 1 - Minimal spoiler passes, full spoiler fails at Sphere 0.2
