# Remaining Exporter Issues - Zillion

## Issue 1: Gun=1 locations have different accessibility requirements
- **Status**: In progress
- **Priority**: High
- **Description**: Locations with gun=1 requirement are split into two groups:
  - Sphere 0 accessible: "B-1 mid far left", "B-8 top right" (12 locations total)
  - Sphere 0.3 accessible (after collecting Zillion item): "C-3 mid far right" (22 locations total)
  - All have gun=1, jump=0 or gun=1, jump=1 requirements
- **Current Impact**: 46 locations accessible in STATE but NOT in LOG in Sphere 0
- **Investigation Needed**:
  - Why do some gun=1 locations require the Zillion item while others don't?
  - Is there an "after" dependency or other requirement in zz_loc structure?
  - Does zilliandomizer use different logic for base gun vs collected gun?
- **Test Results**: Reduced from 188 to 46 mismatched locations after implementing custom exporter
- **Next Steps**: Examine zilliandomizer logic and zz_loc.after field
