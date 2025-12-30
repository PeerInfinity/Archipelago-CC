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
