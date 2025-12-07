# In-Memory World Builder for Rule Explain Support

## Overview

This proposal describes a system to enable the Rule Builder's "explain" feature for worlds that don't natively support Rule Builder, by reconstructing rule objects from JSON export data at runtime.

## Problem Statement

The Rule Builder's explain feature provides detailed rule explanations via `explain_json()` and `explain_str()` methods on Rule objects. However, this only works for worlds that use Rule Builder natively. For other worlds:

1. The JSON exporter captures rules as CC format JSON from Python lambda functions
2. This JSON accurately represents rules at the specific moment of export
3. The Universal Tracker cannot explain these rules because they're plain lambda functions

## Proposed Solution

Create a `JSONWorldBuilder` class that can reconstruct Rule Builder objects from JSON exports, enabling explain functionality for any exported world.

### Architecture

```
JSON Export
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    JSONWorldBuilder                          │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ JSON Loader │ -> │ Extractor   │ -> │ Rule Parser     │  │
│  │             │    │ (existing)  │    │ (cc_format.py)  │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                ↓             │
│                                    ┌─────────────────────┐  │
│                                    │ MinimalWorldContext │  │
│                                    │   - item lookups    │  │
│                                    │   - region data     │  │
│                                    │   - helper funcs    │  │
│                                    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Rule.Resolved objects
                    with explain support
```

### Key Components

#### 1. JSONWorldBuilder Class

New class in `world_generator/json_world_builder.py`:

```python
class JSONWorldBuilder:
    """Builds in-memory rule structures from JSON export data."""

    def __init__(self, json_path: str):
        self.json_path = Path(json_path)
        self.data: Optional[ExtractedData] = None
        self.context: Optional[MinimalWorldContext] = None
        self.resolved_rules: Dict[str, Rule.Resolved] = {}
        self.schema_version: Optional[str] = None

    def load(self) -> ExtractedData:
        """Load and parse JSON export."""
        # Reuse existing extraction logic
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
                rule = parse_cc_rule(loc_data.rule, self.context)
                self.resolved_rules[loc_name] = rule.resolve(self.context)
        return self.resolved_rules

    def get_rule_for_location(self, location_name: str) -> Optional[Rule.Resolved]:
        """Get resolved rule for a specific location."""
        return self.resolved_rules.get(location_name)

    def supports_explain(self) -> bool:
        """Check if this export supports explain functionality."""
        if self.schema_version is None:
            return False
        # Version compatibility check
        return self._check_version_compatibility(self.schema_version)
```

#### 2. MinimalWorldContext Class

Provides rule resolution context without requiring a full World instance:

```python
class MinimalWorldContext:
    """Minimal context for rule resolution from JSON data."""

    def __init__(self, data: ExtractedData, world_cls: type):
        self.data = data
        self.world_cls = world_cls
        self.item_name_groups = data.item_name_groups
        self.location_name_groups = data.location_name_groups
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
        # Track as unknown for later reporting
        self._unknown_rules.add(f"helper:{helper_name}")
        return None

    def has_unknown_rules(self) -> bool:
        """Check if any rules couldn't be fully resolved."""
        return len(self._unknown_rules) > 0

    def get_unknown_rules(self) -> Set[str]:
        """Get list of rules that couldn't be resolved."""
        return self._unknown_rules.copy()
```

#### 3. Enhanced cc_format Parser

Update `rule_builder/cc_format.py` to support unknown/partial resolution:

```python
class UnknownRule(Rule):
    """Placeholder for rules that cannot be fully parsed."""

    def __init__(self, original_data: dict, reason: str):
        self.original_data = original_data
        self.reason = reason

    def __call__(self, state) -> bool:
        # Cannot evaluate - return unknown indicator
        return None  # or raise UnknownRuleError

    def explain_json(self, state) -> list[JSONMessagePart]:
        return [{"text": f"Unknown rule: {self.reason}", "type": "warning"}]

    def explain_str(self, state) -> str:
        return f"[Unknown: {self.reason}]"

def parse_cc_rule(data: dict, context: MinimalWorldContext) -> Rule:
    """Parse CC format JSON to Rule object.

    Returns UnknownRule for unsupported rule types instead of
    defaulting to True.
    """
    rule_type = data.get('type')

    if rule_type == 'helper_call':
        helper = context.resolve_helper(data['name'])
        if helper is None:
            return UnknownRule(data, f"Helper '{data['name']}' not available")
        # ... normal helper call parsing

    # ... existing parsing logic with UnknownRule fallbacks
```

### Integration Points

#### Universal Tracker Integration

Modify `worlds/tracker/TrackerCore.py` to use JSONWorldBuilder:

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
                if isinstance(rule, UnknownRule):
                    return rule.explain_json(state)
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

### Version Compatibility

Add a `schema_version` field to JSON exports for forward/backward compatibility:

```json
{
  "schema_version": "1.0.0",
  "game": "My Game",
  "regions": [...],
  "locations": [...],
  ...
}
```

**Compatibility strategy:**
- Check schema version on load
- Graceful degradation for older versions (reduced functionality)
- Clear error messages for incompatible versions
- Version-specific parsing paths where needed

### Handling Unknown Rules

When rules cannot be fully resolved (missing helpers, unsupported rule types), the system will track an "unknown" state rather than defaulting to True. This matches the frontend's behavior.

**Unknown rule handling:**
- `UnknownRule` class represents unresolved rules
- `explain_json()` returns a warning message explaining what's unknown
- `has_unknown_rules()` method on context for checking completeness
- UI can indicate partial explain support

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

### Phase 1: Core Infrastructure
- Create `JSONWorldBuilder` class
- Create `MinimalWorldContext` class
- Add `UnknownRule` class to cc_format.py
- Add schema version to exports

### Phase 2: Rule Resolution
- Update cc_format parser to use MinimalWorldContext
- Implement unknown rule tracking
- Add helper function resolution stubs

### Phase 3: Tracker Integration
- Add JSON loading to TrackerCore
- Implement explain fallback chain
- Add JSON path auto-discovery from template filename

### Phase 4: Helper Function Support
- Integrate with exporter's helper extraction
- Implement helper reconstruction
- Add helper dependency resolution

### Phase 5: Testing & Polish
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
2. **Option-dependent rules**: How to handle rules that vary based on player options?
3. **Dynamic rules**: How to handle rules that change during gameplay (e.g., boss shuffle)?

## Related Work

- [Path Analyzer Module](../guides/module-system.md) - Frontend path analysis using similar JSON data
- [World Generator Guide](../guides/world-generator.md) - Existing JSON to Python conversion
- [Rule Exporter Comparison](../comparison/rule-exporter-comparison.md) - Analysis of rule export formats

## References

- `rule_builder/rules.py` - Rule Builder implementation
- `rule_builder/cc_format.py` - CC format JSON parser
- `world_generator/extractors.py` - JSON extraction logic
- `worlds/tracker/TrackerClient.py` - Tracker explain command
- `frontend/modules/pathAnalyzer/pathAnalyzerLogic.js` - Frontend path analyzer
