# SMZ3 Solved Exporter Issues

*Last updated: 2025-11-25*

## Solved Issues

### 1. ItemIs Conditional Evaluation at Export Time

**Problem:** The Python code uses `GetLocation("X").ItemIs(ItemType.KeyPD)` patterns to check what item is placed at a location. This affects key requirements - if a location contains a key, fewer keys are needed to reach it.

**Solution:** The exporter now evaluates ItemIs at export time (since item placements are known) and returns the appropriate branch of the conditional. This correctly handles cases like:
- If location has KeyPD: use lower key requirement
- If location doesn't have KeyPD: use higher key requirement

**Files Modified:** `exporter/games/smz3.py`

### 2. Keysanity Setting Handling

**Problem:** Some Palace of Darkness rules include `or config.Keysanity` in conditionals.

**Solution:** The exporter treats `config.Keysanity` as false (non-keysanity mode) and simplifies OR conditions accordingly. This removes the keysanity branch from conditionals.

**Files Modified:** `exporter/games/smz3.py`
