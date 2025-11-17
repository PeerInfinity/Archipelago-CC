# Remaining Exporter Issues

## Issue 1: technology.name attribute access in required_technologies comprehensions

**Location**: Automate logistic-science-pack (and likely other similar locations)
**Sphere**: 1.20
**Status**: Identified

**Problem**:
The access rule uses a Python comprehension:
```python
all(state.has(technology.name, player) for technology in required_technologies[ingredient])
```

In Python, `required_technologies[ingredient]` returns a frozenset of `Technology` objects, so accessing `.name` is necessary.

However, the exporter's `get_game_info()` method already converts these Technology objects to strings:
```python
required_tech_dict[ingredient] = [tech.name for tech in techs]
```

So in the JSON, `required_technologies["logistic-science-pack"]` is `["logistic-science-pack"]` (array of strings, not Technology objects).

The rule exporter analyzes the Python AST and generates:
```json
{
  "type": "attribute",
  "object": {"type": "name", "name": "technology"},
  "attr": "name"
}
```

But since the iterator variable `technology` is already a string (not an object), accessing `.name` returns `undefined`, causing the item_check to fail.

**Solution**:
The exporter needs to detect when iterating over `required_technologies[...]` collections and simplify `technology.name` to just `technology` in the element_rule, since the JSON data already contains the extracted names.

