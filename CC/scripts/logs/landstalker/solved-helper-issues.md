# Solved Helper Issues for Landstalker

## Overview

This document tracks helper function issues that were identified and resolved during development.

## Issues Resolved Prior to Testing (2025-12-09)

The following issues were addressed in the initial implementation:

### 1. Unresolved Variable References for Regions

**Problem**: The exporter produces rules with unresolved `regions` variables that the helper couldn't evaluate.

**Solution**: The `_landstalker_has_visited_regions` helper handles undefined/null regions gracefully by treating them as "no regions required" (returns true). This allows the system to work even when static analysis cannot fully resolve region requirements.

### 2. Region Object vs String Handling

**Problem**: Regions could be passed as either Region objects (with `.code` property) or as strings.

**Solution**: The helper checks for both formats:
```javascript
const regionCode = typeof region === 'object' && region.code ? region.code : region;
```

### 3. Event Name Construction

**Problem**: The helper needs to construct event names in the format `event_visited_<region_code>`.

**Solution**: The helper properly constructs the event name and uses the `has` function to check:
```javascript
const eventName = `event_visited_${regionCode}`;
if (!has(snapshot, staticData, eventName)) {
  return false;
}
```
