# Solved General Issues for Hollow Knight

This file tracks solved general issues for Hollow Knight (not specific to exporter or helper).

## Solved Issues

### 1. PlayerId Not Inferred from Spoiler Log
**Issue**: When the spoiler test loaded a sphere log file, `this.playerId` remained `null` because it was only set when rules were loaded via the `rules:loaded` event. This caused the error: "EventProcessor.processSingleEvent called before setContext(). Must call setContext() first."

**Root Cause**: The sphere log format has player data nested under player IDs in the `player_data` object. The playerId needs to be extracted from the keys of `player_data`.

**Solution**: Added playerId inference logic in `testSpoilerUI.js` in two places:
1. After auto-loading a spoiler log (in `attemptAutoLoadSpoilerLog`)
2. After manually selecting a file (in `readSelectedLogFile`)

**Files Modified**:
- `frontend/modules/testSpoilers/testSpoilerUI.js` - Added playerId inference in two locations

**Testing**: The spoiler test now successfully starts processing events instead of failing immediately.
