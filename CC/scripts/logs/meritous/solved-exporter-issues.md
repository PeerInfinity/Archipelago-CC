# Solved Exporter Issues

## Issue 1: group_check rules missing count parameter - SOLVED

**Symptom:** Ataraxia region accessible in sphere 1.1, but should be accessible in sphere 2.2

**Root Cause:** The exporter was not properly exporting the count parameter for group_check rules. In Regions.py:76-79, the access rule for Ataraxia requires:
- 2 items from "PSI Keys" group
- 2 items from "Important Artifacts" group

But the exported rules.json only had:
```json
{
  "type": "group_check",
  "group": {"type": "constant", "value": "PSI Keys"}
}
```

Missing the count field.

**Solution:** Fixed the has_group handler in exporter/analyzer/ast_visitors.py:468-487 to properly capture and export the count parameter (the second argument after filtering the player parameter). Now exports:
```json
{
  "type": "group_check",
  "group": {"type": "constant", "value": "PSI Keys"},
  "count": {"type": "constant", "value": 2}
}
```

**Files Modified:**
- exporter/analyzer/ast_visitors.py (lines 468-487)

**Affected Rules (now fixed):**
- To Meridian: needs PSI Keys count 1, Important Artifacts count 1
- To Ataraxia: needs PSI Keys count 2, Important Artifacts count 2
- To Merodach: needs PSI Keys count 3, Important Artifacts count 3

**Test Results:** All 15 spheres now pass correctly. Verified with:
```
npm test --mode=test-spoilers --game=meritous --seed=1
```

