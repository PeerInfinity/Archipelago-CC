# Remaining Exporter Issues

## Issue 1: Sphere 0 - 221 regions accessible that shouldn't be

**Test failure:** Sphere 0 has 221 regions accessible in JavaScript STATE but NOT in Python LOG

**Error details:**
- Locations accessible in STATE but NOT in LOG (221 locations): BR01, BR05, CO16, CO24, CO29, CO33, D01BZ02S01, D01BZ04S01, D01BZ06S01, D01BZ08S01, D01Z01S03[W], D01Z01S04[E], ... (and many more)

**Root cause:** These appear to be regions that are being marked as accessible from the start when they should have access requirements.

**Expected behavior:** In Sphere 0, only regions with no access requirements (or with starting abilities like Dash and Wall Climb) should be accessible.

**Investigation needed:**
1. Check if the exporter is correctly exporting access_rule for region exits
2. Verify that the access rules are not being set to null/true when they should have requirements
3. Check if the initial state is correctly set up

**Status:** Investigating

