# Solved Exporter Issues - Blasphemous

*Last Updated: 2025-11-26*

## Issue 1: Boss Check Methods - Incorrect AND/OR Logic Structure

### Problem
The `override_rule_analysis` method in `exporter/games/blasphemous.py` was incorrectly exporting boss check methods. It used a simple regex to extract all region names and combined them into a single OR condition:

```python
# Old incorrect code
region_matches = re.findall(r'can_reach_region\(["\']([^"\']+)["\']', source)
# All regions were ORed together
conditions.append({
    'type': 'or',
    'conditions': region_conditions
})
```

This resulted in incorrect logic for boss methods like `can_beat_jondo_boss` which have complex AND/OR structures:

**Python Source:**
```python
def can_beat_jondo_boss(self, state: CollectionState) -> bool:
    return (
        self.has_boss_strength(state, "amanecida")
        and state.can_reach_region("D01Z06S01[Santos]", self.player)
        and (
            state.can_reach_region("D20Z01S06[NE]", self.player)
            or state.can_reach_region("D20Z01S04[W]", self.player)
        )
        and (
            state.can_reach_region("D03Z01S04[E]", self.player)
            or state.can_reach_region("D03Z02S10[N]", self.player)
        )
    )
```

**Incorrect Export:**
```json
{
  "type": "and",
  "conditions": [
    {"type": "helper", "name": "has_boss_strength", "args": [{"type": "constant", "value": "amanecida"}]},
    {"type": "or", "conditions": [
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D01Z06S01[Santos]"}]},
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D03Z01S04[E]"}]},
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D03Z02S10[N]"}]},
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D20Z01S04[W]"}]},
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D20Z01S06[NE]"}]}
    ]}
  ]
}
```

### Symptoms
- State mismatches starting at sphere 4.27
- Locations `GotP: Amanecida of the Bejeweled Arrow`, `PotSS: Amanecida of the Chiselled Steel`, `WotHP: Amanecida of the Molten Thorn`, `MotED: Amanecida of the Golden Blades` were accessible in STATE but not in LOG
- Region `Amanecida[D03Z01S03]` was accessible in STATE but not in LOG

### Solution
Added two new methods to properly parse boss method source code using Python's AST module:

1. `_parse_boss_method_ast(rule_func, boss_name)` - Entry point that gets source code and initiates AST parsing
2. `_ast_to_rule(node, boss_name)` - Recursively converts AST nodes to rule dictionaries, preserving AND/OR structure

**Correct Export:**
```json
{
  "type": "and",
  "conditions": [
    {"type": "helper", "name": "has_boss_strength", "args": [{"type": "constant", "value": "amanecida"}]},
    {"type": "or", "conditions": [
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D03Z01S04[E]"}]},
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D03Z02S10[N]"}]}
    ]},
    {"type": "or", "conditions": [
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D20Z01S04[W]"}]},
      {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D20Z01S06[NE]"}]}
    ]},
    {"type": "state_method", "method": "can_reach_region", "args": [{"type": "constant", "value": "D01Z06S01[Santos]"}]}
  ]
}
```

### Files Changed
- `exporter/games/blasphemous.py` - Replaced regex-based parsing with AST-based parsing in `override_rule_analysis`

### Affected Boss Methods
- `can_beat_jondo_boss`
- `can_beat_patio_boss`
- `can_beat_wall_boss`
- `can_beat_hall_boss`
- `can_beat_graveyard_boss`
- And all other boss methods with complex AND/OR region requirements
