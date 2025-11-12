# Remaining Exporter Issues for Ocarina of Time

This file tracks exporter issues that still need to be fixed.

## Test Results Summary

**Test Status**: FAILED at Sphere 0
**Date**: 2025-11-12

The spoiler test fails immediately at sphere 0, with thousands of locations showing as accessible when only ~200 should be accessible.

## Issue 1: Undefined Helpers - "rule" and "old_rule"

**Severity**: CRITICAL
**Locations Affected**: Many locations have access rules that reference these helpers

### Description
Many locations have access rules that contain helpers named "rule" and "old_rule". These are closure variables from the `exclusion_rules()` function in `worlds/generic/Rules.py`.

### Example
```json
{
  "type": "and",
  "conditions": [
    {
      "type": "helper",
      "name": "rule",
      "args": []
    },
    {
      "type": "helper",
      "name": "old_rule",
      "args": []
    }
  ]
}
```

### Root Cause
The analyzer is detecting these closure variables but not resolving them to their actual values during export.

### Solution Needed
The exporter needs to:
1. Detect when helpers are actually closure variables from `exclusion_rules()`
2. Resolve the captured values and inline them into the rules
3. Or mark these as special cases that need different handling

## Issue 2: Too Many Accessible Locations

**Severity**: CRITICAL

### Description
In sphere 0, the JavaScript state manager reports thousands of locations as accessible when only ~200 should be accessible according to the Python sphere log.

**Expected in Sphere 0**: ~200 locations (according to spheres_log.jsonl)
**Actual in Sphere 0**: 1000+ locations accessible

This suggests that access rules are either:
- Not being enforced at all
- Always evaluating to true due to undefined helpers
- Being interpreted incorrectly

### Likely Cause
When the rule engine encounters unknown helpers like "rule" and "old_rule", it may be defaulting to allowing access rather than denying it.
