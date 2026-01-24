# Exporter

The exporter module converts Archipelago game logic (Python rules, regions, items) into JSON format for use by the web frontend and other tools.

## Quick Start

```python
from exporter import export_game_rules

# Export rules for a generated multiworld
export_game_rules(
    multiworld,
    output_dir="frontend/presets/",
    filename_base="rules",
    rules_json_format="rule_builder"  # or "archipelago_cc"
)
```

## Directory Structure

```
exporter/
├── exporter.py              # Main export orchestrator
├── constants.py             # Safety limits & configuration
├── sphere_logger.py         # Sphere tracking during generation
├── profiling.py             # Performance profiling
│
├── analyzer/                # Python → JSON rule conversion
│   ├── analysis.py          # Main entry point: analyze_rule()
│   ├── rule_analyzer.py     # Core AST visitor (RuleAnalyzer)
│   ├── expression_resolver.py
│   ├── cache.py
│   └── ast_visitors/        # Modular AST node handlers
│
├── converter/               # Bidirectional format conversion
│   ├── cli.py               # Command-line interface
│   ├── python_to_json.py    # Python → JSON
│   ├── json_to_python.py    # JSON → Python
│   ├── ast_to_rule_builder.py
│   └── rule_builder_to_ast.py
│
└── games/                   # Game-specific handlers (43 games)
    ├── generic.py           # GenericGameExportHandler (default)
    ├── base/                # Base classes & mixins
    └── [game handlers]      # alttp.py, sm.py, witness.py, etc.
```

## Key Components

### Analyzer (`analyzer/`)

Converts Python rule functions to JSON rule trees using AST analysis.

```python
from exporter.analyzer import analyze_rule

# Analyze a rule function
rule_dict = analyze_rule(
    rule_func=lambda state: state.has('Sword'),
    game_handler=handler,
    player_context=1
)
# Result: {"type": "has", "args": ["Sword"]}
```

**Key files:**
- `analysis.py` - Main API entry point
- `rule_analyzer.py` - `RuleAnalyzer` class that traverses Python AST
- `ast_visitors/` - Modular visitors for different AST node types

### Converter (`converter/`)

Bidirectional conversion between rule formats.

```bash
# CLI usage
python -m exporter.converter input.json -o output.json --format cc
python -m exporter.converter --python "state.has('Sword')" --to-json
```

**Supported conversions:**
- Python code ↔ Archipelago-CC JSON format
- Archipelago-CC ↔ Rule Builder format

See `converter/README.md` for detailed usage.

### Game Handlers (`games/`)

Game-specific export customization. Each game can have a handler that:
- Defines which helpers to export
- Customizes option handling
- Provides game-specific rule transformations

```python
from exporter.games import get_game_export_handler

# Get handler for a world (falls back to GenericGameExportHandler)
handler = get_game_export_handler(world=my_world)
```

**Creating a custom handler:**

```python
from exporter.games.generic import GenericGameExportHandler

class MyGameHandler(GenericGameExportHandler):
    GAME_NAME = "My Game"
    HELPER_MODULES = ['worlds.mygame.rules']
    EXPORTED_OPTIONS = ['difficulty', 'starting_items']
    AUTO_EXPORT_DISCOVERED_HELPERS = True
```

**43 game handlers available** including:
- `alttp.py` - A Link to the Past (complex bunny/glitch modes)
- `sm.py` - Super Metroid
- `witness.py` - The Witness
- `tunic.py` - TUNIC
- And 39 more...

## Configuration

### Handler Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `GAME_NAME` | World class name | Display name for the game |
| `HELPER_MODULES` | `[]` | Modules containing helper functions |
| `EXPORTED_OPTIONS` | `[]` | Game options to include in export |
| `AUTO_EXPORT_DISCOVERED_HELPERS` | `True` | Auto-export discovered helpers |
| `EXPORT_CHOICE_OPTIONS_AS_NUMERIC` | `True` | Export choices as numbers vs strings |
| `HELPERS_TO_EXPORT_WHITELIST` | `set()` | Explicitly export these helpers |
| `HELPERS_TO_EXPORT_BLACKLIST` | `set()` | Never export these helpers |

### Safety Limits (`constants.py`)

| Constant | Default | Purpose |
|----------|---------|---------|
| `MAX_ANALYZE_RULE_CALLS` | 10000 | Prevent infinite loops |
| `MAX_ANALYZER_OPERATIONS` | 5000 | Limit AST visits per rule |
| `MAX_RULE_EXPANSION_DEPTH` | 100 | Prevent circular helper references |
| `MAX_RULE_SIZE_KB` | 100 | Flag unusually large rules |

## Base Classes & Mixins

The handler system uses composition via mixins:

- **`BaseGameExportHandler`** - Core class with configuration
- **`GenericGameExportHandler`** - Recommended base with intelligent defaults
- **`RuleExpansionMixin`** - Recursive helper expansion
- **`WorldDataMixin`** - Extract world data (items, regions, options)
- **`HelperDiscoveryMixin`** - Auto-discover helper functions
- **`OptionNormalizationMixin`** - Convert options to export format

## Output Format

The exporter produces JSON files containing:

- **`rules`** - Location access rules as JSON AST
- **`regions`** - Region definitions and connections
- **`items`** - Item definitions and classifications
- **`locations`** - Location definitions
- **`options`** - Game option values
- **`helpers`** - Exported helper function definitions

## Related Documentation

- **[World Generator Guide](../docs/json/developer/guides/world-generator.md)** - Convert JSON back to Python worlds
- **[Testing Pipeline](../docs/json/developer/guides/testing-pipeline.md)** - How exports are validated
- **[Rule Types Reference](../docs/json/developer/reference/rule-types.md)** - Supported rule types

## Development

### Running Tests

```bash
# Analyzer tests
python -m pytest exporter/analyzer/test_ast_visitors.py

# Converter tests
python -m pytest exporter/converter/
```

### Profiling

```python
from exporter.profiling import ExporterProfiler

with ExporterProfiler() as profiler:
    export_game_rules(multiworld, ...)

profiler.print_stats()
```
