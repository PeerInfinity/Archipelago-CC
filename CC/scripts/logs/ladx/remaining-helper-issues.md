# Remaining Helper Issues for Links Awakening DX

This file tracks outstanding helper function issues that need to be fixed.

## Issues

### 1. RUPEES Currency Tracking

**Status**: Needs Investigation

**Description**: The rule engine needs to handle "RUPEES" as a cumulative counter, not a regular item. Regions like "Fishing Game Heart Piece" and "Trendy Game" require RUPEES >= 20 and RUPEES >= 50 respectively. The issue is that "RUPEES" is computed from collected rupee items (50 Rupees, 100 Rupees, etc.), not a direct item.

**Location**: Failed at Sphere 1.3

**Test Output**:
```
Locations accessible in LOG but NOT in STATE: Fishing Game Heart Piece (Mabe Village), Trendy Game (Mabe Village)
Region Fishing Game Heart Piece (Mabe Village) is not reachable
Region Trendy Game (Mabe Village) is not reachable
```

**Sphere Log Shows**:
```json
"sphere_index": "1.3",
"new_inventory_details": {
  "base_items": {"50 Rupees": 1},
  "resolved_items": {"50 Rupees": 1, "RUPEES": 50}
}
```

**Possible Solutions**:
1. Create a LADX helper function to compute RUPEES from collected rupee items
2. Add special handling in the rule engine for cumulative items
3. Export RUPEES as a progressive item with appropriate mapping
