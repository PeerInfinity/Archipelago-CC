# SC2 Solved Helper Issues

## 1. zerg_basic_anti_air - Inverted kerrigan check (Fixed 2025-11-26)

**Problem:** The Python check `self.kerrigan_unit_available in kerrigan_unit_available` has unusual semantics because `kerrigan_unit_available` is a list containing `[0]`. Since True == 1 and False == 0 in Python:
- When Kerrigan IS available (True), the check fails (`True in [0]` = False)
- When Kerrigan is NOT available (False), the check passes (`False in [0]` = True)

**Fix:** Changed `if (kerriganUnitAvailable)` to `if (!kerriganUnitAvailable)` to match Python's semantics.

## 2. marine_medic_upgrade - Incorrect logic (Fixed 2025-11-26)

**Problem:** Implementation was checking for `has_any(marineUpgrades) && has_any(medicUpgrades)`, but Python checks for:
1. Any of: Combat Shield (Marine), Magrail Munitions (Marine), Stabilizer Medpacks (Medic)
2. OR: 2+ Progressive Stimpack (Marine) AND at least 1 mission completed

**Fix:** Rewrote function to match Python logic.

## 3. engine_of_destruction_requirement - Wrong logic (Fixed 2025-11-26)

**Problem:** Implementation just checked for `has(snapshot, 'Beat Cutthroat')`.

**Fix:** Changed to require `marine_medic_upgrade AND ((terran_competent_anti_air AND terran_common_unit) OR Wraith)`.

## 4. The Escape helpers - Incorrect implementations (Fixed 2025-11-26)

**Problem:** `the_escape_requirement` had completely wrong logic checking for suit modules and weapon counts.

**Fix:** Rewrote to match Python:
- `the_escape_first_stage_requirement`: stuff_granted OR (nova_ranged_weapon AND (nova_full_stealth OR nova_heal))
- `the_escape_requirement`: first_stage_requirement AND (stuff_granted OR nova_splash)

## 5. sudden_strike_requirement - Missing logic (Fixed 2025-11-26)

**Problem:** Just checked for `has(snapshot, 'Beat The Escape')`.

**Fix:** Changed to require:
1. sudden_strike_can_reach_objectives
2. AND terran_able_to_snipe_defiler
3. AND (Siege Tank OR Vulture)
4. AND nova_splash
5. AND (terran_defense_rating >= 2 OR Jump Suit Module)

## 6. protoss_common_unit - Missing Dragoon (Fixed 2025-11-26)

**Problem:** The basic Protoss units list was missing Dragoon.

**Fix:** Added Dragoon to basic units list: Zealot, Centurion, Sentinel, Stalker, Instigator, Slayer, Dragoon, Adept.

## 7. zerg_pass_vents - Wrong units (Fixed 2025-11-26)

**Problem:** Was checking for `['Zergling', 'Baneling', 'Infested Terran']`.

**Fix:** Changed to match Python:
- story_tech_granted OR
- has_any(Zergling, Hydralisk, Roach) OR
- (advanced_tactics AND Infestor)

## 8. templars_charge_requirement - Missing requirements (Fixed 2025-11-26)

**Problem:** Just checked for `protoss_fleet()`.

**Fix:** Changed to require: `protoss_heal AND protoss_anti_armor_anti_air AND (protoss_fleet OR (advanced_tactics AND protoss_competent_comp))`

## 9. templars_return_requirement - Completely wrong logic (Fixed 2025-11-26)

**Problem:** Just checked for `protoss_fleet()`.

**Fix:** Changed to require:
- story_tech_granted OR
- (has_any(Immortal, Annihilator) AND has_any(Colossus, Vanguard, Reaver, Dark Templar) AND has_any(Sentry, High Templar))

## 10. terran_common_unit - Wrong unit list (Fixed 2025-11-26)

**Problem:** Included Firebat, Reaper, Diamondback, Viking, Banshee as basic units.

**Fix:** Changed to match Python:
- Basic: Marine, Marauder, Goliath, Hellion, Vulture, Warhound
- Advanced (with advanced_tactics): Reaper, Diamondback, Viking, Siege Tank, Banshee, Thor, Battlecruiser, Cyclone
