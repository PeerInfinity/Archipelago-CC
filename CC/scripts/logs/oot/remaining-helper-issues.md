# Remaining Helper Issues for Ocarina of Time

## Summary
This document tracks helper function implementation issues for Ocarina of Time (OOT).

## Status
- **Current Test Status**: FAILING at Sphere 0
- **Test Date**: 2025-11-19
- **Seed**: 1 (AP_14089154938208861744)

## Critical Issue: All locations accessible at Sphere 0

**Symptom**: The spoiler test shows that ALL OOT locations (600+) are accessible at sphere 0, when only a handful should be accessible with no items.

**Root Cause**: The `parse_oot_rule` helper function in `frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js` is not properly implemented.

**Current Implementation**: The helper exists but doesn't actually parse or evaluate OOT's custom DSL syntax. It appears to be returning `true` or not evaluating rules correctly.

**What Needs to be Done**:
1. Implement a proper OOT DSL parser that can handle OOT's rule syntax
2. The DSL includes:
   - Item checks (e.g., "Hookshot")
   - Item counts (e.g., "(Progressive_Wallet, 2)")
   - Boolean logic (e.g., "is_adult and Hover_Boots")
   - Subrule/helper references
   - And many more OOT-specific patterns

**Files Affected**:
- `frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js` - main implementation file

**Example Rule Strings** (from OOT):
- Simple: `"True"`, `"False"`
- Item check: `"Hookshot"`
- Count check: `"(Progressive_Wallet, 2)"`
- Boolean: `"is_adult and Hover_Boots"`
- Complex: `"(Progressive_Scale, 2) or can_use_din"`

**UPDATE**: The helper function is actually well-implemented. The problem is that the exporter is not calling it! See remaining-exporter-issues.md for details.

**Priority**: BLOCKED - Waiting for exporter fix.
