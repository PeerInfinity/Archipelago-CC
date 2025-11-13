# Remaining Helper Issues for Secret of Evermore

## Issue 1: Sphere 1.1 mismatch - 46 locations accessible too early

**Status:** In Progress

**Description:**
The spoiler test now passes Spheres 0 and 0.1 but fails at Sphere 1.1. At this sphere, 46 locations (Pyramid and Tiny's hideout) are accessible in STATE but should not be accessible yet (they should unlock at Sphere 1.2).

**Locations Affected:**
- Pyramid bottom #117, #119, #120, #126-134
- Pyramid top #135-139, #141-157
- Tiny's hideout #158-164
- Oglin Cave #179
- Aquagoth, Sons of Sth., Barrier, Double Drain

**Analysis:**
- Sphere 1.1 is when Diamond Eye is collected from Cave Raptors
- Sphere 1.2 is when another Diamond Eye is collected and Pyramid locations should unlock
- The helper is making these locations accessible one sphere too early

**Possible Causes:**
1. Logic rules might be giving extra progress when Diamond Eye is collected
2. Multiple Diamond Eye items might be counted incorrectly
3. Logic rules might be applied multiple times to the same progress

**Next Steps:**
1. Check Diamond Eye provides data and logic rules
2. Add logging to see what progress is being counted at Sphere 1.1
3. Verify logic rules aren't being double-counted
