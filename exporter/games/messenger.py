"""The Messenger game-specific export handler.

Handles Messenger-specific helper patterns and accumulator-based Time Shard tracking.
"""

from typing import Any, Dict
from .generic import GenericGameExportHandler


def _item(name: str) -> Dict[str, Any]:
    """Create an item_check rule for a single item."""
    return {'type': 'item_check', 'item': {'type': 'constant', 'value': name}}


def _and(*conditions) -> Dict[str, Any]:
    """Create an AND rule combining multiple conditions."""
    return {'type': 'and', 'conditions': list(conditions)}


def _or(*conditions) -> Dict[str, Any]:
    """Create an OR rule combining multiple conditions."""
    return {'type': 'or', 'conditions': list(conditions)}


class MessengerGameExportHandler(GenericGameExportHandler):
    """Export handler for The Messenger.

    Handles:
    - Time Shard accumulator (Pattern 4: parenthesized numbers like "Time Shard (100)")
    - Helper expansions for has_*, is_*, and can_* patterns
    - Shop location cost-based access rules
    """

    # Time Shard variants for the additive Shards accumulator
    TIME_SHARD_VALUES = {
        "Time Shard": 1,
        "Time Shard (10)": 10,
        "Time Shard (50)": 50,
        "Time Shard (100)": 100,
        "Time Shard (300)": 300,
        "Time Shard (500)": 500,
    }

    # Helper expansion mappings - maps helper names to their rule structures
    # These override the generic pattern matching because item names don't match helper names
    HELPER_EXPANSIONS = {
        # has_* patterns: helper name -> item name (where they differ)
        'has_wingsuit': _item('Wingsuit'),
        'has_dart': _item('Rope Dart'),  # Not just "Dart"
        'has_tabi': _item('Lightfoot Tabi'),  # Not just "Tabi"
        'has_vertical': _or(_item('Wingsuit'), _item('Rope Dart')),
        # is_* patterns
        'is_aerobatic': _and(_item('Wingsuit'), _item('Aerobatics Warrior')),
        # can_* patterns (simple ones, can_shop is computed separately)
        'can_destroy_projectiles': _item('Strike of the Ninja'),
        'can_dboost': _and(
            _or(_item('Path of Resilience'), _item('Meditation')),
            _item('Second Wind')
        ),
        'can_double_dboost': _and(
            _item('Path of Resilience'),
            _item('Meditation'),
            _item('Second Wind')
        ),
    }

    def _get_maximum_price(self) -> int:
        """Calculate maximum shop price for can_shop capability."""
        if not self.world:
            return 0
        demons_bane = self.world.multiworld.get_location("The Shop - Demon's Bane", self.world.player)
        focused_power = self.world.multiworld.get_location("The Shop - Focused Power Sense", self.world.player)
        return min(demons_bane.cost + focused_power.cost, self.world.total_shards)

    def _expand_common_helper(self, helper_name, args):
        """Expand Messenger-specific helper patterns to rule structures."""
        # Check declarative mappings first
        if helper_name in self.HELPER_EXPANSIONS:
            return self.HELPER_EXPANSIONS[helper_name]

        # can_shop requires runtime calculation of maximum shop cost
        if helper_name == 'can_shop' and self.world:
            return {
                'type': 'item_check',
                'item': {'type': 'constant', 'value': 'Shards'},
                'count': {'type': 'constant', 'value': self._get_maximum_price()}
            }

        # Fall back to base class for other patterns
        return super()._expand_common_helper(helper_name, args)

    def get_world_data(self, world, multiworld, player):
        """Extract Messenger-specific world data."""
        world_data = super().get_world_data(world, multiworld, player)

        # Enable Pattern 4 accumulator for Time Shard items
        world_data['use_paren_number_accumulator'] = True

        # Export maximum_price for can_shop helper
        try:
            world_data['maximum_price'] = self._get_maximum_price()
        except Exception:
            pass

        return world_data

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Export Time Shards -> Shards accumulator mapping."""
        return {
            "Shards": {
                "type": "additive",
                "items": self.TIME_SHARD_VALUES.copy(),
                "base_item": "Shards"
            }
        }

    def get_custom_location_access_rule(self, location, world):
        """Provide custom access rule for shop locations."""
        if hasattr(location, 'cost'):
            total_shards = getattr(world, 'total_shards', 0)
            return {
                'type': 'item_check',
                'item': {'type': 'constant', 'value': 'Shards'},
                'count': {'type': 'constant', 'value': min(location.cost, total_shards)}
            }
        return None
