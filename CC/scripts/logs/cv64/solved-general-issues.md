# Solved General Issues for Castlevania 64

## Issue 1: Dracula Location Accessible Too Early ✓

**Status:** SOLVED
**Priority:** High
**Test Failure:** Sphere 2.4

**Error Details:**
- Locations accessible in STATE (and unchecked) but NOT in LOG: Dracula
- Regions accessible in STATE but NOT in LOG: Castle Keep: Dracula's chamber

**Root Cause:**
This was actually an exporter issue, not a general logic issue. The access rule for "Dracula's door" entrance was being exported as a complex conditional that returned item names as constant strings instead of proper `item_check` rules. The rule engine couldn't evaluate these string constants as item requirements.

**Solution:**
See Issue 2 in `solved-exporter-issues.md`. The fix was to update the `postprocess_entrance_rule` method in the exporter to detect and properly handle the Dracula's door rule.

**Result:**
The spoiler test now passes. The Dracula location and Castle Keep: Dracula's chamber region are only accessible when the player has the Crystal item (or other required items depending on settings), matching the Python logic exactly.
