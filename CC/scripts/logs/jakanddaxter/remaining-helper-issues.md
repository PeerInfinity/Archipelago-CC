# Remaining Helper Issues

## Issue 1: Missing `can_reach_orbs` helper function

**Description**: Orb trading locations require a `can_reach_orbs(required_count)` helper function that calculates how many orbs are reachable based on accessible regions.

**Affected locations** (15 locations in Sphere 3.15):
- RV: Bring 120 Orbs To The Oracle (1)
- RV: Bring 120 Orbs To The Oracle (2)
- RV: Bring 90 Orbs To The Gambler
- RV: Bring 90 Orbs To The Geologist
- RV: Bring 90 Orbs To The Warrior
- SV: Bring 120 Orbs To The Oracle (1)
- SV: Bring 120 Orbs To The Oracle (2)
- SV: Bring 90 Orbs To The Mayor
- SV: Bring 90 Orbs to Your Uncle
- VC: Bring 120 Orbs To The Oracle (1)
- VC: Bring 120 Orbs To The Oracle (2)
- VC: Bring 90 Orbs To The Miners (1)
- VC: Bring 90 Orbs To The Miners (2)
- VC: Bring 90 Orbs To The Miners (3)
- VC: Bring 90 Orbs To The Miners (4)

**Current rule format**:
```json
{
  "type": "helper",
  "name": "can_reach_orbs",
  "args": [1530]
}
```

**Error message**: "Access rule evaluation failed" (helper not implemented)

**Root cause**: The helper function needs to be implemented in the frontend at:
`frontend/modules/shared/gameLogic/jak_and_daxter__the_precursor_legacy/jakanddaxterLogic.js`

**Python logic** (from `worlds/jakanddaxter/rules.py`):
```python
def can_reach_orbs_global(state: CollectionState,
                          player: int,
                          world: "JakAndDaxterWorld",
                          orb_amount: int) -> bool:
    if not state.prog_items[player]["Reachable Orbs Fresh"]:
        recalculate_reachable_orbs(state, player, world)
    return state.has("Reachable Orbs", player, orb_amount)

def count_reachable_orbs_level(state: CollectionState,
                               world: "JakAndDaxterWorld",
                               level_name: str = "") -> int:
    accessible_orbs = 0
    for region in world.level_to_orb_regions[level_name]:
        if region.can_reach(state):
            accessible_orbs += region.orb_count
    return accessible_orbs
```

**Implementation requirements**:
1. Calculate which regions are currently accessible
2. Sum up the orbs in those regions (need orb_count data per region)
3. Compare against required count

**Challenges**:
- Orb counts per region are not currently exported in rules.json
- Requires complex state tracking that updates as regions become accessible
- Python uses `region.orb_count` attribute which isn't in the export

**Next steps**:
1. **Option A**: Export region orb counts in rules.json (requires analyzer changes)
2. **Option B**: Calculate orb counts from orb bundle locations in each region
3. **Option C**: Create game logic file with hard-coded orb counts per region

**Priority**: High - blocks 15 locations from being properly tested

**Status**: Not yet implemented - requires frontend helper function

