# Remaining Helper Issues

## Issue 1: can_reach_location evaluation failing for DDD: Pole-Jumping for Red Coins

**Location:** `DDD: Pole-Jumping for Red Coins`

**Sphere:** 2.6

**Problem:** The JavaScript frontend is failing to evaluate the access rule for this location. The rule uses `can_reach_location("Bowser in the Fire Sea Key")` helper.

**Error:** "Access rule evaluation failed"

**Status:** Investigating - the helper function exists in sm64ex/helpers.js but the evaluation is still failing.

**Access rule:**
```json
{
  "type": "helper",
  "name": "can_reach_location",
  "args": [
    {
      "type": "constant",
      "value": "Bowser in the Fire Sea Key"
    }
  ]
}
```

