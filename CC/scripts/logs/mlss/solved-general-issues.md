# MLSS Solved General Issues

This document tracks solved general issues for Mario & Luigi Superstar Saga.

## Solved Issues

### Issue 1: PostJokes region not becoming reachable at Sphere 6.5 (SOLVED)

**Error:** Test fails at Sphere 6.5 with "Region PostJokes is not reachable"
**Sphere:** 6.5 - Player receives "Peach's Extra Dress"

**Root Cause:**
The `getSetting()` function in `statePersistence.js` was not checking the nested `options` property for settings. The MLSS settings are structured as:
```json
{
  "1": {
    "options": {
      "goal": 0,
      ...
    }
  }
}
```

When the `postJokes` helper called `getSetting("goal")`, it returned `undefined` instead of `0` because the function only checked the top level of settings, not the nested `options` object.

With `goal === undefined`, the condition `if (goal === 0 || goal === 'vanilla')` was false, causing the helper to return results for the non-vanilla branch which had different item requirements.

**Solution:**
Added check for `options` nested property in `statePersistence.js`:
```javascript
let rawValue = settingsToUse[settingName];
// If not found at top level, check inside 'options' object
if (rawValue === undefined && settingsToUse?.options) {
  rawValue = settingsToUse.options[settingName];
}
```

This matches the existing behavior in `stateInterface.js` which already had this check.

**Status:** SOLVED - All 39 spheres now pass!
