# Solved Exporter Issues - Kingdom Hearts

This document tracks exporter issues that have been successfully resolved for Kingdom Hearts (kh1).

## Solved Issues

### 1. Items capped at max_count: 1 preventing proper item accumulation

**Date Solved:** 2025-12-09

**Problem:** The KH1 exporter was hardcoding `max_count: 1` for all items. This prevented items that appear multiple times in the pool (like World items such as "Olympus Coliseum") from accumulating correctly. When rules checked for `state.has("Olympus Coliseum", player, 2)`, the frontend could never satisfy this because the inventory was capped at 1.

**Root Cause:** In `exporter/games/kh1.py`, the `get_item_data()` method had hardcoded `'max_count': 1` for all items, regardless of how many copies existed in the item pool.

**Solution:** Modified the `get_item_data()` method to:
1. Calculate item counts from the pool (itempool + locations + precollected items)
2. Use those counts as the `max_count` for each item instead of hardcoding 1

**Code Changes:**
- Modified `exporter/games/kh1.py`: Added item counting logic before building item data, and used the count as `max_count` instead of hardcoding 1.

**Verification:** After the fix, the spoiler test passed all spheres successfully.
