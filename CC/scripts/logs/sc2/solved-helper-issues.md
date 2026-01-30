# Solved Helper Issues - Starcraft 2

This document tracks resolved issues with the SC2 helper functions.

## Resolved Issues

### Issue #1: weapon_armor_upgrade_count not accounting for bundle items
**Date Resolved**: 2026-01-30
**Symptom**: Shatter the Sky mission locations (Victory, Coolant Towers, Leviathan) were shown as accessible at Sphere 7.1 when they should only be accessible at Sphere 8.7.

**Root Cause**: The JavaScript `weapon_armor_upgrade_count` helper was only counting the direct upgrade item, but the Python version also counts from `upgrade_bundle_inverted_lookup` (bundles that include the upgrade).

**Fix**: Updated `weapon_armor_upgrade_count` in `frontend/modules/shared/gameLogic/sc2/helpers.js` to check for bundle items:
```javascript
function weapon_armor_upgrade_count(snapshot, staticData, upgradeItem) {
    let totalCount = count(snapshot, upgradeItem);
    const playerId = getPlayerId(snapshot, staticData);
    let bundleLookup = staticData?.game_info?.[playerId]?.upgrade_bundle_inverted_lookup;
    if (!bundleLookup) {
        bundleLookup = staticData?.game_info?.upgrade_bundle_inverted_lookup;
    }
    if (!bundleLookup) {
        bundleLookup = staticData?.upgrade_bundle_inverted_lookup;
    }
    if (bundleLookup && bundleLookup[upgradeItem]) {
        for (const bundleItem of bundleLookup[upgradeItem]) {
            totalCount += count(snapshot, bundleItem);
        }
    }
    return totalCount;
}
```

Also updated dependent functions to use `weapon_armor_upgrade_count`:
- `terran_competent_comp`
- `terranArmyWeaponArmorUpgradeMinLevel`
- `terran_competent_ground_to_air`
- `terran_respond_to_colony_infestations`
- `terran_maw_requirement`

**Files Modified**:
- `frontend/modules/shared/gameLogic/sc2/helpers.js`
