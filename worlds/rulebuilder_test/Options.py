"""Options for the Rule Builder Test world."""

from dataclasses import dataclass

from Options import PerGameCommonOptions, Range, Toggle


class CoinGoal(Range):
    """Number of Coins required by the FromOption-driven access rule.

    Used to exercise an upstream ``FieldResolver`` (``FromOption``) count, which
    is resolved to a concrete value at export time.
    """
    display_name = "Coin Goal"
    range_start = 1
    range_end = 5
    default = 3


class HardMode(Toggle):
    """When enabled, the conditional access rule takes its harder branch.

    Used to exercise ``OptionValue`` evaluated at runtime inside a ``Conditional``.
    """
    display_name = "Hard Mode"


@dataclass
class RuleBuilderTestOptions(PerGameCommonOptions):
    coin_goal: CoinGoal
    hard_mode: HardMode
