"""Rule Builder compatibility layer for this generated world.

This package makes the generated world run on BOTH:

- the fork's extended ``rule_builder`` (this repo / PeerInfinity's
  Archipelago-CC), whose ``rule_builder/__init__.py`` exports everything, and
- unmodified vanilla Archipelago (source checkouts and frozen/compiled
  installs), whose ``rule_builder/__init__.py`` is empty. There the base rule
  types come from ``rule_builder.rules`` and the fork-only rule types plus
  RuleWorldMixin come from the vendored modules next to this file, registered
  under this world's own game name via vanilla's per-game CustomRuleRegister
  mechanism.

The fork-vs-vanilla decision is made exactly once, here. All other generated
files import rule-builder names from this package unconditionally
(``from ._ext import Has, ...``).

``__init__.py``, ``extra_rules.py`` and ``world_mixin.py`` are static
templates copied verbatim from ``world_generator/ext_template/``;
``_game.py`` is generated per world and holds GAME_NAME.
"""

try:
    from rule_builder import (  # noqa: F401
        RuleWorldMixin,
        # Base classes and option filtering (also present in vanilla)
        Rule,
        OptionFilter,
        # Base rule types (also present in vanilla rule_builder.rules)
        And,
        Or,
        True_,
        False_,
        Has,
        HasAll,
        HasAny,
        HasAllCounts,
        HasAnyCount,
        HasFromList,
        HasFromListUnique,
        HasGroup,
        HasGroupUnique,
        CanReachLocation,
        CanReachRegion,
        CanReachEntrance,
        # Fork-only rule types (vendored for vanilla in .extra_rules)
        AtLeast,
        Not,
        Compare,
        Conditional,
        CountItem,
        CountFromList,
        CountGroup,
        Arithmetic,
        HelperCall,
        OptionValue,
        WeightedSum,
        BOOLEAN_RULE_TYPES,
    )
    USING_FORK_RULE_BUILDER = True
except ImportError:
    # Vanilla Archipelago: empty rule_builder/__init__.py. Pull base rules
    # from rule_builder.rules and the extras from the vendored modules.
    USING_FORK_RULE_BUILDER = False
    from rule_builder.rules import (  # noqa: F401
        Rule,
        OptionFilter,
        And,
        Or,
        True_,
        False_,
        Has,
        HasAll,
        HasAny,
        HasAllCounts,
        HasAnyCount,
        HasFromList,
        HasFromListUnique,
        HasGroup,
        HasGroupUnique,
        CanReachLocation,
        CanReachRegion,
        CanReachEntrance,
    )
    from .extra_rules import (  # noqa: F401
        AtLeast,
        Not,
        Compare,
        Conditional,
        CountItem,
        CountFromList,
        CountGroup,
        Arithmetic,
        HelperCall,
        OptionValue,
        WeightedSum,
        BOOLEAN_RULE_TYPES,
    )
    from .world_mixin import RuleWorldMixin  # noqa: F401

__all__ = [
    'USING_FORK_RULE_BUILDER',
    'RuleWorldMixin',
    'Rule',
    'OptionFilter',
    'And',
    'Or',
    'True_',
    'False_',
    'Has',
    'HasAll',
    'HasAny',
    'HasAllCounts',
    'HasAnyCount',
    'HasFromList',
    'HasFromListUnique',
    'HasGroup',
    'HasGroupUnique',
    'CanReachLocation',
    'CanReachRegion',
    'CanReachEntrance',
    'AtLeast',
    'Not',
    'Compare',
    'Conditional',
    'CountItem',
    'CountFromList',
    'CountGroup',
    'Arithmetic',
    'HelperCall',
    'OptionValue',
    'WeightedSum',
    'BOOLEAN_RULE_TYPES',
]
