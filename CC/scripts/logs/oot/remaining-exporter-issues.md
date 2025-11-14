# Remaining Exporter Issues for Ocarina of Time

This document tracks unresolved issues with the OOT exporter (exporter/games/oot.py).

---

## Issues

### Issue 1: "Failed to clean source" errors during generation

**File**: `exporter/analyzer.py` (likely)

**Error Messages** (from generate_output.txt):
```
analyze_rule: Failed to clean source, returning error.
```

**Count**: 32 occurrences during generation

**Description**:
During the `Generate.py` execution, the rule analyzer failed to clean the source code for 32 rules. This suggests that some lambda functions or rule definitions in the OOT world have source code that cannot be properly analyzed or decompiled.

**Impact**:
- Some rules may not be properly exported to the rules.json file
- These rules might fall back to generic analysis or error rules
- May cause locations/exits with these rules to be inaccessible or incorrectly evaluated

**Investigation Needed**:
1. Examine which specific rules/locations are generating these errors
2. Check if the OOT world uses complex lambda constructs that the analyzer can't handle
3. Determine if this is a systemic issue with the analyzer or specific to certain OOT rule patterns

**Current Workaround**:
The OOT exporter uses `override_rule_analysis()` to bypass lambda analysis and use OOT's `rule_string` attribute directly. This should avoid most of these errors for locations and exits that have rule_string attributes.

**Next Steps**:
1. Check generate_output.txt for more context around these errors
2. Verify that the rules.json file is complete despite these errors
3. Determine if these errors correlate with specific failed tests
4. Consider whether all OOT rules need the rule_string approach or if some need lambda analysis

**Status**: Low priority - may be expected behavior if rule_string approach is working
