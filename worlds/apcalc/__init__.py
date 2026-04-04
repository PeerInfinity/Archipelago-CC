"""
APCalc — A calculator-themed puzzle game for Archipelago.

Collect number and operation buttons as items, then budget your presses
to navigate a graph of target numbers. Each seed procedurally generates
a different puzzle.
"""

from collections import Counter
from typing import Any, Dict, List, Set

from BaseClasses import ItemClassification, Region, Tutorial
from worlds.AutoWorld import WebWorld, World
from rule_builder import RuleWorldMixin, Has, And, Or

from .Items import APCalcItem, item_table, item_name_to_id
from .Locations import (
    APCalcLocation, location_name_to_id, MAX_LOCATIONS,
    generic_location_name, generic_region_name,
    meaningful_location_name, meaningful_region_name,
)
from .Options import APCalcOptions, apcalc_option_groups
from .generator import APCalcConfig, generate, Node, Edge
from .generator.generator import TRASH_ITEM


class APCalcWeb(WebWorld):
    game_info_languages = ['en']
    tutorials = [Tutorial(
        "APCalc Setup Guide",
        "A guide to setting up APCalc for MultiWorld.",
        "English",
        "setup_en.md",
        "setup/en",
        ["PeerInfinity"],
    )]
    option_groups = apcalc_option_groups


class APCalcWorld(RuleWorldMixin, World):
    """
    APCalc is a calculator-themed puzzle game. Collect number and operation
    buttons, then budget your presses to navigate a graph of target numbers.
    Every seed generates a different puzzle.
    """

    game: str = "APCalc"
    options_dataclass = APCalcOptions
    options: APCalcOptions
    web = APCalcWeb()
    rule_caching_enabled = False

    item_name_to_id = item_name_to_id
    location_name_to_id = location_name_to_id

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.generated_nodes: List[Node] = []
        self.generated_edges: List[Edge] = []
        self.starting_buttons: Dict[str, int] = {}
        self.node_count: int = 0
        # Maps: node_index (0-based) -> 1-based generic index
        self._node_to_generic: Dict[int, int] = {}

    def generate_early(self):
        """Run the APCalc generator to build the puzzle graph."""
        config = APCalcConfig(
            num_spheres=self.options.num_spheres.value,
            ops_per_sphere=self.options.ops_per_sphere.value,
            nums_per_sphere=self.options.nums_per_sphere.value,
            trash_per_sphere=self.options.trash_per_sphere.value,
            max_branches=self.options.max_branches.value,
            seed=int(self.multiworld.seed or 0),
        )

        game_data = generate(config)

        self.generated_nodes = game_data['nodes']
        self.generated_edges = game_data['edges']
        self.starting_buttons = game_data['starting_buttons']
        self.node_count = len(self.generated_nodes)

        if self.node_count > MAX_LOCATIONS:
            raise RuntimeError(
                f"APCalc generated {self.node_count} nodes but max is {MAX_LOCATIONS}. "
                f"Reduce num_spheres or items per sphere."
            )

        # Normalize empty items to trash
        for node in self.generated_nodes:
            if not node.item:
                node.item = TRASH_ITEM

        # Build index mapping: node.index -> 1-based generic index
        for i, node in enumerate(self.generated_nodes):
            self._node_to_generic[node.index] = i + 1

        # Build name substitutions for display
        self.name_substitutions = {"items": {}, "locations": {}, "regions": {}}
        for node in self.generated_nodes:
            gi = self._node_to_generic[node.index]
            gen_loc = generic_location_name(gi)
            gen_reg = generic_region_name(gi)
            real_loc = meaningful_location_name(node.value, node.layer)
            real_reg = meaningful_region_name(node.value, node.layer)

            if gen_loc != real_loc:
                self.name_substitutions["locations"][gen_loc] = real_loc
            if gen_reg != real_reg:
                self.name_substitutions["regions"][gen_reg] = real_reg

        # Build canonical placements (for non-randomized mode)
        self.canonical_placements: Dict[str, str] = {}
        for node in self.generated_nodes:
            gi = self._node_to_generic[node.index]
            loc_name = generic_location_name(gi)
            if node.item == TRASH_ITEM:
                self.canonical_placements[loc_name] = "Junk"
            else:
                self.canonical_placements[loc_name] = f"Button: {node.item}"

    def create_regions(self):
        """Build regions and entrances from the generated graph."""
        # Menu region (start)
        menu_region = Region("Menu", self.player, self.multiworld)

        # Build index for edges by source
        edges_by_source: Dict[int | None, List[Edge]] = {}
        for edge in self.generated_edges:
            edges_by_source.setdefault(edge.source_index, []).append(edge)

        # Create a region per node
        node_regions: Dict[int, Region] = {}
        for node in self.generated_nodes:
            gi = self._node_to_generic[node.index]
            region_name = generic_region_name(gi)
            region = Region(region_name, self.player, self.multiworld)

            # Main location (randomizable)
            loc_name = generic_location_name(gi)
            location = APCalcLocation(
                self.player,
                loc_name,
                self.location_name_to_id[loc_name],
                region,
            )
            region.locations.append(location)

            # Event location (checked flag)
            event_name = f"Checked {gi}"
            event_loc = APCalcLocation(
                self.player,
                event_name,
                None,
                region,
            )
            event_item = APCalcItem(
                event_name,
                ItemClassification.progression,
                None,
                self.player,
            )
            event_loc.place_locked_item(event_item)
            region.locations.append(event_loc)

            node_regions[node.index] = region

        # Connect Menu -> layer 0 nodes
        for edge in edges_by_source.get(None, []):
            target_region = node_regions[edge.target_index]
            menu_region.connect(
                target_region,
                f"Menu to {target_region.name}",
            )

        # Connect node -> node edges
        # Group by (source, target) to merge parallel edges
        edge_groups: Dict[tuple, List[Edge]] = {}
        for edge in self.generated_edges:
            if edge.source_index is not None:
                key = (edge.source_index, edge.target_index)
                edge_groups.setdefault(key, []).append(edge)

        for (src_idx, tgt_idx), edges in edge_groups.items():
            src_region = node_regions[src_idx]
            tgt_region = node_regions[tgt_idx]
            src_region.connect(
                tgt_region,
                f"{src_region.name} to {tgt_region.name}",
            )

        # Victory event in Menu region
        victory_loc = APCalcLocation(
            self.player,
            "Victory",
            None,
            menu_region,
        )
        victory_item = APCalcItem(
            "Victory",
            ItemClassification.progression,
            None,
            self.player,
        )
        victory_loc.place_locked_item(victory_item)
        menu_region.locations.append(victory_loc)

        # Register all regions
        self.multiworld.regions.append(menu_region)
        self.multiworld.regions.extend(node_regions.values())

    def create_items(self):
        """Build the item pool from generated data."""
        if not self.options.randomize_items.value:
            return

        # Count items to place (one per non-event location)
        pool_counts: Counter = Counter()
        for node in self.generated_nodes:
            if node.item == TRASH_ITEM:
                pool_counts["Junk"] += 1
            else:
                pool_counts[f"Button: {node.item}"] += 1

        items = []
        for item_name, count in pool_counts.items():
            item_data = item_table[item_name]
            for _ in range(count):
                items.append(APCalcItem(
                    item_name,
                    item_data.classification,
                    item_data.id,
                    self.player,
                ))

        self.multiworld.itempool += items

    def set_rules(self):
        """Set access rules on entrances based on generated path costs."""
        edges_by_source: Dict[int | None, List[Edge]] = {}
        for edge in self.generated_edges:
            edges_by_source.setdefault(edge.source_index, []).append(edge)

        # Menu -> layer 0 entrance rules
        for edge in edges_by_source.get(None, []):
            tgt_gi = self._node_to_generic[edge.target_index]
            tgt_region = generic_region_name(tgt_gi)
            entrance_name = f"Menu to {tgt_region}"
            rule = self._path_costs_to_rule(edge.path_costs)
            entrance = self.multiworld.get_entrance(entrance_name, self.player)
            self.set_rule(entrance, rule)

        # Node -> node entrance rules
        # Group by (source, target) and merge all path costs
        edge_groups: Dict[tuple, List[Counter]] = {}
        for edge in self.generated_edges:
            if edge.source_index is not None:
                key = (edge.source_index, edge.target_index)
                if key not in edge_groups:
                    edge_groups[key] = []
                edge_groups[key].extend(edge.path_costs)

        for (src_idx, tgt_idx), all_costs in edge_groups.items():
            src_gi = self._node_to_generic[src_idx]
            tgt_gi = self._node_to_generic[tgt_idx]
            entrance_name = f"{generic_region_name(src_gi)} to {generic_region_name(tgt_gi)}"
            rule = self._path_costs_to_rule(all_costs)
            entrance = self.multiworld.get_entrance(entrance_name, self.player)
            self.set_rule(entrance, rule)

        # Victory: requires all checked events
        all_checked = [f"Checked {i + 1}" for i in range(self.node_count)]
        victory_loc = self.multiworld.get_location("Victory", self.player)
        from rule_builder import HasAll
        self.set_rule(victory_loc, HasAll(*all_checked))

        # Completion condition
        self.multiworld.completion_condition[self.player] = \
            lambda state: state.has("Victory", self.player)

    def generate_basic(self):
        """Push starting buttons as precollected items."""
        for label, count in self.starting_buttons.items():
            item_name = f"Button: {label}"
            for _ in range(count):
                self.multiworld.push_precollected(self.create_item(item_name))

    def pre_fill(self):
        """Place items in original locations when randomization is disabled."""
        if not self.options.randomize_items.value:
            for node in self.generated_nodes:
                gi = self._node_to_generic[node.index]
                loc_name = generic_location_name(gi)
                location = self.multiworld.get_location(loc_name, self.player)
                if node.item == TRASH_ITEM:
                    item_name = "Junk"
                else:
                    item_name = f"Button: {node.item}"
                location.place_locked_item(self.create_item(item_name))

    def create_item(self, name: str) -> APCalcItem:
        """Create a single item by name."""
        data = item_table.get(name)
        if data:
            return APCalcItem(name, data.classification, data.id, self.player)
        # Event items (Checked N, Victory) have no ID
        return APCalcItem(name, ItemClassification.progression, None, self.player)

    def fill_slot_data(self) -> Dict[str, Any]:
        """Data sent to the client for gameplay."""
        # Build nodes dict keyed by generic region name
        nodes = {}
        for node in self.generated_nodes:
            gi = self._node_to_generic[node.index]
            nodes[generic_region_name(gi)] = {
                "value": node.value,
                "layer": node.layer,
                "sphere": node.sphere,
                "item": node.item,
                "location_name": generic_location_name(gi),
            }

        # Build edges list with generic names
        edges = []
        for edge in self.generated_edges:
            if edge.source_index is not None:
                src_gi = self._node_to_generic[edge.source_index]
                source = generic_region_name(src_gi)
            else:
                source = "C"
            tgt_gi = self._node_to_generic[edge.target_index]
            target = generic_region_name(tgt_gi)
            edges.append({
                "source": source,
                "target": target,
                "operation": edge.operation,
                "operand": edge.operand,
                "operand_digits": edge.operand_digits,
            })

        return {
            "nodes": nodes,
            "edges": edges,
            "starting_buttons": self.starting_buttons,
            "operations": ["+", "-", "*", "/"],
            "num_spheres": self.options.num_spheres.value,
            "goal": "all_locations",
        }

    # --- Helpers ---

    def _path_cost_to_rule(self, path_cost: Counter):
        """Convert a single path cost Counter to a Rule Builder rule."""
        rules = []
        for button in sorted(path_cost):
            count = path_cost[button]
            if count > 0:
                rules.append(Has(f"Button: {button}", count))
        if not rules:
            from rule_builder import True_
            return True_()
        if len(rules) == 1:
            return rules[0]
        return And(*rules)

    def _path_costs_to_rule(self, path_costs: List[Counter]):
        """Convert multiple alternative path costs to an Or-of-And rule."""
        if not path_costs:
            from rule_builder import True_
            return True_()

        # Deduplicate identical costs
        unique = []
        seen: Set[tuple] = set()
        for pc in path_costs:
            key = tuple(sorted(pc.items()))
            if key not in seen:
                seen.add(key)
                unique.append(pc)

        if len(unique) == 1:
            return self._path_cost_to_rule(unique[0])

        return Or(*[self._path_cost_to_rule(pc) for pc in unique])
