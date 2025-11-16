# Super Metroid - Remaining Helper Issues

## Open Issues

### 1. 'ret' name reference not resolved
**Status**: Not started

**Description**: Many rules contain `{"type": "name", "name": "ret"}` which comes from cache decorator wrappers. The frontend doesn't know how to resolve this name reference.

**Impact**: Rules with `ret` references can't be evaluated, preventing access to many regions.

**Possible Solutions**:
1. Fix the exporter/analyzer to expand `ret` to the actual function result
2. Create a special handler in the frontend for cache decorator patterns
3. Implement VARIA traverse functions directly in JavaScript

### 2. 'func' and 'rule' helpers need implementation
**Status**: Partially addressed

**Description**: The current `func()` helper just returns `{bool: true, difficulty: 0}`, which is correct for some traverse functions but not for all access rules.

Need to either:
- Implement the actual VARIA helper functions in JavaScript
- Or create simplified item-based equivalents

**Impact**: Access rules that depend on specific items/conditions are not being enforced properly.

**Possible Solutions**:
1. Implement key VARIA helpers like:
   - `canPassTerminatorBombWall()`
   - `canPassCrateriaGreenPirates()`
   - `canDestroyBombWalls()`
   - `canPassBombPassages()`
   - And others as needed
2. Create simplified versions that just check for required items
3. Map VARIA helpers to simpler item checks based on analysis of the Python code

