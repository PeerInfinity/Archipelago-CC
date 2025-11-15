# OOT Exporter Issues

## Status
Last updated: 2025-11-15

## Critical Issues

None currently - exporter is generating valid rules.json

## Notes

The exporter is using the `parse_oot_rule` helper approach which exports OOT's DSL rule strings directly. This allows the frontend to parse and evaluate them. The exporter appears to be working correctly.

Some lambda functions fail to analyze (Forest Temple locations, Ice Cavern), but these are expected due to OOT's use of dynamically generated lambdas. The rule_string approach handles these correctly.
