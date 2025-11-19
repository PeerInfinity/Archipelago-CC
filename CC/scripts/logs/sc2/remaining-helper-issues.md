# SC2 Remaining Helper Issues

## Issue 1: Trouble In Paradise Requirements - Access Rule Evaluation Failed

### Symptom
- **Test failure at:** Sphere 19.3
- **Locations affected:** All "Trouble In Paradise" mission locations (11 locations total)
- **Error:** "Access rule evaluation failed"
- **Status:** Locations accessible in LOG but NOT in STATE

### Details
All locations in Trouble In Paradise mission use the `trouble_in_paradise_requirement` helper function. The Python backend considers these locations accessible at Sphere 19.3 (after "Beat Enemy Intelligence" is collected), but the JavaScript helper is not evaluating to true.

### Requirements
The helper requires:
1. `nova_any_weapon` - Player has a Nova weapon
2. `nova_splash` - Player has Nova splash capability
3. `terran_beats_protoss_deathball` - Can beat Protoss deathball
4. `terran_defense_rating(..., true, true) >= 7` - Defense rating >= 7

### Investigation Status
- Player inventory at Sphere 19.3 includes: C20A Canister Rifle, Hellfire Shotgun, Plasma Rifle, Banshee, Battlecruiser, Wraith with Advanced Laser Technology, Marine, Medic, Siege Tank with Maelstrom Rounds, etc.
- All requirements appear to be satisfied in manual evaluation
- Need to debug why JavaScript evaluation is returning false

### Recent Fixes
- Implemented `trouble_in_paradise_requirement` (was returning `false` stub)
- Fixed `terran_beats_protoss_deathball` to match Python implementation

---
Last updated: 2025-11-19
