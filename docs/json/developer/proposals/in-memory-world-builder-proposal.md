# In-Memory World Builder for Rule Explain Support

## Overview

This proposal describes a system to enable the Rule Builder's "explain" feature for worlds that don't natively support Rule Builder, by reconstructing rule objects from JSON export data at runtime.

## Current Status (Updated January 2026)

**All phases are complete.** The JSONWorldBuilder implementation uses worldgen worlds for native Rule Builder explain support. Integration tests pass with real exports (TUNIC, A Short Hike).

| Component | Status | Notes |
|-----------|--------|-------|
| `ASTRule` class | ✅ Complete | Replaces proposed `UnknownRule` |
| AST format parser | ✅ Complete | 25+ rule types supported |
| AST explain module | ✅ Complete | Full explain_json() support |
| Data extraction | ✅ Complete | `ExtractedData` class with all fields |
| Schema versioning | ✅ Complete | All exports have `schema_version` |
| `JSONWorldBuilder` | ✅ Complete | `world_generator/json_world_builder.py` |
| `MinimalWorldContext` | ~~Not needed~~ | Use real world instance instead |
| Tracker integration | ✅ Complete | `TrackerCore.load_worldgen_world()` |

## Problem Statement

The Rule Builder's explain feature provides detailed rule explanations via `explain_json()` and `explain_str()` methods on Rule objects. However, this only works for worlds that use Rule Builder natively. For other worlds:

1. The JSON exporter captures rules as AST format JSON from Python lambda functions
2. This JSON accurately represents rules at the specific moment of export
3. The Universal Tracker cannot explain these rules because they're plain lambda functions

## Solution (Partially Implemented)

The solution involves two parts:

1. **AST Rule Parsing & Explain (COMPLETE)**: Parse AST format JSON directly into Rule Builder objects with explain support
2. **JSONWorldBuilder Orchestration (COMPLETE)**: An orchestration layer to load JSON exports and instantiate worldgen worlds

### Architecture

```
JSON Export (rules.json)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    JSONWorldBuilder (COMPLETE)               │
│                                                              │
│  ┌─────────────┐    ┌─────────────────────────────────────┐ │
│  │ JSON Loader │ -> │ WorldGen World Instantiation        │ │
│  │ (metadata)  │    │ (uses _worldgen world from same JSON)│ │
│  └─────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Real World Instance
                    (with native Rule Builder explain support)
```

**Key insight:** The `_worldgen` world was generated from the same JSON rules file, so:
- Its structure exactly matches the JSON data
- It uses Rule Builder natively with full explain support
- No need for a separate `MinimalWorldContext` - we get a real world instance

### Key Components

#### 1. ASTRule Class (COMPLETE)

Located in `rule_builder/rules.py:2272-2324`. This replaces the originally proposed `UnknownRule` class with a more general solution:

```python
@dataclasses.dataclass()
class ASTRule(Rule[TWorld], game="Archipelago"):
    """
    Wraps an AST format rule that can't be converted to a native Rule Builder class.

    This class provides explain support for complex AST format rules while
    delegating evaluation to either a pre-computed value or returning True
    as a fallback.
    """
    rule_data: dict = dataclasses.field(default_factory=dict)

    class Resolved(Rule.Resolved):
        rule_data: dict
        skip_cache: ClassVar[bool] = True

        def _evaluate(self, state: CollectionState) -> bool:
            # AST rules currently return True as fallback
            return True

        def explain_json(self, state: CollectionState | None = None) -> list[JSONMessagePart]:
            from rule_builder.ast_explain import explain_ast_rule
            return explain_ast_rule(self.rule_data, state, self.player)

        def explain_str(self, state: CollectionState | None = None) -> str:
            rule_type = self.rule_data.get('type', 'unknown')
            return f"[AST:{rule_type}]"
```

#### 2. AST Format Parser (COMPLETE)

Located in `rule_builder/ast_format.py` (658 lines). Supports 25+ AST rule types:

```python
def parse_ast_rule(data: Mapping[str, Any], world_cls: type["RuleWorldMixin"]) -> "Rule[Any]":
    """Parse an AST format rule dict into a Rule Builder Rule object."""
    rule_type = data.get('type')

    # Supports: constant, item_check, count_check, group_check, state_method,
    # and, or, not, can_reach, region_check, location_check, can_reach_entrance,
    # conditional, helper, compare/comparison, binary_op/binop, option_value,
    # world_attribute, and more

    if rule_type == 'item_check':
        return _parse_item_check(data)
    # ... 25+ type handlers

    else:
        # Unknown type - wrap in ASTRule for explain support
        logger.debug(f"Wrapping unknown AST rule type '{rule_type}' in ASTRule")
        return ASTRule(rule_data=dict(data))
```

**Recent enhancement (Jan 2026):** Split `setting_value` into separate types:
- `option_value` - for user-configurable options (`world.options.*`)
- `world_attribute` - for runtime-computed values (`world.*`)

#### 3. AST Explain Module (COMPLETE)

Located in `rule_builder/ast_explain.py` (510 lines). Provides detailed rule explanations:

```python
def explain_ast_rule(
    rule_data: dict,
    state: CollectionState | None,
    player: int,
    depth: int = 0
) -> list[JSONMessagePart]:
    """Explain an AST format rule, returning JSONMessagePart list."""
    # Handles all AST rule types with proper formatting
    # Returns colored output (green=accessible, salmon=inaccessible)
    # Supports nested explanations with depth tracking (max 50 levels)
```

#### 4. Data Extraction (COMPLETE)

Located in `world_generator/extractors.py`. The `ExtractedData` class contains all fields needed:

```python
@dataclass
class ExtractedData:
    """All extracted data from a JSON rules file."""
    metadata: GameMetadata
    items: Dict[str, ItemData]
    locations: Dict[str, LocationData]
    regions: Dict[str, RegionData]
    exits: Dict[str, ExitData]
    item_groups: List[str]
    item_name_groups: Dict[str, List[str]]
    start_region: str
    original_placements: Dict[str, str]
    helpers: Dict[str, HelperData]
    itempool_counts: Dict[str, int]
    locked_placements: Dict[str, str]
    starting_items: Dict[str, int]
    accumulator_rules: List[Dict[str, Any]]
    prog_items_init: Dict[str, int]
    canonical_placements: Dict[str, str]
    progression_mapping: Dict[str, List[str]]
    world_attributes: Dict[str, Any]
    dungeons: Dict[str, DungeonData]
```

#### 5. JSONWorldBuilder Class (COMPLETE)

Location: `world_generator/json_world_builder.py`

**Revised approach:** Instead of creating a `MinimalWorldContext`, we instantiate the corresponding `_worldgen` world. This world was generated from the same JSON rules, so its structure matches exactly and it has native Rule Builder support with full explain functionality.

```python
from pathlib import Path
from typing import Optional
from argparse import Namespace
import json

from BaseClasses import MultiWorld, CollectionState
from worlds import AutoWorldRegister
from world_generator.extractors import extract_all, ExtractedData


class JSONWorldBuilder:
    """
    Builds world instances from JSON export data.

    Uses the corresponding _worldgen world which was generated from the same
    JSON rules file, ensuring exact structural match and native Rule Builder
    explain support.
    """

    def __init__(self, json_path: str):
        self.json_path = Path(json_path)
        self.data: Optional[ExtractedData] = None
        self.world: Optional["World"] = None
        self.multiworld: Optional[MultiWorld] = None
        self.schema_version: Optional[int] = None

    def load(self) -> ExtractedData:
        """Load and parse JSON export."""
        with open(self.json_path) as f:
            json_data = json.load(f)
        self.schema_version = json_data.get('schema_version')
        self.data = extract_all(json_data)
        return self.data

    def build_world(self, worldgen_game_name: Optional[str] = None) -> "World":
        """
        Create a world instance from the corresponding _worldgen world.

        Args:
            worldgen_game_name: Name of the worldgen world to use. If None,
                               derives from JSON metadata (e.g., "TUNIC" -> "TUNIC WorldGen")

        Returns:
            Instantiated World with Rule Builder support
        """
        if self.data is None:
            self.load()

        # Derive worldgen name if not provided
        if worldgen_game_name is None:
            base_name = self.data.metadata.game
            worldgen_game_name = f"{base_name} WorldGen"

        # Create MultiWorld
        self.multiworld = MultiWorld(1)
        self.multiworld.game[1] = worldgen_game_name
        self.multiworld.player_name = {1: "Player"}
        self.multiworld.set_seed(seed=1)  # Deterministic for explain

        # Set up options
        world_type = AutoWorldRegister.world_types[worldgen_game_name]
        args = Namespace()
        for name, option in world_type.options_dataclass.type_hints.items():
            setattr(args, name, {1: option.from_any(option.default)})

        self.multiworld.set_options(args)
        self.multiworld.state = CollectionState(self.multiworld)

        self.world = self.multiworld.worlds[1]
        return self.world

    def get_world(self) -> Optional["World"]:
        """Get the instantiated world."""
        return self.world

    def get_state(self) -> Optional[CollectionState]:
        """Get the collection state for the world."""
        if self.multiworld:
            return self.multiworld.state
        return None

    def supports_explain(self) -> bool:
        """Check if this export supports explain functionality."""
        return self.schema_version is not None and self.schema_version >= 3


def create_world_from_json(json_path: str, worldgen_game_name: Optional[str] = None) -> tuple:
    """
    Convenience function to create a world instance from JSON.

    Args:
        json_path: Path to the JSON rules file
        worldgen_game_name: Optional override for worldgen world name

    Returns:
        Tuple of (world, multiworld, state)
    """
    builder = JSONWorldBuilder(json_path)
    builder.load()
    world = builder.build_world(worldgen_game_name)
    return world, builder.multiworld, builder.multiworld.state
```

**Key benefits of this approach:**
- No `MinimalWorldContext` needed - use a real world instance
- Rule Builder explain support works natively
- World structure exactly matches the JSON source
- Full compatibility with existing Archipelago infrastructure

### Integration Points

#### Universal Tracker Integration (COMPLETE)

The tracker integration has been implemented in `worlds/tracker/TrackerCore.py`:

```python
class TrackerCore:
    def __init__(self, ...):
        # ... existing init
        self.json_builder: Optional[JSONWorldBuilder] = None
        self.worldgen_world: Optional[World] = None

    def load_worldgen_world(self, json_path: str, worldgen_game_name: Optional[str] = None) -> bool:
        """Load worldgen world from JSON for explain support."""
        try:
            self.json_builder = JSONWorldBuilder(json_path)
            self.json_builder.load()
            self.worldgen_world = self.json_builder.build_world(worldgen_game_name)
            return True
        except Exception as e:
            logger.warning(f"Failed to load worldgen world: {e}")
            return False

    def explain_location(self, location: Location, state: CollectionState) -> list:
        """Explain a location's access rule."""
        # Priority 1: Rule Builder native support (works with worldgen worlds)
        if hasattr(location.access_rule, 'explain_json'):
            return location.access_rule.explain_json(state)

        # Priority 2: World's custom explain support
        if hasattr(location.parent_region.world, 'explain_rule'):
            return location.parent_region.world.explain_rule(location, state)

        # Fallback: No explain available
        return [{"text": "Rule explanation not available", "type": "info"}]
```

Since the worldgen world uses Rule Builder natively, the explain fallback chain simplifies - we just check for `explain_json` on the rule directly.

### JSON Source Location

The JSON export will be saved to the Players directory with a filename matching the template. This allows the tracker to automatically locate the corresponding JSON for any game.

**Example mapping:**
- Template: `Players/MyGame.yaml`
- JSON Export: `Players/MyGame.json`

The exporter will be updated to save to this location automatically.

### Version Compatibility (COMPLETE)

All JSON exports now include a `schema_version` field (currently version 3):

```json
{
  "schema_version": 3,
  "game": "My Game",
  "regions": [...],
  "locations": [...],
  ...
}
```

**Implemented compatibility strategy:**
- All exports have `schema_version` field
- Version 3 is current and includes all AST rule types
- `option_value` and `world_attribute` types added in recent updates

### Handling Unknown Rules (COMPLETE)

When rules cannot be fully converted to native Rule Builder classes, they are wrapped in `ASTRule`:

**Current handling:**
- `ASTRule` wraps rules that can't be parsed to native Rule types
- `ASTRule.explain_json()` delegates to `ast_explain.explain_ast_rule()` for detailed explanations
- Unknown/unsupported AST types still get basic explain support via the AST explain module
- `ASTRule._evaluate()` returns `True` as a conservative fallback (may be enhanced in future)

### Helper Function Integration

Helper functions are handled automatically by the worldgen world approach:
- The world generator converts helper functions to Rule Builder `HelperCall` rules
- These are included in the generated world's `Rules.py`
- No runtime reconstruction needed - helpers work natively

## Implementation Phases

### Phase 1: Core Infrastructure ✅ COMPLETE
- ✅ Add `ASTRule` class to rules.py (replaces proposed `UnknownRule`)
- ✅ Add schema version to exports (version 3)
- ✅ World generator creates `_worldgen` worlds from JSON

### Phase 2: Rule Resolution ✅ COMPLETE
- ✅ AST format parser fully implemented (25+ rule types)
- ✅ AST explain module fully implemented (all rule types)
- ✅ `ASTRule` wrapping for unknown types
- ✅ Helper function parsing in AST format

### Phase 3: Orchestration Layer ✅ COMPLETE
- ✅ Created `JSONWorldBuilder` class in `world_generator/json_world_builder.py`
- ✅ Implemented worldgen world instantiation from JSON metadata
- ✅ Unit tests in `scripts/test/test-json-world-builder.py`

### Phase 4: Tracker Integration ✅ COMPLETE
- ✅ Added `load_worldgen_world()` method to TrackerCore
- ✅ Added `explain_location_rule()` method with worldgen fallback
- ✅ Updated `explain` function in TrackerClient to use worldgen fallback
- Manual JSON path loading (auto-discovery can be added later)

### Phase 5: Testing & Polish ✅ COMPLETE
- ✅ Integration tests with real exports (TUNIC, A Short Hike)
- ⚠️ Performance optimization (world caching) - deferred for future enhancement
- ✅ Test script updated with proper world initialization

## Performance Considerations

- **Lazy loading**: Only parse rules when first accessed
- **Caching**: Cache resolved rules per session
- **Memory**: Consider memory impact of holding all rules
- **Startup time**: Measure and optimize JSON loading time

Exact performance characteristics require experimentation with real-world exports.

## Caching Strategy

Implement caching at multiple levels:

1. **File-level cache**: Cache parsed ExtractedData by file path + mtime
2. **Rule-level cache**: Cache resolved rules by location name
3. **Session cache**: Maintain cache for duration of tracker session

```python
class RuleCache:
    def __init__(self, max_size: int = 1000):
        self.cache: Dict[str, Rule.Resolved] = {}
        self.max_size = max_size

    def get(self, key: str) -> Optional[Rule.Resolved]:
        return self.cache.get(key)

    def set(self, key: str, rule: Rule.Resolved):
        if len(self.cache) >= self.max_size:
            # LRU eviction
            self.cache.pop(next(iter(self.cache)))
        self.cache[key] = rule
```

## Open Questions

1. **Multi-world support**: How to handle JSON exports from multi-world generations?
   - *Status*: Multi-world exports exist in `frontend/presets/multiworld/` with per-player rules files
2. **Option-dependent rules**: How to handle rules that vary based on player options?
   - *Status*: Partially addressed with `option_value` and `world_attribute` AST types
3. **Dynamic rules**: How to handle rules that change during gameplay (e.g., boss shuffle)?
   - *Status*: Still open - requires runtime evaluation support

## Summary of Completed Work

### All Phases Complete
- ✅ `JSONWorldBuilder` class in `world_generator/json_world_builder.py`
- ✅ `create_world_from_json()` convenience function
- ✅ Unit tests in `scripts/test/test-json-world-builder.py`
- ✅ `TrackerCore.load_worldgen_world()` method
- ✅ `TrackerCore.explain_location_rule()` with worldgen fallback
- ✅ TrackerClient `explain` function updated to use worldgen fallback
- ✅ Integration tests with real exports (TUNIC, A Short Hike)
- ✅ Test script properly initializes world with `create_regions()` and `set_rules()`

### Future Enhancements (Optional)
1. Performance optimization (cache instantiated worlds)
2. Auto-discovery of JSON path from template filename
3. Additional game testing

## Related Work

- [Path Analyzer Module](../guides/module-system.md) - Frontend path analysis using similar JSON data
- [World Generator Guide](../guides/world-generator.md) - Existing JSON to Python conversion
- [Rule Exporter Comparison](../comparison/rule-exporter-comparison.md) - Analysis of rule export formats

## References

### Implemented Components
- `rule_builder/rules.py:2272-2324` - ASTRule class implementation
- `rule_builder/ast_format.py` - AST format JSON parser (658 lines, 25+ types)
- `rule_builder/ast_explain.py` - AST explain module (510 lines)
- `world_generator/extractors.py` - JSON extraction logic (`ExtractedData` class)
- `exporter/exporter.py` - JSON exporter with schema_version

### Integration Targets (Modified)
- `worlds/tracker/TrackerCore.py` - Added `load_worldgen_world()` and `explain_location_rule()`
- `worlds/tracker/TrackerClient.py` - Updated `explain` function with worldgen fallback

### Not Yet Modified
- `frontend/modules/pathAnalyzer/pathAnalyzerLogic.js` - Frontend path analyzer (future enhancement)
