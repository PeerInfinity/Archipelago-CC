# Solved Helper Issues for Starcraft 2

*Last updated: 2025-11-30*

## Solved Issues

### Issue 1: terran_early_tech missing Dominion Trooper
**Problem**: The `terran_early_tech` helper was missing 'Dominion Trooper' from the basic units list.

**Fix**: Added 'Dominion Trooper' to the list at line 152 in helpers.js:
```javascript
return has_any(snapshot, ['Marine', 'Dominion Trooper', 'Firebat', 'Marauder', 'Reaper', 'Hellion'])
```

**Seeds affected**: Seed 2 (and likely others)

---

### Issue 2: terran_common_unit missing Dominion Trooper
**Problem**: The `terran_common_unit` helper was missing 'Dominion Trooper' from the basic units list. The Python `basic_units[SC2Race.TERRAN]` includes Dominion Trooper.

**Fix**: Added 'Dominion Trooper' to the basicUnits array at line 127 in helpers.js:
```javascript
const basicUnits = ['Marine', 'Marauder', 'Dominion Trooper', 'Goliath', 'Hellion', 'Vulture', 'Warhound'];
```

**Seeds affected**: Seed 2 (and likely others)

---

### Issue 3: terran_competent_ground_to_air incomplete logic
**Problem**: The JS helper was missing several conditions from the Python implementation:
1. Missing Dominion Trooper alongside Marine
2. Missing the weapon upgrade count check (>= 2)
3. Missing Thor with upgrade option in advanced tactics

**Fix**: Rewrote the function at lines 185-211 to match Python implementation:
```javascript
export function terran_competent_ground_to_air(snapshot, staticData) {
    const advancedTactics = isAdvancedTactics(staticData);
    if (has(snapshot, 'Goliath')) return true;
    if (has_any(snapshot, ['Marine', 'Dominion Trooper'])
        && terran_bio_heal(snapshot, staticData)
        && count(snapshot, 'Progressive Terran Infantry Weapon') >= 2) {
        return true;
    }
    if (advancedTactics) {
        if (has(snapshot, 'Cyclone')) return true;
        if (has_all(snapshot, ['Thor', 'Progressive High Impact Payload (Thor)'])) return true;
    }
    return false;
}
```

**Seeds affected**: Seed 2 (and likely others)

---

### Issue 4: terran_welcome_to_the_jungle_requirement missing power rating check
**Problem**: The JS helper was missing the power rating check (>= 5) that exists in Python. Also missing 'Dominion Trooper' in the advanced tactics path.

**Python code** (lines 1868-1874):
```python
if self.terran_power_rating(state) < 5:
    return False
return (...) or (
    self.advanced_tactics
    and state.has_any({item_names.MARINE, item_names.DOMINION_TROOPER, item_names.VULTURE}, self.player)
    and self.terran_air_anti_air(state)
)
```

**Fix**: Added power rating check and Dominion Trooper at lines 2064-2078:
```javascript
terran_welcome_to_the_jungle_requirement: function(snapshot, staticData) {
    if (terran_power_rating(snapshot, staticData) < 5) {
        return false;
    }
    const advancedTactics = isAdvancedTactics(staticData);
    return (
        terran_common_unit(snapshot, staticData)
        && terran_competent_ground_to_air(snapshot, staticData)
    ) || (
        advancedTactics
        && has_any(snapshot, ['Marine', 'Dominion Trooper', 'Vulture'])
        && terran_air_anti_air(snapshot, staticData)
    );
},
```

**Seeds affected**: Seed 2
