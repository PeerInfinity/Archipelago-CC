# TLOZ Solved Exporter Issues

Status: 1 issue solved

## Issue 1: F-string rules not resolved to constants ✓ SOLVED

**Problem:**
The rules.json file contained many rules with `type: "f_string"` that the frontend rule engine doesn't know how to evaluate.

**Solution:**
Created `exporter/games/tloz.py` that extends `GenericGameExportHandler` and implements `_resolve_f_string()` method to resolve f_string rules when all parts are constants.

**Implementation:**
The exporter detects f_string rules and evaluates them at export time, converting:
```json
{
  "type": "f_string",
  "parts": [
    {"type": "constant", "value": "Boss "},
    {"type": "formatted_value", "value": {"type": "constant", "value": 1}}
  ]
}
```

To:
```json
{
  "type": "constant",
  "value": "Boss 1"
}
```

**Files Modified:**
- `exporter/games/tloz.py` (created)

**Test Result:**
All f_string errors eliminated. Test now progresses to Sphere 3.5 (was failing at initial load).
