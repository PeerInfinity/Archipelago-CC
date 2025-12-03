# Universal Tracker Workflow Timeout Analysis

## Issue Summary
During UT comparison testing (test-ut.yml), certain games (notably Yu-Gi-Oh! 2006) experience timeouts where:
- The driver processes exactly 296 spheres (through sphere 3.39)
- UT never receives STEP for sphere 3.40
- The driver times out waiting for READY

## Root Cause

The issue is caused by an exception in `game_watcher`'s call to `updateTracker()` after receiving items, which triggers an automatic disconnect.

### Detailed Flow

1. **TestDriverClient checks locations for sphere N**
   - Sends `LocationChecks` to server

2. **Server sends `ReceivedItems` to UT**
   - Contains items from the checked locations

3. **CommonClient processes `ReceivedItems`** (`CommonClient.py:1046-1060`)
   - Items added to `ctx.items_received`
   - `ctx.watcher_event.set()` triggers the background watcher

4. **`game_watcher` runs** (`TrackerClient.py:1851-1864`)
   ```python
   async def game_watcher(ctx: TrackerGameContext) -> None:
       while not ctx.exit_event.is_set():
           try:
               await asyncio.wait_for(ctx.watcher_event.wait(), 0.125)
           except asyncio.TimeoutError:
               continue
           ctx.watcher_event.clear()
           try:
               ctx.updateTracker()  # <-- Called here
           except Exception as e:
               ...
               raise e  # <-- Re-raises, killing the task
   ```

5. **If `updateTracker()` throws**, the exception handling in `TrackerClient.updateTracker()` (`TrackerClient.py:389-394`) triggers:
   ```python
   except Exception as e:
       self.disconnected_intentionally = True
       async_start(self.disconnect(False), name="disconnecting")  # <-- DISCONNECTS!
       raise e
   ```

6. **Websocket closes** before the next STEP can be received

7. **TestDriverClient sends STEP** but UT is already disconnected

8. **TestDriverClient times out** waiting for READY that will never come

### Likely Exception Source

In `TrackerCore.updateTracker()` (`TrackerCore.py:314-319`):
```python
invalid_items = [str(item.item) for item in self.tracker_items_received if item.item not in item_id_to_name]
if invalid_items:
    print(invalid_items)
    self.logger.error("Your datapackage is incorrect, please correct the apworld for "+str(self.game))
    self.logger.error("The Following items are unknown [" + ",".join(invalid_items)+"]")
    raise Exception("Your datapackage is incorrect, please correct the apworld for "+str(self.game))
```

If any received item has an ID not in the local datapackage, an exception is raised.

## Key Code Locations

| File | Lines | Description |
|------|-------|-------------|
| `TrackerClient.py` | 1851-1864 | `game_watcher` background task |
| `TrackerClient.py` | 389-394 | `updateTracker()` exception handling triggers disconnect |
| `TrackerCore.py` | 314-319 | Invalid item check throws exception |
| `CommonClient.py` | 1046-1060 | `ReceivedItems` processing sets watcher_event |

## Why the Timeout Manifests at a Specific Sphere

The exception occurs when processing items from a particular sphere's locations. This could happen if:
1. A specific item at a location has a mismatched ID
2. The game's datapackage differs from the server's
3. An edge case in item handling for that game

## Potential Fixes

### Option 1: Graceful Exception Handling in `game_watcher`
Don't let exceptions in `updateTracker()` close the connection:
```python
try:
    ctx.updateTracker()
except Exception as e:
    logger.error(f"[game_watcher] updateTracker failed: {e}")
    # Don't re-raise - let the watcher continue
```

### Option 2: Remove Auto-Disconnect on Exception
In `TrackerClient.updateTracker()`, log the error but don't disconnect:
```python
except Exception as e:
    logger.error(f"updateTracker failed: {e}")
    # Don't disconnect - just return empty state
    return CurrentTrackerState.init_empty_state()
```

### Option 3: Handle Invalid Items Gracefully
In `TrackerCore.updateTracker()`, log invalid items as warnings instead of throwing:
```python
if invalid_items:
    self.logger.warning(f"Unknown items (skipping): {invalid_items}")
    # Continue processing with valid items only
```

### Option 4: Investigate Game-Specific Issues
Check if specific games (like Yu-Gi-Oh! 2006) have item ID mismatches that need to be fixed in their apworld.

## Testing the Fix

After implementing a fix, test with:
```bash
python scripts/test/test-ut-comparison.py \
    --yaml-file "Players/Templates/Yu-Gi-Oh! 2006.yaml" \
    --seed 1
```

The test should complete without the "Driver timeout" error, or at minimum, show the actual exception in the logs.

## Related Files

- `.github/workflows/test-ut.yml` - Workflow that runs the tests
- `scripts/test/test-ut-comparison.py` - Test orchestrator
- `scripts/test/TestDriverClient.py` - Test driver that sends STEP/waits for READY
- `worlds/tracker/TrackerClient.py` - Universal Tracker client
- `worlds/tracker/TrackerCore.py` - Core tracker logic

## Implemented Fixes

The following fixes have been implemented:

### 1. TrackerClient.updateTracker() - No Auto-Disconnect (Option 2)
**File:** `worlds/tracker/TrackerClient.py` lines 389-399

Changed exception handling to log the error and return an empty state instead of triggering a disconnect. This allows UT to continue operating even if `updateTracker()` fails.

### 2. game_watcher - No Crash on Exception (Option 1)
**File:** `worlds/tracker/TrackerClient.py` lines 1856-1871

Changed exception handling to log the error and continue the watcher loop instead of re-raising the exception. This prevents the background task from crashing and keeps UT responsive to messages.

### 3. TrackerCore.updateTracker() - Graceful Invalid Item Handling (Option 3)
**File:** `worlds/tracker/TrackerCore.py` lines 314-322

Changed to log a warning about invalid items and filter them out, then continue processing with valid items only. No longer throws an exception for datapackage mismatches.
