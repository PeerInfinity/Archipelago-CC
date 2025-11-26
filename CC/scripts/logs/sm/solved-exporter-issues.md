# Super Metroid - Solved Exporter Issues

This document tracks resolved issues with the Super Metroid exporter (`exporter/games/sm.py`).

## Solved Issues

### Issue 1: Missing functions in sm_accessfrom_extractor.py

**Date**: 2025-11-26

**Problem**: The exporter tried to import `extract_all_accessfrom_info` and `get_simple_accessfrom_locations` from `sm_accessfrom_extractor.py`, but these functions did not exist.

**Error**:
```
ImportError: cannot import name 'extract_all_accessfrom_info' from 'exporter.games.sm_accessfrom_extractor'
```

**Solution**: Added the missing functions to `exporter/games/sm_accessfrom_extractor.py`:
1. `get_simple_accessfrom_locations(world)` - Returns locations where all AccessFrom lambdas return SMBool(True)
2. `extract_all_accessfrom_info(world_module_path)` - Extracts lambda source code for all VARIA locations

**Files Changed**: `exporter/games/sm_accessfrom_extractor.py`

### Issue 2: Lambda source parsing included dictionary key

**Date**: 2025-11-26

**Problem**: `inspect.getsource()` returns the full dictionary entry format including the region key, e.g., `"    'Landing Site': lambda sm: SMBool(True)\n"`. The parser tried to parse this as a standalone lambda expression, causing syntax errors.

**Solution**: Updated `extract_all_accessfrom_info()` to extract just the lambda part using regex:
```python
lambda_match = re.search(r'lambda\s+\w+\s*:', source)
if lambda_match:
    lambda_source = source[lambda_match.start():].strip()
```

**Files Changed**: `exporter/games/sm_accessfrom_extractor.py`
