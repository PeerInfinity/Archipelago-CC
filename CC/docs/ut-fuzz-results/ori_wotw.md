# Ori and the Will of the Wisps - UT Fuzzer Analysis

## APWorld Information

- **Game**: Ori and the Will of the Wisps
- **Template**: `Ori and the Will of the Wisps.yaml`
- **World directory**: `ori_wotw/` (from custom_worlds/ori_wotw.apworld)
- **Source**: https://github.com/Satisha10/APwotw_release/releases/download/v0.4.2/ori_wotw.apworld
- **Version**: v0.4.2
- **Required AP Version**: 0.6.3+

## UT Fuzzer Results Summary

**Status: INCOMPATIBLE** - Fundamental compatibility issues prevent UT tracking.

| Metric | Value |
|--------|-------|
| Total runs | 10 |
| Successes | 0 (0%) |
| Failures | 1+ |
| Timeouts | 6+ |
| Ignored | 3 |

## Root Cause Analysis

### Primary Issue: Infinite Loop in Rule Analysis

The exporter's `analyze_rule` function hits an infinite loop (12,800+ calls) when trying to analyze this apworld's rules. This causes:

1. **Timeouts**: Most runs time out during rule analysis
2. **Export failures**: Rules cannot be properly converted to JSON format
3. **Logic mismatches**: 390 locations appear in server logic but not in UT

### Technical Details

The apworld uses a **LogicMixin pattern** with complex dynamic state that the exporter cannot handle:

#### 1. Custom State on CollectionState

```python
class WotWLogic(LogicMixin):
    wotw_max_resources: dict[int, tuple[int, float]]  # Max health and energy
    wotw_refill_amount: dict[int, tuple[int, float]]  # Refill amounts
    wotw_enemies: dict[int, dict[str, float]]  # Energy cost per enemy
```

The rules access this dynamic state, which is computed and cached based on collected items.

#### 2. Complex Resource Calculations

Rules call functions like `has_enough_resources()` which:
- Compute max health/energy from item counts (`get_max()`)
- Calculate refill amounts with math operations (`ceil()`, `floor()`, `min()`)
- Track energy costs for 17+ enemy types
- Apply region-specific refill modifiers

Example rule:
```python
lambda s: s.has("Bash", p) and has_enough_resources(
    [('energy', ('Grenade', 1))], [], "MarshSpawn.Main", s, p, o, True
)
```

#### 3. Dynamic Combat Cost System

```python
def compute_combat(enemy: str, state, player, options) -> float:
    # Updates cached enemy costs based on current weapons
    for enemy in state.wotw_enemies[player].keys():
        state.wotw_enemies[player][enemy] = get_enemy_cost(enemy, state, player, options)
```

#### 4. Secondary Issues

- **Entrance Randomization**: The `door_rando` option creates additional complexity
- **Options-dependent logic**: Many rules check difficulty level and modify behavior
- **Area entry requirements**: `can_enter_area()` checks health/regenerate requirements

## Error Log Evidence

```
RuntimeError: analyze_rule called 12812 times - likely infinite loop.
Context: LocationItemRule 'E.WillowsEnd.GlideRooms Item Rule'

Locations MarshSpawn.RockHC,MarshSpawn.FirstPickupEX,... (390 locations)
were expected to be in logic but weren't
```

## Compatibility Assessment

### Why This APWorld Cannot Work with UT

1. **Dynamic State**: UT cannot track mixin state like `wotw_max_resources`
2. **Complex Math**: Rule builder doesn't support `ceil()`, `floor()`, arbitrary math
3. **Cached Computations**: Enemy cost caching system has no JSON equivalent
4. **Options Coupling**: Rules deeply coupled to options object

### Potential Fixes (Would Require APWorld Changes)

1. **Simplify resource rules**: Remove energy/health cost calculations from access rules
2. **Pre-compute combat costs**: Make enemy requirements static items/flags
3. **Remove mixin state**: Use standard item counting patterns
4. **Flatten area requirements**: Convert health requirements to item requirements

### Potential Fixes (Exporter Side)

1. **Custom ori_wotw handler**: Would need to understand and translate the resource system
2. **Significant effort required**: The logic patterns are fundamentally different from other games

## Recommendation

**Add to known-incompatible list.** The apworld's architecture uses patterns that are fundamentally incompatible with the UT tracking approach. Fixing this would require either:

1. Major changes to the apworld's rule structure (unlikely from community maintainer)
2. A sophisticated custom exporter that can interpret the resource/combat system

## Files Examined

- `ori_wotw/__init__.py` - Main world class with LogicMixin integration
- `ori_wotw/RulesFunctions.py` - Complex resource/combat calculation logic
- `ori_wotw/Rules.py` - Generated rules using helper functions
- `ori_wotw/Options.py` - Options that affect rule behavior
- `ori_wotw/DoorData.py` - Door randomization data

## Test Configuration

The failing run used this configuration (highlights):
```yaml
difficulty: gorlek
glitches: 'true'
door_rando: 'true'
hard_mode: 'true'
no_combat: [bosses, everything, arenas, demi bosses]
```

The `door_rando: 'true'` enables entrance randomization, but the core issue is the resource/combat rule system regardless of door_rando setting.

---
*Analysis performed: 2026-01-22*
*APWorld version: v0.4.2*
*Archipelago version: 0.6.5*
