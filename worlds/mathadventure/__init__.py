from typing import Any, ClassVar, Dict
from BaseClasses import Item, ItemClassification, Tutorial
from worlds.AutoWorld import WebWorld, World
from .Items import item_table, MathAdventureItem
from .Locations import location_table
from .Options import MathAdventureOptions
from .Regions import create_regions
from .Rules import set_rules


class MathAdventureWeb(WebWorld):
    theme = "ocean"

    tutorials = [Tutorial(
        "Mathematical Proof Guide",
        "A guide to completing the proof that 2+2=4",
        "English",
        "guide_en.md",
        "guide/en",
        ["MathAdventureTeam"]
    )]


class MathAdventureWorld(World):
    """
    Math Adventure: Proof that 2+2=4
    
    A logical adventure through mathematical proofs where you must collect
    definitions, axioms, and theorems to prove that 2+2=4.
    Navigate through the regions of mathematical logic, gathering the
    necessary components to complete your proof.
    """
    
    game: ClassVar[str] = "Math Adventure"
    web: ClassVar[WebWorld] = MathAdventureWeb()

    options_dataclass = MathAdventureOptions
    options: MathAdventureOptions

    item_name_to_id: ClassVar[Dict[str, int]] = {
        name: data.id for name, data in item_table.items() if data.id is not None
    }

    location_name_to_id: ClassVar[Dict[str, int]] = {
        name: data.location_id for name, data in location_table.items() if data.location_id is not None
    }

    item_name_groups: ClassVar[Dict[str, frozenset]] = {
        "Everything": frozenset(["df-2", "df-3", "df-4", "ax-1cn", "2cn", "oveq2i", "oveq1i", "addassi", "3eqtri", "eqtr4i"]),
        "Event": frozenset(["Victory"]),
    }

    # Canonical item placements - where items belong in the "vanilla" game
    # Used by exporter to distinguish canonical placements from always-locked items
    canonical_placements: ClassVar[Dict[str, str]] = {
        "Definition of 2": "df-2",
        "Definition of 3": "df-3",
        "Definition of 4": "df-4",
        "1 is Complex": "ax-1cn",
        "2 is Complex": "2cn",
        "Equality Substitution Right": "oveq2i",
        "Equality Substitution Left": "oveq1i",
        "Addition Associativity": "addassi",
        "Triple Equality Transitivity": "3eqtri",
        "Final Equality": "eqtr4i",
    }

    def generate_early(self) -> None:
        # If seed is 1, disable randomization to use canonical item placements
        if self.multiworld.seed == 1:
            self.options.randomize_items.value = False
    
    def create_regions(self) -> None:
        create_regions(self.multiworld, self.player)
    
    def set_rules(self) -> None:
        set_rules(self)
    
    def create_items(self) -> None:
        """Create items for the world."""
        item_pool = []
        for name, data in item_table.items():
            if name != "Victory":  # Victory is an event, not placed in pool
                item = MathAdventureItem(name, data.classification, data.id, self.player)
                item_pool.append(item)

        self.multiworld.itempool += item_pool

    def _place_original_items(self) -> None:
        """Place items in their canonical locations when not randomized."""
        for location_name, item_name in self.canonical_placements.items():
            location = self.multiworld.get_location(location_name, self.player)
            item = self.create_item(item_name)
            location.place_locked_item(item)

            # Remove the item from the pool if it exists
            for pool_item in self.multiworld.itempool[:]:
                if pool_item.name == item_name and pool_item.player == self.player:
                    self.multiworld.itempool.remove(pool_item)
                    break
    
    def create_item(self, name: str) -> Item:
        data = item_table[name]
        return MathAdventureItem(name, data.classification, data.id, self.player)
    
    def pre_fill(self) -> None:
        """Pre-fill items if not randomizing."""
        if not self.options.randomize_items.value:
            self._place_original_items()
    
    def generate_basic(self) -> None:
        # Place Victory event at the goal location
        victory_location = self.multiworld.get_location("Theorem: 2+2=4", self.player)

        # Only place if not already filled (e.g., by _place_original_items)
        if victory_location.item is None:
            victory_item = MathAdventureItem("Victory", ItemClassification.progression, None, self.player)
            victory_location.place_locked_item(victory_item)

        # Set completion condition
        self.multiworld.completion_condition[self.player] = lambda state: state.has("Victory", self.player)
    
    def fill_slot_data(self) -> Dict[str, Any]:
        return {}