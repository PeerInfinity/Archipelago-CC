# Remaining Lingo Helper Issues

*Last updated: 2025-12-27*

## Summary

No remaining helper issues. All tests pass.

## Notes

The Lingo helper functions in `frontend/modules/shared/gameLogic/lingo/lingoLogic.js` implement:
- `lingo_can_use_entrance` - Check if a door/entrance can be used
- `lingo_can_use_mastery_location` - Check mastery achievement requirements
- `lingo_can_use_level_2_location` - Check panel hunt requirements
- `_lingo_can_satisfy_requirements` - Internal helper for access requirements

These helpers work correctly now that the required settings are being exported by the fixed exporter.
