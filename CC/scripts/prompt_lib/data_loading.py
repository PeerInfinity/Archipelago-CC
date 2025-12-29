"""
Data loading utilities for prompt generation.

Functions for loading configuration files, test results, and template data.
"""

import json
import os
import sys
from pathlib import Path

import yaml

# Add parent scripts directory to path to import shared modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'scripts')))

from lib.test_utils import read_host_yaml_config, load_template_exclude_list
from lib.test_results import load_existing_results


def load_world_mapping(project_root):
    """Load the world mapping JSON file."""
    mapping_file = Path(project_root) / 'scripts' / 'data' / 'world-mapping.json'
    if not mapping_file.exists():
        return {}
    try:
        with open(mapping_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading world mapping: {e}", file=sys.stderr)
        return {}


def load_prompt_exclusion_lists(project_root):
    """Load the prompt exclusion lists from template-exclude-list.json.

    Returns a dict with two sets:
    - 'requires_javascript_helpers': Games that require JavaScript helpers
      (excluded from new-rule-types prompts)
    - 'exporter_fully_simplified': Games whose exporters are fully simplified
      (excluded from helper-export and exporter-simplify prompts)
    """
    exclude_file = Path(project_root) / 'scripts' / 'data' / 'template-exclude-list.json'
    result = {
        'requires_javascript_helpers': set(),
        'exporter_fully_simplified': set()
    }

    if not exclude_file.exists():
        return result

    try:
        with open(exclude_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Load requires_javascript_helpers_list
        for item in data.get('requires_javascript_helpers_list', []):
            if isinstance(item, dict) and 'name' in item:
                result['requires_javascript_helpers'].add(item['name'])
            elif isinstance(item, str):
                result['requires_javascript_helpers'].add(item)

        # Load exporter_fully_simplified_list
        for item in data.get('exporter_fully_simplified_list', []):
            if isinstance(item, dict) and 'name' in item:
                result['exporter_fully_simplified'].add(item['name'])
            elif isinstance(item, str):
                result['exporter_fully_simplified'].add(item)

        return result
    except Exception as e:
        print(f"Error loading prompt exclusion lists: {e}", file=sys.stderr)
        return result


def get_test_results_path(project_root, use_full_spoilers=False, use_minimal_spoilers=False, use_multiclient=False, use_multiworld=False):
    """Determine the correct test results path based on host.yaml configuration or command-line flags."""
    # If --multiworld is set, use the multiworld results path
    if use_multiworld:
        return Path(project_root) / 'scripts/output/multiworld/test-results.json'

    # If --multiclient is set, use the multiclient results path
    if use_multiclient:
        return Path(project_root) / 'scripts/output/multiclient/test-results.json'

    # If --full-spoilers is set, always use the full spoilers path
    if use_full_spoilers:
        return Path(project_root) / 'scripts/output/spoiler-full/test-results.json'

    # If --minimal-spoilers is set, always use the minimal spoilers path
    if use_minimal_spoilers:
        return Path(project_root) / 'scripts/output/spoiler-minimal/test-results.json'

    # Otherwise, read host.yaml to check extend_sphere_log_to_all_locations setting
    host_config = read_host_yaml_config(project_root)
    extend_sphere_log = host_config.get('general_options', {}).get('extend_sphere_log_to_all_locations', True)

    # Use appropriate output directory based on configuration
    if extend_sphere_log:
        return Path(project_root) / 'scripts/output/spoiler-full/test-results.json'
    else:
        return Path(project_root) / 'scripts/output/spoiler-minimal/test-results.json'


def load_test_results(project_root, use_full_spoilers=False, use_minimal_spoilers=False, use_multiclient=False, use_multiworld=False):
    """Load the template test results JSON file."""
    results_file = get_test_results_path(project_root, use_full_spoilers, use_minimal_spoilers, use_multiclient, use_multiworld)
    if not results_file.exists():
        return {}

    # Use shared load_existing_results function and return just the results section
    data = load_existing_results(str(results_file))
    return data.get('results', {})


def extract_game_name_from_yaml(template_path):
    """Extract the game name from a template YAML file."""
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        # Look for 'game' field directly in the YAML
        if 'game' in data:
            return data['game']

        # Look for the game name in player data structure
        for key, value in data.items():
            if isinstance(value, dict) and 'game' in value:
                return value['game']

        # Fallback: try to infer from filename (remove .yaml extension if present)
        template_filename_stem = template_path.stem
        if template_filename_stem.endswith('.yaml'):
            template_filename_stem = template_filename_stem[:-5]
        return template_filename_stem.replace(' Template', '')

    except Exception as e:
        print(f"Error reading template {template_path}: {e}", file=sys.stderr)
        return None


def get_template_files(template_dir, skip_list=None):
    """Get all template files from the template directory."""
    template_path = Path(template_dir)
    if not template_path.exists():
        print(f"Template directory not found: {template_dir}", file=sys.stderr)
        return []

    # Get all .yaml files
    template_files = list(template_path.glob('*.yaml'))
    template_files.extend(template_path.glob('*.yml'))

    # Filter out files in skip list
    if skip_list:
        template_files = [f for f in template_files if f.name not in skip_list]

    # Sort for consistent ordering
    template_files.sort()

    return [f.name for f in template_files]
