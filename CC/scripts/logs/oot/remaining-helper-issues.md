# Ocarina of Time - Remaining Helper Issues

Status: Primary issue identified - need to implement OOT rule parser

## Primary Issue: parse_oot_rule Helper Not Implemented

**Background:** The exporter now successfully exports 996 rules using the `parse_oot_rule` helper, which receives the original OOT rule DSL string as an argument. However, this helper function doesn't exist in the frontend yet, so all these rules will fail to evaluate.

**Required:** Implement `parse_oot_rule` helper in frontend that can parse and evaluate OOT's custom rule DSL.

**Example Rule String:** `"is_adult and (here(can_plant_bean) or Hover_Boots)"`

**OOT DSL Constructs to Handle:**
1. **Constants:** `True`, `False`
2. **Age checks:** `is_adult`, `is_child`, `is_starting_age`
3. **Item checks:** `Kokiri_Sword`, `Deku_Shield`, `Hover_Boots` (underscores for spaces)
4. **Logic operators:** `and`, `or`, `not`
5. **Helper functions:**
   - `can_play(Song_Name)` - check if player can play a song
   - `here(helper_name)` - evaluate helper in current region context
   - `can_use(Item_Name)` - check if item can be used
   - `at(Location_Name)` - check if at specific location
6. **Time of day:** `at_night`, `at_day`, `at_dampe`
7. **Event references:** `'Event Name'` (in single quotes)
8. **Setting checks:** `open_forest == 'open'`, `entrance_shuffle`, etc.
9. **Comparisons:** `==`, `!=`, `>`, `<`, `>=`, `<=`
10. **Function calls:** `state.has()`, `state.has_group()`, etc.

**Implementation Options:**
1. **Simple parser:** Implement a basic recursive descent parser for the DSL
2. **AST-based:** Use JavaScript's built-in parser with careful sandboxing
3. **Transpiler:** Convert OOT DSL to equivalent JavaScript/JSON rules

**Priority:** High - blocks all test progress until implemented
