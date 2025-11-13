# Kingdom Hearts 2 - Remaining Helper Issues

This file tracks unresolved issues with the KH2 helper functions (frontend/modules/shared/gameLogic/kh2/).

## Issues

### Issue 1: Missing Helper Function - `stt_unlocked`
**Status**: Identified
**Priority**: High
**Location**: frontend/modules/shared/gameLogic/kh2/kh2Logic.js
**Description**: The helper function `stt_unlocked` is not implemented in the JavaScript helper file.
**Python Implementation**: `worlds/kh2/Rules.py:58`
```python
def stt_unlocked(self, state: CollectionState, Amount) -> bool:
    return state.has(ItemName.NamineSketches, self.player, Amount)
```
**Expected Behavior**: Check if player has "Namine's Sketches" item in the specified amount.
**Impact**: Blocks access to "Simulated Twilight Town" region and all locations within it (27 locations affected in sphere 0.3).

### Issue 2: Missing Helper Function - `level_locking_unlock`
**Status**: Identified
**Priority**: High
**Location**: frontend/modules/shared/gameLogic/kh2/kh2Logic.js
**Description**: The helper function `level_locking_unlock` is not implemented in the JavaScript helper file.
**Python Implementation**: `worlds/kh2/Rules.py:85-88`
```python
def level_locking_unlock(self, state: CollectionState, amount):
    if self.world.options.Promise_Charm and state.has(ItemName.PromiseCharm, self.player):
        return True
    return amount <= sum([state.count(item_name, self.player) for item_name in visit_locking_dict["2VisitLocking"]])
```
**Expected Behavior**: Check if:
1. Promise Charm option is enabled AND player has Promise Charm item, OR
2. The total count of "2VisitLocking" items is >= amount

**Visit Locking Items** (from `worlds/kh2/Items.py:569-584`):
- Castle Key
- Battlefields of War
- Sword of the Ancestor
- Beast's Claw
- Bone Fist
- Proud Fang
- Skill and Crossbones
- Scimitar
- Membership Card
- Ice Cream (appears twice)
- Way to the Dawn
- Identity Disk
- Namine's Sketches

**Impact**: Blocks access to "Levels Region (1 Visit Locking Item)" and level-up locations (5 locations affected in sphere 0.3).

**Note**: The Promise_Charm setting is not currently exported in the rules.json settings section. This may need to be addressed in the exporter.
