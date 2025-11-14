# Solved Exporter Issues for Old School Runescape

This file tracks resolved issues related to the exporter at `exporter/games/osrs.py`.

## Solved Issues

### Issue 1: Lambda default parameters not extracted to closure_vars

**Status:** SOLVED

**Location:** `exporter/analyzer/analysis.py:122-140`

**Description:**
When analyzing lambda functions with default parameters like `lambda state, loc=q_loc: (loc.can_reach(state))`, the analyzer was extracting closure variables from `__closure__` but not extracting default parameter values from `__defaults__`. This caused parameters like `loc` to be undefined when analyzing the lambda body.

**Test Failure:**
- Location: "Points: Misthalin Mystery"
- Sphere: 0.2
- Error: Name "loc" NOT FOUND in context

**Solution:**
Added code in `exporter/analyzer/analysis.py` after line 120 to extract default parameters from `rule_func.__defaults__` and add them to `local_closure_vars` with their corresponding parameter names.

---

### Issue 2: Location.can_reach() method calls not converted to state_method

**Status:** SOLVED

**Location:** `exporter/analyzer/ast_visitors.py:773-800`

**Description:**
When a lambda uses a Location object from a default parameter (e.g., `lambda state, loc=q_loc: (loc.can_reach(state))`), the analyzer was creating a generic function_call instead of recognizing this as a location reachability check that should be converted to a state_method call.

**Test Failure:**
- Location: "Points: Misthalin Mystery"
- Generated incorrect rule type

**Solution:**
Added handling in visit_Call method to detect when a method call is on a Location object. When `loc.can_reach(state)` is detected where `loc` resolves to a Location object, it's converted to `state.can_reach(location_name, "Location", player)`.

---

### Issue 3: NamedTuple attribute access not resolved to constant values

**Status:** SOLVED

**Locations:**
- `exporter/analyzer/ast_visitors.py:813-841` (visit_Attribute)
- `exporter/analyzer/ast_visitors.py:876-881` (visit_Name for closure vars)
- `exporter/analyzer/ast_visitors.py:900-904` (visit_Name for function defaults)

**Description:**
When accessing attributes on NamedTuples (like `location_row.qp` where `location_row` is a LocationRow namedtuple), the analyzer was converting the NamedTuple to a list, making attribute access impossible.

**Test Failure:**
- Locations: "Activate the 'Protect Item' Prayer", "Cut a Ruby", "Kill a Hill Giant", "Total Level 150"
- Sphere: 2.7
- Error: Access rule evaluation failed

**Solution:**
1. Modified visit_Name to NOT convert NamedTuples to lists, keeping them as name references
2. Modified visit_Attribute to try resolving attribute accesses using the expression_resolver
3. When an attribute access resolves to a simple value (int, float, str, bool), it's returned as a constant
