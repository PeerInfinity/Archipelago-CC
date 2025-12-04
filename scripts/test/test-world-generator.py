#!/usr/bin/env python3
"""
World Generator Round-Trip Test Script.

This script tests the world generator by:
1. Generating seeds for original worlds
2. Converting the rules.json to _test worlds using the world generator
3. Running spoiler tests on both original and _test worlds
4. Cross-validating by testing _test worlds with original sphere logs

Usage:
    python scripts/test/test-world-generator.py [options]
"""

import argparse
import glob
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
)
from lib.seed_utils import get_seed_id as compute_seed_id


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


def get_project_root() -> str:
    """Get the project root directory."""
    return str(Path(__file__).parent.parent.parent)


def cleanup_test_worlds(project_root: str) -> List[str]:
    """Delete all *_test world directories and return list of deleted dirs."""
    worlds_dir = os.path.join(project_root, 'worlds')
    deleted = []

    for item in os.listdir(worlds_dir):
        if item.endswith('_test'):
            path = os.path.join(worlds_dir, item)
            if os.path.isdir(path):
                shutil.rmtree(path)
                deleted.append(item)
                print(f"  Deleted: worlds/{item}")

    return deleted


def cleanup_test_templates(project_root: str) -> List[str]:
    """Delete all *Test.yaml template files and return list of deleted files."""
    templates_dir = os.path.join(project_root, 'Players', 'Templates')
    deleted = []

    for item in os.listdir(templates_dir):
        if item.endswith(' Test.yaml'):
            path = os.path.join(templates_dir, item)
            os.remove(path)
            deleted.append(item)
            print(f"  Deleted: Players/Templates/{item}")

    return deleted


def cleanup_test_presets(project_root: str) -> List[str]:
    """Delete all *_test preset directories and return list of deleted dirs."""
    presets_dir = os.path.join(project_root, 'frontend', 'presets')
    deleted = []

    if not os.path.exists(presets_dir):
        return deleted

    for item in os.listdir(presets_dir):
        if item.endswith('_test'):
            path = os.path.join(presets_dir, item)
            if os.path.isdir(path):
                shutil.rmtree(path)
                deleted.append(item)
                print(f"  Deleted: frontend/presets/{item}")

    return deleted


def generate_yaml_templates(project_root: str) -> bool:
    """Run the template generation command."""
    cmd = [
        sys.executable, '-c',
        "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
    ]
    return_code, stdout, stderr = run_command(cmd, cwd=project_root, timeout=120)
    return return_code == 0


def get_template_list(project_root: str, skip_list: List[str] = None, include_test: bool = False) -> List[str]:
    """Get list of template files to test."""
    templates_dir = os.path.join(project_root, 'Players', 'Templates')
    skip_list = skip_list or []

    templates = []
    for item in sorted(os.listdir(templates_dir)):
        if item.endswith('.yaml') and item not in skip_list:
            # Skip _test templates unless explicitly included
            if ' Test.yaml' in item:
                if include_test:
                    templates.append(item)
            else:
                templates.append(item)

    return templates


def get_test_template_list(project_root: str) -> List[str]:
    """Get list of _test template files."""
    templates_dir = os.path.join(project_root, 'Players', 'Templates')
    templates = []
    for item in sorted(os.listdir(templates_dir)):
        if item.endswith(' Test.yaml'):
            templates.append(item)
    return templates


def get_original_for_test_template(test_template: str) -> str:
    """Get the original template name from a test template name."""
    # "Game Test.yaml" -> "Game.yaml"
    return test_template.replace(' Test.yaml', '.yaml')


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
        # Extract error from output
        full_output = stdout + '\n' + stderr
        error_count, _, first_error, _ = count_errors_and_warnings(full_output)
        if first_error:
            result['error'] = first_error
        return result

    # Find the generated files
    game_name = normalize_game_name(template_name)
    preset_dir = os.path.join(project_root, 'frontend', 'presets', game_name, seed_id)

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
    project_root: str
) -> Dict:
    """Run the world generator to create a _test world."""
    result = {
        'success': False,
        'world_dir': output_dir,
        'error': None,
        'processing_time_seconds': 0
    }

    cmd = [
        sys.executable, '-m', 'exporter.converter.world_generator',
        rules_path,
        '--output', output_dir,
        '--game-name', game_name,
        '--force'
    ]

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


def run_spoiler_test(
    template_name: str,
    project_root: str,
    seed: int,
    seed_id: str = None
) -> Dict:
    """Run the spoiler test for a template."""
    result = {
        'success': False,
        'pass_fail': 'unknown',
        'sphere_reached': 0,
        'total_spheres': 0,
        'error': None,
        'processing_time_seconds': 0
    }

    if seed_id is None:
        seed_id = compute_seed_id(seed)

    game_name = normalize_game_name(template_name)
    preset_dir = f"presets/{game_name}/{seed_id}"

    # Run the spoiler test using npm test
    cmd = [
        'npm', 'test',
        f'--mode=test-spoilers',
        f'--game={preset_dir}',
        f'--seed={seed}'
    ]

    start_time = time.time()
    return_code, stdout, stderr = run_command(cmd, cwd=project_root, timeout=300)
    result['processing_time_seconds'] = round(time.time() - start_time, 2)

    full_output = stdout + '\n' + stderr

    # Parse the test results
    if 'passed' in full_output.lower() and return_code == 0:
        result['success'] = True
        result['pass_fail'] = 'pass'
    elif 'failed' in full_output.lower():
        result['pass_fail'] = 'fail'
        result['error'] = "Spoiler test failed"
    else:
        result['error'] = f"Unknown test result: return code {return_code}"

    return result


def copy_sphere_log(source_path: str, dest_path: str) -> bool:
    """Copy a sphere log file, overwriting the destination."""
    try:
        shutil.copy2(source_path, dest_path)
        return True
    except Exception as e:
        print(f"  Error copying sphere log: {e}")
        return False


def process_template(
    template_name: str,
    project_root: str,
    seed: int,
    results: Dict,
    skip_generation: bool = False,
    skip_spoiler_test: bool = False
) -> Dict:
    """
    Test a single template through the full round-trip process.

    Returns a result dict for this template.
    """
    game_name = normalize_game_name(template_name)
    game_name_display = template_name.replace('.yaml', '')

    print(f"\n{'='*60}")
    print(f"Testing: {game_name_display}")
    print('='*60)

    template_result = {
        'template': template_name,
        'game_name': game_name_display,
        'timestamp': datetime.now().isoformat(),
        'original': {
            'generation': {'success': False},
            'spoiler_test': {'success': False, 'pass_fail': 'unknown'}
        },
        'test_world': {
            'world_generation': {'success': False},
            'seed_generation': {'success': False},
            'spoiler_test': {'success': False, 'pass_fail': 'unknown'},
            'cross_validation': {'success': False, 'pass_fail': 'unknown'}
        },
        'errors': []
    }

    # Step 1: Generate original seed
    print(f"\n[1/6] Generating original seed...")
    if not skip_generation:
        gen_result = run_generation(template_name, project_root, seed)
        template_result['original']['generation'] = gen_result

        if not gen_result['success']:
            template_result['errors'].append(f"Original generation failed: {gen_result.get('error', 'Unknown error')}")
            print(f"  FAILED: {gen_result.get('error', 'Unknown error')}")
            return template_result

        print(f"  OK (seed_id: {gen_result['seed_id']})")
    else:
        print("  Skipped (--skip-generation)")
        template_result['original']['generation']['success'] = True
        template_result['original']['generation']['note'] = 'Skipped'

    # Step 2: Run spoiler test on original
    print(f"\n[2/6] Running spoiler test on original...")
    if not skip_spoiler_test:
        spoiler_result = run_spoiler_test(template_name, project_root, seed)
        template_result['original']['spoiler_test'] = spoiler_result

        if spoiler_result['pass_fail'] == 'pass':
            print(f"  PASS")
        else:
            print(f"  FAIL: {spoiler_result.get('error', 'Unknown error')}")
            template_result['errors'].append(f"Original spoiler test failed: {spoiler_result.get('error', '')}")
    else:
        print("  Skipped (--skip-spoiler-test)")
        template_result['original']['spoiler_test']['note'] = 'Skipped'

    # Step 3: Generate _test world from rules.json
    print(f"\n[3/6] Generating _test world from rules.json...")
    rules_path = template_result['original']['generation'].get('rules_path')

    if not rules_path or not os.path.exists(rules_path):
        # Try to find it
        seed_id = compute_seed_id(seed)
        rules_path = os.path.join(
            project_root, 'frontend', 'presets', game_name,
            seed_id, f'{seed_id}_rules.json'
        )

    if not os.path.exists(rules_path):
        template_result['errors'].append(f"Rules file not found: {rules_path}")
        print(f"  FAILED: Rules file not found")
        return template_result

    test_world_dir = os.path.join(project_root, 'worlds', f'{game_name}_test')
    test_game_name = f"{game_name_display} Test"

    world_gen_result = run_world_generator(
        rules_path, test_world_dir, test_game_name, project_root
    )
    template_result['test_world']['world_generation'] = world_gen_result

    if not world_gen_result['success']:
        template_result['errors'].append(f"World generation failed: {world_gen_result.get('error', 'Unknown error')}")
        print(f"  FAILED: {world_gen_result.get('error', 'Unknown error')}")
        return template_result

    print(f"  OK (created worlds/{game_name}_test/)")

    # Store info for later cleanup and testing
    template_result['test_world']['world_dir'] = test_world_dir
    template_result['test_world']['test_game_name'] = test_game_name
    template_result['test_world']['test_template_name'] = f"{game_name_display} Test.yaml"

    return template_result


def run_test_world_tests(
    template_results: Dict[str, Dict],
    project_root: str,
    seed: int,
    skip_spoiler_test: bool = False
) -> None:
    """
    Run generation and spoiler tests on all _test worlds.

    This is called after all _test worlds have been created and
    templates have been regenerated.
    """
    for game_name, result in template_results.items():
        if not result['test_world']['world_generation'].get('success'):
            continue

        test_template_name = result['test_world'].get('test_template_name')
        test_game_name = result['test_world'].get('test_game_name')
        original_game_name = result['game_name']

        if not test_template_name:
            continue

        print(f"\n{'='*60}")
        print(f"Testing _test world: {test_game_name}")
        print('='*60)

        # Step 4: Generate seed for _test world
        print(f"\n[4/6] Generating seed for _test world...")
        gen_result = run_generation(test_template_name, project_root, seed)
        result['test_world']['seed_generation'] = gen_result

        if not gen_result['success']:
            result['errors'].append(f"Test world generation failed: {gen_result.get('error', 'Unknown error')}")
            print(f"  FAILED: {gen_result.get('error', 'Unknown error')}")
            continue

        print(f"  OK (seed_id: {gen_result['seed_id']})")

        # Step 5: Run spoiler test on _test world
        print(f"\n[5/6] Running spoiler test on _test world...")
        if not skip_spoiler_test:
            spoiler_result = run_spoiler_test(test_template_name, project_root, seed)
            result['test_world']['spoiler_test'] = spoiler_result

            if spoiler_result['pass_fail'] == 'pass':
                print(f"  PASS")
            else:
                print(f"  FAIL: {spoiler_result.get('error', 'Unknown error')}")
                result['errors'].append(f"Test world spoiler test failed: {spoiler_result.get('error', '')}")
        else:
            print("  Skipped (--skip-spoiler-test)")
            result['test_world']['spoiler_test']['note'] = 'Skipped'

        # Step 6: Cross-validation - test with original sphere log
        print(f"\n[6/6] Cross-validation with original sphere log...")
        if not skip_spoiler_test:
            # Get paths
            seed_id = compute_seed_id(seed)
            original_game_dir = normalize_game_name(f"{original_game_name}.yaml")
            test_game_dir = normalize_game_name(test_template_name)

            original_sphere_log = os.path.join(
                project_root, 'frontend', 'presets', original_game_dir,
                seed_id, f'{seed_id}_sphere_log.jsonl'
            )
            test_sphere_log = os.path.join(
                project_root, 'frontend', 'presets', test_game_dir,
                seed_id, f'{seed_id}_sphere_log.jsonl'
            )

            if os.path.exists(original_sphere_log) and os.path.exists(os.path.dirname(test_sphere_log)):
                # Backup test sphere log
                test_sphere_log_backup = test_sphere_log + '.backup'
                if os.path.exists(test_sphere_log):
                    shutil.copy2(test_sphere_log, test_sphere_log_backup)

                # Copy original sphere log to test location
                if copy_sphere_log(original_sphere_log, test_sphere_log):
                    # Run spoiler test with original sphere log
                    cross_result = run_spoiler_test(test_template_name, project_root, seed)
                    result['test_world']['cross_validation'] = cross_result

                    if cross_result['pass_fail'] == 'pass':
                        print(f"  PASS - Original sphere log validates against _test world")
                    else:
                        print(f"  FAIL - Original sphere log does not validate")
                        result['errors'].append("Cross-validation failed: original sphere log incompatible with _test world")

                    # Restore test sphere log
                    if os.path.exists(test_sphere_log_backup):
                        shutil.move(test_sphere_log_backup, test_sphere_log)
                else:
                    result['test_world']['cross_validation']['error'] = "Failed to copy sphere log"
                    print(f"  FAILED: Could not copy sphere log")
            else:
                result['test_world']['cross_validation']['error'] = "Sphere log files not found"
                print(f"  SKIPPED: Sphere log files not found")
        else:
            print("  Skipped (--skip-spoiler-test)")
            result['test_world']['cross_validation']['note'] = 'Skipped'


def save_results(results: Dict, output_file: str) -> None:
    """Save results to JSON file."""
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description='Test world generator with round-trip validation'
    )
    parser.add_argument(
        '--seed', type=int, default=1,
        help='Seed number to use (default: 1)'
    )
    parser.add_argument(
        '--output-file', type=str,
        default='scripts/output/world-generator/test-results.json',
        help='Output file for test results'
    )
    parser.add_argument(
        '--skip-list', type=str, nargs='*', default=[],
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
        help='Skip cleanup of _test worlds after testing'
    )
    parser.add_argument(
        '--skip-generation', action='store_true',
        help='Skip seed generation (use existing presets)'
    )
    parser.add_argument(
        '--skip-spoiler-test', action='store_true',
        help='Skip spoiler tests'
    )
    parser.add_argument(
        '--phase', type=str, choices=['setup', 'generate-original', 'generate-test-worlds', 'regenerate-templates', 'test', 'cleanup', 'all'],
        default='all',
        help='Run only a specific phase'
    )
    parser.add_argument(
        '--no-backup', action='store_true',
        help='Do not create backup of existing results file'
    )
    parser.add_argument(
        '-v', '--verbose', action='store_true',
        help='Verbose output'
    )

    args = parser.parse_args()
    project_root = get_project_root()

    print("="*60)
    print("World Generator Round-Trip Test")
    print("="*60)
    print(f"Project root: {project_root}")
    print(f"Seed: {args.seed}")
    print(f"Output file: {args.output_file}")
    print(f"Phase: {args.phase}")

    # Initialize results - use dict keyed by game name for compatibility with combine-test-results.py
    results = {
        'metadata': {
            'timestamp': datetime.now().isoformat(),
            'seed': args.seed,
            'phase': args.phase,
            'total_templates': 0,
            'successful_generations': 0,
            'failed_generations': 0,
            'successful_test_worlds': 0,
            'failed_test_worlds': 0,
            'cross_validation_passed': 0,
            'cross_validation_failed': 0
        },
        'results': {}
    }

    # Phase: Setup
    if args.phase in ['setup', 'all']:
        print("\n" + "="*60)
        print("PHASE: Setup - Cleaning existing test artifacts")
        print("="*60)

        print("\nDeleting _test worlds...")
        cleanup_test_worlds(project_root)

        print("\nDeleting _test templates...")
        cleanup_test_templates(project_root)

        print("\nDeleting _test presets...")
        cleanup_test_presets(project_root)

        print("\nClearing and regenerating templates...")
        # Clear templates directory
        templates_dir = os.path.join(project_root, 'Players', 'Templates')
        for item in os.listdir(templates_dir):
            if item.endswith('.yaml'):
                os.remove(os.path.join(templates_dir, item))

        # Regenerate templates
        if not generate_yaml_templates(project_root):
            print("ERROR: Failed to generate templates")
            return 1

        print("Setup complete.")

    # Get template list
    templates = get_template_list(project_root, args.skip_list)

    if args.include_list:
        templates = [t for t in templates if t in args.include_list or t.replace('.yaml', '') in args.include_list]

    # Apply parallelization filters
    if args.skip_first > 0:
        templates = templates[args.skip_first:]
    if args.every_nth > 1:
        templates = templates[::args.every_nth]

    results['metadata']['total_templates'] = len(templates)
    print(f"\nTemplates to test: {len(templates)}")

    # Phase: Generate original seeds and create test worlds
    if args.phase in ['generate-original', 'generate-test-worlds', 'all']:
        print("\n" + "="*60)
        print("PHASE: Generate original seeds and create test worlds")
        print("="*60)

        for template in templates:
            template_result = process_template(
                template, project_root, args.seed, results,
                skip_generation=args.skip_generation,
                skip_spoiler_test=True  # We'll do spoiler tests in the test phase
            )
            # Use game_name as key for dictionary structure
            game_name = template_result.get('game_name', template.replace('.yaml', ''))
            results['results'][game_name] = template_result

            if template_result['original']['generation'].get('success'):
                results['metadata']['successful_generations'] += 1
            else:
                results['metadata']['failed_generations'] += 1

            if template_result['test_world']['world_generation'].get('success'):
                results['metadata']['successful_test_worlds'] += 1
            else:
                results['metadata']['failed_test_worlds'] += 1

    # Phase: Regenerate templates (to include _test worlds)
    if args.phase in ['regenerate-templates', 'all']:
        print("\n" + "="*60)
        print("PHASE: Regenerating templates to include _test worlds")
        print("="*60)

        if not generate_yaml_templates(project_root):
            print("ERROR: Failed to regenerate templates")
            return 1

        print("Templates regenerated.")

    # Phase: Run spoiler tests
    http_server_process = None
    if args.phase in ['test', 'all']:
        print("\n" + "="*60)
        print("PHASE: Running spoiler tests")
        print("="*60)

        # Start HTTP server if not running
        if not check_http_server():
            print("Starting HTTP server...")
            http_server_process = start_http_server(project_root)
            if check_http_server():
                print("  HTTP server started on port 8000")
            else:
                print("  WARNING: Failed to start HTTP server, spoiler tests may fail")

        # If we're running test phase standalone (parallel execution),
        # discover test templates from filesystem
        if args.phase == 'test' and not results['results']:
            print("\nDiscovering test templates from filesystem...")
            test_templates = get_test_template_list(project_root)

            # Filter by include list if specified
            if args.include_list:
                test_templates = [t for t in test_templates if t in args.include_list or t.replace('.yaml', '') in args.include_list]

            # Apply parallelization filters to test templates
            if args.skip_first > 0:
                test_templates = test_templates[args.skip_first:]
            if args.every_nth > 1:
                test_templates = test_templates[::args.every_nth]

            print(f"Found {len(test_templates)} test templates to process")

            for test_template in test_templates:
                original_template = get_original_for_test_template(test_template)
                game_name_display = original_template.replace('.yaml', '')
                test_game_name = test_template.replace('.yaml', '')

                print(f"\n{'='*60}")
                print(f"Testing: {test_game_name}")
                print('='*60)

                template_result = {
                    'template': original_template,
                    'game_name': game_name_display,
                    'timestamp': datetime.now().isoformat(),
                    'original': {
                        'generation': {'success': True, 'note': 'Phase 1'},
                        'spoiler_test': {'success': False, 'pass_fail': 'unknown'}
                    },
                    'test_world': {
                        'world_generation': {'success': True, 'note': 'Phase 1'},
                        'seed_generation': {'success': False},
                        'spoiler_test': {'success': False, 'pass_fail': 'unknown'},
                        'cross_validation': {'success': False, 'pass_fail': 'unknown'},
                        'test_template_name': test_template,
                        'test_game_name': test_game_name
                    },
                    'errors': []
                }

                # Run original spoiler test first
                print(f"\n[1/4] Running spoiler test on original ({original_template})...")
                if not args.skip_spoiler_test:
                    spoiler_result = run_spoiler_test(original_template, project_root, args.seed)
                    template_result['original']['spoiler_test'] = spoiler_result
                    print(f"  Result: {spoiler_result['pass_fail']}")
                else:
                    template_result['original']['spoiler_test']['note'] = 'Skipped'

                # Generate seed for test world
                print(f"\n[2/4] Generating seed for _test world...")
                gen_result = run_generation(test_template, project_root, args.seed)
                template_result['test_world']['seed_generation'] = gen_result

                if gen_result['success']:
                    print(f"  OK (seed_id: {gen_result['seed_id']})")

                    # Run spoiler test on test world
                    print(f"\n[3/4] Running spoiler test on _test world...")
                    if not args.skip_spoiler_test:
                        spoiler_result = run_spoiler_test(test_template, project_root, args.seed)
                        template_result['test_world']['spoiler_test'] = spoiler_result
                        print(f"  Result: {spoiler_result['pass_fail']}")
                    else:
                        template_result['test_world']['spoiler_test']['note'] = 'Skipped'

                    # Cross-validation
                    print(f"\n[4/4] Cross-validation with original sphere log...")
                    if not args.skip_spoiler_test:
                        seed_id = compute_seed_id(args.seed)
                        original_game_dir = normalize_game_name(original_template)
                        test_game_dir = normalize_game_name(test_template)

                        original_sphere_log = os.path.join(
                            project_root, 'frontend', 'presets', original_game_dir,
                            seed_id, f'{seed_id}_sphere_log.jsonl'
                        )
                        test_sphere_log = os.path.join(
                            project_root, 'frontend', 'presets', test_game_dir,
                            seed_id, f'{seed_id}_sphere_log.jsonl'
                        )

                        if os.path.exists(original_sphere_log) and os.path.exists(os.path.dirname(test_sphere_log)):
                            test_sphere_log_backup = test_sphere_log + '.backup'
                            if os.path.exists(test_sphere_log):
                                shutil.copy2(test_sphere_log, test_sphere_log_backup)

                            if copy_sphere_log(original_sphere_log, test_sphere_log):
                                cross_result = run_spoiler_test(test_template, project_root, args.seed)
                                template_result['test_world']['cross_validation'] = cross_result

                                if cross_result['pass_fail'] == 'pass':
                                    print(f"  PASS - Original sphere log validates against _test world")
                                else:
                                    print(f"  FAIL - Original sphere log does not validate")
                                    template_result['errors'].append("Cross-validation failed")

                                if os.path.exists(test_sphere_log_backup):
                                    shutil.move(test_sphere_log_backup, test_sphere_log)
                            else:
                                template_result['test_world']['cross_validation']['error'] = "Failed to copy sphere log"
                        else:
                            template_result['test_world']['cross_validation']['error'] = "Sphere log files not found"
                            print(f"  SKIPPED: Sphere log files not found")
                    else:
                        template_result['test_world']['cross_validation']['note'] = 'Skipped'
                else:
                    print(f"  FAILED: {gen_result.get('error', 'Unknown error')}")
                    template_result['errors'].append(f"Test world seed generation failed: {gen_result.get('error', '')}")

                # Use game_name as key for dictionary structure
                results['results'][game_name_display] = template_result

            results['metadata']['total_templates'] = len(test_templates)

        else:
            # Original flow for 'all' phase or when we have results from previous phases
            # Run spoiler tests on original worlds
            for game_name, result in results['results'].items():
                if result['original']['generation'].get('success'):
                    template_name = result['template']
                    print(f"\nTesting original: {template_name}")

                    if not args.skip_spoiler_test:
                        spoiler_result = run_spoiler_test(template_name, project_root, args.seed)
                        result['original']['spoiler_test'] = spoiler_result
                        print(f"  Result: {spoiler_result['pass_fail']}")

            # Run tests on _test worlds
            run_test_world_tests(
                results['results'], project_root, args.seed,
                skip_spoiler_test=args.skip_spoiler_test
            )

        # Update cross-validation counts
        for game_name, result in results['results'].items():
            if result['test_world']['cross_validation'].get('pass_fail') == 'pass':
                results['metadata']['cross_validation_passed'] += 1
            elif result['test_world']['cross_validation'].get('pass_fail') == 'fail':
                results['metadata']['cross_validation_failed'] += 1

        # Stop HTTP server if we started it
        if http_server_process:
            print("\nStopping HTTP server...")
            http_server_process.terminate()
            http_server_process.wait()

    # Phase: Cleanup
    if args.phase in ['cleanup', 'all'] and not args.skip_cleanup:
        print("\n" + "="*60)
        print("PHASE: Cleanup")
        print("="*60)

        print("\nDeleting _test worlds...")
        cleanup_test_worlds(project_root)

        print("\nDeleting _test templates...")
        cleanup_test_templates(project_root)

        print("\nDeleting _test presets...")
        cleanup_test_presets(project_root)

        print("\nRegenerating clean templates...")
        generate_yaml_templates(project_root)

        print("Cleanup complete.")

    # Save results
    save_results(results, os.path.join(project_root, args.output_file))

    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total templates: {results['metadata']['total_templates']}")
    print(f"Successful generations: {results['metadata']['successful_generations']}")
    print(f"Failed generations: {results['metadata']['failed_generations']}")
    print(f"Successful test worlds: {results['metadata']['successful_test_worlds']}")
    print(f"Failed test worlds: {results['metadata']['failed_test_worlds']}")
    print(f"Cross-validation passed: {results['metadata']['cross_validation_passed']}")
    print(f"Cross-validation failed: {results['metadata']['cross_validation_failed']}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
