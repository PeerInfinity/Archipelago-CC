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
    ap.add_argument("--tape", required=True, help="Windows path to the tape JSON")
    ap.add_argument("--out", required=True, help="Windows path for the stream JSON")
    ap.add_argument("--deadline-sec", type=float, default=600.0)
    ap.add_argument("--progress", help="Windows path for a live progress sidecar")
    ap.add_argument("--headed", action="store_true", default=True)
    args = ap.parse_args()

    with open(args.tape, "r", encoding="utf-8") as fh:
        tape = json.load(fh)

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

            loaded = evaluate_bot(page, "botLoadTape", json.dumps(tape))
            if loaded != "ok":
                raise RuntimeError(f"botLoadTape: {loaded}")
            started = evaluate_bot(page, "botStart")
            if started != "ok":
                raise RuntimeError(f"botStart: {started}")

            t0 = time.time()
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

            with open(args.out, "w", encoding="utf-8") as fh:
                json.dump({"stream": {"ticks": ticks,
                                      "transitions": drained.get("transitions", [])},
                           "status": status}, fh)
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
