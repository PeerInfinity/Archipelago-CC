# Quick Reference

## Prerequisites
```
source .venv/bin/activate
```

## Common Commands
| Task | Command |
|------|---------|
| Generate + export | `python Generate.py --weights_file_path "Templates/[GameName].yaml" --multi 1 --seed 1` |
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

## Generation and Export

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
| World/game/yaml mapping | `scripts/data/world-mapping.json` |
| Preset files index | `frontend/presets/preset_files.json` |
| Rules schema | `frontend/schema/rules.schema.json` |
| Seed ID calculator | `scripts/lib/seed_utils.py` |
| Frontend logging | `frontend/settings.json` |
| Claude instructions | `CC/` |
| Fork documentation | `docs/json/` |
| Repository diffs | `docs/json/developer/diffs/repository-changes.md` |
| Cloud setup | `CC/cloud-setup.md` |

## Notes
- For frontend debugging, `console.log` is easier than configuring the logging system
- If the environment isn't set up, read `CC/cloud-setup.md` first
