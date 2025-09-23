import typing
from BaseClasses import Location

class LocData(typing.NamedTuple):
    id: int
    region: str

class MetamathLocation(Location):
    game: str = "Metamath"

    def __init__(self, player: int, name: str, address: typing.Optional[int],
                 dependencies: typing.List[int], parent):
        super().__init__(player, name, address, parent)
        self.dependencies = dependencies  # List of statement indices this proof step depends on

def generate_location_table(max_statements: int = 1000):
    # Each statement that can be proven becomes a location
    location_table = {}
    for i in range(1, max_statements + 1):
        location_table[f"Prove Statement {i}"] = LocData(234790000 + i, "Proof")
    return location_table

# Default location table (will be overridden when proof is loaded)
location_table = generate_location_table(100)