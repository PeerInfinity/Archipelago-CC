# Remaining Helper Issues - Stardew Valley

This file tracks outstanding helper function issues for Stardew Valley.

## Issue 1: Virtual progression items not accumulating correctly during test playback

**Location Affected:** "Read Jack Be Nimble, Jack Be Thick" (and potentially others)
**Sphere:** 0.11
**Status:** Investigating

**Root Cause:**
The hooks in `stardewValleyLogic.js` properly track "Received Progression Item" and compute "Received Progression Percent" for real-time item additions. However, during test playback, these virtual items are being reset between spheres instead of accumulating.

**Debug Evidence:**
From console logs:
- Starting items (Spring, Pet Bowl): correctly increments to items=2, percent=0
- initializeVirtualItems: confirms items=2, percent=0
- Sphere 0.1 (Progressive Watering Can): shows items=1 instead of expected items=3
- Sphere 0.11 (Fishing Level): shows items=11 instead of expected items=13

**Expected vs Actual:**
At sphere 0.11, should have 13 progression items total (starting 2 + 11 collected), giving:
- Received Progression Percent = (13 * 100) // 322 = 4
- Location requires >= 4, so should be accessible

Actually getting only 11 items, giving:
- Received Progression Percent = (11 * 100) // 322 = 3
- Location requires >= 4, so NOT accessible (causing test failure)

**Root Cause Identified:**
The inventory is being RESET between initialization and sphere processing. Debug logs confirm:
1. During initialization: Spring (0→1), Pet Bowl (1→2) - correct cumulative behavior
2. During sphere processing: Progressive Watering Can (0→1) - RESET, should start from 2!

This indicates a state snapshot/restore mechanism is clearing the inventory after initialization but before sphere 0.1 processing begins. The virtual progression items exist in inventory but are reset to their initial values (0) when sphere processing starts.

**Next Steps:**
1. Identify where StateManager saves/restores inventory state between initialization and test execution
2. Ensure virtual progression items are properly persisted in snapshots
3. Consider alternative approach: recompute virtual items from actual inventory on each sphere instead of relying on hooks
