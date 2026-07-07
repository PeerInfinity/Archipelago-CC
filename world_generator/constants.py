"""Constants for the world generator module."""

# Internal settings filtered out when building resolved_values
# These are structural/internal and not actual game options
INTERNAL_SETTINGS = frozenset({
    'game',
    'options',
    'world_directory',
    'assume_bidirectional_exits',
    'use_resolved_items',
})

# Settings that are part of PerGameCommonOptions - skip when generating option classes
# These are already provided by Archipelago's base options system
PER_GAME_COMMON_OPTIONS = frozenset({
    'accessibility',
    'progression_balancing',
    'exclude_locations',
    'priority_locations',
    'item_links',
    'local_items',
    'non_local_items',
    'start_hints',
    'start_location_hints',
    'start_inventory',
    'start_inventory_from_pool',
    'plando_items',
})

# Combined set of all settings to skip when generating option classes
BUILTIN_SETTINGS = INTERNAL_SETTINGS | PER_GAME_COMMON_OPTIONS

# Rule types that produce boolean expressions (as opposed to numeric values).
# Prefer the fork rule_builder's definition when available so there is a
# single source of truth; fall back to a local copy on vanilla Archipelago
# (whose rule_builder has no extra_rules module and an empty __init__).
try:
    from rule_builder import BOOLEAN_RULE_TYPES
except ImportError:
    BOOLEAN_RULE_TYPES = frozenset({
        # Reachability rules
        'CanReachEntrance', 'CanReachRegion', 'CanReachLocation', 'EntranceAccessRuleCall',
        # Item rules
        'Has', 'HasAll', 'HasAny', 'HasAllCounts', 'HasAnyCount',
        'HasFromList', 'HasFromListUnique', 'HasGroup', 'HasGroupUnique',
        # Logic rules
        'And', 'Or', 'Not',
        # Boolean constants
        'True_', 'False_',
        # Comparison and conditional (produce booleans)
        'Compare', 'Conditional',
        # Helper calls
        'HelperCall',
        # Wrapper rules
        'Filtered', 'ASTRule',
    })
