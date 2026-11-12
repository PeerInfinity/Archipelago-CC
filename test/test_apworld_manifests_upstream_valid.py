"""Every .apworld we ship, and every one our packer makes, passes upstream's own manifest check.

Upstream's loader (``worlds/__init__.py``, identical at 0.6.8 and 0.6.9) calls
``APWorldContainer.read()`` on each packed apworld; a manifest without ``compatible_version`` (or
with one above the reader's ``container_version``) raises ``InvalidDataError``, which 0.6.x logs as
"Invalid or missing manifest file for X.apworld. This apworld will stop working with Archipelago
0.7.0." and 0.7.0 re-raises. So this calls that same check, not a copy of the rule.

The rule is about PACKED apworlds only. A world FOLDER's ``archipelago.json`` must not carry
``version``/``compatible_version`` (upstream's ``test/general/test_world_manifest.py``, and the
apworld spec: "Do not write these fields yourself"); the packer stamps them
(``world_generator/apworld.py``). That is why the generated packages' source manifests have no
``compatible_version`` and why the fix for an unstamped archive is to pack it with our packer, not to
add the key to the generator's template.

Three sweeps:
- every git-tracked ``*.apworld`` (not only ``apworlds/``, which ``json_tools_installer``'s own sweep
  covers: it once missed a snapshot under ``scripts/vanilla-alttp/``, removed 2026-11-11, and any
  other tracked apworld outside ``apworlds/`` would be missed the same way);
- every committed generated package (``worldgen-package-recipes.json``) packed by
  ``pack_world_dir``, the function behind ``scripts/build/pack_apworld.py``;
- the same packages built straight from their rules file by ``build_apworld`` (the
  ``--apworld`` CLI and the browser's Pyodide build).
"""
import json
import subprocess
from io import BytesIO
from pathlib import Path

import pytest

from world_generator.apworld import build_apworld, pack_world_dir
from worlds.Files import APWorldContainer

REPO = Path(__file__).resolve().parents[1]
RECIPES = json.loads((REPO / 'scripts' / 'data' / 'worldgen-package-recipes.json').read_text())['packages']


def _tracked_apworlds():
    try:
        out = subprocess.run(['git', 'ls-files', '-z', '*.apworld'], cwd=REPO, check=True,
                             capture_output=True).stdout.decode()
        paths = [REPO / p for p in out.split('\0') if p]
    except (OSError, subprocess.CalledProcessError):
        paths = sorted(REPO.rglob('*.apworld'))
    return sorted(p for p in paths if p.is_file())


def _read_upstream(source) -> APWorldContainer:
    container = APWorldContainer()
    container.read(source)  # raises InvalidDataError exactly where upstream's loader would log
    return container


def test_sweeps_are_not_vacuous():
    tracked = _tracked_apworlds()
    assert any(p.parent.name == 'apworlds' for p in tracked), tracked
    assert len(RECIPES) >= 17, len(RECIPES)


@pytest.mark.parametrize('path', _tracked_apworlds(), ids=lambda p: str(p.relative_to(REPO)))
def test_tracked_apworld_passes_upstreams_manifest_check(path):
    container = _read_upstream(str(path))
    assert container.game, f'{path.name}: manifest names no game'


@pytest.mark.parametrize('directory', sorted(RECIPES))
def test_packed_generated_package_passes_upstreams_manifest_check(directory):
    world_dir = REPO / 'worlds' / directory
    source = json.loads((world_dir / 'archipelago.json').read_text())
    assert 'compatible_version' not in source and 'version' not in source, (
        'a folder manifest must not carry the container keys; the packer stamps them')
    buf = BytesIO()
    pack_world_dir(world_dir, buf)
    buf.seek(0)
    container = _read_upstream(buf)
    assert container.game == RECIPES[directory]['game_name'] == source['game']


@pytest.mark.parametrize('directory', sorted(RECIPES))
def test_built_generated_package_passes_upstreams_manifest_check(directory):
    recipe = RECIPES[directory]
    built = build_apworld(REPO / recipe['source'], game_name=recipe.get('game_name'),
                          canonical_seed=recipe.get('canonical_seed'),
                          victory_location=recipe.get('victory_location', False))
    container = _read_upstream(BytesIO(built['data']))
    assert container.game == recipe['game_name']
