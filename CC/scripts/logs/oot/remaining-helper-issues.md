# Remaining Helper Issues for Ocarina of Time

This file tracks helper function issues that still need to be fixed.

## Issues

### Issue 1: `here()` function creates subrule events that aren't properly handled

**Status**: In progress - needs exporter/RuleParser fix
**Sphere**: 0.8
**Type**: Exporter/helper interaction issue

**Description**:
The `here()` function in OOT's rule system creates subrule events that must be obtained before granting access. For example, `here(has_shield)` creates "Deku Tree Lobby Subrule 1" event. The exit must check if this EVENT is obtained, not just evaluate `has_shield` directly.

**Current behavior**:
- Exporter exports `here(has_shield)` as a string in the rule
- JavaScript evaluates `has_shield` directly, returning true when player has shield
- Python requires the subrule EVENT to be obtained first before granting access

**Example**:
- Exit: "Deku Tree Lobby -> Deku Tree Slingshot Room" has rule `here(has_shield)`
- Python creates "Deku Tree Lobby Subrule 1" event with rule `has_shield`
- At Sphere 0.8: Player gets Buy Deku Shield, subrule location becomes accessible
- At Sphere 1.8: Player obtains subrule event, Slingshot Room becomes accessible
- JavaScript at Sphere 0.8: Evaluates `has_shield` = true, grants access too early!

**Test failure**:
Spoiler test fails at Sphere 0.8 with:
- Region accessible in STATE but not in LOG: "Deku Tree Slingshot Room"
- Locations accessible in STATE but not in LOG: "Deku Tree Slingshot Chest", "Deku Tree Slingshot Room Side Chest"

**Possible solutions**:
1. Fix exporter to detect subrule replacements and export event checks instead of `here()` calls
2. Fix RuleParser to store transformed rule string (after `here()` replacement) instead of original
3. Make JavaScript `here()` handler check for corresponding subrule events before evaluating

**Next steps**:
- Investigate how to detect which subrule event corresponds to which `here()` call
- Modify exporter or RuleParser to properly handle subrule transformations
