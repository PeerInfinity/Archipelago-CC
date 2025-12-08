# Mega Man 2 - Solved Exporter Issues

## Overview
This document tracks exporter issues for the Mega Man 2 (mm2) game that have been fixed.

---

## Issue 1: can_defeat_enough_rbms helper not preserved as helper call

**Status:** FIXED

**Symptom:**
- Test fails at Sphere 7.2
- Locations "Wily Machine 2 - Defeated" and "Wily Stage 5 - Completed" are inaccessible in the frontend but accessible in the sphere log
- rules.json contains broken access rules that return `false` unconditionally:
  ```json
  "access_rule": {
    "type": "block",
    "statements": [
      {"type": "assign", "name": "can_defeat", "value": {"type": "constant", "value": 0}},
      {"type": "return", "value": {"type": "constant", "value": false}}
    ]
  }
  ```

**Root Cause:**
The `can_defeat_enough_rbms` function in `worlds/mm2/rules.py` contains a for loop that iterates over `boss_requirements.items()`:
```python
for boss, reqs in boss_requirements.items():
    if boss in robot_masters:
        if state.has_all(map(lambda x: weapons_to_name[x], reqs), player):
            can_defeat += 1
            ...
```

The rule analyzer can only handle `range()` loops, not `.items()` dictionary iteration. When the analyzer encounters this unsupported pattern, it fails to analyze the function body and produces a broken rule that always returns false.

The exporter has an `_expand_common_helper` override to preserve this function as a helper call, but this was never being invoked because:
1. The analyzer first tries to recursively inline the function
2. `should_preserve_as_helper()` wasn't returning True for this function
3. The inlining attempt fails, producing the broken rule

**Solution:**
Add `can_defeat_enough_rbms` to the `HELPERS_TO_PRESERVE` set in the mm2 exporter. This tells the analyzer to skip recursive inlining and instead preserve the function as a helper call in the rules.json output.

**Files Modified:**
- `exporter/games/mm2.py`: Added `HELPERS_TO_PRESERVE = {'can_defeat_enough_rbms'}`

**Verification:**
After the fix, regenerate rules.json and verify:
1. The access rules for Wily Stage 5 locations use `{"type": "helper", "name": "can_defeat_enough_rbms", ...}` instead of the broken block
2. The spoiler test passes

---
