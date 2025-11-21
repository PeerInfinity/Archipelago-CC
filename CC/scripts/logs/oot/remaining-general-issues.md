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
- ✗ Tried seed 1, 2
- ✗ Modified template to remove all keys (keysy mode)
- ✗ Both approaches still hit FillError

**Next Steps**:
1. Contact user to get working template/seed combination for OOT
2. Check if there's a simpler configuration that reliably generates
3. Consider using a different game for initial exporter testing
4. OR: Manually create minimal rules.json for testing (not ideal)

**Impact**:
Cannot test OOT exporter or frontend logic without successfully generated rules.json and sphere log files.

