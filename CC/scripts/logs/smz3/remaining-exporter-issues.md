# Remaining Exporter Issues

**Status**: All exporter issues have been resolved! ✅

The performance issue that was causing timeouts has been resolved. The test now:
- Completes all 120 events successfully
- Finishes in ~12.6 seconds (well within timeout)
- Handles the Gravity Suit event (event 79) without performance issues
- Processes all 17 Maridia locations efficiently

The timeout was actually caused by missing helper functions (smz3_CanBeatArmos, smz3_CanBeatMoldorm, smz3_LeftSide, smz3_RightSide), not a performance issue. Once these were implemented, the test completed successfully.

See `solved-exporter-issues.md` for details on the any_of iterator fix.

