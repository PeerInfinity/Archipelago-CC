# Remaining Exporter Issues

## Issue 1: Item type information not exported

**Status:** IN PROGRESS

**Locations affected:**
- Missile (blue Brinstar bottom)
- Missile (blue Brinstar middle)

**Description:** VARIA items have a `Type` field (e.g., "Morph Ball" has `Type='Morph'`) but this is not being exported to rules.json. This causes `haveItem('Morph')` to fail even when the player has "Morph Ball".

**Root cause:** The exporter doesn't call game-specific `collect_item_data()` override. Need to investigate exporter architecture.

**Attempted fix:** Added `collect_item_data` override in SM exporter (exporter/games/sm.py:68), but method is not being called during generation.

**Next steps:** Investigate how exporter instantiates and uses game handlers. May need to modify exporter.py to properly use game handler.

