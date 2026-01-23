# Stacklands APWorld UT Fuzzer Analysis

## Summary

The Stacklands apworld (v0.2.3-alpha) fails the Universal Tracker (UT) fuzzer test with 100% failure rate (10/10 runs). This is due to **fundamental incompatibility** between the apworld's rule structure and the rule exporter's capabilities.

## Root Cause

The Stacklands apworld uses a custom `StacklandsLogic` mixin class with helper methods (prefixed with `sl_`) that the rule exporter cannot analyze or expand.

### Affected Helper Methods

| Method | Translates To | Usage Count |
|--------|--------------|-------------|
| `sl_has_pack(name, player)` | `has("name Booster Pack", player)` | 71 |
| `sl_has_idea(name, player)` | `has("Idea: name", player)` | 63 |
| `sl_has_all_ideas([...], player)` | `has_all({...}, player)` | 63 |
| `sl_has_all_packs([...], player)` | `has_all({...}, player)` | 10 |
| `sl_has_any_packs([...], player)` | `has_any({...}, player)` | 15 |
| `sl_has_any_ideas([...], player)` | `has_any({...}, player)` | 6 |
| `sl_mainland_board_capacity(options, player)` | Complex option-dependent logic | 8 |
| `sl_island_board_capacity(options, player)` | Complex option-dependent logic | 11 |
| `sl_can_reach_all_quests([...], player)` | `all(can_reach_location(q) for q in quests)` | 10 |
| `sl_can_reach_any_quests([...], player)` | `any(can_reach_location(q) for q in quests)` | 5 |

### Additional Issues

1. **Captured closure variables**: Rules use `forest_enabled` and `island_enabled` variables computed from options at runtime
2. **Option-dependent board capacity**: The `sl_*_board_capacity` methods use conditional expressions based on `options.board_expansion_mode.value`
3. **Missing archipelago.json manifest**: The apworld lacks the manifest file required for Archipelago 0.7.0

## Technical Details

### Export Statistics

- Total rules exported: 108
- Rules with `null` access_rule: 106 (98.1%)
- Rules with non-null access_rule: 2 (1.9%)

### Why Exporter Fails

The exporter's call visitor (`exporter/analyzer/ast_visitors/call_visitor.py`) only recognizes specific state methods:
- `has`, `has_all`, `has_any`, `has_from_list`
- `can_reach`, `can_reach_location`
- `count`, `count_group`, `has_group`
- Methods starting with `_` (via `STATE_METHOD_REPLACEMENTS`)

The Stacklands `sl_*` methods are not recognized because:
1. They don't start with `_` (required for auto-detection by `logic_mixin_analyzer.py`)
2. They're not in the hardcoded list of known state methods
3. The AST analyzer cannot trace method calls back to their implementations in the mixin class

### Failure Manifestation

When rules cannot be exported, they become `null` in the rules JSON. The worldgen-based tracker then treats all `null` rules as `True` (always accessible), causing a massive logic mismatch:

```
Locations Buy the Humble Beginnings Pack,Kill a Mosquito,Harvest a Tree...
were expected to be in logic but weren't
Server logic sphere: Open the Booster Pack,Drag the Villager...(5 locations)
UT accessible regions: ALL 13 REGIONS (immediately accessible)
```

## Possible Solutions

### Option A: Create Stacklands Exporter Handler (Partial Fix)

A game-specific handler was created at `exporter/games/unofficial/stacklands.py` but it cannot fully solve the problem because:
- The handler is invoked AFTER AST parsing fails
- The `sl_*` methods fail during initial rule analysis, not during expansion
- The exporter needs to recognize these method calls at the AST level

### Option B: Modify APWorld (Recommended for Maintainer)

The apworld maintainer could modify the rules to be compatible:

1. **Rename helpers to use underscore prefix**:
   ```python
   # Change from:
   def sl_has_pack(self, name, player)
   # To:
   def _stacklands_has_pack(self, name, player)
   ```

2. **Use inline Rule Builder syntax** in set_rules:
   ```python
   # Instead of:
   lambda state: state.sl_has_pack("Humble Beginnings", player)
   # Use:
   lambda state: state.has("Humble Beginnings Booster Pack", player)
   ```

3. **Simplify board capacity logic** or use static rules

### Option C: Extend Exporter (Complex)

The exporter would need significant modifications:
1. Add support for arbitrary state method replacements (not just `_` prefixed)
2. Teach the call visitor to recognize and expand custom mixin methods
3. Handle closure variable capture from options

### Option D: Add to Known-Incompatible List

Document that Stacklands is incompatible with UT tracking until the apworld is updated.

## Recommendation

**Short-term**: Add Stacklands to a known-incompatible apworld list in the fuzzer configuration.

**Long-term**: Report to the apworld maintainer (JammyGeeza) that the rule structure is incompatible with Universal Tracker and suggest:
1. Using inline `has()`/`has_all()`/`has_any()` calls instead of wrapper methods
2. Renaming helper methods to use `_stacklands_` prefix if wrappers are needed
3. Simplifying or documenting the board capacity logic

## Files Created

- `exporter/games/unofficial/stacklands.py` - Partial exporter handler (provides infrastructure for future improvements)
- `fuzz_output/stacklands_analysis.md` - This analysis document

## Test Commands

```bash
# Run single fuzzer test
python fuzz.py -r 1 -j 1 -g stacklands -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0

# Run multiple tests
python fuzz.py -r 10 -j 4 -g stacklands -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Check export statistics
python -c "
import json
with open('frontend/presets/stacklands/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    rules = json.load(f)
null_count = sum(1 for r in rules['regions']['1'].values()
                 for loc in r.get('locations', []) + r.get('exits', [])
                 if loc.get('access_rule') is None)
print(f'Null rules: {null_count}')
"
```

## APWorld Information

- **Game**: Stacklands
- **Version**: v0.2.3-alpha
- **Author**: JammyGeeza
- **Download**: https://github.com/JammyGeeza/Stacklands-Randomizer/releases/download/v0.2.3-alpha/stacklands.apworld
- **Items**: 123
- **Locations**: 241
