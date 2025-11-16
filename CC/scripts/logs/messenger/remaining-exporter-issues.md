# The Messenger - Remaining Exporter Issues

This file tracks outstanding issues with the exporter (exporter/games/messenger.py).

## Issues

### Issue 1: Cloud Ruins - Pillar Glide Shop not accessible at Sphere 3.1

**Status**: Investigating

**Test failure**: Spoiler test fails at sphere 3.1 (step 40)
- Error: `Regions accessible in LOG but NOT in STATE: Cloud Ruins - Pillar Glide Shop`

**Context**:
- Python (LOG) thinks "Cloud Ruins - Pillar Glide Shop" is accessible at sphere 3.1
- JavaScript (STATE) does not think it's accessible at sphere 3.1

**Analysis**:
At sphere 3.1, player collects "Ruxxtin's Amulet" from "Barmath'azel Figurine". According to Python sphere log, this unlocks:
- Glacial Peak - Top
- Cloud Ruins - Left
- Cloud Ruins - Cloud Entrance Shop
- Cloud Ruins - Spike Float Checkpoint
- Cloud Ruins - Pillar Glide Shop

**Access paths to Pillar Glide Shop**:
1. From "Cloud Ruins - Spike Float Checkpoint": Requires `Vertical OR ((Path of Resilience OR Meditation) AND Second Wind)`
2. From "Cloud Ruins - Crushers' Descent Shop": Constant true (but this region not accessible until sphere 3.5)
3. From "Cloud Ruins - Ghost Pit Checkpoint": Constant true (but only accessible FROM Pillar Glide Shop, circular dependency)

**Items at sphere 3.1**:
- Player HAS: Wingsuit, Path of Resilience, Ruxxtin's Amulet
- Player DOES NOT HAVE: Vertical, Second Wind, Meditation

**Problem**:
The path from "Spike Float Checkpoint" to "Pillar Glide Shop" requires `Vertical OR can_dboost`.
- `can_dboost` = `(Path of Resilience OR Meditation) AND Second Wind`
- Player has Path of Resilience but NOT Second Wind
- Player doesn't have Vertical
- Therefore, the condition should be FALSE

**Possible causes**:
1. Missing exit/connection not being exported
2. Python generation bug (Python might be wrong about accessibility)
3. Special region connection mechanism not being exported
4. JavaScript rule evaluation bug

**Root cause identified**:
The `has_vertical` helper function in Python returns `self.has_wingsuit(state) or self.has_dart(state)`.
However, the generic exporter was treating it as an item check for an item named "Vertical" instead of expanding it to the actual logic.

**Fix implemented**:
Added special handling in `exporter/games/messenger.py` to detect and expand `has_vertical` helper:
```python
if rule.get('type') == 'item_check' and rule.get('inferred') and rule.get('item') == 'Vertical':
    return {
        'type': 'or',
        'conditions': [
            {'type': 'item_check', 'item': 'Wingsuit'},
            {'type': 'item_check', 'item': 'Dart'}
        ]
    }
```

**Status**: Fix applied, ready to test
