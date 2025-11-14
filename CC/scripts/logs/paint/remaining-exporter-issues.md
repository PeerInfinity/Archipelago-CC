# Paint Game - Remaining Exporter Issues

This file tracks outstanding issues in the Paint exporter (exporter/games/paint.py).

## Issues

### Issue 1: override_rule_analysis not being called for all Paint locations

**Status**: SOLVED ✓

**Description**:
The exporter's `override_rule_analysis` method was only being called for some Paint locations (1.0%, 2.0%, 6.0%, 27.0%+), but not for others (3.0%-5.0%, 7.0%-26.0%). This caused many locations to have incorrect threshold values in their access rules.

**Evidence**:
- Location "Similarity: 3.0%" had threshold 2.0 instead of 3.0
- Location "Similarity: 10.0%" had threshold 2.0 instead of 10.0
- Many locations between 7.0% and 26.0% had incorrect thresholds

**Root Cause**:
All Paint locations used the same `access_rule` method defined on the PaintLocation class. The exporter's rule analysis cache used the function id as part of the cache key, so all locations shared the same cache entry. This caused the exporter to analyze the first location's rule, cache it, and then reuse that cached analysis (with the wrong threshold) for all subsequent locations.

**Solution**:
Implemented a `postprocess_regions` method in the Paint exporter that sets unique lambda functions as the access_rule for each location before export. Each lambda captures the correct threshold value for that specific location, ensuring each location gets its own cache key and proper rule analysis.

**File**: `exporter/games/paint.py:101-138`

**Result**:
- All 130 Paint Similarity locations now have correct threshold values
- Spoiler test passes successfully
