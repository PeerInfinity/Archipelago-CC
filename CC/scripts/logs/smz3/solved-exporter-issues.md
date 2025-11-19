# SMZ3 - Solved Exporter Issues

This file tracks resolved issues with the SMZ3 exporter (`exporter/games/smz3.py`).

## Solved Issues

### Issue #1: Missing Card Item Definitions - SOLVED

**Fix**: Added `get_item_data()` override in SMZ3GameExportHandler to mark all Card items as advancement items.

**Implementation**:
```python
def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
    """Override to fix Card item classifications."""
    item_data = super().get_item_data(world)

    card_items = [
        'CardCrateriaL1', 'CardCrateriaL2', 'CardCrateriaBoss',
        'CardBrinstarL1', 'CardBrinstarL2', 'CardBrinstarBoss',
        'CardNorfairL1', 'CardNorfairL2', 'CardNorfairBoss',
        'CardMaridiaL1', 'CardMaridiaL2', 'CardMaridiaBoss',
        'CardWreckedShipL1', 'CardWreckedShipBoss',
        'CardLowerNorfairL1', 'CardLowerNorfairBoss'
    ]

    for card_name in card_items:
        if card_name in item_data:
            item_data[card_name]['advancement'] = True

    return item_data
```

**Result**: Card items are now properly marked as advancement items in the generated rules.json, which should prevent StateManager warnings and allow locations that require these cards to be properly evaluated.
