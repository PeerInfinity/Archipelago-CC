# Remaining General Issues

## Issue #1: Region entrance rules not evaluating correctly

**Current Status:**
After fixing the star location access rules, the test progresses to sphere 0.1 but fails because region "5-1" is not reachable when it should be.

**Error message:**
```
Region 5-1 is not reachable
REGION MISMATCH found for: sphere 0.1
Regions accessible in LOG but NOT in STATE: 5-1
```

**Details:**
- Region "5-1" has an entrance rule: `has_enough_stars(1)`
- After collecting "1-1 (1-Star)", the player should have 1 Star
- This should make region "5-1" accessible, but it's not

**Investigation needed:**
This appears to be a frontend rule engine issue, not an exporter issue. Need to debug why entrance rules with helpers aren't being evaluated properly. The has_enough_stars helper is implemented in the JavaScript, but may not be called correctly by the rule engine for entrance rules.

