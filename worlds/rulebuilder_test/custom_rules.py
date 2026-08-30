"""A game-specific custom rule for the Rule Builder Test world.

``HasTreasure`` is a ``rule_builder`` custom ``Rule`` subclass whose logic lives
in a compiled ``Resolved._evaluate`` (it sums three gem counts and applies integer
division — logic not expressible by the built-in rules). On export it is
auto-extracted into a frontend-evaluable helper definition by
``exporter/games/base/helper_discovery.py`` (commit ``4e0f79933``); this world is
the in-repo regression test for that feature.
"""

import dataclasses

from typing_extensions import override

from BaseClasses import CollectionState
from rule_builder.rules import Rule, TWorld


@dataclasses.dataclass()
class HasTreasure(Rule[TWorld], game="Rule Builder Test"):
    """True when the player has at least ``count`` "treasures".

    A treasure is two gems (of any colour), so the requirement is
    ``(red + blue + green) // 2 >= count`` — the integer division is what makes
    this genuinely custom rather than a ``CountFromList`` comparison.
    """

    count: int = 1

    @override
    def _instantiate(self, world: TWorld) -> "Rule.Resolved":
        return self.Resolved(
            count=self.count,
            player=world.player,
            caching_enabled=getattr(world, "rule_caching_enabled", False),
        )

    class Resolved(Rule.Resolved):
        count: int = 1

        @override
        def _evaluate(self, state: CollectionState) -> bool:
            gems = (
                state.count("Red Gem", self.player)
                + state.count("Blue Gem", self.player)
                + state.count("Green Gem", self.player)
            )
            return gems // 2 >= self.count
