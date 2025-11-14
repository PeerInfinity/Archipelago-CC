# Solved Exporter Issues - Zillion

## Issue 1: Created Zillion exporter with custom location access rule extraction
- **Status**: Solved
- **Priority**: Critical
- **Description**: No custom exporter existed for Zillion game. Zillion uses functools.partial to wrap access rules, which the analyzer couldn't parse.
- **Solution**:
  1. Created exporter/games/zillion.py with ZillionGameExportHandler
  2. Added `get_custom_location_access_rule` hook to exporter core (exporter/exporter.py)
  3. Implemented custom rule extraction from zz_loc.req field
  4. Extracted gun, red (Red ID Card), and floppy (Floppy Disk) requirements
- **Impact**: Reduced mismatches from 188 to 46 locations
- **Files Modified**:
  - exporter/games/zillion.py (created)
  - exporter/exporter.py (added get_custom_location_access_rule hook)

## Issue 2: All locations had null access rules
- **Status**: Solved
- **Priority**: Critical
- **Description**: The analyzer couldn't parse functools.partial objects, resulting in all locations having `access_rule: null`
- **Solution**: Implemented `get_custom_location_access_rule` method that extracts requirements directly from zz_loc.req instead of trying to parse functools.partial
- **Impact**: Locations now have proper access rules (item_check for Zillion, Red ID Card, Floppy Disk)
- **Files Modified**: exporter/games/zillion.py

## Issue 3: Fixed gun requirement calculation
- **Status**: Partially solved (see remaining issue #1)
- **Priority**: High
- **Description**: Initial implementation required Zillion item for gun=1 locations, but player starts with gun=1
- **Solution**: Changed logic from `gun > 0` to `gun > 1` and adjusted count from `req.gun` to `req.gun - 1`
- **Impact**: Reduced some mismatches, but discovered that gun=1 locations have varying accessibility
- **Files Modified**: exporter/games/zillion.py
