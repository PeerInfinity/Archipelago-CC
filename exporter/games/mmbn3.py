"""MegaMan Battle Network 3 game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MMBN3GameExportHandler(GenericGameExportHandler):
    """Export handler for MegaMan Battle Network 3.

    This handler exports the explore_score helper definition, which calculates
    a progression score based on reachable regions. The helper is defined as a
    method on the world class in Python, so we manually export it as a rule
    definition that the frontend can evaluate.
    """

    GAME_NAME = 'MegaMan Battle Network 3'
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Export MMBN3 helper definitions.

        MMBN3's explore_score helper is defined as a method on the world class,
        so we need to manually export it as a rule definition.
        """
        helpers = {}

        # Helper function to create a can_reach rule for a region
        # We wrap can_reach in a comparison to handle undefined (unknown) regions
        # by treating them as unreachable (false). This matches the JavaScript
        # helper behavior which returns false for unknown regions.
        def can_reach_region(region_name: str):
            return {
                'type': 'compare',
                'left': {
                    'type': 'can_reach',
                    'region': {'type': 'constant', 'value': region_name}
                },
                'op': '==',
                'right': {'type': 'constant', 'value': True}
            }

        # Helper function to create a conditional score contribution
        def score_if_reachable(region_name: str, score: int):
            return {
                'type': 'conditional',
                'test': can_reach_region(region_name),
                'if_true': {'type': 'constant', 'value': score},
                'if_false': {'type': 'constant', 'value': 0}
            }

        # Build the explore_score helper
        # Logic: If WWW Island is reachable, return 999
        # Otherwise, sum up scores for each reachable region:
        #   SciLab Overworld: +3, SciLab Cyberworld: +1
        #   Yoka Overworld: +2, Yoka Cyberworld: +1
        #   Beach Overworld: +3, Beach Cyberworld: +1
        #   Undernet: +2, Deep Undernet: +1, Secret Area: +1

        # Build the sum of region scores using nested binary_op
        # Start with the last term and work backwards
        region_scores = [
            ('SciLab Overworld', 3),
            ('SciLab Cyberworld', 1),
            ('Yoka Overworld', 2),
            ('Yoka Cyberworld', 1),
            ('Beach Overworld', 3),
            ('Beach Cyberworld', 1),
            ('Undernet', 2),
            ('Deep Undernet', 1),
            ('Secret Area', 1),
        ]

        # Build the sum expression
        score_sum = score_if_reachable(region_scores[0][0], region_scores[0][1])
        for region_name, score in region_scores[1:]:
            score_sum = {
                'type': 'binary_op',
                'op': '+',
                'left': score_sum,
                'right': score_if_reachable(region_name, score)
            }

        # Final explore_score: if WWW Island reachable then 999 else sum
        helpers['explore_score'] = {
            'type': 'conditional',
            'test': can_reach_region('WWW Island'),
            'if_true': {'type': 'constant', 'value': 999},
            'if_false': score_sum
        }

        return helpers
