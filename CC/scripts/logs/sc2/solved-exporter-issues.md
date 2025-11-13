# Starcraft 2 - Solved Exporter Issues

This file tracks exporter-related issues that have been resolved for Starcraft 2.

## Issue 1: Logic attribute access not converted to helper calls [SOLVED]

**Status:** SOLVED
**Solved Date:** 2025-11-13
**Priority:** CRITICAL
**Solution:** Created custom exporter for SC2

**Description:**
The exporter was generating access rules that referenced `logic.method_name` as attribute access on a variable called "logic", but the JavaScript rule engine doesn't have a "logic" variable in context.

**Solution Implemented:**
Created `exporter/games/sc2.py` that converts `logic.method_name()` patterns to helper calls.
