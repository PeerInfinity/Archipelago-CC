# Remaining Exporter Issues

## Issue 1: Region Connectivity at Sphere 0 (CRITICAL)

**Status**: Active
**Test Run**: 2025-11-18T04:45:01

**Problem**: Multiple regions are not reachable in Sphere 0 that should be accessible according to the sphere log.

**Regions Not Reachable**:
- Blue Brinstar Elevator Bottom
- Energy Tank, Brinstar Ceiling
- Missile (blue Brinstar behind missile)
- Missile (blue Brinstar bottom)
- Missile (blue Brinstar middle)
- Missile (blue Brinstar top)
- Morphing Ball
- Power Bomb (blue Brinstar)

**Locations Not Accessible**:
- Energy Tank, Brinstar Ceiling
- Morphing Ball

**Root Cause**: Unknown - needs investigation of region exit rules

**Next Steps**:
1. Check region connectivity in rules.json
2. Verify exit rules for regions leading to Blue Brinstar areas
3. Check if Menu region has correct initial connections

