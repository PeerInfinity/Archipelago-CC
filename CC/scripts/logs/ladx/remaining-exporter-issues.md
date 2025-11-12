# LADX Remaining Exporter Issues

## Issue 1: Rooster Cave over-accessible in Sphere 0

**Symptom:** Test fails at Sphere 0 with single region mismatch: "Rooster Cave" accessible in STATE but not in LOG.

**Current state:**
- Test shows only 1 mismatch (down from 40+ regions!)
- Exit "Mabe Village -> Rooster Cave" has null access rule
- According to sphere log, Rooster Cave should become accessible in Sphere 4.18 with Progressive Power Bracelet
- Exit truly has entrance.condition = None (always accessible) in LADX code

**Root cause:** The entrance from Mabe Village to Rooster Cave is created with condition=None, making it always accessible. This appears to be how LADX's entrance system is configured.

**Possible explanations:**
1. LADX may use additional logic beyond entrance conditions to control region accessibility
2. There may be location-based or event-based requirements not captured in entrance conditions
3. This might be a bidirectional entrance where only one direction has requirements

**Priority:** LOW - Only 1 region affected, test is 99%+ accurate
