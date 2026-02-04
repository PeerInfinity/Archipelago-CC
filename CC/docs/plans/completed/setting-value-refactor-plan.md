# Setting Value Refactor Plan

**Status: COMPLETED** (Phases 1 & 2)

## Overview

The `setting_value` rule type was used ambiguously for two distinct concepts:
1. **Options** - User-configurable game options (e.g., `swordless`, `glitches_required`)
2. **World attributes** - Dynamically computed values on the world instance (e.g., `required_medallions`)

This document outlines the plan that was implemented to clarify this distinction in the rules.json format.

## Original Problem

### How `setting_value` was used

```json
// Option reference (user-configurable)
{"type": "setting_value", "setting": "swordless"}

// World attribute reference (dynamically computed)
{"type": "setting_value", "setting": "required_medallions", "index": 0}
```

Both used the same type, making it unclear which is which.

## Implemented Solution

Split `setting_value` into two distinct types (Option 1 from original plan):

```json
// For user-configurable options
{"type": "option_value", "option": "swordless"}

// For world instance attributes
{"type": "world_attribute", "attribute": "required_medallions", "index": 0}
```

**Advantages achieved:**
- Clear semantic distinction
- Self-documenting JSON
- Matches the actual Python access patterns
- Easier to validate and debug

## Implementation Summary

### Phase 1: Add new types (COMPLETED)

1. **Frontend rule evaluation** (`frontend/modules/shared/ruleEngine.js`)
   - Lines 2889-2891 handle all three types: `option_value`, `world_attribute`, `setting_value` (legacy)
   - All three use `getSetting()` which checks settings first, then falls back to world_attributes

2. **Exporter** (`exporter/`)
   - `ast_to_rule_builder.py:115-117` - Converters for all three types
   - `_convert_option_value()` at line 1487
   - `_convert_world_attribute()` at line 1495
   - `json_to_python.py:523-533` - Python code generation for both new types

3. **World generator** (`world_generator/`)
   - `rule_codegen.py:2815,6033` - `_expr_world_attribute()` implementations
   - `rule_codegen.py:2838,6001` - `_expr_option_value()` implementations

4. **Rule Builder** (`rule_builder/`)
   - `rules.py:3469` - `OptionValue` class
   - `ast_explain.py:65-66` - Handlers registered for both new types
   - `ast_explain.py:417-434` - `_explain_option_value()` and `_explain_world_attribute()`
   - `__init__.py:73,141` - `OptionValue` exported

5. **Schema** (`frontend/schema/rules.schema.json`)
   - Lines 402-408 define `option` and `attribute` fields
   - `setting` field marked as legacy (line 400)

### Phase 2: Migration (COMPLETED)

1. **compare_rules_json.py** updated with normalizers:
   - `normalize_setting_types()` (lines 1129-1163) - Normalizes all three types to `setting_value` for comparison
   - `normalize_setting_to_world_attribute()` (lines 399-429)
   - `normalize_world_attribute_format()` (lines 1088-1126)
   - `normalize_nested_world_attribute()` (lines 303-367)

2. **Presets regenerated**
   - Both `option_value` and `world_attribute` types appear in preset files

3. **Documentation updated**
   - `docs/json/developer/reference/rule-types-reference.md:74-76` documents all three types

### Phase 3: Deprecation (OPTIONAL - NOT IMPLEMENTED)

This phase was intentionally deferred:
- `setting_value` remains supported for backward compatibility
- No deprecation warnings added
- Legacy format continues to work in all components

## Files Modified

### Exporter
- `exporter/converter/ast_to_rule_builder.py` - AST format conversion
- `exporter/converter/json_to_python.py` - Python code generation

### World Generator
- `world_generator/rule_codegen.py` - `_expr_option_value()`, `_expr_world_attribute()`

### Frontend
- `frontend/modules/shared/ruleEngine.js` - Rule evaluation
- `frontend/schema/rules.schema.json` - Schema definition

### Rule Builder
- `rule_builder/rules.py` - `OptionValue` class
- `rule_builder/ast_explain.py` - Explain functions
- `rule_builder/__init__.py` - Exports

### Testing
- `scripts/test/compare_rules_json.py` - Normalization functions

## Related Work (Future Considerations)

- `resolved_settings` in extractors.py still mixes options and world attributes
- Consider renaming to `resolved_values` with sub-dicts `options` and `world_attributes`
- The `settings` variable name appears throughout the codebase and could be audited

## Decision

**IMPLEMENTED** - Option 1 (two separate types) was implemented. Phases 1 and 2 are complete. Phase 3 (deprecation) remains optional for future consideration.
