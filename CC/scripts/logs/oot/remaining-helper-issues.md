# Remaining Helper Issues for Ocarina of Time

This file tracks helper function issues that still need to be fixed.

## Issues

### 1. Many missing helper functions

**Issue**: The test shows many "Unknown helper" warnings for OOT-specific helper functions that aren't implemented.

**Missing helpers** (from test output):
- `can_blast_or_smash`
- `can_open_bomb_grotto`
- `can_build_rainbow_bridge`
- `can_plant_bean`
- `can_ride_epona`
- `can_open_storm_grotto`
- `can_dive`
- `has_explosives`
- `has_bottle`
- `can_cut_shrubs`
- `can_plant_bugs`
- `can_break_crate`
- `can_summon_gossip_fairy`
- `can_summon_gossip_fairy_without_suns`
- `logic_*` helpers (e.g., `logic_visible_collisions`, `logic_kakariko_rooftop_gs`, etc.)
- `shuffle_dungeon_entrances`
- `entrance_shuffle`
- `dodongos_cavern_shortcuts`
- `can_trigger_lacs`
- `can_finish_GerudoFortress`
- And many more...

**Impact**: Locations requiring these helpers cannot be properly evaluated, causing them to be inaccessible even when they should be accessible.

**Fix needed**: Implement these helper functions in `frontend/modules/shared/gameLogic/oot/ootLogic.js`. Each helper needs to check the appropriate items, settings, and state to determine if the condition is met.

**Location**: `frontend/modules/shared/gameLogic/oot/ootLogic.js` - add to `createEvaluationContext`

---

### 2. Time-related helpers need proper implementation

**Issue**: Helpers like `at_dampe_time`, `at_night`, `at_day` are currently stubbed to always return `true`.

**Evidence**: In `ootLogic.js` line 114-116:
```javascript
at_night: () => true, // TODO: Implement time of day logic
at_day: () => true,
at_dampe: () => true,
```

**Impact**: Locations that should only be accessible at certain times of day are always accessible, or rules use `at_dampe_time` which doesn't match the defined `at_dampe` helper.

**Fix needed**: Implement proper time-of-day logic based on settings or state flags.

**Location**: `frontend/modules/shared/gameLogic/oot/ootLogic.js` - `createEvaluationContext`

---

### 3. Item count checks with specific amounts

**Issue**: Rules like `Progressive_Scale, 2` or `Gold_Skulltula_Token, 10` aren't being parsed correctly.

**Evidence**: From test logs - "Unknown rule pattern: Progressive_Scale, 2"

**Impact**: Locations requiring specific item counts cannot be properly evaluated.

**Fix needed**: The `parse_oot_rule` function needs to handle comma-separated item and count pairs.

**Location**: `frontend/modules/shared/gameLogic/oot/ootLogic.js` - `evaluateRuleString`
