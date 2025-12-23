"""Bomb Rush Cyberfunk helper expander."""

import re
import logging
from typing import Dict, Any, Set, Optional
from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)


class BombRushCyberfunkGameExportHandler(GenericGameExportHandler):
    """Export handler for Bomb Rush Cyberfunk."""

    # AUTO_EXPORT_DISCOVERED_HELPERS is True by default in GenericGameExportHandler
    # Helpers too complex for automatic export (contain loops, use globals(), etc.)
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = {
        # Main graffiti spot counting - uses build_access_cache and sums from spot functions
        'graffiti_spots',
        # Access cache builder - uses globals() and iteration
        'build_access_cache',
        # Spot counting functions - all have for loops iterating over dicts
        'spots_s_glitchless',
        'spots_s_glitched',
        'spots_m_glitchless',
        'spots_m_glitched',
        'spots_l_glitchless',
        'spots_l_glitched',
        'spots_xl_glitchless',
        'spots_xl_glitched',
    }

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """Provide custom access rules for Tagged Graffiti Spots locations.

        The original world uses a complex graffiti_spots function that counts
        available graffiti spots based on:
        - S-size spots (no item requirement, just region access)
        - M-size spots (requires graffitim items)
        - L-size spots (requires graffitil items)
        - XL-size spots (requires graffitixl items)
        - Region access (adds more spots of each size)

        With the Hideout (starting area) only and limited_graffiti=False:
        - S base: 10 spots
        - M base: 4 spots (with graffitim)
        - L base: 7 spots (with graffitil)
        - XL base: 3 spots (with graffitixl)

        This provides approximate rules based on these base values plus
        region access requirements for higher thresholds.
        """
        location_name = getattr(location, 'name', None)
        if not location_name or not location_name.startswith("Tagged "):
            return None

        # Parse the threshold from the location name
        match = re.match(r"Tagged (\d+) Graffiti Spots", location_name)
        if not match:
            return None

        threshold = int(match.group(1))
        logger.info(f"BRC: Generating custom rule for '{location_name}' with threshold {threshold}")

        # Build the access rule based on threshold
        # S base = 10 (in Hideout, no items needed)
        # M adds 4 (with any graffitim item)
        # L adds 7 (with any graffitil item)
        # XL adds 3 (with any graffitixl item)
        # Total with all in Hideout: 10 + 4 + 7 + 3 = 24

        if threshold <= 10:
            # S spots alone (10 in Hideout)
            return {'type': 'constant', 'value': True}

        elif threshold <= 13:
            # Need at least XL (10+3=13) or M+XL (10+4+3=17)
            # But L alone (10+7=17) also works
            # Most restrictive: need any graffiti type
            return {
                'type': 'or',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'}
                ]
            }

        elif threshold <= 17:
            # Need L (10+7=17) or M+XL (10+4+3=17)
            return {
                'type': 'or',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitil'},
                    {
                        'type': 'and',
                        'conditions': [
                            {'type': 'group_check', 'group': 'graffitim'},
                            {'type': 'group_check', 'group': 'graffitixl'}
                        ]
                    }
                ]
            }

        elif threshold <= 21:
            # Need M+L (10+4+7=21) or L+XL (10+7+3=20)
            return {
                'type': 'or',
                'conditions': [
                    {
                        'type': 'and',
                        'conditions': [
                            {'type': 'group_check', 'group': 'graffitim'},
                            {'type': 'group_check', 'group': 'graffitil'}
                        ]
                    },
                    {
                        'type': 'and',
                        'conditions': [
                            {'type': 'group_check', 'group': 'graffitil'},
                            {'type': 'group_check', 'group': 'graffitixl'}
                        ]
                    }
                ]
            }

        elif threshold <= 24:
            # Need all three: M+L+XL (10+4+7+3=24)
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'}
                ]
            }

        elif threshold <= 25:
            # Need all three graffiti types + inline skates
            # Inline skates add 1 more L spot: 10+4+8+3=25
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'}
                ]
            }

        elif threshold <= 70:
            # Threshold 26-70: Accessible with Versum Hill entrance (20 REP)
            # + VH roadblock (graffitil) + all graffiti + inline skates
            # Based on sphere log: Tagged 30-70 unlock at sphere 2.1 with 24 REP
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'versum_hill_entrance', 'args': []},
                    {'type': 'helper', 'name': 'versum_hill_ch1_roadblock', 'args': []}
                ]
            }

        elif threshold <= 79:
            # Threshold 71-79: Needs versum_hill_all_challenges (65 REP)
            # Based on sphere log: Tagged 75 unlocks at sphere 3.10 with 88 REP
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'versum_hill_entrance', 'args': []},
                    {'type': 'helper', 'name': 'versum_hill_ch1_roadblock', 'args': []},
                    {'type': 'helper', 'name': 'versum_hill_all_challenges', 'args': []}
                ]
            }

        elif threshold <= 135:
            # Threshold 80-135: Requires Chapter 2 completion
            # Based on sphere log: Tagged 80-135 unlock at sphere 4.5 with Chapter Completed
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 2}]}
                ]
            }

        elif threshold <= 170:
            # Threshold 136-170: Requires Brink Terminal entrance (50 REP)
            # Based on sphere log: Tagged 140-170 unlock at sphere 5.6
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 2}]},
                    {'type': 'helper', 'name': 'brink_terminal_entrance', 'args': []}
                ]
            }

        elif threshold <= 180:
            # Threshold 171-180: Requires Brink Terminal plaza access
            # Based on sphere log: Tagged 175-180 unlock at sphere 5.9
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 2}]},
                    {'type': 'helper', 'name': 'brink_terminal_plaza', 'args': []}
                ]
            }

        elif threshold <= 185:
            # Threshold 181-185: Requires Brink Terminal tower access
            # Based on sphere log: Tagged 185 unlocks at sphere 5.13
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 2}]},
                    {'type': 'helper', 'name': 'brink_terminal_tower', 'args': []}
                ]
            }

        elif threshold <= 245:
            # Threshold 186-245: Requires Chapter 3 completion
            # Based on sphere log: Tagged 190-245 unlock at sphere 6.1 with Chapter Completed
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 3}]}
                ]
            }

        elif threshold <= 265:
            # Threshold 246-265: Requires Millennium Mall theater area (491 REP)
            # Based on sphere log: Tagged 250-265 unlock at sphere 6.6
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'millennium_mall_theater', 'args': []}
                ]
            }

        elif threshold <= 320:
            # Threshold 266-320: Requires Chapter 4 completion + Pyramid Island access
            # Based on sphere log: Tagged 270-320 unlock at sphere 7.5 with Chapter Completed
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 4}]},
                    {'type': 'helper', 'name': 'pyramid_island_entrance', 'args': []}
                ]
            }

        elif threshold <= 329:
            # Threshold 321-329: Requires Chapter 4 + pyramid_island_oldhead (780 REP)
            # Based on sphere log: Tagged 325 unlocks at sphere 7.22
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 4}]},
                    {'type': 'helper', 'name': 'pyramid_island_oldhead', 'args': []}
                ]
            }

        elif threshold <= 340:
            # Threshold 330-340: Requires Chapter 5 completion + Mataan entrance
            # Based on sphere log: Tagged 330-340 unlock at sphere 8.6
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 5}]},
                    {'type': 'helper', 'name': 'mataan_entrance', 'args': []}
                ]
            }

        elif threshold <= 360:
            # Threshold 341-360: Requires Chapter 5 + Mataan deep city
            # Based on sphere log: Tagged 345-360 unlock at sphere 8.9
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'current_chapter', 'args': [{'type': 'constant', 'value': 5}]},
                    {'type': 'helper', 'name': 'mataan_deep_city', 'args': []}
                ]
            }

        elif threshold <= 369:
            # Threshold 361-369 (Tagged 365): Requires Mataan oldhead area (935 REP)
            # Based on sphere log: Tagged 365 unlocks at sphere 8.15 with Red Light District
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'mataan_oldhead', 'args': []}
                ]
            }

        else:
            # Threshold 370-389: Requires Mataan deepest (Lion Statue, Skyscrapers)
            # Based on sphere log: Tagged 370+ unlock at sphere 8.16
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'mataan_deepest', 'args': [
                        {'type': 'constant', 'value': 0},
                        {'type': 'constant', 'value': 0}
                    ]}
                ]
            }

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return progression mapping for REP items.

        In Bomb Rush Cyberfunk, REP items like "8 REP", "16 REP", etc. contribute
        their numeric value to a virtual "rep" counter in state.prog_items.
        """
        return {
            "rep": {
                "type": "additive",
                "items": {
                    "8 REP": 8,
                    "16 REP": 16,
                    "24 REP": 24,
                    "32 REP": 32,
                    "48 REP": 48
                }
            }
        }
