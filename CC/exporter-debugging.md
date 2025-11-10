# Exporter Debugging Guide: Single Game Implementation

This guide explains how to debug and fix issues in the exporter that converts Python game logic into JSON format for frontend consumption.

## Debugging Philosophy

The core principle is **data fidelity**. The exporter must accurately convert all Python game logic, rules, regions, and items into standardized JSON format without loss of information or incorrect transformations.

## The Data Flow: Understanding the Exporter's Role

```
┌──────────────────┐   1. Generates   ┌────────────────────────┐
│ Generate.py      ├───────────────►│   Spoiler Log & Rules  │
│ (Python Backend) │                  │ (..._spheres_log.jsonl)│
└──────────────────┘                  │ (..._rules.json)       │
                                      └───────────┬────────────┘
                                                  │ 2. Consumes
                                                  ▼
                            ┌────────────────────────┐
                            │  Frontend Client       │
                            │  (Validation Target)   │
                            └────────────────────────┘
```

### Stage 1: Python Source & Spoiler Log Generation

-   **Source of Truth:** The game generation process, orchestrated by `Generate.py`, is the authoritative source. When run with a spoiler level of 2 or higher, it produces a detailed log of the game's logical progression.

### Stage 2: The Exporter (Critical Component)

During the same `Generate.py` run, the custom exporter is triggered to convert Python logic into JSON:

-   **`exporter.py`**: Orchestrates the process of parsing the game's rules, regions, and items.
-   **`analyzer.py`**: Uses Python's `ast` module to convert the game's lambda-based logic into standardized JSON rule trees.
-   **Game-specific exporters** (`exporter/games/[game].py`): Handle game-specific parsing logic and edge cases.

### Stage 3: JSON Data Files

The export process creates the critical data file:

**`..._rules.json`**: A complete representation of the game's logic, including:
- All region data and connections
- Location access rules converted from Python lambdas
- Item definitions and properties  
- Game settings that affect logic

## Setting Up Exporter Testing

### Prerequisites

**⚠️ IMPORTANT:** Complete the development environment setup in `../getting-started.md`:
- Set up a Python virtual environment (`.venv`)
- Install required dependencies (`pip install -r requirements.txt`)
- Configure your local development server

### Step-by-Step Process

1. **Choose Your Game:** Select a game to test (e.g., "A Hat in Time"). Note:
   - Template file name (e.g., "A Hat in Time.yaml")
   - Python directory (e.g., "worlds/ahit")

2. **Create Game-Specific Exporter:** In `exporter/games/`, create a new file for your game if it doesn't exist (e.g., `exporter/games/ahit.py`). Base it on `exporter/games/generic.py`.

3. **Generate and Check Export:** Run Generate.py for your chosen game:
   ```bash
   # Activate your virtual environment first
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   
   # Run the generation command with output capture
   python Generate.py --weights_file_path "Templates/A Hat in Time.yaml" --multi 1 --seed 1 > generate_output.txt
   ```
   
   **Understanding Output:**
   - Using `--seed 1` produces consistent filename: `AP_14089154938208861744` (seed defaults to 1 if not specified)
   - Output directory: `frontend/presets/ahit/` (matches Python directory abbreviation)
   - Generated file: `AP_14089154938208861744_rules.json`
   
   **⚠️ CRITICAL - Check Export Output:** Examine `generate_output.txt` for error messages:
   ```bash
   # Look for exporter errors
   grep -i "error\|exception\|traceback" generate_output.txt
   
   # Look for export warnings
   grep -i "warning\|failed to parse" generate_output.txt
   ```

4. **Validate Generated JSON:** Check that the exported JSON file is complete and well-formed:
   ```bash
   # Check file exists and has reasonable size
   ls -la frontend/presets/ahit/AP_14089154938208861744/
   
   # Validate JSON syntax
   python -m json.tool frontend/presets/ahit/AP_14089154938208861744/AP_14089154938208861744_rules.json > /dev/null
   ```

## Common Exporter Issues and Solutions

### 🚨 Data Issues: Missing or Corrupt JSON Data

**⚠️ CRITICAL:** If you notice missing or corrupt data in the generated JSON files, your **first and only priority** is to fix the exporter. **Never work around data issues elsewhere.**

**Systematic Debugging Approach:**

1. **Stop all other work immediately**
2. **Identify the problematic data** by examining the JSON output
3. **Trace back to Python source** - find where this data originates in `worlds/[game]/`
4. **Fix the exporter** (`exporter/games/[game].py`) to correctly parse and export the data
5. **Regenerate and verify:**
   ```bash
   python Generate.py --weights_file_path "Templates/[Game].yaml" --multi 1 --seed 1
   # Check the new JSON file for correct data
   ```

**Why this matters:** The JSON files are consumed by the frontend as the source of truth. Working around bad data anywhere else creates fragile systems that break with different seeds or configurations.

### Issue: Lambda Function Parsing Failures

**Symptoms in `generate_output.txt`:**
```
Failed to parse rule for location 'Secret Island Peak': unsupported AST node type
Warning: Complex lambda expression could not be converted
```

**Root Cause:** The `analyzer.py` AST parser doesn't handle certain Python constructs.

**Solution:** Enhance the AST parser or create game-specific parsing logic:

```python
# In exporter/games/[game].py
def parse_custom_rule(self, location_name, rule_lambda):
    """Handle game-specific rule parsing that AST can't handle"""
    if location_name == "Secret Island Peak":
        # Extract rule manually if AST parsing fails
        return {
            "type": "item_check",
            "item": "Golden Feather", 
            "count": {"type": "constant", "value": 5}
        }
    return None  # Fall back to generic parsing
```

### Issue: Variable Resolution in Lambda Defaults

**Symptoms:** Rules with dynamic counts aren't exported correctly.

**Python Source Example:**
```python
min_feathers = 5
add_rule(multiworld.get_location("Flying Challenge", player),
    lambda state, min_feathers=min_feathers: state.has("Golden Feather", player, min_feathers))
```

**Problem:** The exporter doesn't resolve the `min_feathers` variable from lambda defaults.

**Solution:** Implement variable resolution in the analyzer:

```python
# In analyzer.py
def resolve_lambda_defaults(self, func):
    """Resolve variables from lambda default parameters"""
    if hasattr(func, '__defaults__') and func.__defaults__:
        # Access the actual values from defaults
        defaults = func.__defaults__
        # Map to parameter names and resolve values
        return self.extract_default_values(defaults)
```

### Issue: Missing Helper Function Exports

**Symptoms:** Rules reference functions that aren't defined in the exported JSON.

**Python Source Example:**
```python
def can_fly(state, player):
    return state.has("Flying Ability", player) or state.has("Temporary Wings", player)

add_rule(multiworld.get_location("Sky Palace", player),
    lambda state: can_fly(state, player))
```

**Problem:** The `can_fly` helper function isn't being exported.

**Solution:** Add helper function detection and export:

```python
# In exporter/games/[game].py
def export_helper_functions(self, world_module):
    """Export helper functions used in rules"""
    helpers = {}
    
    # Find all helper functions in the module
    for name, obj in inspect.getmembers(world_module):
        if inspect.isfunction(obj) and self.is_rule_helper(obj):
            helpers[name] = self.convert_helper_to_rule(obj)
    
    return helpers

def convert_helper_to_rule(self, func):
    """Convert a helper function to a rule tree"""
    # Parse the function body and convert to JSON rule format
    pass
```

### Issue: Complex Item Requirements Not Exported

**Symptoms:** Multi-item or conditional requirements are missing or simplified.

**Python Source Example:**
```python
add_rule(multiworld.get_location("Boss Fight", player),
    lambda state: (state.has("Sword", player) and state.has("Shield", player)) 
                  or state.has("Magic Staff", player))
```

**Problem:** Complex boolean logic isn't being converted correctly.

**Solution:** Enhance the AST parser for complex expressions:

```python
# In analyzer.py
def visit_BoolOp(self, node):
    """Handle AND/OR boolean operations"""
    if isinstance(node.op, ast.And):
        return {
            "type": "and",
            "rules": [self.visit(child) for child in node.values]
        }
    elif isinstance(node.op, ast.Or):
        return {
            "type": "or", 
            "rules": [self.visit(child) for child in node.values]
        }
```

## Debugging Workflow for Exporters

### 1. Identify Export Failures

**Check generation output first:**
```bash
# Look for export-specific errors
grep -A 5 -B 5 "exporter\|export\|Failed to parse" generate_output.txt
```

**Common error patterns:**
- `Failed to parse rule for location 'X'`
- `Unknown AST node type: Y` 
- `Helper function 'Z' not found`
- `Variable 'W' could not be resolved`

### 2. Trace to Python Source

**Find the problematic rule:**
```bash
# Search for the location in Python files
grep -r "Secret Island Peak" worlds/ahit/
```

**Examine the rule context:**
```python
# Look at the actual Python rule
add_rule(multiworld.get_location("Problematic Location", player),
    lambda state: complex_logic_here)
```

### 3. Test Exporter Changes Incrementally

**Make one fix at a time:**
```bash
# Make changes to exporter/games/[game].py
# Regenerate to test the fix
python Generate.py --weights_file_path "Templates/[Game].yaml" --multi 1 --seed 1 > generate_output.txt

# Check if the specific issue is resolved
grep "Problematic Location" generate_output.txt
```

### 4. Validate JSON Structure

**Check exported rule structure:**
```bash
# Extract and examine the specific rule in JSON
python -c "
import json
with open('frontend/presets/ahit/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)
    # Find and print the problematic location's rule
    for location in data['locations']:
        if location['name'] == 'Secret Island Peak':
            print(json.dumps(location['rule'], indent=2))
"
```

## Recognizing Exporter Issue Patterns

**🔧 Generic Exporter Issues (Fix in Core analyzer.py)**
- AST parsing failures for common Python constructs
- Variable resolution problems
- Lambda default parameter handling
- Basic boolean logic conversion

**🎮 Game-Specific Issues (Fix in exporter/games/[game].py)**
- Custom helper functions unique to the game
- Game-specific item interaction patterns
- Special location access logic
- Custom data structures or enums

## Exporter Anti-Patterns to Avoid

**❌ Location-Specific Hardcoding**
```python
# Don't do this in the exporter
if location_name == "Secret Island Peak":
    return {"type": "item_check", "item": "Golden Feather", "count": 5}
```

**✅ Pattern-Based Parsing**
```python
# Do this instead - handle the pattern generically
def parse_item_count_requirement(self, lambda_func):
    # Parse any lambda that checks item counts
    # Extract the pattern: state.has(item, player, count)
    return self.extract_item_check_pattern(lambda_func)
```

**❌ Ignoring Export Failures**
```python
# Don't do this
try:
    rule = self.parse_lambda(location_rule)
except Exception:
    return None  # Silently ignore failures
```

**✅ Explicit Error Handling**
```python
# Do this instead
try:
    rule = self.parse_lambda(location_rule)
except Exception as e:
    self.log_parse_failure(location_name, str(e))
    return self.create_fallback_rule(location_name, location_rule)
```

This systematic approach ensures the exporter accurately converts all Python game logic into JSON format, providing a solid foundation for frontend validation.