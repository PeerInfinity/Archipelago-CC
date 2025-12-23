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

        elif threshold <= 31:
            # Threshold 26-31: versum_hill_entrance + inline_skates + all graffiti types
            # S: 11, M: 7, L: 10 (with inline_skates), XL: 3 = 31 max
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'versum_hill_entrance', 'args': []}
                ]
            }

        elif threshold <= 74:
            # Threshold 32-74: versum_hill_entrance + versum_hill_ch1_roadblock + all graffiti types
            # S: 22, M: 20, L: 23 (with inline_skates), XL: 9 = 74 max
            # The spot counting is sequential - you need versum_hill_entrance first to get the ch1_roadblock spots
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

        elif threshold <= 78:
            # Threshold 75-78: versum_hill_entrance + ch1_roadblock + all_challenges + all graffiti types
            # S: 22, M: 23, L: 24, XL: 9 = 78 max (with all_challenges)
            # versum_hill_all_challenges requires 65 REP
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

        elif threshold <= 79:
            # Threshold 79: add basketball_court requirement
            # S: 22, M: 23, L: 24, XL: 10 = 79 max with basketball_court
            # versum_hill_basketball_court requires 90 REP
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'versum_hill_entrance', 'args': []},
                    {'type': 'helper', 'name': 'versum_hill_ch1_roadblock', 'args': []},
                    {'type': 'helper', 'name': 'versum_hill_all_challenges', 'args': []},
                    {'type': 'helper', 'name': 'versum_hill_basketball_court', 'args': []}
                ]
            }

        elif threshold <= 135:
            # Threshold 80-135: chapter 2 access + all graffiti types
            # Chapter 2 provides spots: S=34, M=39, L=38, XL=19 = 130
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
            # Threshold 136-170: brink_terminal_entrance + all graffiti types
            # Brink Terminal adds more spots after chapter 2
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'brink_terminal_entrance', 'args': []}
                ]
            }

        elif threshold <= 189:
            # Threshold 171-189: brink_terminal_plaza + all graffiti types
            # Further Brink Terminal progress needed for these spots
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'brink_terminal_plaza', 'args': []}
                ]
            }

        elif threshold <= 269:
            # Threshold 190-269: millennium_mall_entrance + all graffiti types
            # Millennium Mall adds more spots after Brink Terminal
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'millennium_mall_entrance', 'args': []}
                ]
            }

        else:
            # Threshold > 269: pyramid_island_entrance + all graffiti types
            # Pyramid Island provides the remaining spots
            return {
                'type': 'and',
                'conditions': [
                    {'type': 'group_check', 'group': 'graffitim'},
                    {'type': 'group_check', 'group': 'graffitil'},
                    {'type': 'group_check', 'group': 'graffitixl'},
                    {'type': 'group_check', 'group': 'skates'},
                    {'type': 'helper', 'name': 'pyramid_island_entrance', 'args': []}
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
