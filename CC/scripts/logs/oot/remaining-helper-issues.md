# Remaining Helper Issues for Ocarina of Time

This file tracks helper function issues that still need to be fixed.

## Issues

### 1. Time-related helpers need proper implementation

**Issue**: Helpers like `at_dampe_time`, `at_night`, `at_day` are currently stubbed to always return `true`.

**Evidence**: In `ootLogic.js` lines 119-122:
```javascript
at_night: () => true, // TODO: Implement time of day logic
at_day: () => true,
at_dampe: () => true,
at_dampe_time: () => true,
```

**Impact**: Locations that should only be accessible at certain times of day are always accessible. This may cause incorrect logic evaluation.

**Fix needed**: Implement proper time-of-day logic based on settings or state flags. In the spoiler test context, time of day should probably be ignored (always accessible), but in actual gameplay it may need to be tracked.

**Location**: `frontend/modules/shared/gameLogic/oot/ootLogic.js` - `createEvaluationContext`

---

### 2. Some complex helpers still need full implementation

**Issue**: Some helpers are implemented in simplified form and may need full logic.

**Helpers needing improvement**:
- `can_build_rainbow_bridge`: Currently only checks for 'open' bridge, doesn't validate medallion/stone/token requirements
- `can_trigger_lacs`: Simplified - doesn't check actual LACS condition requirements
- `can_finish_GerudoFortress`: Simplified logic
- Various `logic_*` tricks: All default to false, may need proper implementation based on settings

**Impact**: These locations may not be properly accessible even when they should be.

**Fix needed**: Implement full logic for these helpers based on the OOT world's LogicHelpers.json definitions.

**Location**: `frontend/modules/shared/gameLogic/oot/ootLogic.js` - `createEvaluationContext`

---

### 3. Additional missing helpers may exist

**Issue**: There may be additional helpers used by OOT that haven't been discovered yet.

**Note**: As we run more tests, we may discover additional missing helpers that need to be implemented.

**Fix needed**: Monitor test output for "Unknown helper" warnings and implement as needed.

**Location**: `frontend/modules/shared/gameLogic/oot/ootLogic.js` - `createEvaluationContext`
