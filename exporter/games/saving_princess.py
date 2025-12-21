"""Saving Princess game-specific export handler."""

import logging
from typing import Any, Dict

from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)


class SavingPrincessGameExportHandler(GenericGameExportHandler):
    """Saving Princess specific rule expander.

    Saving Princess creates both 'progression' and 'useful' copies of some items
    (e.g., Clip Extension has count=2 progression and count_extra=4 useful).
    The useful copies are used for item balancing (via count_extra), but the
    BASE classification is still 'progression' and these items are used in
    access rules.

    This handler ensures the correct base classification is exported by reading
    from the item_dict definitions rather than the placed items.
    """

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return Saving Princess item data with correct base classifications.

        The original world creates extra copies of items with 'useful' classification
        via count_extra, but the item_dict stores the base 'progression' classification.
        We use the base classification to ensure sphere calculations work correctly.
        """
        from BaseClasses import ItemClassification

        item_data = {}

        try:
            # Import the item definitions from the world module
            from worlds.saving_princess.Items import item_dict

            # Classification mapping
            classification_map = {
                ItemClassification.progression: 'progression',
                ItemClassification.progression_skip_balancing: 'progression_skip_balancing',
                ItemClassification.useful: 'useful',
                ItemClassification.filler: 'filler',
                ItemClassification.trap: 'trap',
            }

            for item_name, item_info in item_dict.items():
                # item_info has item_class (base classification), code, count, count_extra
                classification = classification_map.get(item_info.item_class, 'filler')

                # Get groups if available
                groups = []
                if hasattr(world, 'item_name_groups'):
                    groups = [
                        group_name for group_name, items in world.item_name_groups.items()
                        if item_name in items
                    ]

                item_data[item_name] = {
                    'name': item_name,
                    'id': item_info.code,
                    'classification': classification,
                    'groups': sorted(groups),
                    'event': item_info.code is None,
                    'type': None,
                    'max_count': item_info.count + item_info.count_extra if item_info.count else 1
                }

            logger.debug(f"Exported {len(item_data)} items for Saving Princess")

        except ImportError as e:
            logger.warning(f"Could not import Saving Princess items: {e}")
            # Fall back to parent implementation
            return super().get_item_data(world)
        except Exception as e:
            logger.error(f"Error getting Saving Princess item data: {e}")
            return super().get_item_data(world)

        return item_data
