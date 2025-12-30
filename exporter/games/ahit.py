"""A Hat in Time game-specific exporter handler.

Handles:
- can_clear_required_act: Resolved at export-time to can_reach + location_rule_ref
- Game-specific data: chapter_costs, relic_groups for frontend

Note: hat_yarn_costs and hat_craft_order are auto-discovered and available
in the world section, so they're not duplicated in game_info.
"""

from typing import Any, Dict, List, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class AHitGameExportHandler(GenericGameExportHandler):
    """A Hat in Time export handler."""

    # Disable location attribute discovery (not needed for AHIT)
    AUTO_DISCOVER_LOCATION_ATTRIBUTES = False

    # Don't export can_clear_required_act as a helper definition since we expand it
    HELPERS_TO_EXPORT_BLACKLIST = {'can_clear_required_act'}

    def _get_entrance_connected_region(self, entrance_name: str) -> Optional[str]:
        """Get the connected region name for an entrance (cached)."""
        if self.world is None:
            return None

        # Build cache on first access (lazy initialization)
        if getattr(self, '_entrance_cache', None) is None:
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

    def expand_helper(self, helper_name: str, args: List[Any] = None) -> Optional[Dict[str, Any]]:
        """Expand helper functions with special handling for can_clear_required_act.

        Resolves can_clear_required_act(entrance) at export time to:
        - can_reach(connected_region) for Free Roam regions
        - can_reach(connected_region) AND location_rule_ref("Act Completion (region)") otherwise
        """
        if helper_name == 'can_clear_required_act' and args:
            # Get the entrance argument
            entrance_arg = args[0] if args else None
            entrance_name = None

            # Extract constant value from argument
            if isinstance(entrance_arg, dict) and entrance_arg.get('type') == 'constant':
                entrance_name = entrance_arg.get('value')
            elif isinstance(entrance_arg, str):
                entrance_name = entrance_arg

            if entrance_name:
                connected_region = self._get_entrance_connected_region(entrance_name)

                if connected_region:
                    logger.debug(f"Expanding can_clear_required_act({entrance_name}) -> {connected_region}")

                    can_reach_rule = {'type': 'can_reach', 'region': connected_region}

                    # Free Roam regions just need to be reachable
                    if "Free Roam" in connected_region:
                        return can_reach_rule

                    # Non-Free-Roam regions also need the Act Completion location's rule
                    return {
                        'type': 'and',
                        'conditions': [
                            can_reach_rule,
                            {'type': 'location_rule_ref', 'location': f"Act Completion ({connected_region})"}
                        ]
                    }

        return super().expand_helper(helper_name, args)

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
        """Get A Hat in Time specific game information.

        Note: hat_yarn_costs and hat_craft_order are auto-discovered and
        available in the world section, so they're not duplicated here.
        """
        # Get base game info (includes name, accumulator_rules, prog_items_init)
        game_info = super().get_game_info(world)

        try:
            game_info["chapter_costs"] = self.get_chapter_costs(world)
            game_info["relic_groups"] = self.get_relic_groups(world)
        except Exception as e:
            logger.error(f"Error getting A Hat in Time game info: {e}")
            game_info["chapter_costs"] = {}
            game_info["relic_groups"] = {}

        return game_info

