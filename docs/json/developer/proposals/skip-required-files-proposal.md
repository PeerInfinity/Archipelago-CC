# Feature Proposal: ROM-less Generation Mode

## Summary

Add a `skip_required_files` option that allows generation to proceed even when game ROM files are missing. ROM-dependent output (patched ROMs) would be skipped, but all other generation artifacts (multidata, spoiler, slot data) would still be produced.

## Motivation

Currently, generating a multiworld requires having ROM files for every ROM-based game in the seed. This creates friction for several legitimate use cases:

### 1. Automated Testing & CI/CD

Running generation tests in CI pipelines is difficult because:
- ROMs cannot be committed to repositories (legal concerns)
- CI runners don't have access to user ROM collections
- Tests must either skip ROM-based games or mock file existence

### 2. Logic Development & Debugging

When developing or debugging game logic:
- Developers may not own every game's ROM
- Logic testing doesn't require actual ROM patching
- Faster iteration without ROM processing overhead

### 3. Tool Development

Building tools that analyze generation output:
- Rule exporters that convert logic to JSON
- Trackers that need location/item data
- Analytics tools that study distributions

### 4. WebHost Dry Runs

Validating YAML configurations before committing to full generation:
- Check for option conflicts
- Verify item/location counts
- Test custom item pools

## Proposed Solution

### New Setting

Add a setting to `GeneralOptions` in `settings.py`:

```python
class GeneralOptions(Group):
    # ... existing options ...

    class SkipRequiredFiles(Bool):
        """
        Allow generation to proceed when ROM files are missing.
        ROM output will be skipped, but multidata and spoilers are still generated.
        Useful for testing, CI/CD, and tool development.
        """

    skip_required_files: SkipRequiredFiles = SkipRequiredFiles(False)
```

### World API: Graceful ROM Handling

Worlds should check this setting in `stage_assert_generate` and `generate_output`:

```python
# In stage_assert_generate
@classmethod
def stage_assert_generate(cls, multiworld: MultiWorld):
    rom_file = get_base_rom_path()
    if not os.path.exists(rom_file):
        from settings import get_settings
        if get_settings().general_options.skip_required_files:
            logging.warning(f"{cls.game}: ROM not found, skipping ROM generation")
            return  # Allow generation to continue
        raise FileNotFoundError(rom_file)

# In generate_output
def generate_output(self, output_directory: str):
    rom_file = get_base_rom_path()
    if not os.path.exists(rom_file):
        from settings import get_settings
        if get_settings().general_options.skip_required_files:
            self._set_rom_placeholder()
            return  # Skip ROM patching
        raise FileNotFoundError(rom_file)

    # Normal ROM patching logic...
```

### Helper Mixin (Optional)

To reduce boilerplate, provide a mixin or helper:

```python
# In worlds/AutoWorld.py or a new utility module
def check_rom_available(rom_path: str, game_name: str) -> bool:
    """
    Check if ROM is available, respecting skip_required_files setting.

    Returns True if ROM exists or should be skipped.
    Raises FileNotFoundError if ROM missing and skip not enabled.
    """
    if os.path.exists(rom_path):
        return True

    from settings import get_settings
    if get_settings().general_options.skip_required_files:
        logging.getLogger(game_name).warning(
            f"ROM not found at {rom_path}, skipping ROM generation"
        )
        return False

    raise FileNotFoundError(rom_path)
```

Worlds would use it as:

```python
def generate_output(self, output_directory: str):
    if not check_rom_available(get_base_rom_path(), self.game):
        self._set_rom_placeholder()
        return

    # Normal ROM generation...
```

## Affected Worlds

ROM-based worlds that would benefit from this feature:

| World | ROM Check Location |
|-------|-------------------|
| A Link to the Past | `stage_assert_generate`, `generate_output` |
| Super Metroid | `stage_assert_generate`, `generate_output` |
| Donkey Kong Country 3 | `stage_assert_generate`, `generate_output` |
| Super Mario World | `stage_assert_generate`, `generate_output` |
| Yoshi's Island | `stage_assert_generate`, `generate_output` |
| The Legend of Zelda | `stage_assert_generate`, `generate_output` |
| Final Fantasy 1 | `stage_assert_generate` |
| Lufia II Ancient Cave | `stage_assert_generate`, `generate_output` |
| Mega Man Battle Network 3 | `stage_assert_generate`, `generate_output` |
| Secret of Evermore | `stage_assert_generate`, `generate_output` |
| Ocarina of Time | Uses custom logic |
| ... | (many others) |

## Implementation Strategy

### Phase 1: Core Infrastructure

1. Add `skip_required_files` setting to `GeneralOptions`
2. Add `check_rom_available()` helper function
3. Document the feature in world API docs

### Phase 2: Update Core Worlds

Update high-priority worlds maintained by the core team:
- A Link to the Past
- Super Metroid
- Ocarina of Time

### Phase 3: Community Updates

Provide guidance for community-maintained worlds to adopt the pattern. Changes are backward-compatible, so worlds can update independently.

## Behavior When Enabled

| Artifact | Behavior |
|----------|----------|
| Multidata | Generated normally |
| Spoiler log | Generated normally |
| Slot data | Generated normally |
| Patched ROMs | **Skipped** with warning |
| ROM connect names | Use placeholder |
| Final ZIP | Contains all non-ROM files |

### ROM Placeholder Handling

When ROM generation is skipped, worlds should:

1. Set a placeholder ROM name (for identification):
   ```python
   self.rom_name = b"GAME_ROM_NOT_GENERATED"
   ```

2. Signal completion to any waiting threads:
   ```python
   self.rom_name_available_event.set()
   ```

3. Skip `modify_multidata` ROM entries:
   ```python
   def modify_multidata(self, multidata):
       if self.rom_name == b"GAME_ROM_NOT_GENERATED":
           return  # Don't add connect_name for missing ROM
       # Normal logic...
   ```

## Command-Line Usage

```bash
# Enable via settings file (host.yaml)
general_options:
  skip_required_files: true

# Or via environment variable (useful for CI)
ARCHIPELAGO_SKIP_REQUIRED_FILES=1 python Generate.py --yaml my_game.yaml
```

## Use Case Examples

### CI/CD Pipeline

```yaml
# .github/workflows/test-generation.yml
- name: Test generation
  env:
    ARCHIPELAGO_SKIP_REQUIRED_FILES: "1"
  run: |
    python Generate.py --yaml tests/all_games.yaml
    # Verify multidata was created
    test -f output/AP_*.zip
```

### Logic Development

```python
# test_my_game_logic.py
def test_item_placement():
    # Enable skip mode for testing
    settings.general_options.skip_required_files = True

    # Generate without needing ROM
    multiworld = main(args)

    # Verify logic worked correctly
    assert_all_locations_reachable(multiworld)
```

### Tool Development

```python
# export_all_game_rules.py
"""Export logic rules for all games without needing ROMs."""
settings.general_options.skip_required_files = True

for game in get_all_games():
    multiworld = generate_test_world(game)
    rules = extract_rules(multiworld)
    save_json(f"rules/{game}.json", rules)
```

## Backward Compatibility

This feature is:
- **Opt-in**: Disabled by default
- **Additive**: No changes to existing behavior when disabled
- **Gradual**: Worlds can adopt the pattern independently

Worlds that don't implement the check will continue to fail if ROMs are missing, which is the current (expected) behavior.

## Security Considerations

- Setting is local only (in `host.yaml`)
- Cannot be set via YAML options (not a game option)
- WebHost should NOT enable this for production generations
- Only affects local generation

## Alternatives Considered

### 1. Mock ROM Files

Create empty/stub ROM files for testing.

**Problems:**
- Still requires per-game setup
- May cause unexpected behavior in ROM patching code
- Harder to maintain

### 2. Game-Specific Test Modes

Each game implements its own "test mode" flag.

**Problems:**
- Duplicates effort across 90+ games
- Inconsistent implementations
- No unified CI solution

### 3. Separate "Logic-Only" Generation

A completely separate code path for logic testing.

**Problems:**
- Massive code duplication
- Drift between test and production paths
- Much larger maintenance burden

## Testing

### Unit Tests

```python
def test_generation_without_rom():
    """Verify generation completes with skip_required_files."""
    settings.general_options.skip_required_files = True

    # Should not raise FileNotFoundError
    multiworld = main(test_args)

    # Verify core artifacts exist
    assert multiworld.spoiler is not None
    assert len(multiworld.itempool) > 0

def test_rom_placeholder():
    """Verify ROM placeholder is set correctly."""
    settings.general_options.skip_required_files = True
    world = generate_test_world("A Link to the Past")

    assert world.rom_name == b"ALTTP_ROM_NOT_GENERATED"
```

### Integration Tests

```python
def test_ci_generation_workflow():
    """Simulate CI environment without ROMs."""
    # Clear any ROM paths
    os.environ.pop("ALTTP_ROM", None)

    settings.general_options.skip_required_files = True

    # Generate all games
    for game in ["A Link to the Past", "Super Metroid", "Ocarina of Time"]:
        multiworld = generate_test_world(game)
        assert multiworld is not None
```

## Summary

The `skip_required_files` option provides a clean, unified solution for ROM-less generation. It benefits:

- **CI/CD pipelines** - Test generation without ROM distribution
- **Developers** - Faster iteration on logic changes
- **Tool builders** - Access generation data without ROM overhead
- **The ecosystem** - More robust testing infrastructure

The implementation is straightforward, backward-compatible, and can be adopted incrementally by world maintainers.
