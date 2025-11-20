# Remaining Helper Issues for Ocarina of Time

## Status: In Progress

Last Updated: 2025-11-20

## Active Issues

*No helper-specific issues identified yet. The Sphere 0.8 mismatch needs to be diagnosed first to determine if it's an exporter or helper issue.*

## Potential Helper Functions Needed

Based on the OOT exporter (`exporter/games/oot.py`), the following helper is used:
- `parse_oot_rule` - Parses OOT's custom rule DSL into evaluable format

This helper needs to be implemented in the frontend to process OOT-specific rule strings.

**Files to Create:**
- `frontend/modules/shared/gameLogic/oot/helpers.js` - OOT-specific helper functions

**Next Steps:**
1. Investigate the Sphere 0.8 mismatch to determine if helper functions are the root cause
2. If needed, implement `parse_oot_rule` helper in JavaScript
3. Test and verify the implementation
