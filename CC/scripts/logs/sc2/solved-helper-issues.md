# SC2 Helper Issues - Solved

## Issue 1: Item naming mismatch in helper functions (Sphere 12.6) - SOLVED

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

**Root cause:**
The helper functions were using incorrect item naming convention for unit upgrades.
- Used: `"Battlecruiser ATX Laser Battery"` (wrong)
- Should be: `"ATX Laser Battery (Battlecruiser)"` (correct)

The SC2 naming convention is `<upgrade> (<unit>)`, not `<unit> <upgrade>`.

**Fixed items:**
1. `terran_air_anti_air` helper:
   - Fixed: `'Wraith Advanced Laser Technology'` → `'Advanced Laser Technology (Wraith)'`
   - Fixed: `'Battlecruiser ATX Laser Battery'` → `'ATX Laser Battery (Battlecruiser)'`
2. `terran_bio_heal` helper:
   - Fixed: `'Raven Bio-Mechanical Repair Drone'` → `'Bio Mechanical Repair Drone (Raven)'`
3. `terran_competent_comp` helper:
   - Fixed: `'Liberator Raid Artillery'` → `'Raid Artillery (Liberator)'`
4. Protoss helper:
   - Fixed: `'Warp Prism Phase Blaster'` → `'Phase Blaster (Warp Prism)'`

**Result:**
Test now progresses past sphere 12.6 and fails at sphere 14.1 instead.
