# Starcraft 2 - Solved Helper Issues

## Issue 1: sudden_strike_can_reach_objectives and terran_cliffjumper helpers

**Status:** FIXED

**Locations affected:**
- Sudden Strike: Research Center
- Sudden Strike: Weaponry Labs

**Original test failure:**
- Sphere 16.4
- Error: "Access rule evaluation failed"
- Locations accessible in LOG but NOT in STATE

**Fix applied:**
1. Implemented `terran_cliffjumper` as a named export function:
```javascript
export function terran_cliffjumper(snapshot, staticData) {
    return has(snapshot, 'Reaper')
        || has_all(snapshot, ['Goliath', 'Jump Jets (Goliath)'])
        || has_all(snapshot, ['Siege Tank', 'Jump Jets (Siege Tank)']);
}
```

2. Implemented `sudden_strike_can_reach_objectives` using the new helper:
```javascript
sudden_strike_can_reach_objectives: (snapshot, staticData) => {
    const advancedTactics = isAdvancedTactics(staticData);

    if (terran_cliffjumper(snapshot, staticData)) {
        return true;
    }

    if (has_any(snapshot, ['Banshee', 'Viking'])) {
        return true;
    }

    if (advancedTactics && has(snapshot, 'Medivac') && has_any(snapshot, ['Marine', 'Marauder', 'Vulture', 'Hellion', 'Goliath'])) {
        return true;
    }

    return false;
}
```

**Result:** Test now passes Sphere 16.4 and progresses to Sphere 17.2

## Issue 2: Enemy Intelligence helper functions

**Status:** FIXED

**Locations affected:**
- Enemy Intelligence: All Garrisons
- Enemy Intelligence: Close Garrison
- Enemy Intelligence: Forces Rescued
- Enemy Intelligence: Northeast Garrison
- Enemy Intelligence: South Garrison
- Enemy Intelligence: Southeast Garrison
- Enemy Intelligence: West Garrison
- Enemy Intelligence: Communications Hub (second stage)

**Original test failure:**
- Sphere 17.2 - 8 locations failed
- Error: "Access rule evaluation failed"

**Fix applied:**
1. Implemented `enemy_intelligence_garrisonable_unit` as named export
2. Implemented `enemy_intelligence_cliff_garrison` as named export
3. Implemented `enemy_intelligence_first_stage_requirement` as named export
4. Implemented nova helper functions: `nova_any_weapon`, `nova_ranged_weapon`, `nova_splash`, `nova_full_stealth`, `nova_heal`
5. Implemented `enemy_intelligence_second_stage_requirement` using all the above helpers

**Result:** Test now passes Sphere 17.2 and 17.8, progressing to Sphere 17.8 with "Welcome to the Jungle" locations
