# Remaining Exporter Issues

## TRUE ROOT CAUSE IDENTIFIED

The "Automate logistic-science-pack" location is NOT accessible when it should be, preventing its event item from being collected.

### Key Findings

1. ✓ "Automate automation-science-pack" IS checked successfully (Sphere 0.1)
2. ✗ "Automate logistic-science-pack" is NEVER checked (should be accessible in Sphere 1.8)
3. ✓ Event items ARE added to inventory when locations are checked
4. ✗ The problem is that "Automate logistic-science-pack" doesn't become accessible

### The Problematic Access Rule

Location: `Automate logistic-science-pack`
Access Rule Type: `all_of` comprehension
```json
{
  "type": "all_of",
  "element_rule": {
    "type": "item_check",
    "item": {"type": "name", "name": "technology"}
  },
  "iterator_info": {
    "type": "comprehension_details",
    "target": {"type": "name", "name": "technology"},
    "iterator": {
      "type": "subscript",
      "value": {"type": "name", "name": "required_technologies"},
      "index": {"type": "constant", "value": "logistic-science-pack"}
    }
  }
}
```

This rule checks: "For all technologies in `required_technologies['logistic-science-pack']`, check if player has each technology"

### The Issue

The rule references `required_technologies` which should be:
1. Exported by the exporter to rules.json (NOT FOUND in rules.json)
2. OR provided in the evaluation context (needs verification)
3. OR the comprehension rule needs to be simplified/resolved by the exporter

### Evidence from Generation Log

```
[Factorio Exporter] _simplify_technology_name_access called with iterator_var=technology, rule type=item_check
[Factorio Exporter] item_check found, item type=attribute
[Factorio Exporter] Simplifying attribute access pattern!
[Factorio Exporter] Simplified technology.name access in all_of rule
```

This was logged 6 times, suggesting the simplification is working for SOME locations but NOT ALL.

### Next Steps

1. Check if `required_technologies` should be in rules.json (game_data or elsewhere)
2. If missing, fix the exporter to include it
3. OR fix the exporter to fully resolve/simplify these comprehension rules before export
4. Verify the exporter's `_simplify_technology_name_access` method is being applied to ALL "Automate" locations

