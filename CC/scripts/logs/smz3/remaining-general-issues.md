# SMZ3 General Issues - Remaining

## Current Status
Initial test run completed - critical blocker identified.

## Issues Identified

### 1. CanAcquireAtLeast Pattern (UNKNOWN PRIORITY)
**Status**: Not analyzed
**Severity**: Unknown - may be handled by existing rule engine
**Description**: Rules.json contains function calls to `CanAcquireAtLeast` which may or may not be supported
**Evidence**:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {
      "type": "constant",
      "value": true
    },
    "attr": "CanAcquireAtLeast"
  },
  "args": [...]
}
```

**Next Steps**:
1. Verify if rule engine handles this pattern
2. Test once critical blocker is fixed

### 2. RewardType Attribute Access (UNKNOWN PRIORITY)
**Status**: Not analyzed
**Severity**: Unknown
**Description**: Rules reference `RewardType.AnyCrystal` and `RewardType.AnyBossToken`
**Evidence**: Found in Ganon's Tower access rule
**Next Steps**: Test once critical blocker is fixed

---

*Last updated: 2025-11-18*
