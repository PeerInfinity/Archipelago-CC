# Refactoring Plan: exporter/games/base.py

## Current State

The `base.py` file is 3,160 lines containing a single class `BaseGameExportHandler` with:
- ~30 class configuration attributes
- ~50 methods covering diverse functionality
- Mixed concerns that have accumulated over time

## Proposed Module Structure

Split `base.py` into focused modules under a new `exporter/games/base/` subdirectory,
keeping game-specific handlers separate:

```
exporter/games/
├── __init__.py              # Registry, re-exports BaseGameExportHandler
├── base/                    # NEW: Base infrastructure
│   ├── __init__.py          # Exports BaseGameExportHandler
│   ├── handler.py           # Core BaseGameExportHandler class
│   ├── rule_expansion.py    # Rule expansion logic (RuleExpansionMixin)
│   ├── world_data.py        # World data extraction (WorldDataMixin)
│   ├── helper_discovery.py  # Helper function discovery and analysis (HelperDiscoveryMixin)
│   ├── option_normalization.py  # Option constant normalization (OptionNormalizationMixin)
│   └── utilities.py         # Static utility methods
├── generic.py               # GenericGameExportHandler (intermediate class)
├── ahit.py                  # Game-specific handlers
├── alttp.py
├── ...                      # ~40+ game-specific handlers
└── yoshisisland.py
```

The old `base.py` will be removed after migration.

## Module Breakdown

### 1. `base/handler.py` (Core - ~400 lines)

Keep only:
- Class configuration attributes (lines 24-182)
- `__init__` method
- Basic helper registration methods:
  - `register_helper_usage`
  - `register_helpers_from_rule`
  - `get_discovered_helpers`
  - `get_discovered_helper_modules`
  - `register_auto_preserved_helper`
  - `is_auto_preserved_helper`
  - `clear_discovered_helpers`
  - `is_worldgen_world`
  - `cache_analyzed_helper`
  - `get_cached_helper`
- Hook methods (to be overridden by subclasses):
  - `expand_helper` (stub)
  - `replace_name` (stub)
  - `handle_special_function_call`
  - `should_preserve_as_helper`
  - `should_process_multistatement_if_bodies`
  - `should_recursively_analyze_closures`
  - `get_effective_item_type`
- Simple getters:
  - `get_item_data`
  - `get_item_max_counts`
  - `get_progression_mapping`
  - `get_game_info`
  - `get_required_fields`
  - `get_all_worlds`
  - `get_exporter_settings`
  - `get_helpers_to_export_whitelist`
  - `get_helpers_to_export_blacklist`
  - `get_helper_modules`
  - `get_item_name_modules`
- Pre/post processing hooks:
  - `preprocess_world_data`
  - `post_process_data`

The class will inherit from all mixins via multiple inheritance.

### 2. `base/rule_expansion.py` (RuleExpansionMixin - ~500 lines)

Contains all rule expansion logic:
- `expand_rule` (lines 509-535)
- `_recursively_expand_rule_children` (lines 536-821) - the large recursive method
- `_expand_dict_values` (lines 823-845)
- `_resolve_option_access` (lines 847-894)
- `expand_count_check` (lines 1032-1040)
- `resolve_f_string` (lines 1042-1078)
- `_resolve_f_string_value` (lines 1080-1105)
- `_evaluate_binary_op` (lines 1107-1164)

### 3. `base/world_data.py` (WorldDataMixin - ~600 lines)

Contains world data extraction:
- `get_world_data` (lines 1262-1458)
- `get_world_attributes` (lines 1460-1726)
- `get_itempool_counts` (lines 1199-1233)
- `cleanup_world_data` (lines 1775-1790)
- `cleanup_settings` (lines 1792-1795)
- `get_region_attributes` (lines 1797-1862)
- `get_location_attributes` (lines 1864-1928)
- `recalculate_collection_state_if_needed` (lines 1183-1197)

### 4. `base/helper_discovery.py` (HelperDiscoveryMixin - ~700 lines)

Contains helper function discovery and analysis:
- `_analyze_worldgen_helpers` (lines 2052-2142)
- `_strip_worldgen_prefixes_from_rules` (lines 2144-2170)
- `get_helper_definitions` (lines 2632-2913)
- `_clean_helper_rule` (lines 2915-2993)
- `_resolve_item_attribute` (lines 2995-3033)
- `_resolve_items_collection` (lines 3035-3075)
- `_simplify_has_all` (lines 3077-3138)
- `_extract_items_from_constant` (lines 3140-3160)

### 5. `base/option_normalization.py` (OptionNormalizationMixin - ~500 lines)

Contains option constant normalization:
- `normalize_helper_option_constants` (lines 2172-2296)
- `normalize_region_option_constants` (lines 2298-2464)
- `normalize_to_string_constants` (lines 2466-2630)

### 6. `base/utilities.py` (Static utilities - ~100 lines)

Contains static utility methods:
- `prepare_closure_vars` (lines 375-409)
- `_extract_closure_vars` (lines 411-436) - static method
- `count_rule_nodes` (lines 438-480) - static method
- `sanitize_helper_name` (lines 482-507) - static method

## Implementation Steps

### Step 1: Create base/ Directory
Create `exporter/games/base/` directory with `__init__.py`.

### Step 2: Create Mixin Classes
Create each mixin file in `base/` with methods extracted from the old base.py.
Mixins should not have `__init__` methods and should assume access to `self.world`, `self._discovered_helpers`, etc.

### Step 3: Create base/handler.py
Create the core `BaseGameExportHandler` class that:
- Defines all class configuration attributes
- Inherits from all mixins
- Contains `__init__` and core methods

### Step 4: Create base/__init__.py
Export `BaseGameExportHandler` for clean imports:
```python
from exporter.games.base.handler import BaseGameExportHandler
```

### Step 5: Update exporter/games/__init__.py
Update to import from new location (backwards compatible):
```python
from exporter.games.base import BaseGameExportHandler
```

### Step 6: Remove Old base.py
Delete `exporter/games/base.py` after verifying everything works.

### Step 7: Verify Game-Specific Handlers
Game-specific handlers (like `generic.py`) that override mixin methods will continue to work via normal inheritance since they inherit from `BaseGameExportHandler`.

## Benefits

1. **Clear Separation**: Base infrastructure in `base/` vs game-specific handlers in parent directory
2. **Maintainability**: Each module has a focused purpose
3. **Readability**: Easier to navigate ~400-700 line files vs 3,160 lines
4. **Testing**: Individual mixins can be unit tested in isolation
5. **Extensibility**: New functionality can be added to appropriate mixins
6. **Backwards Compatible**: External code importing `BaseGameExportHandler` continues to work
7. **Discoverability**: Clear where to look for base functionality vs game overrides

## Dependency Order

The mixins have some dependencies:
```
base/utilities.py              <- No dependencies (all static)
base/option_normalization.py   <- No internal dependencies
base/rule_expansion.py         <- Uses utilities (count_rule_nodes)
base/world_data.py             <- Uses utilities
base/helper_discovery.py       <- Uses rule_expansion (expand_rule), option_normalization
base/handler.py                <- Inherits from all mixins
```

## Migration Strategy

1. Create `base/` directory structure
2. Start with `base/utilities.py` (static methods, lowest risk)
3. Then `base/option_normalization.py` (self-contained normalization logic)
4. Then `base/rule_expansion.py` (used by helper_discovery)
5. Then `base/world_data.py` (used during export)
6. Then `base/helper_discovery.py` (highest complexity)
7. Create `base/handler.py` with the core class inheriting from all mixins
8. Update `base/__init__.py` and `exporter/games/__init__.py`
9. Remove old `base.py`

## Testing

After each step:
1. Run existing tests: `python scripts/test/test-all-templates.py --include-list "TUNIC.yaml" -p`
2. Verify exports still match (diff rules.json before/after)
