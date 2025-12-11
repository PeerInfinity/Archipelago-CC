# Kingdom Hearts 2 Rule Types Investigation

## Summary

This document summarizes the investigation into what rule types are needed to support KH2 helper functions in the Archipelago-CC frontend.

## Current State

### What's Working

1. **Simple unlock helpers** are exported as JSON rule definitions:
   - `ag_unlocked`, `bc_unlocked`, `dc_unlocked`, `hb_unlocked`, `ht_unlocked`, `lod_unlocked`, `oc_unlocked`, `pl_unlocked`, `pr_unlocked`, `sp_unlocked`, `stt_unlocked`, `tt_unlocked`, `twtnw_unlocked`
   - `at_three_unlocked`, `at_four_unlocked`, `hundred_acre_unlocked`

2. **Complex helpers** are blacklisted from JSON export but have **JavaScript fallback implementations** in `frontend/modules/shared/gameLogic/kh2/kh2Logic.js`:
   - `form_list_unlock` - Form access with AutoFormLogic support
   - `get_form_level_requirement` - Counts available forms
   - `level_locking_unlock` - Visit locking with Promise Charm check
   - `final_form_region_access` - Can reach leveling locations
   - All 60+ fight rule helpers (e.g., `get_data_xigbar_rules`, `get_shan_yu_rules`)
   - `kh2_list_any_sum` - Counts categories with items
   - `kh2_dict_count` - Checks item counts against dict requirements

3. **Spoiler tests pass** because the JavaScript fallback system works correctly.

### What's Missing

Three helpers are referenced in the exported rules but have no JavaScript implementation:

| Helper | Python Implementation | Priority |
|--------|----------------------|----------|
| `get_grim_reaper1_rules` | `return True` (static) | Low - trivial |
| `get_grim_reaper2_rules` | Uses `kh2_list_any_sum` | Medium |
| `kh2_has_all` | Wraps `state.has_all(items, player)` | High - used in goal checks |

## Recommended Next Steps

### Option A: Quick Fix - Add Missing JavaScript Implementations

Add the 3 missing helpers to `frontend/modules/shared/gameLogic/kh2/kh2Logic.js`:

```javascript
// 1. get_grim_reaper1_rules - trivial
get_grim_reaper1_rules() {
  return true;
},

// 2. get_grim_reaper2_rules - uses existing kh2_list_any_sum
get_grim_reaper2_rules(snapshot, staticData) {
  const playerSlot = snapshot?.player?.id || snapshot?.player?.slot || 1;
  const settings = staticData?.settings?.[playerSlot] || {};
  const fightLogic = settings.FightLogic ?? 'normal';

  const defensiveTool = ['Reflect Element', 'Guard'];
  const blackMagic = ['Fire Element', 'Blizzard Element', 'Thunder Element'];

  switch (fightLogic) {
    case 'easy':
      return helperFunctions.kh2_list_any_sum(
        [defensiveTool, ['Master Form', 'Thunder Element']], snapshot) >= 2;
    case 'normal':
      return helperFunctions.kh2_list_any_sum(
        [defensiveTool, ['Master Form', 'Stitch'], ['Thunder Element']], snapshot) >= 3;
    case 'hard':
      return helperFunctions.kh2_list_any_sum([blackMagic, defensiveTool], snapshot) >= 2;
    default:
      return true;
  }
},

// 3. kh2_has_all - check if player has all items
kh2_has_all(items, snapshot) {
  if (!snapshot?.inventory) return false;
  return items.every(item => snapshot.inventory[item] > 0);
},
```

**Pros:** Fast, minimal changes, maintains existing approach
**Cons:** Continues dual Python/JavaScript implementation pattern

### Option B: Implement New Rule Types (Long-term Solution)

To export blacklisted helpers as JSON rule definitions, implement support for these Python patterns:

#### 1. Dict Key Access Pattern
**Python:** `rules[self.fight_logic]`
**Needed:** Support for subscript access on dict literals with dynamic keys (setting values)

#### 2. List Comprehension with Sum
**Python:** `sum([1 for items in list_of_lists if state.has_any(items, player)])`
**Current:** `kh2_list_any_sum` is implemented in JavaScript
**Alternative:** Could be exported as `for_iter` + conditional increment + `return`

#### 3. Instance Attribute Access
**Python:** `self.player`, `self.world.options.FightLogic`
**Needed:** Pattern detection for `self.world.options.X` to convert to `setting_value` rule type

#### 4. All/Any with Generator
**Python:** `all([state.has(item, player, count) for item, count in dict.items()])`
**Current:** Partially supported via `all_of` type
**Needed:** Better support for dict iteration with tuple unpacking

### Priority Recommendation

1. **Immediate:** Implement Option A (add 3 missing JavaScript helpers)
2. **Future:** Consider Option B for maintainability if more games need similar patterns

## KH2 Blacklisted Helpers Reference

The following helpers in `exporter/games/kh2.py` are blacklisted with their reasons:

| Helper | Reason |
|--------|--------|
| `form_list_unlock` | Conditional logic based on AutoFormLogic setting |
| `get_form_level_requirement` | Loops counting forms with FinalFormLogic checks |
| `level_locking_unlock` | Sum over visit_locking_dict list |
| `summon_levels_unlocked` | Sum over summons list |
| `kh2_list_count_sum` | List comprehension with sum |
| `kh2_list_any_sum` | List comprehension with sum and has_any |
| `kh2_dict_count` | Dict comprehension with all() |
| `kh2_dict_one_count` | Dict comprehension with sum |
| `kh2_has_all` | Wraps state.has_all |
| `kh2_has_any` | Wraps state.has_any |
| `kh2_can_reach` | Uses multiworld.get_location |
| `kh2_can_reach_any` | Loop over locations |
| `kh2_can_reach_all` | Loop over locations |
| `final_form_region_access` | Uses any() over location.can_reach |
| `get_*_rules` (60+) | Reference self.fight_logic and use dict key access |

## Files Modified/Created

- **Investigation only** - no changes made yet
- This document: `CC/kh2-rule-types-investigation.md`

## Testing

To verify KH2 rules work correctly:

```bash
# Generate KH2 multiworld
python Generate.py --weights_file_path "Templates/Kingdom Hearts 2.yaml" --multi 1 --seed 1

# Run spoiler test
npm test -- --mode=test-spoilers --game=kh2 --seed=1
```

Current status: **Tests pass** (using JavaScript fallbacks for complex helpers)
