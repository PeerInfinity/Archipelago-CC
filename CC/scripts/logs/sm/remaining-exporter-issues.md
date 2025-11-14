# Super Metroid - Remaining Exporter Issues

## Current Status
Test fails at Sphere 0 - regions not being reached that should be accessible from start.

## Issue 1: Complex SMBool evaluation structures
**Severity:** High
**Description:** Exit rules are being exported as complex nested helper calls involving `evalSMBool` and `func` helpers that don't have JavaScript implementations.

**Example from rules.json:**
```json
{
  "type": "helper",
  "name": "evalSMBool",
  "args": [
    {
      "type": "helper",
      "name": "func",
      "args": [
        {
          "type": "subscript",
          "value": {
            "type": "attribute",
            "object": {"type": "name", "name": "state"},
            "attr": "smbm"
          },
          "index": {"type": "constant", "value": 1}
        }
      ]
    },
    {
      "type": "attribute",
      "object": {
        "type": "subscript",
        "value": {
          "type": "attribute",
          "object": {"type": "name", "name": "state"},
          "attr": "smbm"
        },
        "index": {"type": "constant", "value": 1}
      },
      "attr": "maxDiff"
    }
  ]
}
```

**Impact:** All exits from Landing Site (and likely all other regions) fail to evaluate, preventing any progression.

**Affected regions (Sphere 0):**
- Blue Brinstar Elevator Bottom (should be accessible from Landing Site)
- Energy Tank, Brinstar Ceiling
- Morphing Ball
- All Blue Brinstar missile locations
- Power Bomb (blue Brinstar)

**Root cause:** The Python code uses `lambda state: self.evalSMBool(func(state.smbm[player]), state.smbm[player].maxDiff)` where `func` is a reference to a traverse function from the VARIA randomizer. The exporter is treating `func` as a helper name rather than recognizing it as a function variable.

## Potential Solutions

### Option 1: Fix the exporter to better handle SMBool patterns
The exporter could recognize the pattern `self.evalSMBool(func(state.smbm[player]), state.smbm[player].maxDiff)` and transform it appropriately.

### Option 2: Implement comprehensive helper system for SM
Create JavaScript helper functions that can evaluate the complex SMBool logic, including:
- `evalSMBool(smbool, maxDiff)` - evaluates if smbool.bool is true and difficulty <= maxDiff
- `func` - represents the traverse/access functions
- Support for accessing `state.smbm[player]` and its attributes

### Option 3: Simplify at export time
Transform the SMBool evaluation into simpler rule structures that don't require complex helper functions.
