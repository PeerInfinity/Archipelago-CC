# Feature Proposal: APWorld Settings Extension

## Summary

Allow APWorlds to register additional settings in `GeneralOptions` without modifying `settings.py`. This enables utility APWorlds to have configurable behavior that persists in the user's `host.yaml`.

## Motivation

Currently, adding settings to `GeneralOptions` requires modifying the core `settings.py` file. This is problematic for:

1. **Utility APWorlds** - Tools like rule exporters need settings (e.g., `save_rules_json`) but can't add them without forking
2. **Optional Features** - Features that not all users need shouldn't bloat the core settings
3. **Third-Party Tools** - External developers can't add persistent configuration

## Proposed Solution

### Option A: Settings Registration API

Allow APWorlds to register additional settings at load time:

```python
# In settings.py - add registration mechanism
_extended_general_settings: Dict[str, Any] = {}

def register_general_setting(name: str, setting_type: type, default: Any, doc: str = "") -> None:
    """
    Register an additional setting for GeneralOptions.
    Called by APWorlds at module load time.
    """
    _extended_general_settings[name] = {
        "type": setting_type,
        "default": default,
        "doc": doc
    }

class GeneralOptions(Group):
    # ... existing settings ...

    def __getattr__(self, name: str) -> Any:
        if name in _extended_general_settings:
            # Return from host.yaml or default
            return self._get_extended_setting(name)
        raise AttributeError(name)
```

### Usage in APWorlds

```python
# In rulesexporter/__init__.py
from settings import register_general_setting, Bool

# Register settings at module load
register_general_setting(
    "save_rules_json",
    Bool,
    default=False,
    doc="Export game rules to JSON format for external tools"
)

register_general_setting(
    "update_frontend_presets",
    Bool,
    default=False,
    doc="Copy rule exports to frontend/presets directory"
)
```

### Accessing Settings

```python
from settings import get_settings

settings = get_settings()
if settings.general_options.save_rules_json:  # Works for extended settings
    export_rules(...)
```

### Option B: Namespace-Based Settings

Each APWorld gets its own settings namespace:

```python
# In host.yaml
general_options:
  output_path: output

rules_exporter:  # APWorld-specific namespace
  save_rules_json: true
  update_frontend_presets: false
```

APWorlds define their settings:

```python
# In rulesexporter/__init__.py
from settings import Group, Bool

class RulesExporterSettings(Group):
    """Settings for the Rules Exporter utility."""

    class SaveRulesJson(Bool):
        """Export game rules to JSON format."""

    class UpdateFrontendPresets(Bool):
        """Copy exports to frontend directory."""

    save_rules_json: SaveRulesJson = SaveRulesJson(False)
    update_frontend_presets: UpdateFrontendPresets = UpdateFrontendPresets(False)

class RulesExporterWorld(World):
    settings: ClassVar[RulesExporterSettings]
    settings_key = "rules_exporter"
```

Accessing:

```python
from settings import get_settings

settings = get_settings()
if settings.rules_exporter.save_rules_json:
    export_rules(...)
```

## Comparison

| Aspect | Option A (Registration) | Option B (Namespace) |
|--------|------------------------|---------------------|
| Existing pattern | New | Matches world settings |
| Settings location | `general_options.*` | `<apworld>.*` |
| Discoverability | Mixed with core | Clearly separated |
| Implementation | More complex | Uses existing code |
| User experience | Familiar location | New sections in yaml |

**Recommendation:** Option B (Namespace) is simpler and follows existing patterns.

## Implementation for Option B

The infrastructure already exists! Worlds can define settings via `settings_key`:

```python
class MyWorld(World):
    settings: ClassVar[MySettings]
    settings_key = "my_world"  # Creates section in host.yaml
```

The only missing piece is that `settings_key` lookup happens through the World metaclass, which requires a World class. For utility APWorlds, this works:

```python
class RulesExporterWorld(World):
    game = "Rules Exporter"
    hidden = True
    item_name_to_id = {}
    location_name_to_id = {}

    settings: ClassVar[RulesExporterSettings]
    settings_key = "rules_exporter"
```

**No core changes needed!** The existing system supports this.

## What IS Needed

For Option A (extending `GeneralOptions`), core changes would be:

1. Registration function in `settings.py`
2. Dynamic attribute lookup in `GeneralOptions`
3. YAML serialization support for extended settings

For Option B (namespaced settings), **no core changes needed** - just documentation.

## Documentation Update

Add to world API documentation:

```markdown
## Utility World Settings

Utility APWorlds (hidden worlds that provide tools rather than games) can
define their own settings section in `host.yaml`:

class MyToolSettings(Group):
    """Settings for My Tool."""
    my_option: Bool = Bool(False)

class MyToolWorld(World):
    game = "My Tool"
    hidden = True
    item_name_to_id = {}
    location_name_to_id = {}

    settings: ClassVar[MyToolSettings]
    settings_key = "my_tool"

Users configure in host.yaml:

my_tool:
  my_option: true
```

## Conclusion

**Option B requires no code changes** - just documentation clarifying that hidden utility worlds can use the existing settings system.

**Option A would be needed** only if settings must appear under `general_options` for user familiarity. This is a UX preference rather than a technical requirement.

## Recommendation

1. **Immediate:** Use Option B (namespace) - no upstream changes needed
2. **Future:** Consider Option A if user feedback indicates confusion about settings location

For the JSON exporter APWorld, using `settings_key = "rules_exporter"` and documenting the `host.yaml` configuration is sufficient.

## References

- See [core-files.diff](../diffs/core-files.diff) for current modifications to `settings.py`
- See [repository-changes.md](../diffs/repository-changes.md) for a complete overview of all fork modifications
