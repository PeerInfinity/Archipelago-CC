# Solved Exporter Issues for Landstalker

## Overview

This document tracks exporter issues that were identified and resolved during development.

## Issues Resolved Prior to Testing (2025-12-09)

The following patterns were handled in the initial implementation:

### 1. Complex `has_all(set(...))` Patterns

**Problem**: The Landstalker world uses `state.has_all(set(required_items), player)` which produces nested rule structures.

**Solution**: Implemented `_simplify_has_all` method to convert these to simple item checks or AND conditions.

### 2. Region Object to Code Conversion

**Problem**: `required_regions` closure variable contains Region objects which cannot be serialized directly.

**Solution**: Implemented `prepare_closure_vars` to convert Region objects to their string codes before analysis.

### 3. Unresolved Iterator Variables in `all_of` Rules

**Problem**: The `all(state.has("event_visited_" + region.code, player) for region in regions)` pattern produces rules with unresolved `regions` iterator.

**Solution**: Implemented `_resolve_all_of_iterator` to use the regions from the closure stack and build concrete event_visited_ conditions.

### 4. Binary Operation for Event Names

**Problem**: `"event_visited_" + region.code` produces binary_op rules that need to be resolved to concrete event names.

**Solution**: Implemented `_simplify_region_event_binary_op` to resolve these to concrete event name strings.
