from dataclasses import dataclass
from Options import Range, TextChoice, Toggle, PerGameCommonOptions, OptionGroup


class GraphFileSelection(TextChoice):
    """
    The dependency graph to use. Select from bundled examples or enter a file path
    to a custom graph file. Supported formats: JSON, DOT (.dot/.gv), CSV.
    """
    display_name = "Graph File"

    option_tech_tree = 0
    option_skill_tree = 1
    option_recipe_chain = 2

    default = 0


class VanillaPlacement(Toggle):
    """
    If enabled, items will be placed in their original locations (nodes will be
    at their corresponding graph locations) without any randomization.
    """
    display_name = "Vanilla Item Placement"
    default = False


class RandomizeItems(Toggle):
    """
    Enable item randomization. When disabled, all items will remain in their original locations.
    """
    display_name = "Randomize Items"
    default = True


class RandomizeStartingNodes(Toggle):
    """
    Controls how starting nodes are selected when starting_nodes is above 0%.
    Off: Starting nodes are the first N nodes in topological order (easier)
    On: Starting nodes are randomly selected from throughout the graph (harder)
    Has no effect when starting_nodes is 0%.
    """
    display_name = "Randomize Starting Nodes"
    default = True


class StartingNodes(Range):
    """
    Percentage of graph nodes that are pre-unlocked at the start.
    Higher values make the graph easier to complete.
    """
    display_name = "Starting Nodes %"
    range_start = 0
    range_end = 50
    default = 0


@dataclass
class DepGraphOptions(PerGameCommonOptions):
    graph_file: GraphFileSelection
    vanilla_placement: VanillaPlacement
    randomize_items: RandomizeItems
    randomize_starting_nodes: RandomizeStartingNodes
    starting_nodes: StartingNodes


depgraph_option_groups = [
    OptionGroup("Graph Settings", [
        GraphFileSelection,
        VanillaPlacement,
        RandomizeItems,
        RandomizeStartingNodes,
        StartingNodes,
    ])
]
