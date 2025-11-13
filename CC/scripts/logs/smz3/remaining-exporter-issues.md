# SMZ3 - Remaining Exporter Issues

This file tracks exporter issues that still need to be resolved for the SMZ3 game.

## Status

Initial test run completed on 2025-11-13. Created basic SMZ3 exporter that resolves `region.CanEnter` and `loc.Available` patterns, but location logic is not properly exported.

## Progress Made

1. ✅ Created `exporter/games/smz3.py` - basic SMZ3 exporter
2. ✅ Fixed `region.CanEnter()` pattern - converted to helper call
3. ✅ Created `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` - JavaScript helpers
4. ✅ Registered SMZ3 in `gameLogicRegistry.js`
5. ⚠️ Attempted fix for `loc.Available()` - currently converts to `true` (too permissive)

## Remaining Issues

### Issue 1: TotalSMZ3 Location Logic Not Exported (CRITICAL - BLOCKING)

**Status**: Requires Major Refactoring or Alternative Approach

**Description**: SMZ3 locations use `set_rule(location, lambda state: loc.Available(state.smz3state[player]))` where `loc` is a TotalSMZ3 Location object. The actual item requirements are stored INSIDE the TotalSMZ3 library (in `loc.canAccess`), not in the Archipelago location's access_rule.

**Example**: The TotalSMZ3 Location for "Eastern Palace - Armos Knights" is created with:
```python
Location(self, 256+108, 0x308150, LocationType.Regular, "Eastern Palace - Armos Knights",
    lambda items: items.BigKeyEP and items.Bow and items.Lamp)
```

But the exported access_rule only contains the wrapper:
```python
lambda state: loc.Available(state.smz3state[player])
```

The inner logic (`items.BigKeyEP and items.Bow and items.Lamp`) is not exported to rules.json.

**Root Cause**: The TotalSMZ3 library stores location logic internally in the Location object's `canAccess` attribute. The Archipelago exporter cannot access this internal logic because it's encapsulated in the TotalSMZ3 objects that are not part of the standard Archipelago API.

**Current Workaround**: Exporter converts `loc.Available()` to `{"type": "constant", "value": true}`, which makes ALL locations accessible immediately (incorrect).

**Impact**: Test results show ALL 316 SMZ3 locations marked as accessible in Sphere 0, when only ~36 should be accessible. This includes late-game locations that require many items.

**Possible Solutions**:
1. **Modify SMZ3 world code** to expose TotalSMZ3 location logic directly in set_rule calls
   - Pros: Clean, maintainable, follows Archipelago patterns
   - Cons: Requires modifying `worlds/smz3/__init__.py` and understanding TotalSMZ3 integration

2. **Extend the exporter** to introspect TotalSMZ3 objects and extract their internal logic
   - Pros: No world code changes needed
   - Cons: Very complex, fragile, may not work with all TotalSMZ3 patterns

3. **Port TotalSMZ3 logic** to JavaScript helpers
   - Pros: Complete control over logic
   - Cons: Massive undertaking - hundreds of location-specific rules, duplicate maintenance

**Recommendation**: Solution #1 is most feasible. Modify `worlds/smz3/__init__.py` in the `create_locations` method to:
- Extract the `canAccess` logic from each TotalSMZ3 Location
- Set it directly as the Archipelago location's access rule
- This way the exporter can see the actual logic

### Issue 2: Custom Collection State (smz3state)

**Status**: Needs Investigation

**Description**: SMZ3 uses a custom `smz3state` attribute on the CollectionState object (defined in `SMZ3CollectionState` mixin). This stores TotalSMZ3 Progression data separately from standard Archipelago item state.

**Impact**: The JavaScript state manager needs to understand how to:
- Track SMZ3-specific progression separately
- Map standard Archipelago items to TotalSMZ3 Progression items
- Handle TotalSMZ3-specific methods (MoonPearl, CanLiftHeavy, etc.)

**Current Status**: Not yet addressed - focusing on getting basic exporter working first.

**Solution**: May need special handling in the exporter or helper functions to manage the smz3state separately. Will investigate after location logic export is resolved.

## Files Created/Modified

- `exporter/games/smz3.py` - SMZ3 game exporter
- `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` - SMZ3 JavaScript logic
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` - Added SMZ3 registration

## Next Steps

1. Investigate how to extract TotalSMZ3 location logic in `worlds/smz3/__init__.py`
2. Consider whether SMZ3 world code modifications are in scope for this task
3. If world code modifications are out of scope, document this as a limitation and move on to testing other aspects
