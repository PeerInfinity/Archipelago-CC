# Remaining Exporter Issues for Factorio

This file tracks issues that need to be fixed in the exporter (exporter/games/factorio.py) and analyzer.

## Issue 2: Incorrect ingredients expansion for "Automate logistic-science-pack"

**Priority**: MEDIUM - One location failing

**Description**:
After fixing the comprehension expansion, one location "Automate logistic-science-pack" is accessible too early (sphere 0.1 instead of sphere 2.1).

**Current Rule in rules.json**:
```json
{
  "type": "item_check",
  "item": "Automated automation-science-pack",
  "count": {"type": "constant", "value": 1}
}
```

**Expected Behavior**:
According to the Python sphere log, this location should only be accessible in sphere 2.1 when "Automated logistic-science-pack" item is received.

**Test Output**:
```
> Locations accessible in STATE (and unchecked) but NOT in LOG: Automate logistic-science-pack
```

**Investigation Needed**:
- Check what `location.ingredients` actually contains for "Automate logistic-science-pack" location
- Verify if the comprehension is being expanded with the correct iterator values
- Check if additional rules from `Rules.add_rule()` (line 244-245 in __init__.py) are being properly combined
- Investigate if prerequisites from `shapes.get(location)` affect this location

**Sphere Log Analysis**:
- Sphere 0.1: "Automated automation-science-pack" received
- Sphere 1.8: "progressive-science-pack" received
- Sphere 2.1: "Automated logistic-science-pack" received, "Automate logistic-science-pack" becomes accessible

This suggests the location needs the logistic-science-pack itself OR has prerequisites that aren't being exported.
