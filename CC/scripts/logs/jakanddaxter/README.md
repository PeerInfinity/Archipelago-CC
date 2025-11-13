# Jak and Daxter: The Precursor Legacy - Debug Log

## Current Status

### Exporter Status
- ✅ orb_count exported from regions
- ✅ can_reach_orbs helper function implemented
- ⚠️ Spoiler test failing due to state manager caching issue

### Helper Function Status
- ✅ can_reach_orbs() implemented and working correctly
- ✅ Correctly sums orb_count from accessible regions
- ✅ Handles staticData.regions as a Map

### Test Results

#### Initial Testing
- Helper correctly calculates 332 reachable orbs initially (matches Python)
- Only sees 19 reachable regions instead of all regions unlocked during playthrough
- By sphere 3.15, should have 1636 reachable orbs but only sees 332

#### Root Cause
The state manager's regionReachability snapshot is stale during spoiler test playback. When items are collected during the test, the cache isn't being recomputed before location accessibility is checked. This causes the helper to only see the initially reachable regions, not all regions that should be accessible after collecting progression items.

## Trade Location Design

Important: ALL orb trade locations require `world.total_trade_orbs` (1530 orbs in this seed) because in vanilla mode (orbsanity off), you need enough reachable orbs to complete ALL trades before any of them become accessible. This is intentional game balancing, not a bug.

- 9 citizen trades (90 orbs each) = 810 orbs
- 6 oracle trades (120 orbs each) = 720 orbs
- Total: 1530 orbs required for ALL trades

## Next Steps

This is a state manager issue that affects spoiler test playback, not specific to Jak and Daxter. The helper function is implemented correctly and the exporter changes are working as intended.
