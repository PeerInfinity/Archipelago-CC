# Remaining Exporter Issues for Ocarina of Time

This document tracks unresolved issues in the OOT exporter (exporter/games/oot.py).

## Issues

### 1. Subrule Locations with Null Access Rules

**Status:** Under Investigation

**Description:**
Many Subrule locations are exported with `access_rule: null`, but they should NOT all be accessible in Sphere 0. The JavaScript state manager treats `null` as "always accessible", but the Python generator has additional logic that prevents some of these from being accessible initially.

**Failing Locations (accessible in STATE but NOT in LOG Sphere 0):**
- Kokiri Forest Subrule 1
- Lost Woods Subrule 1
- Lost Woods Subrule 2
- LW Beyond Mido Subrule 1
- Hyrule Field Subrule 1
- Hyrule Field Subrule 2
- Lake Hylia Subrule 1
- Graveyard Subrule 2
- Deku Tree Lobby Subrule 1

**Correctly Accessible in Sphere 0:**
- Graveyard Subrule 1
- Kakariko Village Subrule 1

**Root Cause:**
The exporter is not properly capturing the access rules for Subrule locations. Even though they have `access_rule: null` in the export, the Python code likely has some conditional logic (possibly in the RuleParser) that determines when these should actually be accessible.

**Investigation Needed:**
1. Check how OOT's RuleParser handles Subrule locations
2. Look at worlds/oot/RuleParser.py to understand how delayed_rules work
3. Determine if the rule_string_map is properly capturing the rules for these Subrule locations
4. Check if Subrule locations have implicit age/time-of-day requirements that aren't being exported

**Possible Solutions:**
1. Update the OOT exporter to properly capture and export the actual access rules for Subrule locations
2. Add special handling in the exporter for Subrule locations to convert their implicit requirements into explicit rules
3. Check if the parse_oot_python_rule helper needs to be used for these locations
