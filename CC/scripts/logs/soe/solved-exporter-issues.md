# Solved Exporter Issues for Secret of Evermore

## Issue 1: Locations not getting access rules from evermizer data

**Status:** SOLVED

**Description:**
The exporter was checking if locations have Python access_rule and skipping the evermizer rules when they do. However, the Python rules can't be analyzed properly (super() returns empty attrs), so the locations ended up with `access_rule: null` in the rules.json file.

**Root Cause:**
In `exporter/games/soe.py`, lines 126-128:
```python
if hasattr(location, 'access_rule') and location.access_rule:
    print(f"[SOE] Location {location_name} already has Python access_rule, skipping")
    return attrs
```

This check prevented adding evermizer rules even when the Python rules couldn't be analyzed.

**Impact:**
- Most locations had `access_rule: null` in rules.json
- Frontend treated these as immediately accessible
- Spoiler test failed at Sphere 0 with hundreds of incorrectly accessible locations

**Fix Applied:**
Changed the logic to only skip evermizer rules if the base class successfully analyzed the Python rule (attrs has an access_rule):
```python
# Only skip evermizer rules if the base class successfully analyzed the Python rule
if attrs and 'access_rule' in attrs and attrs['access_rule'] is not None:
    print(f"[SOE] Location {location_name} has analyzed Python access_rule, using it")
    return attrs
```

**Result:**
- Locations now get proper access rules from evermizer data
- Rules are in the format: `{"type": "helper", "name": "has", "args": [progress_id, count]}`
- Locations with no requirements get `{"type": "constant", "value": True}`
