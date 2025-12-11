# A Hat in Time - Remaining Helper Issues

No known remaining helper issues. All spoiler tests pass.

Last tested: 2025-12-11
Spoiler test result: 118/118 spheres passed

## Helpers in Use
The following helpers are referenced in the rules.json:
- `can_use_hat`: Checks if a specific hat can be used (based on yarn costs)
- `has_relic_combo`: Checks for relic item combinations
- `painting_logic`: Handles Subcon painting shuffle logic
- `get_difficulty`: Gets the logic difficulty setting
- `can_clear_required_act`: Checks if required acts can be cleared (uses region reachability)

These helpers are implemented in `frontend/modules/shared/gameLogic/ahit/ahitLogic.js` and appear to be working correctly based on test results.
