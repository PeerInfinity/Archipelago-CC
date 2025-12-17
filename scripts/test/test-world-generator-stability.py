#!/usr/bin/env python3
"""
World Generator Stability Test Script.

This script tests the world generator's stability by running it multiple times
and comparing results. It validates that the world generator produces stable,
deterministic output.

The test performs N passes (default 3):
1. Pass 1: Uses existing _worldgen world (from first pass test)
2. Pass 2: Generate seed for _worldgen -> rules.json -> world_generator -> _worldgen2
3. Pass 3: Generate seed for _worldgen2 -> rules.json -> world_generator -> _worldgen3
...and so on

Then compares consecutive passes to check for stability.

Usage:
    # Run 3-pass test assuming first pass worlds already exist
    python scripts/test/test-world-generator-stability.py --assume-first-pass

    # Run with custom number of passes
    python scripts/test/test-world-generator-stability.py --assume-first-pass --passes 4

    # Test specific templates
    python scripts/test/test-world-generator-stability.py --include-list Adventure
"""

import argparse
import hashlib
import json
import os
import re
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
    # "Game WorldGen2.yaml" -> "Game.yaml"
    return re.sub(r' WorldGen\d*\.yaml$', '.yaml', worldgen_template)


def get_base_game_name(template_name: str) -> str:
    """Get the base game name without WorldGen suffix."""
    # "Game WorldGen.yaml" -> "Game"
    # "Game WorldGen2.yaml" -> "Game"
    # "Game.yaml" -> "Game"
    name = re.sub(r' WorldGen\d*\.yaml$', '', template_name)
    name = re.sub(r'\.yaml$', '', name)
    return name


def detect_canonical_seed1(world_dir: str) -> bool:
    """
    Detect whether a world was generated with --canonical-seed1 flag.

    This checks for the presence of 'canonical_placements' in __init__.py,
    which is only generated when --canonical-seed1 is used.
    """
    init_file = os.path.join(world_dir, '__init__.py')
    if not os.path.exists(init_file):
        return False

    try:
        with open(init_file, 'r') as f:
            content = f.read()
            return 'canonical_placements' in content
    except IOError:
        return False


def compute_file_hash(file_path: str) -> str:
    """Compute SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def normalize_file_content(content: str, game_name_base: str) -> str:
    """
    Normalize file content by replacing game-name-specific strings.

    This allows comparing files that differ only in their game name
    (e.g., "WorldGen" vs "WorldGen2" vs "WorldGen3").
    """
    # Normalize variations of the game name
    # e.g., "ChocolateChipCookies WorldGen3" -> "ChocolateChipCookies WorldGen"
    # e.g., "ChocolateChipCookiesWorldGen3" -> "ChocolateChipCookiesWorldGen"

    # Replace "GameName WorldGenN" with "GameName WorldGen" (N is any number)
    content = re.sub(
        rf'{re.escape(game_name_base)} WorldGen\d+',
        f'{game_name_base} WorldGen',
        content
    )

    # Replace "GameNameWorldGenN" (no space) with "GameNameWorldGen"
    game_name_no_space = game_name_base.replace(' ', '')
    content = re.sub(
        rf'{game_name_no_space}WorldGen\d+',
        f'{game_name_no_space}WorldGen',
        content
    )

    return content


def compute_normalized_file_hash(file_path: str, game_name_base: str) -> str:
    """Compute SHA256 hash of a file after normalizing game name variations."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        # Fall back to binary hash for non-text files
        return compute_file_hash(file_path)

    normalized = normalize_file_content(content, game_name_base)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


def compute_directory_hashes(dir_path: str, game_name_base: str = None) -> Dict[str, str]:
    """
    Compute hashes for all Python files in a directory.

    If game_name_base is provided, normalizes game name variations before hashing.
    """
    hashes = {}
    if not os.path.exists(dir_path):
        return hashes

    for item in sorted(os.listdir(dir_path)):
        if item.endswith('.py'):
            file_path = os.path.join(dir_path, item)
            if game_name_base:
                hashes[item] = compute_normalized_file_hash(file_path, game_name_base)
            else:
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


def compare_worlds(world1_dir: str, world2_dir: str, game_name_base: str = None) -> Dict:
    """
    Compare two generated world directories.

    If game_name_base is provided, normalizes game name variations before comparing,
    so that "WorldGen" vs "WorldGen2" vs "WorldGen3" differences are ignored.
    """
    result = {
        'identical': False,
        'files_compared': 0,
        'files_matching': 0,
        'differences': [],
        'world1_hashes': {},
        'world2_hashes': {}
    }

    # Compute hashes for both directories (with normalization if game_name_base provided)
    hashes1 = compute_directory_hashes(world1_dir, game_name_base)
    hashes2 = compute_directory_hashes(world2_dir, game_name_base)

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


def run_pass(
    pass_num: int,
    prev_world_dir: str,
    prev_template_name: str,
    base_worldgen_dir: str,
    game_name_base: str,
    project_root: str,
    seed: int,
    use_canonical: bool
) -> Dict:
    """
    Run a single pass of the world generator.

    Returns dict with:
    - seed_generation: result of generating seed for previous world
    - world_generation: result of running world generator
    - world_dir: path to the new world directory
    - template_name: name of the template for this pass's world
    - success: overall success
    - error: error message if any
    """
    result = {
        'pass_num': pass_num,
        'seed_generation': {'success': False},
        'world_generation': {'success': False},
        'world_dir': None,
        'template_name': None,
        'success': False,
        'error': None
    }

    # Determine suffix for this pass (2, 3, 4, etc.)
    suffix = str(pass_num)
    new_world_dir = os.path.join(project_root, 'worlds', f'{base_worldgen_dir}{suffix}')
    new_game_name = f"{game_name_base} WorldGen{suffix}"
    new_template_name = f"{game_name_base} WorldGen{suffix}.yaml"

    result['world_dir'] = new_world_dir
    result['template_name'] = new_template_name

    # Step 1: Generate seed for previous world to get rules.json
    print(f"\n  [{pass_num}a] Generating seed for pass {pass_num-1} world...")
    gen_result = run_generation(prev_template_name, project_root, seed)
    result['seed_generation'] = gen_result

    if not gen_result['success']:
        result['error'] = f"Seed generation failed: {gen_result.get('error', 'Unknown error')}"
        print(f"    FAILED: {gen_result.get('error', 'Unknown error')}")
        return result

    print(f"    OK (seed_id: {gen_result['seed_id']})")

    # Step 2: Run world generator on the rules.json
    print(f"  [{pass_num}b] Running world generator (pass {pass_num})...")

    rules_path = gen_result['rules_path']
    if not rules_path or not os.path.exists(rules_path):
        result['error'] = f"Rules file not found: {rules_path}"
        print(f"    FAILED: Rules file not found")
        return result

    world_gen_result = run_world_generator(
        rules_path, new_world_dir, new_game_name, project_root,
        canonical_seed1=use_canonical
    )
    result['world_generation'] = world_gen_result

    if not world_gen_result['success']:
        result['error'] = f"World generation failed: {world_gen_result.get('error', 'Unknown error')}"
        print(f"    FAILED: {world_gen_result.get('error', 'Unknown error')}")
        return result

    print(f"    OK (created {new_world_dir})")
    result['success'] = True

    return result


def process_template(
    worldgen_template: str,
    project_root: str,
    seed: int,
    num_passes: int = 3,
    canonical_seed1: bool = False
) -> Dict:
    """
    Run multi-pass stability test for a single _worldgen template.

    Pass 1 is the existing _worldgen world.
    Passes 2..N generate new worlds and compare with previous pass.
    """
    game_name_base = get_base_game_name(worldgen_template)

    print(f"\n{'='*60}")
    print(f"Stability Test: {game_name_base} ({num_passes} passes)")
    print('='*60)

    template_result = {
        'template': get_original_template_from_worldgen(worldgen_template),
        'worldgen_template': worldgen_template,
        'game_name': game_name_base,
        'timestamp': datetime.now().isoformat(),
        'seed': seed,
        'num_passes': num_passes,
        'passes': {},
        'comparisons': {},
        'errors': []
    }

    # Get world mapping
    world_mapping = build_and_load_world_mapping(project_root)
    base_worldgen_dir = get_world_directory_for_template(worldgen_template, project_root, world_mapping)

    # Check if first pass (pass 1) world exists
    pass1_world_dir = os.path.join(project_root, 'worlds', base_worldgen_dir)

    if not os.path.exists(pass1_world_dir):
        template_result['errors'].append(f"Pass 1 world not found: {pass1_world_dir}")
        print(f"  ERROR: Pass 1 world not found: {pass1_world_dir}")
        return template_result

    # Detect if first pass used --canonical-seed1
    detected_canonical = detect_canonical_seed1(pass1_world_dir)
    use_canonical = detected_canonical if detected_canonical else canonical_seed1

    template_result['passes']['1'] = {
        'world_dir': pass1_world_dir,
        'template_name': worldgen_template,
        'canonical_seed1': detected_canonical,
        'exists': True
    }

    print(f"  Pass 1 world: {pass1_world_dir}")
    if detected_canonical:
        print(f"  Detected: --canonical-seed1 was used")

    # Track world directories and template names for each pass
    world_dirs = {1: pass1_world_dir}
    template_names = {1: worldgen_template}

    # Run passes 2 through N
    prev_world_dir = pass1_world_dir
    prev_template_name = worldgen_template

    for pass_num in range(2, num_passes + 1):
        # Regenerate templates to pick up new worlds
        generate_yaml_templates(project_root)

        pass_result = run_pass(
            pass_num=pass_num,
            prev_world_dir=prev_world_dir,
            prev_template_name=prev_template_name,
            base_worldgen_dir=base_worldgen_dir,
            game_name_base=game_name_base,
            project_root=project_root,
            seed=seed,
            use_canonical=use_canonical
        )

        template_result['passes'][str(pass_num)] = pass_result

        if not pass_result['success']:
            template_result['errors'].append(pass_result['error'])
            break

        world_dirs[pass_num] = pass_result['world_dir']
        template_names[pass_num] = pass_result['template_name']
        prev_world_dir = pass_result['world_dir']
        prev_template_name = pass_result['template_name']

    # Compare consecutive passes
    print(f"\n  Comparing passes...")

    for i in range(1, len(world_dirs)):
        pass_a = i
        pass_b = i + 1

        if pass_b not in world_dirs:
            break

        comparison_key = f"{pass_a}_vs_{pass_b}"
        print(f"  Pass {pass_a} vs Pass {pass_b}:", end=" ")

        comparison = compare_worlds(
            world_dirs[pass_a],
            world_dirs[pass_b],
            game_name_base=game_name_base
        )

        template_result['comparisons'][comparison_key] = comparison

        if comparison['identical']:
            print(f"IDENTICAL ({comparison['files_compared']} files)")
        else:
            diff_count = len(comparison['differences'])
            print(f"DIFFERENT ({diff_count} differences)")
            for diff in comparison['differences'][:3]:
                print(f"    - {diff['file']}: {diff['type']}")
            if diff_count > 3:
                print(f"    ... and {diff_count - 3} more")

    return template_result


def cleanup_stability_test_worlds(project_root: str) -> List[str]:
    """Delete all *_worldgenN (N >= 2) world directories."""
    worlds_dir = os.path.join(project_root, 'worlds')
    deleted = []

    for item in os.listdir(worlds_dir):
        # Match _worldgen2, _worldgen3, etc.
        if re.match(r'.*_worldgen\d+$', item):
            path = os.path.join(worlds_dir, item)
            if os.path.isdir(path):
                shutil.rmtree(path)
                deleted.append(item)
                print(f"  Deleted: worlds/{item}")

    return deleted


def cleanup_stability_test_presets(project_root: str) -> List[str]:
    """Delete all *_worldgenN (N >= 2) preset directories."""
    presets_dir = os.path.join(project_root, 'frontend', 'presets')
    deleted = []

    if not os.path.exists(presets_dir):
        return deleted

    for item in os.listdir(presets_dir):
        # Match _worldgen2, _worldgen3, etc.
        if re.match(r'.*_worldgen\d+$', item):
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
    # Load default exclude list for worldgen tests (includes main + worldgen exclusions)
    default_exclude_list = load_template_exclude_list(test_type='all')
    # Convert to WorldGen template names
    worldgen_exclude_list = [t.replace('.yaml', ' WorldGen.yaml') for t in default_exclude_list]

    parser = argparse.ArgumentParser(
        description='Test world generator stability across multiple passes'
    )
    parser.add_argument(
        '--seed', type=int, default=1,
        help='Seed number to use (default: 1)'
    )
    parser.add_argument(
        '--passes', type=int, default=3,
        help='Number of passes to run (default: 3)'
    )
    parser.add_argument(
        '--output-file', type=str,
        default='scripts/output/world-generator-stability/test-results.json',
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
        help='Skip cleanup of generated worlds after testing'
    )
    parser.add_argument(
        '--assume-first-pass', action='store_true',
        help='Assume first pass _worldgen worlds already exist'
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
    print("World Generator Stability Test")
    print("="*60)
    print(f"Project root: {project_root}")
    print(f"Seed: {args.seed}")
    print(f"Passes: {args.passes}")
    print(f"Output file: {args.output_file}")
    print(f"Assume first pass: {args.assume_first_pass}")
    if args.canonical_seed1:
        print(f"Canonical seed 1: enabled")

    # Initialize results
    results = {
        'metadata': {
            'timestamp': datetime.now().isoformat(),
            'seed': args.seed,
            'num_passes': args.passes,
            'canonical_seed1': args.canonical_seed1,
            'assume_first_pass': args.assume_first_pass,
            'total_templates': 0,
            'stable_count': 0,
            'unstable_count': 0,
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
        print("\nNo _worldgen templates found. Run the first pass test first.")
        save_results(results, os.path.join(project_root, args.output_file))
        return 1

    # Start HTTP server if needed
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
            num_passes=args.passes,
            canonical_seed1=args.canonical_seed1
        )

        # Store result by original game name
        game_name = template_result.get('game_name', get_base_game_name(template))
        results['results'][game_name] = template_result

        # Determine stability
        # Only count as unstable if Pass 2→3 or later differs (Pass 1→2 differences are expected)
        if template_result['errors']:
            results['metadata']['error_count'] += 1
        else:
            comparisons = template_result['comparisons']
            # Check consecutive passes starting from pass 2 (i.e., 2_vs_3, 3_vs_4, etc.)
            later_passes_identical = all(
                comp.get('identical', False)
                for key, comp in comparisons.items()
                if not key.startswith('1_vs_')
            )
            if later_passes_identical:
                results['metadata']['stable_count'] += 1
            else:
                results['metadata']['unstable_count'] += 1

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

        print("\nDeleting generated worlds...")
        cleanup_stability_test_worlds(project_root)

        print("\nDeleting generated presets...")
        cleanup_stability_test_presets(project_root)

        print("\nRegenerating templates...")
        generate_yaml_templates(project_root)

    # Save results
    save_results(results, os.path.join(project_root, args.output_file))

    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total templates tested: {results['metadata']['total_templates']}")
    print(f"Stable (Pass 2+ identical): {results['metadata']['stable_count']}")
    print(f"Unstable (Pass 2+ differs): {results['metadata']['unstable_count']}")
    print(f"Errors: {results['metadata']['error_count']}")

    # Return non-zero if any instabilities or errors
    if results['metadata']['unstable_count'] > 0 or results['metadata']['error_count'] > 0:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
