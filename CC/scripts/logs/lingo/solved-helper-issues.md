# Solved Helper Issues for Lingo

This file tracks resolved issues with the Lingo game helper functions.

## Issue 1: snapshot.reachableRegions was undefined

**Solved**: 2025-11-16
**File**: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
**Commit**: 4d57a4ce

**Problem**: The helper function `_lingo_can_satisfy_requirements` was checking `snapshot.reachableRegions`, which doesn't exist. The snapshot actually contains `snapshot.regionReachability` (an object mapping region names to 'reachable'/'unreachable').

**Impact**: All locations requiring room access were failing (5 locations missing).

**Solution**: Changed the helper to use `snapshot.regionReachability` and check if `regionReachability[roomName] === 'reachable'`.

**Result**: The 5 missing locations (Fours, The Seeker - Achievement, The Traveled - Achievement, Threes, Twos) are now correctly marked as accessible at sphere 0.

## Issue 2: Color requirements were never checked

**Solved**: 2025-11-16
**File**: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
**Commit**: 4d57a4ce

**Problem**: The helper function was only checking color requirements if `settings.shuffle_colors` was truthy. However, this setting was `null` in the generated rules, so the color check was being skipped entirely.

**Impact**: Many locations requiring colors were incorrectly marked as accessible (contributed to 96 extra locations).

**Solution**: Removed the `shuffle_colors` check. If a location has color requirements in its access data, we should always check them (the exporter wouldn't have added them otherwise).

**Result**: Extra locations reduced from 96 to 21 (78% reduction).

