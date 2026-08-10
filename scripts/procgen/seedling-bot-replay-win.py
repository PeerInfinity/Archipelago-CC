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

# Resolved by the WINDOWS interpreter (py.exe -3.12), not the Linux one —
# a missing-import warning from a Linux type checker here is expected.
from playwright.sync_api import sync_playwright  # type: ignore[import-not-found]


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
    # ⚠⚠ AND A WINDOW AFTER THE FIRST MUST DECLARE NO `persistence` CLEARS.
    # `botStart`'s clear path is not additive: when `persistLevel.length > 0`
    # it first sets EVERY tag in EVERY level back to `true` and only then
    # applies the declared list (`Bot.as:690-705`). A second window carrying
    # even one clear would therefore WIPE every flag the player earned in the
    # windows before it — every pickup's own `removed()` write, every
    # kill-lock open. The empty list is load-bearing, not tidiness, and the
    # boundary assert on `persistence_cleared` is what catches a breach.
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
        for i, t in enumerate(tapes[1:], start=1):
            if t.get("persistence"):
                raise SystemExit(
                    f"window {i} ({t.get('name')}) declares persistence clears; "
                    "botStart would reset EVERY flag in EVERY level first and "
                    "erase what the earlier windows earned")
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
                loaded = evaluate_bot(page, "botLoadTape", json.dumps(tape))
                if loaded != "ok":
                    raise RuntimeError(f"{label}: botLoadTape: {loaded}")
                started = evaluate_bot(page, "botStart")
                if started != "ok":
                    raise RuntimeError(f"{label}: botStart: {started}")
                after = bot_json(page, "botStatus")
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

                status = wait_for("tape to finish", note_progress, args.deadline_sec)
                elapsed = time.time() - t0
                drained = bot_json(page, "botDrain")
                ticks = drained.get("ticks", [])
                fps = (len(ticks) + status.get("dead_frames", 0)) / max(elapsed, 1e-9)
                print(f"REPLAY_OK ticks={len(ticks)} "
                      f"dead_frames={status.get('dead_frames')} "
                      f"seconds={elapsed:.1f} frames_per_sec={fps:.2f}", flush=True)

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
            with open(args.out, "w", encoding="utf-8") as fh:
                if args.tape:
                    w = windows[0]
                    one = {"stream": w["stream"], "status": w["status"],
                           "seam": w.get("seam")}
                    # ⚠ ABSENT, not null, when the flag is off — the 121
                    # committed fixtures' contract is "these three keys".
                    if args.mobiles:
                        one["mobiles"] = w.get("mobiles")
                    json.dump(one, fh)
                else:
                    json.dump({"windows": [
                        {"label": w["label"], "stream": w["stream"],
                         "status": w["status"], "seam": w.get("seam"),
                         "boundary_before": w["before"],
                         "boundary_after_start": w["after_start"],
                         "moved_at_boundary": w["moved_at_boundary"],
                         **({"mobiles": w.get("mobiles")} if args.mobiles else {})}
                        for w in windows]}, fh)
        except Exception as exc:  # noqa: BLE001 — report and fail loudly
            print(f"REPLAY_FAIL {type(exc).__name__}: {exc}", flush=True)
            print("PAGE LOGS (last 25):", flush=True)
            for line in logs[-25:]:
                print("  " + line, flush=True)
            return 1
        finally:
            browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
