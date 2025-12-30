"""
Standard prompt generators for game debugging and development tasks.

These prompts guide various development workflows including helper export,
exporter simplification, multiworld debugging, and general spoiler debugging.
"""


def generate_helper_export_prompt(template_file, game_name, custom_code_info, seed=1, use_cloud_docs=False):
    """Generate a prompt for converting a game to use helper export.

    This prompt refers to CC/helper-export-guide.md for games that have
    custom exporters or JavaScript helpers that could potentially be removed.
    """
    doc_path = "CC/helper-export-guide.md"
    setup_doc = "CC/cloud-setup.md"

    # Build description of what custom code exists
    custom_parts = []
    if custom_code_info['has_exporter']:
        custom_parts.append(f"- Custom exporter: `{custom_code_info['exporter_path']}`")
    if custom_code_info['has_helpers']:
        custom_parts.append(f"- JavaScript helpers: `{custom_code_info['helpers_path']}`")
    custom_code_desc = "\n".join(custom_parts)

    world_dir = custom_code_info.get('world_directory', '<game>')

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read
{doc_path}

The game we are working on is **{game_name}** (template: `{template_file}`).

This game currently has custom code:
{custom_code_desc}

## Goal

The goal is to eliminate the custom code by exporting helper function definitions to `rules.json`, allowing the frontend to evaluate them directly without JavaScript implementations.

## Test Command

To test the current state:

```bash
source .venv/bin/activate
python scripts/test/test-all-templates.py --include-list "{template_file}" --minimal-spoilers
```

## Steps

1. **Review the current implementation**
   - Check the custom exporter (if any) for helper configurations
   - Check the JavaScript helpers (if any) to understand what logic exists

2. **Enable automatic helper export** (if not already enabled)
   - Set `AUTO_EXPORT_DISCOVERED_HELPERS = True` in the exporter

3. **Test and iterate**
   - Regenerate and run tests
   - Add complex helpers to `HELPERS_TO_EXPORT_BLACKLIST` if needed
   - Repeat until tests pass

4. **Remove JavaScript helpers**
   - Once tests pass with exported helpers, remove the JavaScript implementations
   - Keep only blacklisted helpers and their dependencies

5. **Remove custom exporter** (if possible)
   - If no custom logic remains, delete the exporter file entirely

## Reference Files

- Python world: `worlds/{world_dir}/`
- Rules file: `worlds/{world_dir}/Rules.py`
"""


def generate_exporter_simplify_prompt(template_file, game_name, custom_code_info, seed=1, use_cloud_docs=False):
    """Generate a prompt for simplifying a game's custom exporter.

    This prompt guides simplification of custom exporters by leveraging
    base class auto-discovery features and removing redundant code,
    following the pattern established by the ALTTP exporter simplification.
    """
    setup_doc = "CC/cloud-setup.md"
    exporter_path = custom_code_info.get('exporter_path', 'exporter/games/<game>.py')
    world_dir = custom_code_info.get('world_directory', '<game>')

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

## Game Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **Custom exporter**: `{exporter_path}`
- **World directory**: `worlds/{world_dir}/`

## Goal

Simplify the custom exporter by leveraging base class tools and removing redundant code. The goal is to reduce the exporter to only the code that is truly game-specific.

## Base Class Tools Reference

First, examine the tools available in the base exporter. Read:
- `exporter/games/base/handler.py` - Class attributes and hook methods
- `exporter/games/base/rule_expansion.py` - Rule expansion with declarative replacements

### Declarative Configuration (Class Attributes)

These class attributes let you configure behavior without writing custom methods:

| Attribute | Purpose | Example Game |
|-----------|---------|--------------|
| `STATE_METHOD_REPLACEMENTS` | Replace state methods with rule structures (often auto-detected) | ALTTP, OOT |
| `CLOSURE_VAR_IMPORTS` | Inject module-level variables for helper analysis | KH2 (auto_form_dict, form_list, etc.) |
| `HELPER_OBJECT_NAMES` | Convert `obj.method()` calls to helper functions | Yoshi's Island (logic, bosses) |
| `NAME_REMAPPING` | Map parameter names to setting names | - |
| `SETTINGS_TO_CONVERT` | Convert name types to setting_value types | - |
| `HELPER_PARAM_MAPPINGS` | Map helper params to slot_data keys (rarely needed - auto-detected) | - |
| `AUTO_DISCOVER_*` | Auto-discover attributes without manual specification | ALTTP |
| `SELF_ATTR_TO_SETTING` | Map `self.attr` patterns to setting_value rules | KH2 (fight_logic → FightLogic) |
| `CONSTANT_HELPER_EXPANSIONS` | Map helpers to constant return values (True/False) | KH2, Overcooked 2 |
| `HELPER_TO_RULE_MAPPINGS` | Map helper calls to rule types (location_check, can_reach, etc.) | Dark Souls 3 |
| `ACCUMULATOR_RULES` | Configure item accumulation patterns (coins, etc.) | LADX, DLC Quest |
| `PROG_ITEMS_INIT` | Initial values for accumulators | (used with ACCUMULATOR_RULES) |
| `ACCUMULATOR_ITEM_GROUP` | Auto-generate accumulator items with this group name | DLC Quest |
| `ACCUMULATOR_ITEM_TYPE` | Type for auto-generated accumulator items | DLC Quest |
| `ITEM_VALUE_MAPPINGS` | Extract item→value mappings from world attributes | OSRS (qp_items) |
| `DICT_SUM_HELPERS` | Auto-generate sum helpers over item→value dicts | OSRS (quest_points) |

### Behavior Flags

These flags control export and frontend behavior:

| Flag | Purpose | Example Game |
|------|---------|--------------|
| `ASSUME_BIDIRECTIONAL_EXITS` | Exits work in both directions by default | ALTTP, A Hat in Time |
| `USE_RESOLVED_ITEMS` | Use resolved_items from sphere log instead of base_items | Raft, LADX, DLC Quest |
| `ADD_SPHERE_ITEMS_UPFRONT` | Add items before accessibility checks | Raft, Witness, Jak & Daxter |
| `USE_AUTO_INDIRECT_CONDITIONS` | Auto sweep for indirect region dependencies | Lingo |

### Helper Control

These control which helpers are inlined vs preserved as calls:

| Attribute | Purpose | Example Game |
|-----------|---------|--------------|
| `HELPERS_TO_PRESERVE` | Don't inline these helpers during analysis | Lingo, TUNIC, Subnautica |
| `HELPERS_TO_EXPORT_WHITELIST` | Only export these helpers as definitions | Yoshi's Island |
| `HELPERS_TO_EXPORT_BLACKLIST` | Never export these helpers (too complex) | - |
| `COMPUTED_HELPERS` | Helpers defined in get_helper_definitions() | OSRS |
| `AUTO_PRESERVE_COMPUTED_HELPERS` | Auto-preserve computed helpers | - |

### What's Automatically Handled (No Configuration Needed)

These features work out-of-the-box with `GenericGameExportHandler`:

**Data Discovery & Export:**
- All world options (`world.options.*`) → exported to `options` dict
- Option definitions (type, range, defaults) → exported for frontend use
- Item data (names, IDs, classifications, groups) → auto-discovered
- Event items from placed locations → auto-detected
- World attributes (simple types) → auto-discovered (`AUTO_DISCOVER_WORLD_ATTRIBUTES=True`)
- Region attributes (simple types) → auto-discovered (`AUTO_DISCOVER_REGION_ATTRIBUTES=True`)
- Location attributes (simple types) → auto-discovered (`AUTO_DISCOVER_LOCATION_ATTRIBUTES=True`)

**Helper Discovery & Export:**
- Helper modules → auto-discovered from world directory (`AUTO_DISCOVER_WORLD_HELPER_MODULES=True`)
- Discovered helpers → auto-exported as definitions (`AUTO_EXPORT_DISCOVERED_HELPERS=True`)
- Helper param_mappings → auto-detected from call-site patterns (e.g., `world.options.X`)
- Enum classes used as helpers → converted to identity functions

**LogicMixin State Method Auto-Detection** (`AUTO_DISCOVER_LOGIC_MIXIN_REPLACEMENTS=True`):
- `return self.multiworld.worlds[player].<attr>` → `setting_value` rule
- `return not self.multiworld.worlds[player].<attr>` → negated `setting_value` rule
- `return bool(world.options.<opt>.value)` → `setting_value` rule
- "All elements pass check" patterns (for loop with early return False, final return True):
  - `self.can_reach_location(var, player)` check → `all_of` with `location_check`
  - `state.has(var, player)` check → `all_of` with `item_check`
  - `state.can_reach(var, player)` check → `all_of` with `can_reach`
- Example: TWW's `_tww_can_defeat_all_required_bosses` is auto-detected as `all_of(location_check)`

**Rule Analysis & Expansion:**
- `state.has(item)` → `item_check`
- `state.has_any([items])` → `or(item_checks)`
- `state.has_all([items])` → `and(item_checks)`
- `state.has_all(set([items]))` → simplified to item checks
- `self.options.X` / `world.options.X` → resolved to constant values
- f-string items → resolved to constant strings
- `get_location().can_reach()` → `location_check`

### Automatic Pattern Handling (Built-in)

These rule patterns are handled automatically by the base class:

| Pattern | Description | Example Game |
|---------|-------------|--------------|
| LogicMixin methods | `_*_has_item`, `_*_has_region`, `_*_has_item_and_region` → simplified rules | Wargroove |
| Location lambdas in exits | `lambda state: any(loc.access_rule(state) for loc in locs)` | Wargroove |
| Location objects in closures | Lambda default parameters referencing Location objects | TLOZ |
| Generic function calls | `location_item_name`, `item_name_in_location_names` | Base class |

## Reference: Simplified Exporters

Review these simplified exporters as examples:

```bash
cat exporter/games/alttp.py      # ~60 lines - auto-discovery flags only
cat exporter/games/dark_souls_3.py  # ~20 lines - HELPER_TO_RULE_MAPPINGS only
```

**Note:** If an exporter class does nothing but `pass`, it should be **deleted entirely**.
The exporter registry auto-discovers handlers and falls back to `GenericGameExportHandler`
when no custom handler exists. Empty exporters just add unnecessary files.

**Example: TWW has no custom exporter** - All LogicMixin methods (like `_tww_can_defeat_all_required_bosses`)
are auto-detected by the base class, so no `exporter/games/tww.py` file is needed.

## Simplification Patterns

1. **Delete the exporter entirely if it just has `pass`**
   - If the class body is just `pass` (with only a docstring), delete the file
   - The generic handler will be used automatically

2. **Replace custom `expand_rule` overrides with `STATE_METHOD_REPLACEMENTS`**
   - If the exporter has custom state method handling, use the declarative dict instead
   - Example: `'_game_setting': {{'type': 'setting_value', 'setting': 'logic_setting'}}`

3. **Replace custom closure injection with `CLOSURE_VAR_IMPORTS`**
   - If `prepare_closure_vars` is overridden to inject module variables, use the dict instead
   - Example: `CLOSURE_VAR_IMPORTS = {{'worlds.game.rules': ['constants', 'mappings']}}`

4. **Replace custom method-to-helper conversion with `HELPER_OBJECT_NAMES`**
   - If the exporter converts `logic.method()` or similar to helpers, add to this set
   - Example: `HELPER_OBJECT_NAMES = {{'self', 'world', 'logic', 'bosses'}}`

5. **Remove redundant method overrides** - Methods that just call `super()` or return minimal data

6. **Enable auto-discovery flags** instead of manual attribute specifications

7. **Factor out commonly useful code** - Move generic patterns to base class for other games to use

## Investigation Commands

```bash
source .venv/bin/activate

# View current exporter size
wc -l {exporter_path}

# Check if the exporter is just 'pass' (can be deleted entirely)
grep -c "^\\s*pass$" {exporter_path}

# Check for expand_rule overrides that could use STATE_METHOD_REPLACEMENTS
grep -n "def expand_rule" {exporter_path}

# Check for prepare_closure_vars that could use CLOSURE_VAR_IMPORTS
grep -n "def prepare_closure_vars" {exporter_path}

# Check for state method patterns in the override
grep -n "state_method\\|_has_item\\|_has_region" {exporter_path}

# Check what flags/attributes the exporter sets
grep -n "AUTO_\\|HELPER_\\|STATE_METHOD" {exporter_path}

# Check for method overrides that might be removable
grep -n "def get_world_data\\|def get_game_info\\|def replace_name\\|def handle_special_function_call" {exporter_path}
```

## Test Commands

After each simplification, verify tests still pass:

```bash
python scripts/test/test-all-templates.py --include-list "{template_file}" --minimal-spoilers
```

## Steps

1. **Examine the base class tools** - Read `exporter/games/base/handler.py` to understand available options
2. **Review the current exporter** - Identify what custom logic exists
3. **Compare to simplified exporters** - Identify patterns that could be applied
4. **Replace method overrides with declarative attributes** - Use STATE_METHOD_REPLACEMENTS, etc.
5. **Remove redundant methods** - Delete methods that duplicate base class behavior
6. **Factor out commonly useful code** - Move generic patterns to base class if beneficial
7. **Test after each change** - Verify tests still pass

## Important Notes

- Make incremental changes and test after each one
- Some games genuinely need custom logic - don't remove code that's actually required
- The goal is simplification, not breaking functionality
- Document any game-specific quirks that must remain
- When factoring out code to the base exporter, ensure it's generic enough to work for all games
"""


def generate_new_rule_types_prompt(game_name):
    """Generate a prompt for investigating new rule types needed by a game's helpers.

    This prompt refers to CC/implementing-new-rule-types.md for games that have
    JavaScript helpers requiring new rule type support.
    """
    return f"""First, please read CC/cloud-setup.md and complete the environment setup if you haven't already.

Then, please read CC/implementing-new-rule-types.md

Then please investigate what needs to be done next to continue adding support for the rule types required by the helper functions in {game_name}.
"""


def generate_gen_errors_prompt(template_file, game_name, gen_error_count, seed=1, use_cloud_docs=False):
    """Generate a prompt for investigating generation errors in a game that passes spoiler tests.

    This is for games where the spoiler test passes but generation produced errors,
    which may indicate issues with rule export or world generation.
    """
    setup_doc = "CC/cloud-setup.md"

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

The game we are investigating is **{game_name}** (template: `{template_file}`).

## Issue

This game **passes** the spoiler test but has **{gen_error_count} generation error(s)**. This discrepancy suggests there may be issues with:
- Rule export that produces errors but doesn't prevent test completion
- World generation warnings being logged as errors
- Non-critical errors that don't affect gameplay logic

## Test Commands

To reproduce and investigate:

```bash
source .venv/bin/activate

# Run generation and watch for errors
python Generate.py --weights_file_path "Templates/{template_file}" --multi 1 --seed {seed}

# Run the spoiler test to confirm it passes
npm test -- --mode=test-spoilers --game={game_name.lower().replace(' ', '')} --seed={seed}
```

## Investigation Steps

1. **Run generation and capture output**
   - Look for ERROR lines in the generation output
   - Note what types of errors are occurring

2. **Check the generated rules file**
   - Location: `frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json`
   - Look for any anomalies or missing data

3. **Review the exporter code** (if custom exporter exists)
   - Check `exporter/games/<game>.py` for error handling
   - Look for places where errors might be logged but not raised

4. **Determine if errors are critical**
   - If errors don't affect gameplay, consider suppressing or downgrading to warnings
   - If errors indicate real issues, fix the underlying cause

## Goal

Either:
- Fix the generation errors so they no longer occur, OR
- Determine the errors are non-critical and adjust logging level appropriately
"""


def generate_basic_spoiler_debug_prompt(template_file, game_name, seed=1, use_cloud_docs=False, custom_code_info=None):
    """Generate a debugging prompt for games without JavaScript helpers.

    This prompt refers to CC/basic-spoiler-debugging.md for games that don't have
    JavaScript helpers. This includes both basic games (no custom code) and
    exporter-only games (has custom exporter but no JS helpers).
    """
    doc_path = "CC/basic-spoiler-debugging.md"
    setup_doc = "CC/cloud-setup.md"

    # Determine if this game has a custom exporter
    has_exporter = custom_code_info and custom_code_info.get('has_exporter', False)
    exporter_path = custom_code_info.get('exporter_path') if custom_code_info else None

    # Build the game description based on whether it has a custom exporter
    if has_exporter:
        game_description = f"""This game has a custom exporter (`{exporter_path}`) but no JavaScript helpers.

If helper functions are missing or not being exported correctly, check the exporter configuration."""
    else:
        game_description = """This game uses only the generic export infrastructure - it has no custom exporter (`exporter/games/<game>.py`) and no JavaScript helpers (`frontend/modules/shared/gameLogic/<game>/`)."""

    # Build the debugging focus message
    if has_exporter:
        debug_focus = f"""Focus on:
- Whether the exporter (`{exporter_path}`) is correctly configured
- Whether helpers need to be added to `HELPERS_TO_EXPORT_WHITELIST`
- Whether the generic infrastructure is handling this game's rules correctly"""
    else:
        debug_focus = """Since this is a basic game, focus on whether the generic infrastructure is handling this game's rules correctly."""

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read
{doc_path}

The game we are debugging is **{game_name}** (template: `{template_file}`).

{game_description}

## Test Command

To run the spoiler test for this game:

```bash
source .venv/bin/activate
python scripts/test/test-all-templates.py --include-list "{template_file}" --minimal-spoilers
```

Or to run generation and testing separately:

```bash
python Generate.py --weights_file_path "Templates/{template_file}" --multi 1 --seed {seed}
npm test -- --mode=test-spoilers --game=<gamename> --seed={seed}
```

## Debugging Steps

1. Run the test and analyze the failure
2. Follow the debugging workflow in {doc_path}
3. Identify whether the issue is in:
   - Rule export (`exporter/analyzer.py`)
   - Rule evaluation (`frontend/modules/shared/ruleEngine.js`)
   - Missing helper that needs to be exported or implemented

{debug_focus}
"""


def generate_multiworld_prompt(template_file, game_name, bisection_info, failure_details, seed=1):
    """Generate a debugging prompt for a failing multiworld test.

    Focuses on specific failing pairs from bisection results when available.
    Also reports intermittent failures if any were detected.
    """
    prompt_parts = []

    prompt_parts.append("""First, please read CC/cloud-setup.md and complete the environment setup if you haven't already.

Then, please read
CC/game-debugging-multiworld-CC.md
""")

    prompt_parts.append(f"The game we are debugging is **{game_name}** (template: `{template_file}`).\n")

    # Check for intermittent failures
    intermittent_failures = failure_details.get('intermittent_failures', []) if failure_details else []
    if intermittent_failures:
        prompt_parts.append(f"\n## Intermittent Failures Detected\n")
        prompt_parts.append(f"This test had **{len(intermittent_failures)} intermittent failure(s)** - tests that failed initially but passed on retry:\n\n")
        for failure in intermittent_failures:
            player_num = failure.get('player_number', '?')
            attempt = failure.get('attempt', '?')
            sphere_reached = failure.get('sphere_reached', '?')
            total_spheres = failure.get('total_spheres', '?')
            prompt_parts.append(f"- Player {player_num}: Failed on attempt {attempt} at sphere {sphere_reached}/{total_spheres}, then passed on retry\n")
        prompt_parts.append("\nIntermittent failures suggest timing issues, race conditions, or non-deterministic behavior in the rule evaluation.\n")

    # Check if we have bisection results with failing pairs
    if bisection_info['has_bisection'] and bisection_info['failing_pairs']:
        failing_pairs = bisection_info['failing_pairs']
        prompt_parts.append(f"\n## Bisection Results\n")
        prompt_parts.append(f"Bisection testing found {len(failing_pairs)} specific template pair(s) that cause failures:\n")

        for partner in failing_pairs:
            prompt_parts.append(f"- `{template_file}` + `{partner}`\n")

        # Focus on the first failing pair for debugging
        first_failing_partner = failing_pairs[0]
        prompt_parts.append(f"\n## Recommended Debugging Focus\n")
        prompt_parts.append(f"Start by debugging the pair: **{template_file}** + **{first_failing_partner}**\n")

        # Find details for this specific pair
        failing_player_num = None
        failing_template = None
        sphere_reached = 0
        total_spheres = 0
        for pair in bisection_info['tested_pairs']:
            if pair.get('partner_template') == first_failing_partner:
                player_results = pair.get('player_results', {})
                for player_key, player_result in player_results.items():
                    if not player_result.get('passed', True):
                        failing_player_num = player_result.get('player_number')
                        failing_template = player_result.get('template')
                        sphere_reached = player_result.get('sphere_reached', 0)
                        total_spheres = player_result.get('total_spheres', 0)
                        prompt_parts.append(f"\n**Player {failing_player_num}** (`{failing_template}`) failed at sphere {sphere_reached}/{total_spheres}\n")
                break

        # Determine player order (alphabetical)
        sorted_templates = sorted([template_file, first_failing_partner])
        player1_template = sorted_templates[0]
        player2_template = sorted_templates[1]

        prompt_parts.append(f"""
Since {len(failing_pairs)} different partner games cause failures with {game_name}, the issue is likely in the **{game_name}** game logic itself, not in the partner games.

## Setup Commands

To set up this specific failing pair for debugging:

```bash
# Clear multiworld directory
rm -f Players/presets/Multiworld/*.yaml

# Copy the failing pair
cp "Players/Templates/{template_file}" Players/presets/Multiworld/
cp "Players/Templates/{first_failing_partner}" Players/presets/Multiworld/

# Generate multiworld data
python Generate.py --player_files_path Players/presets/Multiworld --seed {seed}
```

After generation, the files will be in `frontend/presets/multiworld/AP_14089154938208861744/` (for seed 1).

In multiworld mode, templates are assigned to players alphabetically:
- Player 1: `{player1_template}`
- Player 2: `{player2_template}`

## Debugging Steps

1. **Run the spoiler test for the failing player** to see where it stops:
```bash
npm test --mode=test-spoilers --game=multiworld --seed={seed} --player={failing_player_num if failing_player_num else 2}
npm run test:analyze
cat playwright-analysis.txt
```

2. **Examine the sphere log** to understand progression:
```bash
# View the sphere log for the failing player
cat frontend/presets/multiworld/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl | grep '"player": {failing_player_num if failing_player_num else 2}' | head -20
```

3. **Check the rules file** for the failing player's game:
```bash
# View player-specific rules
cat frontend/presets/multiworld/AP_14089154938208861744/AP_14089154938208861744_rules.json | python -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d['players']['{failing_player_num if failing_player_num else 2}'], indent=2))" | head -100
```

4. **Compare with single-player behavior**: The issue may be related to how items from other players are handled, or how the game logic processes "foreign" items.
""")

    elif bisection_info['has_bisection'] and not bisection_info['failing_pairs']:
        # Bisection ran but found no failing pairs
        prompt_parts.append(f"\n## Bisection Results\n")
        prompt_parts.append("Bisection testing was triggered but found NO specific failing pairs.\n")
        if intermittent_failures:
            prompt_parts.append("This is consistent with the intermittent failures detected above - the failure is not consistently reproducible with any specific pair.\n")
        else:
            prompt_parts.append("Since the default test uses 2 retries, intermittent failures are usually caught. This likely indicates an issue that only occurs with more than 2 templates in the multiworld.\n")

        prompt_parts.append(f"""
## Test Command

To re-run the multiworld test:

```bash
python scripts/test/test-all-templates.py --multiworld --multiworld-bisect-failures --include-list "{template_file}"
```
""")

    else:
        # No bisection results - just provide general debugging info
        if failure_details:
            prompt_parts.append(f"\n## Failure Details\n")

            if not failure_details['generation_success']:
                prompt_parts.append("Generation failed for this multiworld.\n")
            else:
                player_results = failure_details.get('player_results', {})
                for player_key, player_result in player_results.items():
                    if not player_result.get('passed', True):
                        prompt_parts.append(f"Player {player_result.get('player_number')} failed:")
                        prompt_parts.append(f"  - Sphere reached: {player_result.get('sphere_reached', 0)}/{player_result.get('total_spheres', 0)}\n")

            templates_in_multiworld = failure_details.get('templates_in_multiworld', {})
            if templates_in_multiworld:
                prompt_parts.append("\nTemplates in multiworld:\n")
                for player_key, tmpl in sorted(templates_in_multiworld.items()):
                    prompt_parts.append(f"  - {player_key}: {tmpl}\n")

        prompt_parts.append(f"""
## Test Command

To run the multiworld test with bisection (to find specific failing pairs):

```bash
python scripts/test/test-all-templates.py --multiworld --multiworld-bisect-failures --include-list "{template_file}"
```
""")

    return ''.join(prompt_parts)


def generate_generation_failure_prompt(template_file, game_name, gen_failure_info, custom_code_info=None, seed=1, use_cloud_docs=False):
    """Generate a prompt for debugging generation failures.

    This is used when generation completely fails (before spoiler tests can run).
    The prompt guides the user to fix generation first.
    """
    doc_path = "CC/game-debugging.md" if not use_cloud_docs else "CC/game-debugging-CC.md"
    setup_doc = "CC/cloud-setup.md"

    return_code = gen_failure_info.get('return_code', 'unknown')
    error_count = gen_failure_info.get('error_count', 0)

    # Build custom code description if available
    custom_code_desc = ""
    if custom_code_info:
        custom_parts = []
        if custom_code_info.get('has_exporter'):
            custom_parts.append(f"A custom exporter exists: `{custom_code_info.get('exporter_path')}`")
        if custom_code_info.get('has_helpers'):
            custom_parts.append(f"JavaScript helpers exist: `{custom_code_info.get('helpers_path')}`")
        if custom_parts:
            custom_code_desc = "\n" + "\n".join(custom_parts) + "\n"

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read {doc_path}

The next game we want to work on is **{game_name}**.

## Priority: Fix Generation First

**Generation is completely failing** for this game (return code: {return_code}, errors: {error_count}).

The spoiler test cannot run until generation succeeds. Your first priority is to fix the generation step.
{custom_code_desc}
## Step 1: Run Generation and Examine Errors

```bash
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/{template_file}" --multi 1 --seed {seed} 2>&1 | tee generate_output.txt
```

Examine the output to identify the specific error. Common issues include:
- Missing or invalid item/location definitions
- Circular dependencies in rules
- Invalid region connections
- Python errors in the world code

## Step 2: Once Generation Works

After fixing generation, run the full test:

```bash
python scripts/test/test-all-templates.py --include-list "{template_file}" --minimal-spoilers
```

Or run just the spoiler test:

```bash
npm test --mode=test-spoilers --game={game_name.lower().replace(' ', '')} --seed={seed}
```

## Key Files to Investigate

- Template: `Players/Templates/{template_file}`
- World directory: `worlds/` (look for the game's world package)
- Exporter (if custom): Check `exporter/games/` for game-specific export logic
"""
