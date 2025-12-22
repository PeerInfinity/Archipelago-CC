# Remaining Exporter Issues for Starcraft 2

This document tracks exporter issues that need to be fixed for the SC2 game.

## Issues

### Issue 2: Helper function arguments not preserved during export

**Status:** IN PROGRESS

**Description:**
When the exporter exports a location rule that calls a helper with arguments (e.g., `terran_competent_comp(state, 2)`), the arguments are not preserved in the exported rules.json. All helper calls become `{"rule": "terran_competent_comp"}` without the upgrade level argument.

**Example:**
Python location definition:
```python
# Victory uses upgrade_level=2
lambda state: logic.terran_competent_comp(state, 2)

# Close Coolant Tower uses upgrade_level=1 (default)
logic.terran_competent_comp
```

Exported JSON (WRONG - both show the same):
```json
{"rule": "terran_competent_comp"}
```

Expected JSON:
```json
// Victory
{"rule": "terran_competent_comp", "args": [2]}

// Close Coolant Tower
{"rule": "terran_competent_comp"}
```

**Affected locations at Sphere 7.1:**
- Shatter the Sky (Terran): Victory (needs upgrade_level=2)
- Shatter the Sky (Terran): Southeast Coolant Tower (needs upgrade_level=2)
- Shatter the Sky (Terran): Southwest Coolant Tower (needs upgrade_level=2)
- Shatter the Sky (Terran): Leviathan (needs upgrade_level=2)
- Beat Shatter the Sky (Terran) (needs upgrade_level=2)

**Impact:**
These locations become accessible too early because the JavaScript helper uses the default upgradeLevel=1 instead of 2.

**Fix:**
The exporter needs to preserve helper arguments when converting lambda rules to JSON.
