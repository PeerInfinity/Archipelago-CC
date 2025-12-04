# Feature Proposal: Global Generation Hooks

## Summary

Add a global hook registry that complements PR #5700's stage methods (`finalize_multiworld`, `pre_output`). This enables utilities that need to run across all worlds without requiring a player slot.

## Relationship to PR #5700

[PR #5700](https://github.com/ArchipelagoMW/Archipelago/pull/5700) introduces two new stage methods:

- `finalize_multiworld` - Final logical adjustments after fill/balancing
- `pre_output` - Preparation before output generation

These follow the existing `AutoWorld.call_all()` pattern, which calls methods on each world instance that has an active player. This is ideal for per-world operations.

**This proposal addresses a gap**: utilities that need to run regardless of player selection.

## The Player Slot Problem

The `call_all()` pattern only invokes methods on worlds with active players:

```python
# From AutoWorld.py
def call_all(world: "MultiWorld", method_name: str, *args: Any) -> None:
    for player in world.player_ids:
        call_single(world, method_name, player, *args)
```

This means:
- A utility APWorld with no players won't have its methods called
- Cross-world tools (exporters, analytics) can't hook into generation
- Users would need to "play" a utility world to activate it

## Proposed Solution

Add a parallel hook registry for global callbacks that run independently of player selection.

### API

```python
# New file: worlds/Hooks.py
from typing import Callable, List
from BaseClasses import MultiWorld

GenerationHook = Callable[[MultiWorld, str, str], None]

_post_output_hooks: List[GenerationHook] = []

def register_post_output_hook(hook: GenerationHook) -> None:
    """
    Register a hook called after all generate_output calls complete,
    before archive creation.

    Args:
        hook: Callable receiving (multiworld, output_dir, filename_base)
    """
    _post_output_hooks.append(hook)

def call_post_output_hooks(multiworld: MultiWorld, output_dir: str, filename_base: str) -> None:
    """Called by Main.py after output generation."""
    for hook in _post_output_hooks:
        try:
            hook(multiworld, output_dir, filename_base)
        except Exception as e:
            import logging
            logging.getLogger("Hooks").exception(
                f"Error in generation hook {hook.__module__}.{hook.__name__}: {e}"
            )
```

### Integration with Main.py

A single call after output futures complete:

```python
# After generate_output futures complete, before spoiler/archive
from worlds.Hooks import call_post_output_hooks
call_post_output_hooks(multiworld, temp_dir, outfilebase)
```

## Comparison with PR #5700

| Aspect | PR #5700 Stages | This Proposal |
|--------|-----------------|---------------|
| Pattern | Instance methods via `call_all()` | Global registry callbacks |
| Requires player | Yes | No |
| Context | Per-world `self` | Full `MultiWorld` |
| Timing | Before output | After output |
| Use case | World-specific logic | Cross-world utilities |

### Timing in Generation Pipeline

```
fill_multiworld()
    ↓
progression_balancing()
    ↓
finalize_multiworld()     ← PR #5700 (per-world)
    ↓
pre_output()              ← PR #5700 (per-world)
    ↓
generate_output()         ← existing (per-world, threaded)
    ↓
post_output hooks         ← THIS PROPOSAL (global)
    ↓
spoiler generation
    ↓
archive creation
```

## Why Both Are Needed

**PR #5700 is ideal for:**
- World-specific final adjustments (`finalize_multiworld`)
- Per-world preparation before output (`pre_output`)
- Operations that need `self` context

**Global hooks are ideal for:**
- Utility APWorlds that don't need a player slot
- Cross-world exporters (JSON rules, analytics)
- Adding files to the output archive
- Operations that need access to generated output files

## Use Cases

### JSON Rule Exporter

Export game logic for all worlds to JSON:

```python
from worlds.Hooks import register_post_output_hook

def export_all_rules(multiworld, output_dir, filename_base):
    from .exporter import export_game_rules
    for world in multiworld.worlds.values():
        export_game_rules(world, output_dir, filename_base)

register_post_output_hook(export_all_rules)
```

### Generation Analytics

Collect cross-world statistics:

```python
from worlds.Hooks import register_post_output_hook

def collect_analytics(multiworld, output_dir, filename_base):
    stats = {
        "total_locations": len(multiworld.get_locations()),
        "total_items": len(multiworld.itempool),
        "worlds": [w.game for w in multiworld.worlds.values()]
    }
    write_json(f"{output_dir}/{filename_base}_analytics.json", stats)

register_post_output_hook(collect_analytics)
```

### Custom Output Formats

Generate alternative formats alongside standard output:

```python
from worlds.Hooks import register_post_output_hook

def generate_html_spoiler(multiworld, output_dir, filename_base):
    html = render_spoiler_html(multiworld)
    with open(f"{output_dir}/{filename_base}_Spoiler.html", "w") as f:
        f.write(html)

register_post_output_hook(generate_html_spoiler)
```

## Implementation Details

### Error Handling

Hooks are wrapped in try/except to prevent crashing generation. Errors are logged but don't halt the process.

### Thread Safety

Hooks run from the main thread after the ThreadPoolExecutor completes `generate_output` calls, so no special synchronization is needed.

### Registration Timing

Hooks are registered at module load time (in APWorld `__init__.py`), before generation begins.

## Backward Compatibility

This proposal is purely additive:
- No changes to existing stage methods
- No breaking changes to World API
- Complements rather than replaces PR #5700

## Scope

**In scope:**
- Single `post_output` hook point (after output, before archive)
- Simple registration API
- Error handling/logging

**Out of scope (future enhancements):**
- Additional hook points (`post_fill`, `post_spoiler`)
- Hook priorities
- Async hooks

## Summary

PR #5700 enhances the per-world stage system. This proposal adds a complementary global hook system for utilities that need to operate across all worlds without requiring a player slot. Together, they cover both per-world and cross-world use cases.
