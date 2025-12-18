# Rule Format Migration Analysis: CC Format to Rule Builder Format

## Overview

This document analyzes the feasibility and implications of migrating from the original CC (Archipelago-CC) JSON rule format to the Rule Builder format throughout the codebase.

## Background

When this project was first developed, the exporter wrote rule data to `rules.json` files in what is now called the **CC format**. This format wasn't designed ahead of time—it mirrors the structure of Python AST nodes from which rules were extracted.

Later, the **Rule Builder format** was discovered (from Archipelago PR #5048), which uses a more declarative, class-based approach. When the world generator was created to convert `rules.json` data into Python apworld directories, it was decided to:

1. Convert CC format to Rule Builder format first
2. Use Rule Builder classes to generate Python code

The Rule Builder format was also extended to support more CC format features. Now both the exporter and frontend support Rule Builder format in addition to CC format.

## Current State

### Two Parallel Format Systems

| Format | Identifier | Origin | Example |
|--------|------------|--------|---------|
| **CC Format** | `type` field | AST analysis | `{"type": "item_check", "item": "Sword", "count": 2}` |
| **Rule Builder** | `rule` field | PR #5048 | `{"rule": "Has", "args": {"item_name": "Sword", "count": 2}}` |

### Code Size Comparison

| Component | Lines of Code | Purpose |
|-----------|---------------|---------|
| `exporter/analyzer/` | ~6,100 | AST analysis → CC format |
| `rule_builder/` | ~4,200 | Rule Builder classes & CC parsing |
| `exporter/converter/` | ~2,800 | Bidirectional format conversion |

### Current Usage by Component

| Component | CC Format | Rule Builder Format |
|-----------|-----------|---------------------|
| **Exporter** (AST path) | Produces | - |
| **Exporter** (`.to_dict()` path) | - | Produces |
| **Frontend rule engine** | Evaluates | Evaluates |
| **World generator** | Reads (input) | Produces (output) |
| **Worldgen Rules.py** | - | Uses RB classes |
| **Existing presets** (alttp, etc.) | Current format | - |
| **Worldgen presets** | Mixed | Primary |

### Format Detection in Frontend

The frontend (`frontend/modules/shared/ruleEngine.js:465-470`) auto-detects format:

```javascript
// Detect Rule Builder format: has 'rule' key but no 'type' key
if (rule.rule && !rule.type) {
  return evaluateRuleBuilderRule(rule, context, depth, localScope);
}
```

### Format Detection in Exporter

The exporter (`exporter/exporter.py:1048-1062`) prefers Rule Builder when available:

```python
# Check if this is a Rule Builder Resolved rule with native serialization
if hasattr(rule_func, 'to_dict') and callable(rule_func.to_dict):
    try:
        rb_dict = rule_func.to_dict()
        return rb_dict
    except Exception:
        # Fall through to AST analysis as fallback
```

## Format Comparison

### CC Format Structure

```json
{
  "type": "<rule_type>",
  // type-specific fields
}
```

Common types: `constant`, `item_check`, `count_check`, `group_check`, `and`, `or`, `not`, `state_method`, `helper`, `compare`, `binary_op`, `conditional`, `can_reach`, `location_check`, `can_reach_entrance`, `attribute`, `subscript`, `f_string`

### Rule Builder Format Structure

```json
{
  "rule": "<RuleClassName>",
  "options": [],
  "args": { /* named arguments */ },
  "children": [ /* for composite rules */ ]
}
```

Common rules: `True_`, `False_`, `Has`, `HasAll`, `HasAny`, `HasAllCounts`, `HasGroup`, `HasGroupUnique`, `HasFromList`, `HasFromListUnique`, `And`, `Or`, `CanReachRegion`, `CanReachLocation`, `CanReachEntrance`, `Filtered`, `HelperCall`, `Compare`, `Arithmetic`, `Not`, `Conditional`

## Conversion Analysis

### Bidirectional Converter Coverage

| Direction | Coverage | Notes |
|-----------|----------|-------|
| Rule Builder → CC | 85-95% | High fidelity, most rules convert cleanly |
| CC → Rule Builder | 60-70% | Core rules convert; complex patterns preserved as custom rules |

### Fully Bidirectional Mappings

| CC Format | Rule Builder | Lossless |
|-----------|--------------|----------|
| `constant` (true/false) | `True_`/`False_` | Yes |
| `item_check` | `Has` | Yes |
| `group_check` | `HasGroup` | Yes |
| `and` | `And` | Yes |
| `or` | `Or` | Yes |
| `can_reach` | `CanReachRegion` | Yes |
| `location_check` | `CanReachLocation` | Yes |
| `can_reach_entrance` | `CanReachEntrance` | Yes |
| `state_method` (has_all) | `HasAll` | Yes |
| `state_method` (has_any) | `HasAny` | Yes |

### Partial/Preserved Conversions (CC → RB)

| CC Type | Conversion Notes |
|---------|------------------|
| `not` | Becomes `Not` custom rule (extended RB) |
| `helper` | Becomes `HelperCall` with body data |
| `compare` | Becomes `Compare` (extended RB) |
| `binary_op` | Becomes `Arithmetic` (extended RB) |
| `conditional` | May become `Filtered` or `Conditional` |
| `attribute` | Preserved as custom rule |
| `subscript` | Preserved as custom rule |

### Non-Convertible Types

These CC types have no clean Rule Builder equivalent:
- `all_of` / `any_of` (generator expressions)
- `f_string` (string formatting)
- Game-specific types (`capability`, `coins`, etc.)

## Feasibility Assessment

### Is Migration Possible?

**Yes, with caveats.**

| Scenario | Feasibility | Effort |
|----------|-------------|--------|
| New exports prefer RB format | ✅ Already implemented | Done |
| Convert existing presets to RB | ⚠️ 60-70% clean conversion | Medium |
| Remove CC evaluation from frontend | ❌ RB evaluator delegates to CC | High |
| Remove AST analyzer entirely | ❌ Still needed for lambda rules | High |

### Key Blockers for Complete Migration

1. **Frontend RB evaluator delegates to CC**: The `evaluateRuleBuilderRule` function calls `evaluateRule` (CC evaluator) for several rule types (Has, CanReach, helpers, etc.)

2. **Games without Rule Builder support**: Many games use lambda rules that require AST analysis to extract

3. **Complex expressions**: Some patterns (attribute access, subscripts, generator expressions) don't map to RB

### Benefits of Migration

1. **Cleaner format**: More declarative, self-documenting
2. **Native Python classes**: Direct use in worldgen without conversion
3. **Tooling potential**: Rule Builder editor, validation, etc.
4. **Reduced code**: Eventually remove ~6,100 lines of analyzer code
5. **Single evaluation path**: Simpler frontend maintenance

### Risks of Migration

1. **Edge cases**: Some complex rules may not convert correctly
2. **Testing burden**: Need to verify all presets work identically
3. **Frontend refactoring**: RB evaluator needs to be self-contained
4. **No rollback**: Once CC support removed, can't easily restore

## Recommendations

### Recommended Approach: Phased Migration

**Phase 1: Export Preference** (Low effort, already partial)
- Ensure exporter prefers RB format when `.to_dict()` available
- Fall back to CC format only for unsupported patterns
- Status: Partially implemented

**Phase 2: Extend Rule Builder** (Medium effort)
- Add any missing RB rule types (e.g., proper `Not` support)
- Ensure all CC patterns have RB equivalents or graceful fallbacks
- Update converter to handle edge cases

**Phase 3: Convert Existing Presets** (Medium effort)
- Use converter to migrate all presets to RB format
- Preserve unconverted rules with `_converted_from_cc` metadata
- Verify spoiler tests pass for all converted presets

**Phase 4: Unify Frontend Evaluator** (Higher effort)
- Refactor `evaluateRuleBuilderRule` to be self-contained
- Remove delegation to CC evaluator
- Comprehensive frontend testing

**Phase 5: Deprecate CC Format** (Future)
- Remove AST analyzer (~6,100 lines)
- Remove CC evaluation path from frontend
- Update documentation

### Not Recommended: Big Bang Migration

Attempting to remove CC support all at once would be risky because:
- Many edge cases may not be discovered until runtime
- No easy rollback path
- Large testing burden concentrated in one change

## Conclusion

**Migration is feasible and beneficial**, but should be done incrementally. Since there are no external users yet, timing is flexible. The recommended approach is to:

1. Standardize new development on Rule Builder format
2. Gradually convert existing presets
3. Keep CC support as fallback until all edge cases are handled
4. Remove CC support only when confident in full coverage

The end state would eliminate ~6,100 lines of analyzer code, simplify the frontend evaluator, and provide a cleaner, more maintainable rule format throughout the system.
