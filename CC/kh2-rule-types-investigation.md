# Kingdom Hearts 2 Rule Types Investigation

## Summary

This document summarizes the investigation into what rule types are needed to support KH2 helper functions in the Archipelago-CC frontend, and the implementation progress.

## Implementation Status

### Completed (Option B - New Rule Types)

The following new rule types and patterns have been implemented:

#### 1. `self.player` Pattern → `player_id` Rule Type
- **Files modified:**
  - `exporter/analyzer/ast_visitors.py` - Added pattern detection for `self.player`
  - `frontend/modules/shared/ruleEngine.js` - Added `player_id` case handler
- **Usage:** Converts `self.player` in Python helpers to a `player_id` rule that returns the current player ID

#### 2. `self.<attr>` → `setting_value` Mapping
- **Files modified:**
  - `exporter/analyzer/ast_visitors.py` - Added pattern detection via `SELF_ATTR_TO_SETTING`
  - `exporter/games/kh2.py` - Added `SELF_ATTR_TO_SETTING = {'fight_logic': 'FightLogic'}`
- **Usage:** Converts `self.fight_logic` to `{'type': 'setting_value', 'setting': 'FightLogic'}`

#### 3. Dict Subscript with Rule Values
- **Files modified:**
  - `frontend/modules/shared/ruleEngine.js` - Added recursive evaluation in `subscript` case
- **Usage:** When `dict[setting_value]` returns a rule object, it's automatically evaluated

#### 4. Python Built-in Functions (`set`, `list`)
- **Files modified:**
  - `frontend/modules/shared/ruleEngine.js` - Added `set` and `list` helper handlers
- **Usage:** Handles `set(items)` in helpers like `state.has_all(set(items), player)`

### Helpers Now Exportable as JSON

| Helper | Status | Notes |
|--------|--------|-------|
| `kh2_has_all` | ✅ Exported | Uses `self.player` → `player_id` |
| `kh2_has_any` | ✅ Exported | Uses `self.player` → `player_id` |
| `get_beast_rules` | ✅ Expanded | Expanded to `constant: true` |
| `get_grim_reaper1_rules` | ✅ Expanded | Expanded to `constant: true` |
| `get_old_pete_rules` | ✅ Expanded | Expanded to `constant: true` |
| `get_oogie_rules` | ✅ Expanded | Expanded to `constant: true` |
| `get_axel_one_rules` | ✅ Expanded | Expanded to `constant: true` |
| `get_axel_two_rules` | ✅ Expanded | Expanded to `constant: true` |
| `get_twilight_thorn_rules` | ✅ Expanded | Expanded to `constant: true` |

### Helpers Still Using JavaScript Fallbacks

These helpers are still blacklisted due to complex patterns not yet supported:

| Helper | Reason | Pattern Needed |
|--------|--------|----------------|
| `form_list_unlock` | Conditional logic based on AutoFormLogic | Setting-based conditional branches |
| `get_form_level_requirement` | Loops counting forms | Loop with counter |
| `level_locking_unlock` | Sum over list | List sum pattern |
| `kh2_list_count_sum` | List comprehension with sum | Generator with sum |
| `kh2_list_any_sum` | List comprehension with has_any | Generator with any() |
| `kh2_dict_count` | Dict comprehension with all() | Dict iteration with all() |
| `kh2_dict_one_count` | Dict comprehension with sum | Dict iteration with sum |
| `get_*_rules` (60+) | Uses `kh2_list_any_sum` | Depends on above |

## Files Modified

### Python (Exporter)
- `exporter/analyzer/ast_visitors.py`
  - Added `self.player` → `player_id` pattern detection
  - Added `self.<attr>` → `setting_value` via `SELF_ATTR_TO_SETTING` lookup

- `exporter/games/kh2.py`
  - Added `SELF_ATTR_TO_SETTING = {'fight_logic': 'FightLogic'}`
  - Removed `kh2_has_all`, `kh2_has_any` from blacklist
  - Added static method helpers to `helper_map` for inline expansion

### JavaScript (Frontend)
- `frontend/modules/shared/ruleEngine.js`
  - Added `player_id` rule type handler
  - Added `set` and `list` built-in function handlers
  - Added recursive rule evaluation in `subscript` case for rule objects

## Testing

```bash
# Generate KH2 multiworld
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/Kingdom Hearts 2.yaml" --multi 1 --seed 1

# Run spoiler test
npm test -- --mode=test-spoilers --game=kh2 --seed=1
```

Current status: **Tests pass** ✅

## Future Work

To enable more KH2 helpers to be exported as JSON (instead of requiring JavaScript fallbacks):

1. **Sum with Generator Pattern** - For `kh2_list_any_sum`, `kh2_list_count_sum`:
   - Export as `for_iter` with counter variable and conditional increment
   - Or add a `count_matching` rule type

2. **Dict Iteration with All/Any** - For `kh2_dict_count`, `kh2_dict_one_count`:
   - Support `for item, count in dict.items()` pattern
   - Add tuple unpacking in `for_iter`

3. **Conditional Setting Branches** - For `form_list_unlock`:
   - Export conditional branches based on setting values
   - Already partially supported via `conditional` rule type

4. **Fight Rules** - Once `kh2_list_any_sum` is exportable:
   - Most fight rules will automatically become exportable
   - They use dict subscript (now working) with rule values
