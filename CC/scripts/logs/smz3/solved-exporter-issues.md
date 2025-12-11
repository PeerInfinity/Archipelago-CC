# SMZ3 Solved Exporter Issues

## Issue 1: items.MasterSword not properly converted to ProgressiveSword >= 2

**Status**: SOLVED

**Description**:
The exporter's `postprocess_rule` method was converting `items.MasterSword` to a simple `item_check` for "MasterSword", but there is no item called "MasterSword" in SMZ3. The actual item is "ProgressiveSword".

In the SMZ3 Python code (worlds/smz3/TotalSMZ3/Item.py), `items.MasterSword` is a boolean flag that is set to `True` when the player has collected **2 or more** ProgressiveSword items.

**Solution**:
Added a `progression_count_flags` mapping in the exporter's `postprocess_rule` method:
```python
progression_count_flags = {
    'MasterSword': ('ProgressiveSword', 2),
    'Mitt': ('ProgressiveGlove', 2),
    'TwoPowerBombs': ('PowerBomb', 2),
}
```

When `items.MasterSword` is encountered, it's now converted to:
```json
{
  "type": "compare",
  "left": {"type": "item_check", "item": "ProgressiveSword"},
  "op": ">=",
  "right": {"type": "constant", "value": 2}
}
```

**Location**: exporter/games/smz3.py, `postprocess_rule` method

---

## Issue 2: items.Sword not properly mapped to ProgressiveSword

**Status**: SOLVED

**Description**:
Similar to Issue 1, `items.Sword` was being converted to `item_check` for "Sword", but the actual item is "ProgressiveSword". In SMZ3, `items.Sword` is a boolean flag that is `True` when the player has **1 or more** ProgressiveSword items.

**Affected Rules**:
- Skull Woods - Mothula boss location required `Sword`
- Various other locations using `items.Sword`

**Solution**:
Added an `item_name_mappings` dictionary in the exporter's `postprocess_rule` method:
```python
item_name_mappings = {
    'Sword': 'ProgressiveSword',
    'Glove': 'ProgressiveGlove',
}
```

When `items.Sword` is encountered, it's now converted to:
```json
{
  "type": "item_check",
  "item": "ProgressiveSword"
}
```

**Location**: exporter/games/smz3.py, `postprocess_rule` method

---

## Verification

Both issues were verified fixed by running the full spoiler test:
```
npm test --mode=test-spoilers --game=smz3 --seed=1
```

Result: **1 passed (21.8s)**
