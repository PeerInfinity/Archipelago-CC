# MegaMan Battle Network 3 - Remaining Exporter Issues

This document tracks remaining issues in the exporter for MegaMan Battle Network 3.

## Issues

### Test Run: Seed 5 (2025-11-17)

**Status**: One test failure at Sphere 3.27 (event 182)

**Issue**: Location "Job: My Navi is sick" not recognized as accessible in JavaScript STATE

**Details**:
- Location: "Job: My Navi is sick"
- Access Rule: `{"type": "item_check", "item": "Recov30 *"}`
- Sphere: 3.27 (event 182 in sphere log)
- Item obtained in same sphere: "Recov30 *" from "Job: Legendary Tomes - Treasure"
- Expected behavior: Location should become accessible when "Recov30 *" is added to inventory
- Actual behavior: JavaScript access rule evaluation returns false/undefined
- Python backend: Correctly identifies location as accessible

**Investigation findings**:
1. The item "Recov30 *" contains an asterisk, but this is not unique - 26 items have asterisks
2. Earlier spheres successfully processed other items with asterisks (e.g., "AirShoes *" in sphere 1.42)
3. The access rule is a simple item_check with no count requirement
4. No progression mapping exists for this item
5. The item is marked as advancement: true, max_count: 2

**Hypothesis**: There may be a timing or state synchronization issue where the inventory update from checking "Job: Legendary Tomes - Treasure" hasn't fully propagated before the accessibility check runs, OR there's a specific issue with how this particular item/location combination is being evaluated.

**Next steps**: Debug the specific evaluation of this location's access rule to see why hasItem("Recov30 *") returns false when it should return true.
