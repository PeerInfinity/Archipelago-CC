"""Extract traverse lambdas from Super Metroid AccessPoint objects.

This module provides functionality to extract the traverse function from
AccessPoint objects, which is needed to properly export exit rules that
reference the 'ret' variable from the Cache.ldeco decorator.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def get_accesspoint_traverse_funcs(world) -> Dict[str, Any]:
    """Extract traverse functions from all AccessPoints in the world.

    Args:
        world: The SM world instance

    Returns:
        Dict mapping AccessPoint name to its traverse function
    """
    traverse_funcs = {}

    try:
        # Import the Logic module which contains accessPoints
        from worlds.sm.variaRandomizer.logic.logic import Logic

        # Logic.accessPoints is a list of AccessPoint objects
        for ap in Logic.accessPoints:
            ap_name = ap.Name
            traverse_func = ap.traverse

            # Store the traverse function for this AccessPoint
            traverse_funcs[ap_name] = traverse_func
            logger.debug(f"SM: Extracted traverse function for AccessPoint '{ap_name}'")

        logger.info(f"SM: Extracted traverse functions for {len(traverse_funcs)} AccessPoints")

    except Exception as e:
        logger.error(f"SM: Failed to extract AccessPoint traverse functions: {e}", exc_info=True)

    return traverse_funcs


def get_transitions_for_accesspoint(world, ap_name: str) -> Dict[str, Any]:
    """Get all transitions for a specific AccessPoint.

    Args:
        world: The SM world instance
        ap_name: The AccessPoint name

    Returns:
        Dict mapping destination name to transition function
    """
    try:
        from worlds.sm.variaRandomizer.logic.logic import Logic

        for ap in Logic.accessPoints:
            if ap.Name == ap_name:
                # Return the transitions dictionary (includes both intra and inter-area)
                return ap.transitions

        logger.warning(f"SM: AccessPoint '{ap_name}' not found")
        return {}

    except Exception as e:
        logger.error(f"SM: Failed to get transitions for '{ap_name}': {e}", exc_info=True)
        return {}
