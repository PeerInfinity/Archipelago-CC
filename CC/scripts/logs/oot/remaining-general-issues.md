# Remaining General Issues for Ocarina of Time

This document tracks unresolved general issues (not specific to exporter or helpers).

---

## Issues

### Issue 1: Sphere 0 - Starting regions not accessible in STATE

**Test Results**: Sphere 0 comparison failed

**Description**:
At the initial state (Sphere 0), the Python spoiler log shows 67 regions as accessible, but the JavaScript StateManager shows 0 regions as accessible.

**Regions expected to be accessible (from LOG)**:
Beyond Door of Time, Castle Grounds, Child Spawn, Deku Theater, Deku Tree Lobby, GC Woods Warp, GV Crate Ledge, GV Grotto Ledge, GV Lower Stream, GV Upper Stream, Gerudo Valley, Graveyard, Graveyard Dampes House, Graveyard Heart Piece Grave, Graveyard Shield Grave, HF Open Grotto, Hyrule Castle Grounds, Hyrule Field, KF House of Twins, KF Know It All House, KF Kokiri Shop, KF Links House, KF Midos House, KF Outside Deku Tree, KF Sarias House, Kak Backyard, Kak Carpenter Boss House, Kak House of Skulltula, Kak Impas House, Kak Impas House Back, Kak Impas House Near Cow, Kak Impas Ledge, Kak Open Grotto, Kak Potion Shop Front, Kak Windmill, Kakariko Village, Kokiri Forest, LH Fishing Hole, LH Fishing Island, LH Grotto, LH Lab, LH Owl Flight, LLR Grotto, LLR Stables, LLR Talons House, LLR Tower, LW Beyond Mido, LW Bridge, LW Bridge From Forest, LW Forest Exit, Lake Hylia, Lon Lon Ranch, Lost Woods, Market, Market Back Alley, Market Bazaar, Market Bombchu Bowling, Market Bombchu Shop, Market Dog Lady House, Market Entrance, Market Guard House, Market Man in Green House, Market Mask Shop, Market Potion Shop, Market Shooting Gallery, Market Treasure Chest Game, Root Exits, SFM Entryway, Temple of Time, ToT Entrance, ZR Front

**Root Cause**:
This is likely a cascading effect of the helper function errors. If basic helpers like `can_blast_or_smash` fail to evaluate, then exits from the starting region cannot be evaluated correctly, preventing region expansion.

**Related Issues**:
- Helper Issue 1: Helper functions reference undefined 'context' variable

**Test Output**:
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":0,"player_id":"1"}
> Regions accessible in LOG but NOT in STATE: [67 regions listed above]
```

**Next Steps**:
1. Fix helper context reference errors first
2. Re-run test to see if this issue resolves
3. If issue persists, investigate starting region setup and initial state
