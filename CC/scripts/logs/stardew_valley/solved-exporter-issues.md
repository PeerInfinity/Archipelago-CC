# Solved Exporter Issues

## Issue 1: Virtual event items not exported

**Problem**: Virtual event items like "Received Progression Percent" and "Received Progression Item" were not in the items list, causing rule evaluation failures.

**Solution**: Added `get_item_data()` override in `exporter/games/stardew_valley.py` to export these virtual items with proper metadata (event=true, max_count, etc.).

**Commits**: c6af8e4f

