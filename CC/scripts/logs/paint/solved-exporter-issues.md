# Paint Game - Solved Exporter Issues

This file tracks resolved issues in the Paint exporter (exporter/games/paint.py).

## Solved Issues

### Issue 1: Override_rule_analysis cache collision causing incorrect thresholds

**Date Solved**: 2025-11-14

**Problem**:
The exporter's rule analysis cache was causing all Paint locations to share the same access rule analysis because they all used the same `access_rule` method from the PaintLocation class. This resulted in most locations having incorrect threshold values (e.g., location "Similarity: 10.0%" had threshold 2.0 instead of 10.0).

**Solution**:
Implemented `postprocess_regions` method that sets unique lambda functions as the access_rule for each location before export. Each lambda captures the correct threshold, ensuring proper cache keys and rule analysis.

**Implementation**: `exporter/games/paint.py:101-138`

**Result**:
- All 130 Paint Similarity locations now have correct thresholds
- Spoiler tests pass successfully
