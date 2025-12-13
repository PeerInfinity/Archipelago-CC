# KDL3 Solved Exporter Issues

## Issue 1: `can_reach_boss` helper not inlined (SOLVED)

**Status:** Resolved

**Description:**
The `can_reach_boss` helper was exported as a helper call with complex arguments, but the frontend couldn't evaluate it because there was no helper definition or JavaScript implementation.

**Solution:**
Updated the kdl3 exporter (`exporter/games/kdl3.py`) to:
1. Resolve conditional expressions (`type: "conditional"`) that test against settings values like `open_world`
2. Resolve name references (`type: "name"`) for settings variables like `open_world` and `ow_boss_req`
3. Resolve attribute accesses on setting values to constants
4. Inline the `can_reach_boss` helper by selecting the appropriate branch based on the `open_world` setting

Since `open_world = 1` (true) in this seed, the rule simplifies from a complex conditional to a simple `item_check` for `"<Level Name> - Stage Completion"` items.

---

## Issue 2: Setting attribute access not resolved (SOLVED)

**Status:** Resolved

**Description:**
Rules like "Level 1 Boss - Defeated" had counts defined as attribute accesses:
```json
"count": {
  "type": "attribute",
  "object": {"type": "setting_value", "setting": "ow_boss_requirement"},
  "attr": "value"
}
```

The frontend couldn't resolve these to constant values.

**Solution:**
Added `_resolve_setting_attribute()` method to the kdl3 exporter that:
1. Detects attribute accesses on `setting_value` objects
2. Looks up the setting value from cached settings (checking both direct and under `options`)
3. Resolves `.value` attribute access to a constant

---

## Issue 3: Complex helpers exported as block structures (SOLVED)

**Status:** Resolved

**Description:**
Complex helpers like `can_assemble_rob` and `can_fix_angel_wings` were being analyzed and exported with their full function body, including:
- `type: "block"` statements
- `type: "for_iter"` loops
- `type: "if_statement"` conditionals
- Generator expressions

The frontend doesn't understand these imperative programming constructs.

**Solution:**
1. Added `can_assemble_rob` and `can_fix_angel_wings` to `HELPERS_TO_PRESERVE` set so they're kept as helper calls instead of being inlined
2. Added them to `HELPERS_TO_EXPORT_BLACKLIST` to prevent the analyzer from trying to export their definitions
3. Created JavaScript helper implementations in `frontend/modules/shared/gameLogic/kdl3/helpers.js`
4. Registered the kdl3 helpers in `gameLogicRegistry.js`

The JavaScript helpers receive `copy_abilities` as an argument and implement the equivalent logic:
- `can_assemble_rob`: Checks Coo+Kine, 4 Bukiset ability pairs, and Parasol+Stone
- `can_fix_angel_wings`: Checks all 8 required enemy abilities
