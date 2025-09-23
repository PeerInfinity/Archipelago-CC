import typing
from BaseClasses import Item, ItemClassification
from typing import Optional

class ItemData(typing.NamedTuple):
    code: typing.Optional[int]
    classification: ItemClassification

class MetamathItem(Item):
    game: str = "Metamath"

    def __init__(self, name: str, classification: ItemClassification, code: Optional[int], player: int):
        self.name = name
        self.classification = classification
        self.player = player
        self.code = code
        self.location = None

def generate_item_table(max_statements: int = 1000):
    item_table = {}

    # Each statement becomes an item that can be used in proofs
    for i in range(1, max_statements + 1):
        item_table[f"Statement {i}"] = ItemData(
            234790000 + (i - 1),
            ItemClassification.progression
        )

    # Add some filler items (similar to jigsaw's encouragements)
    hints = [
        "Proof Hint", "Logic Guide", "Axiom Reference", "Lemma Note",
        "Theorem Insight", "Deduction Tip", "Inference Help", "QED Moment"
    ]

    for i, hint in enumerate(hints):
        item_id = 234791999 - i
        item_table[hint] = ItemData(item_id, ItemClassification.filler)

    return item_table

# Default item table (will be overridden when proof is loaded)
item_table = generate_item_table(100)

item_groups = {
    "Statements": [f"Statement {i}" for i in range(1, 101)],
    "Hints": ["Proof Hint", "Logic Guide", "Axiom Reference", "Lemma Note",
              "Theorem Insight", "Deduction Tip", "Inference Help", "QED Moment"]
}