# Setting Value Refactor Plan

## Overview

The `setting_value` rule type is currently used ambiguously for two distinct concepts:
1. **Options** - User-configurable game options (e.g., `swordless`, `glitches_required`)
2. **World attributes** - Dynamically computed values on the world instance (e.g., `required_medallions`)

This document outlines a plan to clarify this distinction in the rules.json format.

## Current State

### How `setting_value` is used

```json
// Option reference (user-configurable)
{"type": "setting_value", "setting": "swordless"}

// World attribute reference (dynamically computed)
{"type": "setting_value", "setting": "required_medallions", "index": 0}
```

Both use the same type, making it unclear which is which.

### Current workaround

The world generator now uses `option_definitions` to determine the correct access pattern:
- Options: `state.multiworld.worlds[player].options.X`
- World attributes: `state.multiworld.worlds[player].X`

This works because:
1. The exporter recognizes both patterns and converts them to `setting_value`
2. The world generator checks `option_definitions` to generate the correct pattern
3. The distinction is handled at code generation time, not in the JSON format

## Proposed Change

Split `setting_value` into two distinct types:

### Option 1: Two separate types (Recommended)

```json
// For user-configurable options
{"type": "option_value", "option": "swordless"}

// For world instance attributes
{"type": "world_attribute", "attribute": "required_medallions", "index": 0}
```

**Advantages:**
- Clear semantic distinction
- Self-documenting JSON
- Matches the actual Python access patterns
- Easier to validate and debug

**Disadvantages:**
- Breaking change requiring updates across the codebase

### Option 2: Add a `source` field

```json
{"type": "setting_value", "source": "option", "setting": "swordless"}
{"type": "setting_value", "source": "world", "setting": "required_medallions"}
```

**Advantages:**
- Backward compatible if `source` is optional
- Smaller change

**Disadvantages:**
- Still uses ambiguous "setting" terminology
- More verbose

## Implementation Plan (Option 1)

### Phase 1: Add new types (backward compatible)

1. **Update frontend rule evaluation** (`frontend/src/`)
   - Add handlers for `option_value` and `world_attribute` types
   - Keep `setting_value` handler for backward compatibility

2. **Update exporter** (`exporter/`)
   - Modify pattern detection to output new types:
     - `world.options.X` → `{"type": "option_value", "option": "X"}`
     - `world.X` (non-option) → `{"type": "world_attribute", "attribute": "X"}`
   - Update `ast_to_rule_builder.py` for AST format
   - Update `json_to_python.py` for Python code generation

3. **Update world generator** (`world_generator/`)
   - Modify extractors to recognize both old and new formats
   - Modify `_expr_setting_value` to handle both formats
   - Eventually rename to `_expr_option_value` and `_expr_world_attribute`

4. **Update rule_builder** (`rule_builder/`)
   - Add new AST node types if needed
   - Update explain functions

5. **Update schema** (`frontend/schema/rules.schema.json`)
   - Add new type definitions
   - Keep `setting_value` for backward compatibility

### Phase 2: Migration

1. **Update compare_rules_json.py**
   - Add normalization to treat old and new formats as equivalent during transition

2. **Regenerate all presets**
   - Run the test pipeline to regenerate all game presets with new format

3. **Update documentation**
   - Document the new types in schema documentation

### Phase 3: Deprecation (optional, future)

1. **Add deprecation warnings** for `setting_value` usage
2. **Remove `setting_value`** support after all presets are migrated

## Files to Modify

### Exporter
- `exporter/analyzer/ast_visitors/expression_visitors.py` - Pattern detection
- `exporter/analyzer/ast_visitors/pattern_detection.py` - `_is_world_options_pattern()`
- `exporter/converter/ast_to_rule_builder.py` - AST format conversion
- `exporter/converter/json_to_python.py` - Python code generation

### World Generator
- `world_generator/rule_codegen.py` - `_expr_setting_value()`, `_convert_setting_value()`
- `world_generator/extractors.py` - If format changes affect extraction

### Frontend
- `frontend/src/logic/` - Rule evaluation
- `frontend/schema/rules.schema.json` - Schema definition

### Rule Builder
- `rule_builder/ast_explain.py` - Explain functions
- `rule_builder/ast_format.py` - AST parsing

### Testing
- `scripts/test/compare_rules_json.py` - Normalization functions

## Migration Strategy

To ensure smooth migration:

1. **Support both formats simultaneously** during transition
2. **Output new format** from exporter
3. **Accept both formats** in world generator and frontend
4. **Use compare_rules_json.py** to normalize during testing

## Timeline Estimate

- Phase 1: 2-3 sessions (add new types, keep backward compat)
- Phase 2: 1 session (regenerate presets, update tests)
- Phase 3: Future (after validation period)

## Related Work

- `resolved_settings` in extractors.py also mixes options and world attributes
- Consider renaming to `resolved_values` with sub-dicts `options` and `world_attributes`
- The `settings` variable name appears throughout the codebase and should be audited

## Decision

**Pending** - Document created for planning. Implementation to be scheduled.
