"""
Execution functions for running prompts and tests.
"""

import subprocess
import sys
from pathlib import Path


def run_template_test(template_file, seed=1, stream_output=True):
    """Run the template test for a specific template file."""
    print(f"Running template test for: {template_file} (seed {seed})")
    try:
        if stream_output:
            # Stream output so user can see progress
            result = subprocess.run(
                ['python', 'scripts/test/test-all-templates.py', '--include-list', template_file, '--seed', str(seed)],
                stdout=None, stderr=None, check=False
            )
        else:
            result = subprocess.run(
                ['python', 'scripts/test/test-all-templates.py', '--include-list', template_file, '--seed', str(seed)],
                capture_output=True, text=True, check=False
            )
        return result.returncode == 0
    except Exception as e:
        print(f"Error running template test: {e}", file=sys.stderr)
        return False


def run_prompt_for_game(game_name, use_text_mode=False, use_prompt_mode=False, seed=1, quiet_mode=False, use_cloud_docs=False, use_full_spoilers=False):
    """Run the prompt script for a specific game."""
    if not quiet_mode:
        print(f"Running prompt script for game: {game_name}")
    try:
        cmd = ['python', 'CC/scripts/prompt.py', game_name, '--seed', str(seed)]
        if use_text_mode:
            cmd.append('--text')
        if use_prompt_mode:
            cmd.append('--prompt')
        if use_cloud_docs:
            cmd.append('--CC')
        if use_full_spoilers:
            cmd.append('--full-spoilers')

        result = subprocess.run(cmd, check=False)
        return result.returncode == 0
    except Exception as e:
        if not quiet_mode:
            print(f"Error running prompt script: {e}", file=sys.stderr)
        return False


def get_prompt_for_game(game_name, seed=1, use_cloud_docs=False, use_full_spoilers=False):
    """Get the prompt text for a specific game without running it."""
    try:
        cmd = ['python', 'CC/scripts/prompt.py', game_name, '--seed', str(seed), '--prompt']
        if use_cloud_docs:
            cmd.append('--CC')
        if use_full_spoilers:
            cmd.append('--full-spoilers')
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode == 0:
            return result.stdout
        else:
            print(f"Error getting prompt for {game_name}: {result.stderr}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Error getting prompt for {game_name}: {e}", file=sys.stderr)
        return None


def run_all_promptfiles(project_root, script_path=None):
    """Run all prompt-generating modes and output to separate files.

    Creates CC/scripts/prompts/ directory and generates a separate prompt file for each mode.

    Args:
        project_root: Path to the project root directory.
        script_path: Path to the prompt-all-templates.py script. If None, will be inferred.
    """
    prompts_dir = Path(project_root) / 'CC' / 'scripts' / 'prompts'
    prompts_dir.mkdir(exist_ok=True)

    # Define all the modes to run with their output filenames
    modes = [
        (['--minimal-spoilers', '--CC'], 'minimal-spoilers.txt'),
        (['--full-spoilers', '--CC'], 'full-spoilers.txt'),
        (['--multiclient', '--CC'], 'multiclient.txt'),
        (['--multiworld', '--CC'], 'multiworld.txt'),
        (['--basic-spoiler-debug', '--CC'], 'basic-spoiler-debug.txt'),
        (['--helper-export', '--CC'], 'helper-export.txt'),
        (['--exporter-simplify', '--CC'], 'exporter-simplify.txt'),
        (['--new-rule-types', '--CC'], 'new-rule-types.txt'),
        (['--gen-errors', '--CC'], 'gen-errors.txt'),
        (['--worldgen-world-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-world-failures.txt'),
        (['--worldgen-seed-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-seed-failures.txt'),
        (['--worldgen-spoiler-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-spoiler-failures.txt'),
        (['--worldgen-crossval-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-crossval-failures.txt'),
        (['--worldgen-rules-comp-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-rules-comp-failures.txt'),
    ]

    # Use provided script path or infer it
    if script_path is None:
        script_path = Path(project_root) / 'CC' / 'scripts' / 'prompt-all-templates.py'

    results = []

    for mode_args, output_filename in modes:
        output_file = prompts_dir / output_filename
        print(f"\n{'='*60}")
        print(f"Running mode: {' '.join(mode_args)}")
        print(f"{'='*60}")

        # Run the script with --promptfile and --loud to show progress
        # Stream stdout to show progress, capture stderr for error checking
        cmd = ['python', str(script_path), '--promptfile', '--loud'] + mode_args
        result = subprocess.run(cmd, stdout=None, stderr=subprocess.PIPE, text=True, check=False)

        if result.returncode != 0:
            print(f"  Warning: Mode {mode_args} returned non-zero exit code")
            if result.stderr:
                print(f"  stderr: {result.stderr[:200]}")

        # The script writes to CC/scripts/prompts.txt, so move it to the mode-specific file
        default_output = Path(project_root) / 'CC' / 'scripts' / 'prompts.txt'
        if default_output.exists():
            # Read the content and count prompts
            with open(default_output, 'r') as f:
                content = f.read()

            # Count prompts by counting separator blocks (or 1 if no separators)
            if content.strip():
                prompt_count = content.count('=' * 80) + 1
                # Write to mode-specific file
                with open(output_file, 'w') as f:
                    f.write(content)
                results.append((output_filename, prompt_count))
                print(f"  Created {output_file} with {prompt_count} prompts")
            else:
                results.append((output_filename, 0))
                print(f"  No prompts generated for this mode")

            # Remove the default file
            default_output.unlink()
        else:
            results.append((output_filename, 0))
            print(f"  No prompts generated for this mode")

    # Print summary
    print(f"\n{'='*60}")
    print("Summary:")
    print(f"{'='*60}")
    total_prompts = 0
    for filename, count in results:
        if count > 0:
            print(f"  {filename}: {count} prompts")
            total_prompts += count
        else:
            print(f"  {filename}: (empty)")
    print(f"\nTotal: {total_prompts} prompts across {len([r for r in results if r[1] > 0])} files")
    print(f"Output directory: {prompts_dir}")

    return 0
