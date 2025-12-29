"""The Messenger game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class MessengerGameExportHandler(GenericGameExportHandler):
    """Export handler for The Messenger."""

    # Inferred item name corrections: inferred_name -> actual rule
    INFERRED_ITEM_FIXES = {
        'Vertical': {'type': 'or', 'conditions': [
            {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Wingsuit'}},
            {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Rope Dart'}}
        ]},
        'Dart': {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Rope Dart'}},
        'Tabi': {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Lightfoot Tabi'}},
    }

    # Generic helper expansions: helper_name -> rule
    HELPER_EXPANSIONS = {
        'is_aerobatic': {'type': 'and', 'conditions': [
            {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Wingsuit'}},
            {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Aerobatics Warrior'}}
        ]},
    }

    # Capability expansions: capability_name -> rule (None means requires runtime calculation)
    CAPABILITY_EXPANSIONS = {
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

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand rules with game-specific fixes."""
        if not rule:
            return rule

        rule = super().expand_rule(rule, _depth)

        # Fix inferred item names
        if rule.get('type') == 'item_check' and rule.get('inferred'):
            item = rule.get('item')
            if item in self.INFERRED_ITEM_FIXES:
                return self.INFERRED_ITEM_FIXES[item]

        # Handle generic helper rules
        if rule.get('type') == 'generic_helper':
            helper_name = rule.get('name')
            if helper_name in self.HELPER_EXPANSIONS:
                return self.HELPER_EXPANSIONS[helper_name]

        # Handle capability rules
        if rule.get('type') == 'capability':
            capability = rule.get('capability')

            # Static capability expansions
            if capability in self.CAPABILITY_EXPANSIONS:
                return self.CAPABILITY_EXPANSIONS[capability]

            # can_shop requires runtime calculation
            if capability == 'shop' and self.world:
                return {
                    'type': 'item_check',
                    'item': {'type': 'constant', 'value': 'Shards'},
                    'count': {'type': 'constant', 'value': self._get_maximum_price()}
                }

        return rule

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
