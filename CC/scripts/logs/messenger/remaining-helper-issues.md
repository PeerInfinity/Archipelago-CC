# The Messenger - Remaining Helper Issues

Currently, there are no helper issues. The `can_afford` helper exists but is incorrectly being used due to an exporter issue. Once the exporter is fixed to properly export shop location access rules as item checks, the `can_afford` helper should not be needed.

If the exporter issue cannot be fixed and we need to keep the helper approach, then we would need:

## Potential Issue: can_afford helper needs location context

**Status**: Deferred (waiting for exporter fix)

### Description

The `can_afford` helper currently returns `true` unconditionally because it cannot access the location's cost attribute. Helpers receive `(snapshot, staticData, ...args)` but not the location context.

### Potential Solutions if Needed

1. Pass cost as an argument in the exporter
2. Modify the rule engine to pass location context to helpers
3. Store cost data in staticData keyed by location name
