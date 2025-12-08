from dataclasses import dataclass
from Options import Toggle, PerGameCommonOptions


class RandomizeItems(Toggle):
    """
    Enable item randomization. When disabled, all items will remain in their original locations.
    """
    display_name = "Randomize Items"
    default = True


@dataclass
class MathProof2p2e4Options(PerGameCommonOptions):
    randomize_items: RandomizeItems