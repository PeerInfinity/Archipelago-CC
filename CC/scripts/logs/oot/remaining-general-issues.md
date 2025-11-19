# Remaining General Issues

## Generation Fill Error with Ganon's Castle Keys

**Priority**: High

**Issue**: Generation fails with FillError when trying to place Small Keys for Ganon's Castle.

**Error Message**:
```
Fill.FillError: No more spots to place 2 items. Remaining locations are invalid.
Unplaced items:
Small Key (Ganons Castle) (Player 1), Small Key (Ganons Castle) (Player 1)
Unfilled locations:
Ganons Castle Shadow Trial Front Chest, Ganons Castle Light Trial Second Right Chest, ...
```

**Seeds Tested**:
- Seed 1: ✗ Fails
- Seed 12345: ✗ Fails

**Template**: `Templates/Ocarina of Time.yaml` (default settings)

**Next Steps**:
1. Investigate OOT world logic for Ganon's Castle key placement
2. Check if specific template settings cause this issue
3. Try different seeds or template configurations
4. May need to fix OOT world logic before proceeding with exporter/helper testing

