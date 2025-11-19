# Factorio General Issues - Remaining

## Issue 1: Location "Automate logistic-science-pack" not accessible in sphere 1.8

**Test Failure:**
- Sphere: 1.8
- Location: "Automate logistic-science-pack"
- Error: "Locations accessible in LOG but NOT in STATE"
- Issue: Access rule evaluation failed

**Root Cause Analysis:**

The access rule for "Automate logistic-science-pack" is:
```json
{
  "type": "all_of",
  "element_rule": {
    "type": "item_check",
    "item": {
      "type": "name",
      "name": "technology"
    }
  },
  "iterator_info": {
    "type": "comprehension_details",
    "target": {
      "type": "name",
      "name": "technology"
    },
    "iterator": {
      "type": "subscript",
      "value": {
        "type": "name",
        "name": "required_technologies"
      },
      "index": {
        "type": "constant",
        "value": "logistic-science-pack"
      }
    }
  }
}
```

This should:
1. Access `required_technologies["logistic-science-pack"]` which returns `["logistic-science-pack"]`
2. For each technology in that array, check if player has it
3. Return true if player has ALL technologies

**Expected State at Sphere 1.8:**
- Player should have: "logistic-science-pack" (from progressive-science-pack)
- Required technologies["logistic-science-pack"]: ["logistic-science-pack"]
- Therefore, the location should be accessible

**Possible Causes:**
1. Subscript evaluation returning undefined instead of array
2. required_technologies not being properly loaded into staticData.game_info[player].variables
3. Progressive item resolution not working correctly
4. all_of comprehension not handling the bound variable correctly

**Next Steps:**
- Add logging to track subscript evaluation
- Check if required_technologies is in staticData
- Verify progressive item resolution
- Test the all_of/subscript combination manually
