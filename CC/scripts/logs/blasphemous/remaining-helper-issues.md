# Remaining Helper Issues - Blasphemous

*Last Updated: 2025-11-26*

## Status: No Known Issues

All Blasphemous helper functions appear to be working correctly. The spoiler test passes with 227 sphere events processed without errors.

---

## Helper Functions Implemented

The following helper functions are implemented in `frontend/modules/shared/gameLogic/blasphemous/blasphemousLogic.js`:

- `has_boss_strength` - Calculates if player has sufficient strength to defeat a boss
- `double_jump` - Checks for Purified Hand of the Nun with purified_hand option
- `wall_climb` - Checks for Wall Climb Ability
- `dash` - Checks for Dash Ability
- `can_dawn_jump` - Checks for dawn jump capability
- `can_air_stall` - Checks for air stall capability
- `wheel` - Checks for Young Mason's Wheel
- And many more movement and item helpers

---

## Notes for Future Reference

If new helper issues are discovered:
1. Run the spoiler test with `npm test --mode=test-spoilers --game=blasphemous --seed=1`
2. Check browser console for `[ruleEngine] [evaluateHelper] Helper function not found:` errors
3. Implement missing helpers in `blasphemousLogic.js`
4. Reference Python logic in `worlds/blasphemous/Rules.py` for implementation details
