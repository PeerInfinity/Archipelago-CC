# Remaining Exporter Issues for Ocarina of Time

This file tracks exporter-related issues that need to be fixed in `exporter/games/oot.py`.

## Issue 1: Subrule Locations Have Null Access Rules

**Status:** In Progress

**Problem:**
- Subrule locations (e.g., "Kokiri Forest Subrule 1", "Lost Woods Subrule 1", etc.) are being exported with `"access_rule": null`
- This causes them to be accessible in Sphere 0 in the JavaScript StateManager
- But they should not be accessible until certain conditions are met (e.g., having a Magic Bean)

**Root Cause:**
- Subrule locations are created dynamically by OOT's RuleParser from AST nodes
- Their access rules are lambdas generated from `ast` code, not from source files
- When the exporter tries to get the source code using `inspect.getsource()`, it fails:
  - "Failed to get multiline lambda source for <function <lambda> ...>: [Errno 2] No such file or directory: '<string>'"
  - "Fallback getsource also failed: could not get source code"
- Without source code, the analyzer can't parse the rule, so it returns `null`

**Evidence:**
- From sphere log: "Kokiri Forest Subrule 1" becomes accessible at sphere 3.135 when "Buy Magic Bean" is obtained
- From test output: "Locations accessible in STATE (and unchecked) but NOT in LOG: Kokiri Forest Subrule 1, Lost Woods Subrule 1, ..."
- From generation log: "Failed to analyze or expand rule for Location 'Kokiri Forest Subrule 1' using runtime analysis."

**Solution Approach:**
- Option 1: Modify RuleParser to store rule AST as string on subrule locations
- Option 2: Use runtime evaluation to determine what items are required
- Option 3: Extract rule AST from RuleParser's delayed_rules and convert to exportable format
- Option 4: Filter out subrule locations from export (they're internal with `show_in_spoiler = False`)

**Next Steps:**
- Implement one of the solution approaches
- Regenerate rules.json
- Verify subrules are no longer accessible in Sphere 0
