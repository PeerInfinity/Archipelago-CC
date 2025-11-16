# Remaining Helper Issues for Ocarina of Time

This document tracks unresolved issues in the OOT helper functions (frontend/modules/shared/gameLogic/oot/ootLogic.js).

## Issues

### Missing Helper Functions (from LogicHelpers.json)

The following helpers need to be implemented based on definitions from `worlds/oot/data/LogicHelpers.json`:

1. **can_leave_forest** (Line 45)
   - Definition: `open_forest != 'closed' or is_adult or is_glitched or Deku_Tree_Clear`
   - Required for Kokiri Forest access logic

2. **has_shield** (Line 97)
   - Definition: `(is_adult and Hylian_Shield) or (is_child and Deku_Shield)`
   - Used for shield-dependent checks

3. **deku_tree_shortcuts** (Line 135)
   - Definition: `'Deku Tree' in dungeon_shortcuts`
   - Checks if Deku Tree shortcuts are enabled

4. **can_child_attack** (Line 41)
   - Definition: `is_child and (Slingshot or Boomerang or Sticks or Kokiri_Sword or has_explosives or can_use(Dins_Fire))`
   - Used for combat checks as child

5. **can_stun_deku** (Line 48)
   - Definition: `is_adult or (Slingshot or Boomerang or Sticks or Kokiri_Sword or has_explosives or can_use(Dins_Fire) or Nuts or Deku_Shield)`
   - Used for stunning Deku Scrubs

6. **has_all_stones** (Line 106)
   - Definition: `Kokiri_Emerald and Goron_Ruby and Zora_Sapphire`
   - Used for bridge/LACS checks

7. **can_break_upper_beehive** (Line 68)
   - Definition: `can_use(Boomerang) or can_use(Hookshot) or (logic_beehives_bombchus and has_bombchus)`
   - Used for beehive locations

8. **can_break_lower_beehive** (Line 67)
   - Definition: `can_use(Boomerang) or can_use(Hookshot) or Bombs or (logic_beehives_bombchus and has_bombchus)`
   - Used for beehive locations

### Logic Trick Settings

These are settings-based checks that need implementation:

9. **logic_lab_wall_gs**
   - Logic trick for Kakariko Potion Shop lab wall Gold Skulltula
   - Should check `settings.logic_tricks` array

10. **logic_kakariko_tower_gs**
    - Logic trick for Kakariko tower Gold Skulltula
    - Should check `settings.logic_tricks` array
