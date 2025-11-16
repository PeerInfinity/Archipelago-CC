# Super Metroid - Remaining Exporter Issues

## Open Issues

### 1. Cache decorator creates infinite recursion
**Status**: Partially addressed

**Description**: The VARIA randomizer's `Cache.ldeco()` decorator wraps lambdas in a caching function that contains:
```python
def _decorator(arg):
    ret = func(arg)
    return ret
```

The analyzer expands this to `{"type": "name", "name": "ret"}` but hits the recursion limit before expanding `func(arg)` further.

**Impact**: Many access rules end up as unexpanded name references like `{"type": "name", "name": "ret"}` instead of the actual logic.

**Possible Solutions**:
1. Detect cache decorator pattern and skip the wrapper, analyzing the underlying function directly
2. Further increase recursion limit (but this may not solve the fundamental circular reference issue)
3. Modify SM world to use rules that don't require deep recursion to analyze
4. Implement VARIA helpers in JavaScript instead of trying to analyze them

### 2. Complex VARIA helpers not fully expanded
**Status**: Not started

**Description**: SM uses complex helper functions like:
- `canPassTerminatorBombWall()` - requires SpeedBooster+tech OR canDestroyBombWalls()
- `canPassCrateriaGreenPirates()` - requires bombs OR missiles OR energy OR beams
- `canDestroyBombWalls()` - requires Morph Ball + Bombs
- Many more nested helpers

These helpers reference other helpers in a deep hierarchy, and the analyzer may not fully expand them all.

**Impact**: If helpers aren't fully expanded, the frontend can't evaluate them properly.

**Possible Solutions**:
1. Implement key VARIA helpers in JavaScript
2. Create simplified item-based rules for SM
3. Continue improving analyzer to handle deeper nesting

