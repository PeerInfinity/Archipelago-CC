# Multiworld Test Debugging Guide (Cloud Interface)

This guide explains how to run and debug multiworld tests in the Claude Code cloud interface. Multiworld tests validate that multiple games can run together in the same Archipelago session, with items being sent between players.

## Cloud Environment Context

When working in the cloud interface:

- **Isolated Environment**: Each instance runs in its own isolated container
- **Independent Branches**: Your work is on a dedicated branch
- **Fresh Setup**: Requires initial setup before testing

## Prerequisites

**CRITICAL: Complete Setup First**

Before following this guide, you **must** complete the cloud environment setup described in `CC/cloud-setup.md`. This includes:

1. Creating Python virtual environment (`.venv`)
2. Installing Python requirements and game-specific dependencies
3. Generating template YAML files (`Players/Templates/`)
4. Configuring `host.yaml` for testing
5. Installing Node.js dependencies and Playwright browsers

**Setup verification:**
```bash
# Quick check - all should return OK
source .venv/bin/activate
python -c "import websockets; print('Python: OK')"
test -d Players/Templates && echo "Templates: OK"
test -f host.yaml && echo "host.yaml: OK"
test -d node_modules && echo "Node.js: OK"
```

If any checks fail, return to `CC/cloud-setup.md` and complete the setup.

## Testing Philosophy

Multiworld tests validate **cross-game compatibility**:
1. Multiple games can generate together without conflicts
2. Each player's game logic works correctly when items flow between games
3. The sphere progression is correct for each player in the multiworld

## How Multiworld Testing Works

```
┌──────────────────────────────────────────────────────────────┐
│  Players/presets/Multiworld/                                  │
│  ├── Game1.yaml  (Player 1)                                   │
│  ├── Game2.yaml  (Player 2)                                   │
│  └── Game3.yaml  (Player 3)                                   │
└──────────────────────────────────────────────────────────────┘
                              │
                    1. Generate.py
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  frontend/presets/multiworld/AP_SEED_ID/                      │
│  ├── AP_SEED_ID_rules.json         (combined rules)           │
│  ├── AP_SEED_ID_sphere_log.jsonl   (combined sphere log)      │
│  └── AP_SEED_ID.archipelago        (multiworld file)          │
└──────────────────────────────────────────────────────────────┘
                              │
                    2. Spoiler Test (per player)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Test Results                                                 │
│  - Player 1: Pass/Fail (sphere X/Y)                          │
│  - Player 2: Pass/Fail (sphere X/Y)                          │
│  - Player 3: Pass/Fail (sphere X/Y)                          │
└──────────────────────────────────────────────────────────────┘
```

The test:
1. Copies templates to `Players/presets/Multiworld/` (one per player)
2. Runs `Generate.py` with `--player_files_path Players/presets/Multiworld`
3. Tests each player's game logic with the combined rules file
4. Verifies all players' sphere progressions are correct

## Running Multiworld Tests

### Basic Multiworld Test

```bash
# Activate virtual environment first
source .venv/bin/activate

# Run multiworld test for all templates (adds one template at a time)
python scripts/test/test-all-templates.py --multiworld

# Test with bisection enabled (finds specific failing pairs)
python scripts/test/test-all-templates.py --multiworld --multiworld-bisect-failures
```

### Testing Specific Templates

```bash
# Test only specific templates
python scripts/test/test-all-templates.py --multiworld --include-list "Game1.yaml" "Game2.yaml"

# Keep existing templates and add more
python scripts/test/test-all-templates.py --multiworld --multiworld-keep-templates --include-list "NewGame.yaml"
```

### Command-Line Options

| Option | Description |
|--------|-------------|
| `--multiworld` | Enable multiworld testing mode |
| `--multiworld-keep-templates` | Keep existing templates in Multiworld directory |
| `--multiworld-skip-prerequisites` | Skip prerequisite checks (test all templates) |
| `--multiworld-test-all-players` | Test all players each time (not just newly added) |
| `--multiworld-max-templates` | Max templates to keep (default: 10, oldest removed) |
| `--multiworld-bisect-failures` | When a test fails, run bisection to find specific failing pairs |

## Understanding Test Results

### Result Files

Multiworld test results are saved to `scripts/output/multiworld/test-results.json`:

```json
{
  "metadata": {
    "created": "2025-12-03T01:16:01.210206",
    "last_updated": "2025-12-03T17:42:54.909743"
  },
  "results": {
    "GameA.yaml": {
      "multiworld_test": {
        "success": true,
        "player_number": 5,
        "player_results": {
          "player_5": {
            "passed": true,
            "sphere_reached": 12.5,
            "total_spheres": 12.5
          }
        },
        "templates_in_multiworld": {
          "player_1": "Game1.yaml",
          "player_2": "Game2.yaml",
          "player_5": "GameA.yaml"
        }
      },
      "prerequisite_check": {
        "all_prerequisites_passed": true,
        "spoiler_full_passed": true,
        "spoiler_minimal_passed": true,
        "multiclient_passed": true
      }
    }
  }
}
```

### Key Fields

- `multiworld_test.success`: Overall test passed
- `multiworld_test.player_number`: Which player number this template was tested as
- `multiworld_test.player_results`: Results for each player tested
- `multiworld_test.templates_in_multiworld`: Map of player numbers to template files
- `prerequisite_check`: Whether single-game tests passed first

## Bisection Testing

When a multiworld test fails, bisection helps identify which specific template pair causes the failure.

### How Bisection Works

1. Template X fails when added to a multiworld with templates A, B, C
2. Bisection tests: X+A, X+B, X+C (2-template tests)
3. Results show which specific pair(s) cause the failure

### Bisection Results Structure

```json
{
  "bisection_results": {
    "triggered": true,
    "tested_pairs": [
      {
        "partner_template": "GameA.yaml",
        "success": true,
        "player_1_template": "FailingGame.yaml",
        "player_2_template": "GameA.yaml",
        "generation": { "success": true },
        "player_results": {
          "player_1": { "passed": true, "sphere_reached": 5 },
          "player_2": { "passed": true, "sphere_reached": 8 }
        }
      },
      {
        "partner_template": "GameB.yaml",
        "success": false,
        "player_1_template": "FailingGame.yaml",
        "player_2_template": "GameB.yaml",
        "generation": { "success": true },
        "player_results": {
          "player_1": { "passed": false, "sphere_reached": 3, "total_spheres": 5 },
          "player_2": { "passed": true, "sphere_reached": 8 }
        }
      }
    ],
    "failing_pairs": ["GameB.yaml"]
  }
}
```

### Interpreting Bisection Results

- **`failing_pairs`**: List of templates that cause failures when paired with the failing template
- **`tested_pairs[].success`**: Whether the 2-template test passed
- **`tested_pairs[].player_results`**: Which specific player failed and at what sphere

## Common Failure Patterns

### Pattern 1: Prerequisites Not Met

**Symptom:**
```
prerequisite_check.all_prerequisites_passed: false
```

**Root Cause:** The template's single-game tests haven't passed yet.

**Solution:** First run and fix the spoiler test for this game:
```bash
python scripts/test/test-all-templates.py --include-list "YourGame.yaml"
```

### Pattern 2: Generation Failure

**Symptom:**
```
generation.success: false
generation.error_type: "world_error"
```

**Root Cause:** Games have conflicting options or incompatible settings.

**Debugging Steps:**
1. Check `generation.first_error_line` for specific error
2. Try generating manually to see full error:
   ```bash
   python Generate.py --player_files_path Players/presets/Multiworld --seed 1
   ```

### Pattern 3: Specific Player Failure

**Symptom:**
```
player_results.player_3.passed: false
player_results.player_3.sphere_reached: 5.2
player_results.player_3.total_spheres: 12.7
```

**Root Cause:** Player 3's game logic fails when items come from other games.

**Debugging Steps:**
1. Identify which template is Player 3 from `templates_in_multiworld`
2. Run bisection to find specific failing pair
3. Debug the 2-game combination

### Pattern 4: Bisection Shows Multiple Failing Pairs

**Symptom:**
```
failing_pairs: ["GameA.yaml", "GameB.yaml", "GameC.yaml"]
```

**Root Cause:** The failing template has a fundamental issue that affects multiple combinations.

**Solution:** Focus on fixing the failing template's core logic first:
```bash
# Debug the game alone first
python scripts/test/test-all-templates.py --include-list "FailingGame.yaml"
```

### Pattern 5: Bisection Shows Single Failing Pair

**Symptom:**
```
failing_pairs: ["SpecificGame.yaml"]
```

**Root Cause:** There's a specific interaction issue between these two games.

**Debugging Steps:**
1. Set up just these two templates:
   ```bash
   # Clear multiworld directory
   rm Players/presets/Multiworld/*.yaml

   # Copy just the failing pair
   cp "Players/Templates/FailingGame.yaml" Players/presets/Multiworld/
   cp "Players/Templates/SpecificGame.yaml" Players/presets/Multiworld/
   ```
2. Generate and inspect the combined rules:
   ```bash
   python Generate.py --player_files_path Players/presets/Multiworld --seed 1
   ```
3. Run spoiler test for each player to identify which one fails

## Debugging Workflow

### Step 1: Verify Prerequisites Pass

```bash
# Run single-game tests first
python scripts/test/test-all-templates.py --include-list "YourGame.yaml"
python scripts/test/test-all-templates.py --include-list "YourGame.yaml" --multiclient --single-client
```

### Step 2: Run Multiworld Test with Bisection

```bash
python scripts/test/test-all-templates.py --multiworld --multiworld-bisect-failures --include-list "YourGame.yaml"
```

### Step 3: Analyze Bisection Results

```bash
# View bisection results
cat scripts/output/multiworld/test-results.json | jq '.results["YourGame.yaml"].bisection_results'

# See which pairs failed
cat scripts/output/multiworld/test-results.json | jq '.results["YourGame.yaml"].bisection_results.failing_pairs'
```

### Step 4: Debug Specific Failing Pair

Once you identify a failing pair (e.g., YourGame.yaml + OtherGame.yaml):

```bash
# Set up the minimal reproduction
rm Players/presets/Multiworld/*.yaml
cp "Players/Templates/YourGame.yaml" Players/presets/Multiworld/
cp "Players/Templates/OtherGame.yaml" Players/presets/Multiworld/

# Generate and check for errors
python Generate.py --player_files_path Players/presets/Multiworld --seed 1

# Run spoiler test for each player
npm test --mode=test-spoilers --game=multiworld --seed=1 --player=1
npm run test:analyze
cat playwright-analysis.txt

npm test --mode=test-spoilers --game=multiworld --seed=1 --player=2
npm run test:analyze
cat playwright-analysis.txt
```

### Step 5: Inspect Combined Rules

```bash
# Find the generated files
ls frontend/presets/multiworld/AP_*/

# Inspect the combined rules file
cat frontend/presets/multiworld/AP_*/AP_*_rules.json | jq '.players'
```

## Generating Debugging Prompts

Use the prompt script to generate debugging prompts for failing multiworld tests:

```bash
# Generate prompts for all failing multiworld tests
python CC/scripts/prompt-all-templates.py --multiworld --promptfile

# The prompts will be written to CC/scripts/prompts.txt
```

## Key Files

| File | Purpose |
|------|---------|
| `scripts/test/test-all-templates.py` | Main test runner with multiworld support |
| `scripts/lib/test_runner.py` | Core test logic including bisection |
| `scripts/output/multiworld/test-results.json` | Multiworld test results |
| `Players/presets/Multiworld/` | Directory containing templates for multiworld test |
| `frontend/presets/multiworld/` | Generated multiworld data files |

## Cloud-Specific Considerations

### Working Directory

Always run from project root:
```bash
pwd  # Should show: /home/user/Archipelago-CC
```

### Virtual Environment

**Always activate before testing:**
```bash
source .venv/bin/activate
```

### Branch Management

Your work is on a dedicated branch:
- Work is automatically committed and pushed
- Focus on fixing issues and getting tests to pass

## Summary

The multiworld debugging workflow:
1. Verify prerequisites pass (single-game tests)
2. Run multiworld test with bisection enabled
3. Analyze bisection results to find specific failing pairs
4. Debug the minimal failing pair (2-game combination)
5. Fix the root cause (exporter, helper, or rule engine)
6. Re-run tests to verify the fix
7. Push changes (handled automatically)

Focus on identifying specific failing pairs through bisection, then debug those specific combinations rather than the full multiworld.
