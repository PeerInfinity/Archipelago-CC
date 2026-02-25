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

FILLER_ITEMS = [
    "Proof Hint", "Logic Guide", "Axiom Reference", "Lemma Note",
    "Theorem Insight", "Deduction Tip", "Inference Help", "QED Moment"
]


def _add_filler_items(table):
    """Add filler/hint items to an item table."""
    for i, hint in enumerate(FILLER_ITEMS):
        item_id = 234791999 - i
        table[hint] = ItemData(item_id, ItemClassification.filler)


def statement_item_name(label, expression, max_expr_length=60):
    """Build a meaningful item name from a proof statement's label and expression."""
    if label:
        expr = expression
        if len(expr) > max_expr_length:
            expr = expr[:max_expr_length - 3] + "..."
        return f"{label}: {expr}"
    return expression


def generate_item_table(max_statements: int = 1000):
    """Generate a generic item table with numbered names (for class-level registration)."""
    item_table = {}

    # Each statement becomes an item that can be used in proofs
    for i in range(1, max_statements + 1):
        item_table[f"Statement {i}"] = ItemData(
            234790000 + (i - 1),
            ItemClassification.progression
        )

    _add_filler_items(item_table)
    return item_table


def generate_item_table_from_proof(proof_structure):
    """Generate an item table with meaningful names from a proof structure.

    Each item is named after its metamath label and expression,
    e.g. "df-2: |- 2 = ( 1 + 1 )" instead of "Statement 4".
    """
    item_table = {}

    for index, stmt in sorted(proof_structure.statements.items()):
        name = statement_item_name(stmt.label, stmt.expression)
        item_table[name] = ItemData(
            234790000 + (index - 1),
            ItemClassification.progression
        )

    _add_filler_items(item_table)
    return item_table


# Default item table (will be overridden when proof is loaded)
item_table = generate_item_table(100)

item_groups = {
    "Statements": [f"Statement {i}" for i in range(1, 101)],
    "Hints": list(FILLER_ITEMS)
}