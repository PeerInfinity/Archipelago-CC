"""Adventure-specific helper expander."""

from .base import BaseHelperExpander
import logging
import re
import inspect

logger = logging.getLogger(__name__)

class AdventureHelperExpander(BaseHelperExpander):
    """
    Helper expander for the Adventure game. Handles Adventure-specific rule patterns.
    
    Key items in Adventure include:
    - Keys (Yellow, Black, White)
    - Sword
    - Bridge
    - Magnet
    - Chalice
    - Right Difficulty Switch (optional)
    """
    
    # Mapping of entrance/exit names to their known requirements
    KNOWN_ENTRANCE_REQUIREMENTS = {
        'CreditsWall': {
            'type': 'and',
            'conditions': [
                {
                    'type': 'item_check', 
                    'item': 'Bridge'
                },
                {
                    'type': 'item_check', 
                    'item': 'Black Key'
                }
            ]
        },
        'YellowCastlePort': {
            'type': 'item_check',
            'item': 'Yellow Key'
        },
        'BlackCastlePort': {
            'type': 'item_check',
            'item': 'Black Key'
        },
        'WhiteCastlePort': {
            'type': 'item_check',
            'item': 'White Key'
        },
        'BlackCastleVaultEntrance': {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Bridge'},
                {'type': 'item_check', 'item': 'Magnet'}
            ]
        },
        'WhiteCastleSecretPassage': {
            'type': 'item_check',
            'item': 'Bridge'
        },
        'WhiteCastlePeekPassage': {
            'type': 'or',
            'conditions': [
                {'type': 'item_check', 'item': 'Bridge'},
                {'type': 'item_check', 'item': 'Magnet'}
            ]
        },
        'CreditsToFarSide': {
            'type': 'item_check',
            'item': 'Magnet'
        }
    }
    
    # Mapping of location names to their known access requirements
    KNOWN_LOCATION_REQUIREMENTS = {
        "Slay Yorgle": {
            'type': 'item_check',
            'item': 'Sword',
            'description': 'Requires Sword to defeat Yorgle'
        },
        "Slay Grundle": {
            'type': 'item_check',
            'item': 'Sword',
            'description': 'Requires Sword to defeat Grundle'
        },
        "Slay Rhindle": {
            'type': 'item_check',
            'item': 'Sword',
            'description': 'Requires Sword to defeat Rhindle'
        },
        "Chalice Home": {
            'type': 'and',
            'conditions': [
                {'type': 'item_check', 'item': 'Chalice'},
                {'type': 'item_check', 'item': 'Yellow Key'}
            ],
            'description': 'Requires Chalice and Yellow Key to win the game'
        }
    }
    
    def _normalize_rule_output(self, rule):
        """Ensure the rule is in a format the frontend expects."""
        if rule is None:
            return {"type": "constant", "value": True}
            
        # Handle dictionary rules
        if isinstance(rule, dict):
            # Make sure rule has a type
            if 'type' not in rule:
                # Try to infer type from content
                if 'item' in rule:
                    rule['type'] = 'item_check'
                elif 'value' in rule:
                    rule['type'] = 'constant'
                elif 'conditions' in rule:
                    # Default to 'and' for conditions
                    rule['type'] = 'and'
                else:
                    # Default to constant true
                    rule['type'] = 'constant'
                    rule['value'] = True
                    
            # Handle conditions recursively
            if 'conditions' in rule:
                rule['conditions'] = [self._normalize_rule_output(cond) for cond in rule['conditions']]
                
            # Remove description if not needed for frontend
            if 'description' in rule and rule.get('type') != 'text':
                # Move description to a standardized attribute
                rule['_description'] = rule.pop('description')
                
            # Normalize item names
            if rule.get('type') == 'item_check' and 'item' in rule:
                # Ensure item names match the canonical format
                item_name = rule['item']
                # Standard keys format
                for key_color in ['Yellow', 'Black', 'White']:
                    if item_name.lower() == f"{key_color.lower()} key":
                        rule['item'] = f"{key_color} Key"
                        
        return rule
        
    def expand_rule(self, rule):
        """Expand a rule into a format suitable for frontend evaluation."""
        if not rule:
            return None
        
        # Handle dictionary rules
        if isinstance(rule, dict):
            # Extract rule type and content
            rule_type = rule.get('type', '')
            content = rule.get('content', '')
            
            # Handle entrance rules
            if rule_type == 'entrance':
                # Extract entrance name from content if possible
                entrance_name = None
                if isinstance(content, str):
                    entrance_name = self._extract_entrance_name(content)
                
                # Get the rule requirements
                requirements = self._get_entrance_requirements(entrance_name)
                
                # Build the expanded rule
                expanded = {
                    'type': 'entrance',
                    'entrance': entrance_name,
                    'requires': requirements
                }
                
                return expanded
                
            # Handle location rules
            elif rule_type == 'location':
                # Extract location name from content if possible
                location_name = None
                if isinstance(content, str):
                    location_name = self._extract_location_name(content)
                
                # Get the rule requirements
                requirements = self._get_location_requirements(location_name)
                
                # Build the expanded rule
                expanded = {
                    'type': 'location',
                    'location': location_name,
                    'requires': requirements
                }
                
                return expanded
                
            # Handle item rules
            elif rule_type == 'item':
                # Extract item name from content if possible
                item_name = None
                if isinstance(content, str):
                    item_name = self._extract_item_name(content)
                
                # Get the rule requirements
                requirements = self._get_item_requirements(item_name)
                
                # Build the expanded rule
                expanded = {
                    'type': 'item',
                    'item': item_name,
                    'requires': requirements
                }
                
                return expanded
                
            # Handle region rules
            elif rule_type == 'region':
                # Extract region name from content if possible
                region_name = None
                if isinstance(content, str):
                    region_name = self._extract_region_name(content)
                
                # Get the rule requirements
                requirements = self._get_region_requirements(region_name)
                
                # Build the expanded rule
                expanded = {
                    'type': 'region',
                    'region': region_name,
                    'requires': requirements
                }
                
                return expanded
                
            # Handle other rule types
            else:
                # For unknown rule types, return the original rule
                return rule
                
        # Handle string rules
        elif isinstance(rule, str):
            # Try to identify the rule type and content
            if 'entrance' in rule.lower():
                entrance_name = self._extract_entrance_name(rule)
                if entrance_name:
                    return {
                        'type': 'entrance',
                        'entrance': entrance_name,
                        'requires': self._get_entrance_requirements(entrance_name)
                    }
            elif 'location' in rule.lower():
                location_name = self._extract_location_name(rule)
                if location_name:
                    return {
                        'type': 'location',
                        'location': location_name,
                        'requires': self._get_location_requirements(location_name)
                    }
            elif 'item' in rule.lower():
                item_name = self._extract_item_name(rule)
                if item_name:
                    return {
                        'type': 'item',
                        'item': item_name,
                        'requires': self._get_item_requirements(item_name)
                    }
            elif 'region' in rule.lower():
                region_name = self._extract_region_name(rule)
                if region_name:
                    return {
                        'type': 'region',
                        'region': region_name,
                        'requires': self._get_region_requirements(region_name)
                    }
        
        # If we can't identify the rule type, return it as-is
        return rule
    
    def _extract_entrance_name(self, content):
        """Extract entrance name from rule content."""
        # Remove any context-related code
        if isinstance(content, str):
            # Look for entrance name in the content
            for entrance_name in self.KNOWN_ENTRANCE_REQUIREMENTS.keys():
                if entrance_name in content:
                    return entrance_name
        return None
    
    def _extract_location_name(self, content):
        """Extract location name from rule content."""
        # Remove any context-related code
        if isinstance(content, str):
            # Look for location name in the content
            for location_name in self.KNOWN_LOCATION_REQUIREMENTS.keys():
                if location_name in content:
                    return location_name
        return None
    
    def _extract_item_name(self, content):
        """Extract item name from rule content."""
        # Remove any context-related code
        if isinstance(content, str):
            # Look for item name in the content
            for item_name in self.KNOWN_ITEM_REQUIREMENTS.keys():
                if item_name in content:
                    return item_name
        return None
    
    def _extract_region_name(self, content):
        """Extract region name from rule content."""
        # Remove any context-related code
        if isinstance(content, str):
            # Look for region name in the content
            for region_name in self.KNOWN_REGION_REQUIREMENTS.keys():
                if region_name in content:
                    return region_name
        return None
    
    def _analyze_lambda_string(self, lambda_str):
        """
        Analyze a lambda function string to extract rule requirements.
        Example: "lambda state: state.has('Sword', player)"
        """
        # Handle conjunction of items (AND)
        if ' and ' in lambda_str:
            parts = lambda_str.split(' and ')
            conditions = []
            
            for part in parts:
                # Extract item name from state.has calls
                if 'state.has' in part:
                    item_match = re.search(r"has\(['\"](.+?)['\"]", part)
                    if item_match:
                        item_name = item_match.group(1)
                        conditions.append({
                            'type': 'item_check',
                            'item': item_name
                        })
            
            if conditions:
                return {
                    'type': 'and',
                    'conditions': conditions
                }
        
        # Handle disjunction of items (OR)
        if ' or ' in lambda_str:
            parts = lambda_str.split(' or ')
            conditions = []
            
            for part in parts:
                # Extract item name from state.has calls
                if 'state.has' in part:
                    item_match = re.search(r"has\(['\"](.+?)['\"]", part)
                    if item_match:
                        item_name = item_match.group(1)
                        conditions.append({
                            'type': 'item_check',
                            'item': item_name
                        })
            
            if conditions:
                return {
                    'type': 'or',
                    'conditions': conditions
                }
        
        # Handle single item requirement
        if 'state.has' in lambda_str:
            item_match = re.search(r"has\(['\"](.+?)['\"]", lambda_str)
            if item_match:
                item_name = item_match.group(1)
                return {
                    'type': 'item_check',
                    'item': item_name
                }
        
        # Fallback for unrecognized lambda strings
        return {
            'type': 'adventure_rule',
            'description': 'Adventure game rule',
            'source': lambda_str
        }
    
    def _analyze_original_rule(self, original_rule):
        """Extract information from the original rule structure."""
        # Handle state method calls
        if original_rule.get('type') == 'state_method':
            method = original_rule.get('method', '')
            args = original_rule.get('args', [])
            
            # Handle item requirements via state.has
            if method == 'has' and len(args) >= 1:
                return {
                    'type': 'item_check',
                    'item': args[0],
                    'description': f'Requires {args[0]}'
                }
        
        # Fallback for unrecognized original rules
        return {
            'type': 'adventure_rule',
            'description': 'Adventure-specific rule',
            'details': 'This rule is specific to Adventure game logic'
        }
    
    def expand_helper(self, helper_name):
        """Expand Adventure-specific helper functions."""
        # Standard Adventure helpers based on naming convention
        if helper_name == 'dragon_slain':
            return {
                'type': 'item_check',
                'item': 'Sword',
                'description': 'Requires Sword to slay dragon'
            }
        
        # Return None for unknown helpers to let the base implementation handle them
        return None
    
    def _process_entrance_access_rule(self, entrance_name, rule):
        """Process and normalize rules specifically for entrance access.
        This helps ensure all entrances have properly formatted rules for the frontend.
        """
        logger.debug(f"Processing entrance access rule for: {entrance_name}")
        
        # First check for known entrance rules
        if entrance_name in self.KNOWN_ENTRANCE_REQUIREMENTS:
            logger.debug(f"Using predefined rule for entrance: {entrance_name}")
            return self.KNOWN_ENTRANCE_REQUIREMENTS[entrance_name]
            
        # If this specific entrance isn't in our predefined set but follows a pattern we know about,
        # look for pattern matches
        for pattern, known_entrance in self.entrance_pattern_map.items():
            if re.search(pattern, entrance_name, re.IGNORECASE):
                if known_entrance in self.KNOWN_ENTRANCE_REQUIREMENTS:
                    logger.debug(f"Found matching entrance pattern for '{entrance_name}': {known_entrance}")
                    return self.KNOWN_ENTRANCE_REQUIREMENTS[known_entrance]
                    
        # If no pattern match, expand the rule normally
        expanded_rule = self.expand_rule(rule)
        
        # For the 'CreditsWall' specifically, do an extra check
        if "CreditsWall" in entrance_name:
            logger.debug(f"Special handling for CreditsWall entrance: {entrance_name}")
            # Use the predefined CreditsWall rule if available
            if 'CreditsWall' in self.KNOWN_ENTRANCE_REQUIREMENTS:
                return self.KNOWN_ENTRANCE_REQUIREMENTS['CreditsWall']
                
        return expanded_rule
        
    def _preserve_context(self, rule, entrance_name=None, location_name=None):
        """Preserve context information in the rule for later reference."""
        # Only add context for dictionary rules
        if isinstance(rule, dict):
            # Create a context dictionary if it doesn't exist
            if 'context' not in rule:
                rule['context'] = {}
                
            # Add entrance or location name if provided
            if entrance_name:
                rule['context']['entrance_name'] = entrance_name
                
            if location_name:
                rule['context']['location_name'] = location_name
                
        return rule
    
    @property
    def entrance_pattern_map(self):
        """Map of patterns to identify entrance names."""
        return {
            '(?:^|_)CreditsWall(?:$|_)': 'CreditsWall',
            '(?:^|_)YellowCastle(?:$|_|Port)': 'YellowCastlePort',
            '(?:^|_)BlackCastle(?:$|_|Port)': 'BlackCastlePort',
            '(?:^|_)WhiteCastle(?:$|_|Port)': 'WhiteCastlePort',
            '(?:^|_)BlackCastleVault(?:$|_|Entrance)': 'BlackCastleVaultEntrance',
            '(?:^|_)WhiteCastleSecret(?:$|_|Passage)': 'WhiteCastleSecretPassage',
            '(?:^|_)WhiteCastlePeek(?:$|_|Passage)': 'WhiteCastlePeekPassage',
            '(?:^|_)CreditsToFarSide(?:$|_)': 'CreditsToFarSide',
        }

    def get_nodes(self, settings: dict):
        # Initialize a dictionary to store our exportable data
        nodes = {}
        
        # Get base required fields
        required_fields = self.get_required_fields()
        
        # Get all regions
        ap_world = self.get_all_worlds()[0]
        regions_list = ap_world.get_regions()
        
        for region in regions_list:
            region_name = region.name

            # Create region node entry
            region_node = {
                'region_name': region_name
            }
            nodes[region_name] = region_node
            
            # Process entrances (connections between regions)
            if hasattr(region, 'exits') and region.exits:
                entrances = []
                for exit in region.exits:
                    exit_name = exit.name
                    connected_region = exit.connected_region.name if exit.connected_region else None
                    
                    # Get access rules
                    helper = self.get_helper()
                    rule = exit.access_rule
                    
                    # Use the special entrance processing for consistent rule format
                    entrance_rule = helper._process_entrance_access_rule(exit_name, rule)
                    
                    # Ensure we have context preservation
                    entrance_rule = helper._preserve_context(entrance_rule, entrance_name=exit_name)
                    
                    # For CreditsWall specifically, do an extra special check
                    if "CreditsWall" in exit_name:
                        logger.debug(f"Special handling for CreditsWall in get_nodes: {exit_name}")
                        # Force the rule to use our predefined format
                        entrance_rule = helper.KNOWN_ENTRANCE_REQUIREMENTS.get('CreditsWall', entrance_rule)
                    
                    # Create entrance data
                    entrance_data = {
                        'name': exit_name,
                        'target': connected_region
                    }
                    
                    # Add access rule if it exists
                    if entrance_rule:
                        entrance_data['rule'] = entrance_rule
                    
                    entrances.append(entrance_data)
                
                # Add entrances to region node
                if entrances:
                    region_node['entrances'] = entrances
            
            # Process locations
            if hasattr(region, 'locations') and region.locations:
                locations = []
                for location in region.locations:
                    location_name = location.name
                    
                    # Process item
                    item = None
                    if hasattr(location, 'item') and location.item:
                        item = location.item.name
                    
                    # Process access rule
                    helper = self.get_helper()
                    rule = location.access_rule
                    
                    # Expand rule using our helper with special Adventure-specific processing
                    rule_data = helper.expand_rule(rule)
                    
                    # Add context preservation
                    rule_data = helper._preserve_context(rule_data, location_name=location_name)
                    
                    # Create location data
                    location_data = {
                        'name': location_name
                    }
                    
                    # Add item if it exists
                    if item:
                        location_data['item'] = item
                    
                    # Add access rule if it exists
                    if rule_data:
                        location_data['rule'] = rule_data
                    
                    locations.append(location_data)
                
                # Add locations to region node
                if locations:
                    region_node['locations'] = locations
        
        return nodes 

    def get_game_info(self):
        """Provide game information for export to help the frontend interpret rules correctly."""
        return {
            "name": "Adventure",
            "rule_format": {
                "version": "1.0",
                "entrance_rules": {
                    "format": "dictionary",
                    "type_field": "type",
                    "valid_types": ["item_check", "and", "or", "constant"],
                    "known_entrances": list(self.KNOWN_ENTRANCE_REQUIREMENTS.keys())
                },
                "location_rules": {
                    "format": "dictionary",
                    "type_field": "type",
                    "valid_types": ["item_check", "and", "or", "constant"]
                },
                "item_format": {
                    "key_items": ["Bridge", "Magnet", "Sword", "Yellow Key", "Black Key", "White Key"]
                }
            },
            "special_handling": {
                "CreditsWall": "Special handling required for CreditsWall entrance"
            }
        } 