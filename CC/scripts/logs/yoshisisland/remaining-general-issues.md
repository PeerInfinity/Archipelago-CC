# Remaining General Issues

## Issue 1: Settings not being exported to rules.json
- **Problem**: Yoshi's Island specific settings (StageLogic, HiddenObjectVisibility, ShuffleMiddleRings, ItemLogic, BowserDoorMode, etc.) are not being exported to rules.json
- **Current State**: Only `game` and `assume_bidirectional_exits` are in settings
- **Impact**: Helper functions can't determine game logic difficulty, visibility settings, etc.
- **Impact Details**:
  - `cansee_clouds()` needs to know StageLogic (for game_logic difficulty)
  - `cansee_clouds()` needs HiddenObjectVisibility (for clouds_always_visible)
  - `cansee_clouds()` and other helpers need ItemLogic (for consumable_logic)
  - `has_midring()` needs ShuffleMiddleRings
  - Other helpers need BowserDoorMode and LuigiPiecesRequired
- **Next Steps**:
  - Check how other games export their settings
  - Update exporter or create custom exporter method to export Yoshi's Island settings


