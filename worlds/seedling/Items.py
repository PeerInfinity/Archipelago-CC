from typing import NamedTuple, Optional

from BaseClasses import Item, ItemClassification, MultiWorld


class SeedlingItem(Item):
    game = "Seedling"


class SeedlingItemData(NamedTuple):
    code: Optional[int] = None
    type: ItemClassification = ItemClassification.progression


offset = 20000000


item_data_table: dict[str, SeedlingItemData] = {
    "Progressive Sword": SeedlingItemData(
        code=0 + offset, type=ItemClassification.progression
    ),
    "Progressive Shield": SeedlingItemData(
        code=1 + offset, type=ItemClassification.progression
    ),
    "Red Key": SeedlingItemData(code=2 + offset, type=ItemClassification.progression),
    "Light": SeedlingItemData(code=3 + offset, type=ItemClassification.filler),
    "Green Key": SeedlingItemData(code=4 + offset, type=ItemClassification.progression),
    "Fire": SeedlingItemData(code=5 + offset, type=ItemClassification.progression),
    "Progressive Swim": SeedlingItemData(
        code=6 + offset, type=ItemClassification.progression
    ),
    "Blue Key": SeedlingItemData(code=7 + offset, type=ItemClassification.progression),
    "Totem Shard": SeedlingItemData(
        code=8 + offset, type=ItemClassification.progression
    ),
    "Purple Key": SeedlingItemData(
        code=9 + offset, type=ItemClassification.progression
    ),
    "Wand": SeedlingItemData(code=10 + offset, type=ItemClassification.progression),
    "Ghost Spear": SeedlingItemData(
        code=11 + offset, type=ItemClassification.progression
    ),
    "Yellow Key": SeedlingItemData(
        code=12 + offset, type=ItemClassification.progression
    ),
    "Health": SeedlingItemData(code=13 + offset, type=ItemClassification.progression),
    "Dark Suit": SeedlingItemData(
        code=14 + offset, type=ItemClassification.progression
    ),
    "Ghost Sword Fusion": SeedlingItemData(
        code=15 + offset, type=ItemClassification.progression
    ),
    "Fire Wand Fusion": SeedlingItemData(
        code=16 + offset, type=ItemClassification.progression
    ),
    "Seal": SeedlingItemData(code=17 + offset, type=ItemClassification.progression_skip_balancing),
    "Nothing": SeedlingItemData(code=18 + offset, type=ItemClassification.filler),
}

item_table = {
    name: data.code for name, data in item_data_table.items() if data.code is not None
}
