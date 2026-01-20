# Rule Format Inconsistencies and Improvements

This document captures format inconsistencies discovered during Phase 4 implementation (frontend evaluator and UI support for Rule Builder format), along with proposed solutions.

## Issues Discovered

### 1. Nested `args` Structure in Converted Helpers

**Problem**: When helpers are converted from AST to Rule Builder format, they have an awkward double-nested structure:

```json
{
  "rule": "has_melee_weapon",
  "args": {
    "args": [],
    "_original_ast_type": "helper"
  },
  "_converted_from_cc": true
}
```

The `args.args` nesting is redundant and confusing. The inner `args` array contains the actual helper arguments, while the outer `args` object is the Rule Builder args container.

**Current Workaround**: The evaluator's default case checks for `args._original_ast_type === 'helper'` and extracts `args.args`:

```javascript
// ruleEngine.js:5643-5651 (supports both old and new formats)
if (Array.isArray(args)) {
  // New flattened format - args is directly an array
  helperArgs = args;
} else if (args._original_ast_type === 'helper' && Array.isArray(args.args)) {
  // Old nested format - args.args contains the helper arguments
  helperArgs = args.args;
}
```

**Proposed Solution**: Flatten the structure at export time:

```json
{
  "rule": "has_melee_weapon",
  "args": [],
  "_original_ast_type": "helper",
  "_converted_from_ast": true
}
```

**Files to Modify**:
- `exporter/converter/ast_to_rule_builder.py` - Change helper conversion logic
- `rule_builder/rules.py` - Update `HelperCall._get_args_dict()` if needed

**Impact**: Simplifies evaluator logic, reduces confusion, smaller file sizes.

---

### 2. Inconsistent Location List Formats in AST_placement_search

**Problem**: The `locations` argument in `AST_placement_search` can appear in two different formats:

**Format A** - Pre-evaluated constant:
```json
{
  "rule": "AST_placement_search",
  "args": {
    "locations": {
      "type": "constant",
      "value": [
        ["Ganons Tower - Randomizer Room - Top Left", 1],
        ["Ganons Tower - Randomizer Room - Top Right", 1]
      ]
    }
  }
}
```

**Format B** - Nested list structure:
```json
{
  "rule": "AST_placement_search",
  "args": {
    "locations": {
      "type": "list",
      "value": [
        {
          "type": "list",
          "value": [
            {"type": "constant", "value": "Ice Palace - Spike Room"},
            {"type": "constant", "value": 1}
          ]
        }
      ]
    }
  }
}
```

**Current Workaround**: The evaluator handles both formats by checking `type` and recursively evaluating:

```javascript
// ruleEngine.js:4664-4678
if (locations.type === 'constant') {
  locations = locations.value;
} else if (locations.type === 'list' && Array.isArray(locations.value)) {
  // Recursively evaluate list items
  locations = locations.value.map(item => {
    if (item && typeof item === 'object' && (item.type || item.rule)) {
      return evaluateRule(item, context, depth + 1, localScope);
    }
    return item;
  });
} else if (locations.type || locations.rule) {
  locations = evaluateRule(locations, context, depth + 1, localScope);
}
```

**Proposed Solution**: Standardize on pre-evaluated format at export time. When exporting `AST_placement_search`, always flatten the locations to simple `[[name, player], ...]` arrays.

**Files to Modify**:
- `exporter/converter/ast_to_rule_builder.py` - Pre-evaluate constant lists during conversion

**Impact**: Simplifies evaluator, faster runtime evaluation.

---

### 3. Dungeon String vs Object Resolution

**Problem**: In the rules data, `region.dungeon` is stored as a string (dungeon name), but access rules chain methods like `.boss.can_defeat()`. This requires runtime resolution.

**Example Data**:
```json
{
  "name": "Tower of Hera (Entrance)",
  "dungeon": "Tower of Hera"   // String, not object
}
```

**Access Rule** (expects object):
```
location.parent_region.dungeon.boss.can_defeat()
```

**Current Workaround**: Both `ruleEngine.js` and `statePersistence.js` have special attribute resolution:

```javascript
// statePersistence.js:787-797
if (attributeName === 'dungeon' && baseObject && typeof baseObject.dungeon === 'string') {
  const dungeonName = baseObject.dungeon;
  // Look up the actual dungeon object from sm.dungeons
  if (sm.dungeons && sm.dungeons instanceof Map && sm.dungeons.has(dungeonName)) {
    return sm.dungeons.get(dungeonName);
  }
  // Also try plain object access if not a Map
  if (sm.dungeons && !(sm.dungeons instanceof Map) && sm.dungeons[dungeonName]) {
    return sm.dungeons[dungeonName];
  }
}
```

**Proposed Solutions**:

**Option A**: Store dungeon as object reference at export time:
```json
{
  "name": "Tower of Hera (Entrance)",
  "dungeon": {"$ref": "dungeons.Tower of Hera"}
}
```
This would require a reference resolution step during rules loading.

**Option B**: Keep current approach but document it as expected behavior.

**Option C**: Store inline dungeon object (increases file size but simplifies evaluation).

**Recommendation**: Option B for now - the current workaround is efficient and works. Document the pattern.

---

### 4. Boss vs Bosses Naming Mismatch

**Problem**: Dungeons store bosses in a `bosses` object (plural, keyed by position like "None", "top", "bottom"), but access rules use `.boss` (singular).

**Dungeon Data**:
```json
{
  "name": "Tower of Hera",
  "bosses": {
    "None": {
      "name": "Moldorm",
      "defeat_rule": {...}
    }
  }
}
```

**Access Rule**:
```
location.parent_region.dungeon.boss.can_defeat()
```

**Current Workaround**: The evaluator maps `.boss` to `.bosses["None"]` or first boss:

```javascript
// ruleEngine.js:1506-1517
if (rule.attr === 'boss') {
  const hasBoss = baseObject.boss !== undefined;
  const hasBosses = baseObject.bosses !== undefined;

  if (!hasBoss && hasBosses) {
    // Use the new bosses format - default to "None" entry
    const boss = baseObject.bosses["None"] || Object.values(baseObject.bosses)[0];
    return boss;
  }
}
```

**Proposed Solutions**:

**Option A**: Add a `boss` property at export time that points to the default boss:
```json
{
  "name": "Tower of Hera",
  "boss": {"$ref": "#/bosses/None"},
  "bosses": {...}
}
```

**Option B**: Change the access rule format to explicitly use `bosses["None"]` or a helper.

**Option C**: Keep current approach - it handles multi-boss dungeons gracefully.

**Recommendation**: Option C for now. The user mentioned "some dungeons have more than one boss" - the current approach handles this by defaulting to "None" or first boss, which matches Python behavior.

---

## Summary Table

| Issue | Severity | Fix Location | Status |
|-------|----------|--------------|--------|
| Nested args in helpers | Medium | Exporter | **FIXED** |
| Inconsistent location lists | Low | Exporter | **FIXED** |
| Dungeon string vs object | Low | N/A | Document as expected |
| Boss vs bosses naming | Low | N/A | Document as expected |

---

## Implementation Status

### Fixed (2025-12-19)

**Issue 1: Nested args in helpers** - Fixed in `exporter/converter/ast_to_rule_builder.py`
- Modified `_convert_helper()` to output flattened structure
- Helper args are now a direct array at the `args` key
- `_original_ast_type` moved to rule level

**Issue 2: Inconsistent location lists** - Fixed in `exporter/converter/ast_to_rule_builder.py`
- Added dedicated `_convert_placement_search()` converter
- Locations are now flattened to simple `[[name, player], ...]` format
- Added helper methods: `_flatten_locations()`, `_flatten_inner_list()`, `_flatten_single_location()`

### Documented as Expected Behavior

Issues 3 (dungeon string vs object) and 4 (boss vs bosses naming) are working correctly with evaluator workarounds and should remain as-is.

---

## Related Files

**Evaluator Workarounds**:
- `frontend/modules/shared/ruleEngine.js` - Lines 1506-1517 (boss resolution), 4664-4678 (placement search), 5643-5651 (helper args)
- `frontend/modules/stateManager/core/statePersistence.js` - Lines 787-797 (dungeon string resolution)

**Converter** (where fixes were applied):
- `exporter/converter/ast_to_rule_builder.py` - Lines 996-1033 (`_convert_helper`), 1317-1449 (`_flatten_locations`, `_convert_placement_search`)

**Documentation**:
- `CC/docs/plans/partial/rule-format-migration-plan.md`
