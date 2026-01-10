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


def load_ut_fuzz_test_results(project_root, ut_version='modified', seed_mode='fixed', world_source='bundled'):
    """Load the UT fuzz test results JSON file.

    Args:
        project_root: Path to the project root
        ut_version: 'original' or 'modified'
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


def get_ut_fuzz_worldgen_pass_failures(project_root, ut_version='modified', worldgen_test_mode='canonical'):
    """Get games that pass canonical worldgen test but fail UT fuzz test.

    This identifies games where:
    - The world generator successfully round-trips the rules (canonical test passes)
    - But UT fuzz testing reveals logic mismatches under random option configurations

    Returns list of dicts with game_name, template, ut_fuzz stats, and worldgen status.
    """
    # Load both result sets
    ut_fuzz_data = load_ut_fuzz_test_results(project_root, ut_version=ut_version)
    worldgen_data = load_worldgen_test_results(project_root, test_mode=worldgen_test_mode)

    ut_results = ut_fuzz_data.get('results', {})
    wg_results = worldgen_data.get('results', {})

    failures = []

    for template_name, ut_result in ut_results.items():
        ut_fuzz = ut_result.get('ut_fuzz', {})
        world_info = ut_result.get('world_info', {})
        game_name = world_info.get('game_name', template_name.replace('.yaml', ''))

        # Skip if UT fuzz test passed
        if ut_fuzz.get('passed', False):
            continue

        # Check if this game passes the canonical worldgen test
        wg_result = wg_results.get(game_name, {})
        if not wg_result:
            # Not in worldgen results - could be a different naming convention
            # Try to find by template name
            for wg_game, wg_data in wg_results.items():
                if wg_data.get('template') == template_name:
                    wg_result = wg_data
                    game_name = wg_game
                    break

        if not wg_result:
            # Game not in worldgen results, skip
            continue

        # Check if worldgen passes (all stages)
        test_world = wg_result.get('test_world', {})
        original = wg_result.get('original', {})

        # Check original spoiler test
        orig_spoiler_pass = original.get('spoiler_test', {}).get('pass_fail') == 'pass'

        # Check all worldgen stages
        world_gen_success = test_world.get('world_generation', {}).get('success', False)
        seed_gen_success = test_world.get('seed_generation', {}).get('success', False)
        wg_spoiler_pass = test_world.get('spoiler_test', {}).get('pass_fail') == 'pass'
        crossval_pass = test_world.get('cross_validation', {}).get('pass_fail') != 'fail'
        rules_comp_pass = test_world.get('rules_comparison', {}).get('pass_fail') != 'fail'

        # Overall worldgen pass
        worldgen_passes = (
            orig_spoiler_pass and
            world_gen_success and
            seed_gen_success and
            wg_spoiler_pass and
            crossval_pass and
            rules_comp_pass
        )

        if worldgen_passes:
            # This game passes worldgen but fails UT fuzz - add to failures
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
