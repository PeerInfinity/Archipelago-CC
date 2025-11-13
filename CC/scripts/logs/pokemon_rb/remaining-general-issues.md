# Pokemon Red and Blue - Remaining General Issues

This file tracks general issues that still need to be fixed.

## Issues

### Issue 1: Safari Zone regions not reachable at Sphere 3.9

**Symptom:** Test fails at Sphere 3.9 with 82 locations missing from state, including all Safari Zone locations and locations requiring Safari Zone access (Terry Trade, Fuchsia Gym, etc.)

**Expected Behavior:**
- At Sphere 3.9, Poke Flute is obtained
- This should unlock Routes 12 and 16 (blocked by Snorlax)
- This should make Safari Zone, Fuchsia City, Lavender Town, and Celadon City reachable

**Actual Behavior:**
- Safari Zone regions and related areas are not being computed as reachable
- "Route 11 Gate 2F - Terry Trade" fails because it requires `can_reach("Safari Zone Center - Wild Pokemon - 5", "Location")`, but Safari Zone isn't reachable

**Python Sphere Log (3.9):**
- `"new_inventory_details": {"base_items": {"Poke Flute": 1}}`
- `"new_accessible_regions": [..., "Safari Zone Center-Wild", "Safari Zone East", "Fuchsia City", ...]`
- `"new_accessible_locations": [..., "Safari Zone Center - Wild Pokemon - 5", ...]`

**Investigation Needed:**
1. Check if Route 12 / Route 16 entry rules are correctly exported
2. Check if Sleeping Pokemon (Snorlax) locations are correctly blocking/unblocking routes
3. Verify Poke Flute logic is properly implemented in helpers or rules
4. Check if there are missing logic helper functions for route access
