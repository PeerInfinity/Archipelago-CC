# UT Fuzzer Testing

The UT (Universal Tracker) fuzzer tests whether the worldgen-based tracking produces the same results as the original Archipelago generation. It generates random seeds and compares what locations are accessible.

## Prerequisites

```bash
source .venv/bin/activate
```

## Basic Usage

Run the fuzzer with a specific game:

```bash
python fuzz.py -r <runs> -j <jobs> -g <game> -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

**Important:** On Linux, use `exec` to avoid module caching issues (see [Troubleshooting](#module-caching-with-code-changes)):

```bash
exec python fuzz.py -r <runs> -j <jobs> -g <game> -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `-r <runs>` | Number of test runs |
| `-j <jobs>` | Number of parallel jobs.  Set this to 4. |
| `-g <game>` | Game name (e.g., `adventure`, `alttp`) |
| `-n <yamls>` | Number of YAML configs per run (use `1` for single-game tests) |
| `--hook` | Hook module for UT validation (always use `worlds.tracker.fuzzer_hook:Hook`) |

## Examples

### Single Test Run

```bash
python fuzz.py -r 1 -j 1 -g adventure -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

### Parallel Testing (Recommended)

```bash
python fuzz.py -r 50 -j 8 -g adventure -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

### ALttP Testing

```bash
# Use exec to ensure fresh module imports (avoids caching issues)
exec python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```

### Testing with Specific Options

Use `--default-options` to keep options at default, and `--disallow-options` to exclude specific values:

```bash
# Test with entrance_shuffle at default (test glitches only)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options entrance_shuffle

# Test with glitches_required at default (test entrance shuffle only)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options glitches_required

# Test only minor_glitches (exclude other glitch values)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options entrance_shuffle \
    --disallow-options "glitches_required=no_glitches,overworld_glitches,hybrid_major_glitches,no_logic"

# Test only supported entrance_shuffle values (exclude problematic ones)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --default-options glitches_required \
    --disallow-options "entrance_shuffle=crossed,dungeons_crossed,insanity"

# Maximum compatibility mode (avoid all known problematic options)
python fuzz.py -r 10 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook \
    --disallow-options "entrance_shuffle=crossed,dungeons_crossed,insanity;glitches_required=hybrid_major_glitches"
```

## Output

Results are written to `fuzz_output/`:

- `report.json` - Summary of test results
- `error/<game>/<run>/` - Details for failed runs
  - `<run>.log` - Full log output
  - `<run>.yaml` - YAML configuration that caused the failure

### Report Format

```json
{
  "stats": {
    "total": 10,
    "success": 8,
    "failure": 2,
    "timeout": 0,
    "ignored": 0
  },
  "errors": {
    "adventure": {
      "None": [1, 4]
    }
  }
}
```

Error types:
- `None` - Logic mismatch (no Python error, but UT and server disagree on accessible locations)
- Other - Python exception type

## Interpreting Results

### Success
The worldgen-based UT tracking matches the original Archipelago generation.

### Failure (None type)
Logic mismatch - locations accessible in one but not the other. Check the log file for details:
- "Locations X were in server logic but not expected in UT"
- "UT logic sphere" shows what UT found accessible

### Failure (Exception type)
Python error during generation or tracking. Check the log file for the traceback.

## Cleanup

The fuzzer creates temporary files that should be cleaned up:

```bash
# Remove fuzzer output
rm -rf fuzz_output

# Remove generated worldgen worlds (created per-seed for parallel safety)
rm -rf worlds/*_worldgen_*

# Remove generated preset files
rm -rf frontend/presets/*/AP_*
```

## How It Works

1. **Generation**: Creates a random Archipelago seed for the specified game
2. **Export**: Exports the seed's rules to JSON format
3. **Worldgen**: Generates a new world package from the JSON rules
4. **Tracking**: Initializes UT with the worldgen world
5. **Comparison**: Compares what locations UT considers accessible vs what the server considers accessible
6. **Validation**: Reports any mismatches

## Analyzing Failures with the Exporter Test Suite

The `tests/exporter/` directory contains a comprehensive test suite for debugging fuzzer failures. When the fuzzer reports a logic mismatch, these tests help isolate whether the issue is in rule analysis, conversion, or game-specific handling.

### Test Suite Structure

```
tests/exporter/
├── analyzer/               # Rule analysis tests
│   ├── test_analysis.py           # Main analyze_rule() entry point
│   ├── test_alttp_bunny_rules.py  # ALttP bunny rule patterns
│   ├── test_secret_passage.py     # Inverted mode rule patterns
│   ├── test_source_extraction.py  # Lambda source code extraction
│   ├── test_binary_ops.py         # Boolean operations (AND/OR/NOT)
│   ├── test_expression_resolver.py # Closure variable resolution
│   └── visitors/                   # AST visitor tests
├── converter/              # JSON <-> Python conversion tests
│   ├── test_json_to_python.py
│   ├── test_python_to_json.py
│   └── test_round_trip.py
└── games/                  # Game-specific handler tests
    ├── test_base_handler.py
    └── test_handler_discovery.py
```

### Running the Tests

```bash
# Run all exporter tests
pytest tests/exporter/ -v

# Run specific test file with output
pytest tests/exporter/analyzer/test_alttp_bunny_rules.py -v -s

# Run a specific test class
pytest tests/exporter/analyzer/test_alttp_bunny_rules.py::TestNestedCallPattern -v -s

# Run a specific test method
pytest tests/exporter/analyzer/test_alttp_bunny_rules.py::TestNestedCallPattern::test_nested_call_in_options -v -s
```

### Debugging a Fuzzer Failure

When the fuzzer reports a logic mismatch, follow these steps:

**1. Identify the problematic location and rule**

Check the fuzzer log in `fuzz_output/error/<game>/<run>/<run>.log` for lines like:
```
Locations ['Secret Passage'] were in server logic but not expected in UT
```

**2. Find the rule in the exported JSON**

Look at the `_rules.json` file in the generated preset directory to see what rule was exported for that location.

**3. Recreate the pattern in a test**

Use `test_alttp_bunny_rules.py` or `test_secret_passage.py` as templates. The key function is `analyze_rule()`:

```python
from exporter.analyzer import analyze_rule, clear_caches, reset_analyze_rule_counter

def test_my_failing_pattern():
    clear_caches()
    reset_analyze_rule_counter()

    # Recreate the lambda pattern from the original world
    player = 1
    rule_func = lambda state: state.has('Moon Pearl', player) or state.has('Magic Mirror', player)

    result = analyze_rule(rule_func)
    print(f"Result: {result}")
    print(f"Type: {result.get('type')}")
```

**4. Test with closure variables**

Many failures involve closure variables not being resolved correctly:

```python
# Pass closure vars explicitly for debugging
result = analyze_rule(rule_func, closure_vars={'player': player, 'world': world})
```

**5. Test nested function factory patterns**

ALttP bunny rules use complex nested patterns. See `TestNestedCallPattern` for examples:

```python
def path_to_access_rule(path, entrance):
    return lambda state: state.can_reach(entrance.name, 'Entrance', entrance.player) and all(
        rule(state) for rule in path)

def options_to_access_rule(options):
    return lambda state: any(rule(state) for rule in options)

# The exact ALttP pattern: lambda calls factory then calls result with (state)
rule_func = lambda state: path_to_access_rule(new_path, entrance)(state)
```

### Common Failure Patterns

| Pattern | Test File | Description |
|---------|-----------|-------------|
| Bunny rules with `any()`/`all()` | `test_alttp_bunny_rules.py` | Function factories returning lambdas with generator expressions |
| Nested call `factory(args)(state)` | `test_alttp_bunny_rules.py::TestNestedCallPattern` | Lambda that calls a factory and immediately invokes the result |
| Inverted mode superbunny | `test_secret_passage.py` | Rules with entrance access requirements in inverted mode |
| Option `.to_bool()` calls | `test_alttp_bunny_rules.py::TestOpenPyramidToBool` | Option value method calls in rules |
| Closure variable resolution | `test_analysis.py::TestClosureVariables` | Item names or counts captured in closures |

### Adding Tests for New Failures

When you encounter a new failure pattern:

1. Create a minimal reproduction in the appropriate test file
2. Use mock objects (see `MockEntrance`, `MockState` in test files)
3. Print the full `analyze_rule()` result to understand what's happening
4. Document the root cause in the test docstring

Example test structure:

```python
class TestMyNewFailurePattern:
    """Tests for [description of the failure pattern]."""

    def setup_method(self):
        clear_caches()
        reset_analyze_rule_counter()

    def test_exact_failing_pattern(self):
        """
        Recreate the exact pattern that causes the failure.

        Root cause: [explain why the analyzer produces incorrect output]
        """
        # ... recreate the pattern ...
        result = analyze_rule(rule_func)

        print(f"Result: {result}")
        # Add assertions or document expected behavior
```

## Troubleshooting

### Module caching with code changes

On Linux, the fuzzer uses `fork` for multiprocessing, which means worker processes inherit cached module imports from the parent process. If you modify exporter code (like game handlers in `exporter/games/`), the changes may not take effect immediately.

**Symptoms:**
- Debug print statements don't appear in output
- Code changes don't seem to have any effect
- Tests pass/fail inconsistently

**Solutions:**

1. **Start a fresh Python process** - Use `exec` to replace the current process:
   ```bash
   exec python fuzz.py -r 1 -j 1 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook
   ```

2. **Clear Python cache files**:
   ```bash
   find . -name "*.pyc" -delete
   find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
   ```

3. **Run from a new terminal** - Close your current terminal and open a fresh one.

**Why this happens:**
The fuzzer imports modules before creating the multiprocessing Pool. When `fork` is used (default on Linux), child processes inherit the parent's memory including already-imported modules. Even with `-j 1`, the Pool still creates a worker process via fork.
