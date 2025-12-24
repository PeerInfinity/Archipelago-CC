"""The Messenger game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MessengerGameExportHandler(GenericGameExportHandler):
    """Export handler for The Messenger."""

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """
        Expand rules with fixes for inferred item names and location dependency patterns.
        """
        if not rule:
            return rule

        # First, call parent implementation to handle standard expansion and recursion
        rule = super().expand_rule(rule, _depth)

        # Fix inferred item names that don't match actual item names
        if rule.get('type') == 'item_check' and rule.get('inferred'):
            item = rule.get('item')

            # has_vertical: self.has_wingsuit(state) or self.has_dart(state)
            if item == 'Vertical':
                return {
                    'type': 'or',
                    'conditions': [
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Wingsuit'}},
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Rope Dart'}}
                    ]
                }

            # has_dart: state.has("Rope Dart", player)
            if item == 'Dart':
                return {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Rope Dart'}}

            # has_tabi: state.has("Lightfoot Tabi", player)
            if item == 'Tabi':
                return {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Lightfoot Tabi'}}

        # Handle generic_helper rules
        if rule.get('type') == 'generic_helper':
            helper_name = rule.get('name')

            # is_aerobatic: self.has_wingsuit(state) and state.has("Aerobatics Warrior", player)
            if helper_name == 'is_aerobatic':
                return {
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Wingsuit'}},
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Aerobatics Warrior'}}
                    ]
                }

        # Handle capability rules
        if rule.get('type') == 'capability':
            capability = rule.get('capability')

            # can_shop: state.has("Shards", player, self.maximum_price)
            if capability == 'shop':
                if self.world:
                    try:
                        demons_bane = self.world.multiworld.get_location("The Shop - Demon's Bane", self.world.player)
                        focused_power = self.world.multiworld.get_location("The Shop - Focused Power Sense", self.world.player)
                        max_shop_price = demons_bane.cost + focused_power.cost
                        maximum_price = min(max_shop_price, self.world.total_shards)
                        return {
                            'type': 'item_check',
                            'item': {'type': 'constant', 'value': 'Shards'},
                            'count': {'type': 'constant', 'value': maximum_price}
                        }
                    except Exception as e:
                        logger.warning(f"Could not calculate maximum_price for can_shop: {e}")

            # can_destroy_projectiles: state.has("Strike of the Ninja", player)
            if capability == 'destroy_projectiles':
                return {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Strike of the Ninja'}}

            # can_dboost: state.has_any({"Path of Resilience", "Meditation"}, player) and state.has("Second Wind", player)
            if capability == 'dboost':
                return {
                    'type': 'and',
                    'conditions': [
                        {
                            'type': 'or',
                            'conditions': [
                                {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Path of Resilience'}},
                                {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Meditation'}}
                            ]
                        },
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Second Wind'}}
                    ]
                }

            # can_double_dboost: state.has_all({"Path of Resilience", "Meditation", "Second Wind"}, player)
            if capability == 'double_dboost':
                return {
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Path of Resilience'}},
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Meditation'}},
                        {'type': 'item_check', 'item': {'type': 'constant', 'value': 'Second Wind'}}
                    ]
                }

        # Handle location dependency pattern: state.multiworld.get_location(loc, player).can_reach(state)
        if (rule.get('type') == 'function_call' and
            rule.get('function', {}).get('type') == 'attribute' and
            rule.get('function', {}).get('attr') == 'can_reach'):

            func = rule.get('function', {})
            obj = func.get('object', {})

            if (obj.get('type') == 'function_call' and
                obj.get('function', {}).get('type') == 'attribute' and
                obj.get('function', {}).get('attr') == 'get_location'):

                get_loc_func = obj.get('function', {})
                multiworld_obj = get_loc_func.get('object', {})

                if (multiworld_obj.get('type') == 'attribute' and
                    multiworld_obj.get('attr') == 'multiworld' and
                    multiworld_obj.get('object', {}).get('type') == 'name' and
                    multiworld_obj.get('object', {}).get('name') == 'state'):

                    location_args = obj.get('args', [])
                    if location_args:
                        return {'type': 'location_check', 'location': location_args[0]}

        # Handle state_method has_any/has_all rules - convert to or/and with item_check
        # The frontend's executeStateManagerMethod doesn't handle these correctly,
        # so we expand them to standard rule types that work reliably
        if rule.get('type') == 'state_method':
            method = rule.get('method')
            args = rule.get('args', [])

            if method == 'has_any' and args:
                # has_any([item1, item2, ...]) -> or([item_check(item1), item_check(item2), ...])
                items_arg = args[0]
                items = self._resolve_items_collection(items_arg)

                if items:
                    return {
                        'type': 'or',
                        'conditions': [
                            {'type': 'item_check', 'item': {'type': 'constant', 'value': item_name}}
                            for item_name in items
                        ]
                    }

            if method == 'has_all' and args:
                # has_all([item1, item2, ...]) -> and([item_check(item1), item_check(item2), ...])
                items_arg = args[0]
                items = self._resolve_items_collection(items_arg)

                if items:
                    return {
                        'type': 'and',
                        'conditions': [
                            {'type': 'item_check', 'item': {'type': 'constant', 'value': item_name}}
                            for item_name in items
                        ]
                    }

        # Recursive expansion of children is handled by super().expand_rule()
        return rule

    def get_settings_data(self, world, multiworld, player):
        """Extract Messenger-specific settings."""
        settings = super().get_settings_data(world, multiworld, player)

        # Enable Pattern 4 accumulator for "Time Shard (N)" items -> "Shards" counter
        # This allows the world generator to create collect/remove methods that
        # properly track Shards currency from Time Shard items
        settings['use_paren_number_accumulator'] = True

        return settings

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """
        Export progression mapping for Time Shards -> Shards accumulation.

        In Python, when a Time Shard item is collected, the world.collect() method
        adds its value to a virtual "Shards" item using state.add_item("Shards", value).

        We replicate this using the progression_mapping system with type="additive".
        """
        mapping = {}

        # Get all Time Shard items and their values
        time_shard_items = {}

        # Add all standard Time Shard items with their values
        time_shard_variants = [
            ("Time Shard", 1),
            ("Time Shard (10)", 10),
            ("Time Shard (50)", 50),
            ("Time Shard (100)", 100),
            ("Time Shard (300)", 300),
            ("Time Shard (500)", 500),
        ]

        for item_name, value in time_shard_variants:
            time_shard_items[item_name] = value

        if time_shard_items:
            mapping["Shards"] = {
                "type": "additive",
                "items": time_shard_items,
                "base_item": "Shards"
            }
            logger.debug(f"Created progression mapping for Shards with {len(time_shard_items)} Time Shard items")

        return mapping

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """
        Get game-specific location attributes to include in the export.
        For Messenger, this includes shop costs for shop locations.
        """
        attributes = {}

        # Check if this is a shop location by looking for 'cost' attribute
        if hasattr(location, 'cost'):
            try:
                cost = location.cost
                attributes['cost'] = cost
                logger.debug(f"Exported cost {cost} for shop location {location.name}")
            except Exception as e:
                logger.warning(f"Could not get cost for location {location.name}: {e}")

        return attributes

    def get_custom_location_access_rule(self, location, world):
        """
        Provide custom access rule for Messenger shop locations.

        Shop locations have an access_rule method that returns a 'can_afford' variable,
        which is defined as: state.has("Shards", player, min(self.cost, world.total_shards))

        We replace this with a direct item_check rule for "Shards" with the appropriate count.
        """
        # Check if this is a shop location with a cost attribute
        if hasattr(location, 'cost'):
            try:
                cost = location.cost
                total_shards = world.total_shards if hasattr(world, 'total_shards') else 0
                required_shards = min(cost, total_shards)

                logger.debug(f"Shop location {location.name}: cost={cost}, total_shards={total_shards}, required={required_shards}")

                # Return a custom rule that checks for the required number of shards
                return {
                    'type': 'item_check',
                    'item': {
                        'type': 'constant',
                        'value': 'Shards'
                    },
                    'count': {
                        'type': 'constant',
                        'value': required_shards
                    }
                }
            except Exception as e:
                logger.warning(f"Could not create custom access rule for shop location {location.name}: {e}")
                return None

        # For non-shop locations, return None to use the default access rule
        return None
