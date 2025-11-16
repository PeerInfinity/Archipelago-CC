# DLCQuest Exporter - Solved Issues

## Issue 1: Handler returned no item data
**Status:** Resolved via post_process_data method

**Description:**
During generation, the exporter showed:
```
Handler for DLCQuest returned no item data. Item export might be incomplete.
```

**Solution:**
The exporter already has a `post_process_data` method that:
1. Adds special accumulator items (" coins" and " coins freemium")
2. Extracts coin bundle items from locations (e.g., "4 coins", "46 coins")
3. Sets up proper item definitions with advancement, groups, and max_count

The warning message was informational only - the coin items are correctly added during post-processing.
