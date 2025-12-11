# Remaining Exporter Issues - Mega Man 2

*Last updated: 2025-12-11*

## Overview

This document tracks unresolved exporter issues for Mega Man 2.

## Issues

### Issue #1: world.wily_5_weapons dict captured as array of keys

**Status:** KNOWN - Workaround Applied

**Description:**
When the exporter captures `world.wily_5_weapons` from the Python lambda in `can_defeat_enough_rbms` calls, it captures only the dict keys `[0, 1, 2, 3, 4, 5, 6, 7, 12]` instead of the full dict `{0: [], 1: [], ...}`.

**Impact:**
The JavaScript helper receives incorrect data in its `boss_requirements` argument.

**Workaround:**
The JavaScript helper (`mm2Logic.js`) has been updated to ignore the incorrect args and read `wily_5_weapons` directly from `staticData.game_info[1].slot_data.wily_5_weapons`, which contains the correct data.

**Root Cause (for future investigation):**
The exporter's analyzer likely iterates over dict objects incorrectly, getting just keys instead of the full dict. This could affect other games with similar dict arguments.

**Future Fix:**
Investigate the exporter's analyzer to properly handle dict arguments in lambda functions.
