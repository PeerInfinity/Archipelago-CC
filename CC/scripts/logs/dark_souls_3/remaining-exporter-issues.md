# Dark Souls III - Remaining Exporter Issues

This document tracks unresolved issues with the Dark Souls III exporter.

## Minor Warning

### Item Data Export Warning
**Issue**: Handler for Dark Souls III returned no item data. Item export might be incomplete.
**Location**: `exporter/games/dark_souls_3.py` - `get_static_game_data()` method
**Impact**: Low - Item data is likely exported through other means
**Status**: To be investigated after core issues are resolved

---

Last updated: 2025-11-11
