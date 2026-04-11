from typing import List
from BaseClasses import Region, Tutorial
from worlds.AutoWorld import WebWorld, World
from .Items import SeedlingItem, item_data_table, item_table
from .Regions import region_data_table
from .Locations import SeedlingLocation, location_data_table, location_table
from .Options import seedling_options, Difficulty, Ending
from .Rules import generated_rules, has_item


class SeedlingWebWorld(WebWorld):
    theme = "grass"
    tutorials = [Tutorial(
        "Multiworld Setup Guide",
        "A guide to playing Seedling Randomizer.",
        "English",
        "multiworld_en.md",
        "multiworld/en",
        ["Madison Silver"]
    )]


class SeedlingWorld(World):
    game = "Seedling"
    option_definitions = seedling_options
    location_name_to_id = location_table
    item_name_to_id = item_table
    web = SeedlingWebWorld()

    def create_item(self, name: str) -> SeedlingItem:
        return SeedlingItem(
            name, item_data_table[name].type, item_data_table[name].code, self.player
        )

    def create_items(self) -> None:
        item_pool: List[SeedlingItem] = []
        for name, item in item_data_table.items():
            if name == "Seal":
                item_pool.extend([self.create_item(name) for _ in range(16)])
                if getattr(self.multiworld, "boss_locations")[self.player]:
                    item_pool.extend([self.create_item(name) for _ in range(7)])
            elif name == "Totem Shard":
                item_pool.extend([self.create_item(name) for _ in range(5)])
            elif name == "Nothing":
                pass
            elif name in [
                "Progressive Sword",
                "Progressive Shield",
                "Progressive Swim",
            ]:
                item_pool.extend([self.create_item(name) for _ in range(2)])
            else:
                item_pool.append(self.create_item(name))

        self.multiworld.itempool += item_pool

    def create_regions(self) -> None:
        # Create regions.
        for region_name in region_data_table.keys():
            region = Region(region_name, self.player, self.multiworld)
            self.multiworld.regions.append(region)

        # Create locations.
        for region_name, region_data in region_data_table.items():
            region = self.multiworld.get_region(region_name, self.player)
            region.add_locations(
                {
                    location_name: location_data.address
                    for location_name, location_data in location_data_table.items()
                    if location_data.region == region_name
                    and (
                        getattr(self.multiworld, "boss_locations")[self.player]
                        or not location_data.is_boss
                    )
                },
                SeedlingLocation,
            )
            region.add_exits(dict.fromkeys(region_data.connecting_regions))

    def set_rules(self) -> None:
        generated_rules(self.multiworld, self.player)

        if (
            getattr(self.multiworld, "ending")[self.player].value
            == Ending.option_bloody
        ):
            if (
                getattr(self.multiworld, "difficulty")[self.player].value
                == Difficulty.option_standard
            ):
                self.multiworld.completion_condition[self.player] = lambda state: (
                    has_item(state, self.player, "Ghost Sword")
                    and has_item(state, self.player, "Conch")
                )
            else:
                self.multiworld.completion_condition[self.player] = lambda state: (
                    has_item(state, self.player, "Ghost Sword")
                )
        else:
            self.multiworld.completion_condition[self.player] = lambda state: (
                has_item(state, self.player, "Ghost Sword")
                and has_item(state, self.player, "Conch")
                and has_item(state, self.player, "Penguin's Feather")
                and (state.item_count("Seal", self.player) >= 16)
            )

    def get_filler_item_name(self) -> str:
        return "Nothing"

    def fill_slot_data(self):
        return {
            "ending": getattr(self.multiworld, "ending")[self.player].value,
            "boss_locations": getattr(self.multiworld, "boss_locations")[
                self.player
            ].value,
            "deathlink": getattr(self.multiworld, "deathlink")[self.player].value,
            "deathlink_amnesty": getattr(self.multiworld, "deathlink_amnesty")[
                self.player
            ].value
        }
