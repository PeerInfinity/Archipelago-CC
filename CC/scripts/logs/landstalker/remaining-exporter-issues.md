# Remaining Exporter Issues

## 1. Unresolved Variable in all_of Iterator (Critical)

**Issue**: The `all_of` rules have an unresolved variable reference in the iterator field.

**Location**: `exporter/games/landstalker.py` and `exporter/analyzer.py`

**Details**:
- The path requirement lambda `make_path_requirement_lambda(player, required_items, required_regions)` creates a comprehension:
  ```python
  _landstalker_has_visited_regions(state, player, required_regions)
  ```
  which expands to:
  ```python
  all(state.has("event_visited_" + region.code, player) for region in regions)
  ```
- The analyzer exports this as an `all_of` rule with `iterator_info.iterator = {"type": "name", "name": "regions"}`
- This is an unresolved variable reference - the `regions` parameter from the lambda is not being captured
- The frontend sees `iterator` as `{"type": "name"}` and tries to resolve it, getting undefined
- This causes the rule engine to receive a Map(63) (the regions data structure) instead of an array
- Result: All path access rules fail because the region visit requirements can't be evaluated

**Python Source** (`worlds/landstalker/Rules.py`):
```python
def make_path_requirement_lambda(player: int, required_items: List[str], required_regions: List[LandstalkerRegion]):
    return lambda state: \
        state.has_all(set(required_items), player) and _landstalker_has_visited_regions(state, player, required_regions)

def _landstalker_has_visited_regions(state: CollectionState, player: int, regions):
    return all(state.has("event_visited_" + region.code, player) for region in regions)
```

**Example Rule** (from Massan -> Massan Cave exit):
```json
{
  "type": "all_of",
  "element_rule": {
    "type": "item_check",
    "item": {
      "type": "binary_op",
      "left": {"type": "constant", "value": "event_visited_"},
      "op": "+",
      "right": {
        "type": "attribute",
        "object": {"type": "name", "name": "region"},
        "attr": "code"
      }
    }
  },
  "iterator_info": {
    "type": "comprehension_details",
    "target": {"type": "name", "name": "region"},
    "iterator": {"type": "name", "name": "regions"}  <-- UNRESOLVED
  }
}
```

**Impact**: Severe - All regions that require visiting other regions first are inaccessible. This blocks Mercator, Crypt, Mercator Dungeon, Mir Tower sector, and Twinkle village in Sphere 0.1.

**Proposed Fix**:
The analyzer needs to:
1. Detect when analyzing lambdas created by `make_path_requirement_lambda`
2. Capture the actual `required_regions` parameter value at export time
3. Replace the unresolved `{"type": "name", "name": "regions"}` iterator with the actual list of region codes

This likely requires runtime analysis or tracing of the lambda creation to capture the closure variables.

## 2. Shop Item Rules Not Analyzed

**Issue**: Shop item rules (item_rule field) are not being analyzed and exported as None.

**Location**: `exporter/games/landstalker.py`

**Details**:
- During generation, many warnings appear:
  ```
  Analysis finished without errors but produced no result (None) for LocationItemRule 'Massan: Shop item #1 Item Rule'.
  ```
- The analyzer encounters complex shop item rules with:
  - List comprehensions checking other items in the shop
  - `NotIn` comparisons
  - String literal checks for " Gold"
- These rules prevent certain items from appearing in shop slots to avoid duplicates

**Impact**: Moderate - Shop item placement restrictions are not enforced in the frontend. This may allow invalid item placements to appear valid.

**Example Error** (from generation output):
```
Failed to analyze left or right side of comparison: Compare(left=Attribute(value=Name(id='item', ctx=Load()), attr='name', ctx=Load()), ops=[NotIn()], comparators=[ListComp(...)])
```

**Proposed Fix**:
Enhance the analyzer to handle:
- List comprehensions in comparison operators
- `NotIn` operators
- Attribute access on lambda parameters

