# Remaining Exporter Issues for Lingo

## Status: Investigating

The exporter appears to be working correctly. It:
- Successfully detects broken entrance rules (like "Sun Painting") that return strings instead of booleans
- Correctly replaces them with `lingo_can_use_entrance` helper calls
- Exports necessary game data (door_reqs, item_by_door, etc.) to settings

The generation completes successfully with warnings about "Analysis finished without errors but produced no result (None)" for many entrance access rules, but this appears to be expected behavior when the analyzer cannot simplify complex lambda expressions.

## Next Steps
- Verify the helper functions are being called correctly
- Check if there are any runtime errors in the helper evaluation
