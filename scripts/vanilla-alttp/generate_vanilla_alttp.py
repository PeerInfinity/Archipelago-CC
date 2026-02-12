#!/usr/bin/env python3
"""
Generate a vanilla ALTTP seed with monkey patches applied.

Installs the vanilla patches (bottle fix, uncle weapon fix, pool adjustment,
dungeon item skip, key logic fix, silver bow fix), runs Generate.py with the
vanilla-full YAML template and plando enabled, then uninstalls patches.

This produces actual output files (presets, spoiler logs, etc.) unlike
test_vanilla_patches.py which uses --skip_output for verification only.

Usage:
    python scripts/vanilla-alttp/generate_vanilla_alttp.py --seed 1
"""

import argparse
import importlib.util
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
os.chdir(PROJECT_DIR)
sys.path.insert(0, PROJECT_DIR)

# Must be done before any Archipelago imports
sys.modules['ModuleUpdate'] = type(sys)('ModuleUpdate')
sys.modules['ModuleUpdate'].update = lambda *a, **kw: None
sys.modules['ModuleUpdate'].requirements_files = {}

# Import vanilla_patches from the hyphenated directory
spec = importlib.util.spec_from_file_location(
    'vanilla_patches',
    os.path.join(SCRIPT_DIR, 'vanilla_patches.py')
)
vanilla_patches = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vanilla_patches)


def main():
    parser = argparse.ArgumentParser(description='Generate a vanilla ALTTP seed with monkey patches')
    parser.add_argument('--seed', type=int, default=1, help='Seed number to generate')
    args = parser.parse_args()

    import settings as Settings
    Settings.no_gui = True

    vanilla_patches.install()
    try:
        from Generate import mystery_argparse, main as generate_main
        from Main import main as main_main

        parsed_args = mystery_argparse(
            ['--weights_file_path', 'Templates/A Link to the Past - vanilla-full.yaml',
             '--multi', '1', '--seed', str(args.seed),
             '--plando', 'bosses, connections, texts, items']
        )
        erargs, seed = generate_main(parsed_args)

        # Mark the ALTTP world class as vanilla so the exporter adds the _v
        # suffix to the preset directory (avoids overwriting the randomized seed 1 preset)
        from worlds.alttp.World import ALttPWorld
        ALttPWorld.is_vanilla = True

        main_main(erargs, seed=seed)
    finally:
        # Clean up: remove is_vanilla and uninstall patches
        try:
            from worlds.alttp.World import ALttPWorld
            if hasattr(ALttPWorld, 'is_vanilla'):
                del ALttPWorld.is_vanilla
        except ImportError:
            pass
        vanilla_patches.uninstall()

    print(f"Vanilla ALTTP seed {args.seed} generated successfully.")


if __name__ == '__main__':
    main()
