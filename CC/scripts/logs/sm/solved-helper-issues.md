# Super Metroid - Solved Helper Issues

This file tracks helper function issues that have been resolved for Super Metroid.

## Issue 1: `enoughStuffsRidley` was too permissive

**Date Fixed:** 2025-11-27

**Symptom:**
- Test failed at sphere 5.8 with mismatch for "Ridley" location
- JavaScript marked Ridley as accessible at sphere 5.8
- Python sphere log showed Ridley only became accessible at sphere 6.17

**Root Cause:**
The JavaScript `enoughStuffsRidley` helper was oversimplified. It only checked for:
- (Morph OR ScrewAttack) AND (Super OR Charge)

But the Python version requires:
- (Morph OR ScrewAttack) AND (Charge OR enough_ammo_for_18000_damage)

Ridley has 18000 HP and gives NO drops (givesDrops=False), so without Charge Beam,
the player needs enough missiles/supers/power bombs to deal 18000 damage.

**Fix:**
Updated `enoughStuffsRidley` in `frontend/modules/shared/gameLogic/sm/smLogic.js`:

```javascript
export function enoughStuffsRidley(snapshot, staticData) {
  // Ridley has 18000 HP and gives NO drops (givesDrops=False)
  // Python: canInflictEnoughDamages(18000, doubleSuper=True, power=True, givesDrops=False)
  //
  // Must have Morph OR ScrewAttack to fight
  const canFight = wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    haveItem(snapshot, staticData, 'ScrewAttack'));
  if (!canFight.bool) {
    return { bool: false, difficulty: 0 };
  }

  // With Charge Beam, we have infinite damage potential (charged shots)
  const hasCharge = haveItem(snapshot, staticData, 'Charge');
  if (hasCharge.bool) {
    return { bool: true, difficulty: hasCharge.difficulty || 0 };
  }

  // Without Charge, need enough ammo to deal 18000 damage
  // Damage values (with doubleSuper=True):
  // - Missile: 100 damage each, 5 per pack = 500 damage per pack
  // - Super Missile: 600 damage each (doubled for Ridley), 5 per pack = 3000 damage per pack
  // - Power Bomb: 200 damage each, 5 per pack = 1000 damage per pack
  const missileCount = count(snapshot, staticData, 'Missile');
  const superCount = count(snapshot, staticData, 'Super');
  const powerBombCount = count(snapshot, staticData, 'Power Bomb');

  const missileDamage = missileCount * 5 * 100;       // 500 per pack
  const superDamage = superCount * 5 * 600;           // 3000 per pack (doubleSuper)
  const powerDamage = powerBombCount * 5 * 200;       // 1000 per pack
  const totalDamage = missileDamage + superDamage + powerDamage;

  // Need 18000 damage to defeat Ridley
  if (totalDamage >= 18000) {
    return { bool: true, difficulty: 0 };
  }

  // Not enough damage
  return { bool: false, difficulty: 0 };
}
```

**Result:**
All 52 spheres now pass for seed 7.
