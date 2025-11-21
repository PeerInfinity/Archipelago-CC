# Remaining General Issues for Ocarina of Time

## BLOCKER: Cannot Generate Test Data with Default Template

**Status**: BLOCKER - Cannot proceed with debugging

**Description**:
Multiple attempts to generate OOT multiworld with seed 1 have failed with FillError exceptions:

1. **Default Template** (dungeon-shuffled keys):
   - Error: Cannot place 2 Small Keys for Ganon's Castle
   - Seed 1 and 2 both fail with identical error

2. **Keysy Template** (all keys removed):
   - Error: Cannot place 5 songs (Minuet of Forest, Sarias Song, Eponas Song, Zeldas Lullaby, Bolero of Fire)
   - Song locations conflict/insufficient

**Root Cause**:
OOT has complex item placement constraints. The default template settings create scenarios where the fill algorithm cannot place all items legally. This is likely due to:
- Specific seed values creating problematic randomization states
- Interactions between shuffle settings (keys, songs, etc.)
- OOT-specific placement rules during pre_fill phase

**Attempted Workarounds**:
- ✗ Tried seeds 1, 2, 12345, and random
- ✗ Modified template to remove all keys (keysy mode) - song placement error
- ✗ Modified template to use vanilla keys (keys in original locations) - song placement error persists

**Analysis**:
After web research and testing vanilla keys, discovered the issue persists across configurations:
- **Vanilla Keys Template** created: small keys and boss keys set to vanilla (original locations)
- Result: Eliminates Ganon's Castle key error, but reveals underlying song placement issue
- Song errors occur with shuffle_song_items: song (default setting)
- The error shows songs already placed but same locations also listed as unfilled
- This suggests possible duplicate tracking or invalid song locations

**Next Steps**:
1. Try modifying shuffle_song_items setting (dungeon or any instead of song)
2. Contact user to get working template/seed combination for OOT
3. Consider using a different game for initial exporter testing
4. OR: Manually create minimal rules.json for testing (not ideal)

**Impact**:
Cannot test OOT exporter or frontend logic without successfully generated rules.json and sphere log files.

