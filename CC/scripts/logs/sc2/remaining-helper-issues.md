# Remaining Helper Issues for Starcraft 2

## Issue 1: welcome_to_the_jungle_requirement stub returns false

**Status**: Identified
**Sphere**: 17.8
**Locations affected**:
- Beat Welcome to the Jungle
- Welcome to the Jungle: Main Base
- Welcome to the Jungle: Middle Base
- Welcome to the Jungle: No Terrazine Nodes Sealed
- Welcome to the Jungle: North-East Relic
- Welcome to the Jungle: Up to 1 Terrazine Node Sealed
- Welcome to the Jungle: Up to 2 Terrazine Nodes Sealed
- Welcome to the Jungle: Up to 3 Terrazine Nodes Sealed
- Welcome to the Jungle: Up to 4 Terrazine Nodes Sealed
- Welcome to the Jungle: Up to 5 Terrazine Nodes Sealed
- Welcome to the Jungle: Victory
- Welcome to the Jungle: West Relic

**Description**: The `welcome_to_the_jungle_requirement` helper function is currently a stub that returns `false`. This causes all locations in the "Welcome to the Jungle" mission to be inaccessible.

**Python implementation** (from worlds/sc2/Rules.py):
```python
def welcome_to_the_jungle_requirement(self, state: CollectionState) -> bool:
    return (
        self.terran_common_unit(state)
        and self.terran_competent_ground_to_air(state)
    ) or (
        self.advanced_tactics
        and state.has_any({ItemNames.MARINE, ItemNames.VULTURE}, self.player)
        and self.terran_air_anti_air(state)
    )
```

**Fix needed**: Implement the helper to check for:
- (terran_common_unit AND terran_competent_ground_to_air) OR
- (advanced_tactics AND (Marine OR Vulture) AND terran_air_anti_air)
