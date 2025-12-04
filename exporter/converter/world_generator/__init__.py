"""
World Generator - Convert JSON rules files to Archipelago world packages.

This module automates the process of creating a complete Archipelago world
from a JSON rules file (the output of the exporter).

Usage:
    from exporter.converter.world_generator import WorldGenerator

    generator = WorldGenerator('path/to/rules.json', 'worlds/mygame/')
    generator.generate()

Or from command line:
    python -m exporter.converter.world_generator input.json -o worlds/mygame/
"""

from .generator import WorldGenerator
from .extractors import (
    extract_game_metadata,
    extract_items,
    extract_locations,
    extract_regions,
)
from .rule_codegen import cc_rule_to_python

__all__ = [
    'WorldGenerator',
    'extract_game_metadata',
    'extract_items',
    'extract_locations',
    'extract_regions',
    'cc_rule_to_python',
]
