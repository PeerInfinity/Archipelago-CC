# SC2 Solved Helper Issues

## Summary
This document tracks resolved issues with the Starcraft 2 helper functions (`frontend/modules/shared/gameLogic/sc2/helpers.js`).

Last updated: 2025-11-17

## Resolved Issues

### Issue 1: Templar's Charge Mission Not Accessible at Sphere 14.27

**Status:** SOLVED

**Description:**
Test failed at sphere 14.27. The `templars_charge_requirement` helper was stubbed out to return false.

**Solution:**
Implemented the helper to check for `protoss_fleet(snapshot, staticData)`:
```javascript
templars_charge_requirement: (snapshot, staticData) => {
    // Templar's Charge requires fleet units (air superiority)
    return protoss_fleet(snapshot, staticData);
},
```

**Analysis:**
Looking at the sphere log, the mission became accessible when the player obtained the "Destroyer" unit at sphere 14.27. Destroyer is a Protoss fleet unit (along with Carrier, Tempest, and Void Ray).

**Commit:** 49a73761

---

### Issue 2: Enemy Within Mission Not Accessible at Sphere 14.38

**Status:** SOLVED

**Description:**
The `zerg_pass_vents` helper was stubbed out, preventing access to Enemy Within mission.

**Solution:**
```javascript
zerg_pass_vents: (snapshot, staticData) => {
    // Small zerg units that can fit through vents
    return has_any(snapshot, ['Zergling', 'Baneling', 'Infested Terran']);
},
```

**Analysis:**
Mission unlocked when player obtained Zergling. Small Zerg units can pass through vents.

**Commit:** c1d9d5e7

---

### Issue 3: The Dig Mission Not Accessible at Sphere 15.2

**Status:** SOLVED

**Description:**
The `marine_medic_upgrade` helper was stubbed out and incorrectly implemented.

**Solution:**
```javascript
marine_medic_upgrade: (snapshot, staticData) => {
    // Check if player has upgrades that benefit Marine+Medic synergy
    const marineUpgrades = [
        'Progressive Stimpack (Marine)',
        'Combat Shield (Marine)',
        'Magrail Munitions (Marine)',
        'Optimized Logistics (Marine)'
    ];
    const medicUpgrades = [
        'Advanced Medic Facilities',
        'Stabilizer Medpacks (Medic)',
        'Restoration (Medic)',
        'Optical Flare (Medic)',
        'Adaptive Medpacks (Medic)'
    ];

    return has_any(snapshot, marineUpgrades) && has_any(snapshot, medicUpgrades);
},
```

**Analysis:**
Initially implemented to check for Marine and Medic units, but the player had upgrades instead of units. Fixed to check for both Marine and Medic upgrades.

**Commit:** 49a73761

---

### Issue 4: Templar's Return Mission Not Accessible at Sphere 15.4

**Status:** SOLVED

**Description:**
The `templars_return_requirement` helper was stubbed out.

**Solution:**
```javascript
templars_return_requirement: (snapshot, staticData) => {
    // Templar's Return requires fleet units similar to Templar's Charge
    return protoss_fleet(snapshot, staticData);
},
```

**Commit:** 49a73761

---

### Issue 5: The Escape Locations Not Accessible at Sphere 15.10

**Status:** SOLVED

**Description:**
The `the_escape_first_stage_requirement` helper was stubbed out.

**Solution:**
```javascript
the_escape_first_stage_requirement: (snapshot, staticData) => {
    // First stage of The Escape requires basic Nova equipment
    return has_any(snapshot, [
        'Armored Suit Module (Nova Suit Module)',
        'Energy Suit Module (Nova Suit Module)',
        'Progressive Stealth Suit Module (Nova Suit Module)'
    ]);
},
```

**Analysis:**
Mission became accessible when player obtained "Armored Suit Module (Nova Suit Module)".

**Commit:** 49a73761
