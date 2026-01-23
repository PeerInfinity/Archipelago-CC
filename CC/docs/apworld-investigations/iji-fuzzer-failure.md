# Iji APWorld Fuzzer Failure Investigation

## Summary

The Iji apworld (v1.2.5) fails the Universal Tracker fuzz test with a 100% failure rate (10/10 runs failing). The root cause is a **fundamental incompatibility** between the apworld's coding patterns and the exporter's ability to analyze rules.

## Test Results

- **Total runs**: 10
- **Success**: 0 (0.0%)
- **Failures**: 10
- **Timeouts**: 0
- **Error type**: `None` (logic mismatch)

## Root Cause Analysis

### 1. Module-Level Constant References

The Iji apworld uses module-level constant lists for item and event names:

```python
# From iji/Names/EventNames.py
Levels: List[str] = [
    "Stat Point",
    "Reached Level 1",
    "Reached Level 2",
    ...
]

Weapons: List[str] = [
    "Has Null Driver",
    "Has Shotgun",
    ...
]
```

Rules reference these via subscript access like `EventNames.Levels[0]` or `ItemNames.Sector_Access[targetsector]`.

### 2. Exporter Captures AST Instead of Resolved Values

When the exporter analyzes rules, it captures the AST representation:

```json
{
  "type": "subscript",
  "value": {
    "type": "attribute",
    "object": {"type": "name", "name": "EventNames"},
    "attr": "Levels"
  },
  "index": {"type": "constant", "value": 0}
}
```

Instead of resolving this to the actual value `"Stat Point"`, the AST is preserved. The worldgen then cannot resolve these references because it doesn't have access to the original module constants.

### 3. Helper Functions Create Recursive Dependencies

The Iji world uses chained helper functions:

```python
def get_stat_points(state, world):
    if state.has(EventNames.Weapons[0], world.player):  # "Has Null Driver"
        return 99
    return state.count_from_list([EventNames.Levels[0], ItemNames.Supercharge], world.player)

def has_enough_points(state, world, points_needed):
    return get_stat_points(state, world) >= points_needed

def has_stats(state, world, stat_needed, amount_needed):
    return state.has(stat_needed, world.player, amount_needed) and has_enough_points(state, world, amount_needed)

def can_access_sector(state, world, targetsector):
    if targetsector == 1:
        return True
    return has_stats(state, world, ItemNames.Stat_Health, world.health_balancing_values[targetsector-2]) and ...
```

When the exporter tries to inline these helpers, the unresolved references cause rule expansion to explode to 318+ KB, hitting the safety limit.

### 4. Rules Fall Back to True_()

When rule analysis fails or returns `None` (size limit exceeded), the worldgen generates `True_()` for all entrance rules. This means:

- **Server**: Applies actual access rules (requires items, stats, etc.)
- **Universal Tracker**: All locations accessible immediately (no restrictions)

This causes the logic mismatch error.

## Generated Rules Example

From the exported `Rules.py`:

```python
# All entrance rules become True_()
world.set_rule(
    multiworld.get_entrance("Menu -> Sector 1 Start", player),
    True_()
)
world.set_rule(
    multiworld.get_entrance("Menu -> Sector 2 Start", player),
    True_()
)
# ... all entrances are True_()
```

The actual game requires sector access items and health stats, but the worldgen world has no restrictions.

## Technical Details

### Files Examined

- `custom_worlds/iji.apworld` - The apworld package
- `iji/Rules.py` - Helper functions with chained dependencies
- `iji/Data/RegData.py` - Region exit rules using lambdas
- `iji/Names/EventNames.py` - Module-level constant lists

### Key Patterns Causing Issues

1. **List subscript with module reference**: `EventNames.Levels[0]`
2. **Dict-like access with runtime index**: `ItemNames.Sector_Access[targetsector]`
3. **World option dependencies**: `world.health_balancing_values[targetsector-2]`
4. **Chained helper functions**: Multiple levels of function calls with closure captures

## Resolution Options

### Option 1: Create Game-Specific Exporter (Recommended for Full Support)

Create `exporter/games/unofficial/iji.py` that:
- Resolves `EventNames.*` and `ItemNames.*` references to actual strings at export time
- Handles the helper function patterns with proper constant folding
- Manages the `world.health_balancing_values` and other option-dependent values

**Effort**: High (several days of work)
**Result**: Full UT support

### Option 2: Add to Known-Incompatible List (Recommended for Now)

Add Iji to a list of apworlds known to be incompatible with the Universal Tracker due to coding patterns.

**Effort**: Minimal
**Result**: No UT support, but documented

### Option 3: Request Apworld Changes (Upstream)

Request the apworld maintainer (Minish) to refactor rules to avoid:
- Module-level constant subscript access in rules
- Deep helper function chains
- Option-dependent values in region access rules

**Effort**: Depends on maintainer response
**Result**: Could enable UT support if accepted

## Recommendation

For now, add Iji to the known-incompatible list with documentation. Creating a game-specific exporter would require significant effort and the apworld's patterns are particularly challenging to handle automatically.

The key issues are:
1. Module-level constants cannot be resolved without runtime access to the module
2. The chained helper function pattern causes exponential rule growth
3. Option-dependent access rules require special handling

## Reproduction Commands

```bash
# Setup
source .venv/bin/activate
curl -L -o custom_worlds/iji.apworld "https://github.com/Minish-Link/Iji-Archipelago/releases/download/v1.2.5/iji.apworld"
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer
python fuzz.py -r 1 -j 1 -g iji -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0

# Check failure logs
cat fuzz_output/error/iji/0/0.log
```

## APWorld Information

- **Game**: Iji
- **Version**: 1.2.5
- **Author**: Minish-Link
- **Repository**: https://github.com/Minish-Link/Iji-Archipelago
- **Download**: https://github.com/Minish-Link/Iji-Archipelago/releases/download/v1.2.5/iji.apworld
