# Super Metroid - Remaining Helper Issues

## Overview
This file tracks issues with Super Metroid helper functions that need to be implemented or fixed in the frontend.

Currently, the main blocker is the exporter issue with accessFrom patterns (see remaining-exporter-issues.md). Once that is resolved, we can properly test which helper functions are missing or incorrectly implemented.

## Known Required Helpers (from Python source)

The following VARIA logic helpers are referenced in the Python code and will likely need implementation:

- canPassTerminatorBombWall
- canPassCrateriaGreenPirates
- canMockball
- traverse (various traverse checks)
- canPassBombPassages
- knowsAlcatrazEscape
- (many more - to be catalogued as we test)

## Status
Waiting for exporter issues to be resolved before comprehensive testing.
