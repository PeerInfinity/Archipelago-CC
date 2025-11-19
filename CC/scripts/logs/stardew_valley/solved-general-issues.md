# Solved General Issues for Stardew Valley

This file tracks general issues that have been fixed.

## Issue 1: Virtual event items incorrectly managed by test framework - SOLVED

**Original Symptom:** "Read Jack Be Nimble, Jack Be Thick" location not accessible at sphere 0.11

**Root Causes:**
1. Event processor was adding virtual items from `resolved_items` instead of letting hooks compute them
2. `clearEventItems()` was clearing progression tracking items between spheres

**Solutions:**
1. Modified `frontend/modules/testSpoilers/eventProcessor.js` (lines 839-846):
   - Added check to skip adding event items from `resolved_items`
   - Event items managed by hooks should not be added directly

2. Modified `frontend/modules/stateManager/core/statePersistence.js` (lines 996-1007):
   - Added `preservedItems` set to exempt hook-managed items from clearing
   - Preserved "Received Progression Item" and "Received Progression Percent"

**Verification:**
- Test now passes sphere 0.11 successfully
- Progression tracking works correctly across all spheres
- Console logs show cumulative progression item counts increasing correctly
