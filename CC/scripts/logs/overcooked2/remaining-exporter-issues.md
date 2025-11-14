# Overcooked! 2 - Remaining Exporter Issues

## Issue 1: Location rules have unresolved variable references

**Priority:** HIGH
**Status:** Not fixed

**Description:**
Location access rules for checking star requirements use the `has_requirements_for_level_star` helper with an unresolved `level` variable:
```json
{
  "type": "helper",
  "name": "has_requirements_for_level_star",
  "args": [
    {"type": "name", "name": "level"},
    {"type": "constant", "value": 1}
  ]
}
```

The `level` variable is a complex Python object (Overcooked2GenericLevel) that cannot be serialized by the analyzer. The rule evaluator doesn't know how to resolve this variable at runtime.

**Root Cause:**
- The `override_rule_analysis` method attempts to extract the level_id from the closure, but the extraction is not working
- The analyzer leaves the `level` parameter as a variable reference of type "name"
- The rule evaluator cannot resolve this variable without additional context

**Expected Behavior:**
Location rules should either:
1. Have the level_id resolved at export time and included as a constant in the args, OR
2. Have the rule evaluator pass location context so the helper can extract the level_id from the location name

**Location:**
- Exporter: `exporter/games/overcooked2.py` (override_rule_analysis method)
- Helper: `frontend/modules/shared/gameLogic/overcooked2/helpers.js` (has_requirements_for_level_star function)
- Rules JSON: `frontend/presets/overcooked2/AP_14089154938208861744/AP_14089154938208861744_rules.json`

**Test Evidence:**
```
BROWSER LOG (error): [05:27:16.835] [ERROR] [testSpoilerUI]     ISSUE: Access rule evaluation failed
BROWSER LOG (error): [MISMATCH DETAIL] Missing from state (9): [1-1 (1-Star), 1-1 Completed, 1-1 Level Completed, ...]
```

**Fix Required:**
Either:
1. Fix the `override_rule_analysis` method to properly extract level_id from the closure and create a helper with resolved constants, OR
2. Modify the rule evaluator to pass location context to helpers so they can extract the level_id from the location being evaluated

---

## Issue 2: Chained comparison not supported

**Priority:** MEDIUM
**Status:** Not fixed

**Description:**
The generation output shows multiple instances of:
```
Unsupported chained comparison: Compare(left=Constant(value=0), ops=[LtE(), LtE()], comparators=[Name(id='stars', ctx=Load()), Constant(value=3)])
Analysis finished without errors but produced no result (None).
```

**Root Cause:**
The analyzer doesn't support Python chained comparisons like `0 <= stars <= 3`. This is from line 36 in `worlds/overcooked2/Logic.py`:
```python
assert 0 <= stars <= 3
```

**Expected Behavior:**
The analyzer should either:
1. Support chained comparisons by breaking them into multiple binary comparisons
2. Skip assertions since they're not part of the actual logic

**Location:**
- Analyzer: `exporter/analyzer.py`
- Python code: `worlds/overcooked2/Logic.py:36`

**Impact:**
Currently appears to be non-blocking since the assertion is inside `has_requirements_for_level_star` which may not be fully analyzed, but could cause issues if assertions are used in actual rule logic.

---

**Summary:**
- 2 exporter issues remaining
- 1 HIGH priority issue blocking locations from being accessible
- 1 MEDIUM priority issue that may affect other games
