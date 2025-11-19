# Remaining Helper Issues

## Region Accessibility Issues (Sphere 10.9)

The spoiler test now fails at Sphere 10.9 (step 176) with the following regions not being accessible:

- Data Roxas
- Sephiroth

**Helper Functions Implemented:**
- ✓ `get_thousand_heartless_rules` - IMPLEMENTED
- ✓ `get_data_roxas_rules` - IMPLEMENTED
- ✓ `get_data_demyx_rules` - IMPLEMENTED
- ✓ `get_sephiroth_rules` - IMPLEMENTED

**Current Issue:**
The helper functions are now found and being called, but Data Roxas and Sephiroth regions remain inaccessible. The issue appears to be related to location accessibility checking:
- Both functions check if "Limit level 5" location is reachable
- The helpers correctly check `snapshot?.locationReachability?.['Limit level 5']`
- Need to investigate why the helpers are returning false

**Error Message:**
```
Regions accessible in LOG but NOT in STATE: Data Roxas, Sephiroth
ISSUE: 1 exit(s) should provide access but region is not reachable
```

