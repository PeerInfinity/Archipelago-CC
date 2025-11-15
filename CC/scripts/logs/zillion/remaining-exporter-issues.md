# Remaining Exporter Issues - Zillion

## Critical Issue: Zilliandomizer Library Integration

### Problem Description

The Zillion world uses the `zilliandomizer` library for its logic system. This library has complex internal pathfinding and logic that cannot be easily represented in the simple rule format used by the exporter.

**Key findings:**

1. **Location Requirements**: All Zillion locations have `req` objects with fields like `gun`, `jump`, `hp`, `red`, `floppy`, `skill`, `char`, and `door`. However, these fields alone do not fully determine accessibility.

2. **Example**: Both "B-1 mid far left" and "C-3 mid far right" have identical requirements (`gun=1, jump=0, hp=0`), but:
   - "B-1 mid far left" is accessible in Sphere 0 (no items needed)
   - "C-3 mid far right" is accessible in Sphere 0.3 (requires 1 Zillion item)

3. **Zilliandomizer Logic**: The accessibility is determined by `zilliandomizer.randomizer.get_locations(have_req)` which uses internal pathfinding/logic that considers more than just the `req` fields.

4. **Access Rule**: The Python world sets `location.access_rule` to a `functools.partial` that calls into the zilliandomizer library. During export (before item placement), this returns incorrect results because the zilliandomizer state isn't fully initialized.

5. **Analyzer Limitation**: The generic analyzer cannot analyze `functools.partial` access rules, so it produces `null` access rules for all Zillion locations.

### Current State

- **rules.json**: All Zillion locations have `null` or `{type: "constant", value: true}` access rules
- **Test Result**: Spoiler test fails at Sphere 0 - 44 locations are incorrectly marked as accessible

### Attempted Solutions

1. ✗ **Extract from `req` fields**: Fields don't fully determine accessibility
2. ✗ **Test access_rule during export**: Zilliandomizer state not initialized, returns incorrect results
3. ✗ **Let analyzer handle it**: Produces `null` access rules (same problem)

### Possible Solutions

#### Option 1: Deep Zilliandomizer Integration
Deeply understand the zilliandomizer library's pathfinding algorithm and replicate it in the exporter.

**Pros:**
- Would produce correct access rules
- No frontend changes needed

**Cons:**
- Requires deep understanding of zilliandomizer internals
- Complex to maintain if zilliandomizer updates
- Time-intensive

#### Option 2: Frontend Helper Functions
Create JavaScript helper functions that replicate the zilliandomizer logic.

**Pros:**
- Can leverage zilliandomizer source as reference
- Modular approach

**Cons:**
- Still requires understanding zilliandomizer internals
- Need to ensure JS and Python stay in sync
- Complex logic to port

#### Option 3: Post-Generation Rule Extraction
After generation completes and sphere log is created, parse the sphere log to infer access rules, then regenerate rules.json.

**Pros:**
- Uses actual game results as ground truth
- No need to understand zilliandomizer internals

**Cons:**
- Hacky two-pass approach
- May not generalize to different seeds/settings
- Difficult to maintain

#### Option 4: Mark as Unsupported
Document that Zillion cannot be fully supported with current exporter architecture.

**Pros:**
- Honest about limitations
- Can revisit later with better architecture

**Cons:**
- Leaves Zillion broken
- User experience suffers

### Recommendation

Start with **Option 3** (Post-Generation Rule Extraction) as a pragmatic short-term solution, while planning for **Option 1** or **Option 2** as a longer-term fix. This allows Zillion to work while we develop a better understanding of the zilliandomizer library.

### Technical Details

**Zillion Items:**
- Zillion (gun upgrade)
- Jump Shoes
- Scope
- Red ID Card
- Floppy Disk
- Bread
- Opa-Opa
- Apple (rescue)
- Champ (rescue)

**Character System:**
- Player can start as JJ, Apple, or Champ
- Different characters may have different abilities
- Default start character affects gun level

**Req Fields:**
- `gun`: Gun level (0-3)
- `jump`: Jump ability (0-1)
- `hp`: HP requirement
- `red`: Red ID Card count
- `floppy`: Floppy Disk count
- `skill`: Skill level
- `char`: Character tuple (e.g., ('JJ', 'Apple', 'Champ'))
- `door`: Door requirement

