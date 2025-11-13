# DLCQuest Helper Function Remaining Issues

## Overview
This document tracks remaining issues with DLCQuest helper functions (frontend/modules/shared/gameLogic/dlcquest/dlcquestLogic.js).

Last updated: 2025-11-13

## Issues

### None Currently Identified

The access rules for DLCQuest locations do not appear to use custom helper functions.  Instead, they use standard rule types like:
- `compare` (e.g., `state.prog_items[1][" coins"] >= 4`)
- `subscript` (for accessing nested structures)
- `attribute` (for accessing object properties)

If custom DLCQuest helpers are needed in the future, they will be documented here.

