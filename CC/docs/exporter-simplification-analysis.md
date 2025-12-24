# Exporter Simplification Analysis

This document summarizes the exporter simplification work, tests performed, and analysis of what cannot be simplified further.

## Summary of Changes Made

### 1. New Class Attributes in base.py

| Attribute | Purpose | Benefit |
|-----------|---------|---------|
| `EXPORTED_OPTIONS` | List of option names to extract from `world.options.<name>.value` | Eliminates boilerplate `get_settings_data` methods |
| `AUTO_PRESERVE_LARGE_HELPERS` | Default changed from `True` to `False` | 17/20 exporters had this set to False; now it's the default |

### 2. Files Removed

| File | Reason |
|------|--------|
| `musedash.py` | Empty exporter (just `pass`) - falls back to GenericGameExportHandler |

### 3. Redundant Methods Removed

| File | Method | Reason |
|------|--------|--------|
| `celeste64.py` | `get_settings_data` | Just called `super().get_settings_data()` |
| `soe.py` | `get_settings_data` | Just called `super().get_settings_data()` |
| `wargroove.py` | `expand_helper` | Just called `super().expand_helper()` |
| `sc2.py` | `expand_helper` | Just called `super().expand_helper()` |
| `cvcotm.py` | `__init__` | Empty - just `super().__init__()` |
| `osrs.py` | `__init__` | Empty - just `super().__init__()` |

### 4. Redundant Comments Removed

Removed `# AUTO_EXPORT_DISCOVERED_HELPERS default is fine` comments from 21 exporter files. These comments were documenting a default value that no longer needed explicit mention.

### 5. New Helper: weighted_sum

Added `weighted_sum` helper to Overcooked2 exporter, reducing rules.json size by 92% (6.3MB → 523KB). This compactly represents additive requirements that previously expanded into large OR combinations.

## Tests Performed

All changes were validated using the standard test pipeline:

```bash
python scripts/test/test-all-templates.py --include-list "GameName.yaml"
```

This runs:
1. `Generate.py` - Creates the rules.json and sphere_log.jsonl
2. `npm test --mode=test-spoilers` - Validates the exported rules work correctly

### Games Tested

| Game | Generation | Spoiler Test | Notes |
|------|------------|--------------|-------|
| Castlevania - Circle of the Moon | PASS | PASS | After removing empty `__init__` |
| Old School Runescape | PASS | PASS | After removing empty `__init__` |
| Blasphemous | PASS | PASS | After using EXPORTED_OPTIONS |
| Paint | PASS | PASS | After using EXPORTED_OPTIONS |
| Overcooked! 2 | PASS | PASS | After weighted_sum helper |
| Muse Dash | PASS | PASS | After removing empty exporter |

## Why Further Simplification Is Not Possible

### 1. Remaining `__init__` Methods Are Non-Trivial

Each remaining `__init__` method performs actual initialization:

| File | Initialization Purpose |
|------|----------------------|
| `soe.py` | Imports pyevermizer, builds progress maps, gets location mapping |
| `civ_6.py` | Initializes `_era_requirements` storage dict |
| `landstalker.py` | Sets up flag pattern matching and mappings |
| `witness.py` | Initializes panel requirement caching |
| `oot.py` | Sets up entrance randomization state |
| `kdl3.py` | Initializes heart star tracking |
| `overcooked2.py` | Initializes level/dlc mappings |
| `raft.py` | Sets up island group mappings |
| `terraria.py` | Initializes condition tracking |
| `smz3.py` | Sets up combined world state |
| `stardew_valley.py` | Initializes bundle and season data |

### 2. Custom Methods Serve Specific Purposes

Each exporter's custom methods handle game-specific logic that cannot be generalized:

- **Rule expansion**: Games like OSRS, Witness, and Landstalker have unique rule patterns
- **Helper definitions**: Games compute helpers based on world-specific data structures
- **Settings extraction**: Complex settings require custom logic (e.g., Stardew's bundles)
- **Item/location processing**: Games have unique classification or naming schemes

### 3. Class Attributes Already Optimized

Most boolean class attributes are already using optimal defaults:
- `USE_RESOLVED_ITEMS` - Set per-game based on whether sphere log has resolved_items
- `ADD_SPHERE_ITEMS_UPFRONT` - Set per-game based on logic requirements
- `AUTO_EXPORT_DISCOVERED_HELPERS` - Default True works for most games

### 4. Inheritance Hierarchy Is Appropriate

```
BaseGameExportHandler          # Core export logic
    └── GenericGameExportHandler   # Lambda rule analysis
            └── [Game-specific handlers]  # Game-specific overrides
```

Moving more logic to base classes would break game-specific behavior.

## Areas Worth Further Investigation

### 1. COMPUTED_SETTINGS Pattern Adoption

The `COMPUTED_SETTINGS` class attribute (dict mapping setting names to lambdas) is underutilized. Many exporters have simple `get_settings_data` methods that could use this pattern:

```python
# Current pattern in many exporters:
def get_settings_data(self, world, multiworld, player):
    settings = super().get_settings_data(world, multiworld, player)
    settings['some_value'] = world.some_attribute
    return settings

# Could become:
COMPUTED_SETTINGS = {
    'some_value': lambda world: world.some_attribute
}
```

**Candidates to investigate:**
- `celeste64.py` - Could use COMPUTED_SETTINGS for simple extractions
- `lingo.py` - Has straightforward option extractions
- `zillion.py` - Simple settings logic

### 2. Helper Size Analysis for Other Games

The `weighted_sum` optimization for Overcooked2 was highly effective. Other games with large rules.json files might benefit from similar compact representations:

| Game | rules.json Size | Potential Optimization |
|------|-----------------|----------------------|
| Hollow Knight | 4.3 MB | Analyze rule patterns |
| Stardew Valley | 3.1 MB | Bundle requirement compression |

### 3. Common expand_rule Patterns

Several games have similar `expand_rule` implementations for handling method calls. A base class utility could reduce duplication:

```python
# Pattern seen in multiple games:
if rule_type == 'function_call':
    function = rule.get('function', {})
    if function.get('type') == 'attribute':
        # Handle self.method_name() or world.method_name()
```

### 4. Automatic Helper Discovery Improvements

Some games still manually define helpers that could be auto-discovered. The `AUTO_EXPORT_DISCOVERED_HELPERS` system could be extended to handle more cases.

### 5. EXPORTED_OPTIONS Edge Cases

The current `EXPORTED_OPTIONS` implementation only handles simple `.value` extractions. Some games need:
- Enum name extraction (`.current_key`)
- Nested option values
- Computed transformations

A more flexible pattern might be:

```python
EXPORTED_OPTIONS = {
    'simple_option': 'value',           # Uses .value
    'enum_option': 'current_key',       # Uses .current_key
    'custom': lambda opt: opt.value * 2  # Custom transform
}
```

### 6. Dead Code Detection

Some exporters may have methods that are never called due to inheritance. A systematic analysis could identify:
- Methods that shadow base class methods but are never reached
- Helper definitions that are never used in rules
- Settings that are exported but never read by frontend

## Recommendations

1. **Short-term**: Convert remaining simple `get_settings_data` methods to use `EXPORTED_OPTIONS` or `COMPUTED_SETTINGS`

2. **Medium-term**: Analyze Hollow Knight and Stardew Valley for size reduction opportunities similar to weighted_sum

3. **Long-term**: Consider a decorator-based approach for common patterns:
   ```python
   @exports_option('difficulty')
   @exports_setting('custom_value', lambda w: w.compute_value())
   class MyGameExportHandler(GenericGameExportHandler):
       pass
   ```

## File Reference

| Purpose | Path |
|---------|------|
| Base exporter | `exporter/games/base.py` |
| Generic exporter | `exporter/games/generic.py` |
| Game exporters | `exporter/games/*.py` |
| Test script | `scripts/test/test-all-templates.py` |
| Exclude list | `scripts/data/template-exclude-list.json` |
