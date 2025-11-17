# Remaining Exporter Issues

## Issue 1: technology.name attribute access in required_technologies comprehensions

**Location**: Automate logistic-science-pack (and other "Automate *-science-pack" locations)
**Sphere**: 1.20
**Status**: Exporter fix applied - test still failing (debugging rule engine evaluation)

**Problem**:
The access rule uses a Python comprehension:
```python
all(state.has(technology.name, player) for technology in required_technologies[ingredient])
```

In Python, `required_technologies[ingredient]` returns a frozenset of `Technology` objects, so accessing `.name` is necessary.

However, the exporter's `get_game_info()` method converts these Technology objects to strings:
```python
required_tech_dict[ingredient] = [tech.name for tech in techs]
```

So in the JSON, `required_technologies["logistic-science-pack"]` is `["logistic-science-pack"]` (array of strings).

The AST analyzer generates:
```json
{
  "type": "attribute",
  "object": {"type": "name", "name": "technology"},
  "attr": "name"
}
```

Since the iterator variable `technology` is already a string (not an object), accessing `.name` would return `undefined`.

**Exporter Fix Applied**:
- Modified `expand_rule()` in exporter/games/factorio.py to detect `all_of` rules iterating over `required_technologies`
- Added `_simplify_technology_name_access()` method to convert attribute access to simple name reference
- Verified via logging that simplification is being applied during generation

**Current Generated Rule** (CORRECT):
```json
{
  "type": "all_of",
  "element_rule": {
    "type": "item_check",
    "item": {
      "type": "name",
      "name": "technology"
    }
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

**Test Status**:
Still failing at Sphere 1.20 with "Access rule evaluation failed" despite correct rule structure.

**Debugging Needed**:
1. Verify that `context.resolveName("technology")` returns correct value in bound context
2. Check if `hasItem("logistic-science-pack")` correctly resolves progressive items
3. Confirm state has "logistic-science-pack" at time of evaluation (player gets progressive-science-pack level 1)

