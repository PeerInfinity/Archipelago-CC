# SMZ3 Remaining General Issues

## Logic Issues

### 1. smz3_CanAcquireAll behavior with pendant mask (CRITICAL)

**Issue**: Master Sword Pedestal is accessible too early (sphere 6.2 instead of later). The CanAcquireAll(6) check for "both pendants" is not working correctly.

**Affected Locations**:
- Master Sword Pedestal (requires all pendants: PendantGreen | PendantNonGreen = 6)

**Investigation needed**: The implementation correctly finds 3 regions with pendant rewards and checks if they can be completed, but the logic may need refinement for how the bit mask is interpreted.

**Priority**: HIGH - Causes incorrect early sphere accessibility
