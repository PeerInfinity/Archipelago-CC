# Starcraft 2 - Remaining Exporter Issues

*No known remaining exporter issues as of 2025-12-23.*

## Notes

The following helpers are still in the blacklist because they don't have JavaScript implementations yet:
- `is_item_placement` - Not applicable in frontend (state check method)
- `zerg_welcome_to_the_jungle_requirement` - Needs JavaScript implementation
- `protoss_welcome_to_the_jungle_requirement` - Needs JavaScript implementation
- `protoss_competent_ground_to_air` - Has simplified export, but could use full JS implementation
- `zerg_competent_ground_to_air` - Has simplified export, but could use full JS implementation

These use simplified exports or True_ fallbacks which may be less accurate than full implementations.
