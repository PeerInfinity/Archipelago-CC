"""
Rule Builder - Declarative rule definition system.

Based on upstream Archipelago's rule_builder (PR #5048), with the fork's
extensions re-added as overlay modules:

- ``rules``          - upstream base rule types + Has dynamic counts
- ``extra_rules``    - the fork's extended rule types (CountItem, Compare, …)
- ``world_mixin``    - RuleWorldMixin / RuleBuilderLogicMixin
- ``field_resolvers``- upstream dynamic field resolvers (FromOption, …)
- ``ast_format`` / ``ast_explain`` / ``pathfinding`` - fork tooling

Usage:
    from rule_builder import Has, HasAll, HasAny, And, Or

    rule = Has("Sword") & Has("Shield")          # AND
    rule = HasAny(["Sword", "Axe", "Bow"])       # any of
    rule = CanReachRegion("Castle") & Has("Castle Key")
    rule = Has("Coin", count=CountItem("Wallet"))  # fork dynamic count

See docs/json/developer/guides/format-converter.md for format details.
"""

from .world_mixin import (
    RuleBuilderLogicMixin,
    RuleWorldMixin,
)

from .options import OptionFilter

from .rules import (
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
    AtLeast,
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
    # Rule type registry
    DEFAULT_RULES,
)

from .extra_rules import (
    EntranceAccessRuleCall,
    ASTRule,
    Not,
    CountItem,
    CountFromList,
    CountGroup,
    Compare,
    Arithmetic,
    MinValue,
    MaxValue,
    Conditional,
    HelperCall,
    WeightedSum,
    UniqueCount,
    OptionValue,
    BOOLEAN_RULE_TYPES,
)

from .field_resolvers import (
    FieldResolver,
    FieldResolverRegister,
    resolve_field,
    FromOption,
    FromWorldAttr,
)

from .ast_format import (
    is_ast_format,
    parse_ast_rule,
)

from .pathfinding import (
    PathExistsToRegion,
    find_paths_to_region,
    HypotheticalState,
    create_hypothetical_state,
    RegionProperty,
    ALTTP_REGION_PROPERTIES,
    check_region_property,
    EntranceChainCondition,
)

__all__ = [
    # Logic and World mixins
    'RuleBuilderLogicMixin',
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
    'AtLeast',
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
    'EntranceAccessRuleCall',
    # Extended (fork) rule types
    'ASTRule',
    'Not',
    'CountItem',
    'CountFromList',
    'CountGroup',
    'Compare',
    'Arithmetic',
    'MinValue',
    'MaxValue',
    'Conditional',
    'HelperCall',
    'WeightedSum',
    'UniqueCount',
    'OptionValue',
    # Rule type collections
    'BOOLEAN_RULE_TYPES',
    'DEFAULT_RULES',
    # Field resolvers (upstream dynamic values)
    'FieldResolver',
    'FieldResolverRegister',
    'resolve_field',
    'FromOption',
    'FromWorldAttr',
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
]
