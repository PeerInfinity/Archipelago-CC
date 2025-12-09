# Remaining Helper Issues - Castlevania 64

This document tracks helper function issues that need to be fixed.

## Issues

(No remaining helper issues - all tests passing)

## Notes

The `location_item_name` helper is implemented in JavaScript (`frontend/modules/shared/gameLogic/cv64/helpers.js`) and uses `staticData.locationItems` to look up item placements. This helper is blacklisted from auto-export because the Python implementation uses `state.multiworld.get_location()` which isn't available in JavaScript.
