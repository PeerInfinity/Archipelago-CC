# Remaining Helper Issues for Ocarina of Time

This document tracks issues related to the OOT helper functions (`frontend/modules/shared/gameLogic/oot/ootLogic.js`).

Status: Initial test run complete - multiple missing helpers identified

## Missing Helper Functions

These helper functions are referenced in the rule strings but not implemented in `ootLogic.js`:

### Core Helpers

1. **can_leave_forest** - Determines if player can leave Kokiri Forest
2. **has_shield** - Checks if player has a shield (Deku Shield or Hylian Shield)
3. **can_child_attack** - Checks if child can attack (has sword, stick, or other weapon)

### Dungeon Helpers

4. **deku_tree_shortcuts** - Checks if Deku Tree shortcuts are enabled
5. **can_stun_deku** - Checks if player can stun Deku Babas

### Logic Trick Helpers

6. **logic_lab_wall_gs** - Logic trick for Lab Wall Gold Skulltula
7. **logic_kakariko_tower_gs** - Logic trick for Kakariko Tower Gold Skulltula

### Item Collection Helpers

8. **has_all_stones** - Checks if player has all Spiritual Stones
9. **can_break_upper_beehive** - Checks if player can break upper beehives
10. **can_break_lower_beehive** - Checks if player can break lower beehives

**Note:** Will implement these helpers after exporter issues are fixed to ensure rule strings are being properly exported.
