# Ocarina of Time - Remaining Helper Issues

Status: Parser implemented - need to add missing helpers

## ~~Primary Issue: parse_oot_rule Helper Not Implemented~~ ✅ FIXED (Commit c4eda88)

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

## Progress Update (Commit c4eda88)

**✅ Implemented:**
- Created `frontend/modules/shared/gameLogic/oot/ootLogic.js`
- Implemented `parse_oot_rule()` helper with recursive descent parser
- Registered OOT in gameLogicRegistry
- Successfully parses: constants, operators (and/or/not), parentheses, age checks, item checks, function calls, comparisons
- Fixed infinite recursion bugs in parser
- Tests now run without "Maximum call stack" errors

**Remaining Work:**

The parser is working but many OOT-specific helpers are not yet implemented. These need to be added to make rules evaluate correctly:

### Missing Helpers (from test warnings):
1. `can_plant_bean` - Check if player can plant magic beans
2. `can_blast_or_smash` - Check if player can blast or smash obstacles
3. `has_bottle` - Check if player has any bottle
4. `can_summon_gossip_fairy` - Check if can summon gossip stone fairy
5. `can_cut_shrubs` - Check if player can cut shrubs
6. `has_explosives` - Check if player has explosives
7. `logic_*` - Various logic setting checks (e.g., `logic_link_goron_dins`)
8. Many more from OOT's LogicHelpers.json

### Next Steps:
1. Extract list of all helpers used in rules
2. Reference OOT's `LogicHelpers.json` to understand what each helper does
3. Implement helpers progressively, testing after each batch
4. May need to implement OOT-specific state management for age switching, time of day, etc.
