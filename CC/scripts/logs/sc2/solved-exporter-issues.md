# SC2 Solved Exporter Issues

*Last updated: 2026-01-06*

## Summary

The SC2 exporter was already fully functional when this debugging session started. The exporter correctly handles:

1. **Mission Entry Rules**: Complex patterns for SC2 mission progression
   - `CountMissionsEntryRule` - counts how many missions are completed
   - `SubRuleEntryRule` - evaluates sub-rules with count requirements
   - `BeatMissionsEntryRule` - checks if all required missions are beaten

2. **Rating Dictionaries**: Exports all SC2 rating tables for frontend use
   - Defense ratings (terran, zerg, protoss)
   - Passive ratings
   - Spear of Adun ratings

3. **Item Groups**: Exports Kerrigan-specific item groups for helper functions

4. **SC2Logic Properties**: Resolves computed properties to constants at export time
   - `advanced_tactics`, `base_power_rating`, `take_over_ai_allies`
   - Unit lists based on required_tactics setting

## Test Results

All 135 spheres pass successfully with the current exporter implementation.
