# Remaining Exporter Issues for Factorio

This file tracks issues related to the Factorio exporter (`exporter/games/factorio.py`).

## Status

No exporter issues identified. The exporter successfully generated the rules.json file with proper structure for:
- Event items (e.g., "Automated automation-science-pack")
- Complex access rules with `all_of` comprehensions
- Location definitions with proper access rules
- Game-specific variables (required_technologies)

The current test failure is not related to the exporter but to the state manager's handling of event items.
