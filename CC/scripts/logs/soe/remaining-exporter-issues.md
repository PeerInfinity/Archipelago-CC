# Remaining Exporter Issues for Secret of Evermore

## Issue 1: Locations not getting access rules from evermizer data

**Status:** In Progress

**Description:**
The exporter is checking if locations have Python access_rule and skipping the evermizer rules when they do. However, the Python rules can't be analyzed properly (super() returns empty attrs), so the locations end up with `access_rule: null` in the rules.json file.

**Root Cause:**
In `exporter/games/soe.py`, lines 126-128:
```python
if hasattr(location, 'access_rule') and location.access_rule:
    print(f"[SOE] Location {location_name} already has Python access_rule, skipping")
    return attrs
```

This check prevents adding evermizer rules even when the Python rules couldn't be analyzed.

**Impact:**
- Most locations have `access_rule: null` in rules.json
- Frontend treats these as immediately accessible
- Spoiler test fails at Sphere 0 with hundreds of incorrectly accessible locations

**Fix:**
Change the logic to only skip evermizer rules if the base class successfully analyzed the Python rule (attrs has an access_rule).
