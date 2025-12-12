# A Hat in Time Rule Types Investigation

This document summarizes the investigation into what rule types are needed to fully export the helper functions in A Hat in Time.

## Current Status ✅ IMPLEMENTED

All A Hat in Time helpers are now fully exported:

| Helper | Status | Implementation |
|--------|--------|----------------|
| `can_clear_required_act` | ✅ Resolved at export-time | `can_reach` + `location_rule_ref` |
| `can_use_hat` | ✅ Exported | Full definition in rules.json |
| `get_hat_cost` | ✅ Exported | Full definition in rules.json |
| `has_relic_combo` | ✅ Exported | Full definition in rules.json |
| `painting_logic` | ✅ Exported | Full definition in rules.json |
| `get_difficulty` | ✅ Exported | Full definition in rules.json |

The spoiler tests **pass** with the export-time resolution implementation.

## Analysis of `can_clear_required_act`

```python
def can_clear_required_act(state: CollectionState, world: "HatInTimeWorld", act_entrance: str) -> bool:
    entrance: Entrance = world.multiworld.get_entrance(act_entrance, world.player)
    if not state.can_reach(entrance.connected_region, "Region", world.player):
        return False

    if "Free Roam" in entrance.connected_region.name:
        return True

    name: str = f"Act Completion ({entrance.connected_region.name})"
    return world.multiworld.get_location(name, world.player).access_rule(state)
```

### Patterns Requiring New Rule Types

1. **`get_entrance` lookup** - `world.multiworld.get_entrance(act_entrance, world.player)`
   - Needs: A way to look up entrance objects by name at runtime
   - Proposed type: `get_entrance` with `entrance` field

2. **Entrance attribute access** - `entrance.connected_region`
   - Needs: Accessing `connected_region` attribute from an entrance object
   - Could use existing `attribute` type with entrance reference

3. **`can_reach` with region object** - `state.can_reach(entrance.connected_region, "Region", player)`
   - Current `can_reach` works with region name strings
   - Needs: `can_reach` variant that accepts a region object/reference

4. **String containment check** - `"Free Roam" in entrance.connected_region.name`
   - Needs: `str_contains` or `in` operator for strings
   - Proposed type: `{"type": "str_contains", "haystack": {...}, "needle": "Free Roam"}`

5. **Dynamic f-string** - `f"Act Completion ({entrance.connected_region.name})"`
   - Already have `f_string` support, but needs to work with dynamic region names

6. **Location rule evaluation** - `world.multiworld.get_location(name, player).access_rule(state)`
   - Needs: Get a location by dynamic name, then evaluate its access rule
   - Proposed type: `{"type": "eval_location_rule", "location": {...dynamic_name...}}`

## Two Possible Approaches

### Approach 1: Add New Rule Types

Add support for the patterns above:

| New Rule Type | Purpose | Complexity |
|--------------|---------|------------|
| `get_entrance` | Lookup entrance by name | Medium |
| `entrance_connected_region` | Get connected region from entrance | Low |
| `str_contains` | String containment check | Low |
| `eval_location_rule` | Evaluate a location's access rule | High |

**Pros:**
- Generic solution that could benefit other games
- Follows the pattern of existing rule types

**Cons:**
- `eval_location_rule` is complex (recursive rule evaluation)
- Requires changes to both Python analyzer and JavaScript rule engine
- May need to handle circular dependencies in rules

### Approach 2: Export-Time Resolution

Since `can_clear_required_act` is always called with **constant** entrance name arguments, we could resolve the lookup at export time:

```json
// Current (helper call with constant arg)
{"type": "helper", "name": "can_clear_required_act", "args": [{"type": "constant", "value": "Mafia Town - Act 6"}]}

// Resolved at export time
{
  "type": "and",
  "conditions": [
    {"type": "can_reach", "region": "Down with the Mafia!"},
    {"type": "location_rule_ref", "location": "Act Completion (Down with the Mafia!)"}
  ]
}
```

**Implementation:**
1. Override `expand_rule` in `AHitGameExportHandler`
2. When encountering `can_clear_required_act` helper call with constant arg:
   - Look up the entrance to get `connected_region` (using world data)
   - Look up the "Act Completion" location's access rule
   - Inline the rule directly
3. Add `location_rule_ref` type to reference another location's access rule

**Pros:**
- No dynamic runtime lookups needed
- Simpler frontend implementation
- Leverages existing `expand_rule` pattern

**Cons:**
- Only works when arguments are constants (which is true for all current usages)
- Requires access to world data during export (already available)

## Implementation ✅ COMPLETE

Approach 2 (export-time resolution) has been implemented:

1. **Added `location_rule_ref` rule type** (`frontend/modules/shared/ruleEngine.js`)
   - Evaluates another location's access rule directly
   - Looks up location in staticData.regions and evaluates its access_rule

2. **Implemented export-time resolution** (`exporter/games/ahit.py`)
   - Added `expand_rule()` method to detect `can_clear_required_act` helper calls
   - Resolves entrance → connected_region mapping at export time
   - Generates `can_reach` + `location_rule_ref` rules

3. **Removed from blacklist**
   - `can_clear_required_act` no longer in `HELPERS_TO_EXPORT_BLACKLIST`
   - All 24 usages are now resolved at export time

### Benefits Achieved
- No reliance on JavaScript fallbacks for this helper
- Exported rules are self-contained and inspectable
- Better debugging - can see exact region and location names in rules.json

## Related Files

- **Python exporter:** `exporter/games/ahit.py`
- **JavaScript fallback:** `frontend/modules/shared/gameLogic/ahit/ahitLogic.js`
- **Python helper source:** `worlds/ahit/Rules.py:102-111`
- **Rule engine:** `frontend/modules/shared/ruleEngine.js`
- **AST analyzer:** `exporter/analyzer/ast_visitors.py`
