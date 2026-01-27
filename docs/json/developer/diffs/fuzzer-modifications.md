# Fuzzer Modifications

This document describes the modifications made to the fuzzer compared to the original [Archipelago-fuzzer](https://github.com/Eijebong/Archipelago-fuzzer) by Eijebong.

- **Original version:** 0.4.2
- **Location in this repository:** `fuzz.py`
- **Last compared:** 2026-01-14

## Summary of Changes

The modifications add two main features:
1. **Reproducible fuzzing** via a `--seed` argument
2. **Default options exclusion** via a `--default-options` argument

Additionally, there are bug fixes for specific edge cases encountered during testing.

---

## New Command-Line Arguments

### `--seed`

```bash
python fuzz.py -g alttp -r 100 --seed 12345
```

Allows reproducible fuzzing runs by seeding the random number generator. When provided:
- The main process seeds `random` before each iteration using `seed + iteration`
- Worker processes also seed `random` using the same formula
- This ensures YAML generation and randomization are deterministic across runs

### `--default-options`

```bash
python fuzz.py -g alttp -r 100 --default-options mode,entrance_shuffle,glitches_required
```

Comma-separated list of option names to leave at their default values instead of randomizing. Useful for:
- Testing specific option combinations while randomizing others
- Excluding problematic options that cause known issues
- Focusing fuzzing on particular aspects of a world

---

## Code Modifications

### 1. `generate_random_yaml()` Function

**Change:** Added `default_options` parameter and docstring.

```python
# Original
def generate_random_yaml(world_name, meta):

# Modified
def generate_random_yaml(world_name, meta, default_options=None):
    """Generate a random YAML for the given world.

    Args:
        world_name: The apworld name to generate for
        meta: Dictionary of option overrides
        default_options: Set of option names to leave at their defaults instead of randomizing
    """
```

The function now checks if an option is in `default_options` before randomizing:

```python
for option_name, option_value in options.items():
    # Check if this option should be left at default
    if option_name in default_options:
        game_options[option_name] = sanitize(option_value.default)
        continue
```

### 2. `get_random_value()` Function

**Change:** Added handling for `TextChoice` and other `Choice` subclasses with no predefined options.

```python
# Added after getting valid_choices
if not valid_choices:
    return option.default
```

This prevents crashes when a Choice subclass has no valid options to choose from.

### 3. `call_generate()` Function

**Change:** Added Landstalker cache clearing to prevent stale player ID issues.

```python
# Clear any cached state from previous generations
# Some worlds (like Landstalker) use class-level caches that persist
# across generations and can cause issues with stale player IDs
try:
    from worlds.landstalker import LandstalkerWorld
    LandstalkerWorld.cached_spheres = []
except ImportError:
    pass
```

This fixes an issue where Landstalker's class-level cache would retain data from previous generations, causing errors in subsequent runs.

### 4. `gen_wrapper()` Function

**Change:** Added random seeding for worker process reproducibility.

```python
# Seed random for reproducibility if seed is provided
# Use seed + iteration to ensure each worker gets a unique but deterministic seed
if args.seed is not None:
    random.seed(args.seed + i)
```

### 5. Main Loop

**Change:** Added random seeding before YAML generation.

```python
while i < args.runs:
    # Seed random for this iteration if seed is provided
    # This ensures YAML generation in main process is deterministic
    if args.seed is not None:
        random.seed(args.seed + i)
```

### 6. Argument Parser

**Change:** Added new arguments.

```python
parser.add_argument("--seed", default=None, type=int,
                    help="Random seed for reproducible fuzzing")
parser.add_argument("--default-options", default=None, type=str,
                    help="Comma-separated list of option names to leave at their defaults "
                         "instead of randomizing. "
                         "Example: --default-options mode,entrance_shuffle,glitches_required")
```

---

## Diff Statistics

- **Lines added:** ~49
- **Lines removed:** 2
- **Total diff size:** ~70 lines

---

## Usage Examples

### Basic reproducible fuzzing
```bash
python fuzz.py -g tunic -r 100 --seed 42
```

### Exclude specific options from randomization
```bash
python fuzz.py -g alttp -r 50 --default-options glitches_required,entrance_shuffle
```

### Combined usage
```bash
python fuzz.py -g alttp -r 200 --seed 12345 --default-options shuffle_doors,shuffle_symbols
```

---

## Related Files

- **Original repository:** https://github.com/Eijebong/Archipelago-fuzzer
- **This project's fuzzer:** `fuzz.py`
- **Fuzzer testing documentation:** `CC/docs/fuzzer-testing.md`
