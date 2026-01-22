# Monster Sanctuary UT Fuzz Test Failure Investigation

## Summary

Monster Sanctuary (community apworld v1.3.7-hotfix1) fails UT fuzzer testing with 100% failure rate due to a **fundamental architectural incompatibility** between the apworld's rule system and the exporter/world generator.

**Root Cause**: The apworld uses a custom `AccessCondition` class to evaluate rules at runtime. The exporter can only see the lambda that calls `rules.has_access()`, but cannot introspect the actual logic stored inside the `AccessCondition` object.

**Severity**: Critical - this cannot be fixed without either modifying the apworld or creating extensive custom export handling.

## Technical Details

### How Monster Sanctuary Defines Rules

1. **Data-driven approach**: Rules are defined in `data/world.json` as structured arrays:
   ```json
   {
     "region": "MountainPath_North1",
     "connections": [{
       "region": "MountainPath_North7",
       "requirements": [
         "OR", [
           ["AND", ["casual", "OR", ["double_jump", "improved_flying", "dual_mobility"]]],
           ["AND", ["NOT casual", "OR", ["double_jump", "improved_flying", "lofty_mount"]]]
         ]
       ]
     }]
   }
   ```

2. **AccessCondition class** (`rules.py`): Parses the requirements array and builds a tree of conditions with `AND`/`OR` operations. Each leaf node references a helper function by name (e.g., `double_jump`, `casual`).

3. **Connection rules** (`regions.py:MonsterSanctuaryConnection`):
   ```python
   def get_access_func(self, player: int):
       return lambda state: self.access_rules is None or self.access_rules.has_access(state, player)
   ```

### What the Exporter Sees

When the exporter analyzes the lambda, it captures:
```python
lambda state: rules.has_access()
```

Where `rules` is a closure variable pointing to an `AccessCondition` instance. The exporter creates an AST representation:
```json
{
  "rule": "AST_function_call",
  "args": {
    "function": {
      "type": "attribute",
      "object": {"type": "name", "name": "rules"},
      "attr": "has_access"
    }
  }
}
```

### Why the World Generator Fails

The world generator converts the exported JSON back to Python code:
```python
lambda state: rules.has_access()
```

But there is **no `rules` object defined** in the generated world. The `AccessCondition` object's internal state (the parsed requirements tree) is not captured in the export.

### Error Observed

```
NameError: name 'rules' is not defined

File "worlds/monster_sanctuary_worldgen_*/Rules.py", line 25, in <lambda>
    lambda state: rules.has_access()
```

## Attempted Solutions

None - this is a fundamental incompatibility.

## Recommendations

### Option 1: Add Monster Sanctuary to Known Incompatible List (Recommended)

Add Monster Sanctuary to a list of apworlds known to be incompatible with UT fuzzing. This is the most practical solution as it accurately reflects the current state.

### Option 2: Create Custom Export Handler (High Effort)

Create a game handler in `exporter/games/unofficial/monster_sanctuary.py` that:
1. Detects `AccessCondition` objects in closure variables
2. Introspects the `AccessCondition` tree structure
3. Reconstructs the original requirements array
4. Exports the rules in a format that can be regenerated

This would require:
- Understanding the full `AccessCondition` class API
- Handling all helper function names
- Converting between the tree structure and JSON export format

Estimated effort: 2-3 days of development + testing

### Option 3: Request APWorld Update (Upstream Fix)

Open an issue with the apworld maintainer requesting they adopt standard Archipelago rule patterns:
- Use direct lambdas with `state.has()` calls
- Avoid custom rule evaluation classes

This would make the apworld compatible with the exporter and UT fuzzing.

Repository: https://github.com/Gtaray/archipelago-monstersanctuary

## Files Affected

- `custom_worlds/monster_sanctuary.apworld` - The apworld package
- `exporter/` - No changes needed (working as designed)
- `world_generator/` - No changes needed (working as designed)

## Test Reproduction

```bash
# Install the apworld
curl -L -o custom_worlds/monster_sanctuary.apworld \
  "https://github.com/Gtaray/archipelago-monstersanctuary/releases/download/v1.3.7-hotfix1/monster_sanctuary.apworld"

# Generate templates
source .venv/bin/activate
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer
python fuzz.py -r 1 -j 1 -g monster_sanctuary -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0

# Check error log
cat fuzz_output/error/monster_sanctuary/0/0.log
```

## Conclusion

The Monster Sanctuary apworld uses a custom rule evaluation system that is architecturally incompatible with the exporter's approach of decompiling and reconstructing rule lambdas. The apworld's rules are stored as internal object state, not as analyzable Python code.

**Recommended Action**: Add Monster Sanctuary to a known-incompatible list for UT fuzzing until either a custom handler is developed or the apworld is updated to use standard patterns.
