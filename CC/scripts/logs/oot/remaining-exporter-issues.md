# Remaining Exporter Issues for Ocarina of Time

## Status: In Progress

Last Updated: 2025-11-20

## Active Issues

### 1. Sphere 0.8 Mismatch - Deku Tree Slingshot Room Access

**Severity:** High
**Type:** Helper Issue
**Status:** Under Investigation

**Description:**
The spoiler test fails at Sphere 0.8 with the following mismatches:

- **Locations accessible in STATE but NOT in LOG:**
  - `Deku Tree Slingshot Chest`
  - `Deku Tree Slingshot Room Side Chest`

- **Regions accessible in STATE but NOT in LOG:**
  - `Deku Tree Slingshot Room`

**Root Cause Analysis:**

The entrance from "Deku Tree Lobby" to "Deku Tree Slingshot Room" has the rule:
```json
{
  "type": "helper",
  "name": "parse_oot_rule",
  "args": [{"type": "constant", "value": "here(has_shield)"}]
}
```

At Sphere 0.8, the player acquires "Buy Deku Shield".

**Python Logic:**
- `has_shield` is defined as: `(is_adult and Hylian_Shield) or (is_child and Deku_Shield)`
- Item aliases expand:
  - `Deku_Shield` → `Buy_Deku_Shield or Deku_Shield_Drop`
  - `Hylian_Shield` → `Buy_Hylian_Shield`
- For a child with Buy Deku Shield: `(False and ...) or (True and True)` = True
- Yet Python did NOT make the room accessible at Sphere 0.8

**JavaScript Implementation:**
- `has_shield` helper was updated to explicitly check Buy_Deku_Shield
- Returns true for child with Buy_Deku_Shield
- This makes the room accessible (incorrectly matching Python result logic but not timing)

**Hypothesis:**
The `here()` function in Python may have special semantics beyond simple rule evaluation. From `worlds/oot/RuleParser.py`:
```python
def here(self, node):
    return self.replace_subrule(self.current_spot.parent_region.name, node.args[0])
```

This calls `replace_subrule` with the parent region's name, suggesting region-specific context that may affect evaluation timing.

**Current Status:**
- ✅ OOT logic module exists and is registered
- ✅ `parse_oot_rule` helper function exists and has comprehensive DSL parser
- ✅ Item aliases are defined in itemAliases (lines 751-770 of ootLogic.js)
- ✅ has_shield and can_shield updated with explicit alias expansion
- ❌ Still getting same Sphere 0.8 mismatch
- ❓ Need to understand Python's `here()` function and `replace_subrule` logic

**Test Command:**
```bash
npm test --mode=test-spoilers --game=oot --seed=1
```

**Files Modified:**
- `frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js` - Updated has_shield and can_shield
- `frontend/presets/preset_files.json` - Added "oot" entry

**Next Steps:**
1. Investigate Python's `replace_subrule` function to understand region-based evaluation
2. Check if `here()` in JavaScript needs special implementation beyond simple evaluation
3. Consider if this is a timing issue with when items become effective in state
4. May need to look at other successful games' implementations of region-scoped helpers
5. Check if the issue is with state snapshot timing rather than rule evaluation

**Related Code:**
- `frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js:327-353` - has_shield and can_shield helpers
- `frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js:875-878` - here() function handler
- `worlds/oot/RuleParser.py` - Python here() implementation
- `worlds/oot/data/LogicHelpers.json` - Python logic helpers and aliases
