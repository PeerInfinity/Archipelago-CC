# Stardew Valley - Solved Exporter Issues

## Issue 1: Count Rule Multiplicity Not Preserved ✅ FIXED

### Problem
The Python `Count` rule uses a `Counter` to deduplicate identical rules while tracking their multiplicity. For example, when multiple museum artifacts have the same difficulty (and thus the same time requirement), they create identical `HasProgressionPercent` rules that get combined:

```python
Count(3, [rule_8%, rule_12%, rule_12%, rule_12%, ...])
# Becomes internally:
Counter({rule_8%: 1, rule_12%: 3, ...})
```

The exporter was only iterating over `rule_obj.rules` (the unique rules) without checking `rule_obj.counter` (the multiplicity), causing duplicate conditions to be lost in the exported JSON.

### Impact
- Sphere 2.1: Museumsanity locations became inaccessible in JavaScript
- JavaScript saw `count_true(3, [8%, 12%])` → only 2 TRUE conditions → FALSE
- Python saw `Count(3, [8%, 12%, 12%, 12%])` → 4 TRUE conditions → TRUE

### Solution
Modified `exporter/games/stardew_valley.py` lines 312-358 to check for `rule_obj.counter` and expand duplicate rules:

```python
if hasattr(rule_obj, 'counter') and hasattr(rule_obj, 'rules'):
    for sub_rule in rule_obj.rules:
        serialized = self._serialize_stardew_rule(sub_rule)
        if serialized:
            multiplicity = rule_obj.counter.get(sub_rule, 1)
            for _ in range(multiplicity):
                conditions.append(serialized)
```

### Verification
After fix:
- Regenerated rules with fixed exporter
- Test now passes sphere 2.1 (previously failing)
- Test progresses to sphere 8.2 before encountering next issue

Files modified:
- `exporter/games/stardew_valley.py` - Added Counter-aware expansion for Count rules
