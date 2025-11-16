# Remaining Exporter Issues for Ocarina of Time

This document tracks issues related to the OOT exporter (`exporter/games/oot.py`).

Status: Initial test run complete - multiple issues identified

## Critical Issues

### 1. Subrule locations exported with null access_rule ⚠️ HIGH PRIORITY

**Problem:** OOT creates internal "Subrule" event locations (e.g., "Kokiri Forest Subrule 1") that should have access rules, but they're being exported with `access_rule: null`. This causes them to be always accessible in the frontend.

**Evidence:**
- Test shows locations like "Kokiri Forest Subrule 1", "Lost Woods Subrule 1", etc. as accessible at Sphere 0 when they shouldn't be
- In `rules.json`, these locations have `"access_rule": null`
- In Python code (`worlds/oot/RuleParser.py:395`), these locations DO have access rules set via `set_rule(event, access_rule)`

**Root Cause:** The exporter's rule analysis is failing for these locations because:
1. The rule strings are stored on the location objects as `location.rule_string`
2. The exporter needs to use `override_rule_analysis` which looks up rules in `self.rule_string_map`
3. The `build_rule_string_map` method may not be capturing all location rules properly

**Impact:** HIGH - Causes ~33+ Subrule locations across many regions to be incorrectly accessible

**Fix Required:**
- Ensure `build_rule_string_map` captures all location rules
- Verify that `override_rule_analysis` is being called for all locations
- Check if subrule locations need special handling

**Files Involved:**
- `exporter/games/oot.py` (OOT exporter)
- `worlds/oot/RuleParser.py` (creates subrules at line 382)

## Shop Item Issues

### 2. Shop items accessible too early

**Problem:** Various shop items are showing as accessible at Sphere 0 when they shouldn't be:
- Market Bazaar Item 6 (should be accessible at Sphere 0.5 after getting Progressive Wallet)
- Market Potion Shop Items 1, 2, 4, 6, 7, 8
- Market Bombchu Shop Items 1-8

**Evidence:**
- Test error lists these as "accessible in STATE but NOT in LOG" at Sphere 0
- Sphere log shows "Market Bazaar Item 6" becomes accessible at Sphere 0.5

**Root Cause:** Unknown - need to investigate shop item access rules

**Impact:** MEDIUM - Affects ~15 shop item locations

**Fix Required:**
- Check access rules for shop items in rules.json
- Verify that shop price/wallet requirements are being enforced
