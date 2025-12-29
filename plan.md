# Refactoring Plan: exporter/games/base.py

## Current State

The `base.py` file is 3,160 lines containing a single class `BaseGameExportHandler` with:
- ~30 class configuration attributes
- ~50 methods covering diverse functionality
- Mixed concerns that have accumulated over time

## Proposed Module Structure

Split `base.py` into focused modules under `exporter/games/`:

```
exporter/games/
├── __init__.py          # Re-export BaseGameExportHandler for backwards compatibility
├── base.py              # Core BaseGameExportHandler class (streamlined)
├── rule_expansion.py    # Rule expansion logic (RuleExpansionMixin)
├── world_data.py        # World data extraction (WorldDataMixin)
├── helper_discovery.py  # Helper function discovery and analysis (HelperDiscoveryMixin)
├── option_normalization.py  # Option constant normalization (OptionNormalizationMixin)
└── utilities.py         # Static utility methods
```

## Module Breakdown

### 1. `base.py` (Core - ~400 lines)

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

### 2. `rule_expansion.py` (RuleExpansionMixin - ~500 lines)

Contains all rule expansion logic:
- `expand_rule` (lines 509-535)
- `_recursively_expand_rule_children` (lines 536-821) - the large recursive method
- `_expand_dict_values` (lines 823-845)
- `_resolve_option_access` (lines 847-894)
- `expand_count_check` (lines 1032-1040)
- `resolve_f_string` (lines 1042-1078)
- `_resolve_f_string_value` (lines 1080-1105)
- `_evaluate_binary_op` (lines 1107-1164)

### 3. `world_data.py` (WorldDataMixin - ~600 lines)

Contains world data extraction:
- `get_world_data` (lines 1262-1458)
- `get_world_attributes` (lines 1460-1726)
- `get_itempool_counts` (lines 1199-1233)
- `cleanup_world_data` (lines 1775-1790)
- `cleanup_settings` (lines 1792-1795)
- `get_region_attributes` (lines 1797-1862)
- `get_location_attributes` (lines 1864-1928)
- `recalculate_collection_state_if_needed` (lines 1183-1197)

### 4. `helper_discovery.py` (HelperDiscoveryMixin - ~700 lines)

Contains helper function discovery and analysis:
- `_analyze_worldgen_helpers` (lines 2052-2142)
- `_strip_worldgen_prefixes_from_rules` (lines 2144-2170)
- `get_helper_definitions` (lines 2632-2913)
- `_clean_helper_rule` (lines 2915-2993)
- `_resolve_item_attribute` (lines 2995-3033)
- `_resolve_items_collection` (lines 3035-3075)
- `_simplify_has_all` (lines 3077-3138)
- `_extract_items_from_constant` (lines 3140-3160)

### 5. `option_normalization.py` (OptionNormalizationMixin - ~500 lines)

Contains option constant normalization:
- `normalize_helper_option_constants` (lines 2172-2296)
- `normalize_region_option_constants` (lines 2298-2464)
- `normalize_to_string_constants` (lines 2466-2630)

### 6. `utilities.py` (Static utilities - ~100 lines)

Contains static utility methods:
- `prepare_closure_vars` (lines 375-409)
- `_extract_closure_vars` (lines 411-436) - static method
- `count_rule_nodes` (lines 438-480) - static method
- `sanitize_helper_name` (lines 482-507) - static method

## Implementation Steps

### Step 1: Create Mixin Classes
Create each mixin file with its methods extracted from base.py. Mixins should not have `__init__` methods and should assume access to `self.world`, `self._discovered_helpers`, etc.

### Step 2: Update base.py
- Add imports for all mixins
- Make `BaseGameExportHandler` inherit from all mixins
- Remove the methods that moved to mixins
- Keep configuration attributes and core methods

### Step 3: Update __init__.py
Ensure `BaseGameExportHandler` is properly exported for backwards compatibility:
```python
from exporter.games.base import BaseGameExportHandler
```

### Step 4: Update Imports in Subclasses
Game-specific handlers (like `generic.py`) that override mixin methods will continue to work via normal inheritance.

## Benefits

1. **Maintainability**: Each module has a focused purpose
2. **Readability**: Easier to navigate ~400-700 line files vs 3,160 lines
3. **Testing**: Individual mixins can be unit tested in isolation
4. **Extensibility**: New functionality can be added to appropriate mixins
5. **Backwards Compatible**: External code importing `BaseGameExportHandler` continues to work

## Dependency Order

The mixins have some dependencies:
```
utilities.py              <- No dependencies (all static)
option_normalization.py   <- No internal dependencies
rule_expansion.py         <- Uses utilities (count_rule_nodes)
world_data.py            <- Uses utilities
helper_discovery.py      <- Uses rule_expansion (expand_rule), option_normalization
base.py                  <- Inherits from all mixins
```

## Migration Strategy

1. Start with `utilities.py` (static methods, lowest risk)
2. Then `option_normalization.py` (self-contained normalization logic)
3. Then `rule_expansion.py` (used by helper_discovery)
4. Then `world_data.py` (used during export)
5. Then `helper_discovery.py` (highest complexity)
6. Finally update `base.py` to use the mixins

## Testing

After each step:
1. Run existing tests: `python scripts/test/test-all-templates.py --include-list "TUNIC.yaml" -p`
2. Verify exports still match (diff rules.json before/after)
