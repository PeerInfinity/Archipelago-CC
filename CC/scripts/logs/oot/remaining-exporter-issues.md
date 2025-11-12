# Remaining Exporter Issues for Ocarina of Time

This file tracks exporter issues that still need to be fixed.

## Test Results Summary

**Test Status**: FAILED at Sphere 0 (after rule/old_rule fix)
**Date**: 2025-11-12 (updated after fixes)

The spoiler test still fails at sphere 0 after fixing the rule/old_rule issue. Thousands of locations are showing as accessible when only ~200 should be accessible. The issue appears to be more fundamental than just the rule/old_rule helpers.

## Issue 1: Too Many Accessible Locations

**Severity**: CRITICAL
**Status**: INVESTIGATING

### Description
In sphere 0, the JavaScript state manager reports thousands of locations as accessible when only ~200 should be accessible according to the Python sphere log.

**Expected in Sphere 0**: ~200 locations (according to spheres_log.jsonl)
**Expected Regions**: 73 regions
**Actual in Sphere 0**: 1000+ locations accessible

### Current Analysis
After fixing the rule/old_rule helpers:
- Most OOT locations have `null` access rules (accessible when region is reachable)
- Many locations rely on region connectivity for access control
- The issue may be with:
  1. Region entrance/exit rules not being properly enforced
  2. Some fundamental difference in how OOT handles region access
  3. Missing or improperly exported region connectivity rules

### Next Steps to Investigate
1. Check if entrance/exit access rules are properly exported
2. Compare region accessibility between Python and JavaScript
3. Look for patterns in which specific regions/locations are incorrectly accessible
4. Check if there are special OOT-specific region connection mechanisms not being exported
