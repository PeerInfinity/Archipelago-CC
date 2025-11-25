# SMZ3 Remaining Helper Issues

*Last updated: 2025-11-25*

## Status

No known helper function issues. The SMZ3 helper functions in `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` are working correctly.

## Notes

The SMZ3 helper functions handle:
- ALTTP item checks (CanLiftLight, CanLiftHeavy, CanLightTorches, etc.)
- Super Metroid movement abilities (CanFly, CanIbj, CanUsePowerBombs, etc.)
- Portal access checks for crossing between games
- Dungeon completion checks (CanBeatBoss, CanBeatMoldorm, etc.)
- Reward acquisition (CanAcquire, CanAcquireAll, CanAcquireAtLeast)

All helper functions import from ALTTP for progressive item handling (ProgressiveSword, ProgressiveGlove, etc.).
