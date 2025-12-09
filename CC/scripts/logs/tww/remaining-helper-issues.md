# The Wind Waker - Remaining Helper Issues

## Issue 1: Sphere 12.2 Access Rule Evaluation Failure

**Status:** Under Investigation - Root cause not yet identified

**Description:**
The spoiler test fails at Sphere 12.2 when comparing accessible locations. The location "Ganon's Tower - Maze Chest" should become accessible after collecting all 8 Triforce Shards, but the access rule evaluation returns false.

### Test Output:
```
HELPER can_defeat_phantom_ganon(): ✓
HELPER can_reach_ganons_tower_phantom_ganon_room(): ✗
  Access rule evaluation failed
```

### Impact:
- Test fails at step 48 (Sphere 12.2) with 1 mismatch
- 47/67 events processed successfully before failure
- Location "Ganon's Tower - Maze Chest" not evaluated as accessible
- Location "Hyrule - Master Sword Chamber" also affected

### Access Rule Chain:
The location requires:
1. `can_defeat_phantom_ganon()` - PASSES (requires master sword or Skull Hammer in swordless mode)
2. `can_reach_ganons_tower_phantom_ganon_room()` - FAILS
   - `can_access_ganons_tower()` - requires:
     - `can_get_past_hyrule_barrier()` - requires:
       - `can_access_hyrule()` → `hasGroupUnique("Shards", 8)` - needs 8 Triforce Shards
       - `has_full_power_master_sword()` → `has("Progressive Sword", 4)` - needs 4 Progressive Swords
     - AND (Hookshot OR `can_fly_with_deku_leaf_indoors()`)
   - `can_unlock_ganons_tower_four_boss_door()` - requires:
     - `can_complete_all_memory_dungeons_and_bosses()` OR
     - `_tww_rematch_bosses_skipped()` → **returns TRUE** (setting is enabled)

### Verified Conditions (from accumulated log inventory at Sphere 12.2):
- Progressive Sword: 4 (should satisfy `has_full_power_master_sword`)
- Triforce Shards: All 8 collected (5, 8, 3, 2, 6, 4, 7, 1)
- Deku Leaf: present
- Progressive Magic Meter: present
- `skip_rematch_bosses: 1` in settings → `logic_rematch_bosses_skipped: true`

### Investigation Findings:

1. **Helper implementations verified correct:**
   All helper functions match Python Macros.py implementations exactly.

2. **hasGroupUnique improved:**
   Added more robust item data lookup to handle different staticData structures.

3. **Likely causes (not yet confirmed):**
   - The snapshot.inventory at comparison time may not contain all expected items
   - The staticData.itemsByPlayer structure may not match what hasGroupUnique expects
   - Timing issue between item addition and snapshot retrieval

### Technical Details:

**hasGroupUnique function:**
Searches for items in these locations:
1. `staticData.itemsByPlayer[playerSlot]`
2. `staticData.itemData`
3. `staticData.items[playerSlot]`
4. `staticData.items` (flat structure)

**Expected staticData structure from getStaticGameData:**
```javascript
{
  items: sm.itemData,
  itemsByPlayer: { '1': sm.itemData },
  itemData: sm.itemData,
  settings: { '1': { ..., logic_rematch_bosses_skipped: true } }
}
```

### Next Steps:
1. Add diagnostic logging to trace actual staticData structure during comparison
2. Verify snapshot.inventory contents at time of rule evaluation
3. Consider if console output can be captured in test framework
4. Test with different spoiler log to rule out data-specific issues

---

*Note: The original missing `can_access_*` helpers issue has been SOLVED - see solved-helper-issues.md*
