"""
Test result analysis utilities.

Functions for analyzing test results and extracting relevant information.
"""


def get_first_failing_seed(template_file, test_results):
    """Get the first failing seed number from test results.
    Returns the first_failure_seed if available, None otherwise."""
    if template_file not in test_results:
        return None

    result = test_results[template_file]

    if not isinstance(result, dict):
        return None

    # Return first_failure_seed if it exists and is non-null
    return result.get('first_failure_seed')


def is_multiworld_test_passing(template_file, test_results):
    """Check if a multiworld test is passing for a template.

    Returns True if:
    - The test passed (multiworld_test.success is True)

    Returns False if:
    - The test failed (multiworld_test.success is False)
    - The template is not in the results
    """
    if template_file not in test_results:
        return False

    result = test_results[template_file]
    if not isinstance(result, dict):
        return False

    multiworld_test = result.get('multiworld_test', {})
    return multiworld_test.get('success', False)


def get_multiworld_bisection_info(template_file, test_results):
    """Get bisection results for a failing multiworld test.

    Returns a dict with:
        - has_bisection: bool (True if bisection results exist)
        - failing_pairs: list of template filenames that fail when paired
        - tested_pairs: list of dicts with pair test details
        - templates_in_multiworld: dict mapping player numbers to template names
    """
    if template_file not in test_results:
        return {'has_bisection': False, 'failing_pairs': [], 'tested_pairs': [], 'templates_in_multiworld': {}}

    result = test_results[template_file]
    if not isinstance(result, dict):
        return {'has_bisection': False, 'failing_pairs': [], 'tested_pairs': [], 'templates_in_multiworld': {}}

    bisection_results = result.get('bisection_results', {})
    multiworld_test = result.get('multiworld_test', {})

    return {
        'has_bisection': bisection_results.get('triggered', False),
        'failing_pairs': bisection_results.get('failing_pairs', []),
        'tested_pairs': bisection_results.get('tested_pairs', []),
        'templates_in_multiworld': multiworld_test.get('templates_in_multiworld', {})
    }


def get_multiworld_failure_details(template_file, test_results):
    """Get details about why a multiworld test failed.

    Returns a dict with:
        - player_number: which player number this template was tested as
        - player_results: results for each player tested
        - first_failure_player: which player failed first (if any)
        - generation_success: whether generation succeeded
        - intermittent_failures: list of intermittent failures (tests that failed initially but passed on retry)
    """
    if template_file not in test_results:
        return None

    result = test_results[template_file]
    if not isinstance(result, dict):
        return None

    multiworld_test = result.get('multiworld_test', {})
    generation = result.get('generation', {})

    return {
        'player_number': multiworld_test.get('player_number'),
        'player_results': multiworld_test.get('player_results', {}),
        'first_failure_player': multiworld_test.get('first_failure_player'),
        'generation_success': generation.get('success', False),
        'templates_in_multiworld': multiworld_test.get('templates_in_multiworld', {}),
        'intermittent_failures': multiworld_test.get('intermittent_failures', [])
    }


def has_generation_errors_but_passes(template_file, test_results):
    """Check if a template passes spoiler tests but has generation errors.

    Returns a tuple of (has_errors, error_count) where:
    - has_errors: True if the game passes but has generation errors
    - error_count: Number of generation errors (0 if no errors or test fails)
    """
    if template_file not in test_results:
        return (False, 0)

    result = test_results[template_file]
    if not isinstance(result, dict):
        return (False, 0)

    # Check if spoiler test passed
    spoiler_test = result.get('spoiler_test', {})
    if spoiler_test.get('pass_fail') != 'passed':
        return (False, 0)

    # Check for generation errors
    generation = result.get('generation', {})
    error_count = generation.get('error_count', 0)

    if error_count > 0:
        return (True, error_count)

    return (False, 0)


def get_generation_failure_info(template_file, test_results):
    """Check if generation completely failed for a template.

    Returns a dict with:
    - failed: True if generation failed (success=False)
    - return_code: The return code from generation (e.g., 102)
    - error_count: Number of errors during generation
    - error_type: Type of error if available
    """
    if template_file not in test_results:
        return {'failed': False, 'return_code': None, 'error_count': 0, 'error_type': None}

    result = test_results[template_file]
    if not isinstance(result, dict):
        return {'failed': False, 'return_code': None, 'error_count': 0, 'error_type': None}

    generation = result.get('generation', {})

    # Check if generation failed
    if generation.get('success') is False:
        return {
            'failed': True,
            'return_code': generation.get('return_code'),
            'error_count': generation.get('error_count', 0),
            'error_type': generation.get('error_type'),
        }

    return {'failed': False, 'return_code': None, 'error_count': 0, 'error_type': None}
