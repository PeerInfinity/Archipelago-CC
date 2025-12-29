# Starcraft 2 - Solved Exporter Issues

**Last Updated:** 2025-12-29

## Summary

This file documents exporter issues that have been resolved for SC2.

## Previously Solved Issues

### Mission Entry Rules (Prior Work)

The SC2 exporter includes custom handling for SC2's mission entry rule patterns:

1. **CountMissionsEntryRule**: Converted to `count_true` rule type
2. **SubRuleEntryRule**: Recursive processing of sub-lambdas
3. **BeatMissionsEntryRule**: Converted to `state_method` with `has_all`

### SC2Logic Method Conversion (Prior Work)

SC2 rules reference `logic.method_name()` patterns which are converted to helper calls:
- Attribute access on `logic` or `self` objects
- Known helper methods kept as helper references
- Settings attributes resolved to constant values

### Rating Dictionaries Export (Prior Work)

The exporter exports various rating dictionaries to `game_info`:
- Defense ratings (tvx, tvz, zvx, pvx, pvz)
- Air defense ratings
- Passive ratings (terran, zerg, protoss)
- Spear of Adun ratings (energy, passive, ultimate)

### Item Groups Export (Prior Work)

Kerrigan item groups exported for frontend helpers:
- `kerrigan_non_ulimates`
- `kerrigan_logic_active_abilities`
- `kerrigan_abilities`
- `kerrigan_passives`
- `kerrigan_active_abilities`
- `protoss_generic_upgrades`
- `upgrade_bundle_inverted_lookup`
