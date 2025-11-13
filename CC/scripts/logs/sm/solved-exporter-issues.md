# Super Metroid - Solved Exporter Issues

## Issue 1: No exporter existed
**Status**: ✅ Solved

**Problem**: Super Metroid had no exporter, so no rules.json could be generated.

**Solution**: Created a basic exporter that inherits from `GenericGameExportHandler`.

**Files Created**:
- `exporter/games/sm.py`

**Result**: Generation now succeeds and produces rules.json and sphere log files.

## Issue 2: `self.evalSMBool()` function calls
**Status**: ✅ Solved

**Problem**: Rules contained `self.evalSMBool()` function calls where `self` is the Python SMWorld object. The JavaScript rule engine couldn't resolve `self` as a name.

**Solution**: Implemented `expand_rule()` method in SMGameExportHandler that transforms function calls to `self.evalSMBool()` into direct helper calls.

**Transformation**:
- From: `{"type": "function_call", "function": {"type": "attribute", "object": {"type": "name", "name": "self"}, "attr": "evalSMBool"}, ...}`
- To: `{"type": "helper", "name": "evalSMBool", ...}`

**Implementation** (in `exporter/games/sm.py`):
```python
def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively expand and transform Super Metroid rules.

    Transforms self.evalSMBool() function calls into direct helper calls
    that the JavaScript frontend can execute.
    """
    if not rule:
        return rule

    rule_type = rule.get('type')

    # Transform function_call nodes where function is an attribute access on 'self'
    if rule_type == 'function_call':
        function = rule.get('function', {})
        if function.get('type') == 'attribute':
            obj = function.get('object', {})
            attr = function.get('attr')

            # Transform self.evalSMBool(...) into a helper call
            if obj.get('type') == 'name' and obj.get('name') == 'self' and attr == 'evalSMBool':
                args = rule.get('args', [])
                return {
                    'type': 'helper',
                    'name': 'evalSMBool',
                    'args': [self.expand_rule(arg) for arg in args]
                }

    # ... (recursive processing of nested structures)
    return rule
```

**Result**:
- No more "Name 'self' NOT FOUND" errors
- Helper functions are properly found and called
- Rules are now in a format the frontend can attempt to evaluate

**Test Result**: Test progresses further but now fails on a different issue (references to `state.smbm[player]` - see remaining-exporter-issues.md).
