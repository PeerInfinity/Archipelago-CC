# Tyrian APWorld UT Fuzzer Analysis

## Summary

**APWorld**: Tyrian v1.0.3
**Source**: https://github.com/KScl/TyrianArchipelago
**Test Results**: 6 failures, 2 successes, 2 ignored out of 10 runs (60% failure rate)
**Error Type**: AttributeError - NoneType handling in exported rules
**Status**: Incompatible with Universal Tracker (requires apworld maintainer fix)

## Root Cause

The Tyrian apworld uses a sophisticated damage calculation system that cannot be properly exported to the Rule Builder format. The issue stems from how rules capture closure variables.

### Technical Details

Tyrian defines location access rules using lambdas with default parameter values to capture DPS (Damage Per Second) requirements:

```python
# From tyrian/logic.py
dps_active = world.damage_tables.make_dps(active=scale_health(difficulty, 20) / 3.6)
logic_location_rule(world, "TYRIAN (Episode 1) - BUBBLES Warp Rock",
    lambda state, dps1=dps_active:
        can_deal_damage(state, world.player, dps1))
```

The `DPS` is a frozen dataclass:

```python
@dataclass(frozen=True)
class DPS:
    active: float = 0.0
    passive: float = 0.0
    sideways: float = 0.0
    piercing: float = 0.0

    @cached_property
    def _type_piercing(self):
        return self.piercing > 0.0
```

### Why Export Fails

1. **Closure Variable Capture**: The exporter sees `dps1` as a variable reference in the lambda
2. **Missing Value Resolution**: The actual `DPS` dataclass value is not captured - only the variable name
3. **Null Parameter**: When the world generator reconstructs the rule, `dps1` resolves to `None`
4. **AttributeError**: The helper function `get_front_weapon_state` accesses `target_dps._type_piercing`, which fails when `target_dps` is `None`

### Exported Rule (Broken)

```json
{
  "rule": "can_deal_damage",
  "args": [
    {
      "rule": "Name",
      "args": {
        "name": "dps1"
      }
    }
  ]
}
```

### Generated Code (Fails)

```python
# In generated Rules.py
lambda state: can_deal_damage(state, player, None, None, None)
```

The `None` values are passed because the variable names cannot be resolved to their actual values.

## Additional Complexity

Beyond the closure variable issue, Tyrian has several other factors that make UT compatibility difficult:

1. **Dynamic Damage Tables**: DPS requirements are calculated at runtime based on:
   - Logic difficulty setting
   - Game difficulty
   - Weapon availability
   - Generator power levels

2. **State-Dependent Calculations**: The `can_deal_damage` function queries:
   - `state.multiworld.worlds[player].damage_tables` - world-specific data
   - `state.prog_items[player].keys()` - collected items
   - Complex weapon DPS calculations with energy management

3. **Multiple Helper Dependencies**: Helper functions form a dependency chain:
   - `can_deal_damage` → `get_front_weapon_state`, `get_rear_weapon_state`, `get_generator_level`
   - Each helper accesses world-specific state that would need to be serialized

## Potential Solutions

### 1. APWorld Maintainer Fix (Recommended)

The apworld could be modified to use serializable rule patterns:

```python
# Instead of DPS objects, use item requirements directly
logic_location_rule(world, location_name,
    lambda state: state.has_any(['Laser', 'Mega Cannon', 'Pulse-Cannon'], player))
```

This would require significant rework of Tyrian's sophisticated damage logic but would enable UT compatibility.

### 2. Tyrian-Specific Exporter (High Effort)

A custom exporter could:
- Pre-compute all DPS requirements and expand them to item lists
- Convert `can_deal_damage` calls to `HasAny` rules with valid weapons
- Requires deep understanding of Tyrian's damage system

### 3. Closure Value Capture Enhancement (Framework Change)

Modify the exporter to:
- Capture default parameter values from lambda functions
- Serialize dataclass instances properly
- Requires significant framework changes

## Recommendation

**Add Tyrian to the UT-incompatible list.** The apworld's rule system is fundamentally incompatible with the current export architecture. The sophisticated damage calculation system that makes Tyrian's logic accurate would require either:

1. The apworld maintainer to simplify the rule system (unlikely without losing gameplay accuracy)
2. A major framework enhancement to support closure value capture

This is not a bug in the exporter but rather a fundamental limitation when dealing with complex runtime-calculated logic.

## Files Examined

- `custom_worlds/tyrian.apworld/tyrian/logic.py` - Rule definitions (2719 lines)
- `custom_worlds/tyrian.apworld/tyrian/__init__.py` - World class
- `frontend/presets/tyrian/AP_*/AP_*_rules.json` - Exported rules
- `worlds/tyrian_worldgen_*/Rules.py` - Generated rules (failing)

## Error Traceback

```
AttributeError: 'NoneType' object has no attribute '_type_piercing'

File "worlds/tyrian_worldgen_*/Rules.py", line 847, in <lambda>
    lambda state: ((can_deal_damage(state, player, None, None, None)) or ...)
File "worlds/tyrian_worldgen_*/Rules.py", line 21, in can_deal_damage
    owned_front = get_front_weapon_state(state, player, target_dps)
File "worlds/tyrian_worldgen_*/Rules.py", line 43, in get_front_weapon_state
    if target_dps._type_piercing:
       ^^^^^^^^^^^^^^^^^^^^^^^^^
```

## Test Configuration (Failing)

```yaml
Tyrian:
  logic_difficulty: master
  # Other options vary per run
```

The `logic_difficulty: master` setting triggers more complex DPS requirements, increasing failure likelihood.

---

*Analysis Date: 2026-01-23*
*Archipelago Version: 0.6.5*
*APWorld Version: 1.0.3*
