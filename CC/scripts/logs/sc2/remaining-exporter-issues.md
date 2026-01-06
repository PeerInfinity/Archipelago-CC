# SC2 Remaining Exporter Issues

*Last updated: 2026-01-06*

## Summary

No remaining exporter issues. The SC2 exporter (`exporter/games/sc2.py`) is working correctly and all sphere tests pass.

## Current Status

- **Exporter location**: `exporter/games/sc2.py`
- **Test status**: All 135 spheres pass
- **Test command**: `npm test --mode=test-spoilers --game=sc2 --seed=1`

## Notes

The SC2 exporter handles several complex patterns:
- Mission entry rules (CountMissionsEntryRule, SubRuleEntryRule, BeatMissionsEntryRule)
- Rating dictionaries export (defense ratings, power ratings, etc.)
- Kerrigan item groups and upgrade bundle lookups
- SC2Logic property resolution for computed settings

All these features are working correctly.
