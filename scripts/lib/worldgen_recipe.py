"""How a committed world_generator package is (re)generated — the ONE recipe.

`world_generator_command` is the command `scripts/test/test-world-generator.py` runs
for every template, and the command the package freshness check
(`scripts/test/check-worldgen-package-freshness.py`) runs for every committed package.
`scripts/data/worldgen-package-recipes.json` names each committed package's source
rules.json, game name and canonical seed. Measured 2026-10-15 (rules-produced-blocks):
all 16 committed packages regenerate byte-identically from these entries.
"""

import json
import os
import sys
from typing import Dict, List, Optional

RECIPES_FILE = os.path.join('scripts', 'data', 'worldgen-package-recipes.json')


def world_generator_command(rules_path: str, output_dir: str, game_name: str,
                            canonical_seed: Optional[int] = None) -> List[str]:
    """The world_generator invocation for one package (always with name substitutions)."""
    cmd = [
        sys.executable, '-m', 'world_generator',
        rules_path,
        '--output', output_dir,
        '--game-name', game_name,
        '--force',
        '--apply-name-substitutions',
    ]
    if canonical_seed is not None:
        cmd.extend(['--canonical-seed', str(canonical_seed)])
    return cmd


def load_recipes(project_root: str) -> Dict[str, Dict]:
    """`{package directory: {source, game_name, canonical_seed}}`, from the recipe table."""
    with open(os.path.join(project_root, RECIPES_FILE), encoding='utf-8') as f:
        return json.load(f)['packages']


def committed_packages(project_root: str) -> List[str]:
    """Every `worlds/<pkg>` whose `archipelago.json` names the World Generator as its author."""
    worlds = os.path.join(project_root, 'worlds')
    out = []
    for name in sorted(os.listdir(worlds)):
        manifest = os.path.join(worlds, name, 'archipelago.json')
        if not os.path.isfile(manifest):
            continue
        with open(manifest, encoding='utf-8') as f:
            if 'World Generator' in (json.load(f).get('authors') or []):
                out.append(name)
    return out


def _tree_differences(fresh: str, committed: str, rel: str = '') -> List[str]:
    """Relative paths that differ between two package trees (`__pycache__` ignored; CRLF read as LF,
    so a Windows checkout of an LF file is not a difference)."""
    out = []
    a = {n for n in os.listdir(fresh) if n != '__pycache__'}
    b = {n for n in os.listdir(committed) if n != '__pycache__'}
    for name in sorted(a | b):
        path = f'{rel}{name}'
        if name not in b:
            out.append(f'{path} (only in the regenerated package)')
        elif name not in a:
            out.append(f'{path} (only in the committed package)')
        elif os.path.isdir(os.path.join(fresh, name)):
            out.extend(_tree_differences(os.path.join(fresh, name), os.path.join(committed, name), f'{path}/'))
        else:
            with open(os.path.join(fresh, name), 'rb') as f:
                x = f.read().replace(b'\r\n', b'\n')
            with open(os.path.join(committed, name), 'rb') as f:
                y = f.read().replace(b'\r\n', b'\n')
            if x != y:
                out.append(path)
    return out


def regenerate_and_compare(project_root: str, package: str, recipe: Dict, scratch_dir: str) -> List[str]:
    """Regenerate `package` from its recipe into `scratch_dir/<package>` and list what differs from
    the committed `worlds/<package>` (empty = fresh). Raises RuntimeError when the generator fails."""
    import subprocess
    output_dir = os.path.join(scratch_dir, package)
    cmd = world_generator_command(recipe['source'], output_dir, recipe['game_name'], recipe.get('canonical_seed'))
    result = subprocess.run(cmd, cwd=project_root, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f'world_generator failed for {package} (rc {result.returncode}): '
                           f'{(result.stdout + result.stderr)[-800:]}')
    return _tree_differences(output_dir, os.path.join(project_root, 'worlds', package))
