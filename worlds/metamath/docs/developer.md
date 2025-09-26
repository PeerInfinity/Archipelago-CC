# Metamath Developer Documentation

## Architecture Overview

The Metamath world transforms mathematical proofs from the Metamath database into Archipelago gameplay by converting logical dependencies into item/location relationships.

## Core Components

### 1. Proof Parsing (`Rules.py`)

The heart of the system. Uses `metamath-py` to verify proofs and extract dependency graphs.

```python
# Key function: extract_proof_dependencies
def extract_proof_dependencies(db, theorem_name: str) -> Tuple[List[str], Dict[str, Set[str]]]:
    """Extract proof steps and dependencies using metamath-py's proof verification."""
    if theorem_name not in db.rules:
        print(f"Warning: Theorem {theorem_name} not found in database")
        return [], {}

    rule = db.rules[theorem_name]

    try:
        # Verify the proof and get the proof tree
        root_step, proof_steps_dict = verify_proof(db, rule)

        # Extract all unique steps from the proof tree
        all_steps = root_step.all_steps()

        # Build dependency graph
        dependencies = {}
        ordered_steps = []
        seen = set()

        for step in all_steps:
            if step.rule and hasattr(step.rule, 'consequent'):
                label = step.rule.consequent.label

                # Skip constants, hypotheses, and duplicate entries
                if (not label.startswith('c') and
                    not label.startswith('w') and
                    label not in seen):

                    seen.add(label)
                    ordered_steps.append(label)

                    # Extract dependencies for this step
                    deps = set()
                    for dep_label, dep_step in step.dependencies.items():
                        if hasattr(dep_step.rule, 'consequent'):
                            dep_name = dep_step.rule.consequent.label
                            # Only include non-constant, non-hypothesis dependencies
                            if not dep_name.startswith('c') and not dep_name.startswith('w'):
                                deps.add(dep_name)

                    dependencies[label] = deps

        return ordered_steps, dependencies

    except Exception as e:
        print(f"Error verifying proof for {theorem_name}: {e}")
        return [], {}
```

**Dependency Extraction Process**:
1. Load theorem from metamath database
2. Verify proof using `metamath-py.proof.verify_proof()`
3. Walk proof tree to extract all steps
4. Filter out constants (prefixed with 'c') and wff variables (prefixed with 'w')
5. Map dependencies between steps
6. Apply topological sort for logical ordering (dependencies before dependents)
7. Convert to indexed ProofStructure

### 2. Topological Sorting

The system uses topological sorting to reorder proof steps for more logical presentation. For a detailed explanation of different proof ordering schemes and why we chose topological sort, see [Proof Ordering Documentation](proof_ordering.md).

```python
def topological_sort_proof(ordered_steps: List[str], dependencies: Dict[str, Set[str]]) -> List[str]:
    """Reorder proof steps so dependencies come before dependents."""
    # Create adjacency list and in-degree count
    graph = defaultdict(list)
    in_degree = defaultdict(int)

    # Build graph (dependency -> dependent)
    for step, deps in dependencies.items():
        for dep in deps:
            graph[dep].append(step)
            in_degree[step] += 1

    # Find all nodes with no incoming edges (no dependencies)
    queue = deque([step for step in ordered_steps if in_degree[step] == 0])
    result = []

    while queue:
        # Sort queue to ensure consistent ordering
        current = sorted(queue)[0]
        queue.remove(current)
        result.append(current)

        # Remove edges from this node
        for neighbor in sorted(graph[current]):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return result if len(result) == len(ordered_steps) else ordered_steps
```

This ensures that foundational axioms and definitions appear before the theorems that depend on them, making the proof structure more intuitive.

### 3. World Generation (`__init__.py`)

Main world class that orchestrates generation:

```python
class MetamathWorld(World):
    def generate_early(self):
        # Parse theorem from config
        # Extract proof structure
        # Determine starting statements

    def create_regions(self):
        # Create locations for each proof step
        # Skip pre-given starting statements

    def create_items(self):
        # Create items for non-starting statements
        # Add filler items to match number of locations
```

**Key Methods**:
- `generate_early()`: Parse theorem and build proof structure, handle seed=1 special case
- `create_regions()`: Create proof locations with complex connection logic
- `create_items()`: Generate statement items (only if randomization enabled)
- `pre_fill()`: Place items in original locations if randomization disabled
- `_place_original_items()`: Helper to place each statement at its corresponding location
- `set_rules()`: Apply logical dependencies as access rules and store dependency mappings
- `fill_slot_data()`: Export proof structure data for the world

### 4. Region Connections

The world creates a complex network of regions based on proof dependencies:

```python
def create_regions(self):
    """Create one region per statement with connections based on proof dependencies."""
    menu_region = Region("Menu", self.player, self.multiworld)

    # Create a region for each statement
    statement_regions = {}

    for i in range(1, self.num_statements + 1):
        region_name = f"Prove Statement {i}"
        region = Region(region_name, self.player, self.multiworld)
        statement_regions[i] = region

        # Create location in this region (if not a starting statement)
        if i not in self.starting_statements:
            location = MetamathLocation(...)
            region.locations.append(location)

    # Connect Menu to statement regions that have NO dependencies (axioms/base statements)
    for i in sorted(statement_regions.keys()):
        dependencies = self.proof_structure.dependency_graph.get(i, [])
        if not dependencies:
            menu_region.connect(region, f"To Statement {i}")

    # Connect regions based on dependency graph
    # Create exits from each statement to statements that depend on it
    for i in sorted(self.proof_structure.reverse_dependencies.keys()):
        dependents = self.proof_structure.reverse_dependencies[i]
        if i in statement_regions:
            source_region = statement_regions[i]
            for dependent in sorted(dependents):
                if dependent in statement_regions:
                    target_region = statement_regions[dependent]
                    source_region.connect(target_region,
                        f"From Statement {i} to Statement {dependent}")
```

This creates a directed graph where:
- The Menu connects to all axioms (statements with no dependencies)
- Each statement region connects to regions of statements that depend on it
- The connections form the logical flow of the proof

### 5. Data Structures

#### ProofStatement
```python
class ProofStatement:
    index: int              # 1-based position in proof
    label: Optional[str]    # Theorem/axiom name (e.g., "df-2")
    expression: str         # Mathematical expression
    dependencies: List[int] # Indices of required statements
    full_text: Optional[str]  # Full text description (if available)
```

#### ProofStructure
```python
class ProofStructure:
    statements: Dict[int, ProofStatement]
    dependency_graph: Dict[int, Set[int]]
    reverse_dependencies: Dict[int, Set[int]]
    label_to_index: Dict[str, int]
```

### 6. Non-Randomized Item Placement

When randomization is disabled (or seed=1), items are placed at their canonical locations:

```python
def pre_fill(self):
    """Pre-fill items if not randomizing."""
    if not self.options.randomize_items.value:
        self._place_original_items()

def _place_original_items(self):
    """Place statement items in their corresponding prove locations."""
    # In metamath, each statement i should be placed at location "Prove Statement i"
    for i in range(1, self.num_statements + 1):
        if i not in self.starting_statements:
            item_name = f"Statement {i}"
            location_name = f"Prove Statement {i}"

            # Get the location and create the item
            location = self.multiworld.get_location(location_name, self.player)
            item = self.create_item(item_name)

            # Place the item at its original location
            location.place_locked_item(item)
```

This ensures that:
- Statement 1 is found at "Prove Statement 1"
- Statement 2 is found at "Prove Statement 2"
- And so on, creating a linear proof progression

### 7. Items and Locations

**Items** (`Items.py`):
- Statement items: `Statement 1` through `Statement N`
- Filler hints: `Proof Hint`, `Logic Guide`, etc.
- All statements are progression items

**Locations** (`Locations.py`):
- Proof locations: `Prove Statement 1` through `Prove Statement N`
- Starting statements don't create locations
- Each location requires specific statement items

### 8. Dependency Export for Spoilers

The world stores dependency mappings for the JSON exporter to use:

```python
def set_rules(self):
    """Set access rules based on proof dependencies."""
    set_metamath_rules(self, self.proof_structure)

    # ... completion condition setup ...

    # Save dependency mappings for the exporter to use
    location_dependencies = {}
    entrance_dependencies = {}
    exit_dependencies = {}

    for region in self.multiworld.get_regions(self.player):
        if region.name.startswith("Prove Statement "):
            stmt_num = int(region.name.split()[-1])
            if stmt_num in self.proof_structure.dependency_graph:
                dependencies = self.proof_structure.dependency_graph[stmt_num]
                if dependencies:
                    # Store the actual item names required
                    item_names = [f"Statement {d}" for d in sorted(dependencies)]

                    # Store for locations
                    for location in region.locations:
                        location_dependencies[location.name] = item_names

                    # Store for entrances
                    for entrance in region.entrances:
                        entrance_dependencies[entrance.name] = item_names

        # Also store exit dependencies
        for exit in region.exits:
            if exit.connected_region and exit.connected_region.name.startswith("Prove Statement "):
                target_stmt_num = int(exit.connected_region.name.split()[-1])
                if target_stmt_num in self.proof_structure.dependency_graph:
                    target_dependencies = self.proof_structure.dependency_graph[target_stmt_num]
                    if target_dependencies:
                        target_item_names = [f"Statement {d}" for d in sorted(target_dependencies)]
                        exit_dependencies[exit.name] = target_item_names

    # Store the dependencies directly on the world object
    self.location_dependencies = location_dependencies
    self.entrance_dependencies = entrance_dependencies
    self.exit_dependencies = exit_dependencies
```

This allows the JSON exporter to include accurate dependency information in spoiler files without needing to parse the access rule lambdas.

### 9. Options (`Options.py`)

Configuration options:
- `randomize_items`: Enable/disable item randomization
- `theorem`: Which theorem to prove
- `complexity`: Controls how starting statements are selected (simple=sequential, moderate/complex=random)
- `starting_statements`: Percentage pre-unlocked
- `auto_download_database`: Auto-download set.mm

## Metamath Integration

### Database Loading

The system uses the Metamath database (`set.mm`) for theorem data:

```python
def get_metamath_database(auto_download=True):
    # Try multiple paths
    # Auto-download if enabled
    # Parse with metamath-py
    return md.parse(path)
```

### Proof Verification

Using `metamath-py.proof` module:

```python
from metamathpy.proof import verify_proof

# Verify and get proof tree
root_step, proof_dict = verify_proof(db, rule)

# ProofStep contains:
# - conclusion: What was proved
# - rule: Theorem/axiom used
# - dependencies: Previous steps used
# - substitution: Variable mappings
```

### Compressed Proof Format

Metamath uses compression for proofs:
- Letters A-T: Labels 0-19 (base-20)
- Letters U-Y: Labels 20+ (base-5 continuation)
- Letter Z: Reference to saved subproof

The `verify_proof` function handles decompression automatically.

## Adding New Features

### Supporting New Theorems

Theorems are automatically supported if they exist in the database. For offline support, add to hardcoded proofs:

```python
# In Rules.py
known_proofs = {
    '2p2e4': get_hardcoded_2p2e4_proof,
    # Add more hardcoded proofs here as needed
}
```

### Custom Proof Sources

To support other proof databases:

1. Implement database parser
2. Create ProofStructure from parsed data
3. Add to `parse_metamath_proof()` logic

### Filler Items

Filler items are automatically added to match the number of locations:

```python
# In create_items()
num_locations = self.num_statements - len(self.starting_statements)
num_items = len(items)
num_fillers_needed = max(0, num_locations - num_items)

if num_fillers_needed > 0:
    hints = ["Proof Hint", "Logic Guide", "Axiom Reference", ...]
    for _ in range(num_fillers_needed):
        hint = self.random.choice(hints)
        # Create filler item
```

## Technical Details

### Dependency Graph Algorithm

The system builds three representations:

1. **Forward dependencies**: What each statement requires
2. **Reverse dependencies**: What depends on each statement
3. **Label mapping**: Convert between labels and indices

### Starting Statement Selection

```python
# Simple mode: First N statements in order
if self.options.complexity.value == 0:  # Simple
    self.starting_statements = set(range(1, num_starting + 1))

# Moderate/Complex mode: Random selection (always includes first statement)
else:  # Moderate or Complex
    self.starting_statements = {1}  # Always start with first axiom
    remaining = num_starting - 1
    if remaining > 0:
        candidates = list(range(2, self.num_statements + 1))
        random.shuffle(candidates)
        self.starting_statements.update(candidates[:remaining])
```

### Access Rule Generation

Each location gets a rule based on its dependencies:

```python
# In set_metamath_rules function
if dependencies:  # Only set rule if there are dependencies
    # Create a set of item names for this statement's dependencies
    item_names = {f"Statement {d}" for d in dependencies}

    # Create the access rule lambda
    access_rule = lambda state, p=player, items=item_names: state.has_all(items, p)

    # Set access rules on all locations in this region
    for location in region.locations:
        add_rule(location, access_rule)
```

## Performance Considerations

### Database Parsing
- First parse takes 5-10 seconds
- Consider caching parsed theorems
- Database is ~50MB

### Proof Verification
- Complex proofs may have 100+ steps
- Verification is recursive through proof tree
- Memory usage scales with proof size

### Generation Speed
- Most time spent in database parsing
- Actual world generation is fast (<1 second)
- Multiworld scaling is linear

## Testing

### Unit Tests

Key areas to test:

1. **Proof parsing**: Verify correct dependency extraction
2. **Access rules**: Ensure logical requirements work
3. **Item generation**: Correct number and starting items
4. **Fallback logic**: Handle missing theorems gracefully

### Integration Tests

Test with various theorems:
- Simple: `1p1e2` (2 steps)
- Medium: `2p2e4` (10 steps)
- Complex: `pm5.32` (7 steps with multiple dependencies)

### Validation

Verify mathematical correctness:
```python
# Dependencies should match theorem requirements
# Example: Check that proof structure correctly identifies dependencies
assert 10 in proof_structure.dependency_graph  # Final statement exists
assert len(proof_structure.statements) == expected_steps
```

## Debugging

### Common Issues

**Missing dependencies**: Check proof verification output
```python
print(f"Step {label} dependencies: {step.dependencies}")
```

**Wrong item count**: Verify starting statements
```python
print(f"Starting: {starting_statements}")
print(f"Total items: {len(items)}")
```

**Database not found**: Check paths and auto-download
```python
print(f"Checking path: {path}")
print(f"Auto-download: {auto_download}")
```

### Logging

Add debug output:
```python
import logging
logging.info(f"Parsed {theorem}: {len(steps)} steps")
```

## Future Enhancements

### Potential Features

1. **Proof Visualization**: Generate proof tree diagrams
2. **Difficulty Estimation**: Calculate complexity metrics
3. **Custom Axiom Systems**: Support non-standard foundations
4. **Proof Hints**: Contextual hints based on missing deps
5. **Achievement System**: Recognize famous theorems
6. **Parallel Proofs**: Multiple theorems in one world

### Performance Improvements

1. **Database Caching**: Cache parsed theorems
2. **Lazy Loading**: Load only needed theorems
3. **Compressed Storage**: Store proof structures efficiently
4. **Parallel Verification**: Verify multiple proofs concurrently

### Integration Ideas

1. **Educational Mode**: Show proof steps during play
2. **Competitive Mode**: Race to complete proofs
3. **Collaborative Mode**: Shared proof construction
4. **Tutorial Mode**: Guided introduction to logic

## Contributing

### Code Style
- Follow PEP 8
- Type hints encouraged
- Docstrings for public methods

### Pull Request Guidelines
1. Test with multiple theorems
2. Verify dependency extraction
3. Check generation succeeds
4. Update documentation

### Adding Theorems
1. Test theorem exists in database
2. Verify proof structure is correct
3. Add to documentation examples
4. Consider difficulty rating

## Resources

- [Metamath Homepage](http://metamath.org/)
- [Metamath Database](https://us.metamath.org/)
- [metamath-py Documentation](https://pypi.org/project/metamath-py/)
- [Archipelago Development](https://archipelago.gg/tutorial/)

## License

The Metamath world implementation follows Archipelago's licensing.
The Metamath database is in the public domain.
The metamath-py library has its own license terms.