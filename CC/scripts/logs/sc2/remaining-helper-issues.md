# SC2 Remaining Helper Issues

*Last updated: 2026-01-06*

## Summary

No remaining helper issues. The SC2 helpers (`frontend/modules/shared/gameLogic/sc2/helpers.js`) are working correctly and all sphere tests pass.

## Current Status

- **Helper location**: `frontend/modules/shared/gameLogic/sc2/helpers.js`
- **Logic module**: `frontend/modules/shared/gameLogic/sc2/sc2Logic.js`
- **Test status**: All 135 spheres pass
- **Test command**: `npm test --mode=test-spoilers --game=sc2 --seed=1`

## Notes

The SC2 helpers implement a comprehensive set of faction-specific functions for:
- Terran, Zerg, and Protoss unit and upgrade checks
- Defense rating calculations using exported rating tables
- Weapon/armor upgrade counting with bundle lookups
- Kerrigan ability and level checks
- Spear of Adun ability checks

All helpers are functioning correctly with the exported game data.
