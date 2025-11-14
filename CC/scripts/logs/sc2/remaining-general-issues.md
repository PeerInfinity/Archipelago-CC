# Remaining SC2 General Issues

Currently, there are no general issues beyond exporter and helper issues.

All general architecture and infrastructure for SC2 support is in place:
- ✅ Custom exporter handler (`exporter/games/sc2.py`)
- ✅ Custom helper file (`frontend/modules/shared/gameLogic/sc2/helpers.js`)
- ✅ Rules.json generation working
- ✅ Sphere log generation working
- ✅ Test infrastructure working

The remaining work is primarily:
1. Fixing the `self.attribute` resolution in the rule engine or exporter (see remaining-exporter-issues.md)
2. Implementing additional helper functions as needed (see remaining-helper-issues.md)
