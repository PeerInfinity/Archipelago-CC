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
