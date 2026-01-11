"""
Rule Builder - Declarative rule definition system.

This module provides a declarative API for defining game logic rules,
based on PR #5048 (https://github.com/ArchipelagoMW/Archipelago/pull/5048).

Usage:
    from rule_builder import Has, HasAll, HasAny, And, Or

    # Simple item check
    rule = Has("Sword")

    # Composite rules using operators
    rule = Has("Sword") & Has("Shield")  # AND
    rule = Has("Sword") | Has("Bow")     # OR

    # Multiple items
    rule = HasAll(["Key1", "Key2", "Key3"])
    rule = HasAny(["Sword", "Axe", "Bow"])

    # Reachability
    rule = CanReachRegion("Castle") & Has("Castle Key")

    # Serialization
    rule_dict = rule.to_dict()
    rule = Rule.from_dict(rule_dict)

See docs/json/developer/guides/format-converter.md for format details.
"""

from .rules import (
    # World mixin
    RuleWorldMixin,
    # Option filtering
    OptionFilter,
    # Base classes
    CustomRuleRegister,
    Rule,
    NestedRule,
    WrapperRule,
    # Boolean rules
    True_,
    False_,
    # Composite rules
    And,
    Or,
    Filtered,
    # Item rules
    Has,
    HasAll,
    HasAny,
    HasAllCounts,
    HasAnyCount,
    HasFromList,
    HasFromListUnique,
    HasGroup,
    HasGroupUnique,
    # Reachability rules
    CanReachLocation,
    CanReachRegion,
    CanReachEntrance,
    # AST format support
    ASTRule,
    Not,
    CountItem,
    Compare,
    Arithmetic,
    MinValue,
    MaxValue,
    Conditional,
    HelperCall,
    WeightedSum,
    OptionValue,
)

from .ast_format import (
    is_ast_format,
    parse_ast_rule,
)

from .pathfinding import (
    # Core pathfinding
    PathExistsToRegion,
    find_paths_to_region,
    # Hypothetical state
    HypotheticalState,
    create_hypothetical_state,
    # Region properties
    RegionProperty,
    ALTTP_REGION_PROPERTIES,
    check_region_property,
    # Entrance chain conditions
    EntranceChainCondition,
    # ALttP-specific helpers
    BunnyAccessibilityCheck,
    can_reach_via_bunny_path,
)

__all__ = [
    # World mixin
    'RuleWorldMixin',
    # Option filtering
    'OptionFilter',
    # Base classes
    'CustomRuleRegister',
    'Rule',
    'NestedRule',
    'WrapperRule',
    # Boolean rules
    'True_',
    'False_',
    # Composite rules
    'And',
    'Or',
    'Filtered',
    # Item rules
    'Has',
    'HasAll',
    'HasAny',
    'HasAllCounts',
    'HasAnyCount',
    'HasFromList',
    'HasFromListUnique',
    'HasGroup',
    'HasGroupUnique',
    # Reachability rules
    'CanReachLocation',
    'CanReachRegion',
    'CanReachEntrance',
    # AST format support classes
    'ASTRule',
    'Not',
    'CountItem',
    'Compare',
    'Arithmetic',
    'MinValue',
    'MaxValue',
    'Conditional',
    'HelperCall',
    'WeightedSum',
    'OptionValue',
    # AST format support functions
    'is_ast_format',
    'parse_ast_rule',
    # Pathfinding tools
    'PathExistsToRegion',
    'find_paths_to_region',
    'HypotheticalState',
    'create_hypothetical_state',
    'RegionProperty',
    'ALTTP_REGION_PROPERTIES',
    'check_region_property',
    'EntranceChainCondition',
    'BunnyAccessibilityCheck',
    'can_reach_via_bunny_path',
]
