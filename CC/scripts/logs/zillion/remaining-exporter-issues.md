# Zillion - Remaining Exporter Issues

## Issue 1: Starting abilities not accounted for

**Status:** IN PROGRESS

**Problem:**
The exporter directly converts zilliandomizer Req objects to rules, but Req objects represent ABSOLUTE requirements (total abilities needed), not RELATIVE requirements (items to collect). In Zillion, the starting character (e.g., JJ) has built-in abilities (gun=1, possibly jump=1) that don't correspond to collectible items.

**Evidence:**
- Debug output shows "B-1 mid far left" has Req with gun=1
- Sphere log shows this location should be accessible in sphere 0 with NO items
- This means gun=1 is the STARTING ability, not a requirement to collect

**Current Status:**
The exporter generates rules that require items for locations that should be accessible from the start. For example:
- "B-1 mid far left" generates rule: `{"type": "item_check", "item": "Zillion", "count": 1}`
- But it should generate: `{"type": "constant", "value": true}`

**Solution Needed:**
1. Determine the starting character's abilities (likely gun=1, jump=0 or jump=1)
2. When converting Req to rule, subtract the starting abilities
3. Only generate item requirements for abilities BEYOND what the starting character has

**Implementation Approach:**
1. Get the starting character from world.options.start_char
2. Create a "starting Req" that represents the starting character's abilities
3. When converting a location's Req, check if it's satisfied by starting abilities alone
4. If yes, return `{"type": "constant", "value": true}`
5. If no, generate rules for the DIFFERENCE between location Req and starting Req

**Affected Locations:**
Based on sphere 0, these 12 locations should be immediately accessible:
- A-3 top left-center, A-4 bottom far left, A-4 bottom right, A-4 mid center
- A-4 top left, A-6 bottom far right, A-6 mid far right, A-8 bottom center
- B-1 mid far left, B-1 mid right, B-1 top right-center, B-8 top right
