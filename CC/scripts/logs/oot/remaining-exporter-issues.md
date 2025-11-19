# Remaining Exporter Issues for Ocarina of Time

## Summary
This document tracks exporter-related issues for Ocarina of Time (OOT).

## Status
- **Current Test Status**: FAILING at Sphere 0
- **Test Date**: 2025-11-19
- **Seed**: 1 (AP_14089154938208861744)

## CRITICAL Issue: Rules not being exported with OOT DSL strings

**Symptom**: All locations are accessible at sphere 0. The rules.json file contains NO `parse_oot_rule` helper calls.

**Root Cause**: The exporter's `override_rule_analysis()` method is building a `rule_string_map` from:
1. LogicHelpers.json
2. World JSON files
3. rule_string attributes on locations/exits

However, the actual rule export is not using these strings. Instead, it's falling back to analyzing the lambda functions directly, which results in unanalyzable "rule" and "old_rule" closure variables.

**Evidence**:
- grep for "parse_oot_rule" in rules.json: NO MATCHES
- grep for "rule" helpers: 134 matches, all are "rule" or "old_rule" closure variables
- These closure helpers are then expanded to `constant: True` by `expand_rule()`, making everything accessible

**What Needs to be Done**:
1. Debug why `override_rule_analysis()` is not being called or not returning the parsed DSL
2. Ensure that when rule_string is found in the map, it's being used instead of analyzing the lambda
3. Fix the parse_oot_rule_string() method to actually return proper rule structures

**Files Affected**:
- `exporter/games/oot.py` - override_rule_analysis() method needs debugging
