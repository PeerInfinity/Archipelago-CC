# SMZ3 Remaining General Issues

## Logic Issues

### 1. Bombos/Ether Tablet access rule evaluation (RESOLVED)

**Issue**: Bombos Tablet and Ether Tablet were not accessible in STATE when they should be accessible at sphere 8.21.

**Error**: "Access rule evaluation failed" - access rules evaluated to non-true value

**Affected Locations**:
- Bombos Tablet (in "Light World South", requires: Book, MasterSword, Mirror, Dark World South region)
- Ether Tablet (in "Light World Death Mountain West", requires: Book, MasterSword, Mirror OR (Hammer + Hookshot))

**Requirements Met at Sphere 8.21**:
- Mirror: ✓ (obtained sphere 0.1)
- Book: ✓ (obtained sphere 8.11)
- MasterSword (ProgressiveSword >= 2): ✓ (obtained sphere 5.1 + 8.21)
- Dark World South: ✓ (accessible since sphere 4.3)

**Root Cause**:
The snapshot object passed to helper functions when evaluating access rules was missing the `player: { slot: ... }` field. This prevented the ALTTP progressive item system from correctly determining the player context for looking up progressive item mappings.

**Investigation & Fix**:
1. **Compared ALTTP vs SMZ3 implementations** - Found both used the same helper signature and progression_mapping structure
2. **Traced data flow** - Verified progression_mapping was correctly exported and loaded into staticData
3. **Tested progressive item logic** - Created test scripts confirming MasterSword detection worked with proper snapshot
4. **Identified missing field** - Found snapshot in statePersistence.js:428-433 lacked `player: { slot: sm.playerSlot }`
5. **Applied fix** - Added player field to snapshot used by helpers called from access rules

**Solution**:
- Modified `frontend/modules/stateManager/core/statePersistence.js:433` to include `player: { slot: sm.playerSlot }` in snapshot
- This ensures helpers called from within createSnapshotInterface() have the same player context as other helper invocations
- The ALTTP helper's `has()` function can now properly look up progressive item mappings using the player slot

**Files Modified**:
- `exporter/games/smz3.py` - Added get_progression_mapping() to export progressive item data
- `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` - Imported ALTTP helpers for progressive item handling
- `frontend/modules/stateManager/core/statePersistence.js` - Added player field to snapshot (line 433)

**Commits**:
- 93dc1144: Implement progression_mapping export and use ALTTP helpers
- 31e26188: Fix SMZ3 progressive item handling for Bombos/Ether Tablets (added player field to snapshot)
- ce447a72: Fix SMZ3 progressive item naming mismatch for Bombos/Ether Tablets (fixed key names, exported has/count)

**Test Results**:
- ✅ Bombos Tablet now accessible at sphere 8.21
- ✅ Ether Tablet now accessible at sphere 8.21
- ✅ MasterSword (ProgressiveSword >= 2) correctly detected
- ✅ Spoiler test progresses beyond sphere 8.21 (previously blocked at this point)

**Status**: FULLY RESOLVED - Bombos/Ether Tablets are now correctly accessible at sphere 8.21
