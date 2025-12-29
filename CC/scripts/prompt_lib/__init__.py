"""
Prompt library for prompt-all-templates.py.

This package contains utilities for generating Claude prompts for various
game development and debugging tasks.
"""

from .data_loading import (
    load_world_mapping,
    load_prompt_exclusion_lists,
    get_test_results_path,
    load_test_results,
    extract_game_name_from_yaml,
    get_template_files,
)

from .game_info import (
    is_basic_game,
    has_custom_code,
    has_javascript_helpers,
    get_custom_code_info,
)

from .test_results import (
    get_first_failing_seed,
    is_multiworld_test_passing,
    get_multiworld_bisection_info,
    get_multiworld_failure_details,
    has_generation_errors_but_passes,
)

from .worldgen_analysis import (
    load_worldgen_test_results,
    get_worldgen_world_failures,
    get_worldgen_seed_failures,
    get_worldgen_spoiler_failures,
    get_worldgen_crossval_failures,
    categorize_world_generation_error,
    categorize_seed_generation_error,
)

__all__ = [
    # data_loading
    'load_world_mapping',
    'load_prompt_exclusion_lists',
    'get_test_results_path',
    'load_test_results',
    'extract_game_name_from_yaml',
    'get_template_files',
    # game_info
    'is_basic_game',
    'has_custom_code',
    'has_javascript_helpers',
    'get_custom_code_info',
    # test_results
    'get_first_failing_seed',
    'is_multiworld_test_passing',
    'get_multiworld_bisection_info',
    'get_multiworld_failure_details',
    'has_generation_errors_but_passes',
    # worldgen_analysis
    'load_worldgen_test_results',
    'get_worldgen_world_failures',
    'get_worldgen_seed_failures',
    'get_worldgen_spoiler_failures',
    'get_worldgen_crossval_failures',
    'categorize_world_generation_error',
    'categorize_seed_generation_error',
]
