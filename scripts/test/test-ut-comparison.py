#!/usr/bin/env python3
"""
UT Comparison Test Orchestrator

This script orchestrates the full UT comparison test by:
0. (Optional) Regenerating the game from YAML to get fresh sphere logs with metadata
1. Starting an Archipelago server with the provided game
2. Starting Universal Tracker in sphere log mode
3. Starting the TestDriverClient to drive the test
4. Running the comparison after all logs are generated
5. Reporting results

Usage:
    # Simplest usage - just provide the YAML file:
    python scripts/test/test-ut-comparison.py --yaml-file Players/Templates/Adventure.yaml

    # With existing game files:
    python scripts/test/test-ut-comparison.py \
        --game-file frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744.archipelago \
        --python-sphere-log frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl \
        --game "Adventure"

    # With regeneration from YAML (explicit options):
    python scripts/test/test-ut-comparison.py \
        --yaml-file Players/Templates/Adventure.yaml \
        --seed 1 \
        --slot-name "Player1" \
        --game "Adventure" \
        --preset-dir frontend/presets/adventure

Prerequisites:
    - Node.js installed (for comparison module)
    - No other Archipelago server running on the port
"""

import argparse
import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Add the project root to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT_ROOT)

from scripts.lib.seed_utils import get_seed_id
from scripts.lib.test_utils import (
    build_and_load_world_mapping,
    extract_game_name_from_template,
    get_world_directory_name_from_game_name
)

logger = logging.getLogger("UTComparisonTest")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


def setup_players_directory_for_ut(yaml_file: str) -> list:
    """
    Prepare the Players directory for Universal Tracker.

    UT looks for YAML files directly in the Players directory (not subdirectories).
    This function:
    1. Removes any existing .yaml files from Players/ (not subdirectories)
    2. Copies the specified template to Players/

    Returns a list of removed files so they can be restored later.
    """
    players_dir = Path(PROJECT_ROOT) / "Players"
    removed_files = []

    # Remove existing YAML files from Players/ (not subdirectories)
    for yaml_path in players_dir.glob("*.yaml"):
        if yaml_path.is_file():
            # Back up by moving to a temp location
            backup_path = yaml_path.with_suffix(".yaml.ut_backup")
            shutil.move(str(yaml_path), str(backup_path))
            removed_files.append((str(yaml_path), str(backup_path)))
            logger.info(f"Backed up {yaml_path.name}")

    # Copy the template to Players/
    yaml_path = Path(yaml_file)
    dest_path = players_dir / yaml_path.name
    shutil.copy(str(yaml_path), str(dest_path))
    logger.info(f"Copied {yaml_path.name} to Players/")

    return removed_files


def cleanup_players_directory(yaml_file: str, removed_files: list):
    """
    Clean up the Players directory after UT test.

    Removes the copied template and restores any backed up files.
    """
    players_dir = Path(PROJECT_ROOT) / "Players"

    # Remove the copied template
    yaml_name = Path(yaml_file).name
    copied_path = players_dir / yaml_name
    if copied_path.exists():
        copied_path.unlink()
        logger.info(f"Removed {yaml_name} from Players/")

    # Restore backed up files
    for original_path, backup_path in removed_files:
        if Path(backup_path).exists():
            shutil.move(backup_path, original_path)
            logger.info(f"Restored {Path(original_path).name}")


def run_generation(yaml_file: str, seed: str, preset_dir: str) -> dict:
    """
    Run game generation using Generate.py.

    Uses seed_utils.get_seed_id() to predict the output filename from the seed.
    Calls Generate.py the same way as test_runner.py for consistency.

    Returns dict with:
        - success: bool
        - game_file: path to .archipelago file
        - sphere_log: path to sphere_log.jsonl
        - error: error message if failed
    """
    result = {
        "success": False,
        "game_file": None,
        "sphere_log": None,
        "error": None
    }

    # Compute the seed ID from the seed number
    seed_id = get_seed_id(int(seed))  # e.g., "AP_14089154938208861744"

    # Create preset directory if it doesn't exist
    preset_path = Path(preset_dir)
    preset_path.mkdir(parents=True, exist_ok=True)

    # Generate.py creates a subdirectory with the seed ID
    # e.g., frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744.archipelago
    seed_dir = preset_path / seed_id
    game_file = seed_dir / f"{seed_id}.archipelago"
    sphere_log = seed_dir / f"{seed_id}_sphere_log.jsonl"

    try:
        logger.info("=" * 60)
        logger.info("Step 0: Running game generation")
        logger.info("=" * 60)
        logger.info(f"YAML file: {yaml_file}")
        logger.info(f"Seed: {seed} -> {seed_id}")
        logger.info(f"Output directory: {preset_path}")

        # Run Generate.py the same way as test_runner.py:
        # Use --weights_file_path with absolute path, --multi 1
        # test_runner.py uses: os.path.join(templates_dir, template_file) where templates_dir is absolute
        yaml_abs_path = str(Path(yaml_file).resolve())
        generate_cmd = [
            "python", "Generate.py",
            "--weights_file_path", yaml_abs_path,
            "--multi", "1",
            "--seed", seed
        ]

        logger.info(f"Running: {' '.join(generate_cmd)}")

        proc = subprocess.run(
            generate_cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout for generation (same as test_runner.py)
            cwd=str(PROJECT_ROOT)
        )

        if proc.returncode != 0:
            result["error"] = f"Generation failed: {proc.stdout}\n{proc.stderr}"
            logger.error(result["error"])
            return result

        logger.info("Generation completed successfully")

        # Verify expected files exist
        if not game_file.exists():
            result["error"] = f"Expected game file not found: {game_file}"
            return result

        if not sphere_log.exists():
            result["error"] = f"Expected sphere log not found: {sphere_log}"
            return result

        result["game_file"] = str(game_file)
        result["sphere_log"] = str(sphere_log)
        result["success"] = True

        logger.info(f"Game file: {result['game_file']}")
        logger.info(f"Sphere log: {result['sphere_log']}")

        # Clean up the zip file (Generate.py creates both zip and extracted directory)
        zip_file = preset_path / f"{seed_id}.zip"
        if zip_file.exists():
            zip_file.unlink()
            logger.info(f"Cleaned up zip file: {zip_file}")

        return result

    except subprocess.TimeoutExpired:
        result["error"] = "Generation timed out after 10 minutes"
        return result
    except Exception as e:
        result["error"] = f"Generation failed with exception: {e}"
        return result


class ProcessManager:
    """Manages subprocess lifecycle for the test."""

    def __init__(self):
        self.processes: list[subprocess.Popen] = []

    def start(self, cmd: list[str], name: str, env: dict = None) -> subprocess.Popen:
        """Start a subprocess and track it."""
        logger.info(f"[{name}] Starting: {' '.join(cmd)}")
        process_env = os.environ.copy()
        if env:
            process_env.update(env)
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=process_env,
            text=True
        )
        self.processes.append(proc)
        return proc

    def cleanup(self):
        """Terminate all running processes."""
        for proc in self.processes:
            if proc.poll() is None:
                logger.info(f"Terminating process {proc.pid}")
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    logger.warning(f"Process {proc.pid} did not terminate, killing")
                    proc.kill()
        self.processes.clear()


async def wait_for_server(port: int, timeout: float = 30.0) -> bool:
    """Wait for the server to be ready to accept connections."""
    import socket
    start = time.time()
    while time.time() - start < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            if result == 0:
                logger.info(f"Server is ready on port {port}")
                return True
        except Exception:
            pass
        await asyncio.sleep(0.5)
    return False


async def run_test(args) -> dict:
    """Run the full UT comparison test."""
    pm = ProcessManager()
    results = {
        "success": False,
        "server_started": False,
        "ut_started": False,
        "driver_completed": False,
        "comparison_completed": False,
        "comparison_result": None,
        "error": None
    }

    try:
        # Create output directory for comparison results
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save UT sphere log alongside the preset files (same directory as game file)
        # Use naming convention: AP_<seed>_sphere_log_ut.jsonl
        game_file_path = Path(args.game_file)
        preset_dir = game_file_path.parent
        game_basename = game_file_path.stem  # e.g., "AP_14089154938208861744"
        ut_sphere_log = preset_dir / f"{game_basename}_sphere_log_ut.jsonl"
        comparison_output = output_dir / "comparison_result.json"

        # Clean up any existing UT log
        if ut_sphere_log.exists():
            ut_sphere_log.unlink()

        # Clean up any existing debug log
        debug_log = preset_dir / f"{game_basename}_debug_log_ut.jsonl"
        if debug_log.exists():
            debug_log.unlink()

        # Delete any .apsave files to ensure fresh server state
        for apsave_file in preset_dir.glob("*.apsave"):
            logger.info(f"Deleting save file: {apsave_file}")
            apsave_file.unlink()

        # Step 1: Start the server
        logger.info("=" * 60)
        logger.info("Step 1: Starting Archipelago server")
        logger.info("=" * 60)

        server_cmd = [
            sys.executable, "MultiServer.py",
            "--host", "localhost",
            "--port", str(args.port),
            args.game_file
        ]
        server_proc = pm.start(server_cmd, "Server")

        # Wait for server to be ready
        if not await wait_for_server(args.port):
            results["error"] = "Server failed to start"
            return results
        results["server_started"] = True

        # Step 2: Start Universal Tracker
        logger.info("=" * 60)
        logger.info("Step 2: Starting Universal Tracker")
        logger.info("=" * 60)

        ut_cmd = [
            sys.executable, "-m", "worlds.tracker.TrackerClient",
            "--connect", f"localhost:{args.port}",
            "--name", args.slot_name,
            "--sphere-log-mode",
            "--sphere-log-output", str(ut_sphere_log),
            "--seed", args.seed,  # Pass seed to ensure UT generates with same seed as Python
            "--nogui"
        ]
        ut_proc = pm.start(ut_cmd, "UT")

        # Give UT time to connect
        await asyncio.sleep(5)

        # Check if UT is still running
        if ut_proc.poll() is not None:
            stdout, _ = ut_proc.communicate()
            results["error"] = f"UT exited early: {stdout}"
            return results
        results["ut_started"] = True

        # Step 3: Run the test driver
        logger.info("=" * 60)
        logger.info("Step 3: Running Test Driver")
        logger.info("=" * 60)

        driver_cmd = [
            sys.executable, "scripts/test/TestDriverClient.py",
            "--connect", f"localhost:{args.port}",
            "--name", args.slot_name,
            "--sphere-log", args.python_sphere_log,
            "--game", args.game
        ]

        driver_proc = pm.start(driver_cmd, "Driver")

        # Wait for driver to complete (with timeout)
        try:
            driver_proc.wait(timeout=600)
            results["driver_completed"] = driver_proc.returncode == 0
            if not results["driver_completed"]:
                stdout, _ = driver_proc.communicate()
                results["error"] = f"Driver failed: {stdout}"
        except subprocess.TimeoutExpired:
            results["error"] = "Driver timed out"
            return results

        # Give UT time to finish writing logs
        await asyncio.sleep(2)

        # Step 4: Run comparison
        logger.info("=" * 60)
        logger.info("Step 4: Running Sphere Log Comparison")
        logger.info("=" * 60)

        if not ut_sphere_log.exists():
            results["error"] = f"UT sphere log not found: {ut_sphere_log}"
            return results

        comparison_cmd = [
            "node", "scripts/test/compare-sphere-logs.cjs",
            "--python-log", args.python_sphere_log,
            "--ut-log", str(ut_sphere_log),
            "--output", str(comparison_output)
        ]

        # Add ignore options
        if args.ignore_events:
            comparison_cmd.append("--ignore-events")
        if args.auto_ignore_events:
            comparison_cmd.append("--auto-ignore-events")
        for loc in args.ignore_location:
            comparison_cmd.extend(["--ignore-location", loc])
        for item in args.ignore_item:
            comparison_cmd.extend(["--ignore-item", item])

        comparison_proc = subprocess.run(
            comparison_cmd,
            capture_output=True,
            text=True
        )

        results["comparison_completed"] = True
        print(comparison_proc.stdout)
        if comparison_proc.stderr:
            print(comparison_proc.stderr, file=sys.stderr)

        # Load comparison results
        if comparison_output.exists():
            with open(comparison_output) as f:
                results["comparison_result"] = json.load(f)
                results["success"] = results["comparison_result"].get("all_match", False)

        return results

    except Exception as e:
        logger.exception(f"Test failed with exception: {e}")
        results["error"] = str(e)
        return results
    finally:
        logger.info("Cleaning up processes...")
        pm.cleanup()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="UT Comparison Test Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    # Generation options (alternative to providing pre-generated files)
    parser.add_argument('--yaml-file',
                        help='Path to YAML config file for game generation')
    parser.add_argument('--seed', default='1',
                        help='Seed for game generation (default: 1)')
    parser.add_argument('--preset-dir',
                        help='Directory to store generated preset files (derived from YAML if not specified)')

    # Pre-generated file options
    parser.add_argument('--game-file',
                        help='Path to .archipelago game file (not needed if using --yaml-file)')
    parser.add_argument('--python-sphere-log',
                        help='Path to Python-generated sphere_log.jsonl (not needed if using --yaml-file)')

    # Options with sensible defaults
    parser.add_argument('--slot-name', default='Player1',
                        help='Slot name to connect as (default: Player1)')
    parser.add_argument('--game',
                        help='Game name (e.g., "Adventure") - derived from YAML if not specified')

    # Server options
    parser.add_argument('--port', type=int, default=38290,
                        help='Server port (default: 38290)')
    parser.add_argument('--output-dir', default='/tmp/ut-comparison-results',
                        help='Output directory for results')

    # Comparison options
    parser.add_argument('--ignore-events', action='store_true',
                        help='Ignore hardcoded event locations and items in comparison')
    parser.add_argument('--auto-ignore-events', action='store_true', default=True,
                        help='Auto-detect event locations/items from sphere log metadata (default: enabled)')
    parser.add_argument('--no-auto-ignore-events', action='store_false', dest='auto_ignore_events',
                        help='Disable auto-detection of event locations/items')
    parser.add_argument('--ignore-location', action='append', default=[],
                        help='Ignore specific location (can be repeated)')
    parser.add_argument('--ignore-item', action='append', default=[],
                        help='Ignore specific item (can be repeated)')

    args = parser.parse_args()

    # Determine if we need to generate or use existing files
    use_generation = args.yaml_file is not None

    if use_generation:
        # Validate YAML file exists
        if not os.path.exists(args.yaml_file):
            logger.error(f"YAML file not found: {args.yaml_file}")
            return 1

        # Extract game name from YAML if not provided
        if not args.game:
            args.game = extract_game_name_from_template(args.yaml_file)
            if not args.game:
                logger.error("Could not extract game name from YAML file. Please specify --game")
                return 1
            logger.info(f"Detected game name from YAML: {args.game}")

        # Derive preset directory if not provided
        if not args.preset_dir:
            # Use world mapping for accurate world directory resolution
            # This handles variable references in game declarations (e.g., game = CONSTANT)
            world_directory = None
            world_mapping = build_and_load_world_mapping(PROJECT_ROOT)
            if args.game in world_mapping:
                world_directory = world_mapping[args.game].get('world_directory')
                if world_directory:
                    logger.info(f"Found world directory from mapping: {world_directory}")
            if not world_directory:
                # Fallback to regex-based resolution
                world_directory = get_world_directory_name_from_game_name(args.game)
                logger.info(f"Using world directory from fallback: {world_directory}")
            args.preset_dir = os.path.join(PROJECT_ROOT, 'frontend', 'presets', world_directory)
            logger.info(f"Using preset directory: {args.preset_dir}")

        # Run generation
        gen_result = run_generation(args.yaml_file, args.seed, args.preset_dir)
        if not gen_result["success"]:
            logger.error(f"Generation failed: {gen_result['error']}")
            return 1

        # Update args with generated file paths
        args.game_file = gen_result["game_file"]
        args.python_sphere_log = gen_result["sphere_log"]
    else:
        # Validate pre-generated file inputs
        if not args.game_file:
            logger.error("--game-file is required when not using --yaml-file")
            return 1
        if not args.python_sphere_log:
            logger.error("--python-sphere-log is required when not using --yaml-file")
            return 1
        if not args.game:
            logger.error("--game is required when not using --yaml-file")
            return 1
        if not os.path.exists(args.game_file):
            logger.error(f"Game file not found: {args.game_file}")
            return 1
        if not os.path.exists(args.python_sphere_log):
            logger.error(f"Python sphere log not found: {args.python_sphere_log}")
            return 1

    # Set up Players directory for UT (it looks for YAMLs in Players/, not subdirectories)
    removed_files = []
    if args.yaml_file:
        removed_files = setup_players_directory_for_ut(args.yaml_file)

    # Run the test
    try:
        results = asyncio.run(run_test(args))
    finally:
        # Clean up Players directory
        if args.yaml_file:
            cleanup_players_directory(args.yaml_file, removed_files)

    # Report results
    logger.info("=" * 60)
    logger.info("TEST RESULTS")
    logger.info("=" * 60)
    logger.info(f"Server started: {results['server_started']}")
    logger.info(f"UT started: {results['ut_started']}")
    logger.info(f"Driver completed: {results['driver_completed']}")
    logger.info(f"Comparison completed: {results['comparison_completed']}")

    if results['comparison_result']:
        summary = results['comparison_result'].get('summary', {})
        logger.info(f"Matched spheres: {summary.get('matched_entries', 0)}")
        logger.info(f"Mismatched spheres: {summary.get('mismatched_entries', 0)}")

    if results['error']:
        logger.error(f"Error: {results['error']}")

    if results['success']:
        logger.info("RESULT: PASS - All spheres match")
        return 0
    else:
        logger.error("RESULT: FAIL - Mismatches found or test failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
