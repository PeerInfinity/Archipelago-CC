# Remaining Exporter Issues for Lingo

This file tracks outstanding issues with the Lingo game exporter.

## Test Results Summary

- **Sphere 0 Test**: FAILED
- **Locations missing in STATE (should be accessible)**: 5
  - Fours
  - The Seeker - Achievement
  - The Traveled - Achievement
  - Threes
  - Twos
- **Locations extra in STATE (shouldn't be accessible)**: 96 locations
- **Regions extra in STATE**: 109 regions

## Identified Issues

### RESOLVED: Access attribute is passed correctly

The exporter correctly adds an `access` attribute to each location and the rule engine properly resolves `location.access`. Debug logs confirm the access data is being received by the helper function.

**Status**: NO ISSUE - Exporter working correctly

