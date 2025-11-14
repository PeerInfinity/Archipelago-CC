# Remaining General Issues

## Issue 1: Helper function logic mismatch - cansee_clouds returns false in Sphere 0
- **Problem**: `cansee_clouds()` helper function returns false when Python expects true
- **Affected Locations**: "Hop! Hop! Donut Lifts: Stars" and "Touch Fuzzy Get Dizzy: Stars"
- **Current State**:
  - Settings exported correctly: StageLogic=0, HiddenObjectVisibility=1, ItemLogic=0
  - JavaScript logic evaluates to false with no items
  - Python logic (in spheres log) shows these locations accessible in Sphere 0
- **Analysis**:
  - StageLogic=0 (strict) → game_logic = "Easy"
  - HiddenObjectVisibility=1 (coins_only, not clouds_only=2) → clouds_always_visible = false
  - ItemLogic=0 → consumable_logic = true
  - With no items: default_vis=false, Secret Lens=false, combat_item=false
  - Therefore cansee_clouds returns false
- **Next Steps**:
  - Verify template default values for hidden_object_visibility
  - Check if Python logic has a different interpretation
  - Investigate why Python considers these locations accessible with these settings


