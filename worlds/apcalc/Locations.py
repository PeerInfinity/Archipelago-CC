"""
Location definitions for APCalc.

Locations are pre-allocated with generic names ("Check 1" through "Check N")
and fixed IDs. At runtime, only the locations needed for the generated puzzle
are created. The name_substitutions mechanism maps generic names to meaningful
display names (e.g., "Check 1" -> "Reach 7").

Follows the same pattern as MetaMath and DepGraph.
"""

from typing import Dict
from BaseClasses import Location


BASE_LOCATION_ID = 234810100  # offset from item IDs
MAX_LOCATIONS = 500


class APCalcLocation(Location):
    """Location class for APCalc."""
    game: str = "APCalc"


def generic_location_name(index: int) -> str:
    """Get the generic location name for a node index (1-based)."""
    return f"Check {index}"


def generic_region_name(index: int) -> str:
    """Get the generic region name for a node index (1-based).

    Uses 'Region N' prefix to avoid collisions with meaningful names like 'Node 7'
    when name_substitutions are applied by the world generator.
    """
    return f"Region {index}"


def meaningful_location_name(value: int, layer: int) -> str:
    """Get the meaningful display name for a location."""
    if layer == 0:
        return f"Reach {value}"
    return f"Reach {value} L{layer}"


def meaningful_region_name(value: int, layer: int) -> str:
    """Get the meaningful display name for a region."""
    if layer == 0:
        return f"Node {value}"
    return f"Node {value} L{layer}"


# Pre-allocated location name -> ID mapping (class-level constant)
location_name_to_id: Dict[str, int] = {
    generic_location_name(i): BASE_LOCATION_ID + i
    for i in range(1, MAX_LOCATIONS + 1)
}
