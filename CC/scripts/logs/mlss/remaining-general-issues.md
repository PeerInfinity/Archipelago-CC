# Remaining General Issues

## Issue 1: Shop Chuckolator Flag locations not accessible in sphere 3.10
**Status**: Under investigation
**Sphere**: 3.10
**Locations affected**: Badge Shop Chuckolator Flag 1/2/3, Pants Shop Chuckolator Flag 1/2/3, Shop Chuckolator Flag

**Problem**: The Python spoiler log shows these locations should be accessible in sphere 3.10 when the player gets Thunderhand, but the JavaScript state evaluation shows them as not accessible.

**Python Rule** (Regions.py line 152-173):
```python
StateLogic.brooch() and StateLogic.fruits() and (StateLogic.thunder() or StateLogic.fire() or StateLogic.hammers())
OR
StateLogic.piranha_shop() or StateLogic.fungitown_shop() or StateLogic.star_shop() or StateLogic.birdo_shop()
```

**Investigation needed**:
- Verify the OR condition is correctly captured in rules.json
- Check if piranha_shop/fungitown_shop/star_shop/birdo_shop helpers are correctly implemented
- Verify these helper functions are being evaluated correctly in sphere 3.10

**Current Test Status**: Test progresses to sphere 3.10 (was sphere 0.4 before StateLogic fix)

