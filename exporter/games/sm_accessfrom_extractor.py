"""Extract AccessFrom data from VARIA locations."""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def get_location_accessfrom_data(world) -> Dict[str, Dict[str, Any]]:
    """Extract AccessFrom data for all VARIA locations.

    Returns a dictionary mapping location names to their AccessFrom information:
    {
        "Location Name": {
            "regions": {
                "Region Name": <lambda function>,
                ...
            },
            "available": <lambda function>,
            "post_available": <lambda function>
        }
    }
    """
    try:
        from worlds.sm.variaRandomizer.graph.vanilla.graph_locations import locationsDict

        accessfrom_data = {}

        for loc_name, loc_obj in locationsDict.items():
            # Extract AccessFrom dictionary (maps region name -> lambda)
            access_from = getattr(loc_obj, 'AccessFrom', None)
            available = getattr(loc_obj, 'Available', None)
            post_available = getattr(loc_obj, 'PostAvailable', None)

            if access_from is not None or available is not None or post_available is not None:
                accessfrom_data[loc_name] = {
                    'regions': access_from if access_from is not None else {},
                    'available': available,
                    'post_available': post_available
                }

        logger.info(f"SM: Extracted AccessFrom data for {len(accessfrom_data)} locations")

        # Log the 3 problematic locations specifically
        for loc_name in ["Screw Attack", "Space Jump", "Missile (green Brinstar below super missile)"]:
            if loc_name in accessfrom_data:
                regions = list(accessfrom_data[loc_name]['regions'].keys())
                logger.info(f"SM: Location '{loc_name}' AccessFrom regions: {regions}")

        return accessfrom_data

    except Exception as e:
        logger.error(f"SM: Failed to extract AccessFrom data: {e}", exc_info=True)
        return {}
