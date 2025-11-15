# The Messenger - Remaining Exporter Issues

## Issue 1: Unknown rule type 'capability'

**Status**: Not Fixed
**Priority**: High
**Sphere**: Fails at Sphere 1.2 (step 14)

### Description

Some rules use `type: "capability"` which is not implemented in the rule engine. These are inferred capabilities that the analyzer adds to mark required abilities.

### Examples

```json
{
  "type": "capability",
  "capability": "shop",
  "inferred": true,
  "description": "Requires ability to shop"
}
```

```json
{
  "type": "capability",
  "capability": "dboost",
  ...
}
```

### Solution

Need to implement the 'capability' rule type in the rule engine, or modify the exporter to convert these to appropriate rule types (e.g., capability "shop" should always return true since shopping is always available).

## Issue 2: state.multiworld references

**Status**: Not Fixed
**Priority**: Medium

### Description

Some rules reference `state.multiworld.get_location()` and `state.multiworld.get_region()` which are complex Python state accesses that need special handling.

### Example

```json
{
  "type": "attribute",
  "object": {
    "type": "attribute",
    "object": {
      "type": "name",
      "name": "state"
    },
    "attr": "multiworld"
  },
  "attr": "get_location"
}
```

### Solution

These need to be handled in the stateInterface resolveName method to map "state" to the appropriate context object.

### Description

Shop locations use a `can_afford` local variable in their access_rule method, which is being exported as a helper function call instead of being expanded to the actual item check logic.

### Python Code (worlds/messenger/subclasses.py:77-80)
```python
def access_rule(self, state: CollectionState) -> bool:
    world = state.multiworld.worlds[self.player]
    can_afford = state.has("Shards", self.player, min(self.cost, world.total_shards))
    return can_afford
```

### Current Export
```json
{
  "type": "helper",
  "name": "can_afford",
  "args": []
}
```

### Expected Export
```json
{
  "type": "item_check",
  "item": {"type": "constant", "value": "Shards"},
  "count": {"type": "constant", "value": <min(cost, total_shards)>}
}
```

### Impact

- All 19 shop locations are accessible from Sphere 0 instead of being gated by shard collection
- Test fails at Sphere 0 with 19 extra locations accessible

### Affected Locations

1. The Shop - Karuta Plates (cost: 27)
2. The Shop - Serendipitous Bodies
3. The Shop - Path of Resilience
4. The Shop - Kusari Jacket
5. The Shop - Energy Shuriken
6. The Shop - Serendipitous Minds
7. The Shop - Prepared Mind
8. The Shop - Meditation
9. The Shop - Rejuvenative Spirit
10. The Shop - Centered Mind
11. The Shop - Strike of the Ninja
12. The Shop - Second Wind
13. The Shop - Currents Master
14. The Shop - Aerobatics Warrior
15. The Shop - Demon's Bane
16. The Shop - Devil's Due
17. The Shop - Time Sense
18. The Shop - Power Sense
19. The Shop - Focused Power Sense

### Solution Options

1. **Option A**: Modify the exporter's `expand_rule` method to detect `can_afford` references and expand them during analysis
2. **Option B**: Modify the exporter to properly analyze the local variable assignment and inline it
3. **Option C**: Add custom logic in MessengerGameExportHandler to detect shop locations and rewrite their access rules

### Recommended Approach

Option C is most practical. In `exporter/games/messenger.py`, override `export_location` or `expand_rule` to:
1. Detect shop locations (have a `cost` attribute)
2. Get the cost value and total_shards value
3. Replace the `can_afford` rule with an `item_check` for "Shards" with count = min(cost, total_shards)

### Files to Modify

- `exporter/games/messenger.py` - Add custom location export logic
