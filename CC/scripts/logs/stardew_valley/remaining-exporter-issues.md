# Remaining Exporter Issues - Stardew Valley

## Active Issues

### Issue 2: Museumsanity locations not accessible
- **Type**: Helper function or counting issue
- **Sphere**: 2.1
- **Error**: Locations accessible in LOG but NOT in STATE
- **Locations**: "Museumsanity: 3 Artifacts", "Museumsanity: 5 Donations", "Museumsanity: 6 Artifacts"
- **Status**: To investigate
- **Description**: Museum-related milestone locations are accessible in the Python spoiler log but not in the JavaScript state manager.
- **Next Steps**:
  1. Check the access rules for these locations
  2. Investigate how museum artifacts/donations are counted
  3. Check if there's a missing helper function for counting donations/artifacts
