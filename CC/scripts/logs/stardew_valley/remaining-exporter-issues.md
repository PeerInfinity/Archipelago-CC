# Remaining Exporter Issues - Stardew Valley

## Active Issues

### Issue 2: Museumsanity locations not accessible
- **Type**: count_true rule evaluation issue
- **Sphere**: 2.1
- **Error**: Locations accessible in LOG but NOT in STATE
- **Locations**: "Museumsanity: 3 Artifacts", "Museumsanity: 5 Donations", "Museumsanity: 6 Artifacts"
- **Status**: Identified - needs investigation
- **Description**: Museum-related milestone locations use `count_true` rules that require at least N of M conditions to be true. The rule engine supports count_true, but the conditions inside are not evaluating correctly.
- **Access Rule Pattern**: Uses count_true with complex nested conditions involving:
  - Region checks (e.g., "The Mines - Floor 5", "Desert", "Volcano - Floor 10")
  - Item checks with counts (e.g., "Progressive Pan" count 2, "Fishing Level" count 8)
  - Progression percentage checks (e.g., "Received Progression Percent" >= 28)
- **Next Steps**:
  1. Add debug logging to count_true evaluation to see which conditions are failing
  2. Check if specific region checks or item count checks are the issue
  3. Verify that all the conditions within count_true are being evaluated correctly
  4. May need to investigate specific helpers or region accessibility
