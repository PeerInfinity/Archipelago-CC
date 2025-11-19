# Solved Exporter Issues - Lingo

This document tracks resolved issues with the Lingo game exporter (`exporter/games/lingo.py`).

## Solved Issues

### Issue 1: postprocess_entrance_rule not receiving connected_region for exits ✅

**Fixed in:** `exporter/exporter.py:1096-1107`

**Problem:**
When `postprocess_entrance_rule` was called for exits (as opposed to entrances), it didn't pass the `connected_region` parameter. This caused the Lingo exporter to incorrectly process simple entrance names like "Sun Painting".

**Solution:**
Updated `exporter/exporter.py` to check if the game handler's `postprocess_entrance_rule` method accepts a `connected_region` parameter using introspection. If it does, pass the connected_region for exits just like for entrances.

**Result:**
- Sun Painting now correctly uses `lingo_can_use_entrance` helper instead of `constant: true`
- Pilgrim Antechamber is no longer incorrectly accessible in Sphere 0
