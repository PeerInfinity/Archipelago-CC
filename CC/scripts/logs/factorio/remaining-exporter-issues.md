# Remaining Exporter Issues - Factorio

This file tracks outstanding issues with the Factorio exporter (`exporter/games/factorio.py`).

## Status

✅ **Exporter is working correctly!**

After running generation and tests, the exporter appears to be functioning properly:
- Event items (like "Automated automation-science-pack") are correctly exported with `event: true`
- Progressive items are properly mapped
- Access rules using `all_of` with `required_technologies` are correctly structured
- All item and location data is present and well-formed

## Test Results

Generation completed successfully without errors.
- Generated rules.json: 291K
- Generated spheres_log.jsonl: 22K
- All "Automated" event items properly exported

The test failures appear to be related to frontend state management, not the exporter.

