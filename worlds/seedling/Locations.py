from typing import Dict, NamedTuple, Optional

from BaseClasses import Location, MultiWorld


class SeedlingLocation(Location):
    game = "Seedling"


class SeedlingLocationData(NamedTuple):
    region: str
    address: Optional[int] = None
    is_boss: bool = False


offset = 20000000

location_data_table: Dict[str, SeedlingLocationData] = {
    "Penguin's Feather": SeedlingLocationData(
        region="Overworld", address=0 + offset, is_boss=False
    ),
    "Dark Sword": SeedlingLocationData(
        region="Overworld", address=1 + offset, is_boss=False
    ),
    "Chest (Spawn House)": SeedlingLocationData(
        region="Overworld", address=2 + offset, is_boss=False
    ),
    "Chest (Waterfall)": SeedlingLocationData(
        region="Overworld", address=3 + offset, is_boss=False
    ),
    "Chest (Adnan's cave)": SeedlingLocationData(
        region="Overworld", address=4 + offset, is_boss=False
    ),
    "Chest (South Rocks)": SeedlingLocationData(
        region="Overworld", address=5 + offset, is_boss=False
    ),
    "Sword": SeedlingLocationData(
        region="Owl's Nest", address=6 + offset, is_boss=False
    ),
    "Chest (Owl's Nest)": SeedlingLocationData(
        region="Owl's Nest", address=7 + offset, is_boss=False
    ),
    "Owl": SeedlingLocationData(region="Owl's Nest", address=8 + offset, is_boss=True),
    "Shield": SeedlingLocationData(
        region="Gundernourd", address=9 + offset, is_boss=False
    ),
    "Red Key": SeedlingLocationData(
        region="Gundernourd", address=10 + offset, is_boss=False
    ),
    "Chest (Gundernourd Water)": SeedlingLocationData(
        region="Gundernourd", address=11 + offset, is_boss=False
    ),
    "Chest (Gundernourd Pit)": SeedlingLocationData(
        region="Gundernourd", address=12 + offset, is_boss=False
    ),
    "Shieldspire": SeedlingLocationData(
        region="Gundernourd", address=13 + offset, is_boss=True
    ),
    "Light": SeedlingLocationData(region="Rostef", address=14 + offset, is_boss=False),
    "Green Key": SeedlingLocationData(
        region="Rostef", address=15 + offset, is_boss=False
    ),
    "Fire": SeedlingLocationData(region="Rostef", address=16 + offset, is_boss=False),
    "Chest (Rostef)": SeedlingLocationData(
        region="Rostef", address=17 + offset, is_boss=False
    ),
    "Times": SeedlingLocationData(region="Rostef", address=18 + offset, is_boss=True),
    "Conch": SeedlingLocationData(region="Trohn", address=19 + offset, is_boss=False),
    "Blue Key": SeedlingLocationData(
        region="Trohn", address=20 + offset, is_boss=False
    ),
    "Chest (Trohn Inside)": SeedlingLocationData(
        region="Trohn", address=21 + offset, is_boss=False
    ),
    "Chest (Trohn Outside)": SeedlingLocationData(
        region="Trohn", address=22 + offset, is_boss=False
    ),
    "Tentacled Beast": SeedlingLocationData(
        region="Trohn", address=23 + offset, is_boss=True
    ),
    "Totem Shard (Three Blocks Puzzle)": SeedlingLocationData(
        region="Lacste", address=24 + offset, is_boss=False
    ),
    "Totem Shard (Main Room Left)": SeedlingLocationData(
        region="Lacste", address=25 + offset, is_boss=False
    ),
    "Totem Shard (Mortar)": SeedlingLocationData(
        region="Lacste", address=26 + offset, is_boss=False
    ),
    "Totem Shard (One Moving Block Puzzle)": SeedlingLocationData(
        region="Lacste", address=27 + offset, is_boss=False
    ),
    "Totem Shard (Two Moving Blocks Puzzle)": SeedlingLocationData(
        region="Lacste", address=28 + offset, is_boss=False
    ),
    "Purple Key": SeedlingLocationData(
        region="Lacste", address=29 + offset, is_boss=False
    ),
    "Wand": SeedlingLocationData(region="Lacste", address=30 + offset, is_boss=False),
    "Chest (Lacste Entrance)": SeedlingLocationData(
        region="Lacste", address=31 + offset, is_boss=False
    ),
    "Chest (Lacste Main Room)": SeedlingLocationData(
        region="Lacste", address=32 + offset, is_boss=False
    ),
    "Totem of Lacste": SeedlingLocationData(
        region="Lacste", address=33 + offset, is_boss=True
    ),
    "Ghost Spear": SeedlingLocationData(
        region="Woshad", address=34 + offset, is_boss=False
    ),
    "Yellow Key": SeedlingLocationData(
        region="Woshad", address=35 + offset, is_boss=False
    ),
    "Health": SeedlingLocationData(region="Woshad", address=36 + offset, is_boss=False),
    "Chest (Woshad)": SeedlingLocationData(
        region="Woshad", address=37 + offset, is_boss=False
    ),
    "Lights": SeedlingLocationData(region="Woshad", address=38 + offset, is_boss=True),
    "Dark Shield": SeedlingLocationData(
        region="Bosiniad", address=39 + offset, is_boss=False
    ),
    "Dark Suit": SeedlingLocationData(
        region="Bosiniad", address=40 + offset, is_boss=False
    ),
    "Chest (Bosiniad Main Room)": SeedlingLocationData(
        region="Bosiniad", address=41 + offset, is_boss=False
    ),
    "Chest (Bosiniad Lava)": SeedlingLocationData(
        region="Bosiniad", address=42 + offset, is_boss=False
    ),
    "King of Fire": SeedlingLocationData(
        region="Bosiniad", address=43 + offset, is_boss=True
    ),
    "Ghost Sword": SeedlingLocationData(
        region="Ghethis", address=44 + offset, is_boss=False
    ),
    "Fire Wand": SeedlingLocationData(
        region="Ghethis", address=45 + offset, is_boss=False
    ),
    "Chest (Ghethis)": SeedlingLocationData(
        region="Ghethis", address=46 + offset, is_boss=False
    ),
}

location_table = {
    name: data.address
    for name, data in location_data_table.items()
    if data.address is not None
}
