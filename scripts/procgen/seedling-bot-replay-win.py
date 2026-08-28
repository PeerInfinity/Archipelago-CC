#!/usr/bin/env python3
"""Replay ONE Seedling bot tape on real-GPU Windows Chrome, driven from WSL.

WSL's own Chromium is SwiftShader (software) — SWFRecomp-CC's CLAUDE.md is
explicit that it must never be used for performance work, and Seedling runs
about SEVEN TIMES slower on it (~0.5 frames/sec measured, vs the ~3.6 fps
the real-GPU rig reports). Since a bot tape is replayed one game frame at a
time, that difference is the whole cost of the differential harness: a
140-tick tape is ~6.5 minutes on software and well under a minute here.

So this script is deliberately DUMB: it is only a browser driver. It knows
nothing about fixtures, expectations or diffing — it boots the page, replays
the tape it is handed, and writes the drained observation stream to a file.
All the logic stays in `verify-seedling-bot-differential.mjs` on the Linux
side, which shells out to this per tape. That split is what keeps the tape
format and the comparison in ONE implementation rather than two.

Recipe and rules: SWFRecomp-CC `tools/divergence/perf/WINDOWS_PLAYWRIGHT_FROM_WSL.md`
  1. Windows Python, never `python3`. That doc says `python.exe`; on this box
     it is not on WSL's PATH and the WindowsApps stub is an uninstalled Store
     alias — use the launcher: `py.exe -3.12` (Playwright 1.61, verified).
  2. Windows paths only. This script and every file it reads/writes must live
     somewhere Windows can see — `C:\\playwright\\` (= /mnt/c/playwright/),
     converted with `wslpath -w`.
  3. `cmd.exe`/`py.exe` launched from a WSL cwd print a harmless
     "UNC paths are not supported" line; the caller filters it.

The page itself is served from WSL (`python3 -m http.server 8000` at the repo
root) and reached over WSL2 localhost forwarding.

Usage:
  py.exe -3.12 <this> --url URL --tape C:\\...\\tape.json
                      --out C:\\...\\stream.json --deadline-sec N
  py.exe -3.12 <this> --url URL --tapes C:\\...\\windows.json
                      --out C:\\...\\trace.json        (R5's director: ONE page)
"""

import argparse
import json
import sys
import time

# ⛔ THE PLAYWRIGHT IMPORT IS INSIDE `main()`, NOT HERE (R9 slice 12g). This
# file has to be IMPORTABLE ON LINUX so `seedlingSwapGate.test.js` can reach
# the world-swap gate's predicate without a Windows Playwright install; a
# top-level import made that impossible, and the predicate would have been the
# one part of this driver no row could ever exercise. Nothing above `main()`
# touches the browser, so the move costs only the line's position: an
# ImportError now names itself when a run STARTS rather than when it loads.


# ── R9 slice 12g: THE WORLD-SWAP GATE (⚖ 58) ─────────────────────────────────
#
# ⛔ IT LIVES IN THIS FILE, and that is a decision rather than an accident.
# Every consumer that drives the game COPIES this single file into the Windows
# scratch directory and runs it from there (`verify-seedling-bot-differential
# .mjs`'s `replayOnWindows`, and the rest). A sibling module would have to be
# copied by every one of them, and the first consumer that forgot would not
# lose the GATE — it would lose the whole driver to an ImportError. One file
# cannot be half-copied.
#
# ⛓ R9 slice RR, ⚖ 17: THE COUNT IS NOT WRITTEN HERE. This comment used to say
# "SEVENTEEN consumers", which was stale (16 at that head) and which nothing
# could have caught. The population is one grep away and is the only form of it
# that cannot go stale:
#
#     grep -rl "seedling-bot-replay-win.py" --include=*.mjs scripts/procgen \
#       | xargs grep -l "writeFileSync(.*'seedling-bot-replay-win.py'"
#
# (plus this script's own consumer in `verify-seedling-bot-differential.mjs`,
# which stages it through a local `driverWsl` binding rather than inline.)
#
# ⛓⛓⛓ WHAT THE RACE IS (12f, §43.7). `Bot.botStart` ends with
# `FP.world = new Game(bootLevel, bootX, bootY)` (`Bot.as:1731`), which only
# writes `FP._goto`: FlashPunk applies the swap in `Engine.checkWorld()` at the
# END of the next `Engine.update()` (`Engine.as:77`). `Main.update()` calls
# `Bot.update()` ABOVE `super.update()` (`Main.as:62-67`), so exactly ONE
# `Bot.update()` runs against the OUTGOING world before the swap lands — the
# `BOOT_PRESWAP_FRAMES = 1` law (`r7Acceptance.js:652`, measured with a
# negative control).
#
# ⛓ WHETHER THAT PRE-SWAP FRAME IS RECORDED IS DECIDED AT `Bot.as:2877`:
#
#     if (game.blackCover > 0 || Game.freezeObjects) { deadFrames++; ...; return; }
#
# with `game = FP.world as Game` — the OUTGOING world. The observation is
# pushed at `Bot.as:2910`, BELOW that gate. So the pre-swap frame is DROPPED
# (and counted DEAD) while the page's own boot world is still covered, and
# RECORDED once that world's fade has finished. 12f measured both sides on one
# box: a pre-boot idle <= 0.45 s dropped it (walkdiff 0/146, 41 dead), >= 0.5 s
# recorded it (146/146, 40 dead, t=0 reading the page's own boot position and
# the whole stream shifted by one tick, so every tape input lands a frame off
# and the walk dies in level 0).
#
# ⇒ every committed fixture, every latch and every ship-gate window rests on
# winning a wall-clock race that nothing had ever tested is won. This is that
# test. ⚖ 58: A GATE DETECTS A LOST RACE; IT DOES NOT REMOVE IT. The removal is
# a separate change, argued in §45.
#
# ── THE TWO SIGNALS ─────────────────────────────────────────────────────────
#
# (1) THE FIRST DRAINED TICK IS THE BOOT. `botStart` arms with `tick = 0` and
#     `Bot.update` RECORDS BEFORE IT ACTS (`Bot.as:2910` precedes the dispatch
#     loop), so the first observation is taken before any tape input exists: it
#     IS the boot state. ⚠ IN A DIFFERENT COORDINATE SPACE than the
#     declaration. A `boot` block is the `Game` CONSTRUCTOR's argument (the OEL
#     cell) and `Player.as:375` is `super(_x + Tile.w / 2, _y + Tile.h / 2)`,
#     so the observation is the declaration plus the constructor HALF-TILE.
#     Measured over the committed corpus at `54c242adf`: 149 of 149 fixtures
#     have `ticks[0] == {t: 0, level, x + 8, y + 8}`.
#
# ⛔⛔ AND THE `level` HALF OF THAT COMPARISON IS VACUOUS ON ITS OWN — DO NOT
#     "SIMPLIFY" THIS TO A LEVEL CHECK. `Game`'s constructor runs
#     `level = _level` (`Game.as:632`) and that setter writes the STATIC
#     `Main.level` (`Game.as:526-528`), so the level is updated the instant
#     `new Game(...)` is EVALUATED — synchronously, inside `botStart`, while
#     the swap is still only `FP._goto`. `Bot.update` then reads `Main.level`
#     for the observation while taking the position off the OUTGOING world's
#     player, so on the pre-swap frame the two halves of one observation come
#     from DIFFERENT WORLDS and the level half already names the world that has
#     not arrived. Every refusal slice 12g measured reads the tape's boot LEVEL
#     beside the page's boot POSITION — `t=0 reads L2 (88,136) vs declared boot
#     L2 (56,40)`. A gate on the level alone would have passed all of them.
#
# (2) THE DRAIN IS ONE LONGER THAN THE TAPE. `Bot.update` disarms at
#     `tick >= tickCount` AFTER recording that tick (`Bot.as:2963`), so a tape
#     of `tick_count` N drains N + 1 observations: the boot plus N driven
#     ticks. Structural, not incidental — and 149 of 149 fixtures agree.
#
# ⚠ SAID PLAINLY: the race as measured PRESERVES the length (146 either way),
# so signal (2) does not fire on it. It is here because a gate with one signal
# cannot tell "the stream is right" from "the one thing I look at is right",
# and because a shift that DID change the length would otherwise slip past
# signal (1) on any tape that boots where the page does. (m2) is the row that
# keeps it from being decorative.
#
# ── THE SKIP PATH, AND WHY IT IS CORRECT HERE ───────────────────────────────
#
# `botStart` skips `new Game` entirely when `bootLevel == Main.level &&
# atBootPosition()` (`Bot.as:1730`). No swap is pending, so there is no race,
# and the first drained tick equals the boot trivially — the gate PASSES, which
# is the right answer and not a hole. That is also the whole `--tapes` director
# path: chains are cut at level ARRIVALS precisely so a `boot` block can
# reproduce the tick, and all 18 committed chain boundaries have
# `previous-segment-end == next-boot + half-tile`. So the race lives at the
# FIRST window of a page and nowhere else.
#
# ⛔ ASCII ONLY in every string below: they are printed and raised on the
# WINDOWS console, which is cp1252, and a stray arrow raises
# UnicodeEncodeError — killing a run that had already succeeded.

# `Tile.w / 2` == `Tile.h / 2` == 8. The game's own constant is `Tile.w`, which
# `playerPhysicsV1.js:98` transcribes as `TILE = {w: 16, h: 16}`; this is the
# driver's side of the same number, and `seedlingSwapGate.test.js` asserts the
# two agree rather than letting a second spelling drift.
CONSTRUCTOR_HALF_TILE = 8

RACE_LOST = "WORLD_SWAP_RACE_LOST"
LENGTH_UNEXPECTED = "DRAIN_LENGTH_UNEXPECTED"
UNVERIFIABLE = "WORLD_SWAP_GATE_UNVERIFIABLE"
ARM_TOO_LATE = "WORLD_SWAP_ARM_TOO_LATE"

# ── R9 slice 12g-prime (SS46): THE DRIVER-SIDE ARM BOUND, OFF BY DEFAULT ─────
#
# SS45.5's third option, and the ONE guard that survives on a box whose setup
# is slower than the one 12g measured. It is NOT a fix and cannot make a late
# arm win: it converts a silently-shifted recording into a refusal BEFORE the
# GPU time is spent, where the gate below refuses AFTER the drain.
#
# Both numbers are derived, and both are cited rather than typed:
#
#   GAME_TIME_AT_BOOT - `Main.time`'s unset value is `Game.dayLength / 2`
#     (`Main.as:158`), and `dayLength` is `160 * Main.FPS` (`Game.as:459`) with
#     `Main.FPS = 60`. So a fresh page reads 4800 and every increment after
#     that is one `Game.update()` (`Game.as:846`, BELOW the `blackCover` gate
#     but outside it) - i.e. `game_time - 4800` is a FRAME COUNT for the
#     page's own boot world.
#
#   ARM_BOUND_MAX_FRAME - 12g's measured cut, not a margin someone chose:
#     19 wins at arm frame <= 18 and 8 losses at >= 19 over 27 drives, with no
#     overlap anywhere (SS45.3). `dead_frames` 41/40 tracked it without an
#     exception.
#
# ⚠ WHAT THE READ COSTS, AND WHY THE DEFAULT IS OFF. The bound needs a
# `botStatus` call on window 0's DEFAULT path, milliseconds before the arm, and
# SS43.5's standing lesson is that the instrument perturbs what it measures: the
# call spends some of the ~15-frame margin in order to protect the rest. ⛓ And
# the existing `before = bot_json(...)` read is NO help - it is gated on
# `wi > 0`, i.e. it happens at exactly the windows where the race cannot
# happen (every director boundary takes the skip path) and is absent at the one
# window where it can.
#
# ⛓ MEASURED COST: EXACTLY ONE GAME FRAME, 4 of 4 (R9 slice 12g-prime). The
# clean form is to let BOTH pre-botStart reads happen back to back -
# `--preboot-delay-sec 1.0 --arm-bound` prints ARM_STATE then ARM_BOUND - so
# the difference between them IS one `botStatus` call, with no self-reference:
# 4830/31, 4829/30, 4828/29, 4832/33. ⛔ `arm.armed_at` CANNOT be used for this
# on a tape that declares `seam.time`: `botStart` writes `Main.time = seamTime`
# BEFORE the world swap, so the arm frame and the pre-botStart reading sit on
# two different clock origins.
#
# ⛓ ON A BUILD THAT ARMS AFTER THE SWAP THIS BOUND IS SKIPPED, NOT SATISFIED,
# and the build says which it is: `seedling_bot_ap_p4c` carries `arm` in
# botStatus. ⚠ That branch is not a tidy-up - it is a DEFECT this slice's own
# measurement found. Without it the bound refused p4c 4/4 at 1.0 s idle while
# the same build without the flag passed 3/3 at the same arm frames, because
# the outgoing world's frame count is not an input to a build that waits for
# the swap. The bound remains the real guard on older builds, where it refuses
# BEFORE the GPU time is spent rather than after the drain.
GAME_TIME_AT_BOOT = 4800
ARM_BOUND_MAX_FRAME = 18


def expected_boot_observation(boot):
    """The `{level, x, y}` the first drained tick must carry, or None.

    None means the tape cannot be checked at all — which the caller surfaces as
    a REFUSAL and never as a pass (`tapeFormat.js:1757` makes a well-formed
    `boot` mandatory, so this is a cannot-happen, reported as one).
    """
    if not isinstance(boot, dict):
        return None
    for key in ("level", "x", "y"):
        value = boot.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
    return {
        "level": boot["level"],
        "x": boot["x"] + CONSTRUCTOR_HALF_TILE,
        "y": boot["y"] + CONSTRUCTOR_HALF_TILE,
    }


def check_drain(label, boot, tick_count, ticks):
    """Refuse a drained window BY NAME, or return None.

    `label` names the window, `boot` is the tape's declared block, `tick_count`
    is the tape's own — read back off `botStatus`, so it is the number the GAME
    loaded rather than the one the caller believes it sent — and `ticks` is the
    drained observation list.
    """
    expected = expected_boot_observation(boot)
    if expected is None:
        return (f"{UNVERIFIABLE}: {label} declares no usable boot block "
                f"({boot!r}), so the first drained tick cannot be checked "
                "against anything")
    if not ticks:
        return (f"{UNVERIFIABLE}: {label} drained NO ticks, so there is no t=0 "
                "to compare with the declared boot")

    first = ticks[0]
    if (first.get("level") != expected["level"]
            or first.get("x") != expected["x"]
            or first.get("y") != expected["y"]):
        return (f"{RACE_LOST}: t=0 reads L{first.get('level')} "
                f"({first.get('x')},{first.get('y')}) vs declared boot "
                f"L{expected['level']} ({expected['x']},{expected['y']}) "
                f"[{label}; the declaration is L{boot['level']} "
                f"({boot['x']},{boot['y']}) plus the constructor half-tile]. "
                "botStart's world swap lands one Engine.update() after the "
                "call (Bot.as:1731, Engine.as:77) and the pre-swap frame was "
                "RECORDED instead of counted dead (Bot.as:2877), so the whole "
                "stream is shifted by one tick and every tape input lands a "
                "frame off.")

    if isinstance(tick_count, int) and not isinstance(tick_count, bool):
        expected_len = tick_count + 1
        if len(ticks) != expected_len:
            return (f"{LENGTH_UNEXPECTED}: {label} drained {len(ticks)} ticks, "
                    f"expected {expected_len} (tick_count {tick_count} plus the "
                    "one boot observation Bot.update records before it acts; it "
                    "disarms at tick >= tickCount AFTER recording, Bot.as:2963)")
    return None


def evaluate_bot(page, name, arg=None):
    """Call one of the game's ExternalInterface bot callbacks."""
    return page.evaluate(
        """([n, a]) => {
            const g = window.__swfBridge && window.__swfBridge.game;
            if (!g || typeof g[n] !== 'function') return null;
            return a === undefined || a === null ? g[n]() : g[n](a);
        }""",
        [name, arg],
    )


def bot_json(page, name, arg=None):
    raw = evaluate_bot(page, name, arg)
    if raw is None:
        # The page shim maps "" to null, so a callback must never return the
        # empty string — treat null as a real failure, not an empty result.
        raise RuntimeError(f"bot.{name} returned null")
    return json.loads(raw)


def wait_for(desc, fn, deadline_sec, poll_sec=0.25):
    start = time.time()
    polls = 0
    while True:
        v = fn()
        if v:
            return v
        polls += 1
        if time.time() - start > deadline_sec:
            raise TimeoutError(
                f"timeout waiting for {desc}: {polls} polls in "
                f"{time.time() - start:.1f}s"
            )
        time.sleep(poll_sec)


def main():
    # Resolved by the WINDOWS interpreter (py.exe -3.12), not the Linux one —
    # a missing-import warning from a Linux type checker here is expected.
    # ⛔ INSIDE `main()` on purpose; see the note beside the imports.
    from playwright.sync_api import sync_playwright  # type: ignore[import-not-found]

    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--tape", help="Windows path to ONE tape JSON")
    ap.add_argument("--tapes", help="Windows path to a JSON ARRAY of tapes, run in "
                                    "order ON ONE PAGE (R5's director)")
    ap.add_argument("--out", required=True, help="Windows path for the stream JSON")
    ap.add_argument("--deadline-sec", type=float, default=600.0)
    ap.add_argument("--progress", help="Windows path for a live progress sidecar")
    ap.add_argument("--mobiles", action="store_true",
                    help="sample botMobiles on every poll and emit the trace "
                         "(R7 slice 6 — diagnosis only; OFF by default because the "
                         "block is KBs and the poll runs 4x/sec)")
    ap.add_argument("--dead-curve", action="store_true",
                    help="record the (tick, dead_frames) CURVE — one row per change, "
                         "polled as fast as the bridge allows (R9 slice 12e‴). OFF by "
                         "default and it makes the poll TIGHT, so it is a diagnosis "
                         "instrument and never a path a producer takes. The frame "
                         "sequence is unaffected: probe-seedling-deadframes measured the "
                         "fade count identical across a ~50x frame-rate difference, so "
                         "the recompiled runtime is frame-clocked and a slower wall "
                         "clock changes nothing it counts.")
    ap.add_argument("--rng-curve",
                    help="Windows path for the (tick, Rng.state) CURVE sidecar - "
                         "one row per CHANGE, polled as fast as the bridge allows "
                         "(R9 slice 12f). OFF by default; it makes the poll TIGHT "
                         "exactly like --dead-curve, so it is a diagnosis "
                         "instrument and never a path a producer takes. ITS OWN "
                         "FILE rather than a key in --out, so the 121 committed "
                         "fixtures' three-key contract is untouched even when the "
                         "flag is on. The state is the raw 31-bit LFSR register "
                         "(SWFModernRuntime avm2_number.c rng_state), so a "
                         "consumer can convert each sample to an ABSOLUTE DRAW "
                         "INDEX offline - see rngRuler.js.")
    ap.add_argument("--preboot-delay-sec", type=float, default=0.0,
                    help="seconds to idle AFTER the bot callbacks are up and "
                         "BEFORE the first botLoadTape (R9 slice 12f). The page's "
                         "own boot builds `new Game(0, 80, 128)` (Main.as:51) and "
                         "that world runs on the WALL CLOCK until botStart, so "
                         "how long it idled is a real input to any state botStart "
                         "does not reset - the REAL Sfx mixer's open channels "
                         "among them. 0.0 is the historical behaviour and is "
                         "byte-inert.")
    ap.add_argument("--arm-bound", action="store_true", default=False,
                    help="R9 slice 12g-prime (kickoff SS46, SS45.5's third "
                         "option): REFUSE to arm window 0 when the page's own "
                         "boot world has already run past the fade, instead of "
                         "discovering it after the drain. OFF BY DEFAULT and "
                         "the default is load-bearing - see ARM_BOUND_MAX_FRAME "
                         "for what the read costs and why the build named "
                         "seedling_bot_ap_p4c makes this belt-and-braces "
                         "rather than the guard.")
    ap.add_argument("--headed", action="store_true", default=True)
    args = ap.parse_args()

    # ── R5: ONE PAGE, N TAPES ────────────────────────────────────────────
    # The director's whole shape. `botReset` forgets the tape but cannot
    # rewind the GAME, which is why every fixture gets a fresh page — and it
    # is exactly why the director does NOT: the live game state IS window
    # k+1's inheritance, and re-booting between windows would throw away the
    # thing being inherited. `botStart` already skips its own re-boot when
    # the tape's `boot` names the current level and `atBootPosition()` holds
    # (`Bot.as:706-708`), so a window boundary at a level ARRIVAL costs no
    # frames at all.
    #
    # ⚠⚠ AND A WINDOW AFTER THE FIRST MAY DECLARE `persistence` CLEARS ONLY IF
    # THEY ARE EXACTLY THE ONES THE LIVE WORLD ALREADY HOLDS.
    # `botStart`'s clear path is not additive: when `persistLevel.length > 0`
    # it first sets EVERY tag in EVERY level back to `true` and only then
    # applies the declared list (`Bot.as:690-705`). A second window carrying a
    # clear the live world does NOT hold would therefore WIPE flags the player
    # earned in the windows before it — every pickup's own `removed()` write,
    # every kill-lock open. A list that EQUALS the live set makes the whole
    # reset-then-apply a no-op on the ledger, which is why a chain of solver
    # segments — each of which declares the latch it inherits — is legal here.
    #
    # ⛓⛓⛓ R9 SLICE 6 — SO THE GUARD MOVED FROM PRE-FLIGHT TO THE BOUNDARY, and
    # it got STRICTER rather than looser. The old rule ("declare nothing")
    # refused the true-start campaign chain, whose every window after the first
    # declares the set it inherits; it also could not catch a window declaring
    # the WRONG non-empty set, because it never compared anything. The new rule
    # reads `persistence_cleared` off the live game immediately before
    # `botLoadTape` and refuses BY NAME on any difference — the same equality
    # `director.continuationAdmission` asserts on the page, one process over.
    # ⛔ v9 TIMED rows are excluded from the comparison and refused if the live
    # world already holds one: a timed row is the walk's OWN clear (⚖ ruling
    # 14's timed-row rule) and callers project them out before they get here.
    if bool(args.tape) == bool(args.tapes):
        raise SystemExit("pass exactly one of --tape or --tapes")
    release_codes = []
    if args.tapes:
        with open(args.tapes, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
        # ⛔ `{tapes, releaseKeyCodes}` rather than a bare array, and the
        # second field is not decoration. A tape whose last span runs to
        # `tick_count` leaves that key HELD when the tape ends — R1..R4 never
        # saw it because every fixture got a fresh page, and FlashPunk's
        # `Input` is a static nothing on a teleport path clears. Between two
        # windows the game keeps ticking, so a held key walks the player off
        # the boundary before the next window is armed. The codes come from
        # `tapeFormat.KEY_CODES` so the key table still has ONE implementation.
        tapes = payload["tapes"] if isinstance(payload, dict) else payload
        release_codes = payload.get("releaseKeyCodes", []) if isinstance(payload, dict) else []
        if not isinstance(tapes, list) or not tapes:
            raise SystemExit("--tapes must be a non-empty JSON array (or {tapes: [...]})")
    else:
        with open(args.tape, "r", encoding="utf-8") as fh:
            tapes = [json.load(fh)]

    with sync_playwright() as p:
        # Headed on the real Windows desktop: this is the whole point — a real
        # GPU adapter rather than SwiftShader.
        browser = p.chromium.launch(
            headless=False,
            args=["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
        )
        page = browser.new_page()
        logs = []
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        try:
            page.goto(args.url, wait_until="domcontentloaded")
            wait_for("runtime ready",
                     lambda: page.evaluate("() => !!window.__runtimeReady"), 180)
            # A real click supplies the user gesture the page requires
            # (WebGPU init + AudioContext consume the activation).
            page.click("#btn-start")
            wait_for("bot callbacks",
                     lambda: page.evaluate(
                         "() => !!(window.__swfBridge && window.__swfBridge.game"
                         " && window.__swfBridge.game.botStatus)"), 180)
            # ⛓ R9 slice 12g: the instant the page's own boot world became
            # reachable. Everything between here and `botStart` is wall clock
            # the OUTGOING world spends fading, and the world-swap race is
            # decided by how many of its frames have gone by (`Bot.as:2877`).
            # Recorded unconditionally because it is a `time.time()` and costs
            # nothing; only ever PRINTED under `--preboot-delay-sec`.
            ready_at = time.time()

            adapter = page.evaluate(
                """async () => {
                    if (!navigator.gpu) return 'no navigator.gpu';
                    try {
                        const a = await navigator.gpu.requestAdapter();
                        if (!a) return 'no adapter';
                        const i = a.info || (a.requestAdapterInfo
                            ? await a.requestAdapterInfo() : null);
                        return i ? `${i.vendor || '?'} / ${i.architecture
                            || i.description || '?'}` : 'adapter (no info)';
                    } catch (e) { return 'adapter error: ' + e.message; }
                }"""
            )
            # Printed so a run that silently fell back to software rendering is
            # visible in the log rather than just mysteriously slow.
            print(f"WEBGPU_ADAPTER: {adapter}", flush=True)

            # ⛓ R9 SLICE 12f: THE PRE-BOOT IDLE, MADE AN ARGUMENT.
            # Everything above this line has already spent an unmeasured
            # amount of WALL CLOCK in the page's own level-0 world, and
            # `botStart` resets the RNG, the tick, the save arrays and the
            # persistence ledger but NOT the real `Sfx` mixer's open
            # channels. `Music.soundIsPlaying` reads those channels
            # whenever the tape does not declare the `sound` pin
            # (`Music.as:823/832`), and `Music.playSound(set, -1)` redraws
            # while the last-played sound matches - so which channels were
            # still open at `botStart` decides a DRAW COUNT. Making the
            # idle an argument turns that from an uncontrolled input into
            # a measured one. Default 0.0 => the historical path.
            if args.preboot_delay_sec > 0:
                print(f"PREBOOT_DELAY {args.preboot_delay_sec:.1f}s", flush=True)
                page.wait_for_timeout(int(args.preboot_delay_sec * 1000))

            windows = []
            for wi, tape in enumerate(tapes):
                label = tape.get("name") or f"window {wi}"
                if len(tapes) > 1:
                    print(f"WINDOW {wi}: {label}", flush=True)
                # The state the PREVIOUS window ended in, read before this one
                # is armed. `botStart` zeroes `tick`, `dead_frames`, `grants`
                # and `equips`, so a boundary assert has to sample first —
                # and it compares window k+1's boot state to window k's DRAINED
                # END STATE, never to the plan.
                if wi > 0 and release_codes:
                    # Release every key on the same hardware path the bot
                    # dispatches on — `Input.enable()` registers its listeners
                    # on `FP.stage`, so a KeyboardEvent there is exactly what
                    # the game would see from a real keyboard. This is what a
                    # fresh page did implicitly for every fixture before now.
                    page.evaluate(
                        """(codes) => {
                            // The runtime's own key delivery ends at
                            // `avm2_dispatch_event`, the same place a real
                            // keyboard's does, so a DOM keyup is the hardware
                            // path. Fired at every plausible target because
                            // which one the emscripten build registers on is
                            // a build detail, and an extra event on a target
                            // nobody listens to is inert.
                            const targets = [document, window,
                                document.querySelector('canvas')].filter(Boolean);
                            for (const c of codes) {
                                for (const t of targets) {
                                    t.dispatchEvent(new KeyboardEvent('keyup',
                                        {keyCode: c, which: c, bubbles: true,
                                         cancelable: true}));
                                }
                            }
                        }""", release_codes)
                    # Let the release land and the player come to rest before
                    # the boundary is sampled: friction is subtractive and the
                    # whole coast from walk speed is under 2 px.
                    page.wait_for_timeout(400)
                before = bot_json(page, "botStatus") if wi > 0 else None
                if wi > 0:
                    # ⛔ THE BOUNDARY GUARD (see the --tapes note above). ASCII
                    # only in anything printed or raised here: the Windows
                    # console is cp1252.
                    rows = tape.get("persistence") or []
                    latch = {f"{r['level']}:{r['tag']}"
                             for r in rows if r.get("at") is None}
                    timed = {f"{r['level']}:{r['tag']}"
                             for r in rows if r.get("at") is not None}
                    held = {f"{r['level']}:{r['tag']}"
                            for r in (before.get("persistence_cleared") or [])}
                    if latch != held:
                        raise RuntimeError(
                            f"window {wi} ({label}) declares a persistence set that is "
                            f"NOT the live world's: declared [{','.join(sorted(latch))}] "
                            f"vs live [{','.join(sorted(held))}]. botStart resets EVERY "
                            "flag in EVERY level before applying the declared list, so "
                            "handing this over would erase what the earlier windows "
                            "earned.")
                    if timed & held:
                        raise RuntimeError(
                            f"window {wi} ({label}) declares a TIMED clear the live world "
                            f"ALREADY holds: [{','.join(sorted(timed & held))}]. A timed "
                            "row is the walk's own clear; handing it over would open the "
                            "lock before the walk that opens it.")
                loaded = evaluate_bot(page, "botLoadTape", json.dumps(tape))
                if loaded != "ok":
                    raise RuntimeError(f"{label}: botLoadTape: {loaded}")
                # ⛓⛓ R9 slice 12g: THE FADE EDGE, IN THE GAME'S OWN UNITS.
                # "idle 0.47 s" is a fact about THIS box; "botStart at frame N
                # of the outgoing world" is not, and N is what a later
                # driver-side bound would have to assert on. `Game.time` is
                # `Main.time`, incremented once per `Game.update()` BELOW the
                # `blackCover` gate but outside it (`Game.as:832`), so it is a
                # frame counter for the world that is fading. Read here, at the
                # last instant before the arm.
                #
                # ⛔ ONLY UNDER `--preboot-delay-sec`, and that is what keeps
                # this byte-inert: the extra bridge call costs milliseconds
                # BEFORE the arm, which pushes the race toward the losing side
                # (§43.5's lesson — the instrument perturbs what it measures).
                # No producer passes the flag, so no producer takes this path.
                # The control is 12f's own boundary: if the sweep still breaks
                # between 0.45 s and 0.5 s with the readout on, the readout is
                # inert to the thing being measured.
                if args.preboot_delay_sec > 0:
                    arm = bot_json(page, "botStatus")
                    print(f"ARM_STATE window={wi} game_time={arm.get('game_time')} "
                          f"level={arm.get('level')} x={arm.get('x')} "
                          f"y={arm.get('y')} "
                          f"since_ready={time.time() - ready_at:.2f}s",
                          flush=True)
                # ── R9 slice 12g-prime (SS46): THE ARM BOUND, IF ASKED ────
                # OFF by default; see ARM_BOUND_MAX_FRAME for the two derived
                # numbers and for what this read costs. Window 0 only - the
                # race lives at the first window of a page and nowhere else
                # (SS45.2), so paying the read at a boundary would be spending
                # the margin to guard a path that has none to lose.
                if args.arm_bound and wi == 0:
                    bound = bot_json(page, "botStatus")
                    frame = bound.get("game_time", GAME_TIME_AT_BOOT) - GAME_TIME_AT_BOOT
                    # ⛔⛔ THE BUILD DECIDES WHETHER THIS BOUND MEANS ANYTHING,
                    # AND IT SAYS SO ITSELF. A build that arms after the swap
                    # has landed carries `arm: {pending, armed_at}` in
                    # botStatus; on such a build the OUTGOING world's frame
                    # count is simply not an input to anything, and refusing on
                    # it is a FALSE REFUSAL of a drive that would have passed.
                    #
                    # ⚠ MEASURED, AND IT IS WHY THIS BRANCH EXISTS. Without it,
                    # `--arm-bound` refused seedling_bot_ap_p4c 4/4 at 1.0 s of
                    # pre-boot idle (frames 29-33) while the SAME build without
                    # the flag passed 3/3 at the same frames (arm frames 28, 33,
                    # 31). The first version of this docblock asserted "on p4c
                    # the arm waits for the swap and this cannot fire" - a true
                    # sentence about the BUILD attached to code that had no way
                    # to know which build it was driving. The capability is read
                    # off the readout now instead of assumed, and it costs
                    # nothing: the status block is already in hand.
                    if isinstance(bound.get("arm"), dict):
                        print(f"ARM_BOUND window={wi} frame={frame} SKIPPED "
                              "(this build arms after the world swap has landed; "
                              "the outgoing world's frame count is not an input)",
                              flush=True)
                    elif frame > ARM_BOUND_MAX_FRAME:
                        raise RuntimeError(
                            f"{ARM_TOO_LATE}: {label}: the page's own boot world has run "
                            f"{frame} frame(s) (game_time {bound.get('game_time')} - "
                            f"{GAME_TIME_AT_BOOT}), past the measured cut of "
                            f"{ARM_BOUND_MAX_FRAME}. On a build that arms beside the world "
                            "swap the tape's first tick would be recorded off the OUTGOING "
                            "world; refusing here spends no GPU time on a recording that "
                            "cannot be trusted. A build whose botStatus carries `arm` arms "
                            "AFTER the swap lands and is skipped above rather than judged "
                            "here.")
                started = evaluate_bot(page, "botStart")
                if started != "ok":
                    raise RuntimeError(f"{label}: botStart: {started}")
                after = bot_json(page, "botStatus")
                # ⛓ R9 slice 12g-prime: the arm frame, FROM THE GAME, when the
                # build carries it. `arm.armed_at` is `Game.time` on the frame
                # the tape armed (`Bot.as` botStatus), so `armed_at -
                # GAME_TIME_AT_BOOT` is the arm frame with no extra bridge call
                # and no perturbation - which is what makes ARM_BOUND's own cost
                # measurable at all. Absent on older builds; printed only when
                # present, so a build without it is silent rather than wrong.
                arm_readout = after.get("arm")
                if isinstance(arm_readout, dict):
                    print(f"ARM window={wi} pending={arm_readout.get('pending')} "
                          f"armed_at={arm_readout.get('armed_at')} "
                          f"frame={arm_readout.get('armed_at', GAME_TIME_AT_BOOT) - GAME_TIME_AT_BOOT}",
                          flush=True)
                # ⛔ REPORTED, NOT RAISED — and the first run of the bridge is
                # why. `botStart` re-boots only when the tape's boot block does
                # not name the current world's CONSTRUCTION args, and whether
                # it did is a fact about the boundary the caller has to weigh,
                # not an error the driver can rule on: R4's frozen segments end
                # with a key still HELD (`r4-walk-1-sword` runs `up` to 591..641
                # against `tick_count` 641), so the player drifts between two
                # windows and only a re-boot puts the stream back on the
                # recording. R5's own windows will be authored to end AT REST,
                # where no re-boot is needed. Both facts belong in the trace.
                moved = (after.get("x") != before.get("x")
                         or after.get("y") != before.get("y")) if before else False
                windows.append({"label": label, "before": before, "after_start": after,
                                "moved_at_boundary": moved})
                if moved:
                    # ⚠ ASCII ONLY in anything this driver prints: the Windows
                    # console is cp1252 and a stray arrow raises
                    # UnicodeEncodeError, which kills the run and reports as a
                    # replay failure two levels up.
                    print(f"WINDOW {wi}: boundary moved - L{before.get('level')} "
                          f"({before.get('x')},{before.get('y')}) -> L{after.get('level')} "
                          f"({after.get('x')},{after.get('y')})", flush=True)

                t0 = time.time()
                mobiles = []
                # ⛓ R9 slice 12e‴: the (tick, dead_frames) curve. One row per
                # CHANGE, so a 200-frame ceremony is ~2 rows and a walk is one
                # row per tick — kilobytes, not megabytes, and only when asked.
                dead_curve = []
                dead_last = [None]
                # ⛓ R9 slice 12f: the (tick, Rng.state) curve. Read off the
                # SAME `botStatus` block the dead curve reads, so it costs no
                # extra bridge call - `botStatus` already carries `rng.state`
                # (`Bot.as:2027`).
                rng_curve = []
                rng_last = [None]
                # ⚠ A LIVE PROGRESS SIDECAR, because stdout is not one. The
                # caller runs this with `execFileSync` and a pipe, so nothing
                # printed here is visible until the process exits — and an R1
                # walk is ~15k ticks, ten minutes of it. Without this file the
                # only two states a caller can observe are "still running" and
                # "done", which makes a stalled game (a freeze, a dialogue the
                # tape cannot dismiss) indistinguishable from a slow one for the
                # whole deadline. The file is rewritten in place every second.
                last_written = [0.0]

                def note_progress():
                    status = bot_json(page, "botStatus")
                    now = time.time()
                    # ── R7 slice 6: THE MOBILE TRACE, opt-in ─────────────
                    #
                    # ⛔ OFF BY DEFAULT AND THAT IS LOAD-BEARING. `botMobiles`
                    # is a few KB per sample and this poll runs four times a
                    # second; an R1 walk is ten minutes, so an always-on trace
                    # would be tens of megabytes on every tape the
                    # differential replays. No existing caller passes the flag
                    # and the output key is ABSENT (not null) without it, so
                    # the 121-fixture contract is untouched.
                    #
                    # ⚠ It is a SAMPLE, not a tick log — the poll is wall-clock
                    # and the game is frame-clocked, so `t` on each row is the
                    # tick the sample was taken at and consecutive rows are ~7
                    # ticks apart. That is a diagnosis instrument for choreo-
                    # graphy (where did the enemy go), never a measurement.
                    if args.mobiles:
                        try:
                            mobiles.append(bot_json(page, "botMobiles"))
                        except RuntimeError:
                            pass  # a build without the callback traces nothing
                    if args.dead_curve:
                        # ⛔ ON CHANGE, not on poll: the poll is wall-clock and
                        # the game is frame-clocked, so a row per poll would be
                        # a dozen duplicates per frame and would say nothing the
                        # edge does not.
                        pair = (status.get("tick"), status.get("dead_frames"))
                        if pair != dead_last[0]:
                            dead_curve.append({"tick": pair[0], "dead": pair[1],
                                               "level": status.get("level")})
                            dead_last[0] = pair

                    if args.rng_curve:
                        # ⛔ ON CHANGE of the PAIR, not on poll. The tick moves
                        # without the stream moving (most frames draw nothing)
                        # and the stream moves within one tick (a level build
                        # is three draws per Tile), so keying on either alone
                        # would lose the other's edges.
                        rpair = (status.get("tick"),
                                 (status.get("rng") or {}).get("state"))
                        if rpair != rng_last[0]:
                            rng_curve.append({
                                "tick": rpair[0], "state": rpair[1],
                                "cosmetic": (status.get("rng") or {})
                                            .get("cosmetic_state"),
                                "dead": status.get("dead_frames"),
                                "level": status.get("level"),
                                "game_time": status.get("game_time"),
                            })
                            rng_last[0] = rpair

                    if args.progress and now - last_written[0] >= 1.0:
                        last_written[0] = now
                        with open(args.progress, "w", encoding="utf-8") as fh:
                            # The WHOLE status, not a chosen subset: a stalled
                            # tape is diagnosed from the fields nobody thought to
                            # forward (cutscene, menu, receive_input,
                            # saw_auto_advance), and collecting them in a second
                            # run costs another ten minutes.
                            json.dump({**status, "elapsed": round(now - t0, 1)}, fh)
                    return status if status.get("finished") else None

                status = wait_for("tape to finish", note_progress, args.deadline_sec,
                                  poll_sec=0.0 if (args.dead_curve or args.rng_curve)
                                  else 0.25)
                elapsed = time.time() - t0
                drained = bot_json(page, "botDrain")
                ticks = drained.get("ticks", [])
                fps = (len(ticks) + status.get("dead_frames", 0)) / max(elapsed, 1e-9)
                print(f"REPLAY_OK ticks={len(ticks)} "
                      f"dead_frames={status.get('dead_frames')} "
                      f"seconds={elapsed:.1f} frames_per_sec={fps:.2f}", flush=True)

                # ⛓⛓⛓ R9 slice 12g: THE WORLD-SWAP GATE FIRES HERE (⚖ 58) —
                # after the drain and BEFORE this window is kept, so a lost
                # race can never reach `--out`. `tick_count` comes off
                # `botStatus`, i.e. what the GAME loaded, not what this
                # process believes it sent.
                #
                # ⛔ REFUSAL IS A RAISE, AND `--out` IS NEVER WRITTEN — not
                # even as a sidecar. The file is written after the whole loop,
                # so the raise skips it; the consumers all delete `--out`
                # before a run and every one of them re-raises with this
                # driver's stdout attached (`verify-seedling-bot-differential
                # .mjs:647`, `run-seedling-director.mjs:135`,
                # `derive-seedling-tick0.mjs:256`,
                # `rerecord-seedling-campaign.mjs:906/1267`), so the refusal
                # arrives NAMED rather than as "no stream". A sidecar would be
                # a second thing to read and a second thing to forget.
                refusal = check_drain(label, tape.get("boot"),
                                      status.get("tick_count"), ticks)
                if refusal:
                    raise RuntimeError(refusal)

                # ⛓ R7 slice 1: THE SEAM LATCH, drained like the stream.
                #
                # ⚠ ITS OWN CALLBACK rather than a field on `botStatus`, on
                # `botMobiles`' precedent: the block carries a 3,480-flag
                # array's cleared set and a sixteen-slot seal array, and
                # `botStatus` is polled once a second on the update/render
                # thread whose RATIO the dead-frame band rides on. Read ONCE,
                # here, after the tape has finished.
                #
                # ⚠ A build without the callback returns None, and that is
                # carried rather than raised: the harness on the other side
                # decides whether a missing latch is a failure (it is), and a
                # driver that threw here would lose the stream it already has.
                raw_seam = evaluate_bot(page, "botSeam")
                seam = json.loads(raw_seam) if raw_seam else None

                windows[-1].update({
                    "stream": {"ticks": ticks,
                               "transitions": drained.get("transitions", [])},
                    "status": status,
                    "seam": seam,
                })
                if args.dead_curve:
                    dead_curve.append({"tick": status.get("tick"),
                                       "dead": status.get("dead_frames"),
                                       "level": status.get("level"), "final": True})
                    windows[-1]["dead_curve"] = dead_curve
                if args.rng_curve:
                    # ⚠ The final row is taken from the SAME status block the
                    # `seam` is read beside, so `curve[-1].state` must equal
                    # `seam["rng.gameplay"]` of this drive. That equality is
                    # the instrument's own control: a curve that does not end
                    # where the latch ended is reading a different generator.
                    rng_curve.append({"tick": status.get("tick"),
                                      "state": (status.get("rng") or {}).get("state"),
                                      "cosmetic": (status.get("rng") or {})
                                                  .get("cosmetic_state"),
                                      "dead": status.get("dead_frames"),
                                      "level": status.get("level"),
                                      "game_time": status.get("game_time"),
                                      "final": True})
                    windows[-1]["rng_curve"] = rng_curve
                if args.mobiles:
                    # The last sample is taken AFTER the tape finished, so the
                    # trace always ends on the state the status block describes.
                    try:
                        mobiles.append(bot_json(page, "botMobiles"))
                    except RuntimeError:
                        pass
                    windows[-1]["mobiles"] = mobiles

            # ⚠ THE SHAPE OF `--out` IS THE SINGLE-TAPE SHAPE FOR ONE TAPE,
            # unchanged, so all 57 committed fixtures keep the same contract
            # and the harness needs no version branch. `--tapes` writes the
            # list, which is a different question and gets a different key.
            # ⛓ R9 slice 12f: THE CURVE GOES TO ITS OWN FILE. `--out`'s
            # shape is the 121 committed fixtures' contract; a diagnosis
            # instrument does not get to widen it, even behind a flag.
            if args.rng_curve:
                with open(args.rng_curve, "w", encoding="utf-8") as fh:
                    json.dump({"windows": [{"label": w["label"],
                                            "curve": w.get("rng_curve") or []}
                                           for w in windows]}, fh)
            with open(args.out, "w", encoding="utf-8") as fh:
                if args.tape:
                    w = windows[0]
                    one = {"stream": w["stream"], "status": w["status"],
                           "seam": w.get("seam")}
                    # ⚠ ABSENT, not null, when the flag is off — the 121
                    # committed fixtures' contract is "these three keys".
                    if args.mobiles:
                        one["mobiles"] = w.get("mobiles")
                    if args.dead_curve:
                        one["dead_curve"] = w.get("dead_curve")
                    json.dump(one, fh)
                else:
                    json.dump({"windows": [
                        {"label": w["label"], "stream": w["stream"],
                         "status": w["status"], "seam": w.get("seam"),
                         "boundary_before": w["before"],
                         "boundary_after_start": w["after_start"],
                         "moved_at_boundary": w["moved_at_boundary"],
                         **({"mobiles": w.get("mobiles")} if args.mobiles else {}),
                         **({"dead_curve": w.get("dead_curve")} if args.dead_curve
                            else {})}
                        for w in windows]}, fh)
        except Exception as exc:  # noqa: BLE001 — report and fail loudly
            print(f"REPLAY_FAIL {type(exc).__name__}: {exc}", flush=True)
            print("PAGE LOGS (last 25):", flush=True)
            for line in logs[-25:]:
                print("  " + line, flush=True)
            return 1
        finally:
            # ⛔ R9 §42.4: A THROW HERE COST A 63-TAPE SWEEP. `browser.close()`
            # can raise after a run that already SUCCEEDED and already wrote
            # `--out` - a closing page, a target that went away - and an
            # exception out of `finally` REPLACES the return value, so the
            # caller saw a crash where the stream was on disk. The close is
            # still attempted and its failure is still PRINTED, by name; it
            # just no longer decides the exit code of work that is done.
            try:
                browser.close()
            except Exception as exc:  # noqa: BLE001 - report, never re-raise
                print(f"BROWSER_CLOSE_FAILED {type(exc).__name__}: {exc}",
                      flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
