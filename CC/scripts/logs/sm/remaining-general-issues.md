# Remaining General Issues

## Issue 1: Some items missing from frontend inventory initialization

**Status:** INVESTIGATING

**Locations affected:**
- Missile (blue Brinstar bottom)
- Missile (blue Brinstar middle)

**Description:** The spoiler test still fails because "Morph Ball" is not in the frontend's initialized inventory, even though it's correctly listed in rules.json items. When the player collects location "Morphing Ball" (which contains item "Morph Ball"), the `haveItem('Morph')` check fails because "Morph Ball" isn't in `snapshot.inventory`.

**Evidence:**
- rules.json has 33 items including "Morph Ball" ✓
- Frontend inventory has 33 total items ✓
- Frontend inventory does NOT contain "Morph Ball" ✗
- Sample inventory keys: "Energy Tank, Missile, Super Missile, Power Bomb, Bomb, Charge Beam, Ice Beam, Hi-Jump Boots, Speed Booster, Wave Beam"

**Root cause:** State manager inventory initialization issue - not all items from rules.json are being added to the initial inventory. This appears to be a frontend/state manager bug, not an exporter issue.

**Next steps:** Investigate StateManager initialization code to understand how inventory is populated from rules.json items.

