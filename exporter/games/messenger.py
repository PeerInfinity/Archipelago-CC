"""The Messenger game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class MessengerGameExportHandler(GenericGameExportHandler):
    """Export handler for The Messenger.

    Handles Messenger-specific helper patterns by overriding _expand_common_helper
    to return correct rules directly, avoiding intermediate inferred/capability types.
    """

    # Time Shard variants for progression mapping
    TIME_SHARD_VALUES = {
        "Time Shard": 1,
        "Time Shard (10)": 10,
        "Time Shard (50)": 50,
        "Time Shard (100)": 100,
        "Time Shard (300)": 300,
        "Time Shard (500)": 500,
    }

    def _get_maximum_price(self) -> int:
        """Calculate maximum shop price for can_shop capability."""
        if not self.world:
            return 0
        demons_bane = self.world.multiworld.get_location("The Shop - Demon's Bane", self.world.player)
        focused_power = self.world.multiworld.get_location("The Shop - Focused Power Sense", self.world.player)
        return min(demons_bane.cost + focused_power.cost, self.world.total_shards)

    def _expand_common_helper(self, helper_name, args):
        """Expand Messenger-specific helper patterns directly to rules.

        Handles has_*, is_*, and can_* patterns that need game-specific expansions,
        returning the correct rules directly instead of intermediate types.
        """
        # Handle has_* patterns with correct item mappings
        if helper_name.startswith('has_'):
            subject = '_'.join(helper_name.split('_')[1:])
            item_mappings = {
                'vertical': {'type': 'or', 'conditions': [
                    {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Wingsuit'}},
                    {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Rope Dart'}}
                ]},
                'dart': {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Rope Dart'}},
                'tabi': {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Lightfoot Tabi'}},
            }
            if subject in item_mappings:
                return item_mappings[subject]

        # Handle is_aerobatic helper
        if helper_name == 'is_aerobatic':
            return {'type': 'and', 'conditions': [
                {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Wingsuit'}},
                {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Aerobatics Warrior'}}
            ]}

        # Handle can_* capability patterns
        if helper_name.startswith('can_'):
            capability = helper_name[4:]
            capability_expansions = {
                'destroy_projectiles': {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Strike of the Ninja'}},
                'dboost': {'type': 'and', 'conditions': [
                    {'type': 'or', 'conditions': [
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Path of Resilience'}},
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Meditation'}}
                    ]},
                    {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Second Wind'}}
                ]},
                'double_dboost': {'type': 'and', 'conditions': [
                    {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Path of Resilience'}},
                    {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Meditation'}},
                    {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Second Wind'}}
                ]},
            }
            if capability in capability_expansions:
                return capability_expansions[capability]
            # can_shop requires runtime calculation
            if capability == 'shop' and self.world:
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
