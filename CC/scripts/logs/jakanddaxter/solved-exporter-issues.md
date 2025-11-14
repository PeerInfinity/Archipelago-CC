# Solved Exporter Issues

## Issue 1: Missing orb_count in region export

**Status**: SOLVED
**Priority**: High
**Solved at**: Sphere test now passes all 197 events

**Description**: Regions were not exporting the `orb_count` attribute, which is needed by the `can_reach_orbs` helper function to calculate how many orbs are reachable. This caused 15 orb trade locations to fail accessibility checks.

**Root Cause**: The JakAndDaxterGameExportHandler did not override the `get_region_attributes()` method from GenericGameExportHandler, so region-specific attributes like `orb_count` were not being included in the exported rules.json file.

**Solution**: Added `get_region_attributes()` method to JakAndDaxterGameExportHandler (exporter/games/jakanddaxter.py:287-304).

**Verification**: After implementing this fix and regenerating rules.json, all 197 sphere events pass validation in the spoiler test.

