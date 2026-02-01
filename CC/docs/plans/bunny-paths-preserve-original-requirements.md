# BunnyPaths: Preserve Original Location Requirements

## Overview

This document outlines the fix for the BunnyPaths regression where 196/1000 seeds fail because the BunnyPaths rule replaces the entire location access rule, losing non-bunny requirements.

**Status**: Planning
**Priority**: Critical
**Date**: 2026-01-31
**Related**: `CC/docs/plans/entrance-aware-bunny-evaluation.md`

## Problem Statement

### Current Behavior (Broken)

The `post_process_data` method in `alttp.py` replaces the entire location access rule with BunnyPaths:

```python
if loc_name in SUPERBUNNY_ACCESSIBLE_LOCATIONS:
    bunny_paths = self._extract_bunny_paths(loc_name)
    if bunny_paths:
        loc_data['access_rule'] = bunny_paths  # REPLACES entire rule
```

### Example Failure: Library (Seed 850)

**Original ALttP rule construction:**
```python
# Step 1: Set base rule
set_rule(world.get_location('Library', player),
         lambda state: state.has('Book of Mudora', player))

# Step 2: add_rule adds bunny check ON TOP
add_rule(location, lambda state: state.has('Moon Pearl', player) or superbunny_path(state))
```

**Result:** `And(has(Book of Mudora), Or(has(Moon Pearl), superbunny_path))`

**What BunnyPaths does:**
- Extracts: `BunnyPaths(direct(Moon Pearl) OR path(entrance, Mirror))`
- Replaces the entire access rule with this
- **Loses:** `has(Book of Mudora)` requirement

**Failure:** Player has Moon Pearl but not Book of Mudora. BunnyPaths says accessible, server says not accessible.

### Scope of Problem

From fuzzer logs:
- **Seed 13:** Library expected but not accessible
- **Seed 168:** Superbunny Cave expected but not accessible; Pyramid Fairy accessible but not expected
- **Seed 850:** Library expected but not accessible

Common pattern: Locations with requirements beyond just the bunny rule.

## Root Cause Analysis

### How ALttP Bunny Rules Work

1. **Base rules** are set for locations (e.g., `has(Book)` for Library)
2. **`set_bunny_rules()`** adds bunny checks using `add_rule`:
   ```python
   add_rule(location, bunny_rule)  # Creates: original AND bunny_rule
   ```
3. The final access rule is: `original_requirements AND bunny_state_requirements`

### How BunnyPaths Breaks This

1. **Extraction** only extracts the bunny rule part (Moon Pearl / path options)
2. **Replacement** overwrites the entire access rule
3. **Lost** are the original requirements (Book, keys, items, etc.)

### Why Simple Fixes Won't Work

1. **Can't just AND with original rule** - The original rule in the exported JSON already includes the bunny parts, creating circular logic
2. **Can't extract non-bunny parts from closure** - The `add_rule` pattern combines them in a way that's hard to separate
3. **The exported rule IS the combined rule** - We need to identify which parts are bunny-related and which aren't

## Proposed Solution

### Approach: Analyze Original Rule Structure

Instead of replacing the access rule, we need to:

1. **Identify the bunny rule portion** within the combined rule
2. **Replace only that portion** with BunnyPaths
3. **Preserve the rest** of the original requirements

### Key Insight

The exported access rule has a structure like:
```json
{
  "type": "and",
  "conditions": [
    {"type": "item_check", "item": "Book of Mudora"},  // Original requirement
    {"type": "or", "conditions": [                      // Bunny rule
      {"type": "item_check", "item": "Moon Pearl"},
      {"type": "and", "conditions": [/* superbunny path */]}
    ]}
  ]
}
```

We need to:
1. Find the bunny rule portion (the Or with Moon Pearl / superbunny paths)
2. Replace it with simplified BunnyPaths
3. Keep the And wrapper with original requirements

### Alternative Approach: Don't Use Post-Processing

Instead of post-processing the exported rule, fix the problem at the source:

1. **During closure analysis**, properly handle the `add_rule` combined pattern
2. **Export the full rule correctly** including both original and bunny requirements
3. **No post-processing needed** - the exported rule is already correct

This is cleaner but requires understanding the closure analysis better.

## Implementation Plan

### Phase 1: Diagnostic - Understand Rule Structure (2-4 hours)

**Goal:** Understand what the exported rules actually look like for failing locations.

**Tasks:**
1. Add logging to capture the full exported access_rule for Library, Superbunny Cave
2. Run seed 850 and examine the rule structure
3. Identify the pattern of bunny rule vs original requirements in the exported JSON
4. Document the structure for each failing location type

**Files:**
- `exporter/games/official/alttp.py` - Add diagnostic logging

### Phase 2: Rule Structure Analysis (4-6 hours)

**Goal:** Create a function to identify bunny rule portions within a combined rule.

**Tasks:**
1. Implement `_identify_bunny_rule_portion(rule)` that returns:
   - The bunny rule portion (Or with Moon Pearl / paths)
   - The non-bunny portions (original requirements)
2. Handle common patterns:
   - `And(original, bunny_rule)` - most common
   - `And(bunny_rule, original)` - order might vary
   - `bunny_rule` alone - no original requirements
   - Nested structures

**Files:**
- `exporter/games/official/alttp.py` - Add `_identify_bunny_rule_portion()`

### Phase 3: Selective Replacement (4-6 hours)

**Goal:** Replace only the bunny rule portion, preserving original requirements.

**Tasks:**
1. Modify `post_process_data` to:
   - Call `_identify_bunny_rule_portion()` on the access rule
   - Extract BunnyPaths from just the bunny portion
   - Reconstruct the rule with BunnyPaths replacing the bunny portion
   - Keep original requirements in the And wrapper
2. Handle edge cases:
   - No original requirements (just bunny rule)
   - Complex nested structures
   - Failed identification (fall back to current behavior or skip)

**Files:**
- `exporter/games/official/alttp.py` - Modify `post_process_data()`

### Phase 4: Testing (4-6 hours)

**Goal:** Verify the fix works for all failing seeds.

**Tasks:**
1. Run fuzzer on seeds 13, 168, 850 to verify fixes
2. Run full 1000-seed fuzzer test
3. Verify no regressions in passing seeds
4. Add unit tests for `_identify_bunny_rule_portion()`

**Files:**
- `tests/exporter/games/test_alttp_bunny_rules.py` - Add tests

## Detailed Design

### `_identify_bunny_rule_portion(rule)`

```python
def _identify_bunny_rule_portion(self, rule: Dict[str, Any]) -> Tuple[Optional[Dict], List[Dict]]:
    """Identify the bunny rule portion within a combined access rule.

    Args:
        rule: The full access rule dict

    Returns:
        Tuple of (bunny_rule_portion, non_bunny_portions)
        - bunny_rule_portion: The Or with Moon Pearl / superbunny paths, or None
        - non_bunny_portions: List of other rule portions to preserve
    """
    # Pattern 1: Direct bunny rule (Or with Moon Pearl option)
    if self._is_bunny_rule(rule):
        return (rule, [])

    # Pattern 2: And(original, bunny_rule) or And(bunny_rule, original)
    if rule.get('type') == 'and' or rule.get('rule') == 'And':
        conditions = rule.get('conditions', rule.get('children', []))
        bunny_portion = None
        non_bunny_portions = []

        for cond in conditions:
            if self._is_bunny_rule(cond):
                bunny_portion = cond
            else:
                non_bunny_portions.append(cond)

        return (bunny_portion, non_bunny_portions)

    # Pattern 3: Can't identify - return None to skip processing
    return (None, [])

def _is_bunny_rule(self, rule: Dict[str, Any]) -> bool:
    """Check if a rule is a bunny rule (Or with Moon Pearl option)."""
    if rule.get('type') != 'or' and rule.get('rule') != 'Or':
        return False

    conditions = rule.get('conditions', rule.get('children', []))

    # Look for Moon Pearl item check as one of the options
    for cond in conditions:
        if self._is_moon_pearl_check(cond):
            return True

    return False

def _is_moon_pearl_check(self, rule: Dict[str, Any]) -> bool:
    """Check if a rule is a Moon Pearl item check."""
    if rule.get('type') == 'item_check':
        return rule.get('item') == 'Moon Pearl'
    if rule.get('rule') == 'Has':
        return rule.get('args', {}).get('item_name') == 'Moon Pearl'
    return False
```

### Modified `post_process_data`

```python
def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
    if not self._is_glitch_mode():
        return super().post_process_data(data)

    for player_id_str, player_regions in data.get('regions', {}).items():
        for region_name, region_data in player_regions.items():
            for loc_data in region_data.get('locations', []):
                loc_name = loc_data.get('name', '')

                if loc_name in SUPERBUNNY_ACCESSIBLE_LOCATIONS:
                    access_rule = loc_data.get('access_rule')
                    if not access_rule:
                        continue

                    # Identify bunny vs non-bunny portions
                    bunny_portion, non_bunny_portions = self._identify_bunny_rule_portion(access_rule)

                    if bunny_portion is None:
                        # Can't identify bunny rule, skip
                        continue

                    # Extract BunnyPaths from the bunny portion
                    bunny_paths = self._extract_bunny_paths_from_rule(bunny_portion, loc_name)

                    if bunny_paths is None:
                        # Extraction failed, skip
                        continue

                    # Reconstruct rule with BunnyPaths replacing bunny portion
                    if non_bunny_portions:
                        # And(original_requirements, BunnyPaths)
                        new_rule = {
                            'rule': 'And',
                            'children': non_bunny_portions + [bunny_paths]
                        }
                    else:
                        # No original requirements, just BunnyPaths
                        new_rule = bunny_paths

                    loc_data['access_rule'] = new_rule

    return super().post_process_data(data)
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pattern identification fails for some rules | Medium | Medium | Fall back to skipping (no BunnyPaths for that location) |
| New rule structure causes codegen issues | Low | High | Test codegen with new structures |
| Performance impact from rule analysis | Low | Low | Analysis is O(n) in rule size |
| Edge cases in nested rules | Medium | Medium | Add comprehensive tests |

## Success Criteria

1. **Seed 850 passes** - Library correctly requires Book of Mudora AND bunny state
2. **Failure rate drops** from 196/1000 to <= 10/1000
3. **No regressions** in previously passing seeds
4. **Code is maintainable** - Clear separation of concerns

## Alternative Approaches Considered

### Alternative 1: Don't Use BunnyPaths at All

**Pros:** Simple, reverts to known state
**Cons:** Doesn't fix the original 3 failures

### Alternative 2: Fix at Closure Analysis Level

**Pros:** Cleaner, no post-processing needed
**Cons:** More complex, requires deep understanding of closure patterns

### Alternative 3: Whitelist Locations Without Original Requirements

**Pros:** Simple implementation
**Cons:** Requires manual maintenance, might miss cases

## Recommended Next Steps

1. **Start with Phase 1** - Add diagnostic logging and examine rule structure
2. **Validate approach** - Check if the rule structure matches expectations
3. **Implement Phase 2-3** - Build the identification and replacement logic
4. **Test thoroughly** - Run full fuzzer suite

## Files to Modify

| File | Changes |
|------|---------|
| `exporter/games/official/alttp.py` | Add `_identify_bunny_rule_portion()`, modify `post_process_data()` |
| `exporter/analyzer/closure_function_analyzer.py` | Remove automatic Moon Pearl fallback addition |
| `tests/exporter/games/test_alttp_bunny_identification.py` | New test file for rule identification |

## References

- `worlds/alttp/Rules.py:1653-1783` - Original `set_bunny_rules()` implementation
- `CC/docs/plans/entrance-aware-bunny-evaluation.md` - Original BunnyPaths plan
- `fuzz_output/error/alttp/850/850.log` - Example failure log
