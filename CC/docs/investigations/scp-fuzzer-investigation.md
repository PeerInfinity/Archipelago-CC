# Super Cat Planet (SCP) UT Fuzzer Investigation

## Summary

**Game**: Super Cat Planet
**APWorld Version**: v0.1.4b
**Template**: `Super Cat Planet.yaml`
**Failure Rate**: 40% (4 out of 10 runs)
**Error Type**: Logic mismatch (None)

## Root Cause

The exporter does not capture **keyword arguments** in helper function calls. This causes the `enough_cats` helper function to receive incorrect parameters.

### Specific Issue

The apworld defines the "Dye [Black - ???]" location with this rule:

```python
# In scp/Rules.py
multiworld.get_location(loc, player).access_rule = lambda state: enough_cats(state, world, extra_walls_table, 1, strange=True)
```

The `strange=True` keyword argument is critical because it determines which cat counting branch to use:
- `strange=True`: Counts "Strange Cat" items
- `strange=False`: Counts regular "Cat" items

However, the exporter only captures positional arguments, not keyword arguments. The exported rule looks like:

```json
{
  "rule": "enough_cats",
  "args": [
    {"rule": "Constant", "args": {"value": {"Village_Jungle": "Purple Switch", ...}}},
    {"rule": "Constant", "args": {"value": 1}}
  ]
}
```

Notice that **`strange=True` is missing**. When the worldgen world regenerates the rule, it defaults to `strange=False`:

```python
# In generated Rules.py
HelperCall(helper_func=enough_cats, helper_name="enough_cats", args=({...}, 1,))
```

### Code Location

The issue is in `exporter/analyzer/ast_visitors/call_visitor.py`. The `visit_Call` method processes `node.args` (positional arguments) but never processes `node.keywords` (keyword arguments).

```python
# Current code (around line 74-101)
for i, arg_node in enumerate(node.args):  # Only positional args!
    arg_result = self.visit(arg_node)
    ...
# node.keywords is never processed
```

## Impact

This affects any apworld (or world) that uses keyword arguments in helper function calls. The impact depends on whether the keyword argument has a meaningful default value:
- If the default matches the intended behavior, no issue
- If the default differs from the intended behavior, logic mismatch occurs

For Super Cat Planet:
- The `strange` parameter defaults to `False`
- When `strange=True` is required but not captured, the rule checks the wrong cat type
- This causes the server to see locations as accessible when the UT doesn't (or vice versa)

## Workaround Options

### 1. Fix in Exporter (Recommended)
Add support for keyword arguments in `call_visitor.py:visit_Call()`. This would require:
- Processing `node.keywords` in addition to `node.args`
- Including kwargs in the exported JSON structure
- Updating the world generator to pass kwargs to helper functions

### 2. Create Game-Specific Exporter Handler
Create `exporter/games/scp.py` that handles the `enough_cats` function specially. This is a partial workaround that only fixes this specific game.

### 3. Report to APWorld Maintainer
The apworld maintainer could refactor to avoid keyword arguments:
```python
# Instead of:
enough_cats(state, world, extra_walls_table, 1, strange=True)
# Use:
enough_strange_cats(state, world, extra_walls_table, 1)  # New function
```

## Recommended Solution

**Option 1 (Fix in Exporter)** is the most comprehensive solution as it benefits all current and future apworlds that use keyword arguments.

The fix involves:
1. In `call_visitor.py:visit_Call()`, add processing for `node.keywords`
2. In the JSON schema, add a `kwargs` field to helper rule structures
3. In `world_generator`, update `HelperCall` generation to include kwargs

## Files Involved

- `exporter/analyzer/ast_visitors/call_visitor.py` - Add keyword argument processing
- `frontend/schema/rules.schema.json` - Add kwargs to schema
- `world_generator/code_generators/rules_generator.py` - Handle kwargs in rule generation
- `rule_builder/rule_node.py` - Ensure HelperCall supports kwargs

## Test Verification

Run the fuzzer to verify fixes:
```bash
source .venv/bin/activate
python fuzz.py -r 10 -j 4 -g scp -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

Current expected results: ~40% failure rate
Fixed expected results: 0% failure rate (or different failure causes)

## Investigation Date

2026-01-21
