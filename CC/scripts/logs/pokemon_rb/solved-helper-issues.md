# Solved Helper Issues

## Issue 1: ReferenceError: window is not defined
**Location:** `frontend/modules/shared/gameLogic/pokemon_rb/pokemon_rbLogic.js:18`
**Status:** Fixed
**Description:** The `has()`, `can_learn_hm()`, and `can_surf()` helper functions attempted to access `window` object for debug logging. However, helper functions execute in a web worker context which doesn't have access to the `window` object.
**Error:** `ReferenceError: window is not defined at has`
**Fix:** Removed all window-dependent debug logging code from the helper functions.
**Commit:** Removed debug logging that used window object in pokemon_rbLogic.js

## Issue 2: TypeError: count is not a function in has_key_items
**Location:** `frontend/modules/shared/gameLogic/pokemon_rb/pokemon_rbLogic.js:264`
**Status:** Fixed
**Description:** The `has_key_items()` function had a parameter named `count` which shadowed the module-level `count()` function. When the function tried to call `count(snapshot, staticData, "Progressive Card Key")` on line 284, it attempted to call the parameter instead of the function.
**Error:** `TypeError: count is not a function at Object.has_key_items`
**Fix:** Renamed the parameter from `count` to `requiredCount`.
**Commit:** Fixed parameter shadowing in has_key_items function

