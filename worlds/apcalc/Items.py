"""
Item definitions for APCalc.

Items are calculator buttons (digits 0-9, operations +/-/*, and junk filler).
These are fixed across all seeds — the data package is the same regardless of
which puzzle is generated.
"""

from typing import Dict, Optional
from BaseClasses import ItemClassification, Item


BASE_ITEM_ID = 234810000


class APCalcItem(Item):
    """Item class for APCalc."""
    game: str = "APCalc"


class ItemData:
    """Data container for item definitions."""

    def __init__(self, item_id: Optional[int], classification: ItemClassification):
        self.id = item_id
        self.classification = classification


# Fixed item table — same for all seeds
item_table: Dict[str, ItemData] = {
    "Button: 0": ItemData(BASE_ITEM_ID + 0, ItemClassification.progression),
    "Button: 1": ItemData(BASE_ITEM_ID + 1, ItemClassification.progression),
    "Button: 2": ItemData(BASE_ITEM_ID + 2, ItemClassification.progression),
    "Button: 3": ItemData(BASE_ITEM_ID + 3, ItemClassification.progression),
    "Button: 4": ItemData(BASE_ITEM_ID + 4, ItemClassification.progression),
    "Button: 5": ItemData(BASE_ITEM_ID + 5, ItemClassification.progression),
    "Button: 6": ItemData(BASE_ITEM_ID + 6, ItemClassification.progression),
    "Button: 7": ItemData(BASE_ITEM_ID + 7, ItemClassification.progression),
    "Button: 8": ItemData(BASE_ITEM_ID + 8, ItemClassification.progression),
    "Button: 9": ItemData(BASE_ITEM_ID + 9, ItemClassification.progression),
    "Button: +": ItemData(BASE_ITEM_ID + 10, ItemClassification.progression),
    "Button: -": ItemData(BASE_ITEM_ID + 11, ItemClassification.progression),
    "Button: *": ItemData(BASE_ITEM_ID + 12, ItemClassification.progression),
    "Button: /": ItemData(BASE_ITEM_ID + 13, ItemClassification.progression),
    "Junk": ItemData(BASE_ITEM_ID + 14, ItemClassification.filler),
}

item_name_to_id: Dict[str, int] = {name: data.id for name, data in item_table.items() if data.id is not None}
