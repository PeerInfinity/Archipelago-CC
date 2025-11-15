# Remaining KDL3 Exporter Issues

## Summary
Current testing status: 4/10 seeds passing (seeds 1, 2, 6, 7)

##Issues

None currently - exporter now exports `copy_abilities` correctly.

## Recently Fixed
- **Export copy_abilities**: Added `get_settings_data` override to export the `copy_abilities` dictionary needed by `can_assemble_rob` and `can_fix_angel_wings` helper functions.
