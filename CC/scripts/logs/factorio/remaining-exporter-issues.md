# Remaining Exporter Issues

## Preliminary Investigation (Sphere 2.1 failures)

**Finding**: The 34 failing locations all require both:
1. "Automated automation-science-pack" (event item from sphere 0.1)
2. "Automated logistic-science-pack" (event item from sphere 2.1)

**Key observations**:
- Both items are EVENT items (`"event": true`, `"id": null`)
- "Automated automation-science-pack" comes from checking location "Automate automation-science-pack" at sphere 0.1
- "Automated logistic-science-pack" comes from checking location "Automate logistic-science-pack" at sphere 2.1
- The rules.json structure looks correct - uses standard `and` and `item_check` rules
- Test error: "Access rule evaluation failed" suggests rule eval returns non-true value

**Hypothesis**: Event items from earlier spheres may not be properly accumulated in the state manager's snapshot when checking accessibility in later spheres. When the test reaches sphere 2.1 and tries to check the 34 locations, the inventory might only contain "Automated logistic-science-pack" (new in this sphere) but not "Automated automation-science-pack" (from sphere 0.1).

**To investigate**:
1. Add debug logging to see the actual inventory contents when evaluating these failing locations
2. Check if event items are handled differently from regular items in state accumulation
3. Verify that `stateManager.addItemToInventory()` correctly handles event items
4. Check if the `hasItem` function in factorioLogic.js properly looks up event items

**Affected files**:
- `frontend/modules/testSpoilers/eventProcessor.js` - handles sphere event processing
- `frontend/modules/stateManager/index.js` - manages state accumulation
- `frontend/modules/shared/gameLogic/factorio/factorioLogic.js` - Factorio-specific helpers
- `exporter/games/factorio.py` - Factorio exporter (appears correct)

