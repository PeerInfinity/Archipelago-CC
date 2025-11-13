# Super Metroid - Remaining Exporter Issues

## Current Status
- ✅ Basic exporter created
- ✅ `self.evalSMBool()` calls transformed into helper calls
- ❌ Rules still reference Python-specific objects that don't exist in JavaScript

## Issue: References to `state.smbm[player]`

The transformed rules now properly use helper calls instead of `self.evalSMBool()`, but they still contain references to `state.smbm[1]` which is a Python SMBoolManager instance.

**Example rule structure**:
```json
{
  "type": "helper",
  "name": "evalSMBool",
  "args": [
    {
      "type": "helper",
      "name": "func",
      "args": [
        {
          "type": "subscript",
          "value": {
            "type": "attribute",
            "object": {"type": "name", "name": "state"},
            "attr": "smbm"
          },
          "index": {"type": "constant", "value": 1}
        }
      ]
    },
    ...
  ]
}
```

**Problem**: The rule engine tries to evaluate `state.smbm[1]` before calling the `func` helper, but:
1. The JavaScript `state` object doesn't have an `smbm` attribute
2. Even if it did, we don't maintain SMBoolManager instances in JavaScript

## Possible Solutions

### Option 1: Further Transform Rules in Exporter
Strip out or simplify references to `state.smbm[player]` and other Python-specific objects. Since the VARIA logic has already been evaluated by Python, these could be replaced with simpler patterns.

### Option 2: Provide Mock Objects in Evaluation Context
Add a `state` object with mock `smbm` attribute to the rule evaluation context. The helpers would still return placeholder values, but the rule engine wouldn't fail when evaluating nested expressions.

### Option 3: Simplify Super Metroid Rules
For Super Metroid specifically, replace complex rules with simpler patterns since the sphere log contains the actual logic results. This might mean:
- Exit rules become `{"type": "constant", "value": true}`
- Location rules check only for items in inventory

### Option 4: Rule Engine Enhancement
Modify the rule engine to handle missing context values more gracefully, perhaps by catching evaluation errors and allowing helpers to work with undefined arguments.

## Recommendation
Start with Option 2 (provide mock context) as it's least invasive and maintains rule structure. If that doesn't work well enough, proceed to Option 1 (transform rules further).
