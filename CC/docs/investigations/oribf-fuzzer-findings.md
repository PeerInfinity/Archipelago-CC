# Ori and the Blind Forest UT Fuzzer Investigation

## Summary

The Ori and the Blind Forest (oribf) apworld fails Universal Tracker fuzzer testing due to an incompatibility between its rule pattern and the exporter's rule analyzer.

**Test Results:**
- Total runs: 10
- Success: 2 (20%)
- Failures: 8
- Error type: `None` (logic mismatch)

## Root Cause

The oribf apworld uses a custom helper function `oribf_has` that handles special keywords and conditions. This pattern causes an infinite loop in the exporter's rule analyzer.

### The `oribf_has` Helper Function

Located in `oribf/Rules.py`, this function handles:

1. **Special keywords:**
   - `"Free"` → Returns `True` (location freely accessible)
   - `"Lure"` → Checks `options.enable_lure`
   - `"DoubleBash"` → Checks option + `state.has("Bash")`
   - `"GrenadeJump"` → Checks option + multiple items
   - `"ChargeDash"`, `"AirDash"`, `"TripleJump"`, etc.

2. **Item tuples:**
   - `("HealthCell", 3)` → `state.has("HealthCell", player, 3)`
   - Used for item count requirements

3. **Standard items:**
   - Regular items like "Dash", "Climb", "Wind" → `state.has(item, player)`

### Rule Pattern

Rules are applied via:
```python
add_rule(access_point, lambda state: all(oribf_has(world, state, item) for item in access_set), "or")
```

Where `access_set` comes from `RulesData.py`:
```python
"FirstPickup": {
    "casual": [["Free"]]
}
```

## Failure Mechanism

1. **Exporter analyzes rules** → Hits `oribf_has` helper
2. **Analyzer recurses** → Hits 10000+ call limit (infinite loop detection)
3. **Helper not exported** → Rules JSON references `oribf_has` but helper body is empty
4. **World generator converts** → `oribf_has("Free")` becomes `Has('Free')`
5. **UT evaluates** → Checks if player has item named "Free" (doesn't exist)
6. **Result** → Locations that should be freely accessible are marked inaccessible

### Example of Broken Export

**Original rule (should be accessible):**
```python
"FirstPickup": {"casual": [["Free"]]}  # Should return True
```

**Exported to rules.json as:**
```json
{
  "rule": "AST_all_of",
  "args": {
    "element_rule": {"type": "helper", "name": "oribf_has", ...},
    "iterator_info": {"iterator": {"value": ["Free"]}}
  }
}
```

**Generated in worldgen Rules.py as:**
```python
world.set_rule(multiworld.get_location("FirstPickup", player), Has('Free'))
```

**UT interpretation:** "Player must have item 'Free'" → False → Location inaccessible

## Other Broken Conversions

The same issue affects other keywords and patterns:

| Original | Incorrectly Generated |
|----------|----------------------|
| `"Free"` | `Has('Free')` |
| `"Lure"` | `Has('Lure')` |
| `"DoubleBash"` | `Has('DoubleBash')` |
| `("HealthCell", 3)` | `Has('[\'HealthCell\', 3]')` |
| `"None"` | `Has('None')` |

## Potential Fixes

### Option 1: Create oribf Game Exporter

Create `exporter/games/unofficial/oribf.py` that:
1. Intercepts `oribf_has` helper calls
2. Expands `"Free"` → `True_`
3. Expands technique keywords → appropriate option/item checks
4. Expands tuples → `HasCount(item, count)`

**Pros:** Proper fix, maintains original logic
**Cons:** Complex, requires handling all oribf-specific keywords

### Option 2: Update World Generator

Modify `world_generator/rule_codegen.py` to:
1. Recognize `"Free"` as a special keyword → `True_`
2. Handle unknown item names gracefully

**Pros:** Simple, helps other apworlds
**Cons:** Doesn't fix option-dependent logic like `"Lure"`

### Option 3: Report to APWorld Maintainer

Document the incompatibility and request the maintainer to:
1. Refactor rules to not use complex helper functions
2. Use standard Archipelago rule patterns

**Pros:** Long-term fix for the apworld
**Cons:** Depends on maintainer responsiveness

### Option 4: Add to Known-Incompatible List

Mark oribf as incompatible with UT tracking.

**Pros:** Quick, documents the limitation
**Cons:** No actual fix

## Implementation Status

A custom exporter has been implemented at `exporter/games/unofficial/oribf.py`.

### What the Exporter Handles

1. **Combined rule pattern**: Rules created via `add_rule(location, lambda, "or")` are expanded by extracting the `old_rule` and `rule` closure variables.

2. **access_set extraction**: The `access_set` closure variable is extracted from oribf rule lambdas.

3. **Keyword conversion**:
   - `"Free"` → `True_` (always accessible)
   - `"Open"` → `True_` (dungeons not implemented)
   - `"OpenWorld"` → `False` (not implemented)
   - `"Lure"`, `"Rekindle"` → option-dependent
   - `"DoubleBash"`, `"GrenadeJump"`, `"ChargeFlameBurn"`, etc. → option + item requirements

4. **Item tuple conversion**: `("HealthCell", 3)` → `Has("HealthCell", count=3)`

### Results

| Metric | Before | After |
|--------|--------|-------|
| Export time (10 runs) | ~400s (timeouts) | ~12s |
| Timeouts | 30%+ | 0% |
| Success rate | ~20-30% | ~30-60% (variable) |

### Remaining Issues

The remaining failures occur with:
- `logic_difficulty: glitched` settings that have additional rule requirements
- Complex option combinations where rules evaluate differently

These would require deeper analysis of the RulesData.py to handle all edge cases.

## Recommendation

The exporter provides significant improvements:
1. Eliminates timeouts completely
2. Fixes the "Free" keyword conversion
3. Handles basic to intermediate logic

For full compatibility, additional work would be needed to handle glitched logic rules.

## APWorld Metadata

- **Game:** Ori and the Blind Forest
- **World directory:** `oribf/` (from custom_worlds/oribf.apworld)
- **Download URL:** https://github.com/c-ostic/Archipelago/releases/download/v0.3.3-alpha/oribf.apworld
- **Missing manifest:** Yes (will stop working with AP 0.7.0)
- **World class:** `OriBlindForestWorld`

## Files Examined

- `oribf/__init__.py` - World class definition
- `oribf/Rules.py` - Rule application with `oribf_has` helper
- `oribf/RulesData.py` - Rule data with special keywords
- `oribf/Options.py` - Option definitions
- `exporter/exporter.py` - Rule analysis (hit infinite loop)
- `world_generator/rule_codegen.py` - Rule code generation
