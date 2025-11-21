# SMZ3 Remaining General Issues

## Logic Issues

### 1. Bombos/Ether Tablet access rule evaluation (ACTIVE)

**Issue**: Bombos Tablet and Ether Tablet are not accessible in STATE when they should be accessible at sphere 8.21.

**Error**: "Access rule evaluation failed" - access rules evaluate to non-true value

**Affected Locations**:
- Bombos Tablet (in "Light World South", requires: Book, MasterSword, Mirror, Dark World South region)
- Ether Tablet (in "Light World Death Mountain West", requires: Book, MasterSword, Mirror OR (Hammer + Hookshot))

**Requirements Met at Sphere 8.21**:
- Mirror: ✓ (obtained sphere 0.1)
- Book: ✓ (obtained sphere 8.11)
- MasterSword (ProgressiveSword >= 2): ✓ (obtained sphere 5.1 + 8.21)
- Dark World South: ✓ (accessible since sphere 4.3)

**Investigation Findings**:
- All item requirements are met in the spoiler log
- Dark World South region should be accessible
- Progressive item mapping (MasterSword → ProgressiveSword >= 2) is implemented
- Access rules appear correct in rules.json
- **Hypothesis**: Timing issue where ProgressiveSword count isn't updated before accessibility check, or region_check evaluation issue

**Priority**: MEDIUM - Blocks late-game progression (sphere 8.21+)
