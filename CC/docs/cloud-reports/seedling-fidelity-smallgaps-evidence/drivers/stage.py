import re, sys
stage = int(sys.argv[1])  # 1: D1 only, 2: D1+D2, 3: all
F = sys.argv[2]
def cut(s, start, end_incl):
    i = s.index(start); j = s.index(end_incl, i) + len(end_incl)
    return s[:i] + s[j:]
# contactFidelity.js
p = 'frontend/modules/seedlingDemo/contactFidelity.js'; s = open(F + '/' + p).read()
if stage < 3:
    s = cut(s, "    /**\n     * fidelity SMALLGAPS D3", "    lavaChainPlayerHit: false,\n")
    s = cut(s, "if (globalThis.process?.env?.SEEDLING_LAVA_CHAIN_PLAYER_HIT === '1')", "CONTACT_FIDELITY.lavaChainPlayerHit = false;\n")
    s = s.replace(", `SEEDLING_LAVA_CHAIN_PLAYER_HIT` (0|1), likewise.", " (0|1), likewise.")
if stage < 2:
    s = cut(s, "    /**\n     * fidelity SMALLGAPS D2", "    waypointSlide: false,\n")
    s = cut(s, "if (globalThis.process?.env?.SEEDLING_WAYPOINT_SLIDE === '1')", "CONTACT_FIDELITY.waypointSlide = false;\n")
    s = s.replace("`SEEDLING_BUTTON_FALL_RELEASE_STEP`, `SEEDLING_WAYPOINT_SLIDE` (0|1), likewise.", "`SEEDLING_BUTTON_FALL_RELEASE_STEP=0|1`, likewise.")
open(p, 'w').write(s)
# contactFidelity.test.js
p = 'frontend/modules/seedlingDemo/contactFidelity.test.js'; s = open(F + '/' + p).read()
if stage < 3:
    s = s.replace("\n        || !!process.env.SEEDLING_WAYPOINT_SLIDE || !!process.env.SEEDLING_LAVA_CHAIN_PLAYER_HIT)", "\n        || !!process.env.SEEDLING_WAYPOINT_SLIDE)")
    s = s.replace("`buttonFallReleaseStep` (D1), `waypointSlide` (D2), `lavaChainPlayerHit` (D3) ship OFF.", "`buttonFallReleaseStep` (D1), `waypointSlide` (D2) ship OFF.")
    s = s.replace("buttonFallReleaseStep: false, waypointSlide: false, lavaChainPlayerHit: false });", "buttonFallReleaseStep: false, waypointSlide: false });")
if stage < 2:
    s = s.replace(" || !!process.env.SEEDLING_BUTTON_FALL_RELEASE_STEP\n        || !!process.env.SEEDLING_WAYPOINT_SLIDE)", " || !!process.env.SEEDLING_BUTTON_FALL_RELEASE_STEP)")
    s = s.replace("`buttonFallReleaseStep` (D1), `waypointSlide` (D2) ship OFF.", "`buttonFallReleaseStep` (D1) ships OFF.")
    s = s.replace("buttonFallReleaseStep: false, waypointSlide: false });", "buttonFallReleaseStep: false });")
open(p, 'w').write(s)
# levelRun.js
p = 'frontend/modules/seedlingDemo/levelRun.js'; s = open(F + '/' + p).read()
if stage < 3:
    s = s.replace("""        // ⛓ fidelity SMALLGAPS D3 (`CONTACT_FIDELITY.lavaChainPlayerHit`): the `"Player"` arm steps every chain room.
        const playerArm = CONTACT_FIDELITY.lavaChainPlayerHit;
        if (st.size === 0 && !playerArm) return;""", "        if (st.size === 0) return;")
    s = cut(s, "            // ── ⛓ fidelity SMALLGAPS D3: `reach()` walks", "                    retaliate: null, // `LavaChain.as:90` — `hit(null, …)`\n                });\n            }\n")
open(p, 'w').write(s)
