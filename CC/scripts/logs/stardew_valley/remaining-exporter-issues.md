# Remaining Exporter Issues for Stardew Valley

## Critical: Entrance Access Rules Not Exported

**Problem**: Entrance access rules are not being exported to the JSON file, causing the frontend to treat all regions with null rules as immediately accessible.

**Evidence**:
- 155 out of 213 entrance exits have `null` access_rule in the JSON
- The "Bus Stop to Desert" entrance has `access_rule: null` despite having a rule set in Python
- In `worlds/stardew_valley/rules.py:set_entrance_rules()`, the code calls:
  ```python
  set_entrance_rule(multiworld, player, Entrance.take_bus_to_desert,
                    logic.received("Bus Repair") & logic.money.can_spend(500))
  ```
- This SHOULD set the `access_rule` attribute on the entrance object
- But the exporter sees `null` for this entrance

**Root Cause Investigation Needed**:
The issue could be one of:
1. **Exporter timing**: The exporter might be running before `set_rules()` is called
   - BUT: 58 out of 213 entrances DO have non-null rules, suggesting timing is correct
2. **StardewRule serialization**: The exporter might not be able to serialize `StardewRule` objects on entrances
   - The Stardew Valley exporter has `_serialize_stardew_rule()` method for locations
   - But it might not be getting called for entrance rules
3. **Entrance object access**: The exporter might be looking at a different entrance object than the one that has the rule set

**Debugging Steps**:
1. Re-generate the rules.json with verbose logging enabled in the exporter
2. Check if the exporter is seeing the entrance objects with access_rule attributes
3. Check if `override_rule_analysis` is being called for entrance rules
4. Verify that the StardewRule objects on entrances are being detected and serialized

**Entrances Known to Be Affected**:
- "Bus Stop to Desert" - should require "Bus Repair" + 500g
- "Wizard Tower to Desert" (Use Desert Obelisk) - should require Desert Obelisk item
- And likely many more of the 155 null-rule entrances
