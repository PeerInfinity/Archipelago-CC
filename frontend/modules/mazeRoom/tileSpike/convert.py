"""Convert maze_tiles.py to maze_tiles.helpers.json with the real exporter analyzer (exporter/script_api.py)."""
import json
import pathlib
import sys

here = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(here.parents[3]))
from exporter.script_api import python_to_helpers  # noqa: E402

out = python_to_helpers((here / 'maze_tiles.py').read_text())
if out['errors'] or out['warnings']:
    sys.exit(f"conversion not clean: {out['errors']} {out['warnings']}")
(here / 'maze_tiles.helpers.json').write_text(json.dumps(out['helpers'], indent=2) + '\n')
print('wrote', len(out['helpers']), 'helpers')
