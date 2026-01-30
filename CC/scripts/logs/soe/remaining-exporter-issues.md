# Secret of Evermore - Remaining Exporter Issues

Last updated: 2026-01-30

## Status

No known exporter issues. The spoiler test passes successfully with all 20 events processed without errors.

## Verified Working

- `exporter/games/official/soe.py` - Custom exporter handler for SOE
- Progress ID tracking via pyevermizer integration
- Item `provides` data properly exported
- Location access rules generated from pyevermizer requirements
- Logic rules (`__soe_logic_rules__`) exported for frontend evaluation

## Notes

The SOE exporter uses pyevermizer's progress system rather than Python lambda rules. This is handled by:
1. `get_item_data()` - Exports item provides information including progress IDs
2. `get_location_attributes()` - Converts pyevermizer requirements to helper calls
3. `_transform_requirements()` - Builds rule structures from requirement tuples
