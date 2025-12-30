"""
Data loading functions for test results and world mappings.
"""

import json
import os
from typing import Dict, Any


def load_full_world_mapping(project_root: str) -> Dict[str, Dict[str, Any]]:
    """
    Load the full world mapping from JSON file, including file sizes.

    Returns a dict mapping game names to their full info dict.
    """
    mapping_file = os.path.join(project_root, 'scripts/data/world-mapping.json')
    try:
        with open(mapping_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading world mapping file {mapping_file}: {e}")
        return {}


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load the template test results from JSON file."""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading results file {results_file}: {e}")
        return {}
