# Ocarina of Time - Solved Helper Issues

## Completed Fixes

### Issue #1: parse_oot_rule Helper Implementation (Commit c4eda88)

**Problem:** The exporter was outputting 996 rules with `parse_oot_rule` helper, but this helper didn't exist in the frontend, so no rules could be evaluated.

**Solution:** Implemented complete OOT DSL parser in `frontend/modules/shared/gameLogic/oot/ootLogic.js`:
- Recursive descent parser for OOT's custom DSL
- Handles constants (`True`/`False`)
- Handles operators (`and`, `or`, `not`) with proper precedence
- Handles parentheses and quoted strings
- Handles age checks (`is_adult`, `is_child`, `is_starting_age`)
- Handles item checks (converts underscores to spaces)
- Handles function calls (`can_play()`, `can_use()`, `here()`)
- Handles comparisons (`==`, `!=`)
- Handles time of day (`at_night`, `at_day`, `at_dampe`)
- Fixed infinite recursion bugs in operator splitting
- Unknown helpers safely default to false

**Results:**
- Tests now run without "Maximum call stack" errors
- Parser successfully evaluates complex nested rules
- Foundation in place for adding missing OOT-specific helpers

**Files Created:**
- `frontend/modules/shared/gameLogic/oot/ootLogic.js`: Main logic module with parser
- Modified `frontend/modules/shared/gameLogic/gameLogicRegistry.js`: Registered OOT
