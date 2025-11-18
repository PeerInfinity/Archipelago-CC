# SMZ3 Exporter Issues - Remaining

## Current Status
Generated rules.json successfully with SMZ3 exporter.

## Issues Identified

### 1. smz3_canAccess Helper Generation (HIGH PRIORITY)
**Status**: Not fixed
**Severity**: Critical - blocks all locations from being accessible
**Description**: The exporter is generating calls to a helper function `smz3_canAccess` that doesn't exist in the JavaScript helpers.
**Evidence**:
- Found 100+ references to `smz3_canAccess` in rules.json
- Test output shows: "Helper function "smz3_canAccess" NOT FOUND in snapshotInterface"
- All 37 locations in Sphere 0 are failing to be accessible

**Example Location**:
```json
{
  "type": "helper",
  "name": "smz3_canAccess",
  "args": []
}
```

**Next Steps**:
1. Find where in the exporter this `smz3_canAccess` helper is being generated
2. Understand what Python method it's supposed to represent
3. Either implement the JavaScript helper OR fix the exporter to not generate these calls

---

*Last updated: 2025-11-18*
