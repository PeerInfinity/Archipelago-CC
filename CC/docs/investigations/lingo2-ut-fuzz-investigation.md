# Lingo 2 APWorld UT Fuzzer Investigation

**Date**: 2026-01-23
**APWorld**: Lingo 2 v8.0.5
**Source**: https://files.fourisland.com/releases/lingo2-archipelago/apworld/v8.0.5/lingo2.apworld
**Status**: Work in Progress - Location rules fixed, entrance rules pending

## Summary

The Lingo 2 APWorld originally failed the UT fuzzer test due to a **closure variable serialization issue**. A custom export handler has been created that successfully serializes `AccessRequirements` for **location rules**. Entrance/exit rules still need investigation.

## Current Status

### What Works
- Location access rules are now properly serialized to Rule Builder format
- AccessRequirements objects are extracted from closures and converted to inline rules
- Items, progressives, room access, letters, and cyan checks are supported

### What Doesn't Work Yet
- Entrance/exit rules are still exported as `null`
- The `handle_complex_exit_rule` method is not being triggered
- Need to investigate why exit access rules aren't being captured during export

## Implementation Details

### Export Handler (`exporter/games/unofficial/lingo2.py`)

The handler implements:

1. **`_serialize_access_requirements()`**: Converts AccessRequirements to JSON dict
2. **`_extract_access_requirements_from_closure()`**: Extracts requirements from lambda closures
3. **`_access_requirements_to_rule()`**: Converts serialized requirements to Rule Builder format
4. **`get_custom_location_access_rule()`**: Generates inline rules for locations
5. **`handle_complex_exit_rule()`**: Attempts to handle entrance rules (not yet working)

### Rule Builder Format

Location rules are now exported as proper Rule Builder format:

```json
{
  "rule": "And",
  "children": [
    {
      "rule": "HasAll",
      "args": {"item_names": ["Example Symbol", "Sparkles Symbol"]}
    },
    {
      "rule": "CanReachRegion",
      "args": {"region_name": "The Entry - Blue Alcove"}
    }
  ]
}
```

### Supported Rule Types

- `HasAll`: For required items
- `Has`: For progressive items with counts
- `CanReachRegion`: For room/region access requirements
- `Or`: For or_logic alternatives
- `CountTrue`: For complete_at requirements
- Cyan checks: Expanded to `Or` of `Has` rules for double letters

## Remaining Work

### Entrance Rules Investigation

The `handle_complex_exit_rule` method is implemented but exits are still being exported with `null` rules. Investigation needed:

1. Verify that Lingo 2 exits have `access_rule` attributes set
2. Check if exits use the same `make_location_lambda` pattern as locations
3. Determine if the exporter is calling `handle_complex_exit_rule` for Lingo 2

### Possible Causes

1. Exits might not have `access_rule` attributes set at export time
2. The handler might not be instantiated with the world object for exits
3. There may be a different code path for exit processing

## Root Cause Analysis (Original Issue)

### The Pattern in Lingo 2

Lingo 2's `rules.py` uses closure variables to capture `AccessRequirements` objects:

```python
def make_location_lambda(reqs: AccessRequirements, world: "Lingo2World",
                         regions: dict[str, Region] | None) -> Callable[[CollectionState], bool]:
    required_regions = [regions[room_name] for room_name in reqs.rooms]
    new_reqs = reqs.copy()
    new_reqs.rooms.clear()
    return lambda state: lingo2_can_satisfy_requirements(state, new_reqs, required_regions, world)
```

### Solution Approach

Instead of trying to serialize the helper call with closure references, we:
1. Extract the actual `AccessRequirements` object from the closure
2. Serialize it to a JSON-compatible dict
3. Generate inline Rule Builder rules that replicate the check logic

## Lingo 2 AccessRequirements Structure

```python
class AccessRequirements:
    items: set[str]           # Required items
    progressives: dict[str, int]  # Progressive item counts
    rooms: set[str]           # Required room access
    letters: dict[str, int]   # Letter level requirements
    cyans: bool               # Requires any cyan letter
    or_logic: list[list[AccessRequirements]]  # AND of ORs
    complete_at: int | None   # Minimum required from possibilities
    possibilities: list[AccessRequirements]   # Options for complete_at
```

## Files Modified

- `exporter/games/unofficial/lingo2.py` - New export handler
- `CC/docs/investigations/lingo2-ut-fuzz-investigation.md` - This document

## Reproduction Steps

```bash
source .venv/bin/activate

# Download APWorld
curl -L -o custom_worlds/lingo2.apworld "https://files.fourisland.com/releases/lingo2-archipelago/apworld/v8.0.5/lingo2.apworld"

# Generate templates
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer
python fuzz.py -r 1 -j 1 -g lingo2 -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0

# Check the generated rules JSON
cat frontend/presets/lingo_2/AP_*/AP_*_rules.json | python -m json.tool | head -100
```

## Next Steps

1. Debug why `handle_complex_exit_rule` is not being called for exits
2. Verify exit access rules are being set in Lingo 2's `create_regions`
3. Check if there's a timing issue with when exits are processed vs when handler is instantiated
4. Consider alternative approaches if exit rules can't be captured via the current mechanism
