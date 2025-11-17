# DOOM II - Remaining Helper Issues

This file tracks unresolved issues with DOOM II helper functions.

## Issues

None - DOOM II does not currently require custom helper functions.

## Notes

DOOM II uses the generic game logic and does not have a custom helper file. The exporter (`exporter/games/doom_ii.py`) includes basic helper expansions for common DOOM II items:

- Weapon helpers: `has_shotgun`, `has_chaingun`, `has_rocket_launcher`, `has_plasma_gun`, `has_bfg9000`, `has_chainsaw`, `has_super_shotgun`
- Key helpers: `has_red_key`, `has_blue_key`, `has_yellow_key`, `has_red_skull`, `has_blue_skull`, `has_yellow_skull`

These are handled in the exporter's `expand_helper()` method and do not require a separate helper file at this time.
