# Kingdom Hearts Birth by Sleep (KHBBS) Fuzzer Failure Analysis

**Date**: 2026-01-14
**APWorld**: khbbs v0.1.7
**Game Name**: Kingdom Hearts Birth by Sleep
**Test Status**: 10/10 failures (0% pass rate)
**Error Type**: None (logic mismatch)

## Executive Summary

The KHBBS apworld fails the Universal Tracker (UT) fuzzer test due to logic mismatches between the server and UT. The specific root cause could not be confirmed due to network restrictions preventing apworld download, but code analysis revealed several likely causes.

## Network Restrictions

**IMPORTANT**: This cloud environment blocks external downloads from GitHub. The apworld could not be downloaded via:
- `curl` (403 Forbidden)
- Python `urllib` (403 Forbidden via proxy)
- Direct WebFetch (403 Forbidden)

To continue this investigation, the apworld must be:
1. Downloaded locally and uploaded manually
2. Made available through an unblocked source
3. Pre-cached in the environment

## Code Analysis

### KHBBS Rules.py Key Patterns

Based on the source code at `github.com/gaithernOrg/ArchipelagoKHBBS/worlds/khbbs/Rules.py`:

#### 1. Helper Functions Using `has_from_list_unique`

```python
def has_x_worlds(state: CollectionState, player: int, num_of_worlds: int) -> bool:
    return state.has_from_list_unique(WORLDS, player, num_of_worlds)

def has_x_clearable_worlds(state: CollectionState, player: int, num_of_worlds: int, minigames: bool) -> bool:
    if minigames:
        return state.has_from_list_unique(CLEARABLE_WORLDS, player, num_of_worlds)
    else:
        return state.has_from_list_unique(CLEARABLE_WORLDS_NO_DT, player, num_of_worlds)
```

These helpers use `state.has_from_list_unique()`, which IS properly supported in the rule builder.

#### 2. Option-Dependent Rules

```python
add_rule(khbbsworld.get_location("..."),
    lambda state: (
        has_fire(state, player, minigames)
        or (state.has("High Jump", player) and can_airslide(state, player))
        or options.advanced_logic  # Direct option reference in lambda
    ))
```

The rules capture `options.advanced_logic` from the closure, which may not export correctly.

#### 3. Conditional Logic Based on Options

```python
def has_thunder(state: CollectionState, player: int, minigames: bool) -> bool:
    return state.has("Thunder", player) or has_x_clearable_worlds(state, player, 2, minigames)
```

The `minigames` boolean is captured from the option at rule creation time, then passed to helpers.

### Potential Issues

1. **Helper Function Analysis**
   - The helpers `has_x_worlds` and `has_x_clearable_worlds` should be auto-discovered and exported
   - The `minigames` parameter creates conditional logic that may not export correctly
   - If exported as helper references instead of expanded rules, the tracker may not evaluate them correctly

2. **Option References in Lambdas**
   - Direct references like `options.advanced_logic` in lambda bodies may not export correctly
   - These become closure captures that the analyzer may not resolve

3. **World Lists as Constants**
   - `WORLDS`, `CLEARABLE_WORLDS`, `CLEARABLE_WORLDS_NO_DT` are module-level constants
   - If not properly resolved during export, they may appear as undefined references

## Supported Infrastructure

The infrastructure properly supports:
- `HasFromListUnique` rule type in rule_builder
- `has_from_list_unique` state method in exporter converter
- `has_from_list_unique` in frontend ruleEngine
- State method support in stateInterface.js

## Recommended Investigation Steps

Once the apworld is available:

1. **Run Single Fuzzer Test**
   ```bash
   source .venv/bin/activate
   python fuzz.py -r 1 -j 1 -g khbbs -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0
   ```

2. **Check Generated Rules JSON**
   Look at `frontend/presets/khbbs/AP_*/AP_*_rules.json` for:
   - How helper functions are exported
   - If world lists are properly inlined
   - If option-dependent logic is correctly represented

3. **Compare Specific Locations**
   The fuzzer log will show which locations disagree. Check:
   - The original rule in Rules.py
   - The exported rule in rules.json
   - The evaluated result in UT vs server

## Potential Fixes

### Option 1: Create KHBBS Game Handler

Create `exporter/games/khbbs.py`:

```python
class KHBBSGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Kingdom Hearts Birth by Sleep'

    # Inject world lists into closure vars
    CLOSURE_VAR_IMPORTS = {
        'worlds.khbbs.Rules': ['WORLDS', 'CLEARABLE_WORLDS', 'CLEARABLE_WORLDS_NO_DT'],
    }

    # Handle option-dependent helpers
    HELPERS_TO_EXPORT_BLACKLIST = {
        'has_x_clearable_worlds',  # Needs special handling
    }

    def expand_helper(self, helper_name: str, args=None):
        if helper_name == 'has_x_clearable_worlds':
            # Expand based on minigames option
            return self._expand_clearable_worlds_helper(args)
        return super().expand_helper(helper_name, args)
```

### Option 2: Fix Auto-Export for Conditional Helpers

The generic handler might need enhancement to handle helpers with boolean parameters that select different item lists.

### Option 3: Mark as Known Incompatible

If the fix is complex, add KHBBS to a known-incompatible list with documentation of why.

## Related Files

- `worlds/khbbs/` - APWorld source (from github.com/gaithernOrg/ArchipelagoKHBBS)
- `exporter/games/generic.py` - Generic game handler
- `rule_builder/rules.py` - Rule implementations
- `frontend/modules/shared/ruleEngine.js` - Rule evaluation

## Next Steps

1. **Manual apworld installation** - Download locally and transfer to environment
2. **Reproduce failure** - Run fuzzer to get specific mismatch details
3. **Analyze exported rules** - Compare rules.json to original Rules.py
4. **Implement fix** - Create game handler or fix generic handler
5. **Validate** - Run fuzzer again to confirm fix
