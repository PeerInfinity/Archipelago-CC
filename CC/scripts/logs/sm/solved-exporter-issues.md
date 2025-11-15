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
