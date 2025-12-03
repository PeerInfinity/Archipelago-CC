# Feature Proposal: Generation Pipeline Hooks

## Summary

Add a hook/event system to the generation pipeline in `Main.py` that allows APWorlds to register callbacks for key generation events. This enables APWorld-based utilities to integrate with the generation process without modifying core Archipelago files.

## Motivation

Currently, utilities that need to operate on the full `MultiWorld` during generation must modify `Main.py` directly. Examples include:

- **Rule exporters** - Convert game logic to JSON for external tools/trackers
- **Analytics tools** - Generate statistics about item/location distribution
- **Debug utilities** - Dump generation state for troubleshooting
- **Alternative output formats** - Generate data for custom clients

This makes maintenance difficult and prevents distributing such utilities as APWorlds. A hook system would:

1. **Enable APWorld-based tools** - Utilities can be packaged and distributed like games
2. **Reduce fork divergence** - Custom functionality doesn't require core modifications
3. **Improve modularity** - Clean separation between core generation and extensions
4. **Benefit the ecosystem** - Third-party tools can integrate officially

## Proposed API

### Option A: Simple Hook Registry (Recommended)

Minimal implementation with a registry pattern:

```python
# New file: worlds/Hooks.py
from typing import Callable, List
from BaseClasses import MultiWorld

GenerationHook = Callable[[MultiWorld, str, str], None]

_before_archive_hooks: List[GenerationHook] = []

def register_before_archive_hook(hook: GenerationHook) -> None:
    """
    Register a hook called after output generation, before archive creation.

    Args:
        hook: Callable receiving (multiworld, output_dir, filename_base)
    """
    _before_archive_hooks.append(hook)

def call_before_archive_hooks(multiworld: MultiWorld, output_dir: str, filename_base: str) -> None:
    """Called by Main.py at the appropriate point."""
    for hook in _before_archive_hooks:
        try:
            hook(multiworld, output_dir, filename_base)
        except Exception as e:
            import logging
            logging.getLogger("Hooks").exception(f"Error in generation hook: {e}")
```

### Changes to Main.py

Add a single line after output generation completes:

```python
# After line ~391 (after output futures complete, before spoiler)
from worlds.Hooks import call_before_archive_hooks
call_before_archive_hooks(multiworld, temp_dir, outfilebase)
```

### Usage in APWorlds

APWorlds register hooks at module load time:

```python
# In an APWorld's __init__.py
from worlds.Hooks import register_before_archive_hook

def my_export_hook(multiworld, output_dir, filename_base):
    """Export game rules to JSON."""
    from .exporter import export_rules
    export_rules(multiworld, output_dir, filename_base)

register_before_archive_hook(my_export_hook)
```

## Hook Locations

The most useful hook point is after output generation, before archive creation:

| Location in Main.py | After Line | Context |
|---------------------|------------|---------|
| After `generate_output` futures complete | ~391 | All worlds have generated their output files |
| Before spoiler generation | ~397 | Item placement is finalized |
| Before zip archive creation | ~409 | Last chance to add files to output |

**Recommended:** A single `BEFORE_ARCHIVE` hook after line 391 covers most use cases.

### Optional: Additional Hook Points

If the community finds value, additional hooks could be added later:

```python
# Possible future hooks (not part of initial proposal)
register_after_fill_hook(hook)        # After item placement
register_after_spoiler_hook(hook)     # After spoiler generation
register_before_output_hook(hook)     # Before generate_output calls
```

## Implementation Details

### Error Handling

Hooks should not crash generation. Wrap calls in try/except and log errors:

```python
def call_before_archive_hooks(multiworld, output_dir, filename_base):
    for hook in _before_archive_hooks:
        try:
            hook(multiworld, output_dir, filename_base)
        except Exception as e:
            logging.getLogger("Hooks").exception(
                f"Error in generation hook {hook.__module__}.{hook.__name__}: {e}"
            )
```

### Thread Safety

Hooks are called from the main thread after the ThreadPoolExecutor completes, so no special thread safety is needed.

### Hook Ordering

Hooks are called in registration order. If ordering becomes important, a priority system could be added later:

```python
register_before_archive_hook(hook, priority=100)  # Future enhancement
```

## Alternatives Considered

### 1. Stage Methods (Existing Pattern)

The existing `stage_` method pattern only calls methods on world types that have active players. A utility world with no players wouldn't be called.

**Limitation:** Requires a player to select the utility "game" for it to activate.

### 2. World.generate_output Override

Each world could implement export logic in `generate_output`.

**Limitations:**
- Requires modifying every world
- Can't produce combined output for all players
- Defeats purpose of centralized utilities

### 3. Post-Processing Scripts

Run separate scripts after generation.

**Limitations:**
- No access to in-memory MultiWorld state
- Requires parsing output files
- Poor user experience

## Backward Compatibility

This proposal is purely additive:
- No existing behavior changes
- No breaking changes to World API
- Optional feature that worlds can ignore

## Use Cases

### 1. JSON Rule Exporter

Export game logic to JSON for web-based trackers:

```python
@register_before_archive_hook
def export_rules(multiworld, output_dir, filename_base):
    from .exporter import export_game_rules
    export_game_rules(multiworld, output_dir, filename_base)
```

### 2. Generation Analytics

Collect statistics about item distribution:

```python
@register_before_archive_hook
def collect_analytics(multiworld, output_dir, filename_base):
    stats = analyze_distribution(multiworld)
    write_json(f"{output_dir}/{filename_base}_analytics.json", stats)
```

### 3. Custom Spoiler Formats

Generate alternative spoiler formats:

```python
@register_before_archive_hook
def generate_html_spoiler(multiworld, output_dir, filename_base):
    html = render_spoiler_html(multiworld)
    write_file(f"{output_dir}/{filename_base}_Spoiler.html", html)
```

## Scope

**In scope:**
- Single `BEFORE_ARCHIVE` hook point
- Simple registration API
- Error handling/logging

**Out of scope (future enhancements):**
- Multiple hook points
- Hook priorities
- Async hooks
- Settings extension system (separate proposal)

## References

- Universal Tracker uses a similar "hidden world" pattern for utility functionality
- The existing `stage_` method pattern provides precedent for cross-player operations
- Many game modding communities use hook/event systems for extensibility

## Summary

A minimal hook system (< 30 lines of code) would enable APWorld-based utilities while maintaining Archipelago's clean architecture. The recommended approach is a single `BEFORE_ARCHIVE` hook that covers the primary use case of post-generation processing.
