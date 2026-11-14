# rules-l71-l63-oddities — evidence

Base: `origin/main` 39e8a29f7f. The report is `cloud-report-rules-l71-l63-oddities.md` at the repo root.

| file | what |
|---|---|
| `tools/ruling.mjs` | `killLockRoomRuling` for L71 / L99 (any levels as args): every body, the tile it stands on, every `why`, the tile census, the tile-6 cells → `ruling-l71-l99.txt` |
| `tools/grid.mjs` | ASCII tile-type grid (base-36 glyph = tile type: F=15 Dark Stone, G=16 Igneous, H=17 Lava, Q=26 Body Floor, R=27 Body Wall, S=28 Ghost Tile, 6=Pit) + the entity list → `grid-l*.txt` |
| `tools/dump_regions.py` | a level's committed AP_1 regions / exits / locations with rules → `rules-l*-*.txt` |
| `tools/l63live.mjs` | the L63 witness: CLOSED LOOP ON THE GAME (wasm `seedling_bot_ap_p4g`, headless logic-only, box lock), chained continuation windows (same boot), booted at L63 (9,6) granted only the Spear, `noDamage` true; arm A no persistence, arm B `{63,1}` staged → `witness/l63live-run.txt`, `witness/<arm>.live.json` (per-window samples), `witness/<arm>.tape.json` (the inputs as played, one tape) |
| `certify-vanilla-new.txt` | `probe-seedling-whole-game-certify.mjs --shards=2 --arms=new` (local node, vanilla): 1 / 16 / 0, the L63 row |

Run: `node tools/ruling.mjs 71 99`; `node tools/grid.mjs 63`; `python3 tools/dump_regions.py frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json level_63`;
`node tools/l63live.mjs` (needs the dev server on 8000 and the wasm submodule).
⚠ The model (`createRunForStaging`) does not move a `PushableBlockSpear`, which is why the L63 tape is driven on the game, not authored on the model.
