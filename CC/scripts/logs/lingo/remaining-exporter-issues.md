# Remaining Exporter Issues for Lingo

This document tracks outstanding issues with the Lingo exporter (exporter/games/lingo.py).

## Issues

### Issue 1: Region mismatch at Sphere 3.2 - Orange Tower Basement

**Status:** Identified
**Sphere:** 3.2
**Region:** Orange Tower Basement
**Error:** Region accessible in STATE but not in LOG

**Problem:**
The region "Orange Tower Basement" is being marked as reachable in the JavaScript frontend but was not reachable in the Python-generated sphere log at this sphere.

**Next Steps:**
Need to investigate the entrance rules for "Orange Tower Basement" to determine why it's being incorrectly marked as accessible.

**Test Command:**
```bash
npm test --mode=test-spoilers --game=lingo --seed=1
```
