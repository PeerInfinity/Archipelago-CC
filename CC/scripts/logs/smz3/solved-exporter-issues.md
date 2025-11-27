# SMZ3 Solved Exporter Issues

This document tracks resolved issues in the SMZ3 exporter (`exporter/games/smz3.py`).

## Resolved Issues

### 1. Progressive Items Marked as Non-Advancement (Solved)

**Issue:** Some progressive items (like ProgressiveSword) placed at certain locations were marked as `advancement: false` by the game's ItemPool logic. This caused the frontend's spoiler test to skip adding these items to inventory, leading to incorrect accessibility calculations.

**Symptom:** Castle Tower region was reported as "accessible in LOG but NOT in STATE" at sphere 5.3. The second ProgressiveSword (which should provide MasterSword capability) was not being added to inventory because the item at "Sahasrahla's Hut - Middle" had `advancement: false`.

**Root Cause:** The SMZ3 ItemPool sometimes places multiple copies of progressive items, and marks some as filler (non-advancement). However, these items still provide progression value - e.g., ProgressiveSword at level 2 provides MasterSword which is required to enter Castle Tower.

**Solution:** Added `post_process_location_data()` method to `exporter/games/smz3.py` that marks progressive items (ProgressiveSword, ProgressiveGlove, ProgressiveShield, ProgressiveBow, ProgressiveTunic) as `advancement: true` regardless of their original placement classification.

**Files Modified:**
- `exporter/games/smz3.py` - Added `post_process_location_data()` method and updated `get_item_data()` to mark progressive items as advancement
