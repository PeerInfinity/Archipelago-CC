from typing import Dict, List, NamedTuple


class SeedlingRegionData(NamedTuple):
    connecting_regions: List[str] = []


region_data_table: Dict[str, SeedlingRegionData] = {
    "Menu": SeedlingRegionData(["Overworld"]),
    "Overworld": SeedlingRegionData(
        [
            "Owl's Nest",
            "Gundernourd",
            "Rostef",
            "Trohn",
            "Lacste",
            "Woshad",
            "Bosiniad",
            "Ghethis",
        ]
    ),
    "Owl's Nest": SeedlingRegionData(),
    "Gundernourd": SeedlingRegionData(),
    "Rostef": SeedlingRegionData(),
    "Trohn": SeedlingRegionData(),
    "Lacste": SeedlingRegionData(),
    "Woshad": SeedlingRegionData(),
    "Bosiniad": SeedlingRegionData(),
    "Ghethis": SeedlingRegionData(),
}
