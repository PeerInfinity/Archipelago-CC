"""Game-specific export handler for Lingo."""

import re
import logging
from typing import Dict, Any
from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)


class LingoGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Lingo'
    """Export handler for Lingo that handles AccessRequirements string sorting, door variable resolution,
    and exporting door-related data structures for rule evaluation."""

    def expand_rule(self, analyzed_rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expand analyzed rule, with special handling for AccessRequirements string representations
        and door variable resolution.

        Lingo's AccessRequirements objects contain sets that have unpredictable string ordering.
        This method sorts the set contents when they appear in constant values.

        Additionally, it resolves the 'door' variable in lingo_can_use_entrance calls to actual values.
        """
        rule = super().expand_rule(analyzed_rule)

        # Resolve door variables in helper calls
        rule = self._resolve_door_variables(rule)

        # Recursively fix AccessRequirements in the rule
        return self._fix_access_requirements(rule)

    def _resolve_door_variables(self, obj: Any) -> Any:
        """
        Recursively resolve 'door' variable references in lingo_can_use_entrance helper calls.

        The door variable is a RoomAndDoor NamedTuple or None. When it's None,
        the helper function returns True, so we can simplify the rule.
        """
        if isinstance(obj, dict):
            # Check if this is a lingo_can_use_entrance helper call
            if obj.get('type') == 'helper' and obj.get('name') == 'lingo_can_use_entrance':
                args = obj.get('args', [])
                if len(args) >= 2:
                    # The second argument should be the door parameter
                    door_arg = args[1]
                    # Check if it's a name reference that needs resolution
                    if isinstance(door_arg, dict) and door_arg.get('type') == 'name' and door_arg.get('name') == 'door':
                        # Leave as-is for frontend helper to handle
                        logger.debug(f"Found lingo_can_use_entrance with unresolved door variable")
                    # Check if it's a constant null/None value
                    elif isinstance(door_arg, dict) and door_arg.get('type') == 'constant' and door_arg.get('value') is None:
                        # door is None, so lingo_can_use_entrance returns True
                        # Replace the entire helper call with a constant True
                        logger.debug(f"Simplified lingo_can_use_entrance with door=None to constant True")
                        return {'type': 'constant', 'value': True}

            # Recursively process dict values
            return {k: self._resolve_door_variables(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._resolve_door_variables(item) for item in obj]
        else:
            return obj

    def _fix_access_requirements(self, obj: Any) -> Any:
        """Recursively sort sets within AccessRequirements string representations."""
        if isinstance(obj, dict):
            # Recursively process dict values
            return {k: self._fix_access_requirements(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            # Process list items, with special handling for constant values containing AccessRequirements
            result = []
            for item in obj:
                if isinstance(item, str) and 'AccessRequirements(' in item:
                    # Parse and sort the sets in the AccessRequirements string
                    result.append(self._sort_access_requirements_string(item))
                else:
                    result.append(self._fix_access_requirements(item))
            return result
        else:
            return obj

    def _sort_access_requirements_string(self, s: str) -> str:
        """Sort sets within an AccessRequirements string representation."""
        # Pattern to match set literals like {'item1', 'item2', 'item3'}
        def sort_set(match):
            # Extract the set contents
            set_contents = match.group(1)
            if not set_contents.strip():
                return "{}"
            # Split by comma, strip whitespace and quotes, sort, then rebuild
            items = [item.strip().strip("'\"") for item in set_contents.split(',')]
            sorted_items = sorted(items)
            return "{" + ", ".join(f"'{item}'" for item in sorted_items) + "}"

        # Replace all set literals with sorted versions
        result = re.sub(r'\{([^{}]*)\}', sort_set, s)
        return result

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """
        Add AccessRequirements data to Lingo locations.

        This exports the location.access field which contains AccessRequirements data
        needed by the _lingo_can_satisfy_requirements helper function.
        """
        attributes = {}

        # The location is a LingoLocation, not a PlayerLocation
        # We need to look up the PlayerLocation from world.player_logic
        if hasattr(world, 'player_logic') and hasattr(world.player_logic, 'locations_by_room'):
            # Extract room name from location name (format: "Room Name - Panel Name")
            # Some locations don't have a dash (achievements, etc.), so handle both cases
            location_name = location.name

            # Search for the PlayerLocation in all rooms
            player_location = None
            for room_locations in world.player_logic.locations_by_room.values():
                for ploc in room_locations:
                    if ploc.name == location_name:
                        player_location = ploc
                        break
                if player_location:
                    break

            if player_location and hasattr(player_location, 'access'):
                access_req = player_location.access

                # Serialize the AccessRequirements object
                attributes['access'] = {
                    'rooms': sorted(list(access_req.rooms)) if hasattr(access_req, 'rooms') else [],
                    'doors': [{'room': door.room, 'door': door.door} for door in sorted(access_req.doors, key=lambda d: (d.room or '', d.door))] if hasattr(access_req, 'doors') else [],
                    'colors': sorted(list(access_req.colors)) if hasattr(access_req, 'colors') else [],
                    'items': sorted(list(access_req.items)) if hasattr(access_req, 'items') else [],
                    'progression': dict(access_req.progression) if hasattr(access_req, 'progression') else {},
                    'the_master': access_req.the_master if hasattr(access_req, 'the_master') else False,
                    'postgame': access_req.postgame if hasattr(access_req, 'postgame') else False
                }

                logger.debug(f"Added AccessRequirements to location {location_name}: {attributes['access']}")

        return attributes

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """
        Export Lingo-specific settings needed for rule evaluation.

        This exports data structures that the rule engine needs to evaluate
        entrance access rules that contain unresolved variable references.
        """
        # Get base settings from parent class
        settings = super().get_settings_data(world, multiworld, player)

        if hasattr(world, 'player_logic'):
            # Export item_by_door: which doors require which items
            if hasattr(world.player_logic, 'item_by_door'):
                settings['item_by_door'] = {}
                for room, doors in world.player_logic.item_by_door.items():
                    settings['item_by_door'][room] = dict(doors)
                logger.debug(f"Exported item_by_door with {len(settings['item_by_door'])} rooms")

            # Export door_reqs: AccessRequirements for doors without items
            if hasattr(world.player_logic, 'door_reqs'):
                settings['door_reqs'] = {}
                for room, doors in world.player_logic.door_reqs.items():
                    settings['door_reqs'][room] = {}
                    for door_name, access_req in doors.items():
                        settings['door_reqs'][room][door_name] = {
                            'rooms': sorted(list(access_req.rooms)) if hasattr(access_req, 'rooms') else [],
                            'doors': [{'room': d.room, 'door': d.door} for d in sorted(access_req.doors, key=lambda d: (d.room or '', d.door))] if hasattr(access_req, 'doors') else [],
                            'colors': sorted(list(access_req.colors)) if hasattr(access_req, 'colors') else [],
                            'items': sorted(list(access_req.items)) if hasattr(access_req, 'items') else [],
                            'progression': dict(access_req.progression) if hasattr(access_req, 'progression') else {},
                            'the_master': access_req.the_master if hasattr(access_req, 'the_master') else False,
                            'postgame': access_req.postgame if hasattr(access_req, 'postgame') else False
                        }
                logger.debug(f"Exported door_reqs with {len(settings['door_reqs'])} rooms")

        # Export PROGRESSIVE_ITEMS constant
        try:
            from worlds.lingo.static_logic import PROGRESSIVE_ITEMS
            settings['PROGRESSIVE_ITEMS'] = list(PROGRESSIVE_ITEMS)
            logger.debug(f"Exported PROGRESSIVE_ITEMS: {settings['PROGRESSIVE_ITEMS']}")
        except ImportError:
            logger.warning("Could not import PROGRESSIVE_ITEMS from worlds.lingo.static_logic")

        # Export PROGRESSIVE_DOORS_BY_ROOM constant
        try:
            from worlds.lingo.static_logic import PROGRESSIVE_DOORS_BY_ROOM
            settings['PROGRESSIVE_DOORS_BY_ROOM'] = {}
            for room, doors in PROGRESSIVE_DOORS_BY_ROOM.items():
                settings['PROGRESSIVE_DOORS_BY_ROOM'][room] = {}
                for door_name, progression_info in doors.items():
                    # progression_info is a ProgressiveDoorInfo namedtuple
                    settings['PROGRESSIVE_DOORS_BY_ROOM'][room][door_name] = {
                        'item_name': progression_info.item_name if hasattr(progression_info, 'item_name') else None,
                        'index': progression_info.index if hasattr(progression_info, 'index') else 1
                    }
            logger.debug(f"Exported PROGRESSIVE_DOORS_BY_ROOM with {len(settings['PROGRESSIVE_DOORS_BY_ROOM'])} rooms")
        except ImportError:
            logger.warning("Could not import PROGRESSIVE_DOORS_BY_ROOM from worlds.lingo.static_logic")

        return settings

    def postprocess_entrance_rule(self, rule: Dict[str, Any], entrance_name: str) -> Dict[str, Any]:
        """
        Postprocess entrance access rules to resolve variable references.

        Lingo entrance rules contain complex conditionals with unresolved variables like
        'door', 'room', 'world', etc. This method extracts the door information from the
        entrance name and simplifies the rule accordingly.

        Entrance name patterns:
        - "Region A to Region B" - no door
        - "Region A to Region B (through Region C - Door Name)" - has door
        """
        if not rule:
            return rule

        # Extract door information from entrance name
        door_room = None
        door_name = None

        # Pattern: "... (through Room Name - Door Name)"
        through_match = re.search(r'\(through ([^-]+) - ([^)]+)\)', entrance_name)
        if through_match:
            door_room = through_match.group(1).strip()
            door_name = through_match.group(2).strip()
            logger.debug(f"Entrance '{entrance_name}' uses door '{door_name}' in room '{door_room}'")

        # Simplify the rule based on door information
        return self._simplify_entrance_rule(rule, door_room, door_name, entrance_name)

    def _simplify_entrance_rule(self, rule: Dict[str, Any], door_room: str, door_name: str, entrance_name: str) -> Dict[str, Any]:
        """
        Recursively simplify entrance rules by resolving door and room variables.

        The general pattern is:
        if door is None:
            return True
        else:
            ... check door requirements ...
        """
        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Handle conditional: if door is None: return True
        if rule_type == 'conditional':
            test = rule.get('test', {})

            # Check if this is testing "door is None"
            if (isinstance(test, dict) and
                test.get('type') == 'compare' and
                test.get('op') in ['is', '=='] and
                isinstance(test.get('left'), dict) and
                test.get('left', {}).get('type') == 'name' and
                test.get('left', {}).get('name') == 'door' and
                isinstance(test.get('right'), dict) and
                test.get('right', {}).get('type') == 'constant' and
                test.get('right', {}).get('value') is None):

                # This is "if door is None:"
                if door_name is None:
                    # door is indeed None, take the if_true branch
                    logger.debug(f"Simplified '{entrance_name}': door is None, using if_true branch")
                    return self._simplify_entrance_rule(rule.get('if_true', {'type': 'constant', 'value': True}), door_room, door_name, entrance_name)
                else:
                    # door is not None, take the if_false branch
                    logger.debug(f"Simplified '{entrance_name}': door is '{door_name}', using if_false branch")
                    # In the if_false branch, replace door variable references with the actual door value
                    if_false = rule.get('if_false')
                    if_false_simplified = self._replace_door_variable(if_false, door_room, door_name)
                    return self._simplify_entrance_rule(if_false_simplified, door_room, door_name, entrance_name)

        # Recursively process all dict values
        result = {}
        for key, value in rule.items():
            if key in ['test', 'if_true', 'if_false', 'conditions', 'left', 'right', 'condition']:
                result[key] = self._simplify_entrance_rule(value, door_room, door_name, entrance_name)
            elif key == 'args' and isinstance(value, list):
                result[key] = [self._simplify_entrance_rule(item, door_room, door_name, entrance_name) for item in value]
            else:
                result[key] = value

        return result

    def _replace_door_variable(self, rule: Dict[str, Any], door_room: str, door_name: str) -> Dict[str, Any]:
        """
        Replace door and room variable references with actual constant values.

        This method evaluates checks against world.player_logic data structures at export time
        and replaces complex patterns with simpler ones using the exported settings data.
        """
        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Replace name references to 'room' with the constant door_room
        if rule_type == 'name' and rule.get('name') == 'room':
            return {'type': 'constant', 'value': door_room}

        # Simplify subscript: world.player_logic.door_reqs[room][door_name]
        #   becomes: door_reqs lookup from settings
        if rule_type == 'subscript':
            value = rule.get('value')
            index = rule.get('index')

            # Check if this is world.player_logic.door_reqs[room][door_name]
            if (isinstance(value, dict) and value.get('type') == 'subscript' and
                isinstance(index, dict) and index.get('type') == 'constant'):

                inner_value = value.get('value', {})
                inner_index = value.get('index', {})

                # Check if inner is world.player_logic.door_reqs
                if (isinstance(inner_value, dict) and inner_value.get('type') == 'attribute' and
                    inner_value.get('attr') == 'door_reqs' and
                    isinstance(inner_index, dict) and inner_index.get('type') == 'name' and
                    inner_index.get('name') == 'room'):

                    # Replace with a settings lookup: settings.door_reqs[door_room][door_name]
                    door_name_constant = index.get('value')
                    logger.debug(f"Simplifying door_reqs lookup for room='{door_room}', door='{door_name_constant}'")

                    return {
                        'type': 'subscript',
                        'value': {
                            'type': 'subscript',
                            'value': {
                                'type': 'attribute',
                                'object': {
                                    'type': 'name',
                                    'name': 'settings'
                                },
                                'attr': 'door_reqs'
                            },
                            'index': {
                                'type': 'constant',
                                'value': door_room
                            }
                        },
                        'index': {
                            'type': 'constant',
                            'value': door_name_constant
                        }
                    }

        # Recursively process all dict and list values
        result = {}
        for key, value in rule.items():
            if isinstance(value, dict):
                result[key] = self._replace_door_variable(value, door_room, door_name)
            elif isinstance(value, list):
                result[key] = [self._replace_door_variable(item, door_room, door_name) if isinstance(item, dict) else item for item in value]
            else:
                result[key] = value

        return result
