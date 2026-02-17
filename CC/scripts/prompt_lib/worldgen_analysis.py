"""
World generator test analysis utilities.

Functions for analyzing world generator test results and categorizing errors.
"""

import json
import re
import sys
from pathlib import Path


def load_worldgen_test_results(project_root, test_mode='canonical'):
    """Load the world generator test results JSON file.

    Args:
        project_root: Path to the project root
        test_mode: 'canonical' or 'random'

    Returns:
        Dict with 'metadata' and 'results' keys, or empty dict if not found
    """
    results_file = Path(project_root) / 'scripts' / 'output' / 'world-generator' / f'test-results-{test_mode}.json'
    if not results_file.exists():
        return {}

    try:
        with open(results_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading worldgen test results: {e}", file=sys.stderr)
        return {}


def get_worldgen_world_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 1: World Generation.

    World generation failures occur when the world generator fails to create
    the _worldgen Python world files from rules.json.

    Returns list of dicts with game_name, template, error, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        world_gen = test_world.get('world_generation', {})

        # Check if world generation itself failed
        if not world_gen.get('success', True):
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'error': world_gen.get('error', 'Unknown error'),
                'world_dir': world_gen.get('world_dir'),
            })

    return failures


def get_worldgen_seed_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 2: Seed Generation.

    Seed generation failures occur when the _worldgen world files were created
    successfully, but running Generate.py with them fails.

    Returns list of dicts with game_name, template, error, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        seed_gen = test_world.get('seed_generation', {})

        # Check if world generation succeeded but seed generation failed
        world_gen_success = test_world.get('world_generation', {}).get('success', False)
        seed_gen_success = seed_gen.get('success', False)

        if world_gen_success and not seed_gen_success:
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'error': seed_gen.get('error', 'Unknown error'),
                'test_template_name': test_world.get('test_template_name'),
                'world_dir': test_world.get('world_dir'),
            })

    return failures


def get_worldgen_spoiler_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 3: Spoiler Test.

    Spoiler test failures occur when the _worldgen world generates a seed
    successfully, but the spoiler test fails against its own rules.

    Returns list of dicts with game_name, template, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        seed_gen = test_world.get('seed_generation', {})
        spoiler_test = test_world.get('spoiler_test', {})

        # Check if seed generation succeeded but spoiler test failed
        seed_gen_success = seed_gen.get('success', False)
        spoiler_pass = spoiler_test.get('pass_fail') == 'pass'

        if seed_gen_success and not spoiler_pass:
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'test_template_name': test_world.get('test_template_name'),
                'world_dir': test_world.get('world_dir'),
                'spoiler_error': spoiler_test.get('error'),
            })

    return failures


def get_worldgen_crossval_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 4: Cross-Validation.

    Cross-validation failures occur when the _worldgen world passes its own
    spoiler test, but fails when validated against the original world's sphere log.
    This indicates the worldgen world has different accessibility logic than the original.

    Returns list of dicts with game_name, template, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        seed_gen = test_world.get('seed_generation', {})
        spoiler_test = test_world.get('spoiler_test', {})
        cross_validation = test_world.get('cross_validation', {})

        # Check if seed generation and spoiler test succeeded but cross-validation failed
        seed_gen_success = seed_gen.get('success', False)
        spoiler_pass = spoiler_test.get('pass_fail') == 'pass'
        crossval_fail = cross_validation.get('pass_fail') == 'fail'

        if seed_gen_success and spoiler_pass and crossval_fail:
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'test_template_name': test_world.get('test_template_name'),
                'world_dir': test_world.get('world_dir'),
                'crossval_error': cross_validation.get('error'),
            })

    return failures


def get_worldgen_rules_comp_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 5: Rules Comparison.

    Rules comparison failures occur when the _worldgen world generates rules.json
    that differ from the original world's rules.json export (after normalizing
    WorldGen name differences and ignoring canonical placements).

    These differences indicate the world generator is not perfectly preserving
    all rule data during the round-trip conversion.

    Returns list of dicts with game_name, template, differences_count, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        seed_gen = test_world.get('seed_generation', {})
        rules_comparison = test_world.get('rules_comparison', {})

        # Check if seed generation succeeded but rules comparison failed
        seed_gen_success = seed_gen.get('success', False)
        rules_comp_fail = rules_comparison.get('pass_fail') == 'fail'

        if seed_gen_success and rules_comp_fail:
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'differences_count': rules_comparison.get('differences_count', 0),
                'ignored_count': rules_comparison.get('ignored_count', 0),
                'error': rules_comparison.get('error'),
                'test_template_name': test_world.get('test_template_name'),
                'world_dir': test_world.get('world_dir'),
            })

    return failures


def categorize_world_generation_error(error_msg):
    """Categorize a Stage 1 (world generation) error message.

    These are errors that occur when creating the _worldgen Python files,
    not when running Generate.py with them.

    Returns a tuple of (category, details).
    """
    if not error_msg:
        return ('unknown', None)

    # Check for comparison operator type errors (common issue)
    if "not supported between instances of" in error_msg:
        match = re.search(r"'([^']+)' not supported between instances of '([^']+)' and '([^']+)'", error_msg)
        if match:
            return ('comparison_type_error', {
                'operator': match.group(1),
                'left_type': match.group(2),
                'right_type': match.group(3)
            })
        return ('comparison_type_error', {'message': error_msg})

    if 'KeyError' in error_msg:
        match = re.search(r"KeyError: (.+)", error_msg)
        key = match.group(1) if match else None
        return ('key_error', {'key': key})

    if 'TypeError' in error_msg:
        return ('type_error', {'message': error_msg})

    if 'SyntaxError' in error_msg:
        return ('syntax_error', {'message': error_msg})

    if 'AttributeError' in error_msg:
        return ('attribute_error', {'message': error_msg})

    return ('other', {'message': error_msg})


def categorize_seed_generation_error(error_msg):
    """Categorize a Stage 2 (seed generation) error message.

    These are errors that occur when running Generate.py with the _worldgen world,
    after the world files have been created successfully.

    Returns a tuple of (category, details).
    """
    if not error_msg:
        return ('unknown', None)

    if 'NameError' in error_msg:
        # Extract the undefined name
        match = re.search(r"name '([^']+)' is not defined", error_msg)
        undefined_name = match.group(1) if match else None
        return ('name_error', {'undefined_name': undefined_name})

    if 'FillError' in error_msg:
        return ('fill_error', None)

    if 'KeyError' in error_msg:
        match = re.search(r"KeyError: (.+)", error_msg)
        key = match.group(1) if match else None
        return ('key_error', {'key': key})

    if 'TypeError' in error_msg:
        return ('type_error', {'message': error_msg})

    if 'AttributeError' in error_msg:
        return ('attribute_error', {'message': error_msg})

    return ('other', {'message': error_msg})


def load_spoiler_fuzz_test_results(project_root, seed_mode='fixed'):
    """Load the spoiler fuzz test results JSON file.

    Spoiler fuzz tests run seed generation with random options, then run the
    JavaScript frontend spoiler test against the generated rules.json. This
    tests whether the frontend can correctly evaluate rules for all option
    combinations.

    Args:
        project_root: Path to the project root
        seed_mode: 'fixed' or 'random'

    Returns:
        Dict with 'metadata' and 'results' keys, or empty dict if not found
    """
    filename = f'test-results-{seed_mode}-seed.json'
    results_file = Path(project_root) / 'scripts' / 'output' / 'spoiler-fuzz' / filename
    if not results_file.exists():
        return {}

    try:
        with open(results_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading spoiler fuzz test results: {e}", file=sys.stderr)
        return {}


def load_ut_fuzz_test_results(project_root, ut_version='worldgen', seed_mode='fixed', world_source='bundled'):
    """Load the UT fuzz test results JSON file.

    Args:
        project_root: Path to the project root
        ut_version: 'original' or 'worldgen'
        seed_mode: 'fixed' or 'random'
        world_source: 'bundled' or 'apworlds'

    Returns:
        Dict with 'metadata' and 'results' keys, or empty dict if not found
    """
    # Build filename based on parameters
    # For bundled worlds: test-results-{ut_version}-{seed_mode}-seed.json
    # For apworlds: test-results-{world_source}-{ut_version}-{seed_mode}-seed.json
    if world_source == 'bundled':
        filename = f'test-results-{ut_version}-{seed_mode}-seed.json'
    else:
        filename = f'test-results-{world_source}-{ut_version}-{seed_mode}-seed.json'

    results_file = Path(project_root) / 'scripts' / 'output' / 'ut-fuzz' / filename
    if not results_file.exists():
        return {}

    try:
        with open(results_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading UT fuzz test results: {e}", file=sys.stderr)
        return {}


def load_ut_fuzz_single_game_results(project_root, ut_version='worldgen', seed=None):
    """Load the single-game UT fuzz test results JSON file.

    These are results from the test-ut-fuzz-single-game.yml workflow, which tests
    one game with many iterations to find specific failing seeds.

    Args:
        project_root: Path to the project root
        ut_version: 'original', 'worldgen', or 'hybrid'
        seed: Specific seed number to load results for, or None to auto-detect

    Returns:
        Dict with 'metadata' and 'results' keys, or empty dict if not found
    """
    import glob as glob_module

    results_dir = Path(project_root) / 'scripts' / 'output' / 'ut-fuzz'

    if seed is not None:
        # Load results for specific seed
        # New format: test-results-single-game-{ut_version}-seed-{seed}.json
        filename = f'test-results-single-game-{ut_version}-seed-{seed}.json'
        results_file = results_dir / filename
    else:
        # Auto-detect: look for any matching result file
        # New format: test-results-single-game-{ut_version}-seed-*.json
        # Also check for random seed: test-results-single-game-{ut_version}-random-seed.json
        pattern = str(results_dir / f'test-results-single-game-{ut_version}-seed-*.json')
        matches = glob_module.glob(pattern)

        # Also check for random seed file
        random_file = results_dir / f'test-results-single-game-{ut_version}-random-seed.json'
        if random_file.exists():
            matches.append(str(random_file))

        # Fall back to old format for backwards compatibility
        old_fixed = results_dir / f'test-results-single-game-{ut_version}-fixed-seed.json'
        old_random = results_dir / f'test-results-single-game-{ut_version}-random-seed.json'
        if old_fixed.exists():
            matches.append(str(old_fixed))
        if old_random.exists() and str(random_file) not in matches:
            matches.append(str(old_random))

        if not matches:
            return {}

        # Use the most recently modified file
        results_file = Path(max(matches, key=lambda f: Path(f).stat().st_mtime))

    if not results_file.exists():
        return {}

    try:
        with open(results_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading single-game UT fuzz test results: {e}", file=sys.stderr)
        return {}


def get_ut_fuzz_single_failure(project_root, ut_version='worldgen', seed=None):
    """Get the lowest-numbered failing seed from single-game UT fuzz results.

    Returns a dict with failure details if a failure is found, None otherwise.
    The dict includes:
        - game_name: Display name of the game
        - template: Template filename
        - world_directory: World directory name
        - base_seed: The --starting-seed value used for the fuzz test
        - failing_seed: The actual seed that failed (lowest if multiple)
        - reproduction_seed: The seed to use for reproduction (same as failing_seed with --number-by-seed)
        - error_type: The error type (e.g., 'None' for logic mismatch)
        - ut_fuzz: Dict with total, success, failure stats
        - default_options: Options left at defaults during fuzzing (if any)
        - disallow_options: Options disallowed during fuzzing (if any)
    """
    all_failures = get_ut_fuzz_all_single_failures(project_root, ut_version, seed)
    return all_failures[0] if all_failures else None


def get_ut_fuzz_all_single_failures(project_root, ut_version='worldgen', seed=None):
    """Get all failing seeds from single-game UT fuzz results.

    Returns a list of dicts, one for each failing seed. Each dict includes:
        - game_name: Display name of the game
        - template: Template filename
        - world_directory: World directory name
        - base_seed: The --starting-seed value used for the fuzz test
        - failing_seed: The actual seed that failed
        - reproduction_seed: The seed to use for reproduction
        - error_type: The error type (e.g., 'None' for logic mismatch)
        - ut_fuzz: Dict with total, success, failure stats
        - default_options: Options left at defaults during fuzzing (if any)
        - disallow_options: Options disallowed during fuzzing (if any)

    The list is sorted by failing_seed (lowest first).
    """
    data = load_ut_fuzz_single_game_results(project_root, ut_version, seed)

    if not data or 'results' not in data:
        return []

    metadata = data.get('metadata', {})
    # Support both old ('seed') and new ('starting_seed') metadata key names
    base_seed = metadata.get('starting_seed', metadata.get('seed'))
    total_runs = metadata.get('total_runs', 0)

    # If base_seed is None or "random", we can't reproduce deterministically
    if base_seed is None or base_seed == "random":
        base_seed = None

    # Extract fuzzer options from metadata
    default_options = metadata.get('default_options')
    disallow_options = metadata.get('disallow_options')

    results = data.get('results', {})
    all_failures = []

    # Find the first game with failures (there should only be one in single-game results)
    for template_name, result in results.items():
        ut_fuzz = result.get('ut_fuzz', {})

        if ut_fuzz.get('passed', True):
            continue

        errors = ut_fuzz.get('errors', {})
        if not errors:
            continue

        world_info = result.get('world_info', {})
        game_name = world_info.get('game_name', template_name.replace('.yaml', ''))
        world_dir = world_info.get('world_directory', '')

        # Build ut_fuzz stats dict (shared across all failures from this game)
        ut_fuzz_stats = {
            'total': ut_fuzz.get('total', 0),
            'success': ut_fuzz.get('success', 0),
            'failure': ut_fuzz.get('failure', 0),
            'timeout': ut_fuzz.get('timeout', 0),
            'ignored': ut_fuzz.get('ignored', 0),
            'errors': errors,
        }

        # Detect if seeds are already actual seeds (--number-by-seed was used)
        # When --number-by-seed is used, the lowest failing_seed >= base_seed
        # When not used, failing_seed is an iteration index starting from 0
        all_seeds = []
        for seed_list in errors.values():
            all_seeds.extend(seed_list)
        min_seed = min(all_seeds) if all_seeds else 0

        # If the minimum seed is >= base_seed, seeds are already actual seeds
        # Otherwise they're iteration indices that need to be offset
        seeds_are_actual = base_seed is not None and min_seed >= base_seed

        # Create a failure entry for each failing seed
        for error_type, seed_list in errors.items():
            for failing_seed in seed_list:
                # Calculate reproduction seed
                if seeds_are_actual:
                    # Seeds are already actual seeds (--number-by-seed was used)
                    reproduction_seed = failing_seed
                elif base_seed is not None:
                    # Seeds are iteration indices, need to add base_seed
                    reproduction_seed = base_seed + failing_seed
                else:
                    reproduction_seed = None

                all_failures.append({
                    'game_name': game_name,
                    'template': template_name,
                    'world_directory': world_dir,
                    'base_seed': base_seed,
                    'failing_seed': failing_seed,
                    'reproduction_seed': reproduction_seed,
                    'error_type': error_type,
                    'ut_fuzz': ut_fuzz_stats,
                    'default_options': default_options,
                    'disallow_options': disallow_options,
                })

    # Sort by failing_seed (lowest first)
    all_failures.sort(key=lambda x: x['failing_seed'])

    return all_failures


def load_worldgen_exclude_list(project_root, include_all_excludes=False):
    """Load the worldgen_test_exclude_list from template-exclude-list.json.

    Args:
        project_root: Path to the project root
        include_all_excludes: If True, also include exclude_list and main_test_exclude_list

    Returns a set of template names that are excluded from worldgen tests.
    """
    exclude_file = Path(project_root) / 'scripts' / 'data' / 'template-exclude-list.json'
    if not exclude_file.exists():
        return set()

    try:
        with open(exclude_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        worldgen_excludes = data.get('worldgen_test_exclude_list', [])
        result = {item['name'] for item in worldgen_excludes}

        if include_all_excludes:
            # Also include permanent excludes and main test excludes
            permanent_excludes = data.get('exclude_list', [])
            main_excludes = data.get('main_test_exclude_list', [])
            result.update({item['name'] for item in permanent_excludes})
            result.update({item['name'] for item in main_excludes})

        return result
    except Exception as e:
        print(f"Error loading worldgen exclude list: {e}", file=sys.stderr)
        return set()


def get_ut_fuzz_worldgen_pass_failures(project_root, ut_version='worldgen', worldgen_test_mode='canonical'):
    """Get games that fail UT fuzz test, excluding those in exclude lists.

    This identifies games where:
    - The game fails UT fuzz testing (logic mismatches)
    - The game is NOT in worldgen_test_exclude_list, exclude_list, or main_test_exclude_list

    Returns list of dicts with game_name, template, ut_fuzz stats.
    """
    # Load UT fuzz results and combined exclude list (worldgen + permanent + main test excludes)
    ut_fuzz_data = load_ut_fuzz_test_results(project_root, ut_version=ut_version)
    worldgen_exclude_list = load_worldgen_exclude_list(project_root, include_all_excludes=True)

    ut_results = ut_fuzz_data.get('results', {})

    failures = []

    for template_name, ut_result in ut_results.items():
        ut_fuzz = ut_result.get('ut_fuzz', {})
        world_info = ut_result.get('world_info', {})
        game_name = world_info.get('game_name', template_name.replace('.yaml', ''))

        # Skip if UT fuzz test passed
        if ut_fuzz.get('passed', False):
            continue

        # Skip if the only "failures" are timeouts (no actual logic failures)
        actual_failures = ut_fuzz.get('failure', 0)
        if actual_failures == 0:
            continue

        # Skip games that are in the worldgen exclude list
        if template_name in worldgen_exclude_list:
            continue

        # This game fails UT fuzz and is not excluded - add to failures
        failures.append({
            'game_name': game_name,
            'template': template_name,
            'world_directory': world_info.get('world_directory'),
            'ut_fuzz': {
                'total': ut_fuzz.get('total', 0),
                'success': ut_fuzz.get('success', 0),
                'failure': ut_fuzz.get('failure', 0),
                'timeout': ut_fuzz.get('timeout', 0),
                'success_rate': (ut_fuzz.get('success', 0) / ut_fuzz.get('total', 1)) * 100,
                'error_types': list(ut_fuzz.get('errors', {}).keys()),
                'error_runs': ut_fuzz.get('errors', {}),
            },
        })

    return failures


def categorize_ut_fuzz_error(error_types):
    """Categorize UT fuzz error types.

    The UT fuzz test reports error types like:
    - 'None': Logic mismatch (UT and server disagree on accessible locations)
    - Other: Python exception type

    Returns a tuple of (category, details).
    """
    if not error_types:
        return ('unknown', None)

    if 'None' in error_types:
        # Logic mismatch is the primary issue
        other_types = [t for t in error_types if t != 'None']
        if other_types:
            return ('logic_mismatch_with_errors', {
                'logic_mismatches': True,
                'exception_types': other_types
            })
        return ('logic_mismatch', None)

    # Only exception-based errors
    return ('exceptions', {'types': error_types})


def load_ut_fuzz_apworld_exclude_list(project_root):
    """Load the ut_fuzz_apworld_exclude_list from template-exclude-list.json.

    Returns a set of template names that are excluded from UT fuzz apworld tests.
    """
    exclude_file = Path(project_root) / 'scripts' / 'data' / 'template-exclude-list.json'
    if not exclude_file.exists():
        return set()

    try:
        with open(exclude_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        excludes = data.get('ut_fuzz_apworld_exclude_list', [])
        return {item['name'] for item in excludes}
    except Exception as e:
        print(f"Error loading UT fuzz apworld exclude list: {e}", file=sys.stderr)
        return set()


def get_ut_fuzz_apworld_failures(project_root, ut_version='worldgen', seed_mode='fixed'):
    """Get apworlds that fail the UT fuzz test.

    This identifies apworlds (community-built .apworld files) that fail the
    Universal Tracker fuzz test with the specified UT version.

    Args:
        project_root: Path to the project root
        ut_version: 'original' or 'worldgen' (default: 'worldgen')
        seed_mode: 'fixed' or 'random' (default: 'fixed')

    Returns:
        List of dicts with game_name, template, world_directory, download_url,
        ut_fuzz stats, and error information.
    """
    # Load apworld test results for the specified version
    ut_fuzz_data = load_ut_fuzz_test_results(
        project_root,
        ut_version=ut_version,
        seed_mode=seed_mode,
        world_source='apworlds'
    )

    # Load the exclusion list for apworld UT fuzz tests
    exclude_list = load_ut_fuzz_apworld_exclude_list(project_root)

    ut_results = ut_fuzz_data.get('results', {})
    failures = []

    for template_name, ut_result in ut_results.items():
        ut_fuzz = ut_result.get('ut_fuzz', {})
        world_info = ut_result.get('world_info', {})
        game_name = world_info.get('game_name', template_name.replace('.yaml', ''))

        # Skip if UT fuzz test passed
        if ut_fuzz.get('passed', False):
            continue

        # Skip if in the exclusion list
        if template_name in exclude_list:
            continue

        # Build failure entry
        failure_entry = {
            'game_name': game_name,
            'template': template_name,
            'world_directory': world_info.get('world_directory'),
            'apworld_download_url': world_info.get('apworld_download_url'),
            'ut_fuzz': {
                'total': ut_fuzz.get('total', 0),
                'success': ut_fuzz.get('success', 0),
                'failure': ut_fuzz.get('failure', 0),
                'timeout': ut_fuzz.get('timeout', 0),
                'ignored': ut_fuzz.get('ignored', 0),
                'success_rate': (ut_fuzz.get('success', 0) / max(ut_fuzz.get('total', 1), 1)) * 100,
                'error_types': list(ut_fuzz.get('errors', {}).keys()),
                'error_runs': ut_fuzz.get('errors', {}),
            },
        }

        # Categorize the error type
        error_category, error_details = categorize_ut_fuzz_error(
            failure_entry['ut_fuzz']['error_types']
        )
        failure_entry['error_category'] = error_category
        failure_entry['error_details'] = error_details

        failures.append(failure_entry)

    return failures


def get_spoiler_fuzz_ut_pass_failures(project_root, ut_version='worldgen', seed_mode='fixed'):
    """Get games that pass UT fuzz testing but fail spoiler fuzz testing.

    This identifies games where:
    - The game passes UT fuzz testing (the Python backend rules match the tracker)
    - But fails spoiler fuzz testing (the JavaScript frontend can't evaluate rules correctly)

    This indicates that there's likely a rule type that the world generator exports
    but the JavaScript frontend doesn't support. The Python-based Universal Tracker
    can evaluate these rules correctly, but the JavaScript ruleEngine cannot.

    Args:
        project_root: Path to the project root
        ut_version: 'original' or 'worldgen' for UT fuzz results
        seed_mode: 'fixed' or 'random' for both tests

    Returns:
        List of dicts with game_name, template, ut_fuzz stats, spoiler_fuzz stats,
        and base_seed for reproduction.
    """
    # Load both test results
    ut_fuzz_data = load_ut_fuzz_test_results(project_root, ut_version=ut_version, seed_mode=seed_mode)
    spoiler_fuzz_data = load_spoiler_fuzz_test_results(project_root, seed_mode=seed_mode)

    # Also load exclude list
    worldgen_exclude_list = load_worldgen_exclude_list(project_root, include_all_excludes=True)

    ut_results = ut_fuzz_data.get('results', {})
    spoiler_results = spoiler_fuzz_data.get('results', {})

    # Get base_seed from spoiler fuzz metadata for reproduction
    # Support both old ('seed'/'base_seed') and new ('starting_seed') metadata key names
    spoiler_metadata = spoiler_fuzz_data.get('metadata', {})
    base_seed = spoiler_metadata.get('starting_seed', spoiler_metadata.get('base_seed'))
    if base_seed is None or base_seed == "random":
        base_seed = None
        # Fall back to 'seed' field if seed_mode is 'fixed' and seed is an integer
        seed_mode = spoiler_metadata.get('seed_mode')
        seed_value = spoiler_metadata.get('seed')
        if seed_mode == 'fixed' and isinstance(seed_value, int):
            base_seed = seed_value

    failures = []

    for template_name, spoiler_result in spoiler_results.items():
        spoiler_fuzz = spoiler_result.get('spoiler_fuzz', {})
        world_info = spoiler_result.get('world_info', {})
        game_name = world_info.get('game_name', template_name.replace('.yaml', ''))

        # Skip if spoiler fuzz test passed (not what we're looking for)
        if spoiler_fuzz.get('passed', False):
            continue

        # Skip games that are in the exclude list
        if template_name in worldgen_exclude_list:
            continue

        # Check if this game passes UT fuzz testing
        ut_result = ut_results.get(template_name)
        if not ut_result:
            continue  # No UT fuzz results for this game

        ut_fuzz = ut_result.get('ut_fuzz', {})

        # Skip if UT fuzz test also failed (that's a different category of failure)
        if not ut_fuzz.get('passed', False):
            continue

        # This game passes UT fuzz but fails spoiler fuzz - exactly what we want
        spoiler_total = spoiler_fuzz.get('total', 0)
        spoiler_success = spoiler_fuzz.get('success', 0)
        spoiler_failure = spoiler_fuzz.get('test_failure', 0)
        spoiler_gen_failure = spoiler_fuzz.get('generation_failure', 0)
        spoiler_timeout = spoiler_fuzz.get('timeout', 0)
        failing_seeds = spoiler_fuzz.get('failing_seeds', {})

        failures.append({
            'game_name': game_name,
            'template': template_name,
            'world_directory': world_info.get('world_directory'),
            'base_seed': base_seed,  # For reproduction instructions
            'ut_fuzz': {
                'total': ut_fuzz.get('total', 0),
                'success': ut_fuzz.get('success', 0),
                'failure': ut_fuzz.get('failure', 0),
                'timeout': ut_fuzz.get('timeout', 0),
                'success_rate': (ut_fuzz.get('success', 0) / max(ut_fuzz.get('total', 1), 1)) * 100,
            },
            'spoiler_fuzz': {
                'total': spoiler_total,
                'success': spoiler_success,
                'test_failure': spoiler_failure,
                'generation_failure': spoiler_gen_failure,
                'timeout': spoiler_timeout,
                'success_rate': (spoiler_success / max(spoiler_total, 1)) * 100,
                'errors': spoiler_fuzz.get('errors', []),
                'failing_seeds': failing_seeds,  # Dict mapping failure type to list of seeds
            },
        })

    return failures
