from dataclasses import dataclass
from Options import Toggle, PerGameCommonOptions


class RandomizeItems(Toggle):
    """
    If enabled, items will be shuffled randomly across all locations.
    If disabled, items will be placed in their canonical locations following the original baking process.
    """
    display_name = "Randomize Items"
    default = True


@dataclass
class ChocolateChipCookiesOptions(PerGameCommonOptions):
    randomize_items: RandomizeItems