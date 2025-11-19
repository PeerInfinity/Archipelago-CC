# Remaining General Issues for Stardew Valley

This file tracks general issues that still need to be fixed.

## Issue 1: Museumsanity locations not accessible at sphere 2.1

**Status:** Under investigation

**Locations:**
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

**Sphere:** 2.1

**Symptom:** Locations are accessible in Python backend (LOG) but not in JavaScript frontend (STATE)

**Progress:**
- The first issue (progression tracking) has been fixed
- Test now progresses to sphere 2.1 before failing
- Need to investigate why Museumsanity locations are not being recognized as accessible

**Next Steps:**
- Check access rules for Museumsanity locations
- Verify museum donation tracking is working correctly
- Check if there are helper functions needed for museum logic
