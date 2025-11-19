# Remaining General Issues for Stardew Valley

This document tracks general issues that need to be fixed.

## Issue 1: Access rule evaluation failures in initial sphere

**Status:** Investigating
**Priority:** Critical

### Problem
The spoiler test is failing in Sphere 0 (initial state) with the following errors:

1. **Missing regions from state:**
   - Egg Festival
   - Flower Dance
   - Spring Farming

2. **Missing locations from state:**
   - Dance with someone (in Flower Dance)
   - Egg Hunt Victory (in Egg Festival)
   - Granny's Gift
   - Level 1 Foraging
   - Pot Of Gold
   - Robin's Lost Axe

3. **Error messages:**
   - "Access rule evaluation failed" (multiple occurrences)
   - Regions are marked as "not reachable" even though requirements are met

### Analysis
- The "Spring" item is correctly present in starting_items
- Access rules for seasonal regions correctly check for "Spring" item
- Rules are properly exported with `{"type": "item_check", "item": "Spring"}`
- Starting inventory should include Spring with count 1

### Root Cause
The issue appears to be in the rule evaluation logic in the frontend. The rule engine is failing to properly evaluate item_check rules, possibly because:
1. Starting items are not being added to inventory correctly
2. Rule engine has a bug in item_check evaluation
3. There's an initialization order issue

### Next Steps
1. Check if starting items are being added to the inventory during initialization
2. Verify that item_check rules are being evaluated correctly by the rule engine
3. Add debug logging to trace rule evaluation
