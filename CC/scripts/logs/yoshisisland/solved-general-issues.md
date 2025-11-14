# Solved General Issues

## Solved Issue 1: Python bug - logic.cansee_clouds not called
- **Location**: worlds/yoshisisland/Rules.py lines 37 and 265
- **Problem**: Uses `logic.cansee_clouds` instead of `logic.cansee_clouds(state)`
- **Impact**: Exporter generates attribute access instead of function call
- **Solution**: Changed `logic.cansee_clouds` to `logic.cansee_clouds(state)` in both locations


