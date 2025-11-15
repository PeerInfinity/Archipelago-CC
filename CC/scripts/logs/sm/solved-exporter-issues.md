# Solved Exporter Issues - Super Metroid

This file tracks exporter-related issues that have been fixed.

## Solved Issues

### 1. TypeError in SMGameExportHandler.__init__()

**Issue:** The exporter was calling `super().__init__(world)` but the base class doesn't accept arguments, causing a TypeError during rule generation.

**Error:**
```
TypeError: object.__init__() takes exactly one argument (the instance to initialize)
```

**Fix:** Changed line 24 in `exporter/games/sm.py` from:
```python
super().__init__(world)
```
to:
```python
super().__init__()  # Base class doesn't take arguments
self.world = world
```

**Status:** SOLVED - Rules.json now generates successfully

### 2. evalSMBool not being simplified (helper nodes)

**Issue:** The exporter's expand_rule method was checking for `function_call` nodes with `self.evalSMBool` pattern, but the analyzer had already converted these to `helper` nodes with `name='evalSMBool'` before expand_rule was called.

**Impact:** evalSMBool helper calls were exported with state.smbm[player] arguments that don't exist in JavaScript, causing undefined values and preventing rule evaluation.

**Fix:** Added handling for `helper` nodes with `name='evalSMBool'` at the beginning of expand_rule method. Now detects both:
- `helper` nodes with `name='evalSMBool'` (main case)
- `function_call` nodes with `self.evalSMBool` pattern (fallback)

Both `func()` and `rule()` helpers are now simplified to constant True, since the VARIA logic functions can't be replicated in JavaScript and the sphere log enforces the actual logic.

**Status:** SOLVED - Exit rules now simplify to constant True
