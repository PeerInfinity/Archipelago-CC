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

# Chapter index to name mapping for timepiece costs
CHAPTER_NAMES = {
    0: 'Spaceship',
    1: 'Mafia Town',
    2: 'Battle of the Birds',
    3: 'Subcon Forest',
    4: 'Alpine Skyline',
    5: "Time's End",
    6: 'Arctic Cruise',
    7: 'Nyakuza Metro'
}


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

    def expand_helper(self, helper_name: str, args: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        """Expand can_clear_required_act(entrance) at export time.

        Returns:
        - can_reach(connected_region) for Free Roam regions
        - can_reach(connected_region) AND location_rule_ref("Act Completion (region)") otherwise
        """
        if helper_name == 'can_clear_required_act' and args:
            entrance_arg = args[0]

            # Extract entrance name from argument (constant dict or raw string)
            if isinstance(entrance_arg, dict) and entrance_arg.get('type') == 'constant':
                entrance_name = entrance_arg.get('value')
            elif isinstance(entrance_arg, str):
                entrance_name = entrance_arg
            else:
                entrance_name = None

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

    def postprocess_helper(self, helper_name: str, helper_def: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process helper definitions to fix known issues.

        Fixes has_paintings helper structure where nested if statements without else
        incorrectly have if_false=None instead of the fallthrough item_check.
        """
        if helper_name == 'has_paintings':
            return self._fix_has_paintings_helper(helper_def)

        return helper_def

    def _fix_has_paintings_helper(self, helper_def: Dict[str, Any]) -> Dict[str, Any]:
        """Fix has_paintings helper structure.

        The original Python has_paintings function has this structure:
            if not painting_logic(world):
                return True
            if not NoPaintingSkips and allow_skip:
                if difficulty >= MODERATE:
                    return True
            return state.has("Progressive Painting Unlock", count)

        The AST analyzer incorrectly captures the nested if's else as None instead of
        the fallthrough item_check. This method fixes that structure.
        """
        body = helper_def.get('body', {})
        if body.get('type') != 'conditional':
            return helper_def

        # Structure: if not painting_logic: True else: (inner conditional)
        if_false = body.get('if_false', {})
        if not isinstance(if_false, dict) or if_false.get('type') != 'conditional':
            return helper_def

        # Inner: if not NoPaintingSkips and allow_skip: (difficulty check) else: item_check
        inner_if_true = if_false.get('if_true', {})
        inner_if_false = if_false.get('if_false', {})

        # Check if inner_if_true is the difficulty check with if_false=None
        if (isinstance(inner_if_true, dict) and
            inner_if_true.get('type') == 'conditional' and
            inner_if_true.get('if_false') is None):

            # The fallthrough should be the outer if_false (item_check)
            # If inner_if_false is the item_check, use it as the fallthrough
            if isinstance(inner_if_false, dict) and inner_if_false.get('type') == 'item_check':
                # Fix: set the innermost if_false to the item_check
                inner_if_true['if_false'] = inner_if_false
                logger.debug("Fixed has_paintings helper: nested if_false now points to item_check")

        return helper_def

    def get_game_info(self, world):
        """Get A Hat in Time specific game information.

        Note: hat_yarn_costs and hat_craft_order are auto-discovered and
        available in the world section, so they're not duplicated here.
        """
        game_info = super().get_game_info(world)

        # Add chapter timepiece costs (convert enum keys to chapter names)
        if hasattr(world, 'chapter_timepiece_costs'):
            game_info["chapter_costs"] = {
                CHAPTER_NAMES.get(int(idx), f'Chapter_{idx}'): cost
                for idx, cost in world.chapter_timepiece_costs.items()
            }

        # Add item name groups (relic groups for frontend)
        if hasattr(world, 'item_name_groups'):
            game_info["relic_groups"] = {
                name: sorted(items) for name, items in world.item_name_groups.items()
            }

        return game_info

