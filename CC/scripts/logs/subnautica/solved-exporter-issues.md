# Solved Exporter Issues for Subnautica

## Issue 1: Capability Rule Generation
**Problem**: The GenericGameExportHandler was automatically expanding helper functions like `can_access_location` into "capability" rules that the frontend rule engine doesn't know how to handle.

**Solution**: Override the `expand_rule` method in SubnauticaGameExportHandler to prevent automatic expansion of helpers and keep them as helper nodes. This allows the helpers to be properly implemented in the frontend.

**Files Modified**:
- `exporter/games/subnautica.py` - Added expand_rule override

**Commit**: Initial commit
