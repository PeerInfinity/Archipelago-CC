# Bomb Rush Cyberfunk Helper Export Plan

## Current Status

**Spoiler tests: PASSING** - JavaScript fallback implementations work correctly.

### Blacklisted Helpers

The following helpers are blacklisted in `exporter/games/bomb_rush_cyberfunk.py` and rely on JavaScript fallbacks:

| Helper | Reason Blacklisted |
|--------|-------------------|
| `graffiti_spots` | Calls `build_access_cache` and `spots_*` functions |
| `build_access_cache` | Uses `globals()[fname]` for dynamic function lookup |
| `spots_s_glitchless` | Uses `for key, val in dict.items()` and `dict[key]` subscript |
| `spots_s_glitched` | Same pattern |
| `spots_m_glitchless` | Same pattern |
| `spots_m_glitched` | Same pattern |
| `spots_l_glitchless` | Same pattern |
| `spots_l_glitched` | Same pattern |
| `spots_xl_glitchless` | Same pattern |
| `spots_xl_glitched` | Same pattern |

### Exported Helpers (Working)

All other helpers are successfully exported, including:
- `graffitiM`, `graffitiL`, `graffitiXL`
- `skateboard`, `inline_skates`, `bmx`
- `camera`, `is_girl`, `current_chapter`, `rep`
- All region access helpers (`versum_hill_*`, `brink_terminal_*`, etc.)

## Required Rule Types Analysis

### Already Supported

The frontend (`ruleEngine.js`) already supports:

1. **`for_iter` with tuple unpacking** (line 4419-4426) - handles `for key, value in dict.items()`
2. **`method_call` for `dict.items()`** (lines 4676-4686) - returns `Object.entries(obj)`
3. **`subscript` for dict lookup** - handles `dict[key]`
4. **`count_group_unique`** via `state_method` - already used by exported helpers

### Blocking Issue: Python Analyzer

The analyzer (`exporter/analyzer/ast_visitors.py` lines 438-445) explicitly blocks functions containing:
```python
for key, value in dict.items():
```

This is a **conservative block** - the frontend CAN handle this pattern, but the analyzer refuses to export it.

### Truly Unsupported: `globals()` Dynamic Lookup

The `build_access_cache` function uses:
```python
func = globals()[fname]
access: bool = func(*fvars)
```

This pattern is **fundamentally unsupportable** for static analysis because:
1. It looks up functions by string name at runtime
2. It calls the function with dynamically unpacked arguments
3. Static analysis cannot determine which functions will be called

## Implementation Options

### Option A: Lift the `dict.items()` Block (Recommended)

**Effort: Low-Medium**

Remove the block on `dict.items()` iteration in the analyzer:

```python
# In ast_visitors.py, modify has_dynamic_for_loops_resolved()
# Remove the block on .items(), .keys(), .values() methods
# The frontend already supports these via method_call and for_iter
```

**Impact:**
- Would allow export of `spots_*` helpers
- `build_access_cache` would still need blacklisting (uses `globals()`)
- `graffiti_spots` could potentially be exported if its dependencies are exportable

**Risk:** Low - the frontend already has the infrastructure

### Option B: Rewrite Helper Logic as Static Rules

**Effort: High**

Rewrite the complex helpers to avoid dynamic patterns:
1. Inline all function calls (no `globals()` lookup)
2. Unroll the dictionary iteration into explicit conditionals

**Impact:**
- Would make all helpers exportable
- Rules would be much larger/more complex
- Would need to maintain parity with Python logic

**Risk:** High - lots of code to maintain, potential for divergence

### Option C: Keep JavaScript Fallbacks (Current State)

**Effort: None**

The current approach works correctly:
- JavaScript implementations in `bomb_rush_cyberfunkLogic.js` are comprehensive
- Spoiler tests pass
- No additional work needed

**Impact:**
- No change to exported rules
- Frontend evaluation works correctly

**Risk:** Low - stable solution

## Recommended Next Steps

1. **Short term:** Keep current JavaScript fallbacks (Option C) since tests pass

2. **Medium term:** Implement Option A to enable `dict.items()` iteration:
   - Modify `has_dynamic_for_loops_resolved()` in `ast_visitors.py`
   - Remove the `.items()`, `.keys()`, `.values()` block
   - Test with a simpler game that uses dict iteration first
   - Then apply to Bomb Rush Cyberfunk `spots_*` helpers

3. **Long term considerations:**
   - `build_access_cache` will always need JavaScript fallback (uses `globals()`)
   - Consider if the `globals()` pattern could be refactored in the original Python

## Technical Details

### Frontend Support Evidence

The frontend already handles dict iteration:

```javascript
// ruleEngine.js line 4677-4679
case 'items':
  // dict.items() - returns array of [key, value] pairs
  result = Object.entries(obj);
  break;

// ruleEngine.js line 4419-4426 (for_iter with tuple unpacking)
if (rule.vars && Array.isArray(rule.vars)) {
  // Tuple unpacking: item should be an array [val1, val2, ...]
  // This handles patterns like: for key, value in dict.items()
  if (Array.isArray(item)) {
    rule.vars.forEach((varName, idx) => {
      if (varName !== '_') {
        localScope[varName] = item[idx];
      }
    });
  }
}
```

### Analyzer Block Location

```python
# ast_visitors.py line 438-445
if isinstance(n.iter, ast.Call):
    if isinstance(n.iter.func, ast.Attribute):
        method_name = n.iter.func.attr
        if method_name in ('keys', 'values', 'items'):
            logging.debug(f"Function has for loop over .{method_name}() - not yet supported")
            return True  # Blocks the function
```

## Files Involved

| File | Purpose |
|------|---------|
| `exporter/games/bomb_rush_cyberfunk.py` | Blacklist configuration |
| `exporter/analyzer/ast_visitors.py` | Analyzer with dict iteration block |
| `frontend/modules/shared/ruleEngine.js` | Frontend evaluation (already supports patterns) |
| `frontend/modules/shared/gameLogic/bomb_rush_cyberfunk/bomb_rush_cyberfunkLogic.js` | JavaScript fallback implementations |
| `worlds/bomb_rush_cyberfunk/Rules.py` | Original Python helpers |
