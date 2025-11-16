# Factorio - Remaining General Issues

This file tracks remaining general issues that are not exporter or helper specific.

## Issues

### 1. Spoiler test still failing despite fixes

**Status:** Active (Under Investigation)
**Priority:** High
**Type:** Test Failure

The spoiler test for Factorio continues to fail at sphere 0.1 even after implementing f_string support, iterator variable binding, and game_info variable resolution.

**Symptoms:**
- 32 locations in sphere 0.1 are not accessible: AP-1-031, AP-1-055, AP-1-076, etc.
- These locations require "Automated automation-science-pack"
- "Automate automation-science-pack" location should be accessible in sphere 0 (has empty required_technologies list)
- The location should grant "Automated automation-science-pack" when collected

**Expected behavior:**
- Sphere 0: "Automate automation-science-pack" becomes accessible (requires no technologies)
- Sphere 0.1: Collecting "Automate automation-science-pack" gives player "Automated automation-science-pack" item
- Sphere 0.1: All 32 AP-1-* locations become accessible (they require "Automated automation-science-pack")

**Actual behavior:**
- Sphere 0.1 locations are not accessible
- Either "Automate automation-science-pack" is not being recognized as accessible, or
- The item is not being added to inventory when the location is collected

**Investigation needed:**
- Check if location evaluation is working correctly for locations with all_of rules over empty lists
- Check if item collection is properly adding items to the inventory
- Review state manager's location collection logic
- Add logging to understand why "Automate automation-science-pack" is not being collected

**Related code:**
- Location access rule evaluation: frontend/modules/shared/ruleEngine.js
- State management: frontend/modules/stateManager/
- Test harness: frontend/modules/testSpoilersPanel/
