# Adding Game Support to the World Generator

This guide explains how to expand the world generator to support more games from Archipelago-CC.

## Overview

The world generator creates standalone Archipelago worlds from `rules.json` files exported by the CC frontend. The process involves:

1. **Rule Parsing**: Converting CC format rules to Rule Builder objects
2. **Code Generation**: Generating Python world files from extracted data
3. **Testing**: Validating the generated world produces equivalent results

## Adding Support for a New Game

### Step 1: Check Rule Types

First, identify what rule types the game uses:

```bash
python3 -c "
import json
from pathlib import Path

game = 'your_game_directory'
rules_file = list(Path(f'frontend/presets/{game}').glob('AP_*/*_rules.json'))[0]
with open(rules_file) as f:
    data = json.load(f)

types = set()
def get_types(obj):
    if isinstance(obj, dict):
        if 'type' in obj:
            types.add(obj['type'])
        for v in obj.values():
            get_types(v)
    elif isinstance(obj, list):
        for item in obj:
            get_types(item)

regions = data.get('regions', {}).get('1', {})
for region in regions.values():
    get_types(region)

print(f'Rule types used: {sorted(types)}')
"
```

### Step 2: Test Rule Parsing

Test if all rules can be parsed:

```bash
source .venv/bin/activate
python3 -c "
import json
import sys
sys.path.insert(0, '.')
from pathlib import Path
from rule_builder.cc_format import parse_cc_rule, is_cc_format
from rule_builder.rules import RuleWorldMixin

class DummyWorld(RuleWorldMixin):
    pass

game = 'your_game_directory'
rules_file = list(Path(f'frontend/presets/{game}').glob('AP_*/*_rules.json'))[0]
with open(rules_file) as f:
    data = json.load(f)

rules = []
regions = data.get('regions', {})
for player_regions in regions.values():
    for region in player_regions.values():
        for exit in region.get('exits', []):
            if 'access_rule' in exit and exit['access_rule']:
                rules.append((f\"exit:{exit['name']}\", exit['access_rule']))
        for loc in region.get('locations', []):
            if 'access_rule' in loc and loc['access_rule']:
                rules.append((f\"loc:{loc['name']}\", loc['access_rule']))

print(f'Found {len(rules)} rules')
failed = []
for name, rule in rules:
    try:
        if is_cc_format(rule):
            parsed = parse_cc_rule(rule, DummyWorld)
    except Exception as e:
        failed.append((name, str(e)))
        print(f'  ✗ {name}: {e}')

print(f'Passed: {len(rules) - len(failed)}/{len(rules)}')
"
```

### Step 3: Run the World Generator Test

```bash
source .venv/bin/activate

# Generate the test world
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --phase generate-test-worlds

# Regenerate templates to include the _test world
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --phase regenerate-templates

# Run the test phase
python scripts/test/test-world-generator.py --include-list "Game Name Test.yaml" --phase test
```

### Step 4: Add to Test Suite

Update `scripts/test/test_cc_format_parsing.py` to include the new game:

```python
games_to_test = [
    # ... existing games ...
    ("game_directory", "Game Name"),
]
```

### Step 5: Commit and Push

```bash
git add frontend/presets/game_directory/ frontend/presets/game_directory_test/ \
       frontend/presets/preset_files.json scripts/data/world-mapping.json \
       scripts/test/test_cc_format_parsing.py worlds/game_directory_test/ \
       scripts/output/world-generator/test-results.json

git commit -m "Add Game Name support and test world"
git push
```

---

## Adding Support for New Rule Types

When a game uses an unsupported rule type, you need to add parsing support.

### Relevant Files

| File | Purpose |
|------|---------|
| `rule_builder/cc_format.py` | Parses CC format rules into Rule Builder objects |
| `world_generator/rule_codegen.py` | Generates Python code from CC format rules |

### Step 1: Understand the Rule Structure

Examine examples of the rule type in a rules.json file:

```bash
python3 -c "
import json
from pathlib import Path

game = 'game_with_new_rule_type'
rules_file = list(Path(f'frontend/presets/{game}').glob('AP_*/*_rules.json'))[0]
with open(rules_file) as f:
    data = json.load(f)

# Find examples of the rule type
def find_type(obj, target_type, examples):
    if isinstance(obj, dict):
        if obj.get('type') == target_type:
            examples.append(obj)
        for v in obj.values():
            find_type(v, target_type, examples)
    elif isinstance(obj, list):
        for item in obj:
            find_type(item, target_type, examples)

examples = []
find_type(data, 'new_rule_type', examples)
for ex in examples[:5]:
    print(json.dumps(ex, indent=2))
"
```

### Step 2: Add Parser in cc_format.py

Add a parsing function in `rule_builder/cc_format.py`:

```python
def _parse_new_rule_type(data: Mapping[str, Any], world_cls: type["RuleWorldMixin"]) -> "Rule[Any]":
    """Parse new_rule_type from CC format.

    Expected format:
    {
        "type": "new_rule_type",
        "field1": "value1",
        "field2": {"type": "constant", "value": 42}
    }
    """
    # Extract values, handling constant wrappers
    field1 = _extract_value(data.get('field1'))
    field2 = _extract_value(data.get('field2'))

    # Convert to Rule Builder format
    return SomeRule(field1=field1, field2=field2)
```

Add the handler to the dispatch table in `parse_cc_rule`:

```python
handlers: Dict[str, Callable[[Mapping[str, Any], type], Rule[Any]]] = {
    # ... existing handlers ...
    'new_rule_type': _parse_new_rule_type,
}
```

### Step 3: Add Code Generator in rule_codegen.py

Add a converter method in `world_generator/rule_codegen.py`:

```python
def _convert_new_rule_type(self, rule: Dict[str, Any]) -> str:
    """Convert new_rule_type to Python code."""
    field1 = rule.get('field1', '')
    field2 = self._extract_constant_value(rule.get('field2'))

    # Generate the equivalent Python code
    return f'SomeRule(field1="{field1}", field2={field2})'
```

Add to the converters dictionary in `__init__`:

```python
self.converters = {
    # ... existing converters ...
    'new_rule_type': self._convert_new_rule_type,
}
```

### Step 4: Handle Nested Constants

Many CC format rules wrap values in constant objects:

```python
def _extract_value(value: Any, default: Any = None) -> Any:
    """Extract a value from a potential constant wrapper."""
    if isinstance(value, dict) and value.get('type') == 'constant':
        return value.get('value', default)
    return value if value is not None else default
```

### Step 5: Test the New Rule Type

Run the parsing test on a game that uses the new rule type:

```bash
source .venv/bin/activate
python scripts/test/test_cc_format_parsing.py
```

---

## Adding New Data to rules.json for World Generator

When the world generator needs additional data from the original game, update the exporter.

### Relevant Files

| File | Purpose |
|------|---------|
| `exporter/exporter.py` | Exports game state to rules.json |
| `world_generator/extractors.py` | Extracts data from rules.json |
| `world_generator/templates.py` | Generates Python code using extracted data |

### Example: Adding Locked Placements

This example shows how the `locked` field was added to support pre-filled items.

#### Step 1: Update the Exporter

In `exporter/exporter.py`, add the new field when processing locations:

```python
location_data = {
    'name': location_name,
    'id': location_name_to_id.get(location_name, None),
    'access_rule': access_rule_result,
    'item_rule': item_rule_result,
    'item': None,
    'locked': getattr(location, 'locked', False)  # NEW: Track locked status
}
```

#### Step 2: Update the Extractors

In `world_generator/extractors.py`, add the field to the data class:

```python
@dataclass
class LocationData:
    """Extracted location data."""
    name: str
    location_id: Optional[int]
    region: str
    access_rule: Optional[Dict[str, Any]] = None
    is_event: bool = False
    original_item: Optional[str] = None
    locked: bool = False  # NEW
```

Update `ExtractedData` if needed:

```python
@dataclass
class ExtractedData:
    # ... existing fields ...
    locked_placements: Dict[str, str] = field(default_factory=dict)  # NEW
```

Update the extraction function:

```python
def extract_locations(json_data: Dict[str, Any]) -> Tuple[Dict[str, LocationData], Dict[str, str], Dict[str, str]]:
    # ... existing code ...

    is_locked = loc_info.get('locked', False)

    locations[loc_name] = LocationData(
        # ... existing fields ...
        locked=is_locked,
    )

    if is_locked and item_name:
        locked_placements[loc_name] = item_name

    return locations, original_placements, locked_placements
```

#### Step 3: Update the Templates

In `world_generator/templates.py`, generate code that uses the new data:

```python
# Build locked_placements dictionary
locked_entries = []
for loc_name, item_name in sorted(data.locked_placements.items()):
    if item_name:
        loc_escaped = loc_name.replace('\\', '\\\\').replace('"', '\\"')
        item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
        locked_entries.append(f'    "{loc_escaped}": "{item_escaped}",')

locked_content = '\n'.join(locked_entries)
```

Include in the generated template:

```python
# Locked placements - items that must be placed via place_locked_item
LOCKED_PLACEMENTS: Dict[str, str] = {{
{locked_content}
}}
```

Generate the method that uses the data:

```python
def _place_locked_items(self) -> None:
    """Place items that must be in specific locations (locked placements)."""
    for location_name, item_name in LOCKED_PLACEMENTS.items():
        if item_name and item_name in item_table:
            location = self.multiworld.get_location(location_name, self.player)
            item_data = item_table[item_name]
            item = {class_name}Item(
                item_name,
                item_data.classification,
                item_data.id,
                self.player
            )
            location.place_locked_item(item)
```

#### Step 4: Test

Regenerate a game's rules.json to include the new field:

```bash
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --phase generate-test-worlds
```

Then run the full test to verify it works:

```bash
python scripts/test/test-world-generator.py --include-list "Game Name Test.yaml" --phase test
```

---

## Currently Supported Rule Types

| Rule Type | Description | File |
|-----------|-------------|------|
| `constant` | Boolean true/false | `cc_format.py` |
| `item_check` | Check if player has item | `cc_format.py` |
| `group_check` | Check if player has items from group | `cc_format.py` |
| `and` | All conditions must be true | `cc_format.py` |
| `or` | Any condition must be true | `cc_format.py` |
| `can_reach` | Check if region is reachable | `cc_format.py` |
| `location_check` | Check if location is accessible | `cc_format.py` |
| `can_reach_entrance` | Check if entrance is reachable | `cc_format.py` |
| `state_method` | Call a state method (has_all, has_any, etc.) | `cc_format.py` |
| `conditional` | If-then-else logic | `cc_format.py` |
| `helper` | Call a helper function | `cc_format.py` |
| `compare` | Comparison operations (>=, <=, etc.) | `cc_format.py` |

---

## Current Test Coverage

Games with full world generator support:

| Game | Rules | Status |
|------|-------|--------|
| Adventure | 42 | ✓ Pass |
| Bumper Stickers | 104 | ✓ Pass |
| A Short Hike | 132 | ✓ Pass |
| Inscryption | 104 | ✓ Pass |
| Lufia II Ancient Cave | 42 | ✓ Pass |
| Saving Princess | 44 | ✓ Pass |
| Faxanadu | 142 | ✓ Pass |
| The Witness | 387 | ✓ Pass |
| TUNIC | 816 | ✓ Pass |
| Lingo | 610 | ✓ Pass |

---

## Troubleshooting

### FillError: Not enough locations for items

This usually means:
1. Items with `None` IDs are being counted in the pool but shouldn't be
2. Locked placements aren't being subtracted from item pool counts

Check `ITEMPOOL_COUNTS` and `LOCKED_PLACEMENTS` in the generated `__init__.py`.

### Rule parsing fails with "Unknown rule type"

Add a handler for the new rule type in `rule_builder/cc_format.py`.

### Generated world has different sphere order

The generated world may place items differently due to:
1. Missing locked placements
2. Different item pool composition
3. Missing event items

Use the cross-validation test to identify discrepancies.
