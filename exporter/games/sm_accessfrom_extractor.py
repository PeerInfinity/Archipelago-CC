"""
Extract AccessFrom information from Super Metroid location definitions using AST parsing.

This module parses the graph_locations.py file to extract AccessFrom dictionaries
and determine which locations have simple (SMBool(True)) vs complex (item requirements)
access patterns.
"""

import ast
import logging
import os
from typing import Dict, Set, Optional
from ..analyzer.source_extraction import get_multiline_lambda_source

logger = logging.getLogger(__name__)


class AccessFromExtractor(ast.NodeVisitor):
    """AST visitor to extract AccessFrom assignments from Super Metroid location files."""

    def __init__(self):
        """Initialize the extractor."""
        self.location_access_info: Dict[str, Dict[str, str]] = {}
        # Maps location_name -> {region_name -> lambda_source}

    def visit_Assign(self, node: ast.Assign):
        """Visit assignment nodes looking for locationsDict[location].AccessFrom = {...}"""
        try:
            # Check if this is an assignment to locationsDict[...].AccessFrom
            if (len(node.targets) == 1 and
                isinstance(node.targets[0], ast.Attribute) and
                node.targets[0].attr == 'AccessFrom' and
                isinstance(node.targets[0].value, ast.Subscript)):

                # Extract location name from locationsDict[location_name]
                subscript = node.targets[0].value
                if (isinstance(subscript.value, ast.Name) and
                    subscript.value.id == 'locationsDict' and
                    isinstance(subscript.slice, ast.Constant)):

                    location_name = subscript.slice.value

                    # Check if the value is a dictionary
                    if isinstance(node.value, ast.Dict):
                        access_from_dict = {}

                        # Extract each region -> lambda mapping
                        for key, value in zip(node.value.keys, node.value.values):
                            if isinstance(key, ast.Constant) and isinstance(key.value, str):
                                region_name = key.value

                                # Get the lambda source
                                if isinstance(value, ast.Lambda):
                                    # Use astunparse to get clean lambda source
                                    try:
                                        import astunparse
                                        lambda_source = astunparse.unparse(value).strip()
                                        access_from_dict[region_name] = lambda_source
                                    except Exception as e:
                                        logger.warning(f"Failed to unparse lambda for {location_name}/{region_name}: {e}")
                                        access_from_dict[region_name] = "<parse_error>"

                        if access_from_dict:
                            self.location_access_info[location_name] = access_from_dict
                            logger.debug(f"Extracted AccessFrom for {location_name}: {list(access_from_dict.keys())}")

        except Exception as e:
            logger.debug(f"Error in visit_Assign: {e}")

        # Continue visiting
        self.generic_visit(node)


def is_simple_smbool_lambda(lambda_source: str) -> bool:
    """
    Determine if a lambda source is a simple SMBool(True) pattern.

    Args:
        lambda_source: The lambda source code (e.g., "(lambda sm: SMBool(True))")
                      Note: astunparse wraps lambdas in parentheses

    Returns:
        True if the lambda is just SMBool(True), False otherwise
    """
    # Normalize whitespace
    normalized = ' '.join(lambda_source.split())

    # Remove outer parentheses if present
    if normalized.startswith('(') and normalized.endswith(')'):
        normalized = normalized[1:-1].strip()

    # Check for the pattern: lambda <param>: SMBool(True)
    # astunparse may produce "(lambda sm: SMBool(True))" with parens
    patterns = [
        'lambda sm: SMBool(True)',
        'lambda state: SMBool(True)',
    ]

    return normalized in patterns


def extract_accessfrom_info(world_module_path: str) -> Dict[str, Set[str]]:
    """
    Extract AccessFrom information from Super Metroid's graph_locations.py file.

    Args:
        world_module_path: Path to the worlds/sm module

    Returns:
        Dict mapping location_name -> set of region names with simple (SMBool(True)) access
        Only includes locations where ALL AccessFrom entries are simple.
    """
    graph_locations_path = os.path.join(
        world_module_path,
        'variaRandomizer',
        'graph',
        'vanilla',
        'graph_locations.py'
    )

    if not os.path.exists(graph_locations_path):
        logger.warning(f"graph_locations.py not found at {graph_locations_path}")
        return {}

    try:
        # Parse the file
        with open(graph_locations_path, 'r', encoding='utf-8') as f:
            source = f.read()

        tree = ast.parse(source, filename=graph_locations_path)

        # Extract AccessFrom info
        extractor = AccessFromExtractor()
        extractor.visit(tree)

        # Analyze which locations have ALL simple AccessFrom entries
        simple_locations = {}

        for location_name, access_from_dict in extractor.location_access_info.items():
            # Check if ALL entries are simple
            all_simple = all(
                is_simple_smbool_lambda(lambda_src)
                for lambda_src in access_from_dict.values()
            )

            if all_simple:
                # Store the region names for this location
                simple_locations[location_name] = set(access_from_dict.keys())
                logger.info(f"Location '{location_name}' has simple AccessFrom (SMBool(True) only)")
            else:
                # Log which regions are complex
                complex_regions = [
                    region for region, lambda_src in access_from_dict.items()
                    if not is_simple_smbool_lambda(lambda_src)
                ]
                logger.info(f"Location '{location_name}' has complex AccessFrom in regions: {complex_regions}")

        logger.info(f"Found {len(simple_locations)} locations with simple AccessFrom out of {len(extractor.location_access_info)} total")
        return simple_locations

    except Exception as e:
        logger.error(f"Failed to extract AccessFrom info: {e}", exc_info=True)
        return {}


def get_simple_accessfrom_locations(world) -> Set[str]:
    """
    Get the set of location names that have simple AccessFrom (all regions use SMBool(True)).

    This is the main entry point for the SM exporter to use.

    Args:
        world: The Super Metroid world instance

    Returns:
        Set of location names with simple AccessFrom
    """
    try:
        # Get the world module path
        import worlds.sm
        world_module_path = os.path.dirname(worlds.sm.__file__)

        # Extract and analyze
        simple_locations_dict = extract_accessfrom_info(world_module_path)

        # Return just the location names
        return set(simple_locations_dict.keys())

    except Exception as e:
        logger.error(f"Failed to get simple AccessFrom locations: {e}")
        return set()
