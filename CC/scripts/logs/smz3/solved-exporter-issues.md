# Solved Exporter Issues

## Issue 1: BOM Character in Source Files Causing Lambda Parsing Failures ✓

**Description**: The SMZ3 Python source files contained a BOM (Byte Order Mark) character (U+FEFF) at the beginning of files, which was causing the lambda source extraction to fail with syntax errors.

**Solution**: Changed file reading encoding from `'utf-8'` to `'utf-8-sig'` in `exporter/analyzer/source_extraction.py`. The `utf-8-sig` encoding automatically strips the BOM character when reading files.

**Files Modified**:
- `exporter/analyzer/source_extraction.py:68` - Changed encoding in `get_multiline_lambda_source()`
- `exporter/analyzer/source_extraction.py:118` - Changed encoding in `_read_multiline_lambda()`

**Result**: All syntax errors eliminated. All location rules now export successfully.

---

## Issue 2: Items Variable References Not Converted to State Lookups ✓

**Description**: The SMZ3 `canAccess` lambda functions use an `items` parameter (TotalSMZ3 Progression object), but the exported rules left these as `{"type": "name", "name": "items"}` references instead of converting them to proper item checks.

**Evidence**: Frontend console showed "Name 'items' NOT FOUND in context" errors for all location rules.

**Solution**: Added postprocessing in `exporter/games/smz3.py` to convert:
- `items.AttributeName` → `{"type": "item_check", "item": "AttributeName"}`
- `items.MethodName()` → `{"type": "helper", "name": "smz3_MethodName", "args": [...]}`

**Files Modified**:
- `exporter/games/smz3.py:102-206` - Enhanced `postprocess_rule()` method

**Result**: All "items" references properly converted. Location rules now evaluate without variable resolution errors.

