# Remaining Helper Issues

## Issue 1: state.smbm not available in snapshots

**Locations affected:**
- Missile (blue Brinstar bottom)
- Missile (blue Brinstar middle)

**Description:** Access rules for these locations use `evalSMBool` which needs to access `state.smbm[1].maxDiff`. The `smStateModule` in smLogic.js initializes `smbm` in the state, but it's not being included in snapshots properly.

**Example rule:**
```json
{
  "type": "helper",
  "name": "evalSMBool",
  "args": [
    {"type": "helper", "name": "haveItem", "args": [{"type": "constant", "value": "Morph"}]},
    {
      "type": "attribute",
      "object": {
        "type": "subscript",
        "value": {"type": "attribute", "object": {"type": "name", "name": "state"}, "attr": "smbm"},
        "index": {"type": "constant", "value": 1}
      },
      "attr": "maxDiff"
    }
  ]
}
```

**Status:** Investigating state initialization and snapshot creation

