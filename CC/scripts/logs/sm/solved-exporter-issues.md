# Super Metroid - Solved Exporter Issues

This document tracks resolved issues with the Super Metroid exporter (`exporter/games/sm.py`).

## Solved Issues

### 1. Lambda parameter 'sm' not recognized as rule lambda (FIXED)

**Date:** 2025-12-13

**Problem:**
Super Metroid rules use lambda functions with `sm` as the parameter name:
```python
lambda sm: sm.wor(sm.canEnterAndLeaveGauntlet(), ...)
```

The analyzer (`exporter/analyzer/ast_visitors.py`) checks for "rule lambdas" vs "data lambdas" by looking at the first parameter name. It only recognized `state` and `self` as rule lambda parameters, not `sm`.

This caused lambdas to be exported with their full structure:
```json
{
  "type": "lambda",
  "params": ["sm"],
  "body": {...}
}
```

When the JavaScript rule engine encountered a lambda object, it couldn't evaluate it properly. The `evalSMBool` helper would receive the lambda object instead of the evaluated result, and would return `true` because `Boolean({type: 'lambda', ...})` is truthy.

**Symptoms:**
- 46 locations marked as accessible at Sphere 0 when only 2 should be
- Many regions incorrectly marked as reachable
- Test failed at Sphere 0 with STATE vs LOG mismatch

**Solution:**
Added 'sm' to the list of recognized rule lambda parameter names in `exporter/analyzer/ast_visitors.py`:

```python
is_rule_lambda = (
    not param_names or  # No params - simple rule
    (param_names and param_names[0] in ('state', 'self', 'sm'))  # First param is state/self/sm (SM uses sm)
)
```

**Result:**
- Lambdas with `sm` parameter are now unwrapped to just their body
- The body contains proper helper calls that can be evaluated
- All 52 spheres now pass the spoiler test
