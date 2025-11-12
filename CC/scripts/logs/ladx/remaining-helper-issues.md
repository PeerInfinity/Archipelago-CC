# Remaining Helper Issues for Links Awakening DX

This file tracks outstanding helper function issues that need to be fixed.

## Issues

### 1. Forest Heart Piece / Write's House Access

**Status**: Needs Investigation

**Description**: Test fails at Sphere 1.4. Regions related to "Forest Heart Piece" and "Write" areas are not accessible.

**Location**: Failed at Sphere 1.4

**Test Output**:
```
Regions accessible in LOG but NOT in STATE: Forest Heart Piece, Graveyard, No Name 59, No Name 60, No Name 61, Outside Write's House, Write Cave West (Goponga Swamp), Write's Cave, Write's House
```

**Next Steps**:
- Check what item was collected in sphere 1.4
- Examine Forest Heart Piece access requirements (likely ROOSTER, FEATHER, HOOKSHOT, or BOOMERANG)
- Investigate if this is another exporter issue with LADXR condition types
