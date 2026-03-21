# Plan: Instantiated Expressions in Proof Table

## Problem

The proof table shows generic/schematic expressions for theorem steps (e.g., `|- A = C` for eqtr4i) instead of the concrete instantiated expressions (e.g., `|- ( 2 + 2 ) = 4`). Axioms and definitions already show concrete values, but inference steps use placeholder variables.

## Discovery

`metamath-py`'s `ProofStep.conclusion` attribute contains the fully instantiated expression as a tuple of tokens. Verified via experiment:

```
eqtr4i:  generic = "|- A = C"           conclusion = ('|-', '(', '2', '+', '2', ')', '=', '4')
oveq2i:  generic = "|- ( C F A ) = ..."  conclusion = ('|-', '(', '2', '+', '2', ')', '=', '(', '2', '+', '(', '1', '+', '1', ')', ')')
addassi: generic = "|- ( ( A + B ) ..."  conclusion = ('|-', '(', '(', '2', '+', '1', ')', '+', '1', ')', '=', '(', '2', '+', '(', '1', '+', '1', ')', ')')
```

These match the MetaMath page at `us.metamath.org/mpeuni/2p2e4.html` exactly.

## Files to Modify

### 1. `worlds/metamath/Rules.py`

**ProofStatement class** (line 10-18): Add `instantiated_expression` parameter.

```python
def __init__(self, index, label, expression, dependencies, full_text=None, instantiated_expression=None):
    ...
    self.instantiated_expression = instantiated_expression
```

**`extract_proof_dependencies()`** (line 229-285): Also return a `conclusions` dict mapping label -> instantiated expression string.

Change return type to `Tuple[List[str], Dict[str, Set[str]], Dict[str, str]]`.

In the loop at line 258-279, after extracting deps, also capture:
```python
if hasattr(step, 'conclusion') and step.conclusion:
    conclusions[label] = ' '.join(step.conclusion)
```

Return `ordered_steps, dependencies, conclusions`.

**`parse_proof_from_database()`** (line 287-361): Accept and use `conclusions` dict.

Change signature to accept `conclusions` parameter. When creating ProofStatement (line 353), pass:
```python
instantiated_expression=conclusions.get(label)
```

Also update the call site at line 295 to unpack the new third return value.

**`get_hardcoded_2p2e4_proof()`** (line 363-387): The hardcoded proof already uses concrete expressions as the main expression. Add `instantiated_expression` matching the existing expression for consistency. The tuple format changes to 6 elements:

```python
(1, 'df-2', '|- 2 = ( 1 + 1 )', [], 'df-2: ...', '|- 2 = ( 1 + 1 )'),
# ...
(10, 'eqtr4i', '|- A = C', [6, 9], 'eqtr4i: ...', '|- ( 2 + 2 ) = 4'),
```

Wait — the hardcoded proof already has concrete expressions as the primary expression. It was written before the database extraction existed. This is inconsistent with the database path which stores generic expressions. The hardcoded proof doesn't need changes for this feature since it already shows concrete values. Just add `instantiated_expression=None` or match the expression.

Actually, looking more carefully: the hardcoded proof uses expressions like `'(2 + 2) = 4'` without the `|-` prefix and with different formatting than the database. It's a legacy fallback. I'll just pass `instantiated_expression=None` for the hardcoded path — it won't matter since the database path is used when available.

### 2. `worlds/metamath/__init__.py`

**`fill_slot_data()`** (line 373-389): Add `instantiated_expression` to the exported dict, only when it differs from the generic expression (to save space):

```python
"proof_structure": {
    i: {
        "label": stmt.label,
        "expression": stmt.expression,
        "dependencies": stmt.dependencies,
        "full_text": stmt.full_text,
        **({"instantiated_expression": stmt.instantiated_expression}
           if stmt.instantiated_expression and stmt.instantiated_expression != stmt.expression
           else {}),
    }
    for i, stmt in self.proof_structure.statements.items()
},
```

### 3. Regenerate seed

```bash
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/MetaMath.yaml" --multi 1 --seed 1
```

This updates `frontend/presets/metamath/AP_14089154938208861744/AP_14089154938208861744_rules.json` with the new `instantiated_expression` fields.

### 4. `frontend/modules/proofShared/proofBaseState.js`

**`_parseProofStructure()`** (line 94-121): Read the new field into the ProofStep object:

```javascript
const step = {
    index,
    label,
    expression,
    instantiatedExpression: stmt.instantiated_expression || null,  // NEW
    dependencies: ...,
    ...
};
```

**ProofStep typedef** (line 14-24): Add `instantiatedExpression` field.

### 5. `frontend/modules/proofQueue/proofQueueUI.js`

**`_renderProvenTable()`**: Use `step.instantiatedExpression || step.expression` for the Expression column in the proven table. This shows concrete values when available.

**`_renderQueue()`**: Same — use instantiated expression when available.

**Theorem header**: Use the goal step's instantiated expression: `Theorem 2p2e4: |- ( 2 + 2 ) = 4` instead of `|- A = C`.

**Show details mode**: When "Show details & links" is checked, could show the generic expression as secondary detail text (since the full_text already contains it).

## Edge Cases

- Steps where `instantiated_expression` equals `expression` (axioms/definitions): field is omitted from JSON, frontend falls back to `expression`. No visual change.
- Hardcoded fallback proof: No `instantiated_expression` set — uses existing concrete expressions which are already correct.
- Other proof modules (proofGraph): They read from the same `proofBaseState.js` so they'll have access to the field, but don't need UI changes now.

## Verification

1. Regenerate seed, check rules.json has `instantiated_expression` on steps like eqtr4i, oveq2i, 3eqtri, etc.
2. Load `http://localhost:8000/frontend/?game=metamath&seed=1&panel=proofQueuePanel`
3. Complete the proof and verify the proven table shows concrete expressions matching the MetaMath page
4. Verify theorem header shows `Theorem 2p2e4: |- ( 2 + 2 ) = 4`
