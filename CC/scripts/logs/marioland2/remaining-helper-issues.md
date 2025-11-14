# Super Mario Land 2 - Remaining Helper Issues

## Issue 1: has_from_list_unique state method needs attribute resolution

**Status**: Partially Fixed
**Priority**: High (blocking sphere 10.1 - Mario's Castle)

### Description
The `has_from_list_unique` state method was implemented but Mario's Castle is still not accessible in sphere 10.1. The issue may be with attribute resolution for the `required_golden_coins` parameter.

### Access Rule
```json
{
  "type": "state_method",
  "method": "has_from_list_unique",
  "args": [
    {"type": "constant", "value": ["Tree Coin", "Space Coin", ...]},
    {"type": "attribute", "object": ..., "attr": "required_golden_coins"}
  ]
}
```

### Evidence
- Player has all 6 golden coins by sphere 10.1
- LOG shows Mario's Castle becomes accessible
- STATE does not recognize it as accessible
- `required_golden_coins` is null in world_settings (should default to 6)

### Next Steps
1. Check if attribute resolution is working for the count parameter
2. Verify default value handling when required_golden_coins is null
3. May need to implement attribute resolution in state method calls
4. May need to add default value logic (6 if null)

### Files to Fix
- Frontend state management code that handles state_method calls
- May need to update how attributes are resolved in rule evaluation
