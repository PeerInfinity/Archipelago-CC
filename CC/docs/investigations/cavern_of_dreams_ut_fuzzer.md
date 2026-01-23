# Cavern of Dreams - UT Fuzzer Investigation

**Date:** 2026-01-23
**APWorld Version:** v0-beta.10.3
**Source:** https://github.com/wu4/Archipelago/releases/download/v0-beta.10.3/cavern_of_dreams.apworld
**Status:** Fundamental Incompatibility

## Summary

The Cavern of Dreams apworld uses a custom class architecture with a "carryable" system that is fundamentally incompatible with the rule exporter and Universal Tracker (UT). The fuzzer fails with 100% failure rate because almost all rules export as `null`, causing massive logic mismatches between UT and the server.

## Failure Details

**Fuzzer Results:**
- Total runs: 10
- Success: 0 (0.0%)
- Failures: 8
- Timeouts: 0
- Ignored: 2
- Error type: `None` (logic mismatch)

**Exported Rules:**
- Total exits: 575 (only 11 have non-null rules)
- Total locations: 519 (only 1 has a non-null rule)
- ~98% of rules export as `null`

## Root Cause Analysis

### The Carryable System Architecture

The Cavern of Dreams apworld implements a sophisticated "carryable item" system:

1. **Custom Classes**: `CavernOfDreamsLocation` and `CavernOfDreamsEntrance` extend the base Archipelago classes.

2. **Fixed Class Method**: Instead of using individual lambda functions, `access_rule` is defined as a `@final` class method:
   ```python
   @final
   def access_rule(self, state: CollectionState) -> bool:
       if self.item is not None and isinstance(self.item, CavernOfDreamsCarryable) and self.item.carryable != "Jester Boots":
           if not state.has("Carry", self.player): return False
       return CarryableTestResult.SUCCESS in check_any_access(self, state)
   ```

3. **Rule Storage**: Actual rules are stored in multiple dictionaries:
   - `dont_care_access_rule` - Rule that works regardless of what you're carrying
   - `carryable_access_rules` - Dict mapping carryable item (or None) to rule lambda
   - `inverse_carryable_access_rules` - Rules for when NOT carrying specific items

4. **Dynamic Rule Construction**: Rules are built at runtime using `construct_rule()`:
   ```python
   def construct_rule(player, rules, should_print=False):
       rules_str = " or ".join(f"({rule_str})" for condition, rule_str in rules if condition)
       if rules_str == "":
           rules_str = "False"
       return eval(f"lambda s:{rules_str}", {"p": player})
   ```

### Why the Exporter Fails

1. **Source Extraction Error**: When the exporter tries to get the source of `access_rule`, it gets the class method body, which causes `IndentationError: unexpected indent` because the method is indented within the class definition.

2. **Wrong Location**: Even if source extraction worked, the actual rules aren't in `access_rule` - they're in the `carryable_access_rules`, `inverse_carryable_access_rules`, and `dont_care_access_rule` attributes.

3. **Dynamic eval'd Lambdas**: The lambdas created by `construct_rule()` using `eval()` cannot be introspected properly - they don't have source code that can be extracted.

4. **Option-Dependent Rules**: Rules are constructed based on option values at world creation time. The condition tuples like `((o.split_tail.value == 1), "...")` filter rules before combining.

### Game Design Context

The carryable system exists because in Cavern of Dreams, the player can pick up and carry items like:
- Jester Boots (allow different movement options)
- Mr. Kerrington's Wings (enable flight)

Different areas have different accessibility depending on what you're carrying. This is fundamentally different from standard Archipelago rules where accessibility depends only on items in your inventory.

## Potential Solutions

### Option 1: Custom Exporter (High Effort)

Write a custom game handler for Cavern of Dreams that:
1. Recognizes the custom Location/Entrance classes
2. Extracts rules from `carryable_access_rules`, `inverse_carryable_access_rules`, and `dont_care_access_rule`
3. Combines them into a unified rule representation
4. Handles the carryable state tracking in the tracker

**Challenges:**
- Would need to model the carryable state machine
- Complex interaction between carryable-specific and dont_care rules
- UT would need to understand carryable items as a separate concept from inventory

### Option 2: APWorld Maintainer Update (Preferred)

Request the apworld maintainer to:
1. Provide rules in a more standard format
2. Or expose a way to get flattened rules for a given option set
3. Or provide a JSON export of rules separate from the apworld

### Option 3: Add to Incompatible List

Document this apworld as incompatible with UT due to its custom rule architecture.

## Recommendation

**Short-term:** Add Cavern of Dreams to a known-incompatible list for UT fuzzer testing.

**Long-term:** This would require either:
- A dedicated exporter that understands the carryable system (significant development effort)
- Coordination with the apworld maintainer to expose rules in a compatible format

The carryable system is a legitimate game mechanic, but it represents a pattern that goes beyond what the current exporter architecture can handle. Supporting it would require substantial changes to both the exporter and the tracker.

## Files Examined

- `custom_worlds/cavern_of_dreams.apworld`
  - `cavern_of_dreams/regions.py` - Custom Location/Entrance classes
  - `cavern_of_dreams/carryables.py` - Carryable system implementation
  - `cavern_of_dreams/generated_helpers.py` - `construct_rule()` function
  - `cavern_of_dreams/ap_generated/regions.py` - 7472 lines of generated region/rule setup

## Error Log Sample

```
  File "<unknown>", line 2
    def access_rule(self, state: CollectionState) -> bool:
IndentationError: unexpected indent
Failed to analyze or expand rule for Exit 'CAVE.SunCavern.VineLedge->CAVE.SunCavern.Main' using runtime analysis.
```

This error occurs because `inspect.getsource()` on the class method includes the `@final` decorator and the method is indented as part of a class definition.
