# VVVVVV Solved Exporter Issues

This document tracks resolved exporter-related issues for VVVVVV.

## Solved Issues

### 1. Missing door_cost and area_cost_map in settings export
**Status:** SOLVED
**Priority:** High
**Solution Date:** 2025-11-12

**Problem:**
The VVVVVV world uses `options.door_cost` and a dynamically created `area_cost_map` dictionary in the access rules for area connections. These values were not being exported to the rules.json file, causing the JavaScript rule engine to fail when trying to evaluate the expressions.

**Solution:**
Created a VVVVVV exporter (`exporter/games/v6.py`) that exports these values to the settings section of rules.json. The exporter:
1. Exports `door_cost` value from `world.options.door_cost.value`
2. Exports `area_cost_map` dictionary from `world.area_cost_map`
3. Makes these values accessible to the rule engine during evaluation

**Files Changed:**
- `exporter/games/v6.py` (created)

**Result:**
All spoiler tests now pass. Laboratory region correctly becomes accessible in sphere 0.4 when player has the required trinkets.

**Test Results:**
- All 13 spheres passed
- No mismatches in location accessibility
- No region reachability issues
