# Remaining Exporter Issues - Secret of Evermore

## High Priority

### Settings Not Exported
**Status:** Identified
**Impact:** Critical - prevents logic rules that depend on settings from working
**Description:** SOE-specific settings (out_of_bounds, sequence_breaks, energy_core, required_fragments, etc.) are not being exported to the rules.json settings section. The helper function expects these settings to determine if certain progress IDs are available.

**Details:**
- The SOE world has many option fields (out_of_bounds, sequence_breaks, energy_core, required_fragments, etc.)
- These options are referenced in the SOE helper function (soeLogic.js)
- The helper checks `settings?.out_of_bounds === 2` for P_ALLOW_OOB (25)
- The helper checks `settings?.sequence_breaks === 2` for P_ALLOW_SEQUENCE_BREAKS (26)
- The helper checks `settings?.energy_core === 1` for energy core fragment mode
- These settings are currently not present in the exported rules.json

**Example:**
- Logic rule 15 provides progress_id 31 when: has(P_WEAPON, 1) AND has(P_ALLOW_OOB, 1)
- But P_ALLOW_OOB (25) returns based on `settings.out_of_bounds === 2`
- Since settings.out_of_bounds is missing, this always returns false

**Solution:** Need to export SOE option values to the settings section of rules.json. This likely requires changes to the main exporter or the SOE game handler to provide settings data.
