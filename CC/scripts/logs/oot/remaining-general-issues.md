# Remaining General Issues for Ocarina of Time

This file tracks general issues that still need to be fixed.

## Issues

### 1. Age not initialized in game state

**Issue**: The player's age is initialized as `null` but never set based on the starting age.

**Evidence**: In `ootLogic.js` line 17:
```javascript
age: null, // 'child' or 'adult'
```

**Impact**: Age-dependent checks like `is_child()` and `is_starting_age()` fail at the start of the game, preventing access to child-only or starting-age areas.

**Fix needed**: The age should be initialized based on the `starting_age` setting when the state is first created, or set via an event when the game starts.

**Location**: `frontend/modules/shared/gameLogic/oot/ootLogic.js` - `initializeState` or `loadSettings`

---

### 2. `here()` function needs region context

**Issue**: The `here()` function is supposed to evaluate a rule in the current region context, but it currently just recursively evaluates without region context.

**Evidence**: In `ootLogic.js` line 291-294:
```javascript
case 'here':
  // Evaluate a helper in the current region context
  // For now, just recursively evaluate the argument
  return evaluateRuleString(arg, context);
```

**Impact**: Rules like `here(can_plant_bean and (plant_beans or Progressive_Strength_Upgrade))` may not evaluate correctly without region context.

**Fix needed**: The evaluation context needs to include the current region, and `here()` should evaluate the rule in that region's context.

**Location**: `frontend/modules/shared/gameLogic/oot/ootLogic.js` - `evaluateFunctionCall`
