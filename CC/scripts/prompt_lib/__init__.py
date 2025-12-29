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

from .prompt_generators import (
    # standard
    generate_helper_export_prompt,
    generate_exporter_simplify_prompt,
    generate_new_rule_types_prompt,
    generate_gen_errors_prompt,
    generate_basic_spoiler_debug_prompt,
    generate_multiworld_prompt,
    # worldgen
    generate_worldgen_world_failure_prompt,
    generate_worldgen_seed_failure_prompt,
    generate_worldgen_spoiler_failure_prompt,
    generate_worldgen_crossval_failure_prompt,
)

from .execution import (
    run_template_test,
    run_prompt_for_game,
    get_prompt_for_game,
    run_all_promptfiles,
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
    # prompt_generators.standard
    'generate_helper_export_prompt',
    'generate_exporter_simplify_prompt',
    'generate_new_rule_types_prompt',
    'generate_gen_errors_prompt',
    'generate_basic_spoiler_debug_prompt',
    'generate_multiworld_prompt',
    # prompt_generators.worldgen
    'generate_worldgen_world_failure_prompt',
    'generate_worldgen_seed_failure_prompt',
    'generate_worldgen_spoiler_failure_prompt',
    'generate_worldgen_crossval_failure_prompt',
    # execution
    'run_template_test',
    'run_prompt_for_game',
    'get_prompt_for_game',
    'run_all_promptfiles',
]
