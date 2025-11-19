# SMZ3 - Remaining Exporter Issues

This file tracks outstanding issues with the SMZ3 exporter (`exporter/games/smz3.py`).

## Issue #1: Missing Card Item Definitions

**Severity**: High
**Type**: Missing Item Data
**Test Failure**: Sphere 1.2 - "Energy Tank, Brinstar Ceiling" inaccessible

**Description**:
The Super Metroid security card items are included as starting items but are not properly defined in the items dictionary. This causes:
1. Warnings during StateManager initialization (16 warnings total)
2. Access rule evaluation failures for locations that require these cards
3. Test failures starting at Sphere 1.2

**Missing Items**:
- CardCrateriaL1 (itemId: 84208)
- CardCrateriaL2 (itemId: 84209)
- CardCrateriaBoss (itemId: 84210)
- CardBrinstarL1 (itemId: 84211)
- CardBrinstarL2 (itemId: 84212)
- CardBrinstarBoss (itemId: 84213)
- CardNorfairL1 (itemId: 84214)
- CardNorfairL2 (itemId: 84215)
- CardNorfairBoss (itemId: 84216)
- CardMaridiaL1 (itemId: 84217)
- CardMaridiaL2 (itemId: 84218)
- CardMaridiaBoss (itemId: 84219)
- CardWreckedShipL1 (itemId: 84220)
- CardWreckedShipBoss (itemId: 84221)
- CardLowerNorfairL1 (itemId: 84222)
- CardLowerNorfairBoss (itemId: 84223)

**Example Failure**:
Location "Energy Tank, Brinstar Ceiling" requires CardBrinstarL1:
```json
{
  "type": "and",
  "conditions": [
    {
      "type": "item_check",
      "item": "CardBrinstarL1"
    },
    ...
  ]
}
```

But CardBrinstarL1 is not in the items dict, so the rule evaluation fails.

**Root Cause**:
The SMZ3 exporter likely needs to explicitly export these Super Metroid card items to the items dictionary. These are progression items in the TotalSMZ3 library but may not be automatically picked up by the generic exporter.
