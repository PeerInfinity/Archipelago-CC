# Remaining SMZ3 General Issues

## No remaining issues

All identified issues have been resolved. See `solved-general-issues.md` for details.

## Summary of solved issues:

1. **Region reachability not updated after checking locations** - Fixed by adding `computeReachableRegions()` call in `locationChecking.js`

2. **Non-advancement items skipped in spoiler test mode** - Fixed by removing the advancement filter in `locationChecking.js` so ALL items are added to inventory in full spoilers mode

The SMZ3 spoiler test now passes all 315 sphere events with no mismatches.
