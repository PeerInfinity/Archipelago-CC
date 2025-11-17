# Remaining General Issues - Super Metroid

## Status
No general issues identified yet. Primary issues are in exporter and helper categories.

## Notes
- Super Metroid uses the VARIA randomizer system, which is significantly more complex than typical Archipelago world logic
- The current approach of simplifying all logic to constant True is incompatible with spoiler testing
- May need architectural decisions about how to handle VARIA logic in JavaScript frontend
