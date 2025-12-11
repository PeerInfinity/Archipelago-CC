# Remaining Exporter Issues - Kirby's Dream Land 3

This document tracks issues with the KDL3 exporter (`exporter/games/kdl3.py`).

## Issues

*No remaining issues. All spoiler tests pass.*

## Notes

The exporter correctly exports `copy_abilities` in the settings section. The issue with the `can_assemble_rob` and `can_fix_angel_wings` helpers was resolved by having the JavaScript helpers look up `copy_abilities` from settings rather than relying on the passed argument.
