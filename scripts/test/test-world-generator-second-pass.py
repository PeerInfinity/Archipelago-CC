#!/usr/bin/env python3
"""
World Generator Second Pass Test Script.

This script tests the world generator's stability by:
1. Taking a _worldgen world that was created from a first pass (rules.json -> world)
2. Generating a seed for that _worldgen world to produce new rules.json
3. Running the world generator again on that new rules.json -> _worldgen2 world
4. Comparing the two generated worlds for equivalence

This validates that the world generator produces stable, deterministic output:
if you export a world to JSON and regenerate it, the result should be the same.

Usage:
    # Run second pass test assuming first pass worlds already exist
    python scripts/test/test-world-generator-second-pass.py --assume-first-pass

    # Run from scratch (generates first pass worlds too)
    python scripts/test/test-world-generator-second-pass.py

    # Test specific templates
    python scripts/test/test-world-generator-second-pass.py --include-list Adventure.yaml
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Add parent scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.test_utils import (
    run_command,
    normalize_game_name,
    count_errors_and_warnings,
    check_http_server,
    build_and_load_world_mapping,
    extract_game_name_from_template,
    load_template_exclude_list,
)
from lib.seed_utils import get_seed_id as compute_seed_id


def get_project_root() -> str:
    """Get the project root directory."""
    return str(Path(__file__).parent.parent.parent)


def start_http_server(project_root: str) -> subprocess.Popen:
    """Start HTTP server in background and return the process."""
    process = subprocess.Popen(
        [sys.executable, '-m', 'http.server', '8000'],
        cwd=project_root,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    # Wait for server to start
    for _ in range(10):
        if check_http_server():
            return process
        time.sleep(0.5)
    return process


def get_world_directory_for_template(template_name: str, project_root: str, world_mapping: Dict = None) -> str:
    """Get the world directory name for a template file."""
    if world_mapping is None:
        world_mapping = build_and_load_world_mapping(project_root)

    templates_dir = os.path.join(project_root, 'Players', 'Templates')
    template_path = os.path.join(templates_dir, template_name)

    game_name = None
    if os.path.exists(template_path):
        game_name = extract_game_name_from_template(template_path)

    if game_name and game_name in world_mapping:
        world_dir = world_mapping[game_name].get('world_directory')
        if world_dir:
            return world_dir

    return normalize_game_name(template_name)


def generate_yaml_templates(project_root: str) -> bool:
    """Run the template generation command."""
    cmd = [
        sys.executable, '-c',
        "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
    ]
    return_code, stdout, stderr = run_command(cmd, cwd=project_root, timeout=120)
    return return_code == 0


def get_worldgen_template_list(project_root: str, skip_list: List[str] = None) -> List[str]:
    """Get list of _worldgen template files."""
    templates_dir = os.path.join(project_root, 'Players', 'Templates')
    skip_list = skip_list or []

    templates = []
    for item in sorted(os.listdir(templates_dir)):
        if item.endswith(' WorldGen.yaml') and item not in skip_list:
            templates.append(item)

    return templates


def get_original_template_from_worldgen(worldgen_template: str) -> str:
    """Get the original template name from a _worldgen template name."""
    # "Game WorldGen.yaml" -> "Game.yaml"
    return worldgen_template.replace(' WorldGen.yaml', '.yaml')


def compute_file_hash(file_path: str) -> str:
    """Compute SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def compute_directory_hashes(dir_path: str) -> Dict[str, str]:
    """Compute hashes for all Python files in a directory."""
    hashes = {}
    if not os.path.exists(dir_path):
        return hashes

    for item in sorted(os.listdir(dir_path)):
        if item.endswith('.py'):
            file_path = os.path.join(dir_path, item)
            hashes[item] = compute_file_hash(file_path)

    return hashes


def run_generation(
    template_name: str,
    project_root: str,
    seed: int
) -> Dict:
    """Run Generate.py for a template and return results."""
    result = {
        'success': False,
        'seed_id': None,
        'rules_path': None,
        'sphere_log_path': None,
        'preset_dir': None,
        'error': None,
        'processing_time_seconds': 0
    }

    # Compute expected seed ID
    seed_id = compute_seed_id(seed)
    result['seed_id'] = seed_id

    # Build command
    template_path = f"Templates/{template_name}"
    cmd = [
        sys.executable, 'Generate.py',
        '--weights_file_path', template_path,
        '--multi', '1',
        '--seed', str(seed)
    ]

    start_time = time.time()
    return_code, stdout, stderr = run_command(cmd, cwd=project_root, timeout=600)
    result['processing_time_seconds'] = round(time.time() - start_time, 2)

    if return_code != 0:
        result['error'] = f"Generation failed with return code {return_code}"
        full_output = stdout + '\n' + stderr
        error_count, _, first_error, _ = count_errors_and_warnings(full_output)
        if first_error:
            result['error'] = first_error
        return result

    # Find the generated files
    world_mapping = build_and_load_world_mapping(project_root)
    game_dir = get_world_directory_for_template(template_name, project_root, world_mapping)
    preset_dir = os.path.join(project_root, 'frontend', 'presets', game_dir, seed_id)

    if os.path.exists(preset_dir):
        result['preset_dir'] = preset_dir
        rules_path = os.path.join(preset_dir, f'{seed_id}_rules.json')
        sphere_log_path = os.path.join(preset_dir, f'{seed_id}_sphere_log.jsonl')

        if os.path.exists(rules_path):
            result['rules_path'] = rules_path
        if os.path.exists(sphere_log_path):
            result['sphere_log_path'] = sphere_log_path

        result['success'] = result['rules_path'] is not None
    else:
        result['error'] = f"Preset directory not found: {preset_dir}"

    return result


def run_world_generator(
    rules_path: str,
    output_dir: str,
    game_name: str,
    project_root: str,
    canonical_seed1: bool = False
) -> Dict:
    """Run the world generator to create a world from rules.json."""
    result = {
        'success': False,
        'world_dir': output_dir,
        'error': None,
        'processing_time_seconds': 0
    }

    cmd = [
        sys.executable, '-m', 'world_generator',
        rules_path,
        '--output', output_dir,
        '--game-name', game_name,
        '--force'
    ]

    if canonical_seed1:
        cmd.append('--canonical-seed1')

    start_time = time.time()
    return_code, stdout, stderr = run_command(cmd, cwd=project_root, timeout=120)
    result['processing_time_seconds'] = round(time.time() - start_time, 2)

    if return_code != 0:
        full_output = stdout + '\n' + stderr
        result['error'] = f"World generator failed: {full_output[:500]}"
        return result

    # Verify the world was created
    init_file = os.path.join(output_dir, '__init__.py')
    if os.path.exists(init_file):
        result['success'] = True
    else:
        result['error'] = "World directory created but __init__.py not found"

    return result


def compare_worlds(world1_dir: str, world2_dir: str) -> Dict:
    """Compare two generated world directories."""
    result = {
        'identical': False,
        'files_compared': 0,
        'files_matching': 0,
        'differences': [],
        'world1_hashes': {},
        'world2_hashes': {}
    }

    # Compute hashes for both directories
    hashes1 = compute_directory_hashes(world1_dir)
    hashes2 = compute_directory_hashes(world2_dir)

    result['world1_hashes'] = hashes1
    result['world2_hashes'] = hashes2

    # Get all files from both directories
    all_files = set(hashes1.keys()) | set(hashes2.keys())
    result['files_compared'] = len(all_files)

    for filename in sorted(all_files):
        if filename in hashes1 and filename in hashes2:
            if hashes1[filename] == hashes2[filename]:
                result['files_matching'] += 1
            else:
                result['differences'].append({
                    'file': filename,
                    'type': 'content_mismatch',
                    'hash1': hashes1[filename][:16],
                    'hash2': hashes2[filename][:16]
                })
        elif filename in hashes1:
            result['differences'].append({
                'file': filename,
                'type': 'missing_in_world2'
            })
        else:
            result['differences'].append({
                'file': filename,
                'type': 'missing_in_world1'
            })

    result['identical'] = len(result['differences']) == 0

    return result


def process_template(
    worldgen_template: str,
    project_root: str,
    seed: int,
    canonical_seed1: bool = False
) -> Dict:
    """
    Run the second pass test for a single _worldgen template.

    1. Generate seed for _worldgen world -> produces rules.json
    2. Run world_generator on that rules.json -> _worldgen2 world
    3. Compare _worldgen and _worldgen2
    """
    original_template = get_original_template_from_worldgen(worldgen_template)
    game_name_display = original_template.replace('.yaml', '')
    worldgen_game_name = worldgen_template.replace('.yaml', '')

    print(f"\n{'='*60}")
    print(f"Second Pass Test: {game_name_display}")
    print('='*60)

    template_result = {
        'template': original_template,
        'worldgen_template': worldgen_template,
        'game_name': game_name_display,
        'timestamp': datetime.now().isoformat(),
        'seed': seed,
        'first_pass': {
            'world_dir': None,
            'exists': False
        },
        'second_pass': {
            'seed_generation': {'success': False},
            'world_generation': {'success': False},
            'world_dir': None
        },
        'comparison': {
            'success': False,
            'identical': False,
            'files_compared': 0,
            'files_matching': 0,
            'differences': []
        },
        'errors': {
            'first_pass': [],
            'second_pass': [],
            'comparison': []
        }
    }

    # Get world mapping
    world_mapping = build_and_load_world_mapping(project_root)
    worldgen_dir = get_world_directory_for_template(worldgen_template, project_root, world_mapping)

    # Check if first pass world exists
    first_pass_world_dir = os.path.join(project_root, 'worlds', worldgen_dir)
    template_result['first_pass']['world_dir'] = first_pass_world_dir

    if not os.path.exists(first_pass_world_dir):
        template_result['errors']['first_pass'].append(f"First pass world not found: {first_pass_world_dir}")
        print(f"  ERROR: First pass world not found: {first_pass_world_dir}")
        return template_result

    template_result['first_pass']['exists'] = True
    print(f"  First pass world: {first_pass_world_dir}")

    # Step 1: Generate seed for _worldgen world
    print(f"\n[1/3] Generating seed for _worldgen world...")
    gen_result = run_generation(worldgen_template, project_root, seed)
    template_result['second_pass']['seed_generation'] = gen_result

    if not gen_result['success']:
        template_result['errors']['second_pass'].append(f"Seed generation failed: {gen_result.get('error', 'Unknown error')}")
        print(f"  FAILED: {gen_result.get('error', 'Unknown error')}")
        return template_result

    print(f"  OK (seed_id: {gen_result['seed_id']})")

    # Step 2: Run world generator on the new rules.json to create _worldgen2
    print(f"\n[2/3] Running world generator (second pass)...")

    rules_path = gen_result['rules_path']
    if not rules_path or not os.path.exists(rules_path):
        template_result['errors']['second_pass'].append(f"Rules file not found: {rules_path}")
        print(f"  FAILED: Rules file not found")
        return template_result

    # Create _worldgen2 directory name
    second_pass_world_dir = os.path.join(project_root, 'worlds', f'{worldgen_dir}2')
    second_pass_game_name = f"{worldgen_game_name}2"

    template_result['second_pass']['world_dir'] = second_pass_world_dir

    world_gen_result = run_world_generator(
        rules_path, second_pass_world_dir, second_pass_game_name, project_root,
        canonical_seed1=canonical_seed1
    )
    template_result['second_pass']['world_generation'] = world_gen_result

    if not world_gen_result['success']:
        template_result['errors']['second_pass'].append(f"World generation failed: {world_gen_result.get('error', 'Unknown error')}")
        print(f"  FAILED: {world_gen_result.get('error', 'Unknown error')}")
        return template_result

    print(f"  OK (created {second_pass_world_dir})")

    # Step 3: Compare the two world directories
    print(f"\n[3/3] Comparing first and second pass worlds...")

    comparison = compare_worlds(first_pass_world_dir, second_pass_world_dir)
    template_result['comparison'] = comparison
    template_result['comparison']['success'] = True

    if comparison['identical']:
        print(f"  IDENTICAL - {comparison['files_compared']} files match")
    else:
        template_result['errors']['comparison'].append(f"Worlds differ: {len(comparison['differences'])} differences")
        print(f"  DIFFERENT - {len(comparison['differences'])} differences found:")
        for diff in comparison['differences'][:5]:  # Show first 5
            if diff['type'] == 'content_mismatch':
                print(f"    - {diff['file']}: content differs")
            elif diff['type'] == 'missing_in_world2':
                print(f"    - {diff['file']}: missing in second pass")
            else:
                print(f"    - {diff['file']}: only in second pass")
        if len(comparison['differences']) > 5:
            print(f"    ... and {len(comparison['differences']) - 5} more")

    return template_result


def cleanup_second_pass_worlds(project_root: str) -> List[str]:
    """Delete all *_worldgen2 world directories and return list of deleted dirs."""
    worlds_dir = os.path.join(project_root, 'worlds')
    deleted = []

    for item in os.listdir(worlds_dir):
        if item.endswith('_worldgen2'):
            path = os.path.join(worlds_dir, item)
            if os.path.isdir(path):
                shutil.rmtree(path)
                deleted.append(item)
                print(f"  Deleted: worlds/{item}")

    return deleted


def cleanup_second_pass_presets(project_root: str) -> List[str]:
    """Delete all *_worldgen2 preset directories and return list of deleted dirs."""
    presets_dir = os.path.join(project_root, 'frontend', 'presets')
    deleted = []

    if not os.path.exists(presets_dir):
        return deleted

    for item in os.listdir(presets_dir):
        if item.endswith('_worldgen2'):
            path = os.path.join(presets_dir, item)
            if os.path.isdir(path):
                shutil.rmtree(path)
                deleted.append(item)
                print(f"  Deleted: frontend/presets/{item}")

    return deleted


def save_results(results: Dict, output_file: str) -> None:
    """Save results to JSON file."""
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {output_file}")


def main():
    # Load default exclude list
    default_exclude_list = load_template_exclude_list()
    # Convert to WorldGen template names
    worldgen_exclude_list = [t.replace('.yaml', ' WorldGen.yaml') for t in default_exclude_list]

    parser = argparse.ArgumentParser(
        description='Test world generator second pass (re-generation stability)'
    )
    parser.add_argument(
        '--seed', type=int, default=1,
        help='Seed number to use (default: 1)'
    )
    parser.add_argument(
        '--output-file', type=str,
        default='scripts/output/world-generator-second-pass/test-results.json',
        help='Output file for test results'
    )
    parser.add_argument(
        '--skip-list', type=str, nargs='*', default=worldgen_exclude_list,
        help='Templates to skip'
    )
    parser.add_argument(
        '--include-list', type=str, nargs='*',
        help='Only test these templates (overrides skip-list)'
    )
    parser.add_argument(
        '--every-nth', type=int, default=1,
        help='Process every Nth template (for parallelization)'
    )
    parser.add_argument(
        '--skip-first', type=int, default=0,
        help='Skip first N templates (for parallelization)'
    )
    parser.add_argument(
        '--skip-cleanup', action='store_true',
        help='Skip cleanup of _worldgen2 worlds after testing'
    )
    parser.add_argument(
        '--assume-first-pass', action='store_true',
        help='Assume first pass _worldgen worlds already exist (skip first pass generation)'
    )
    parser.add_argument(
        '--canonical-seed1', action='store_true',
        help='Enable seed=1 canonical placement'
    )
    parser.add_argument(
        '-v', '--verbose', action='store_true',
        help='Verbose output'
    )

    args = parser.parse_args()
    project_root = get_project_root()

    print("="*60)
    print("World Generator Second Pass Test")
    print("="*60)
    print(f"Project root: {project_root}")
    print(f"Seed: {args.seed}")
    print(f"Output file: {args.output_file}")
    print(f"Assume first pass: {args.assume_first_pass}")
    if args.canonical_seed1:
        print(f"Canonical seed 1: enabled")

    # Initialize results
    results = {
        'metadata': {
            'timestamp': datetime.now().isoformat(),
            'seed': args.seed,
            'canonical_seed1': args.canonical_seed1,
            'assume_first_pass': args.assume_first_pass,
            'total_templates': 0,
            'identical_count': 0,
            'different_count': 0,
            'error_count': 0
        },
        'results': {}
    }

    # Regenerate templates to pick up any _worldgen worlds
    print("\nRegenerating templates...")
    if not generate_yaml_templates(project_root):
        print("WARNING: Failed to regenerate templates")

    # Get list of _worldgen templates
    templates = get_worldgen_template_list(project_root, args.skip_list)

    if args.include_list:
        # Convert include list to WorldGen template names if needed
        include_worldgen = []
        for t in args.include_list:
            if t.endswith(' WorldGen.yaml'):
                include_worldgen.append(t)
            elif t.endswith('.yaml'):
                include_worldgen.append(t.replace('.yaml', ' WorldGen.yaml'))
            else:
                include_worldgen.append(f"{t} WorldGen.yaml")
        templates = [t for t in templates if t in include_worldgen]

    # Apply parallelization filters
    if args.skip_first > 0:
        templates = templates[args.skip_first:]
    if args.every_nth > 1:
        templates = templates[::args.every_nth]

    results['metadata']['total_templates'] = len(templates)
    print(f"\nWorldGen templates to test: {len(templates)}")

    if not templates:
        print("\nNo _worldgen templates found. Run the first pass test first, or remove --assume-first-pass.")
        save_results(results, os.path.join(project_root, args.output_file))
        return 1

    # Start HTTP server if needed (for spoiler tests later if we add them)
    http_server_process = None
    if not check_http_server():
        print("\nStarting HTTP server...")
        http_server_process = start_http_server(project_root)
        if check_http_server():
            print("  HTTP server started on port 8000")
        else:
            print("  WARNING: Failed to start HTTP server")

    # Process each template
    for template in templates:
        template_result = process_template(
            template, project_root, args.seed,
            canonical_seed1=args.canonical_seed1
        )

        # Store result by original game name
        game_name = template_result.get('game_name', template.replace(' WorldGen.yaml', ''))
        results['results'][game_name] = template_result

        # Update counts
        if template_result['comparison'].get('identical'):
            results['metadata']['identical_count'] += 1
        elif template_result['comparison'].get('success'):
            results['metadata']['different_count'] += 1
        else:
            results['metadata']['error_count'] += 1

    # Stop HTTP server
    if http_server_process:
        print("\nStopping HTTP server...")
        http_server_process.terminate()
        http_server_process.wait()

    # Cleanup
    if not args.skip_cleanup:
        print("\n" + "="*60)
        print("Cleanup")
        print("="*60)

        print("\nDeleting _worldgen2 worlds...")
        cleanup_second_pass_worlds(project_root)

        print("\nDeleting _worldgen2 presets...")
        cleanup_second_pass_presets(project_root)

    # Save results
    save_results(results, os.path.join(project_root, args.output_file))

    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total templates tested: {results['metadata']['total_templates']}")
    print(f"Identical (stable): {results['metadata']['identical_count']}")
    print(f"Different (unstable): {results['metadata']['different_count']}")
    print(f"Errors: {results['metadata']['error_count']}")

    # Return non-zero if any differences or errors
    if results['metadata']['different_count'] > 0 or results['metadata']['error_count'] > 0:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
