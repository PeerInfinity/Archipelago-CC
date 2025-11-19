# Remaining General Issues for Stardew Valley

This file tracks general issues that still need to be fixed.

## Issue 1: Museumsanity locations not accessible at Sphere 2.1

**Test Run:** Sphere 2.1
**Locations Affected:**
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

**Error:** Access rule evaluation failed

**Description:**
These three Museumsanity milestone locations should become accessible at Sphere 2.1 according to the Python sphere log, but the JavaScript state manager is not marking them as accessible.

**Rule Structure:**
The locations use a count_true rule that requires:
1. Traveling Merchant Metal Detector item (received at Sphere 1.1)
2. At least N artifacts/donations can be found (uses count_true with multiple conditions)

**Investigation Needed:**
- Check if count_true rule type is evaluating correctly
- Verify item counting for "Received Progression Percent" is working
- Check if artifact-finding conditions are being evaluated properly
- May need to debug rule evaluation in ruleEngine.js

**Related Files:**
- `frontend/presets/stardew_valley/AP_14089154938208861744/AP_14089154938208861744_rules.json`
- `frontend/modules/shared/ruleEngine.js` (count_true implementation)
- `exporter/games/stardew_valley.py` (Count rule serialization)
- `worlds/stardew_valley/logic/museum_logic.py` (Python logic)

