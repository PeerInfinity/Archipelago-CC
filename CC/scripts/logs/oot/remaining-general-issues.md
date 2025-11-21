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

**Additional Testing** (2025-11-21):
- ✗ Created "Song Dungeon" template (shuffle_song_items: dungeon)
  - Result: Still fails with FillError during pre_fill
  - Error shows duplicate location tracking: same locations appear in both "Already placed" and "Unfilled locations"
  - Locations affected: Shadow Temple Bongo Bongo Heart, Gerudo Training Ground Maze Path Final Chest, Forest Temple Phantom Ganon Heart, Bottom of the Well Lens of Truth Chest, Spirit Temple Twinrova Heart
  - Confirms bug in OOT world code where dungeon song locations are incorrectly tracked
- ✗ Created "Song Any" template (shuffle_song_items: any)
  - Result: Passes pre_fill phase but fails during main fill
  - Error: 47 unfilled locations including song locations (Sheik in Ice Cavern, Song from Windmill, Song from Malon)
  - Different error pattern but still cannot complete generation

**Resolution**:
✓ Existing preset files discovered at frontend/presets/ocarina_of_time/AP_14089154938208861744/
  - AP_14089154938208861744_rules.json (674KB)
  - AP_14089154938208861744_spheres_log.jsonl (56KB)
  - AP_14089154938208861744_Spoiler.txt (86KB)
  - AP_14089154938208861744.archipelago (29KB)
These files can be used for testing the exporter and frontend logic without needing to generate new ones.

**Next Steps**:
1. ✓ Use existing preset files for exporter testing
2. Run spoiler test: `npm test --mode=test-spoilers --game=oot --seed=1`
3. If generation is needed in future: Contact user for working template/seed combination
4. Consider reporting OOT generation bugs to Archipelago developers

**Impact**:
Generation blocker resolved by using existing preset files. Can proceed with exporter and frontend testing.

