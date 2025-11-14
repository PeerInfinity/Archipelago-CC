# Remaining Exporter Issues for Mario & Luigi Superstar Saga

This file tracks known issues with the exporter for MLSS (`exporter/games/mlss.py`).

## Issues

### Issue 1: StateLogic module functions not recognized as helpers

**Status**: Identified
**Priority**: High (blocks all progression)
**File**: `exporter/analyzer/ast_visitors.py`

**Problem**:
The Python code in `worlds/mlss/Rules.py` calls helper functions from the StateLogic module like this:
```python
from . import StateLogic
lambda state: StateLogic.canDig(state, world.player)
```

The exporter's analyzer sees `StateLogic.canDig()` as an attribute access on a name "StateLogic" and exports it as:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {"type": "name", "name": "StateLogic"},
    "attr": "canDig"
  },
  "args": []
}
```

But in JavaScript, there is no "StateLogic" object. These should be exported as helper functions:
```json
{
  "type": "helper",
  "name": "canDig",
  "args": []
}
```

**Root Cause**:
The `visit_Call` method in `ast_visitors.py` (around line 682-771) has special handling for:
- `self.method()` calls - converted to helpers
- `logic.method()` calls - converted to helpers
- But NOT for module function calls like `StateLogic.method()`

**Solution**:
Add special handling in `visit_Call` method to recognize when func_info is an attribute access on certain module names (like "StateLogic"), and convert those to helper function calls.

The code should check if:
1. `func_info['type'] == 'attribute'`
2. `func_info['object']['type'] == 'name'`
3. `func_info['object']['name']` is a known helper module (e.g., "StateLogic")

Then convert it to a helper instead of a generic function_call.

**Helper Functions in StateLogic** (from `worlds/mlss/StateLogic.py`):
- canDig, canMini, canDash, canCrash
- hammers, super, ultra
- fruits, pieces, neon, spangle, rose, brooch
- thunder, fire, dressBeanstar, membership, winkle, beanFruit
- surfable, postJokes, teehee, castleTown, fungitown
- piranha_shop, fungitown_shop, star_shop, birdo_shop, fungitown_birdo_shop
- soul

**Test Results**:
- Sphere 0.3 fails: S.S. Chuckola locations cannot be reached
- Sphere 0.4 fails: TeeheeValley region not reachable
- Error message: `Name "StateLogic" NOT FOUND in context`
