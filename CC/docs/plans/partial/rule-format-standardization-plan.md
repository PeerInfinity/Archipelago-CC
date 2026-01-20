# Rule Format Standardization Plan

## Progress Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Pattern Optimizations | ✅ Complete |
| Phase 2 | Complete Type Coverage | ⚠️ Partially Complete |
| Phase 3 | WorldGen Alignment | In Progress |
| Phase 4 | Regenerate All Presets | Not Started |

**Last Updated**: 2026-01-20

## Goal

Standardize all rule exports on Rule Builder format. The AST analyzer will continue to analyze Python code and produce AST format internally, but the output will be converted to Rule Builder format before export.

Both the original exporter and WorldGen should produce identical Rule Builder format for semantically equivalent rules.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Original Exporter                                                            │
│                                                                              │
│   Lambda rules → AST Analyzer → AST format → Converter → Rule Builder format │
│                                     ↓                                        │
│                              (internal only)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ WorldGen                                                                     │
│                                                                              │
│   rules.json → Extractor → Python code (Rule Builder) → Exporter → RB format│
│                                                              ↓               │
│                                                   (uses same exporter)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What Already Exists

### Infrastructure

1. **Converter Module** (`exporter/converter/`)
   - `ast_to_rule_builder.py` - Converts AST format to Rule Builder format
   - `rule_builder_to_ast.py` - Converts Rule Builder format to AST format
   - Supports most common rule types

2. **Exporter Integration** (`exporter/exporter.py:2330-2348`)
   - Already calls `convert_rules_file_to_rule_builder()` on export
   - Controlled by `rules_json_format` parameter (default: `"rule_builder"`)

3. **Rule Builder Extensions** (`rule_builder/rules.py`)
   - `Not`, `Conditional`, `Compare`, `Arithmetic`, `HelperCall`, `CountItem`
   - Extended beyond original PR #5048 spec

### Existing Planning Documents

- `partial/rule-format-migration-plan.md` - Detailed phased migration plan (in progress)
- `completed/rule-format-inconsistencies.md` - Known format issues (resolved)
- `completed/rule-format-migration-analysis.md` - Analysis of format differences (complete)

## Remaining Work

### 1. Complete AST → Rule Builder Conversion Coverage

Status of AST type conversion coverage:

| AST Type | Current Behavior | Status |
|----------|-----------------|--------|
| `setting_value` | Converts to `SettingValue` rule (converter support) | ⚠️ Rule class missing in rules.py |
| `option_value` | Converts to `OptionValue` rule | ✅ Complete |
| `subscript` | Preserved as custom `AST_subscript` | ⚠️ No Rule class exists |
| `helper` | Flattened args structure | ✅ Fixed (2025-12-19) |
| `compare` | Converts to `Compare` rule | ✅ Complete |
| `binary_op` | Converts to `Arithmetic` rule | ✅ Complete |

### 2. Pattern Optimizations ✅ COMPLETE

All pattern optimizations are implemented in `ast_to_rule_builder.py`:

#### 2.1 Combine Has into HasAll/HasAny

**Before (verbose):**
```json
{
  "rule": "And",
  "children": [
    {"rule": "Has", "args": {"item_name": "Sword"}},
    {"rule": "Has", "args": {"item_name": "Shield"}},
    {"rule": "Has", "args": {"item_name": "Bow"}}
  ]
}
```

**After (optimized):**
```json
{
  "rule": "HasAll",
  "args": {"items": ["Sword", "Shield", "Bow"]}
}
```

**Criteria for optimization:**
- All children are simple `Has` rules (no count, no other conditions)
- Parent is `And` → combine to `HasAll`
- Parent is `Or` → combine to `HasAny`

#### 2.2 Flatten Nested And/Or

**Before:**
```json
{
  "rule": "And",
  "children": [
    {"rule": "Has", "args": {"item_name": "A"}},
    {"rule": "And", "children": [
      {"rule": "Has", "args": {"item_name": "B"}},
      {"rule": "Has", "args": {"item_name": "C"}}
    ]}
  ]
}
```

**After:**
```json
{
  "rule": "And",
  "children": [
    {"rule": "Has", "args": {"item_name": "A"}},
    {"rule": "Has", "args": {"item_name": "B"}},
    {"rule": "Has", "args": {"item_name": "C"}}
  ]
}
```

#### 2.3 Simplify Trivial Conditions

- `And` with single child → unwrap to child
- `Or` with single child → unwrap to child
- `Not(Not(X))` → `X`
- `And(..., True_)` → remove `True_`
- `Or(..., False_)` → remove `False_`

### 3. WorldGen Alignment

Ensure WorldGen exports match original exports for equivalent rules:

| Issue | Location | Fix |
|-------|----------|-----|
| Helper discovery | `helper_discovery.py` | ✅ Fixed - uses `_internal_function` |
| Helper naming | `rule_codegen.py` | ✅ Fixed - no prefix |
| Dungeon regions | `templates.py` | ✅ Fixed - correct order |
| `dynamically_added` | `exporter.py` | ✅ Fixed - auto-detect |
| `locked` status | `compare_rules_json.py` | ✅ Ignored in canonical comparison |

Remaining WorldGen alignment issues:
- Helper body format differences (e.g., `count_check` vs `item_check`)
- Access rule variable expansion (`location` vs `get_location()`)
- Default parameter handling

### 4. Comparison Script Enhancements

Update `compare_rules_json.py` to normalize Rule Builder format before comparison:

- Sort `And`/`Or` children canonically
- Normalize `Has` with count:1 to `Has` without count
- Normalize `HasAll`/`HasAny` item order

## Implementation Order

### Phase 1: Pattern Optimizations in Converter ✅ COMPLETE

Implemented methods in `ast_to_rule_builder.py`:
- `_combine_has_rules()` - combines Has into HasAll/HasAny
- `_flatten_composite()` - flattens nested And/Or
- `_remove_identity_elements()` - removes True_ from And, False_ from Or
- `_check_absorbing_element()` - checks for False_ in And, True_ in Or
- `_optimize_composite()` - orchestrates all optimizations

### Phase 2: Complete Type Coverage (PARTIALLY COMPLETE)

| Task | Status |
|------|--------|
| Add `SettingValue` rule to Rule Builder | ⚠️ Converter outputs it, but Rule class missing |
| Add `Subscript` rule to Rule Builder | ⚠️ Not started |
| Update converter to use new rules | ✅ Converter supports SettingValue output |
| Fix helper args nesting issue | ✅ Fixed (2025-12-19) |

Note: `OptionValue` Rule class exists and works. `SettingValue` is a legacy alias that needs a proper Rule class or should be consolidated with `OptionValue`.

### Phase 3: WorldGen Alignment
1. Fix helper body format differences
2. Align access rule variable handling
3. Align default parameter handling

### Phase 4: Regenerate All Presets
1. Regenerate original game presets with new format
2. Regenerate WorldGen presets
3. Run comparison tests
4. Fix any remaining differences

## Success Criteria

1. **Format Consistency**: Both original and WorldGen exports produce identical Rule Builder format for semantically equivalent rules

2. **Clean Output**: No nested args, no unnecessary wrappers, optimal pattern usage

3. **Round-Trip Fidelity**: AST → Rule Builder → AST produces equivalent (if not identical) rules

4. **Test Coverage**: All pattern optimizations have unit tests

5. **Comparison Pass**: `compare_rules_json.py` shows 0 differences for equivalent worlds (excluding expected seed-specific differences)

## Files to Modify

### Converter
- `exporter/converter/ast_to_rule_builder.py` - ✅ Optimizations complete
- `exporter/converter/rule_builder_to_ast.py` - Handle new patterns (if needed)

### Rule Builder
- `rule_builder/rules.py` - ⚠️ Add `SettingValue` class (or consolidate with `OptionValue`), add `Subscript` rule

### WorldGen
- `world_generator/rule_codegen.py` - Align helper generation
- `world_generator/templates.py` - Align code generation

### Comparison
- `scripts/test/compare_rules_json.py` - Add Rule Builder normalizations
