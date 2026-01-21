# UT Fuzzer Analysis: An Untitled Story (aus)

## Summary

**Game**: An Untitled Story
**APWorld Source**: https://github.com/ThatOneGuy27/Archipelago-aus
**Version**: v1.1-beta
**Failure Rate**: 100% (10/10 runs failed)
**Error Type**: `None` (logic mismatch - NameError during rule evaluation)

## Root Cause

The UT fuzzer fails because helper functions referenced in the exported rules are not defined in the generated worldgen code.

### Technical Details

1. **Helper Functions Defined in Class**: The apworld defines helper functions as methods of the `AUSRules` class in `Rules.py`:
   ```python
   class AUSRules:
       def can_divebomb(self, state: CollectionState) -> bool:
           return state.has(I_DIVE_BOMB, self.player)

       def jump_height(self, state: CollectionState) -> int:
           count = state.count(I_JUMP_UPGRADE, self.player) + state.count(I_DOUBLE_JUMP, self.player) + 2
           return count

       def hatched(self, state: CollectionState) -> bool:
           return state.has(I_HATCH, self.player)
       # ... and many more
   ```

2. **Rules Reference Helpers**: The region/location rules reference these helper methods:
   ```python
   A_DEEPDIVE: lambda state: self.jump_height(state) + (self.can_duck(state) and self.has_red_energy(state)) * 2 >= 8 and
                             self.hatched(state) and self.can_divebomb(state)
   ```

3. **Exporter Identifies Helpers**: The exporter correctly identifies these as helper function calls and exports them with `_original_ast_type: "helper"` or `AST_capability` markers.

4. **No Helper Bodies Exported**: The `helpers` section in the exported JSON is **empty** because:
   - No game-specific handler exists for `aus`
   - The generic handler can't discover methods defined on a class (`AUSRules`)
   - Helper discovery only searches module-level functions and the World class

5. **World Generator Falls Back to Lambdas**: Without helper body definitions, the world generator falls back to generating raw lambda expressions that reference the undefined helper functions:
   ```python
   # Generated Rules.py line 30:
   lambda state: ((can_divebomb(state, player)) and ...)
   # But can_divebomb is never defined!
   ```

6. **Runtime NameError**: When the UT runs, it hits:
   ```
   NameError: name 'can_divebomb' is not defined
   ```

## Helper Functions Used by aus

The apworld uses 18+ helper functions on `AUSRules`:

| Helper | Returns | Description |
|--------|---------|-------------|
| `jump_height` | int | Total jump height from upgrades |
| `jump_height_min` | bool | Jump height >= threshold |
| `single_jump_min` | bool | Single jump upgrades >= threshold |
| `double_jump_height` | int | Double jump upgrade count |
| `double_jump_min` | bool | Double jump upgrades >= threshold |
| `has_red_energy` | bool | Has Red Energy item |
| `has_yellow_energy` | bool | Has Yellow Energy item |
| `can_duck` | bool | Has Ducking item |
| `can_stick` | bool | Has 1+ Sticking item |
| `can_slide` | bool | Has 2+ Sticking items |
| `can_divebomb` | bool | Has Dive Bomb item |
| `has_fire` | bool | Has Fire Shot item |
| `has_range` | bool | Has 2+ Fire Shot items |
| `has_ice` | bool | Has Ice Shot item |
| `can_shoot` | bool | Has fire OR ice shot |
| `can_light_torches` | bool | Can fire OR divebomb |
| `hatched` | bool | Has Hatch item |
| `total_money` | bool | Has enough crystal drops |

## Possible Solutions

### Option 1: Create Game-Specific Handler (Recommended)

Create `exporter/games/aus.py` with:
1. Manual helper definitions
2. `HELPERS_TO_EXPORT_WHITELIST` listing all helpers
3. Helper body definitions matching the original class methods

**Pros**: Clean solution, full control
**Cons**: Requires manual maintenance if apworld updates

### Option 2: Enhance Generic Handler

Modify `exporter/games/base/helper_discovery.py` to:
1. Detect Rules classes with method-based helpers
2. Analyze class methods that match the helper pattern
3. Export helper bodies from class method definitions

**Pros**: Works for all similar apworlds
**Cons**: Complex to implement, may not handle all patterns

### Option 3: Report to APWorld Maintainer

The apworld could be refactored to:
1. Define helpers as module-level functions instead of class methods
2. Follow patterns more compatible with the exporter

**Pros**: Fixes at source
**Cons**: Depends on maintainer response

### Option 4: Add to Known-Incompatible List

Add `aus` to a list of apworlds known to be incompatible with UT fuzzer.

**Pros**: Simple
**Cons**: Doesn't fix the issue, just documents it

## Recommendation

**Short-term**: Add to known-incompatible list with this documentation.

**Medium-term**: Create a game-specific handler (`exporter/games/aus.py`) that manually defines the helper functions. This is feasible since:
- The helpers are straightforward (mostly item checks and counts)
- The helper logic is stable (v1.1-beta)
- Similar handlers exist for other games (e.g., `overcooked2.py`)

## Files Analyzed

- `custom_worlds/aus.apworld` - The apworld package
- `aus/Rules.py` - Helper definitions in `AUSRules` class
- `aus/__init__.py` - World class definition
- `frontend/presets/an_untitled_story/AP_*/AP_*_rules.json` - Empty `helpers` section

## Test Commands

```bash
# Reproduce failure
python fuzz.py -r 1 -j 1 -g aus -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0

# View error log
cat fuzz_output/error/aus/0/0.log
```

---
*Analysis date: 2026-01-21*
*Archipelago version: 0.6.5*
