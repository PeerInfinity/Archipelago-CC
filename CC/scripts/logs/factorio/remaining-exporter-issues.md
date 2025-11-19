# Remaining Exporter Issues

## Current Status

Spoiler test fails at Sphere 2.1 with 34 locations not being unlocked.

### ROOT CAUSE IDENTIFIED

Event items are NOT being added to the inventory when their locations are checked during spoiler tests.

**Debug Evidence:**
- `"Automated automation-science-pack"` correctly has count=1 (from Sphere 0.1)
- `"Automated logistic-science-pack"` has count=0 even after its location is checked (should be 1)
- All other Automated event items also have count=0

### Issue Details

- **Affected Sphere**: 2.1
- **Number of Failing Locations**: 34
- **Error**: "Access rule evaluation failed" for each location
- **Pattern**: All failing locations require both:
  - "Automated automation-science-pack" (event item from Sphere 0.1) ✓ Present with count=1
  - "Automated logistic-science-pack" (event item from Sphere 2.1) ✗ Count stays at 0

### Example Location

Location: AP-2-179
Access Rule:
```json
{
  "type": "and",
  "conditions": [
    {"type": "item_check", "item": {"type": "constant", "value": "Automated automation-science-pack"}},
    {"type": "item_check", "item": {"type": "constant", "value": "Automated logistic-science-pack"}}
  ]
}
```

### Investigation Trail

1. ✓ Event items are correctly marked in rules.json with `event: True`
2. ✓ Event items are correctly placed at "Automate" locations with `advancement: True`
3. ✓ The exporter's `_simplify_technology_name_access` method is working (6 successful simplifications logged)
4. ✓ Access rules are structured correctly
5. ✓ The Factorio has() helper is being called and checks inventory correctly
6. ✓ Event items ARE present in the inventory object (initialized to 0)
7. ✗ Event items are NOT being incremented when their locations are checked

### Next Steps

Investigate the location checking code to determine why event items with `advancement: True` are not being added to the inventory during spoiler tests. The issue is likely in:
- frontend/modules/stateManager/core/locationChecking.js (lines 132-146)
- OR the spoiler test's location checking mechanism
- OR event items are being added but then reset/cleared

