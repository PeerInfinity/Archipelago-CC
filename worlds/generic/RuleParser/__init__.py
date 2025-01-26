"""Handles parsing and exporting of game rules to frontend-compatible format."""

import os
import json
import logging
from typing import Dict, Optional

from .analyzer import analyze_rule
from .exporter import prepare_export_data
from .games import get_game_helpers

logger = logging.getLogger(__name__)

def export_game_rules(multiworld, output_dir: str, filename_base: str) -> Dict[str, str]:
    """
    Exports game rules and test data to JSON files for frontend consumption.
    
    Args:
        multiworld: MultiWorld instance containing game rules
        output_dir: Directory to write output files
        filename_base: Base name for output files
        
    Returns:
        Dict containing paths to generated files:
        {
            'rules': Path to rules JSON file
            'tests': Path to test cases JSON file (if tests exist)
        }
    """
    os.makedirs(output_dir, exist_ok=True)

    # Export rules
    rules_path = os.path.join(output_dir, f'{filename_base}_rules.json')
    export_data = prepare_export_data(multiworld)
    
    try:
        with open(rules_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2)
    except Exception as e:
        logger.error(f"Error writing rules export file: {e}")
        raise

    results = {'rules': rules_path}

    # Export test cases if they exist
    if hasattr(multiworld, 'test_cases'):
        test_path = os.path.join(output_dir, f'{filename_base}_tests.json')
        try:
            with open(test_path, 'w', encoding='utf-8') as f:
                json.dump({'location_tests': multiworld.test_cases}, f, indent=2)
            results['tests'] = test_path
        except Exception as e:
            logger.error(f"Error writing test cases file: {e}")
            raise

    return results