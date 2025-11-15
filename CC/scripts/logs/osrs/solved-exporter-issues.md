# Solved Exporter Issues for OSRS

This file tracks solved issues with the OSRS exporter (exporter/games/osrs.py).

Last updated: 2025-11-15

## Solved Issues

### Issue 1: world.quest_points() not converted to helper function ✅

**Status**: SOLVED
**Priority**: High
**Sphere**: 6.3 (Crandor region access)
**Fixed**: 2025-11-15

**Description**:
The exporter was only converting `self.quest_points()` calls to helper functions, but the OSRS code also uses `world.quest_points(state)` in lambda expressions (e.g., for accessing Crandor region).

**Impact**:
- Crandor region was not reachable at sphere 6.3
- "Quest: Dragon Slayer" location was inaccessible
- Test failed at step 54 with region reachability error

**Root cause**:
The `OSRSGameExportHandler.expand_rule()` method only checked for `obj.get('name') == 'self'` but not for `'world'`.

**Fix applied**:
Updated `exporter/games/osrs.py` line 47 to check for both `'self'` and `'world'`:
```python
if obj.get('type') == 'name' and obj.get('name') in ['self', 'world']:
```

**Result**:
All spoiler tests now pass. Test progresses through all 63 events successfully.
