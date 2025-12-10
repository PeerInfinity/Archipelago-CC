# Paint Remaining Helper Issues

## Issue 1: paint_percent_available returns incorrect value for Similarity: 79.5%

**Status**: Under Investigation

**Symptoms**:
- Test fails at Sphere 11.2 with error: "Locations accessible in LOG but NOT in STATE: Similarity: 79.5%"
- Python says Similarity: 79.5% should be accessible at sphere 11.2
- JavaScript says it's not accessible
- Other locations at sphere 11.2 (79.0%, 79.25%) pass correctly

**Sphere 11.2 Context**:
- New item collected: Progressive Color Depth (Blue) x1
- Expected cumulative inventory at 11.2:
  - Red: 7, Green: 7, Blue: 6, Width: 4, Height: 3
  - Pick Color: 1
- Expected paint percent: ~79.64% (should pass >= 79.5%)

**Files Involved**:
- `frontend/modules/shared/gameLogic/paint/helpers.js` - contains paint_percent_available function
- `exporter/games/paint.py` - exports rules and settings
- `worlds/paint/rules.py` - Python implementation

**Analysis**:
The mathematical formula appears correct - with the expected inventory, the paint percent should be ~79.64% which is >= 79.5%. Possible causes:
1. Inventory not being read correctly from snapshot
2. Settings (canvas_size_increment, logic_percent) not being read correctly
3. Player ID type mismatch (number vs string) causing settings lookup to fail
4. Timing issue in test where accessibility is checked before items are fully added

**Next Steps**:
1. Add debugging to helper function to trace actual values being used
2. Verify the settings lookup is working correctly
3. Check if there's a floating point precision issue at the boundary
