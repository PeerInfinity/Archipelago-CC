# Upstream Proposal: ROM-less Generation via `skip_required_files`

## Summary

Add a `skip_required_files` setting to `GeneralOptions` and a `check_rom_available()` helper to `Utils` that together allow seed generation to proceed when ROM files are absent. ROM patching is skipped; all other artifacts (multidata, spoiler log, slot data) are produced normally. World maintainers can opt in by using the helper in their `stage_assert_generate` and `generate_output` methods.

This is a proposal for the upstream [Archipelago](https://github.com/ArchipelagoMW/Archipelago) repository. A working reference implementation exists in [this fork](https://github.com/PeerInfinity/Archipelago-CC).

---

## Motivation

Currently, generating a multiworld requires ROM files for every ROM-based game in the seed. This creates friction for several legitimate use cases:

### 1. Automated Testing & CI/CD

- ROMs cannot be committed to repositories (legal concerns)
- CI runners don't have access to user ROM collections
- Tests must either skip ROM-based games entirely or mock file existence

### 2. Logic Development & Debugging

- Developers may not own every game's ROM
- Logic testing doesn't require actual ROM patching
- Faster iteration when ROM processing is skipped

### 3. Third-Party Tool Development

- Trackers and analyzers that need location/item/logic data but not a playable ROM
- Tools that study item distributions across seeds
- Any tool that works with multidata but not with patched ROM files

### 4. WebHost Dry Runs

- Validate YAML configurations before committing to a full generation
- Check for option conflicts and verify item/location counts

---

## Proposed Changes

### 1. `skip_required_files` setting in `GeneralOptions` (`settings.py`)

```python
class GeneralOptions(Group):
    # ... existing options ...

    skip_required_files: bool = False
```

And a matching module-level global that is updated when settings load:

```python
# Module-level global (allows worlds to import it directly without get_settings())
skip_required_files = False

# In get_settings(), after loading:
global skip_required_files
skip_required_files = res.general_options.skip_required_files
```

The module-level global avoids repeated `get_settings()` calls and makes the import in world files simple and direct.

### 2. `check_rom_available()` helper in `Utils.py`

```python
def check_rom_available(rom_path: str, game_name: str) -> bool:
    """Check whether a required ROM file is available for generation.

    Returns True if the file exists at rom_path.  If the file is missing
    and skip_required_files is set in host.yaml, logs a warning and returns
    False so the caller can skip ROM-dependent steps.  If the file is
    missing and skip_required_files is not set, raises FileNotFoundError.

    Typical usage in stage_assert_generate::

        if not check_rom_available(get_base_rom_path(), cls.game):
            return  # ROM missing but skip_required_files is set; skip ROM checks

    Typical usage in generate_output::

        if not check_rom_available(get_base_rom_path(), self.game):
            self.rom_name = b"GAME_ROM_NOT_GENERATED"
            self.rom_name_available_event.set()
            return
    """
    if os.path.exists(rom_path):
        return True
    from settings import skip_required_files
    if skip_required_files:
        logging.getLogger(game_name).warning(
            "Required file not found at %s, skipping ROM generation as skip_required_files is set.", rom_path
        )
        return False
    raise FileNotFoundError(rom_path)
```

### 3. World adoption pattern

World maintainers update two methods in their `__init__.py`. The helper handles all three cases (ROM present, ROM missing with skip, ROM missing without skip), so each call site is one line:

**`stage_assert_generate`** — allow generation to proceed without the ROM:

```python
@classmethod
def stage_assert_generate(cls, multiworld: MultiWorld):
    if not check_rom_available(get_base_rom_path(), cls.game):
        return  # ROM missing, skip_required_files is set; skip ROM-dependent checks
    # ... rest of assert logic (enemizer checks, etc.) ...
```

**`generate_output`** — skip ROM patching and set a placeholder:

```python
def generate_output(self, output_directory: str):
    if not check_rom_available(get_base_rom_path(), self.game):
        self.rom_name = b"GAME_ROM_NOT_GENERATED"
        self.rom_name_available_event.set()
        return
    # ... normal ROM patching ...
```

**`modify_multidata`** — guard against the placeholder (only needed for worlds that override `modify_multidata` to add a `connect_name` entry):

```python
def modify_multidata(self, multidata: dict):
    self.rom_name_available_event.wait()
    if getattr(self, "rom_name", None) == b"GAME_ROM_NOT_GENERATED":
        return  # Don't add connect_name for a ROM that wasn't generated
    # ... normal connect_name logic ...
```

---

## Behavior When Enabled

| Artifact | Behavior |
|----------|----------|
| Multidata | Generated normally |
| Spoiler log | Generated normally |
| Slot data | Generated normally |
| Patched ROMs | **Skipped** with warning logged |
| ROM `connect_name` entries | Omitted (no placeholder in multidata) |
| Final ZIP | Contains all non-ROM files |

---

## Implementation Strategy

### Phase 1: Core Infrastructure (single PR)

1. Add `skip_required_files: bool = False` to `GeneralOptions` in `settings.py`
2. Add the module-level global and update it in `get_settings()`
3. Add `check_rom_available()` to `Utils.py`
4. Document the feature in the world API docs

This phase has no visible effect on any game — it is purely additive infrastructure.

### Phase 2: Update Core-Team Worlds

Apply the pattern to worlds maintained by the core team. Priority targets:

| World | Methods to update |
|-------|-------------------|
| A Link to the Past | `stage_assert_generate`, `generate_output`, `modify_multidata` |
| Super Metroid | `stage_assert_generate`, `generate_output` |
| Ocarina of Time | `stage_assert_generate`, `generate_output`, `modify_multidata` |
| Super Mario World | `stage_assert_generate`, `generate_output` |
| Donkey Kong Country 3 | `stage_assert_generate`, `generate_output` |
| Yoshi's Island | `stage_assert_generate`, `generate_output` |
| The Legend of Zelda | `stage_assert_generate`, `generate_output` |
| Lufia II Ancient Cave | `stage_assert_generate`, `generate_output` |
| Mega Man Battle Network 3 | `stage_assert_generate`, `generate_output` |
| Secret of Evermore | `stage_assert_generate`, `generate_output` |

Note: OOT uses a try/except pattern around `Rom()` rather than a direct `os.path.exists` check, so its update is slightly different from the others — it wraps the exception handler rather than using `check_rom_available` directly.

### Phase 3: Community Adoption

Announce the helper in release notes and world development docs. Because the feature is opt-in and purely additive, world maintainers can adopt it at their own pace. Worlds that don't implement the check continue to fail on missing ROMs — the current, expected behavior.

---

## Backward Compatibility

- **Opt-in**: Disabled by default (`false` in host.yaml)
- **Additive**: No change to behavior when disabled
- **Gradual**: Worlds can adopt the pattern independently; non-adopting worlds are unaffected

---

## Security Considerations

- The setting lives in `host.yaml` (local, user-controlled)
- It is not a game option and cannot be set by players in YAML configs
- WebHost deployments should not enable this for production generation

---

## Alternatives Considered

### Mock ROM Files

Create empty/stub ROM files for testing.

**Problems:** Still requires per-game setup. May cause unexpected behavior in ROM patching code. Hard to maintain across updates.

### Game-Specific Test Modes

Each game implements its own "test mode" flag.

**Problems:** Duplicates effort across 90+ games with inconsistent implementations. No unified solution for CI pipelines.

### Separate "Logic-Only" Generation Path

A completely separate code path for testing.

**Problems:** Massive code duplication. Drift between test and production paths. Much larger maintenance burden.

---

## Reference Implementation

This fork has a fully working implementation covering 9 ROM worlds. The changes to upstream files are:

- `settings.py`: ~10 lines (global + `GeneralOptions` field + `get_settings()` update)
- `Utils.py`: ~20 lines (`check_rom_available` function)
- Per world: ~10 lines replaced by 3–4 lines using the helper

See [core-files.diff](../diffs/core-files.diff) for the exact `settings.py` changes and [world-init-files.diff](../diffs/world-init-files.diff) for the world-level changes.
