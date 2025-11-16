"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging
import json
import os

logger = logging.getLogger(__name__)

# Import zilliandomizer lookup tables for character abilities
try:
    from zilliandomizer.options import char_to_gun, char_to_jump
except ImportError:
    logger.error("Failed to import zilliandomizer.options. Is zilliandomizer installed?")
    char_to_gun = {}
    char_to_jump = {}

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system.
    Requirements are character-dependent and based on:
    - Gun power (from Zillion items and character rescues)
    - Jump power (from Opa-Opa items via leveling and character rescues)
    - Red ID Cards
    - Floppy Disks
    """
    GAME_NAME = 'Zillion'

    def __init__(self):
        super().__init__()
        # Zillion doesn't use helper functions - logic is in zilliandomizer library
        self.known_helpers = set()
        # Cache world options
        self.start_char = None
        self.gun_levels = None
        self.jump_levels = None
        self.opas_per_level = None

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions."""
        # Log if we encounter any helpers (shouldn't happen)
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def _load_world_options(self, world):
        """Load Zillion world options for requirement calculations."""
        if self.start_char is None:
            # Get options from world
            options = world.options

            # Start character (JJ, Apple, or Champ)
            self.start_char = options.start_char.get_char() if hasattr(options.start_char, 'get_char') else 'JJ'

            # Gun levels setting (vanilla, balanced, low, restrictive) - lowercase for lookup
            self.gun_levels = (options.gun_levels.current_option_name if hasattr(options, 'gun_levels') else 'balanced').lower()

            # Jump levels setting (vanilla, balanced, low, restrictive) - lowercase for lookup
            self.jump_levels = (options.jump_levels.current_option_name if hasattr(options, 'jump_levels') else 'balanced').lower()

            # Opa-Opas needed per level (default 2)
            self.opas_per_level = options.opas_per_level.value if hasattr(options, 'opas_per_level') else 2

            logger.info(f"Zillion world options: start_char={self.start_char}, gun_levels={self.gun_levels}, "
                       f"jump_levels={self.jump_levels}, opas_per_level={self.opas_per_level}")

    def _get_gun_requirement(self, req_gun: int) -> Optional[Dict[str, Any]]:
        """
        Calculate the gun requirement based on character and settings.

        The req_gun value represents the minimum number of Zillion items needed.
        gun=N means: need N Zillion items (giving gun_prog[N] power for the starting character).

        Returns None if accessible from start, otherwise returns rule for Zillion items/rescues.
        """
        if req_gun == 0:
            return None  # No gun requirement

        # Get gun progression table for starting character
        gun_prog = char_to_gun.get(self.start_char, {}).get(self.gun_levels, [1])

        # The requirement gun=N means we need the gun power from gun_prog[N]
        # To get gun_prog[N], we need N Zillion items
        # So the requirement is simply: need >= N Zillion items
        zillion_condition = {
            'type': 'item_check',
            'item': 'Zillion',
            'count': {'type': 'constant', 'value': req_gun}
        }

        # Check if rescue items can provide alternative paths
        # A rescue gives the rescued character's starting power
        rescue_alternatives = []
        for rescue_char in ['Apple', 'Champ']:
            if rescue_char != self.start_char:
                rescue_prog = char_to_gun.get(rescue_char, {}).get(self.gun_levels, [1])
                # Check if this rescue's starting power is enough
                # We need gun_prog[req_gun] power, so check if rescue_prog[0] >= gun_prog[req_gun]
                required_power = gun_prog[req_gun] if req_gun < len(gun_prog) else 999
                if rescue_prog[0] >= required_power:
                    # This rescue gives enough power immediately
                    rescue_alternatives.append({
                        'type': 'item_check',
                        'item': rescue_char
                    })

        if rescue_alternatives:
            # OR: (Zillion count) OR (rescue item)
            return {
                'type': 'or',
                'conditions': [zillion_condition] + rescue_alternatives
            }
        else:
            return zillion_condition

    def _get_jump_requirement(self, req_jump: int) -> Optional[Dict[str, Any]]:
        """
        Calculate the jump requirement based on character and settings.

        The req_jump value represents the minimum jump level needed.
        jump=N means: need jump level N (achieved with N * opas_per_level Opa-Opas).

        Returns None if accessible from start, otherwise returns rule for Opa-Opa items/rescues.
        """
        if req_jump == 0:
            return None  # No jump requirement

        # Get jump progression table for starting character
        jump_prog = char_to_jump.get(self.start_char, {}).get(self.jump_levels, [1])

        # The requirement jump=N means we need the jump power from jump_prog[N]
        # To get jump_prog[N], we need N levels, which requires N * opas_per_level Opa-Opas
        min_opas = req_jump * self.opas_per_level

        # Build Opa-Opa condition
        opa_condition = {
            'type': 'item_check',
            'item': 'Opa-Opa',
            'count': {'type': 'constant', 'value': min_opas}
        }

        # Check if rescue items can provide alternative paths
        # A rescue gives the rescued character's starting power
        rescue_alternatives = []
        for rescue_char in ['Apple', 'Champ']:
            if rescue_char != self.start_char:
                rescue_prog = char_to_jump.get(rescue_char, {}).get(self.jump_levels, [1])
                # Check if this rescue's starting power is enough
                # We need jump_prog[req_jump] power, so check if rescue_prog[0] >= jump_prog[req_jump]
                required_power = jump_prog[req_jump] if req_jump < len(jump_prog) else 999
                if rescue_prog[0] >= required_power:
                    rescue_alternatives.append({
                        'type': 'item_check',
                        'item': rescue_char
                    })

        if rescue_alternatives:
            return {
                'type': 'or',
                'conditions': [opa_condition] + rescue_alternatives
            }
        else:
            return opa_condition

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Determine access rule by analyzing the Zillion location's requirements.

        Zillion uses character-dependent power systems where gun and jump levels
        are achieved through collecting items (Zillion, Opa-Opa) or rescuing characters.
        """
        # Check if this is a Zillion location with zilliandomizer data
        if not hasattr(location, 'zz_loc'):
            return None

        # Load world options (cached after first call)
        self._load_world_options(world)

        zz_loc = location.zz_loc
        req = zz_loc.req

        # Debug logging for problematic locations
        loc_name = location.name if hasattr(location, 'name') else 'unknown'
        # Log all locations that have gun=0 AND jump=0 (should be accessible from start)
        if req.gun == 0 and req.jump == 0 and req.red == 0 and req.floppy == 0:
            logger.info(f"DEBUG zero-req location: {loc_name}: ALL req fields = {vars(req)}")

        conditions = []

        # Gun requirement (character-dependent)
        gun_req = self._get_gun_requirement(req.gun)
        if gun_req:
            conditions.append(gun_req)

        # Jump requirement (character-dependent)
        jump_req = self._get_jump_requirement(req.jump)
        if jump_req:
            conditions.append(jump_req)

        # Red ID Card requirement (direct count)
        red_count = getattr(req, 'red', 0)
        if red_count > 0:
            conditions.append({
                'type': 'item_check',
                'item': 'Red ID Card',
                'count': {'type': 'constant', 'value': red_count}
            })

        # Floppy Disk requirement (direct count)
        floppy_count = getattr(req, 'floppy', 0)
        if floppy_count > 0:
            conditions.append({
                'type': 'item_check',
                'item': 'Floppy Disk',
                'count': {'type': 'constant', 'value': floppy_count}
            })

        # TODO: Handle door, skill, hp, char, and union requirements if needed
        # For now, these are uncommon in typical seeds

        # If no requirements, location is always accessible
        if not conditions:
            return {'type': 'constant', 'value': True}

        # If only one requirement, return it directly
        if len(conditions) == 1:
            return conditions[0]

        # Multiple requirements means AND
        return {
            'type': 'and',
            'conditions': conditions
        }
