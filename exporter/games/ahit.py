"""A Hat in Time game-specific exporter handler.

Helper Export Status:
- can_use_hat: Exported to rules.json, JS fallback still needed
- get_hat_cost: Exported to rules.json (uses for_iter rule type)
- has_relic_combo: Exported to rules.json, JS fallback still needed
- painting_logic: Exported to rules.json, JS fallback still needed
- get_difficulty: Exported to rules.json, JS fallback still needed
- can_clear_required_act: Resolved at export-time to can_reach + location_rule_ref

Note: JavaScript helpers in ahitLogic.js are still required as fallback
because some rule engine code paths use executeHelper() instead of
evaluating the exported helper definitions directly.
"""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class AHitGameExportHandler(GenericGameExportHandler):
    """A Hat in Time export handler with automatic helper export."""

    # For now, treat all exits as bidirectional
    # This setting is currently only used for region navigation in the frontend
    ASSUME_BIDIRECTIONAL_EXITS = True

    # Auto-discover region attributes
    AUTO_DISCOVER_REGION_ATTRIBUTES = True

    # Auto-discover location attributes
    AUTO_DISCOVER_LOCATION_ATTRIBUTES = False

    # Auto-discover world attributes
    AUTO_DISCOVER_WORLD_ATTRIBUTES = True

    # Module containing helper functions for definition export
    HELPER_MODULES = ['worlds.ahit.Rules']

    def __init__(self, world=None):
        super().__init__(world=world)
        self._entrance_cache: Optional[Dict[str, str]] = None

    def _get_entrance_connected_region(self, entrance_name: str) -> Optional[str]:
        """Get the connected region name for an entrance.

        Caches entrance -> connected_region mappings for efficiency.
        """
        if self.world is None:
            return None

        # Build cache on first access
        if self._entrance_cache is None:
            self._entrance_cache = {}
            try:
                multiworld = self.world.multiworld
                player = self.world.player
                for region in multiworld.get_regions(player):
                    for exit in region.exits:
                        if exit.connected_region:
                            self._entrance_cache[exit.name] = exit.connected_region.name
            except Exception as e:
                logger.debug(f"Error building entrance cache: {e}")
                return None

        return self._entrance_cache.get(entrance_name)

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand rules with special handling for can_clear_required_act.

        When we encounter a can_clear_required_act helper call with a constant
        entrance argument, we resolve it at export time to:
        - can_reach(connected_region) AND
        - (region contains "Free Roam" ? true : location_rule_ref("Act Completion (region)"))
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Handle can_clear_required_act helper calls
        if rule_type == 'helper' and rule.get('name') == 'can_clear_required_act':
            args = rule.get('args', [])
            if args and len(args) >= 1:
                # Get the entrance argument
                entrance_arg = args[0]
                entrance_name = None

                # Extract constant value
                if isinstance(entrance_arg, dict) and entrance_arg.get('type') == 'constant':
                    entrance_name = entrance_arg.get('value')
                elif isinstance(entrance_arg, str):
                    entrance_name = entrance_arg

                if entrance_name:
                    # Look up the connected region
                    connected_region = self._get_entrance_connected_region(entrance_name)

                    if connected_region:
                        logger.debug(f"Resolving can_clear_required_act({entrance_name}) -> region: {connected_region}")

                        # Build the resolved rule:
                        # can_reach(connected_region) AND act_completion_rule
                        can_reach_rule = {
                            'type': 'can_reach',
                            'region': connected_region
                        }

                        # Check if it's a Free Roam region (always clearable if reachable)
                        if "Free Roam" in connected_region:
                            # Free Roam regions just need to be reachable
                            return can_reach_rule

                        # For non-Free-Roam regions, also check the Act Completion location's rule
                        act_completion_name = f"Act Completion ({connected_region})"
                        location_rule_ref = {
                            'type': 'location_rule_ref',
                            'location': act_completion_name
                        }

                        # Return: can_reach AND location_rule_ref
                        return {
                            'type': 'and',
                            'conditions': [can_reach_rule, location_rule_ref]
                        }
                    else:
                        logger.debug(f"Could not resolve entrance '{entrance_name}' for can_clear_required_act")

        # Let the parent class handle recursive expansion and other processing
        return super().expand_rule(rule, _depth)

    def get_chapter_costs(self, world):
        """Extract A Hat in Time chapter costs for telescope access rules."""
        try:
            chapter_costs = {}
            if hasattr(world, 'chapter_timepiece_costs'):
                chapter_names = {
                    0: 'Spaceship',
                    1: 'Mafia Town',
                    2: 'Battle of the Birds',
                    3: 'Subcon Forest',
                    4: 'Alpine Skyline',
                    5: "Time's End",
                    6: 'Arctic Cruise',
                    7: 'Nyakuza Metro'
                }

                for chapter_index, cost in world.chapter_timepiece_costs.items():
                    chapter_name = chapter_names.get(int(chapter_index), f'Chapter_{chapter_index}')
                    chapter_costs[chapter_name] = cost

                return chapter_costs
            return {}
        except Exception as e:
            logger.error(f"Error extracting chapter costs: {e}")
            return {}

    def get_hat_costs(self, world):
        """Extract A Hat in Time hat yarn costs and crafting order."""
        try:
            hat_info = {}
            if hasattr(world, 'hat_yarn_costs'):
                hat_info['hat_yarn_costs'] = {int(k): v for k, v in world.hat_yarn_costs.items()}
            if hasattr(world, 'hat_craft_order'):
                hat_info['hat_craft_order'] = [int(h) for h in world.hat_craft_order]
            return hat_info
        except Exception as e:
            logger.error(f"Error extracting hat costs: {e}")
            return {}

    def get_relic_groups(self, world):
        """Extract A Hat in Time relic groups (item_name_groups)."""
        try:
            relic_groups = {}
            if hasattr(world, 'item_name_groups'):
                for group_name, items in world.item_name_groups.items():
                    if isinstance(items, (set, frozenset)):
                        relic_groups[group_name] = sorted(list(items))
                    elif isinstance(items, list):
                        relic_groups[group_name] = sorted(items)
                    else:
                        try:
                            relic_groups[group_name] = sorted(list(items))
                        except:
                            relic_groups[group_name] = []
            return relic_groups
        except Exception as e:
            logger.error(f"Error extracting relic groups: {e}")
            return {}

    def get_game_info(self, world):
        """Get A Hat in Time specific game information."""
        # Get base game info (includes name, accumulator_rules, prog_items_init)
        game_info = super().get_game_info(world)

        try:
            game_info["chapter_costs"] = self.get_chapter_costs(world)
            game_info["hat_info"] = self.get_hat_costs(world)
            game_info["relic_groups"] = self.get_relic_groups(world)
        except Exception as e:
            logger.error(f"Error getting A Hat in Time game info: {e}")
            game_info["chapter_costs"] = {}
            game_info["hat_info"] = {}
            game_info["relic_groups"] = {}

        return game_info

