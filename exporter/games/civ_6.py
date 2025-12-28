"""Civilization VI export handler."""

from typing import Dict, Any, List, Callable

from .generic import GenericGameExportHandler


def _get_era_non_progressive_items(world, multiworld, player) -> Dict[str, List[str]]:
    """Extract era_required_non_progressive_items from the world.

    Converts EraType enum keys to string keys for JSON serialization.
    """
    result = {}
    if hasattr(world, 'era_required_non_progressive_items'):
        for era, items in world.era_required_non_progressive_items.items():
            era_name = era.value if hasattr(era, 'value') else str(era)
            result[era_name] = list(items)
    return result


def _get_era_progressive_items_counts(world, multiworld, player) -> Dict[str, Dict[str, int]]:
    """Extract era_required_progressive_items_counts from the world.

    Converts EraType enum keys to string keys for JSON serialization.
    """
    result = {}
    if hasattr(world, 'era_required_progressive_items_counts'):
        for era, counts in world.era_required_progressive_items_counts.items():
            era_name = era.value if hasattr(era, 'value') else str(era)
            result[era_name] = dict(counts)
    return result


class Civ6GameExportHandler(GenericGameExportHandler):
    """Handler for Civilization VI - exports era requirements with string keys.

    The helpers reference world.era_required_non_progressive_items[era] and
    world.era_required_progressive_items_counts[era] at runtime. These dicts
    have EraType enum keys that must be converted to strings for JSON export.
    """

    # Export era requirements as world attributes
    # These are needed because the source dicts have EraType enum keys
    # which can't be auto-discovered (base class skips non-string keys)
    WORLD_ATTRIBUTES: Dict[str, Callable] = {
        'era_required_non_progressive_items': _get_era_non_progressive_items,
        'era_required_progressive_items_counts': _get_era_progressive_items_counts,
    }
