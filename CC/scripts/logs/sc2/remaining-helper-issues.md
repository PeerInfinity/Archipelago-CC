# Starcraft 2 - Remaining Helper Issues

## Issue 1: Welcome to the Jungle helper functions not implemented

**Status:** Not fixed

**Locations affected:**
- Beat Welcome to the Jungle
- Welcome to the Jungle: Main Base
- Welcome to the Jungle: Middle Base
- Welcome to the Jungle: No Terrazine Nodes Sealed
- Welcome to the Jungle: North-East Relic
- Welcome to the Jungle: Up to 1/2/3/4/5 Terrazine Nodes Sealed (multiple)
- Welcome to the Jungle: Victory
- Welcome to the Jungle: West Relic

**Test failure:**
- Sphere 17.8
- Error: "Access rule evaluation failed"
- Locations accessible in LOG but NOT in STATE

**Root cause:**
"Welcome to the Jungle" mission-specific helper functions are likely not implemented or returning false.

**Next steps:**
- Check the access rules for these locations in the rules.json file
- Find the Python implementations in worlds/sc2/Rules.py
- Implement the missing helpers in frontend/modules/shared/gameLogic/sc2/helpers.js
