from typing import Optional, Dict
from BaseClasses import ItemClassification, Item

base_math_proof_item_id = 200100000


class MathProofItem(Item):
    def __init__(self, name: str, classification: ItemClassification, code: Optional[int], player: int):
        super().__init__(name, classification, code, player)


class ItemData:
    def __init__(self, id: int, classification: ItemClassification, display_name: str = None):
        self.classification = classification
        self.id = None if id is None else id
        self.table_index = id
        self.display_name = display_name


item_table: Dict[str, ItemData] = {
    # Definitions
    "df-2": ItemData(200100001, ItemClassification.progression, "Definition of 2"),
    "df-3": ItemData(200100002, ItemClassification.progression, "Definition of 3"),
    "df-4": ItemData(200100003, ItemClassification.progression, "Definition of 4"),
    
    # Axioms
    "ax-1cn": ItemData(200100004, ItemClassification.progression, "1 is Complex"),
    
    # Theorems
    "2cn": ItemData(200100005, ItemClassification.progression, "2 is Complex"),
    "oveq2i": ItemData(200100006, ItemClassification.progression, "Operation Equality 2 Inference"),
    "oveq1i": ItemData(200100007, ItemClassification.progression, "Operation Equality 1 Inference"),
    "addassi": ItemData(200100008, ItemClassification.progression, "Addition Associativity Inference"),
    "3eqtri": ItemData(200100009, ItemClassification.progression, "3-Way Equality Transitive Inference"),
    "eqtr4i": ItemData(200100010, ItemClassification.progression, "Equality Transitive 4 Inference"),
    
    # Victory Event
    "Victory": ItemData(None, ItemClassification.progression, "Victory"),
}

# Create reverse mapping for lookup
item_id_to_name: Dict[int, str] = {data.id: name for name, data in item_table.items() if data.id is not None}