# Quick Reference

## Prerequisites
```
source .venv/bin/activate
```

## Common Commands
| Task | Command |
|------|---------|
| Seed generation | `python Generate.py --weights_file_path "Templates/[GameName].yaml" --multi 1 --seed 1` |
| World generation | `python -m world_generator path/to/rules.json` |
| Test single game | `python scripts/test/test-all-templates.py --include-list "[GameName].yaml"` |
| Spoiler test only | `npm test -- --mode=test-spoilers --game=[gamename] --seed=1` |
| Regression test | `npm test --mode=test-regression` |
| Start dev server | `python -m http.server 8000` |
| Stop dev server | `pkill -f "http.server"` |

## Important Gotchas
- **Path in Generate.py**: Use `"Templates/[GameName].yaml"` NOT `"Players/Templates/[GameName].yaml"` - the latter will fail
- **Name formats differ**: Template files use title case with spaces (`A Link to the Past.yaml`), but preset directories use lowercase identifiers (`alttp`)
- **Don't modify**: Original Archipelago code files or original world files in `worlds/`
- **Seed 1 always produces**: `AP_14089154938208861744`

---

# Detailed Reference

## Key Concepts: World Generation vs Seed Generation

| Concept | Purpose | Tool | Creates |
|---------|---------|------|---------|
| **World Generation** | Create Python world package from JSON rules | `world_generator/` | `worlds/{gamename}/` directory |
| **Seed Generation** | Run the randomizer to create a playable game | `Generate.py` | `.archipelago`, `_rules.json`, `_Spoiler.txt` |

**World Generation** converts a JSON rules file into a complete Archipelago world package (Python code). This is the *infrastructure* that defines how a game works with Archipelago.

**Seed Generation** uses an existing world to create a randomized playable game instance for a specific seed number.

## World Generation

Creates a Python world package from JSON rules. Used to bootstrap new worlds or recreate worlds from exported rules.

**Command:**
```
python -m world_generator frontend/presets/[gamename]/AP_[SEED_ID]/AP_[SEED_ID]_rules.json
```

**Common options:**
```
python -m world_generator rules.json --dry-run                    # preview without writing
python -m world_generator rules.json --game-name "New Name"       # rename to avoid conflicts
python -m world_generator rules.json -o worlds/custom/ --force    # specify output, overwrite
python -m world_generator rules.json --canonical-seed1            # enable seed=1 canonical placement
```

**Input:**
- JSON rules file (exported from an existing world via seed generation)

**Output (in `worlds/{game_directory}/`):**
- `__init__.py` - Main world class (uses `RuleWorldMixin`)
- `Items.py` - Item definitions and classifications
- `Locations.py` - Location definitions with region assignments
- `Regions.py` - Region structure and entrance connections
- `Rules.py` - Access rules using Rule Builder syntax
- `Options.py` - Game options
- `_worldgen_settings.json` - Generation metadata

**WorldGen worlds** use the `_worldgen` suffix (e.g., `alttp_worldgen/`) and inherit from `RuleWorldMixin` for Rule Builder support.

**After generating**, create a template YAML:
```
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
```

## Seed Generation and Export

**Command:**
```
python Generate.py --weights_file_path "Templates/[GameName].yaml" --multi 1 --seed 1
```

**Input:**
- Template file: `Players/Templates/[GameName].yaml`
- World directory: `worlds/[gamename]/`

**Output:**
- `frontend/presets/[gamename]/AP_[SEED_ID]/AP_[SEED_ID]_rules.json`
- `frontend/presets/[gamename]/AP_[SEED_ID]/AP_[SEED_ID]_sphere_log.jsonl`

## Testing

### Main Test Script
`scripts/test/test-all-templates.py` - run with `--help` for all options.

**Common variations:**
```
python scripts/test/test-all-templates.py --include-list "[GameName].yaml" -p          # run post-processing
python scripts/test/test-all-templates.py --include-list "[GameName].yaml" --minimal-spoilers
python scripts/test/test-all-templates.py --include-list "[GameName].yaml" --full-spoilers
python scripts/test/test-all-templates.py --include-list "[GameName].yaml" --multiclient
python scripts/test/test-all-templates.py --seed-range 1-10 -p                          # test multiple seeds
python scripts/test/test-all-templates.py --retest --retest-continue 10 -p              # retest failures
python scripts/test/test-all-templates.py --include-list "Game1.yaml" "Game2.yaml" -p   # test multiple games
```

### Spoiler Test
**Command:** `npm test -- --mode=test-spoilers --game=[gamename] --seed=1`

**Input:**
- `frontend/presets/[gamename]/AP_[SEED_ID]/AP_[SEED_ID]_rules.json`
- `frontend/presets/[gamename]/AP_[SEED_ID]/AP_[SEED_ID]_sphere_log.jsonl`

**Output:**
- `playwright-report.json` (project root)
- `test-results/in-app-tests/test-results-[TIMESTAMP].json`

### Configure Spoiler Settings
```
python scripts/setup/update_host_settings.py minimal-spoilers
python scripts/setup/update_host_settings.py full-spoilers
```

## Key Files and Directories

| Purpose | Path |
|---------|------|
| World generator module | `world_generator/` |
| World packages | `worlds/` (original), `worlds/*_worldgen/` (generated) |
| World/game/yaml mapping | `scripts/data/world-mapping.json` |
| Preset files index | `frontend/presets/preset_files.json` |
| Rules schema | `frontend/schema/rules.schema.json` |
| Rule Builder module | `rule_builder/` |
| Seed ID calculator | `scripts/lib/seed_utils.py` |
| Frontend logging | `frontend/settings.json` |
| Claude instructions | `CC/` |
| Fork documentation | `docs/json/` |
| World generator guide | `docs/json/developer/guides/world-generator.md` |
| Repository diffs | `docs/json/developer/diffs/repository-changes.md` |
| Cloud setup | `CC/cloud-setup.md` |

## Notes
- For frontend debugging, `console.log` is easier than configuring the logging system
- If the environment isn't set up, read `CC/cloud-setup.md` first
