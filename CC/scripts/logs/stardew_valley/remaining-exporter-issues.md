# Remaining Exporter Issues

## Issue 1: Museumsanity locations with count_true rules not accessible

**Status**: Investigating
**Locations affected**:
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

**Description**:
These locations fail to be marked as accessible in sphere 2.1, even though the Python log shows they should be accessible.

**Access Rule Pattern**:
```json
{
  "type": "and",
  "conditions": [
    {
      "type": "item_check",
      "item": "Traveling Merchant Metal Detector"
    },
    {
      "type": "count_true",
      "count": 3,
      "conditions": [/* many conditions checking "Received Progression Percent" with various counts */]
    }
  ]
}
```

**State at Sphere 2.1**:
- Player has: "Traveling Merchant Metal Detector": 1 ✓
- Player has: "Received Progression Item": 39
- Player has: "Received Progression Percent": 12 (calculated as floor(39 * 100 / 322))
- Total progression items in game: 322
- Accessible regions: 72 regions (does NOT include "Dig Site" or "Railroad")

**Investigation findings**:
The count_true rule has many conditions. At 12% progression, manually checking which should be true:
- Conditions checking for 8% or less: TRUE ✓
- Conditions checking for 12% or less: TRUE ✓
- Conditions checking for >12%: FALSE
- Conditions with percentage + region requirements: Need to check region accessibility

Python evaluates this as passing (3+ conditions are true), but JavaScript evaluates it as failing.

**Possible causes**:
1. count_true implementation in ruleEngine.js has a bug (unlikely - code looks correct)
2. Nested region_check within count_true conditions returning undefined instead of true/false
3. item_check with count field not working correctly for "Received Progression Percent"
4. Virtual item "Received Progression Percent" not being tracked correctly in JavaScript StateManager
5. Short-circuit evaluation causing undefined to propagate

**Next steps**:
- Run test with browser console open to see detailed rule evaluation logs
- Add debug logging to track "Received Progression Percent" value in StateManager
- Manually trace through count_true evaluation for this specific rule
- Check if stardewValleyLogic.js hooks are being called correctly
