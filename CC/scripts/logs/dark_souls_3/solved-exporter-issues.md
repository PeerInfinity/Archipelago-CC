# Solved Exporter Issues

## Fixed: _can_get and _can_go_to helper conversion
- **Problem**: Entrance rules using `_can_get` and `_can_go_to` were exported as helper functions instead of location_check and can_reach rules
- **Root Cause**: The analyzer was outputting `helper` type instead of `function_call` type for these methods
- **Solution**: Updated `postprocess_rule` method in `exporter/games/dark_souls_3.py` to handle both `helper` type and `function_call` type
  - `_can_get(location)` → `location_check`
  - `_can_go_to(region)` → `can_reach`
- **Locations affected**: Entrance rules for Catacombs of Carthus, Irithyll of the Boreal Valley, and Smouldering Lake
- **File**: exporter/games/dark_souls_3.py:165-243

