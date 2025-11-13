"""Paint game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)


class PaintGameExportHandler(GenericGameExportHandler):
    """Export handler for Paint game.

    Paint uses a custom location access rule system based on paint percentage calculations.
    The core logic is in the paint_percent_available helper function.

    Each location has an access rule that checks:
        paint_percent_available(state, world, player) >= threshold

    Where threshold is calculated from the location's address: (address % 198600) / 4
    """

    GAME_NAME = 'Paint'

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Override rule analysis for Paint location access rules.

        Paint locations have a custom access_rule method that compares paint_percent_available
        to a threshold derived from the location address.

        Example location: "Similarity: 1.0%" at address 198604
        Threshold: (198604 % 198600) / 4 = 4 / 4 = 1.0% ✓

        Args:
            rule_func: The access_rule function/method
            rule_target_name: The name of the location (e.g., "Similarity: 1.0%")

        Returns:
            A rule dict that compares paint_percent_available to the threshold
        """
        # Check if this is a Paint location access rule
        if rule_target_name and rule_target_name.startswith("Similarity: "):
            logger.info(f"Paint: Overriding rule for location {rule_target_name}")

            # Extract the percentage from the location name
            # Format: "Similarity: X.XX%"
            match = re.match(r"Similarity: ([\d.]+)%", rule_target_name)
            if match:
                threshold_percent = float(match.group(1))
                logger.debug(f"Paint: Extracted threshold {threshold_percent}% from {rule_target_name}")

                # Create the rule structure
                return {
                    'type': 'compare',
                    'left': {
                        'type': 'helper',
                        'name': 'paint_percent_available',
                        'args': []
                    },
                    'op': '>=',
                    'right': {
                        'type': 'constant',
                        'value': threshold_percent
                    }
                }
            else:
                logger.warning(f"Paint: Could not extract threshold from location name: {rule_target_name}")

        # Not a Paint location or couldn't parse - let normal analysis proceed
        return None
