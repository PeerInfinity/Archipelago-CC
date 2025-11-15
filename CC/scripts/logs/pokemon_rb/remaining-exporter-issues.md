# Pokemon Red/Blue - Remaining Exporter Issues

## Test Run Information
- **Date**: 2025-11-15
- **Seed**: 1
- **Test Result**: FAILED at Sphere 6.18

## Current Status
The spoiler test fails at sphere 6.18 with regions not being accessible when they should be.

## Issues Found

### Issue 1: Cerulean Cave Regions Not Accessible
**Severity**: High
**Sphere**: 6.18
**Type**: Region accessibility issue

**Description**:
The following Cerulean Cave regions are accessible in the Python LOG but NOT accessible in the JavaScript STATE:
- Cerulean Cave 1F-N
- Cerulean Cave 1F-NE
- Cerulean Cave 1F-NW
- Cerulean Cave 1F-SE
- Cerulean Cave 1F-SW
- Cerulean Cave 1F-Water
- Cerulean Cave 1F-Wild
- Cerulean Cave 2F-E
- Cerulean Cave 2F-N
- Cerulean Cave 2F-W
- Cerulean Cave 2F-Wild
- Cerulean Cave B1F
- Cerulean Cave B1F-E
- Cerulean City-Cave
- Route 23/Cerulean Cave Fishing

**Access Rules**:
- Cerulean City-Cave requires: `has_badges(4)` AND `has_key_items(12)`

**Locations affected** (44 locations):
- Cerulean Cave 1F - Northeast Item
- Cerulean Cave 1F - Northwest Item
- Cerulean Cave 1F - Southwest Item
- Cerulean Cave 1F - Wild Pokemon - 1 through 10
- Cerulean Cave 2F - East Item
- Cerulean Cave 2F - North Item
- Cerulean Cave 2F - Southwest Item
- Cerulean Cave 2F - Wild Pokemon - 1 through 10
- Cerulean Cave B1F - Center Item
- Cerulean Cave B1F - Legendary Pokemon
- Cerulean Cave B1F - North Item
- Cerulean Cave B1F - Wild Pokemon - 1 through 10
- Cinnabar Lab Trade Room - Doris Trade
- Route 18 Gate 2F - Marc Trade
- Route 23/Cerulean Cave Fishing - Super Rod Pokemon - 1 through 4

**Next Steps**:
1. Check if there are any JavaScript errors during rule evaluation
2. Verify that the helper functions `has_badges` and `has_key_items` are working correctly
3. Check if the access rule is being evaluated properly
4. Look for "Access rule evaluation failed" errors in the browser console

### Issue 2: Access Rule Evaluation Failures
**Severity**: High
**Sphere**: 6.18
**Type**: Runtime error

**Description**:
Multiple "Access rule evaluation failed" errors were logged during the test run for:
- Cinnabar Lab Trade Room - Doris Trade
- Route 18 Gate 2F - Marc Trade

**Next Steps**:
1. Extract the exact JavaScript error from the browser console
2. Identify which rule type or helper is failing
3. Fix the evaluation logic or helper function

## Investigation Needed

Need to:
1. Extract the actual JavaScript error from the browser console logs
2. Check if helpers are being called correctly
3. Verify rule evaluation logic
4. Test individual helper functions
