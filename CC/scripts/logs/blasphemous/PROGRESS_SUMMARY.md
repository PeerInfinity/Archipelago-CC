# Blasphemous Exporter Progress Summary

## Session Date: 2025-11-16

### Issues Fixed

#### 1. Item/Group/Count Field Wrapping Bug (Analyzer)
**Commit**: cfda0418
**Files**: `exporter/analyzer/ast_visitors.py`

**Problem**: The analyzer was wrapping item/group names in constant objects `{'type': 'constant', 'value': '...'}` instead of plain strings.

**Fix**: Modified analyzer to extract string values from constant objects for:
- item_check rules (lines 732, 735)
- group_check rules (lines 761-769)
- has_any item lists (lines 788-798)
- count_check rules (lines 799-810)

**Impact**: Fixed hundreds of locations being incorrectly marked as accessible in Sphere 0.

#### 2. get_item_data() List vs Dict Bug (Blasphemous Exporter)
**Commit**: cfda0418
**Files**: `exporter/games/blasphemous.py`

**Problem**: The exporter's `get_item_data()` assumed `item_table` was a dict, but in Blasphemous it's a list of dicts.

**Fix**: Modified iteration to handle list structure properly.

**Impact**: Eliminated generation error: `'list' object has no attribute 'items'`

#### 3. Invalid Rule Types (capability, boss_check, etc.)
**Commit**: 41a5d100
**Files**: `exporter/games/blasphemous.py`

**Problem**: The `_expand_dynamic_helper()` method created rules with invalid types that don't exist in rules.schema.json:
- 'capability' for ability checks
- 'boss_check' for boss defeats
- Custom 'can_reach' type for region access

**Fix**: Changed all dynamic helpers to use 'helper' type, delegating to helper functions in blasphemousLogic.js.

**Impact**: Eliminated "Unknown rule type: capability" errors in frontend.

### Current Status

**Exporter**: ✅ Working correctly
- Region graph properly exported with exits
- Menu -> D17Z01S01 starting connection exists
- item_check rules use plain strings
- All rule types are valid

**Test Status**: ❌ Still failing at Sphere 0
- **Error**: "Locations accessible in LOG but NOT in STATE"
- **Cause**: Likely helper function issues, not exporter issues
- **Details**: 75+ locations expected in Sphere 0 are not reachable

### Next Steps

The remaining issues are **helper function problems**, not exporter problems:

1. **Identify failing helpers**: Run test with detailed logging to see which helper functions are called
2. **Compare implementations**: Check if JS helpers match Python helpers
3. **Fix/implement helpers**: Update blasphemousLogic.js as needed

### Files Modified

1. `exporter/analyzer/ast_visitors.py` - Fixed item/group/count field wrapping
2. `exporter/games/blasphemous.py` - Fixed get_item_data() and invalid rule types

### Test Commands

```bash
# Generate rules
python Generate.py --weights_file_path "Templates/Blasphemous.yaml" --multi 1 --seed 1

# Run spoiler test
npm test --mode=test-spoilers --game=blasphemous --seed=1

# Run full template test (if spoiler test passes)
python scripts/test/test-all-templates.py --retest --retest-continue 10 -p
```

### Metrics

- **Exporter bugs fixed**: 3
- **Test improvement**: From "hundreds of locations incorrectly accessible" to "75+ locations incorrectly inaccessible"
- **Commits pushed**: 2 (cfda0418, 41a5d100)
- **Branch**: `claude/fix-blasphemous-exporter-01Mczx7oDRNxsnTD4xWHHpsu`
