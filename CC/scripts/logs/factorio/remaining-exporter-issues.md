# Remaining Exporter Issues

## Current Status

Spoiler test fails at Sphere 2.1 with 34 locations not being unlocked.

### Issue Details

- **Affected Sphere**: 2.1
- **Number of Failing Locations**: 34
- **Error**: "Access rule evaluation failed" for each location
- **Pattern**: All failing locations require both:
  - "Automated automation-science-pack" (event item from Sphere 0.1)  - "Automated logistic-science-pack" (event item from Sphere 2.1)

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

### Investigation So Far

1. Event items are correctly marked in rules.json with `event: True`
2. Event items are correctly placed at "Automate" locations
3. The exporter's `_simplify_technology_name_access` method is working (6 successful simplifications logged)
4. Access rules are structured correctly

### Next Steps

Need to investigate why access rule evaluation is failing for these item_check rules in the JavaScript rule engine.

