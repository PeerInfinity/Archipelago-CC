"""
Prompt generator functions for various debugging and development tasks.
"""

from .standard import (
    generate_helper_export_prompt,
    generate_exporter_simplify_prompt,
    generate_new_rule_types_prompt,
    generate_gen_errors_prompt,
    generate_basic_spoiler_debug_prompt,
    generate_multiworld_prompt,
    generate_generation_failure_prompt,
)

from .worldgen import (
    generate_worldgen_world_failure_prompt,
    generate_worldgen_seed_failure_prompt,
    generate_worldgen_spoiler_failure_prompt,
    generate_worldgen_crossval_failure_prompt,
    generate_worldgen_rules_comp_failure_prompt,
)

__all__ = [
    # standard
    'generate_helper_export_prompt',
    'generate_exporter_simplify_prompt',
    'generate_new_rule_types_prompt',
    'generate_gen_errors_prompt',
    'generate_basic_spoiler_debug_prompt',
    'generate_multiworld_prompt',
    'generate_generation_failure_prompt',
    # worldgen
    'generate_worldgen_world_failure_prompt',
    'generate_worldgen_seed_failure_prompt',
    'generate_worldgen_spoiler_failure_prompt',
    'generate_worldgen_crossval_failure_prompt',
    'generate_worldgen_rules_comp_failure_prompt',
]
