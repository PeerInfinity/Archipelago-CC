# Pokemon Emerald - Remaining General Issues

## Issue 1: Worker timeout at Sphere 7.103 (hm_rules evaluation)

**Status**: In Progress
**Priority**: High
**Sphere**: Fails at Sphere 7.103

### Description
The spoiler test now progresses past the earlier spheres but times out at Sphere 7.103 with "Timeout waiting for ping response". This suggests a performance issue or infinite loop when evaluating hm_rules.

### Details
- **Error**: Timeout waiting for ping response (queryId: 188)
- **Sphere**: 7.103
- **Root cause**: The hm_rules evaluation in resolveName may be causing performance issues or getting stuck

### Current Implementation
The hm_rules dictionary is built dynamically in `resolveName` from `hm_requirements`:
- For each HM, it creates a rule object that checks: `has(HM) AND (has_all(badges) OR has_group_unique("Badge", count))`
- The rules are returned as a dictionary where `hm_rules["HM03 Surf"]` gives the rule object

### Potential Issues
1. The function_call case might not properly handle rule objects returned from subscripts
2. Building hm_rules dynamically every time it's referenced might be inefficient
3. There might be a circular reference or evaluation loop

### Next Steps
1. Check how function_call handles evaluating rule objects
2. Consider caching the hm_rules dictionary instead of rebuilding it each time
3. Add logging to see what's happening during the timeout
