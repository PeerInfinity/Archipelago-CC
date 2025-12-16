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
    # CC format support
    CCRule,
    Not,
    CountItem,
    Compare,
    Arithmetic,
    Conditional,
    HelperCall,
)

from .cc_format import (
    is_cc_format,
    parse_cc_rule,
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
    # CC format support classes
    'CCRule',
    'Not',
    'CountItem',
    'Compare',
    'Arithmetic',
    'Conditional',
    'HelperCall',
    # CC format support functions
    'is_cc_format',
    'parse_cc_rule',
]
