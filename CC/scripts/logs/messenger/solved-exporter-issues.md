# The Messenger - Solved Exporter Issues

This file tracks resolved issues with the exporter (exporter/games/messenger.py).

## Solved Issues

### Issue 1: has_vertical helper not expanded - FIXED ✅

**Problem**: The `has_vertical` helper function was being treated as an item check for "Vertical" instead of being expanded to its actual logic `(Wingsuit OR Dart)`.

**Impact**: Cloud Ruins - Pillar Glide Shop was incorrectly inaccessible at sphere 3.1.

**Fix**: Added special handling in `exporter/games/messenger.py` to detect and expand `has_vertical`:
```python
if rule.get('type') == 'item_check' and rule.get('inferred') and rule.get('item') == 'Vertical':
    logger.debug("Detected has_vertical helper, converting to Wingsuit OR Dart check")
    return {
        'type': 'or',
        'conditions': [
            {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Wingsuit'}},
            {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Dart'}}
        ]
    }
```

**Result**: Test now progresses past sphere 3.1 and reaches sphere 3.5 before failing.

### Issue 2: has_dart and has_tabi helpers not expanded - FIXED ✅

**Problem**: Similar to `has_vertical`, the `has_dart` and `has_tabi` helpers were being treated as item checks for "Dart" and "Tabi" instead of the actual items "Rope Dart" and "Lightfoot Tabi".

**Impact**: Many regions at sphere 3.5 were incorrectly inaccessible when player obtained Rope Dart.

**Fix**: Added special handling for both helpers in `exporter/games/messenger.py`:
```python
# has_dart: state.has("Rope Dart", player)
if rule.get('type') == 'item_check' and rule.get('inferred') and rule.get('item') == 'Dart':
    return {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Rope Dart'}}

# has_tabi: state.has("Lightfoot Tabi", player)
if rule.get('type') == 'item_check' and rule.get('inferred') and rule.get('item') == 'Tabi':
    return {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Lightfoot Tabi'}}
```

**Result**: Test now progresses past sphere 3.5 and reaches sphere 4.9 before failing.

### Issue 3: can_destroy_projectiles and is_aerobatic helpers not expanded - FIXED ✅

**Problem**: These capability and generic helper functions were not being expanded to their actual item checks.

**Impact**: "Elemental Skylands Seal - Fire" location was incorrectly inaccessible at sphere 4.9.

**Python definitions**:
```python
def can_destroy_projectiles(self, state: CollectionState) -> bool:
    return state.has("Strike of the Ninja", self.player)

def is_aerobatic(self, state: CollectionState) -> bool:
    return self.has_wingsuit(state) and state.has("Aerobatics Warrior", self.player)
```

**Fix**: Added special handling in `exporter/games/messenger.py`:
```python
# can_destroy_projectiles
if capability == 'destroy_projectiles':
    return {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Strike of the Ninja'}}

# is_aerobatic
if rule.get('type') == 'generic_helper' and rule.get('name') == 'is_aerobatic':
    return {
        'type': 'and',
        'conditions': [
            {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Wingsuit'}},
            {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Aerobatics Warrior'}}
        ]
    }
```

**Result**: ✅ **SPOILER TEST NOW PASSES COMPLETELY!** All 72 events processed successfully with 0 errors.
