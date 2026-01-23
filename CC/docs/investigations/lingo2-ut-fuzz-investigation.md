# Lingo 2 APWorld UT Fuzzer Investigation

**Date**: 2026-01-23
**APWorld**: Lingo 2 v8.0.5
**Source**: https://files.fourisland.com/releases/lingo2-archipelago/apworld/v8.0.5/lingo2.apworld
**Success Rate**: 0/10 (0.0%)

## Summary

The Lingo 2 APWorld fails the UT fuzzer test due to a **closure variable serialization issue**. The APWorld uses a pattern where rules are constructed with closure-captured `AccessRequirements` objects that cannot be properly serialized during export.

## Error Details

```
AttributeError: 'NoneType' object has no attribute 'items'
```

**Location**: Generated `Rules.py` at line 20 in `lingo2_can_satisfy_requirements`

**Traceback**:
```
File "rules.py", line 20, in lingo2_can_satisfy_requirements
    if not (all(state.has(item, player) for item in reqs.items)):
                                                    ^^^^^^^^^^
AttributeError: 'NoneType' object has no attribute 'items'
```

## Root Cause Analysis

### The Pattern in Lingo 2

Lingo 2's `rules.py` uses closure variables to capture `AccessRequirements` objects:

```python
# From lingo2/rules.py
def make_location_lambda(reqs: AccessRequirements, world: "Lingo2World",
                         regions: dict[str, Region] | None) -> Callable[[CollectionState], bool]:
    # Create a modified copy of requirements
    required_regions = [regions[room_name] for room_name in reqs.rooms]
    new_reqs = reqs.copy()
    new_reqs.rooms.clear()
    return lambda state: lingo2_can_satisfy_requirements(state, new_reqs, required_regions, world)
```

The `new_reqs` variable is a closure-captured `AccessRequirements` object with these attributes:
- `items`: set of required items
- `progressives`: dict of item -> count
- `rooms`: set of room names
- `letters`: dict of letter -> level
- `cyans`: bool flag
- `or_logic`: list of alternative requirements
- `complete_at`: int or None
- `possibilities`: list of requirement sets

### How the Exporter Fails

1. **During Export**: The exporter analyzes the lambda and encounters `new_reqs` as a Name reference
2. **JSON Output**: The rule is exported as:
   ```json
   {
     "rule": "lingo2_can_satisfy_requirements",
     "args": [
       {"rule": "Name", "args": {"name": "new_reqs"}},
       {"rule": "Constant", "args": {"value": []}}
     ]
   }
   ```
3. **During Worldgen**: The code generator converts `Name(new_reqs)` to `None` (unknown variable)
4. **Generated Code**:
   ```python
   HelperCall(helper_func=lingo2_can_satisfy_requirements, args=(None, [],))
   ```
5. **At Runtime**: `lingo2_can_satisfy_requirements(state, player, None, [])` crashes because `reqs.items` fails

### Why This Happens

The exporter cannot evaluate closure variables at export time because:
1. The value exists only in the runtime closure scope
2. The `AccessRequirements` object is created per-location in `make_location_lambda`
3. The exporter captures only the variable name, not the captured value

## Comparison with Original Lingo

The original Lingo game has a similar pattern but includes a **game-specific export handler** (`exporter/games/official/lingo.py`) that:

1. **Serializes AccessRequirements**:
   ```python
   @staticmethod
   def _serialize_access_requirements(access_req) -> Dict[str, Any]:
       return {
           'rooms': sorted(list(access_req.rooms)),
           'doors': [{'room': d.room, 'door': d.door} for d in ...],
           'colors': sorted(list(access_req.colors)),
           'items': sorted(list(access_req.items)),
           # ... more fields
       }
   ```

2. **Exports location access data**:
   ```python
   def get_location_attributes(self, location, world) -> Dict[str, Any]:
       # Lookup PlayerLocation from world.player_logic
       # Serialize and attach AccessRequirements
   ```

3. **Generates custom rules** that reference serialized data:
   ```python
   def get_custom_location_access_rule(self, location, world) -> Dict[str, Any]:
       return {
           'type': 'helper',
           'name': '_lingo_can_satisfy_requirements',
           'args': [{'type': 'attribute', 'object': {'type': 'name', 'name': 'location'}, 'attr': 'access'}]
       }
   ```

## Solution Options

### Option 1: Create Lingo 2 Export Handler (Recommended)

Create `exporter/games/unofficial/lingo2.py` with:

1. Serialize `AccessRequirements` objects to JSON-compatible dicts
2. Export location access data from `world.player_logic`
3. Generate rules that reference serialized requirements
4. Handle the unique Lingo 2 attributes (`letters`, `cyans`, `or_logic`, `complete_at`)

**Pros**: Proper fix, enables full UT tracking
**Cons**: Significant development effort, requires understanding Lingo 2 internals

### Option 2: Add to Known-Incompatible List

Add Lingo 2 to a list of APWorlds that cannot be supported due to architectural incompatibility.

**Pros**: Simple, honest about limitations
**Cons**: No UT support for Lingo 2 users

### Option 3: Report to APWorld Maintainer

Open an issue with the Lingo 2 APWorld maintainer suggesting they modify the rule structure to be serialization-friendly.

**Pros**: Could benefit all tracking solutions
**Cons**: Requires APWorld code changes, may not be accepted

## Lingo 2 AccessRequirements Structure

From the APWorld's `player_logic.py`:

```python
@dataclass
class AccessRequirements:
    items: frozenset[str] = frozenset()
    progressives: dict[str, int] = field(default_factory=dict)
    rooms: frozenset[str] = frozenset()
    letters: dict[str, int] = field(default_factory=dict)
    cyans: bool = False
    or_logic: list[list["AccessRequirements"]] = field(default_factory=list)
    complete_at: int | None = None
    possibilities: list["AccessRequirements"] = field(default_factory=list)
```

## Files Examined

- `custom_worlds/lingo2.apworld` - APWorld package
  - `lingo2/rules.py` - Rule logic with closure pattern
  - `lingo2/player_logic.py` - AccessRequirements definition
  - `lingo2/__init__.py` - World class definition
- `exporter/games/official/lingo.py` - Original Lingo handler (reference)
- `world_generator/rule_codegen.py` - Code generation for Name references
- Generated `worlds/lingo_2_worldgen_*/Rules.py` - Shows the broken output

## Reproduction Steps

```bash
source .venv/bin/activate

# Download APWorld
curl -L -o custom_worlds/lingo2.apworld "https://files.fourisland.com/releases/lingo2-archipelago/apworld/v8.0.5/lingo2.apworld"

# Generate templates
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer
python fuzz.py -r 1 -j 1 -g lingo2 -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0
```

## Conclusion

The Lingo 2 APWorld uses a sophisticated rule construction pattern that relies on closure-captured objects. This pattern is fundamentally incompatible with the current exporter's ability to serialize rules. A game-specific export handler similar to the original Lingo handler is required to support this APWorld.

**Recommendation**: Create an unofficial game handler in `exporter/games/unofficial/lingo2.py` that serializes `AccessRequirements` objects and generates compatible rules.
