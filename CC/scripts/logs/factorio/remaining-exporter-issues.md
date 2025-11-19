# Factorio Exporter Issues

## Current Status
Test fails at Sphere 2.1 with 34 locations accessible in LOG but NOT in STATE

## Issues

### Issue #1: "Automated" Items Not Recognized in Access Rules (Sphere 2.1 Failure)
- **Status**: IN PROGRESS
- **Description**: 34 locations require both "Automated automation-science-pack" and "Automated logistic-science-pack" items. Test fails because these locations are not accessible in STATE even though they should be accessible according to the LOG.
- **Root Cause Analysis**:
  - These are special Factorio items created with `code=None` (event items in Python)
  - Location: "Automate automation-science-pack" → Item: "Automated automation-science-pack" (given in sphere 0.1)
  - Location: "Automate logistic-science-pack" → Item: "Automated logistic-science-pack" (given in sphere 2.1)
  - The failing locations (AP-2-*) require BOTH items via simple `and` + `item_check` rules
- **Attempts So Far**:
  1. **Modified exporter** (exporter/games/factorio.py:217-232) to mark "Automated" items as `event: False` instead of `event: True`
     - Rationale: These items need to be added to inventory normally, not skipped as virtual event items
     - Result: Items now exported as `event: False`, but test still fails
  2. **Added debug logging** to eventProcessor.js to check inventory state
     - Result: Debug logs not appearing in test output (investigating why)
- **Next Steps**:
  1. Determine why debug logs aren't showing up
  2. Verify items are actually being added to inventory
  3. Check if there's an issue with how `item_check` evaluates these items
  4. Investigate if the problem is with timing (items added after accessibility check)
- **Error**: "Access rule evaluation failed"
- **Missing locations**: AP-2-072, AP-2-179, AP-2-255, AP-2-269, AP-2-270, AP-2-272, AP-2-328, AP-2-338, AP-2-413, AP-2-416, AP-2-469, AP-2-473, AP-2-491, AP-2-502, AP-2-507, AP-2-514, AP-2-524, AP-2-569, AP-2-585, AP-2-634, AP-2-644, AP-2-650, AP-2-652, AP-2-654, AP-2-683, AP-2-688, AP-2-763, AP-2-784, AP-2-794, AP-2-861, AP-2-889, AP-2-898, AP-2-901, AP-2-996
