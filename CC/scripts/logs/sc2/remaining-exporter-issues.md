# Remaining SC2 Exporter Issues

## Issue: `self.attribute` attribute access not resolving from settings

**Status:** 🔍 INVESTIGATING

**Symptom:**
- Test fails at Sphere 5.2
- Error: "Name 'self' NOT FOUND in context"
- Locations not accessible: Back in the Saddle: Defend the Tram, Back in the Saddle: Door Section Cleared, Back in the Saddle: Victory, Beat Back in the Saddle

**Current State:**
1. The exporter correctly converts `logic.attribute_name` to `self.attribute_name`
2. The exporter correctly exports computed logic properties to settings (e.g., `story_tech_granted: false`)
3. The rule engine has special handling for `self.attribute` access (lines 520-538 of ruleEngine.js)

**Problem:**
The rule engine logs "Name 'self' NOT FOUND in context" when trying to resolve `{type: 'name', name: 'self'}`.

The expected flow:
1. Rule engine evaluates `{type: 'attribute', object: {type: 'name', name: 'self'}, attr: 'story_tech_granted'}`
2. It first evaluates `object` which is `{type: 'name', name: 'self'}`
3. This calls `context.resolveName('self')` which should return `undefined`
4. Then the special case at line 522 should trigger and look up `staticData.settings[playerId]['story_tech_granted']`

**What's actually happening:**
The rule engine logs "Name 'self' NOT FOUND in context", which means `resolveName('self')` returned `undefined` and logged a warning. But then the special case handling doesn't seem to be working.

**Possible causes:**
1. The context's `getStaticData()` method doesn't exist or returns wrong structure
2. The `playerId` resolution isn't working correctly
3. The settings structure doesn't match `staticData.settings[playerId][attr]`
4. There's an early return preventing the special case from being reached

**Next steps:**
- Add debug logging to see if the special case at line 522 is being reached
- Verify the structure of staticData and settings
- Check if `context.getStaticData` and `context.playerId` are defined
- Consider alternative approaches to resolving `self` attributes

**Example failing rule:**
```json
{
  "type": "attribute",
  "object": {
    "type": "name",
    "name": "self"
  },
  "attr": "story_tech_granted"
}
```

This should resolve to `settings["1"]["story_tech_granted"]` which is `false` in the current rules.json.
