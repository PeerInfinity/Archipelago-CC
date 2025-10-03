"""Blasphemous game-specific exporter."""

from typing import Dict, Any, List, Callable, Optional
from .base import BaseGameExportHandler
import re
import logging
import inspect

logger = logging.getLogger(__name__)

class BlasphemousGameExportHandler(BaseGameExportHandler):
    """Blasphemous-specific rule expander with direct logic data conversion."""
    
    def __init__(self, world):
        """Initialize handler with world reference."""
        super().__init__()  # Base class doesn't take arguments
        self.world = world
        self.player = world.player if hasattr(world, 'player') else 1
        self.blas_logic = None
        self.logic_data_cache = {}
        self.string_rules_map = {}
        
        # Try to get the BlasRules instance and string_rules mapping
        try:
            # Import BlasRules to access string_rules
            from worlds.blasphemous.Rules import BlasRules
            temp_logic = BlasRules(world)
            self.string_rules_map = temp_logic.string_rules if hasattr(temp_logic, 'string_rules') else {}
        except Exception as e:
            logger.debug(f"Could not get string_rules: {e}")
            
        # Load the original logic data
        try:
            from worlds.blasphemous.region_data import regions, locations
            self.regions_data = regions
            self.locations_data = locations
            # Build lookup maps for quick access
            self.region_logic_map = {}
            self.location_logic_map = {}
            for region in regions:
                for exit in region.get('exits', []):
                    key = f"{region['name']} -> {exit['target']}"
                    self.region_logic_map[key] = exit.get('logic', [])
            for location in locations:
                self.location_logic_map[location['name']] = location.get('logic', [])
        except ImportError:
            logger.warning("Could not import Blasphemous logic data")
            self.regions_data = []
            self.locations_data = []
    
    def override_rule_analysis(self, rule_func, rule_target_name: str = None) -> Optional[Dict[str, Any]]:
        """Override rule analysis for Blasphemous to reconstruct from original logic data."""
        # Check if this is a location or exit rule
        if rule_target_name:
            # Try to match location logic
            for loc_name in self.location_logic_map:
                if loc_name in rule_target_name:
                    logic_data = self.location_logic_map[loc_name]
                    if logic_data:
                        return self._convert_logic_data_to_rule(logic_data)
                        
            # Try to match exit logic
            for exit_key in self.region_logic_map:
                if exit_key in rule_target_name or exit_key.replace(' -> ', ' ') in rule_target_name:
                    logic_data = self.region_logic_map[exit_key]
                    if logic_data:
                        return self._convert_logic_data_to_rule(logic_data)
        
        return None  # Let normal analysis proceed
    
    def _convert_logic_data_to_rule(self, logic_data: List[Dict]) -> Dict[str, Any]:
        """Convert Blasphemous logic data structure to rule format."""
        if not logic_data:
            return {'type': 'constant', 'value': True}
            
        clauses = []
        for clause in logic_data:
            reqs = []
            
            # Process item requirements
            for item_req in clause.get('item_requirements', []):
                if self._is_region(item_req):
                    # Region requirement
                    reqs.append({'type': 'can_reach', 'region': item_req})
                elif item_req in self.string_rules_map:
                    # Reference to a string rule (helper method)
                    reqs.append(self._expand_string_rule(item_req))
                else:
                    # Unknown requirement - treat as helper
                    reqs.append({'type': 'helper', 'name': item_req})
            
            # Combine requirements for this clause
            if len(reqs) == 0:
                clause_rule = {'type': 'constant', 'value': True}
            elif len(reqs) == 1:
                clause_rule = reqs[0]
            else:
                clause_rule = {'type': 'and', 'conditions': reqs}
            
            clauses.append(clause_rule)
        
        # Combine all clauses with OR
        if len(clauses) == 0:
            return {'type': 'constant', 'value': True}
        elif len(clauses) == 1:
            return clauses[0]
        else:
            return {'type': 'or', 'conditions': clauses}
    
    def _is_region(self, string: str) -> bool:
        """Check if a string represents a region ID."""
        return ((len(string) > 6 and string[0] == "D" and string[3] == "Z" and string[6] == "S") or
                (len(string) > 7 and string[0] == "D" and string[3] == "B" and string[4] == "Z" and string[7] == "S"))
    
    def _expand_string_rule(self, rule_name: str) -> Dict[str, Any]:
        """Expand a string rule reference to its actual rule."""
        # Map of known string rules to their expansions - these correspond to BlasRules.string_rules
        string_rule_expansions = {
            # Movement abilities
            'dash': {'type': 'item_check', 'item': 'Dash Ability'},
            'wallclimb': {'type': 'item_check', 'item': 'Wall Climb Ability'},
            'DoubleJump': {'type': 'constant', 'value': True},  # Based on options.purified_hand
            
            # Logic difficulty flags
            'NormalLogic': {'type': 'constant', 'value': True},  # Based on options.difficulty >= 1
            'HardLogic': {'type': 'constant', 'value': False},   # Based on options.difficulty >= 2
            'EnemySkipsAllowed': {'type': 'constant', 'value': False},
            'MourningSkipAllowed': {'type': 'constant', 'value': False},
            'upwarpSkipsAllowed': {'type': 'constant', 'value': False},
            'preciseSkipsAllowed': {'type': 'constant', 'value': False},
            
            # Key items
            'blood': {'type': 'item_check', 'item': 'Blood Perpetuated in Sand'},
            'root': {'type': 'item_check', 'item': 'Three Gnarled Tongues'},
            'linen': {'type': 'item_check', 'item': 'Linen of Golden Thread'},
            'nail': {'type': 'item_check', 'item': 'Nail Uprooted from Dirt'},
            'shroud': {'type': 'item_check', 'item': 'Shroud of Dreamt Sins'},
            'lung': {'type': 'item_check', 'item': 'Silvered Lung of Dolphos'},
            'keys': {
                'type': 'and',
                'conditions': [
                    {'type': 'item_check', 'item': 'Key of the High Peaks'},
                    {'type': 'item_check', 'item': 'Key of the Scribe'},
                    {'type': 'item_check', 'item': 'Key of the Inquisitor'}
                ]
            },
            'wheel': {'type': 'item_check', 'item': 'Young Mason\'s Wheel'},
            'cloth': {'type': 'item_check', 'item': 'Cloth Ribbon'},
            'hand': {'type': 'item_check', 'item': 'Severed Hand'},
            'hatchet': {'type': 'item_check', 'item': 'Hatched Egg of Deformity'},
            'elderkey': {'type': 'item_check', 'item': 'Elder Key'},
            'traitorkey': {'type': 'item_check', 'item': 'Traitor\'s Eyes'},
            'woodkey': {'type': 'item_check', 'item': 'Petrified Bell'},
            
            # Prayer items
            'aubade': {'type': 'item_check', 'item': 'Aubade'},
            'cantina': {'type': 'item_check', 'item': 'Cantina of the Blue Rose'},
            'verses4': {'type': 'item_check', 'item': 'Verses Spun from Gold IV'},
            'pillar': {'type': 'item_check', 'item': 'Pillar of Salt'},
            'verses3': {'type': 'item_check', 'item': 'Verses Spun from Gold III'},
            'verses2': {'type': 'item_check', 'item': 'Verses Spun from Gold II'},
            'tirana': {'type': 'item_check', 'item': 'Taranto to my Sister'},
            'cante': {'type': 'item_check', 'item': 'Cante Jondo of the Three Sisters'},
            'cord': {'type': 'item_check', 'item': 'Cord of the True Burying'},
            'debla': {'type': 'item_check', 'item': 'Debla of the Lights'},
            'verdiales': {'type': 'item_check', 'item': 'Verdiales of the Forsaken Hamlet'},
            'zarabanda': {'type': 'item_check', 'item': 'Zarabanda of the Safe Haven'},
            'cloistered_ruby': {'type': 'item_check', 'item': 'Cloistered Ruby'},
            'dried_clove': {'type': 'item_check', 'item': 'Dried Clove'},
            'incorrupt_hand': {'type': 'item_check', 'item': 'Incorrupt Hand of the Fraternal Master'},
            'olive': {'type': 'item_check', 'item': 'Olive Seeds'},
            'blessing': {'type': 'item_check', 'item': 'Quicksilver'},
            
            # Special complex rules - these would need proper implementation
            'openedBotSSLadder': {
                'type': 'or',
                'conditions': [
                    {'type': 'can_reach', 'region': 'D17Z01S05[S]'},
                    {'type': 'can_reach', 'region': 'D17BZ02S01[FrontR]'}
                ]
            },
            'canBeatBrotherhoodBoss': {
                'type': 'helper',
                'name': 'canBeatBrotherhoodBoss'  # Complex logic that needs custom implementation
            },
            
            # Bell items
            'bell': {'type': 'item_check', 'item': 'Dried Flowers Bathed in Tears'},
            'redWax': {'type': 'item_check', 'item': 'Smoking Heart of Incense'},
            'blueWax': {'type': 'item_check', 'item': 'Apodictic Heart of Mea Culpa'},
            
            # Gate/door states
            'openedDCGateW': {'type': 'helper', 'name': 'openedDCGateW'},
            'openedDCGateE': {'type': 'helper', 'name': 'openedDCGateE'},
            'openedDCLadder': {'type': 'helper', 'name': 'openedDCLadder'},
            'openedARLadder': {'type': 'helper', 'name': 'openedARLadder'},
            'brokeBotTCStatue': {'type': 'helper', 'name': 'brokeBotTCStatue'},
            'openedWotHPGate': {'type': 'helper', 'name': 'openedWotHPGate'},
            
            # Boss checks
            'canBeatMercyBoss': {'type': 'helper', 'name': 'canBeatMercyBoss'},
            'canBeatConventBoss': {'type': 'helper', 'name': 'canBeatConventBoss'},
            'canBeatGrievanceBoss': {'type': 'helper', 'name': 'canBeatGrievanceBoss'},
            'canBeatJondoBoss': {'type': 'helper', 'name': 'canBeatJondoBoss'},
            'canBeatMothersBoss': {'type': 'helper', 'name': 'canBeatMothersBoss'},
            'canBeatCanvasesBoss': {'type': 'helper', 'name': 'canBeatCanvasesBoss'},
            'canBeatPrisonBoss': {'type': 'helper', 'name': 'canBeatPrisonBoss'},
            'canBeatBridgeBoss': {'type': 'helper', 'name': 'canBeatBridgeBoss'},
            'canBeatHallBoss': {'type': 'helper', 'name': 'canBeatHallBoss'},
            'canBeatRooftopsBoss': {'type': 'helper', 'name': 'canBeatRooftopsBoss'},
            'canBeatLegionary': {'type': 'helper', 'name': 'canBeatLegionary'},
            
            # Other items
            'masks': {'type': 'item_check', 'item': 'Mask'},
        }
        
        if rule_name in string_rule_expansions:
            return string_rule_expansions[rule_name]
        
        # If not found, try the self.method pattern
        return self._expand_self_helper({'name': f'self.{rule_name}'})
    
    def postprocess_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Postprocess rules to handle Blasphemous-specific runtime lambda issues."""
        if not rule:
            return rule

        # Handle all_of rules with unresolved iterators
        if rule.get('type') == 'all_of' and rule.get('iterator_info'):
            iterator_info = rule.get('iterator_info', {})
            if iterator_info.get('iterator', {}).get('name') == 'reqs':
                # This is a runtime-generated lambda that we can't fully reconstruct
                # Return a placeholder that the frontend can handle
                return {'type': 'constant', 'value': True}

        # Handle any_of rules with unresolved iterators
        if rule.get('type') == 'any_of' and rule.get('iterator_info'):
            iterator_info = rule.get('iterator_info', {})
            if iterator_info.get('iterator', {}).get('name') == 'clauses':
                # This is also a runtime-generated lambda
                return {'type': 'constant', 'value': True}

        # Handle helper calls that reference self
        if rule.get('type') == 'helper' and 'self' in rule.get('name', ''):
            return self._expand_self_helper(rule)

        # Handle function_call nodes that call methods on self
        if rule.get('type') == 'function_call':
            func = rule.get('function', {})
            if func.get('type') == 'attribute':
                obj = func.get('object', {})
                if obj.get('type') == 'name' and obj.get('name') == 'self':
                    # This is a call to self.method_name(args...)
                    method_name = func.get('attr')
                    # Preserve arguments, filtering out the 'state' parameter (first arg)
                    args = rule.get('args', [])
                    # The first argument is typically 'state', skip it
                    # Keep all subsequent arguments (like boss names, etc.)
                    filtered_args = []
                    for i, arg in enumerate(args):
                        # Skip first arg if it's a name reference to 'state'
                        if i == 0 and arg.get('type') == 'name' and arg.get('name') == 'state':
                            continue
                        filtered_args.append(arg)

                    result = {'type': 'helper', 'name': method_name}
                    if filtered_args:
                        result['args'] = filtered_args
                    return result

        # Recursively process nested rules
        if rule.get('type') in ['and', 'or']:
            conditions = rule.get('conditions', [])
            rule['conditions'] = [self.postprocess_rule(cond) for cond in conditions]
        elif rule.get('type') == 'not':
            if 'condition' in rule:
                rule['condition'] = self.postprocess_rule(rule['condition'])
            if 'operand' in rule:
                rule['operand'] = self.postprocess_rule(rule['operand'])
        elif rule.get('type') == 'compare':
            # Recursively process left and right sides of comparisons
            if 'left' in rule:
                rule['left'] = self.postprocess_rule(rule['left'])
            if 'right' in rule:
                rule['right'] = self.postprocess_rule(rule['right'])
        elif rule.get('type') == 'generator_expression':
            # Process the element of generator expressions
            if 'element' in rule:
                rule['element'] = self.postprocess_rule(rule['element'])

        return rule
    
    def _reconstruct_runtime_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Reconstruct runtime-generated rules from Blasphemous load_rule function."""
        
        # For all_of with 'reqs' iterator, this represents: all(req(state) for req in reqs)
        # The actual requirements would have been built from item_requirements in the logic
        if rule.get('type') == 'all_of':
            # Since we can't access the runtime values, return a placeholder
            # that indicates this location needs the original logic data
            return {
                'type': 'placeholder_rule',
                'original_type': 'all_of_reqs',
                'description': 'Runtime-generated rule that requires original logic data'
            }
            
        # For any_of with 'clauses' iterator, this represents: any(clause(state) for clause in clauses)  
        if rule.get('type') == 'any_of':
            return {
                'type': 'placeholder_rule',
                'original_type': 'any_of_clauses',
                'description': 'Runtime-generated rule with multiple OR clauses'
            }
            
        return rule
    
    def _expand_self_helper(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand helper methods that reference self (BlasRules instance methods)."""
        
        helper_name = rule.get('name', '').replace('self.', '')
        
        # Map BlasRules methods to their logic
        blas_methods = {
            'blood': {'type': 'item_check', 'item': 'Blood Perpetuated in Sand'},
            'root': {'type': 'item_check', 'item': 'Three Gnarled Tongues'},
            'linen': {'type': 'item_check', 'item': 'Linen of Golden Thread'},
            'nail': {'type': 'item_check', 'item': 'Nail Uprooted from Dirt'},
            'shroud': {'type': 'item_check', 'item': 'Shroud of Dreamt Sins'},
            'lung': {'type': 'item_check', 'item': 'Silvered Lung of Dolphos'},
            'keys': {
                'type': 'and',
                'conditions': [
                    {'type': 'item_check', 'item': 'Key of the High Peaks'},
                    {'type': 'item_check', 'item': 'Key of the Scribe'},
                    {'type': 'item_check', 'item': 'Key of the Inquisitor'}
                ]
            },
            'wheel': {'type': 'item_check', 'item': 'Young Mason\'s Wheel'},
            'cloth': {'type': 'item_check', 'item': 'Cloth Ribbon'},
            'hand': {'type': 'item_check', 'item': 'Severed Hand'},
            'hatchet': {'type': 'item_check', 'item': 'Hatched Egg of Deformity'},
            'elderkey': {'type': 'item_check', 'item': 'Elder Key'},
            'traitorkey': {'type': 'item_check', 'item': 'Traitor\'s Eyes'},
            'woodkey': {'type': 'item_check', 'item': 'Petrified Bell'},
            'dash': {'type': 'item_check', 'item': 'Dash Ability'},
            'wallclimb': {'type': 'item_check', 'item': 'Wall Climb Ability'},
            'aubade': {'type': 'item_check', 'item': 'Aubade'},
            'cantina': {'type': 'item_check', 'item': 'Cantina of the Blue Rose'},
            'verses4': {'type': 'item_check', 'item': 'Verses Spun from Gold IV'},
            'pillar': {'type': 'item_check', 'item': 'Pillar of Salt'},
            'verses3': {'type': 'item_check', 'item': 'Verses Spun from Gold III'},
            'verses2': {'type': 'item_check', 'item': 'Verses Spun from Gold II'},
            'tirana': {'type': 'item_check', 'item': 'Taranto to my Sister'},
            'cante': {'type': 'item_check', 'item': 'Cante Jondo of the Three Sisters'},
            'cord': {'type': 'item_check', 'item': 'Cord of the True Burying'},
            'debla': {'type': 'item_check', 'item': 'Debla of the Lights'},
            'verdiales': {'type': 'item_check', 'item': 'Verdiales of the Forsaken Hamlet'},
            'zarabanda': {'type': 'item_check', 'item': 'Zarabanda of the Safe Haven'},
            'cloistered_ruby': {'type': 'item_check', 'item': 'Cloistered Ruby'},
            'dried_clove': {'type': 'item_check', 'item': 'Dried Clove'},
            'incorrupt_hand': {'type': 'item_check', 'item': 'Incorrupt Hand of the Fraternal Master'},
            'olive': {'type': 'item_check', 'item': 'Olive Seeds'},
            'blessing': {'type': 'item_check', 'item': 'Quicksilver'},
        }
        
        # Check if we have a mapping for this method
        if helper_name in blas_methods:
            return blas_methods[helper_name]
            
        # Check for parameterized methods
        if helper_name.startswith('thorns'):
            # Extract thorn count if present
            match = re.search(r'thorns\((\d+)\)', helper_name)
            if match:
                count = int(match.group(1))
                return {'type': 'item_check', 'item': 'Thorn Upgrade', 'count': {'type': 'constant', 'value': count}}
                
        if helper_name.startswith('tears'):
            # Extract tear count if present
            match = re.search(r'tears\((\d+)\)', helper_name)
            if match:
                count = int(match.group(1))
                return {'type': 'item_check', 'item': 'Tears of Atonement', 'count': {'type': 'constant', 'value': count}}
                
        # Return as generic helper if not found
        return {
            'type': 'helper',
            'name': helper_name,
            'args': rule.get('args', [])
        }
    
    def expand_helper(self, helper_name: str):
        """Expand Blasphemous-specific helper functions."""
        
        # First check if it's a self reference
        if helper_name.startswith('self.'):
            return self._expand_self_helper({'name': helper_name})
        
        # Common Blasphemous helpers based on game mechanics
        blasphemous_helpers = {
            # Movement/traversal helpers
            'can_climb': {
                'type': 'item_check',
                'item': 'Wall Climb Ability'
            },
            'can_dive_laser': {
                'type': 'item_check', 
                'item': 'Dive Laser Ability'
            },
            'can_air_dash': {
                'type': 'item_check',
                'item': 'Air Dash Ability'
            },
            'can_wall_climb': {
                'type': 'item_check',
                'item': 'Wall Climb Ability'
            },
            'can_break_holes': {
                'type': 'item_check',
                'item': 'Break Holes Ability'
            },
            'can_survive_poison': {
                'type': 'item_check',
                'item': 'Poison Immunity'
            },
            'can_walk_on_root': {
                'type': 'item_check',
                'item': 'Root Walking Ability'
            },
            
            # Prayer/relic helpers
            'has_prayer': {
                'type': 'generic_helper',
                'description': 'Requires having prayer ability'
            },
            'has_relic': {
                'type': 'generic_helper', 
                'description': 'Requires having relic'
            },
            
            # Boss/area access helpers
            'can_reach_brotherhood': {
                'type': 'can_reach',
                'region': 'Brotherhood of the Silent Sorrow'
            },
            'can_reach_wasteland': {
                'type': 'can_reach',
                'region': 'Where Olive Trees Wither'
            },
            'can_reach_grievance': {
                'type': 'can_reach',
                'region': 'Grievance Ascends'
            },
            'can_reach_convent': {
                'type': 'can_reach',
                'region': 'Convent of Our Lady of the Charred Visage'
            },
            'can_reach_sleeping_canvases': {
                'type': 'can_reach',
                'region': 'Sleeping Canvases'
            },
            'can_reach_mother_of_mothers': {
                'type': 'can_reach', 
                'region': 'Mother of Mothers'
            },
        }
        
        # Return specific helper if found
        if helper_name in blasphemous_helpers:
            return blasphemous_helpers[helper_name]
            
        # Try pattern matching for dynamic helpers
        return self._expand_dynamic_helper(helper_name)
        
    def _expand_dynamic_helper(self, helper_name: str):
        """Expand helpers based on common Blasphemous patterns."""
        
        # Boss defeat patterns
        if helper_name.startswith('defeated_'):
            boss_name = helper_name.replace('defeated_', '').replace('_', ' ').title()
            return {
                'type': 'boss_check',
                'boss': boss_name,
                'description': f'Requires defeating {boss_name}'
            }
            
        # Area access patterns  
        if helper_name.startswith('can_reach_'):
            area_name = helper_name.replace('can_reach_', '').replace('_', ' ').title()
            return {
                'type': 'can_reach',
                'region': area_name,
                'description': f'Requires access to {area_name}'
            }
            
        # Item requirement patterns
        if helper_name.startswith('has_'):
            item_name = helper_name.replace('has_', '').replace('_', ' ').title()
            return {
                'type': 'item_check',
                'item': item_name,
                'description': f'Requires having {item_name}'
            }
            
        # Ability patterns
        if helper_name.startswith('can_'):
            ability = helper_name.replace('can_', '').replace('_', ' ')
            return {
                'type': 'capability',
                'capability': ability,
                'description': f'Requires ability to {ability}'
            }
            
        # Default to preserving unknown helpers
        return None
        
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand rule functions with Blasphemous-specific logic."""
        if not rule:
            return rule
            
        # Handle analyzed functions that might contain game-specific logic
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            return self._analyze_blasphemous_rule(rule)
            
        # Standard helper expansion
        if rule['type'] == 'helper':
            expanded = self.expand_helper(rule['name'])
            return expanded if expanded else rule
            
        # Recurse into compound rules
        if rule['type'] in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]
            
        return rule
        
    def _analyze_blasphemous_rule(self, rule):
        """Analyze Blasphemous-specific __analyzed_func__ rules."""
        
        # Try to extract information from original rule
        if 'original' in rule:
            original = rule['original']
            
            # Look for state method calls
            if original.get('type') == 'state_method':
                method = original.get('method', '')
                args = original.get('args', [])
                
                # Handle common state methods
                if method == 'has' and len(args) >= 1:
                    result = {
                        'type': 'item_check',
                        'item': args[0]
                    }
                    # Add count if present
                    if len(args) >= 3 and isinstance(args[2], int):
                        result['count'] = {'type': 'constant', 'value': args[2]}
                    return result
                    
                elif method == 'can_reach' and len(args) >= 1:
                    return {
                        'type': 'can_reach',
                        'region': args[0]
                    }
                    
        # Fallback to generic handling
        return {
            'type': 'generic_rule',
            'description': 'Blasphemous-specific rule that needs manual implementation'
        }