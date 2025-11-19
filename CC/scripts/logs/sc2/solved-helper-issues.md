# Solved Helper Issues for Starcraft 2

## Issue 1: welcome_to_the_jungle_requirement (FIXED)

**Sphere**: 17.8
**Locations fixed**:
- All Welcome to the Jungle mission locations (12 locations)

**Fix**: Implemented the helper to check for:
- (terran_common_unit AND terran_competent_ground_to_air) OR
- (advanced_tactics AND (Marine OR Vulture) AND terran_air_anti_air)

## Issue 2: terran_base_trasher (FIXED)

**Sphere**: 17.8
**Locations fixed**:
- Welcome to the Jungle: Main Base

**Fix**: Implemented to check for:
- Siege Tank OR
- Battlecruiser + ATX Laser Battery OR
- Liberator + Raid Artillery OR
- (advanced tactics) specific combinations

Also implemented related helpers:
- can_nuke
- terran_mobile_detector

## Issue 3: zerg_competent_defense (FIXED)

**Sphere**: 17.9
**Locations fixed**:
- All The Crucible mission locations (7 locations)

**Fix**: Implemented to check for zerg_common_unit and defensive units like Swarm Host, Brood Lord, Impaler/Lurker, or (advanced) Viper/Spine Crawler

## Issue 4: protoss_stalker_upgrade (FIXED)

**Sphere**: 17.14
**Locations fixed**:
- Beat Evil Awoken
- Evil Awoken: Victory

**Fix**: Corrected item names to match actual game data:
- "Disintegrating Particles (Stalker/Instigator/Slayer)"
- "Particle Reflection (Stalker/Instigator/Slayer)"

Also implemented lock_any_item helper.
