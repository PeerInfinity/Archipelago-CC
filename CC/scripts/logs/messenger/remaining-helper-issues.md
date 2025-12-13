# Remaining Helper Issues - The Messenger

**Last Updated**: 2025-12-13

## Summary

No remaining helper issues. The Messenger does not have a custom helper function file, and all tests pass without one.

## Tests Status

- **Seed 1**: PASSED (all 52 spheres)

## Notes

All game-specific logic is handled by the exporter through rule expansion, including:
- `has_vertical` -> or(Wingsuit, Rope Dart)
- `has_dart` -> Rope Dart item check
- `has_tabi` -> Lightfoot Tabi item check
- `is_aerobatic` -> and(Wingsuit, Aerobatics Warrior)
- `can_shop` -> Shards item check with count
- `can_destroy_projectiles` -> Strike of the Ninja item check
- `can_dboost` -> or(Path of Resilience, Meditation) and Second Wind
- `can_double_dboost` -> and(Path of Resilience, Meditation, Second Wind)
