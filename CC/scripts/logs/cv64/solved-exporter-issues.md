# Solved Exporter Issues - Castlevania 64

This document tracks exporter issues that have been resolved.

## Solved Issues

### 1. Dracula's door rule block type not handled

**Date Fixed:** 2025-12-08

**Problem:**
The access rule for "Dracula's door" entrance was being exported as a `block` type rule containing complex Python-generated if-elif logic. The `postprocess_entrance_rule` method in the exporter only handled `constant` and `conditional` types, not `block` types.

**Symptoms:**
- At Sphere 2.4, the frontend incorrectly determined that:
  - "Dracula" location was accessible earlier than expected
  - "Castle Keep: Dracula's chamber" region was accessible earlier than expected
- Test failed with mismatch: locations accessible in STATE but NOT in LOG

**Root Cause:**
The Python rule analyzer exported the `can_enter_dracs_chamber` method (which contains if-elif chains) as a `block` type rule. The exporter's `postprocess_entrance_rule` method didn't recognize this pattern and let it pass through unchanged, resulting in invalid rule evaluation.

**Fix:**
Modified `exporter/games/cv64.py` line 227 to also handle `block` type rules for Dracula's door:

```python
elif rule.get('type') in ('conditional', 'block'):
    # The analyzer exported a complex conditional or block for Dracula's door
    # Instead of trying to parse it, just use our helper which knows the correct logic
    return self.expand_helper("Dracula")
```

**Verification:**
- Regenerated rules.json with `python Generate.py --weights_file_path "Templates/Castlevania 64.yaml" --multi 1 --seed 2`
- Confirmed the rule is now correctly exported as `{"type": "item_check", "item": "Crystal"}`
- All 27 sphere events pass in the spoiler test
