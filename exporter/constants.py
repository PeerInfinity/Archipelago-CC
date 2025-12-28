"""
Constants for the exporter module.

These constants define limits and thresholds used throughout the export process
to prevent infinite loops and runaway resource usage.
"""

# =============================================================================
# Analysis Safety Limits
# =============================================================================

# Maximum number of times analyze_rule can be called in a single export.
# This catches infinite loops where rules keep spawning new analyze_rule calls.
MAX_ANALYZE_RULE_CALLS = 10000

# Maximum number of AST node visits within a single RuleAnalyzer instance.
# This catches infinite loops within a single rule's AST traversal.
MAX_ANALYZER_OPERATIONS = 5000

# Maximum recursion depth for rule expansion (expand_rule).
# This catches circular helper references where helpers call each other.
MAX_RULE_EXPANSION_DEPTH = 100

# Maximum iterations for helper discovery in get_helper_definitions.
# Each iteration may discover new helpers that need to be processed.
MAX_HELPER_DISCOVERY_ITERATIONS = 10

# =============================================================================
# Size Limits
# =============================================================================

# Maximum size of a single expanded rule in kilobytes.
# Rules larger than this likely indicate runaway expansion.
MAX_RULE_SIZE_KB = 100

# Maximum size of total export data in megabytes.
# Checked periodically during region processing.
MAX_EXPORT_SIZE_MB = 10

# =============================================================================
# Sorting Configuration
# =============================================================================

# Keys where sorting list values is safe (order is not semantically meaningful).
# Used by sort_lists_for_consistency() to ensure deterministic JSON output.
SAFE_TO_SORT_KEYS = {
    'allowed_legendary_hunt_encounters',
    'dependencies',
    'disabled_entities',
    'enabled_filler_buffs',
    'exclude_locations',
    'goal',
    'move_rando_actions',
}

# Keys where sorting dict keys is safe (key order is not semantically meaningful).
# These are dicts where the insertion order comes from non-deterministic sources
# (e.g., set iteration in original world code) but the order has no semantic meaning.
SAFE_TO_SORT_DICT_KEYS = {
    'item_classification_overrides',
    'PARENT_ITEM_COUNT_PER_BASE_ITEM',  # The Witness
    'PROGRESSIVE_LISTS',  # The Witness
}
