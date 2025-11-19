"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system. Instead of static
    analysis, we extract requirements directly from the zz_loc.req object.
    """
    GAME_NAME = 'Zillion'

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions in its access rules."""
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Extract access rules directly from the zz_loc.req object.

        The zilliandomizer library stores exact requirements in the location's
        zz_loc.req attribute, which includes:
        - gun: number of Zillion items needed
        - jump: number of Opa-Opa items needed
        - floppy: number of Floppy Disk items needed
        - red: number of Red ID Card items needed
        - char: starting characters (always available, not a requirement)
        - skill, hp: skill and health requirements (not yet implemented)
        """
        if not hasattr(location, 'zz_loc'):
            # Not a Zillion location
            return None

        zz_loc = location.zz_loc
        if not hasattr(zz_loc, 'req'):
            return None

        req = zz_loc.req

        # Build list of required conditions
        conditions: List[Dict[str, Any]] = []

        # Map zilliandomizer requirements to Archipelago item names
        # In Zillion, gun=1 and jump=1 are the starting state (no items needed)
        # gun=2 means you need 1 Zillion, gun=3 means you need 2 Zillion, etc.
        # jump=2 means you need 1 Opa-Opa, jump=3 means you need 2 Opa-Opa, etc.

        # gun -> Zillion
        if hasattr(req, 'gun') and req.gun > 1:
            rule = {'type': 'item_check', 'item': 'Zillion'}
            if req.gun > 2:
                rule['count'] = {'type': 'constant', 'value': req.gun - 1}
            conditions.append(rule)

        # jump -> Opa-Opa
        if hasattr(req, 'jump') and req.jump > 1:
            rule = {'type': 'item_check', 'item': 'Opa-Opa'}
            if req.jump > 2:
                rule['count'] = {'type': 'constant', 'value': req.jump - 1}
            conditions.append(rule)

        # floppy -> Floppy Disk
        if hasattr(req, 'floppy') and req.floppy > 0:
            rule = {'type': 'item_check', 'item': 'Floppy Disk'}
            if req.floppy > 1:
                rule['count'] = {'type': 'constant', 'value': req.floppy}
            conditions.append(rule)

        # red -> Red ID Card
        if hasattr(req, 'red') and req.red > 0:
            rule = {'type': 'item_check', 'item': 'Red ID Card'}
            if req.red > 1:
                rule['count'] = {'type': 'constant', 'value': req.red}
            conditions.append(rule)

        # Note: char field represents starting characters (JJ, Apple, Champ)
        # These are always available from the start, not items to collect
        # So we don't add them as requirements

        # If no conditions, location is accessible with no requirements
        if not conditions:
            return {'type': 'constant', 'value': True}

        # If only one condition, return it directly
        if len(conditions) == 1:
            return conditions[0]

        # Multiple conditions - combine with AND
        return {
            'type': 'and',
            'conditions': conditions
        }

