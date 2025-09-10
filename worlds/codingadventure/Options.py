from dataclasses import dataclass
from Options import Toggle, Choice, PerGameCommonOptions

class RandomizeItems(Toggle):
    """Enable item randomization. When disabled, all items will remain in their original locations."""
    display_name = "Randomize Items"
    default = True

@dataclass
class WebDevJourneyOptions(PerGameCommonOptions):
    randomize_items: RandomizeItems