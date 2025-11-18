# Solved Exporter Issues for Ocarina of Time

This file tracks exporter issues that have been resolved.

## Solved Issues

### Issue 1: Subrule locations not properly exported ✓ FIXED

**Status**: Resolved
**Sphere**: 0
**Type**: Exporter issue - lambda source code analysis failure
**Files modified**: `worlds/oot/RuleParser.py`

**Description**:
During generation, the analyzer failed to get source code for dynamically created lambda functions used in "Subrule" locations. This resulted in these locations having `access_rule: null` in the rules.json file, causing them to be inaccessible in the frontend.

**Error messages during generation**:
```
analyze_rule: Failed to clean source, returning error.
Failed to analyze or expand rule for Location 'Kokiri Forest Subrule 1' using runtime analysis.
Failed to get multiline lambda source for <function <lambda> at 0x...>: [Errno 2] No such file or directory: '<string>'
Fallback getsource also failed: could not get source code
```

**Affected locations** (9 total):
- Kokiri Forest Subrule 1
- Lost Woods Subrule 1
- Lost Woods Subrule 2
- LW Beyond Mido Subrule 1
- Hyrule Field Subrule 1
- Hyrule Field Subrule 2
- Lake Hylia Subrule 1
- Graveyard Subrule 2
- Deku Tree Lobby Subrule 1

**Test failure before fix**:
Spoiler test failed at Sphere 0. Locations accessible in STATE but NOT in LOG: [all 9 subrule locations listed above]

**Solution**:
Modified `worlds/oot/RuleParser.py` in the `create_delayed_rules()` method to store the unparsed AST as a `rule_string` attribute on subrule event locations before they're compiled into lambda functions:

```python
# Store the unparsed AST as a rule_string for the exporter
try:
    event.rule_string = ast.unparse(node)
except Exception as e:
    logging.getLogger('').warning(f'Failed to unparse AST for {subrule_name}: {e}')
    event.rule_string = None
```

This allows the OOT exporter to access the original rule text through the `rule_string` attribute, bypassing the need to inspect dynamically compiled lambdas.

**Test results after fix**:
- Subrule locations now export correctly with proper access rules
- Test progressed from failing at Sphere 0 to Sphere 0.8
- All 9 subrule locations are now properly accessible in the frontend
