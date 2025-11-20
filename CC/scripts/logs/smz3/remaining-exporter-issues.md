# SMZ3 Remaining Exporter Issues

## Summary
Issues related to the SMZ3 exporter (`exporter/games/smz3.py`)

## Issues

### 1. Possible GetLocation helper issue (Harmless Hellway)
- **Status**: Under investigation
- **Location**: `exporter/games/smz3.py`
- **Description**: The "Palace of Darkness - Harmless Hellway" location uses `smz3_GetLocation` helper which may not exist in JavaScript
- **Example Rule**:
  ```json
  {
    "type": "function_call",
    "function": {
      "type": "attribute",
      "object": {
        "type": "helper",
        "name": "smz3_GetLocation",
        "args": [{"type": "constant", "value": "Palace of Darkness - Harmless Hellway"}]
      },
      "attr": "ItemIs"
    },
    "args": [...]
  }
  ```
- **Impact**: May cause evaluation failures for locations with self-referential item checks
- **Next Steps**: Determine if this helper needs to be implemented or if the exporter should inline these checks

### 2. ItemType attribute access in rules
- **Status**: Under investigation
- **Location**: Rules generated for "Palace of Darkness - Harmless Hellway"
- **Description**: Rules contain `{"type": "attribute", "object": {"type": "name", "name": "ItemType"}, "attr": "KeyPD"}` which may not be properly handled
- **Impact**: Unknown - needs testing
- **Next Steps**: Test if this pattern works or needs special handling
