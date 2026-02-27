# Metamath Settings Guide

## Complete Settings Reference

All available options for configuring your Metamath experience.

## Core Settings

### vanilla_placement
**Type**: Toggle
**Default**: `false`

If enabled, items will be placed in their original locations (proof statements will be at their corresponding theorem locations) without any randomization. Enabling this also forces `randomize_items` to `false`.

```yaml
vanilla_placement: true   # Items stay in original locations, world marked as vanilla
vanilla_placement: false  # Normal behavior (randomization controlled by randomize_items)
```

---

### randomize_items
**Type**: Toggle
**Default**: `true`

Enable item randomization. When disabled, all items will remain in their original locations (proof statements will be at their corresponding theorem locations).

```yaml
randomize_items: true   # Normal randomized game
randomize_items: false  # Items stay in original locations
```

When set to `false`, each statement item will be found at its own prove location, creating a linear proof progression.

**Special Seed Behavior**: When using seed 1, randomization is automatically disabled to provide canonical item placements for testing and speedrunning purposes.

**Note**: If `vanilla_placement` is enabled, `randomize_items` is forced to `false` regardless of this setting.

---

### theorem
**Type**: Text Choice / Weighted Choice
**Default**: `2p2e4`

The theorem to prove. This determines your entire game structure.

**Note on Weighted Selection**: When using weighted random selection, the numbers are relative weights, not percentages. The actual probability of each option is its weight divided by the sum of all weights. For example, weights of 2:1:1 give probabilities of 50%:25%:25%.

```yaml
# Single theorem
theorem: 2p2e4

# URL format
theorem: https://us.metamath.org/mpeuni/2p2e4.html

# Weighted random selection (relative weights)
theorem:
  2p2e4: 50      # Weight 50 (50% chance in this example since 50+30+20=100)
  1p1e2: 30      # Weight 30 (30% chance in this example)
  3p3e6: 20      # Weight 20 (20% chance in this example)
```

**Available Theorems**:

*Arithmetic (Easy):*
- `1p1e2` - 1 + 1 = 2 (~2 steps)
- `2p2e4` - 2 + 2 = 4 (~10 steps) *(default)*
- `3p3e6` - 3 + 3 = 6 (~12 steps)
- `4p4e8` - 4 + 4 = 8 (~12 steps)
- `5p5e10` - 5 + 5 = 10 (~12 steps)
- `2m1e1` - 2 - 1 = 1 (~4 steps)

*Logic (Easy):*
- `pm2.21` - ¬φ → (φ → ψ) (~2 steps)
- `pm2.43` - ((φ → (φ → ψ)) → (φ → ψ)) (~2 steps)
- `pm5.32` - Complex biconditional (~9 steps)
- `con3i` - Contraposition (~3 steps)
- `syl` - Syllogism (~3 steps)

*Set Theory (Easy to Medium):*
- `uneq12i` - Union equality (~3 steps)
- `ineq12i` - Intersection equality (~3 steps)
- `pwfi` - Power set finiteness (~15 steps)
- `canth` - Cantor's theorem (~20 steps)

*Algebra (Medium):*
- `grplid` - Group left identity (~6 steps)
- `grpinveu` - Group inverse uniqueness (~17 steps)

*Analysis (Easy to Medium):*
- `cos0` - cos(0) = 1 (~12 steps)
- `sin0` - sin(0) = 0 (~10 steps)

*Number Theory (Medium to Hard):*
- `euclemma` - Euclid's lemma for primes (~16 steps)
- `wilth` - Wilson's theorem (~40 steps)

*Very Hard:*
- `dfac5` - Axiom of choice equivalence (~65 steps)

You can also enter any theorem name from the Metamath database beyond the preset list.

---

### complexity
**Type**: Choice
**Default**: `moderate`
**Options**: `simple`, `moderate`, `complex`

Controls how starting statements are selected when you begin the game.

```yaml
complexity: moderate
```

- **simple**: Starting statements are the first N statements in sequential order
- **moderate**: Starting statements are randomly selected from throughout the proof
- **complex**: Starting statements are randomly selected from throughout the proof (same as moderate)

---

### starting_statements
**Type**: Range
**Default**: `0`
**Range**: `0-50`

Percentage of proof statements that are pre-unlocked at the start. Higher values make the proof easier to complete.

```yaml
starting_statements: 10  # Start with 10% of proof unlocked

# Or use random
starting_statements:
  random: 50
  random-low: 25    # Random between 0-25%
  random-high: 25   # Random between 25-50%
```

- `0`: Start with no statements (hardest)
- `10`: Start with 10% (default, balanced)
- `30`: Start with 30% (easier)
- `50`: Start with half the proof (easiest)

---

### auto_download_database
**Type**: Toggle
**Default**: `true`

Automatically download the metamath database (set.mm) if not found locally. The file is about 50MB and will be cached for future use.

```yaml
auto_download_database: true   # Auto-download if needed
auto_download_database: false  # Never download, use fallbacks only
```

## Example Configurations

### Easy Mode
```yaml
Metamath:
  randomize_items: true       # Normal randomization
  theorem: 1p1e2              # Simple 2-step proof
  complexity: simple          # Sequential starting statements
  starting_statements: 30     # Start with 30% unlocked
```

### Balanced
```yaml
Metamath:
  randomize_items: true       # Normal randomization
  theorem: 2p2e4              # Classic 10-step proof
  complexity: moderate        # Random starting statements
  starting_statements: 10     # Start with 10%
```

### Challenge Mode
```yaml
Metamath:
  randomize_items: true       # Normal randomization
  theorem: pm5.32             # Complex logic proof
  complexity: complex         # Random starting statements
  starting_statements: 0      # Start with nothing (default)
```

### Vanilla Proof Mode
```yaml
Metamath:
  vanilla_placement: true    # Items stay at their proof locations, world marked vanilla
  theorem: 2p2e4
  complexity: simple
  starting_statements: 20   # Start with 20% to avoid being stuck
```

### Linear (Non-Randomized) Mode
```yaml
Metamath:
  randomize_items: false     # Items stay at their proof locations
  theorem: 2p2e4
  complexity: simple
  starting_statements: 20   # Start with 20% to avoid being stuck
```

## Tips for Settings

1. **New Players**: Start with `simple` complexity and higher `starting_statements`
2. **Database**: Keep `auto_download_database: true` unless you have bandwidth concerns
3. **Linear Progression**: Set `randomize_items: false` for a more predictable experience

## Troubleshooting Settings

**"Not enough locations"**: Lower `starting_statements` or choose a theorem with more steps

**"Too difficult"**: Increase `starting_statements` or choose `simple` complexity

**"Too easy"**: Decrease `starting_statements`, increase `complexity`, or choose a harder theorem

**"Takes too long to generate"**: The first generation with a new theorem needs to parse the database (5-10 seconds). This is normal.