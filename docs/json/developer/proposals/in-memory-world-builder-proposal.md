# In-Memory World Builder for Rule Explain Support

## Overview

This proposal describes a system to enable the Rule Builder's "explain" feature for worlds that don't natively support Rule Builder, by reconstructing rule objects from JSON export data at runtime.

## Current Status (Updated January 2026)

**Phase 1-2 are substantially complete.** The core infrastructure for parsing AST format rules and providing explain support now exists. Key remaining work is the orchestration layer (`JSONWorldBuilder`) and tracker integration.

| Component | Status | Notes |
|-----------|--------|-------|
| `ASTRule` class | ✅ Complete | Replaces proposed `UnknownRule` |
| AST format parser | ✅ Complete | 25+ rule types supported |
| AST explain module | ✅ Complete | Full explain_json() support |
| Data extraction | ✅ Complete | `ExtractedData` class with all fields |
| Schema versioning | ✅ Complete | All exports have `schema_version` |
| `JSONWorldBuilder` | ❌ Not started | Orchestration class needed |
| `MinimalWorldContext` | ❌ Not started | Context for rule resolution |
| Tracker integration | ❌ Not started | Explain fallback chain |

## Problem Statement

The Rule Builder's explain feature provides detailed rule explanations via `explain_json()` and `explain_str()` methods on Rule objects. However, this only works for worlds that use Rule Builder natively. For other worlds:

1. The JSON exporter captures rules as AST format JSON from Python lambda functions
2. This JSON accurately represents rules at the specific moment of export
3. The Universal Tracker cannot explain these rules because they're plain lambda functions

## Solution (Partially Implemented)

The solution involves two parts:

1. **AST Rule Parsing & Explain (COMPLETE)**: Parse AST format JSON directly into Rule Builder objects with explain support
2. **JSONWorldBuilder Orchestration (NOT STARTED)**: An orchestration layer to load JSON exports and provide rule lookup for the tracker

### Architecture

```
JSON Export
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    JSONWorldBuilder (NOT STARTED)            │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ JSON Loader │ -> │ Extractor   │ -> │ Rule Parser     │  │
│  │             │    │ (COMPLETE)  │    │ (COMPLETE)      │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                ↓             │
│                                    ┌─────────────────────┐  │
│                                    │ MinimalWorldContext │  │
│                                    │   (NOT STARTED)     │  │
│                                    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Rule.Resolved objects
                    with explain support (via ASTRule)
```

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

#### 5. JSONWorldBuilder Class (NOT STARTED)

Proposed location: `world_generator/json_world_builder.py`

```python
class JSONWorldBuilder:
    """Builds in-memory rule structures from JSON export data."""

    def __init__(self, json_path: str):
        self.json_path = Path(json_path)
        self.data: Optional[ExtractedData] = None
        self.context: Optional[MinimalWorldContext] = None
        self.resolved_rules: Dict[str, Rule.Resolved] = {}
        self.schema_version: Optional[int] = None

    def load(self) -> ExtractedData:
        """Load and parse JSON export."""
        with open(self.json_path) as f:
            json_data = json.load(f)
        self.schema_version = json_data.get('schema_version')
        self.data = extract_all(json_data)
        return self.data

    def build_context(self, world_cls: type) -> MinimalWorldContext:
        """Create minimal context for rule resolution."""
        self.context = MinimalWorldContext(self.data, world_cls)
        return self.context

    def resolve_rules(self) -> Dict[str, Rule.Resolved]:
        """Parse and resolve all rules from JSON."""
        for loc_name, loc_data in self.data.locations.items():
            if loc_data.rule:
                rule = parse_ast_rule(loc_data.rule, self.context.world_cls)
                self.resolved_rules[loc_name] = rule.resolve(self.context)
        return self.resolved_rules

    def get_rule_for_location(self, location_name: str) -> Optional[Rule.Resolved]:
        """Get resolved rule for a specific location."""
        return self.resolved_rules.get(location_name)

    def supports_explain(self) -> bool:
        """Check if this export supports explain functionality."""
        return self.schema_version is not None and self.schema_version >= 3
```

#### 6. MinimalWorldContext Class (NOT STARTED)

Provides rule resolution context without requiring a full World instance:

```python
class MinimalWorldContext:
    """Minimal context for rule resolution from JSON data."""

    def __init__(self, data: ExtractedData, world_cls: type):
        self.data = data
        self.world_cls = world_cls
        self.item_name_groups = data.item_name_groups
        self.helper_functions: Dict[str, Callable] = {}
        self._unknown_rules: Set[str] = set()

    def get_item_count(self, item_name: str) -> int:
        """Get max count for an item."""
        if item_name in self.data.items:
            return self.data.items[item_name].count
        return 1

    def resolve_helper(self, helper_name: str) -> Optional[Callable]:
        """Resolve a helper function by name."""
        if helper_name in self.helper_functions:
            return self.helper_functions[helper_name]
        self._unknown_rules.add(f"helper:{helper_name}")
        return None

    def has_unknown_rules(self) -> bool:
        return len(self._unknown_rules) > 0

    def get_unknown_rules(self) -> Set[str]:
        return self._unknown_rules.copy()
```

### Integration Points

#### Universal Tracker Integration (NOT STARTED)

The tracker integration remains to be implemented. Modify `worlds/tracker/TrackerCore.py` to use JSONWorldBuilder:

```python
class TrackerCore:
    def __init__(self, ...):
        # ... existing init
        self.json_builder: Optional[JSONWorldBuilder] = None

    def load_json_rules(self, json_path: str, world_cls: type) -> bool:
        """Load rules from JSON export for explain support."""
        try:
            self.json_builder = JSONWorldBuilder(json_path)
            self.json_builder.load()
            self.json_builder.build_context(world_cls)
            self.json_builder.resolve_rules()
            return True
        except Exception as e:
            logger.warning(f"Failed to load JSON rules: {e}")
            return False

    def explain_location(self, location: Location, state: CollectionState) -> list:
        """Explain a location's access rule."""
        # Priority 1: World's native explain support
        if hasattr(location.parent_region.world, 'explain_rule'):
            return location.parent_region.world.explain_rule(location, state)

        # Priority 2: Rule Builder native support
        if hasattr(location.access_rule, 'explain_json'):
            return location.access_rule.explain_json(state)

        # Priority 3: JSON-reconstructed rules
        if self.json_builder:
            rule = self.json_builder.get_rule_for_location(location.name)
            if rule:
                return rule.explain_json(state)

        # Fallback: No explain available
        return [{"text": "Rule explanation not available", "type": "info"}]
```

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

The exporter is being updated to automatically extract helper functions and their required data. The JSONWorldBuilder will integrate with this:

```python
class MinimalWorldContext:
    def load_helpers(self, helper_data: dict):
        """Load extracted helper functions from JSON."""
        for name, func_data in helper_data.items():
            # Reconstruct helper from serialized form
            self.helper_functions[name] = self._reconstruct_helper(func_data)
```

## Implementation Phases

### Phase 1: Core Infrastructure ✅ COMPLETE
- ~~Create `JSONWorldBuilder` class~~ → Orchestration layer NOT STARTED (but all dependencies ready)
- ~~Create `MinimalWorldContext` class~~ → NOT STARTED
- ✅ Add `ASTRule` class to rules.py (replaces proposed `UnknownRule`)
- ✅ Add schema version to exports (version 3)

### Phase 2: Rule Resolution ✅ COMPLETE
- ✅ AST format parser fully implemented (25+ rule types)
- ✅ AST explain module fully implemented (all rule types)
- ✅ `ASTRule` wrapping for unknown types
- ✅ Helper function parsing in AST format

### Phase 3: Tracker Integration ❌ NOT STARTED
- Add JSON loading to TrackerCore
- Implement explain fallback chain
- Add JSON path auto-discovery from template filename

### Phase 4: Helper Function Support 🔄 IN PROGRESS
- ✅ Helper extraction in exporter
- ✅ `HelperData` in `ExtractedData`
- Implement helper reconstruction in `MinimalWorldContext`
- Add helper dependency resolution

### Phase 5: Testing & Polish ❌ NOT STARTED
- Unit tests for JSONWorldBuilder
- Integration tests with real exports
- Performance optimization
- Caching for frequently accessed rules

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

## Next Steps

The following work items remain to complete this proposal:

### Priority 1: Orchestration Layer
1. Create `world_generator/json_world_builder.py` with `JSONWorldBuilder` class
2. Create `MinimalWorldContext` class for context-free rule resolution
3. Unit tests for the new classes

### Priority 2: Tracker Integration
1. Add `json_builder` attribute to `TrackerCore`
2. Implement `load_json_rules()` method
3. Add explain fallback chain in location explanation
4. Add JSON path auto-discovery from template filename

### Priority 3: Polish
1. Performance optimization with caching
2. Integration tests with real exports
3. Documentation updates

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

### Integration Targets (Not Yet Modified)
- `worlds/tracker/TrackerCore.py` - Tracker core (needs JSON loading)
- `worlds/tracker/TrackerClient.py` - Tracker explain command
- `frontend/modules/pathAnalyzer/pathAnalyzerLogic.js` - Frontend path analyzer
