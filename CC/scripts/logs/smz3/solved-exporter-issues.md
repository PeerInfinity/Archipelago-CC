# SMZ3 Solved Exporter Issues

## Summary
Issues that have been resolved in the SMZ3 exporter

## Resolved Issues

### 1. Card items not marked as advancement
- **Status**: ✅ SOLVED
- **Location**: `exporter/games/smz3.py:get_item_data()`
- **Description**: Super Metroid security card items (CardCrateriaL1, etc.) were marked as filler when precollected, but they're used in access rules
- **Solution**: Override `get_item_data()` to mark all Card items as advancement
- **Commit**: Initial SMZ3 exporter implementation
- **Verification**: Cards are now properly tracked as advancement items

### 2. Reward regions export
- **Status**: ✅ SOLVED
- **Location**: `exporter/games/smz3.py:get_settings_data()`
- **Description**: Dungeon reward assignments (pendants/crystals) needed to be exported for `CanAcquire()` helper
- **Solution**: Override `get_settings_data()` to export reward_regions mapping from TotalSMZ3 world
- **Commit**: Initial SMZ3 exporter implementation
- **Verification**: Reward regions are exported and available to JavaScript helpers

### 3. TotalSMZ3 Location.canAccess() pattern extraction
- **Status**: ✅ SOLVED
- **Location**: `exporter/games/smz3.py:override_rule_analysis()`
- **Description**: SMZ3 uses `lambda state, loc=loc: loc.Available(state.smz3state[player])` pattern which needed special handling
- **Solution**: Implement `override_rule_analysis()` to extract the `loc` object from lambda defaults and analyze its `canAccess()` method
- **Commit**: Initial SMZ3 exporter implementation
- **Verification**: Location rules are properly extracted from TotalSMZ3 Location objects

### 4. TotalSMZ3 Region.CanEnter() pattern extraction
- **Status**: ✅ SOLVED
- **Location**: `exporter/games/smz3.py:_handle_entrance_rule()`
- **Description**: Entrance rules use `lambda state, region=region: region.CanEnter(state.smz3state[player])`
- **Solution**: Extract region object and analyze its CanEnter method
- **Commit**: Initial SMZ3 exporter implementation
- **Verification**: Entrance rules properly extracted

### 5. items.AttributeName conversion
- **Status**: ✅ SOLVED
- **Location**: `exporter/games/smz3.py:postprocess_rule()`
- **Description**: Python `items.KeyPD` (attribute access) needed conversion to item_check
- **Solution**: Convert `items.AttributeName` patterns to `{"type": "item_check", "item": "AttributeName"}`
- **Commit**: Initial SMZ3 exporter implementation
- **Verification**: Item attribute access converted correctly
- **Note**: Combined with rule engine fix to return counts instead of booleans
