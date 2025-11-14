# The Wind Waker - Remaining Exporter Issues

*This file tracks exporter issues that still need to be fixed.*

## Status
- Basic exporter created (using GenericGameExportHandler)
- Initial generation run completed
- Found 1 exporter issue

## Issue 1: Dictionary Argument Analysis Failed

**Description:** The analyzer fails to handle dictionary arguments in function calls.

**Error Message:**
```
Failed to analyze argument 0 in call: Dict(keys=[Constant(value='Power Bracelets'), Constant(value='Skull Hammer'), Constant(value='ET Small Key')], values=[Constant(value=1), Constant(value=1), Constant(value=3)])
```

**Impact:** This appears 6 times in the generation output. The dictionary contains item names as keys and counts as values.

**Likely Cause:** The exporter/analyzer doesn't have logic to convert Python dict AST nodes to JSON format.

**Fix Location:** `exporter/analyzer.py` - need to add dictionary handling in the analysis code

**Priority:** Medium - Generation still completed, but some rules may not be exported correctly

## Next Steps
1. Investigate which TWW functions use dictionary arguments
2. Implement dictionary analysis in exporter/analyzer.py
3. Re-run generation to verify fix
