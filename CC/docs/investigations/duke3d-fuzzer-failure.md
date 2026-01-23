# Duke Nukem 3D APWorld - UT Fuzzer Failure Investigation

**Date**: 2026-01-23
**APWorld Version**: 0.0.8
**Source**: https://github.com/LLCoolDave/Duke3DAP/releases/download/0.0.8/duke3d.apworld

## Summary

The Duke Nukem 3D apworld is **fundamentally incompatible** with the Universal Tracker (UT) due to its dynamic world structure architecture. The apworld creates regions and locations dynamically during `interpret_slot_data`, rather than defining them statically during world initialization.

## Test Results

| Metric | Value |
|--------|-------|
| Total Runs | 10 |
| Success | 0-1 (0-10%) |
| Failures | 8-9 (80-90%) |
| Timeouts | 0 |
| Ignored | 1-2 |

## Root Cause Analysis

### Issue 1: Dynamic Location Creation

The Duke3D apworld creates all locations dynamically in `interpret_slot_data`:

```python
def interpret_slot_data(self, slot_data: Dict[str, Any]):
    menu_region = self.multiworld.get_region("Menu", self.player)
    unlocklist = slot_data["levels"]
    for level in all_levels:
        if self.item_name_to_id[level.unlock] in unlocklist:
            level_region = level.create_region(self)  # Creates region AND locations
            menu_region.connect(level_region, None, self.rules.level(level))
```

The `create_region` method creates the region structure and all its locations. This means:
- **No locations exist at world initialization time**
- **The exporter captures 0 locations** (locations don't exist yet)
- **The worldgen world has an empty `location_table`**

### Issue 2: Non-Serializable Rules

The apworld uses custom Rule classes defined inside the `Rules.__init__` method:

```python
class Rules(object):
    def __init__(self, world: "D3DWorld"):
        player = world.player

        class HasRule(Rule):
            def __init__(self, prop: str):
                self.prop = prop
            def __call__(self, state: CollectionState) -> bool:
                return state.has(self.prop, player)

        self.has = HasRule
        # ... more nested classes ...
```

These classes:
- Are defined inside a method, so `inspect.getsource()` fails
- Capture local variables (`player`) in closures
- Cannot be serialized or analyzed by the exporter

**Result**: All entrance rules are exported as `null`.

### Issue 3: Duplicate Location Error

When the tracker tries to use `interpret_slot_data`:

1. The worldgen world is generated (with empty locations)
2. The tracker calls `interpret_slot_data` on the original Duke3D world
3. `interpret_slot_data` tries to create locations
4. The locations already exist in the location cache (from the original generation)
5. **Error**: `AssertionError: <location_name> already exists in the location cache`

Example error:
```
AssertionError: E2L1 Space Shuttle RPG already exists in the location cache.
```

### Issue 4: Missing APWorld Manifest

The apworld lacks an `archipelago.json` manifest file:

```
ERROR:root:Invalid or missing manifest file for /home/user/Archipelago-CC/custom_worlds/duke3d.apworld.
This apworld will stop working with Archipelago 0.7.0.
```

This indicates the apworld was built for an older Archipelago version and may have other compatibility issues.

## Technical Details

### Exported Rules JSON

The exported rules JSON contains:
- **Regions**: Names only (8-40+ depending on options)
- **Locations**: 0 (empty)
- **Entrance Rules**: All `null`
- **Items**: 257+ items exported correctly

### Worldgen Output

The generated worldgen world contains:
- `Locations.py`: Empty `location_table = {}`
- `Regions.py`: Region structure but no locations
- `Rules.py`: No rules (fallback to always-accessible)

## Compatibility Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| Static location definition | **FAIL** | Locations created dynamically in interpret_slot_data |
| Serializable rules | **FAIL** | Nested classes inside __init__ can't be serialized |
| Standard interpret_slot_data | **FAIL** | Creates world structure instead of just interpreting |
| APWorld manifest | **WARN** | Missing, will break in AP 0.7.0 |

## Recommendations

### For Archipelago-CC/UT

1. **Add to incompatible list**: This apworld cannot be supported without significant changes
2. **No exporter workaround possible**: The architecture is fundamentally incompatible
3. **Document the incompatibility pattern**: Other apworlds using similar dynamic creation patterns will have the same issue

### For APWorld Maintainer (LLCoolDave)

To support UT tracking, the apworld would need to:

1. **Define locations statically**: Move location definitions to class-level or `location_name_to_id`
2. **Use standard Rule patterns**: Replace nested classes with standard rule functions or use `lambda state: state.has(item, player)`
3. **Refactor interpret_slot_data**: Should only adjust world state, not create regions/locations
4. **Add archipelago.json manifest**: Required for AP 0.7.0 compatibility

### Alternative Approaches

If the maintainer cannot make changes, potential (complex) workarounds:

1. **Custom exporter**: Write a duke3d-specific exporter that simulates `interpret_slot_data` to capture locations
2. **Post-generation hook**: Hook into the fuzzer to capture locations after full generation
3. **Slot data simulation**: Extract level unlock logic to predict which locations would be created

None of these are recommended due to complexity and maintenance burden.

## Files Referenced

- `custom_worlds/duke3d.apworld` - The APWorld package
- `duke3d/__init__.py:796-809` - `interpret_slot_data` implementation
- `duke3d/rules.py` - Rule class definitions
- `duke3d/base_classes.py:102-153` - Region and location creation logic

## Conclusion

The Duke Nukem 3D apworld uses an architectural pattern that is fundamentally incompatible with the Universal Tracker. The dynamic nature of its world structure creation (in `interpret_slot_data` rather than static definition) and non-serializable rule classes mean that no reasonable workaround exists in the tracker or exporter.

**Recommendation**: Add Duke Nukem 3D to the list of known-incompatible apworlds and document this as an example of an incompatible architecture pattern for future reference.
