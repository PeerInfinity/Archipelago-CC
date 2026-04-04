"""
Game options for APCalc.

These map directly to APCalcConfig fields in the generator.
"""

from dataclasses import dataclass
from Options import Range, Toggle, PerGameCommonOptions, OptionGroup


class NumSpheres(Range):
    """
    Number of generation spheres (including sphere 0).
    More spheres = more locations and deeper puzzle chains.
    The first 4 spheres each introduce one operation (+, -, *, /).
    """
    display_name = "Number of Spheres"
    range_start = 3
    range_end = 15
    default = 8


class OpsPerSphere(Range):
    """
    Operation buttons awarded per sphere.
    Each of the first 4 spheres introduces one new operation.
    Later spheres award duplicate operations.
    """
    display_name = "Operations Per Sphere"
    range_start = 1
    range_end = 3
    default = 1


class NumsPerSphere(Range):
    """
    Digit buttons awarded per sphere.
    More digits per sphere = longer multi-digit operands and larger numbers.
    """
    display_name = "Digits Per Sphere"
    range_start = 1
    range_end = 5
    default = 2


class TrashPerSphere(Range):
    """
    Junk items awarded per sphere.
    These are filler items that don't grant useful button presses.
    """
    display_name = "Junk Per Sphere"
    range_start = 0
    range_end = 5
    default = 1


class MaxBranches(Range):
    """
    Maximum outgoing edges per node in the graph.
    Higher values create more interconnected puzzles.
    """
    display_name = "Max Branches"
    range_start = 2
    range_end = 10
    default = 5


class RandomizeItems(Toggle):
    """
    Enable item randomization.
    When disabled, items will be placed in their original generated locations.
    """
    display_name = "Randomize Items"
    default = True


@dataclass
class APCalcOptions(PerGameCommonOptions):
    num_spheres: NumSpheres
    ops_per_sphere: OpsPerSphere
    nums_per_sphere: NumsPerSphere
    trash_per_sphere: TrashPerSphere
    max_branches: MaxBranches
    randomize_items: RandomizeItems


apcalc_option_groups = [
    OptionGroup("Generation Settings", [
        NumSpheres,
        OpsPerSphere,
        NumsPerSphere,
        TrashPerSphere,
        MaxBranches,
    ]),
    OptionGroup("Randomization", [
        RandomizeItems,
    ]),
]
