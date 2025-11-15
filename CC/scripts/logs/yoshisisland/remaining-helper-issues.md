# Remaining Helper Issues

## Issue 1: Level-specific helper functions not implemented in JavaScript

**Status:** Identified
**Priority:** HIGH
**Affected helpers:** 39 level-specific helpers (pattern: `_[0-9]{2}[A-Z][a-z]+`)

**Description:**
Yoshi's Island uses 50 level-specific helper functions in the Python code with names like `_14Clear`, `_17Game`, `_27Game`, `_47Game`, etc. These helpers are used to check level-specific access requirements. Currently, 39 of these are used in the generated rules.json but are not implemented in the JavaScript helper file.

**Helper naming pattern:**
- `_[world][level][type]` where:
  - `[world]` = world number (1-6)
  - `[level]` = level number (1-8)
  - `[type]` = Clear, Game, Boss, CanFightBoss, Route, CollectibleRoute

**Examples:**
- `_17Game`: World 1, Level 7, Bonus Game access
- `_47Game`: World 4, Level 7, Bonus Game access
- `_14Clear`: World 1, Level 4, Level Clear access
- `_14Boss`: World 1, Level 4, Boss fight access

**Helpers used in rules.json (39 total):**
```
_14Boss, _14CanFightBoss, _14Clear, _17Game, _18Boss, _18CanFightBoss,
_18Clear, _24Boss, _24CanFightBoss, _24Clear, _26Game, _27Game, _28Boss,
_28CanFightBoss, _28Clear, _34Boss, _34CanFightBoss, _34Clear, _38Boss,
_38CanFightBoss, _38Clear, _44Boss, _44CanFightBoss, _44Clear, _47Game,
_48Boss, _48CanFightBoss, _48Clear, _54Boss, _54CanFightBoss, _54Clear,
_58Boss, _58CanFightBoss, _58Clear, _64Boss, _64CanFightBoss, _64Clear,
_68Clear, _68CollectibleRoute, _68Route
```

**Current test failure:**
The spoiler test fails at sphere 4.3 with errors like:
- `Helper function "_47Game" NOT FOUND in snapshotInterface`
- `Helper function "_17Game" NOT FOUND in snapshotInterface`
- `Helper function "_14Clear" NOT FOUND in snapshotInterface`

**Solution approach:**
1. Extract all 50 level-specific helper implementations from `worlds/yoshisisland/level_logic.py`
2. Translate each to JavaScript in `frontend/modules/shared/gameLogic/yoshisisland/yoshisislandLogic.js`
3. Export all helpers in the helperFunctions object
4. Most helpers are simple item checks with logic difficulty variants

**Files to modify:**
- `frontend/modules/shared/gameLogic/yoshisisland/yoshisislandLogic.js` (add 39+ helper functions)

**Python source:**
- `worlds/yoshisisland/level_logic.py` (lines with `def _[0-9]{2}[A-Z]`)

