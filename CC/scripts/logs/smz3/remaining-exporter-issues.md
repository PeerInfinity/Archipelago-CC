# SMZ3 Remaining Exporter Issues

*Last updated: 2025-11-25*

## Status

Most exporter issues have been resolved. One known limitation remains.

## Known Limitations

### 1. Regressive Accessibility Due to Anti-Softlock Rules

**Description:** Some locations in SMZ3 have anti-softlock rules that INCREASE key requirements when the player has certain items (like Bow+Hammer+Lamp). This creates a semantic difference between:

1. **Python sphere calculation (cumulative):** Once a location becomes accessible, it stays accessible. If a player reaches a location at Sphere 5 with 5 keys (before getting Bow), the location remains accessible even if they later collect Bow (which would increase the requirement to 6).

2. **Frontend rule evaluation (real-time):** The frontend evaluates rules based on current inventory. If the player has Bow+Hammer+Lamp, the rule correctly requires 6 keys, even if the location was previously accessible with 5 keys.

**Example:** Palace of Darkness - Harmless Hellway
- Python rule: `KeyPD >= (6 if Bow+Hammer+Lamp else 5)`
- At Sphere 5.7: 5 keys, no Bow → 5 >= 5 = accessible ✓
- At Sphere 9.4: 5 keys + Bow → 5 >= 6 = not accessible
- Python says still accessible (cumulative), frontend says not accessible (real-time)

**Impact:** Some seeds may fail the spoiler test at specific spheres where this pattern occurs. The frontend's behavior is actually CORRECT for a practical randomizer tracker - it shows what's accessible with current items.

**Potential Future Fixes:**
1. Track historical accessibility in the frontend (once accessible, always accessible until checked)
2. Accept this as a known limitation since the frontend is technically correct

**Affected Seeds:** Varies by seed depending on item placement order
