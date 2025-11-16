# Solved Exporter Issues for Castlevania 64

## Issue 1: Missing Item Data Export ✓

**Status:** SOLVED
**Priority:** High
**Error Message:** "Handler for Castlevania 64 returned no item data. Item export might be incomplete."

**Root Cause:**
The CV64 exporter was inheriting from `BaseGameExportHandler` instead of `GenericGameExportHandler`. The `GenericGameExportHandler` provides automatic item data discovery from `world.item_name_to_id`, while `BaseGameExportHandler` returns an empty dict by default.

**Solution:**
Changed the exporter to inherit from `GenericGameExportHandler`:
```python
from .generic import GenericGameExportHandler

class Cv64GameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Castlevania 64'
```

**Result:**
The exporter now successfully exports 38 items with their proper classifications (advancement, useful, trap, event flags).

**Location:** `exporter/games/cv64.py:4,10`

---

## Issue 2: Dracula's Door Access Rule Not Properly Exported ✓

**Status:** SOLVED
**Priority:** High
**Related Test Failure:** Sphere 2.4 - Dracula location accessible too early

**Root Cause:**
The `can_enter_dracs_chamber` method was being analyzed into a complex conditional that compared constants and returned item names as strings (e.g., `{'type': 'constant', 'value': 'Crystal'}`), not as proper `item_check` rules. The `postprocess_entrance_rule` method only handled the case where the rule was `{'type': 'constant', 'value': None}`, missing the conditional case.

**Solution:**
Updated `postprocess_entrance_rule` to detect and handle the conditional pattern for "Dracula's door":
```python
# Special handling for Dracula's door
if entrance_name == "Dracula's door":
    # Check if it's a null constant or a conditional with Dracula-related items
    if (rule.get('type') == 'constant' and rule.get('value') is None):
        # Expand the Dracula helper directly
        return self.expand_helper("Dracula")
    elif rule.get('type') == 'conditional':
        # The analyzer exported a complex conditional for Dracula's door
        # Instead of trying to parse it, just use our helper which knows the correct logic
        return self.expand_helper("Dracula")
```

**Result:**
The access rule for "Dracula's door" is now correctly exported as:
```json
{'type': 'item_check', 'item': 'Crystal'}
```
(or Trophy/Special2 depending on the world's drac_condition option)

**Location:** `exporter/games/cv64.py:136-150`
