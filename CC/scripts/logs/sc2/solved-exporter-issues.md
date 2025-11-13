# Starcraft 2 - Solved Exporter Issues

This file tracks exporter-related issues that have been resolved for Starcraft 2.

## Issue 1: Logic method calls not converted to helper calls [SOLVED]

**Status:** SOLVED
**Solved Date:** 2025-11-13
**Priority:** CRITICAL
**Solution:** Created custom exporter for SC2

**Description:**
The exporter was generating access rules that referenced `logic.method_name()` as function calls on a variable called "logic", but the JavaScript rule engine doesn't have a "logic" variable in context.

**Solution Implemented:**
Created `exporter/games/sc2.py` that converts `logic.method_name()` patterns to helper calls.

The exporter detects the pattern:
```
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {"type": "name", "name": "logic"},
    "attr": "method_name"
  },
  "args": [...]
}
```

And converts it to:
```
{
  "type": "helper",
  "name": "method_name",
  "args": [...]
}
```

## Issue 2: Logic attribute access not converted to settings access [SOLVED]

**Status:** SOLVED
**Solved Date:** 2025-11-13
**Priority:** CRITICAL
**Solution:** Extended SC2 custom exporter

**Description:**
The SC2Logic class has attributes like `take_over_ai_allies` and `advanced_tactics` that are not methods but instance attributes holding setting values. When rules referenced `logic.take_over_ai_allies`, the JavaScript engine tried to look up a variable called "logic" which doesn't exist.

**Solution Implemented:**
Extended the SC2 exporter to also convert attribute access patterns.

The exporter detects the pattern:
```
{
  "type": "attribute",
  "object": {"type": "name", "name": "logic"},
  "attr": "attribute_name"
}
```

And converts it to:
```
{
  "type": "attribute",
  "object": {"type": "name", "name": "self"},
  "attr": "attribute_name"
}
```

The rule engine already knows how to resolve `self.attribute_name` by looking it up in settings.

## Issue 3: Nested logic references not being converted [SOLVED]

**Status:** SOLVED
**Solved Date:** 2025-11-13
**Priority:** CRITICAL
**Solution:** Made exporter recursively process all rule types

**Description:**
Logic references that were nested inside function_call args or compare operations were not being converted, because the exporter only processed top-level rules.

**Solution Implemented:**
Updated the SC2 exporter's `expand_rule` method to recursively process:
- Args of function_call rules
- Left and right operands of compare rules

This ensures all nested logic references are found and converted throughout the entire rule tree.

**Verification:**
After implementing all three fixes, the generated rules.json contains 0 references to `"name": "logic"`.
