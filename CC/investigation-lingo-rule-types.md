# Investigation: Lingo Rule Types

## Summary

This investigation analyzed what rule types are needed to support Lingo's helper functions in the Archipelago-CC rule system.

## Current Status: Lingo is WORKING

Lingo's spoiler tests pass because JavaScript implementations already exist for all required helpers in `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`.

## Blacklisted Helpers Analysis

The Lingo exporter (`exporter/games/lingo.py`) blacklists these helpers:

| Helper | Reason Blacklisted | JS Implementation |
|--------|-------------------|-------------------|
| `lingo_can_use_entrance` | NamedTuple attribute access (`door.room`, `door.door`) | ✅ Exists |
| `lingo_can_do_pilgrimage` | `all()` with generator expression | ❌ Not needed (feature disabled) |
| `lingo_can_use_mastery_location` | For loop counting satisfied requirements | ✅ Exists |
| `lingo_can_use_level_2_location` | Side effect: `state.update_reachable_regions()` | ✅ Exists |

## Potential for Auto-Export

### Helpers That COULD Potentially Be Auto-Exported

1. **`lingo_can_do_pilgrimage`**
   ```python
   def lingo_can_do_pilgrimage(state, world):
       return all(_lingo_can_open_door(state, "Sunwarps", f"{i} Sunwarp", world)
                  for i in range(1, 7))
   ```
   - Uses patterns that ARE supported: `all_of`, `for_range`, `f_string`, `helper` calls
   - **Status**: Should be testable - these patterns exist in the rule system

2. **`lingo_can_use_mastery_location`**
   ```python
   def lingo_can_use_mastery_location(state, world):
       satisfied_count = 0
       for access_req in world.player_logic.mastery_reqs:
           if _lingo_can_satisfy_requirements(state, access_req, world):
               satisfied_count += 1
       return satisfied_count >= world.options.mastery_achievements.value
   ```
   - Uses patterns that ARE supported: `block`, `for_iter`, `assign`, `if_statement`, `compare`
   - **Status**: Should be testable - these are imperative block patterns

### Helpers That CANNOT Be Auto-Exported

1. **`lingo_can_use_level_2_location`**
   ```python
   def lingo_can_use_level_2_location(state, world):
       counted_panels = 0
       state.update_reachable_regions(world.player)  # SIDE EFFECT
       for region in state.reachable_regions[world.player]:  # DYNAMIC STATE
           ...
   ```
   - **BLOCKER**: `state.update_reachable_regions()` is a side effect
   - **BLOCKER**: `state.reachable_regions[player]` accesses dynamic runtime state
   - These are fundamentally incompatible with declarative rule evaluation
   - **Status**: Will ALWAYS need JavaScript implementation

2. **`lingo_can_use_entrance`**
   - Uses NamedTuple attribute access on a **function parameter** (not closure variable)
   - The analyzer can resolve attributes when the NamedTuple is in `closure_vars`, but not when it's a parameter
   - **Workaround in place**: Exporter converts door to array `[room, door]`
   - **Status**: Works with current workaround, but true NamedTuple parameter support would require enhancement

## Recommendations for Next Steps

### Option A: Keep Current Approach (Recommended for now)
The current approach works well:
- JavaScript implementations handle complex helpers
- Spoiler tests pass
- No new rule types needed

### Option B: Attempt Auto-Export (Future Enhancement)

If we want to reduce JavaScript helper implementations:

1. **Test `lingo_can_do_pilgrimage`**:
   - Remove from blacklist
   - Add to `HELPERS_TO_EXPORT_WHITELIST`
   - Generate and test

2. **Test `lingo_can_use_mastery_location`**:
   - Remove from blacklist
   - Add to `HELPERS_TO_EXPORT_WHITELIST`
   - Generate and test

3. **If issues found**: Document specific rule types that need enhancement

### Option C: Implement Missing Rule Type

If NamedTuple parameter attribute access is a common pattern across games:
- Enhance `visit_Attribute` to handle NamedTuple parameters by:
  - Detecting NamedTuple type hints on function parameters
  - Generating appropriate subscript access rules

## Files Reviewed

- `/home/user/Archipelago-CC/worlds/lingo/rules.py` - Original Python helpers
- `/home/user/Archipelago-CC/exporter/games/lingo.py` - Lingo exporter with blacklist
- `/home/user/Archipelago-CC/frontend/modules/shared/gameLogic/lingo/lingoLogic.js` - JS implementations
- `/home/user/Archipelago-CC/exporter/analyzer/ast_visitors.py` - AST visitor patterns
- `/home/user/Archipelago-CC/docs/json/developer/reference/rule-types-reference.md` - Rule type catalog

## Conclusion

**No new rule types are strictly needed for Lingo** because:
1. JavaScript implementations exist and work
2. The patterns used ARE mostly supported in the rule system
3. The one unsupported pattern (`state.update_reachable_regions()`) is fundamentally a side effect that can't be declaratively represented

The blacklisting appears to be precautionary rather than due to missing rule types. Testing whether `lingo_can_do_pilgrimage` and `lingo_can_use_mastery_location` can be auto-exported would be a worthwhile future experiment.
