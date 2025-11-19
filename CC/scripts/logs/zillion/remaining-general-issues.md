# Zillion General Issues

## Issue 1: Exporter cannot analyze zilliandomizer logic

**Status**: Blocked - waiting for exporter fix

**Description**:
The core issue is that Zillion's access logic uses the zilliandomizer library's complex internal logic system, which cannot be easily exported to JSON. This blocks all testing and validation.

**Impact**:
- Cannot run spoiler tests
- Cannot validate logic correctness
- Cannot use the frontend tracker

**Next Steps**:
Focus on resolving the exporter issue first. Once access rules can be properly exported, re-run tests to identify any additional issues.

**Related**:
- See `remaining-exporter-issues.md` for technical details
