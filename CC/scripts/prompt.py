#!/usr/bin/env python3
"""
Script to generate Claude CLI commands for working on game implementations.
Takes a game name as parameter and generates the appropriate command with context.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Add parent directory to path to import from scripts/lib
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'scripts'))
from lib.seed_utils import get_seed_id


def load_world_mapping():
    """Load the world mapping from the JSON file."""
    script_dir = Path(__file__).parent.parent.parent / 'scripts' / 'data'
    mapping_file = script_dir / 'world-mapping.json'

    if not mapping_file.exists():
        print(f"Error: World mapping file not found at {mapping_file}", file=sys.stderr)
        print("Please run scripts/build/build-world-mapping.py first", file=sys.stderr)
        sys.exit(1)
    
    with open(mapping_file, 'r') as f:
        return json.load(f)


def get_game_info(game_name, world_mapping):
    """Get game information from the world mapping."""
    # Remove .yaml extension if present for lookup
    lookup_name = game_name[:-5] if game_name.endswith('.yaml') else game_name
    
    # First try direct lookup by game name
    if lookup_name in world_mapping:
        return world_mapping[lookup_name], lookup_name
    
    # If not found, try lookup by world directory
    for name, info in world_mapping.items():
        if info['world_directory'] == lookup_name:
            return info, name
    
    # Not found by either method
    print(f"Error: Game '{lookup_name}' not found in world mapping (by name or directory)", file=sys.stderr)
    print(f"Available games:", file=sys.stderr)
    for name in sorted(world_mapping.keys()):
        world_dir = world_mapping[name]['world_directory']
        print(f"  - {name} (directory: {world_dir})", file=sys.stderr)
    sys.exit(1)


def build_prompt(game_name, game_info, seed=1, use_cloud_docs=False):
    """Build the Claude prompt with appropriate messages."""
    world_dir = game_info['world_directory']

    # Compute seed ID from seed number
    seed_id = get_seed_id(seed)

    # Ensure game name has .yaml extension for template path
    template_name = game_name if game_name.endswith('.yaml') else f"{game_name}.yaml"

    # Build exporter message
    if game_info['has_custom_exporter']:
        exporter_path = game_info['exporter_path']
        exporter_message = f"A custom exporter already exists for this game, in {exporter_path}"
    else:
        exporter_message = "This game does not yet have a custom exporter. You will need to create one."

    # Build helper message
    if game_info['has_custom_game_logic']:
        helper_path = game_info['game_logic_path']
        helper_message = f"A custom helper function file already exists for this game, in {helper_path}"
    else:
        helper_message = "This game does not yet have a custom helper function file. This is a helper issue - you may need to create one if there are test failures caused by missing helper functions."

    # Choose appropriate documentation based on cloud/local mode
    if use_cloud_docs:
        setup_doc = "CC/cloud-setup.md"
        debugging_doc = "CC/game-debugging-CC.md"
        setup_instruction = f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read {debugging_doc}."""
    else:
        debugging_doc = "CC/game-debugging.md"
        setup_instruction = f"Please read {debugging_doc}."

    # Build the full prompt
    prompt = f"""{setup_instruction}

The next game we want to work on is {game_name}.

The command to generate the rules.json file is

python Generate.py --weights_file_path "Templates/{template_name}" --multi 1 --seed {seed} > generate_output.txt

The command to run the spoiler test is

npm test --mode=test-spoilers --game={world_dir} --seed={seed}

These commands need to be run from the project root directory.

{exporter_message}

{helper_message}

The rules.json file already exists for this game, in frontend/presets/{world_dir}/{seed_id}/{seed_id}_rules.json

The sphere log file already exists for this game, in frontend/presets/{world_dir}/{seed_id}/{seed_id}_spheres_log.jsonl

As you work on this task, please keep these documents up to date:

CC/scripts/logs/{world_dir}/remaining-exporter-issues.md
CC/scripts/logs/{world_dir}/solved-exporter-issues.md
CC/scripts/logs/{world_dir}/remaining-helper-issues.md
CC/scripts/logs/{world_dir}/solved-helper-issues.md
CC/scripts/logs/{world_dir}/remaining-general-issues.md
CC/scripts/logs/{world_dir}/solved-general-issues.md

Before you begin working, read the documents that list the remaining issues.

Please also read frontend/schema/rules.schema.json

Work on just one issue at a time, or one set of related issues.

Your first priority is to fix the exporter issues. Your second priority is to fix the helper issues. Your third priority is to fix the other issues.

After choosing an issue to work on, run the generation script and spoiler test to confirm that the issue still exists, and then begin working on fixing it.

If the spoiler test passes, then run this command:

python scripts/test/test-all-templates.py --retest --retest-continue 10 -p

Please make as much progress as you can without supervision."""

# Removed:

# python scripts/test/test-all-templates.py --include-list "{template_name}" --seed {seed} -p

# - Important: Every time you add a new issue to remaining-exporter-issues.md, immediately run the command
# - python CC/scripts/delegate.py
# - When the command finishes, rerun the generation command to check if the issue was successfully resolved.
#

    return prompt


def build_command(prompt):
    """Build the full Claude CLI command."""
    # Escape the prompt for shell - replace newlines with \n and escape special characters
    escaped_prompt = prompt.replace('\n', '\\n').replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
    
    # Updated jq filter to handle both text and tool_use content
    command = f'claude -p "{escaped_prompt}" --dangerously-skip-permissions --output-format stream-json --verbose 2>/dev/null | jq -r \'select(.type == "assistant") | if .message.content[0].type == "text" then .message.content[0].text elif .message.content[0].type == "tool_use" then "[" + .message.content[0].name + "] " + (.message.content[0].input | tostring) else empty end\''
    
    return command


def setup_game_logs(world_dir):
    """Set up the log directory structure and files for a game."""
    script_dir = Path(__file__).parent
    logs_dir = script_dir / 'logs'
    game_logs_dir = logs_dir / world_dir
    
    # Ensure game logs directory exists
    game_logs_dir.mkdir(parents=True, exist_ok=True)
    
    # Create issue tracking files if they don't exist
    issue_files = [
        'remaining-exporter-issues.md',
        'solved-exporter-issues.md',
        'remaining-helper-issues.md',
        'solved-helper-issues.md',
        'remaining-general-issues.md',
        'solved-general-issues.md'
    ]
    
    for filename in issue_files:
        file_path = game_logs_dir / filename
        if not file_path.exists():
            with open(file_path, 'w') as f:
                f.write(f"# {filename.replace('-', ' ').replace('.md', '').title()}\n\n")


def get_or_set_current_game(game_name=None):
    """Get or set the current game name from/to the logs file."""
    script_dir = Path(__file__).parent
    logs_dir = script_dir / 'logs'
    current_game_file = logs_dir / 'current-game.txt'
    
    # Ensure logs directory exists
    logs_dir.mkdir(exist_ok=True)
    
    if game_name:
        # Write the game name to the file
        with open(current_game_file, 'w') as f:
            f.write(game_name)
        return game_name
    else:
        # Read the game name from the file
        if current_game_file.exists():
            with open(current_game_file, 'r') as f:
                return f.read().strip()
        else:
            print("Error: No current game set and no game name provided", file=sys.stderr)
            print("Please run with a game name first to set the current game", file=sys.stderr)
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Generate Claude CLI commands for game implementation work')
    parser.add_argument('game_name', nargs='?', help='Name of the game (e.g., "A Hat in Time") or world directory (e.g., "ahit"). If not provided, uses the previously set current game.')
    parser.add_argument('-t', '--text', action='store_true', help='Output the command text instead of running it')
    parser.add_argument('-p', '--prompt', action='store_true', help='Output just the prompt contents')
    parser.add_argument('-s', '--seed', type=int, default=1, help='Seed number to use for generation (default: 1)')
    parser.add_argument('--CC', action='store_true', help='Use cloud-specific documentation (CC/cloud-setup.md and CC/game-debugging-CC.md)')

    args = parser.parse_args()

    # Get or set the current game
    game_name = get_or_set_current_game(args.game_name)

    # Load world mapping
    world_mapping = load_world_mapping()

    # Get game info
    game_info, actual_game_name = get_game_info(game_name, world_mapping)

    # Set up log directory structure for this game
    world_dir = game_info['world_directory']
    setup_game_logs(world_dir)

    # Build prompt using the actual game name (important for template path)
    prompt = build_prompt(actual_game_name, game_info, args.seed, args.CC)

    if args.prompt:
        # Output just the prompt contents
        print(prompt)
    elif args.text:
        # Output the command text for copy/paste
        command = build_command(prompt)
        print(command)
    else:
        # Execute the command
        command = build_command(prompt)
        try:
            subprocess.run(command, shell=True, check=False)
        except KeyboardInterrupt:
            print("\nInterrupted by user", file=sys.stderr)
            sys.exit(130)
        except Exception as e:
            print(f"Error executing command: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()