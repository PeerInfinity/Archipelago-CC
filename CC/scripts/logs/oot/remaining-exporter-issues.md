# Ocarina of Time - Remaining Exporter Issues

Status: Root cause identified

## Primary Issue: Missing Access Rules

**Problem:** 1204 locations and 593 exits have `access_rule: None` in the generated rules.json file.

**Root Cause:** OOT uses a custom RuleParser (`Rule_AST_Transformer`) that dynamically generates lambda functions from rule strings. These lambdas are created from '<string>' (not from actual files), so the analyzer cannot retrieve their source code using `inspect.getsource()`.

**Impact:** When access rules are None, the StateManager treats all locations as immediately accessible, causing massive test failures (e.g., making ~500+ locations accessible in Sphere 0 when only ~50 should be).

**Evidence:**
- Generation errors show: "Failed to get multiline lambda source: [Errno 2] No such file or directory: '<string>'"
- Spoiler test shows: "Locations accessible in STATE but NOT in LOG: KF Bean Platform Green Rupee 1, ..." (hundreds of locations)
- All problematic locations have the same issue - the exporter can't analyze their dynamically-generated rules

**Solution Approach:** OOT stores the original rule strings in `location.rule_string` attribute (before they're converted to lambdas). The OOT exporter needs to implement `override_rule_analysis()` to use these rule strings instead of trying to analyze the lambda functions.

## Implementation Plan

The fix requires implementing a rule string parser in `exporter/games/oot.py`:

1. **Add `override_rule_analysis()` method** that checks for `rule_string` attribute
2. **Parse OOT's custom DSL** (e.g., "is_adult and (here(can_plant_bean) or Hover_Boots)")
3. **Convert to JSON format** that the frontend expects
4. **Handle OOT-specific constructs**:
   - Age checks: `is_adult`, `is_child`
   - Item checks: `Kokiri_Sword`, `Deku_Shield` (with underscores)
   - Helpers: `can_play()`, `here()`, `can_summon_gossip_fairy_without_suns`, etc.
   - Logic operators: `and`, `or`, `not`
   - Event references: `'Showed Mido Sword & Shield'` (in quotes)
   - Time of day: `at_night`, `at_day`
   - Setting checks: `open_forest == 'open'`

**Alternative approach:** Leverage OOT's existing `Rule_AST_Transformer` to parse the rule string into an AST, then convert the AST to JSON format. This avoids duplicating the parser logic.
