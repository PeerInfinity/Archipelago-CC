# SC2 Solved Helper Issues

## Fixed: terran_can_rescue helper returning wrong result

**Date Fixed:** 2025-12-02

**Issue:** The `terran_can_rescue` helper was checking for `terran_common_unit` (any basic Terran unit like Marine, Marauder, etc.) but the Python implementation requires transport or air units (Medivac, Hercules, Raven, Viking) or advanced tactics enabled.

**Error Message:**
```
Mismatch for event 42 (Sphere 8.2): Comparison for state_update at step 42 Failed
Locations accessible in STATE (and unchecked) but NOT in LOG:
- The Moebius Factor (Terran): South Rescue
- The Moebius Factor (Terran): Wall Rescue
- The Moebius Factor (Terran): Mid Rescue
- The Moebius Factor (Terran): Nydus Roof Rescue
- The Moebius Factor (Terran): Alive Inside Rescue
```

**Python Implementation (worlds/sc2/rules.py:2025-2034):**
```python
def terran_can_rescue(self, state) -> bool:
    return (
        state.has_any((
            item_names.MEDIVAC, item_names.HERCULES, item_names.RAVEN, item_names.VIKING
        ), self.player)
        or self.advanced_tactics
    )
```

**Fix Applied:**
Changed from:
```javascript
terran_can_rescue: (snapshot, staticData) => {
    return terran_common_unit(snapshot, staticData);
}
```

To:
```javascript
terran_can_rescue: (snapshot, staticData) => {
    return has_any(snapshot, ['Medivac', 'Hercules', 'Raven', 'Viking'])
        || isAdvancedTactics(staticData);
}
```

**File Modified:** `frontend/modules/shared/gameLogic/sc2/helpers.js`
