#!/usr/bin/env python3
"""Drive watch.html's ▶ load-in-wasm button on real-GPU Windows Chrome.

⛔ WSL'S OWN CHROMIUM IS SWIFTSHADER AND CANNOT ANSWER THIS QUESTION. The
recompiled game runs at ~0.5 ticks/s on a software rasteriser (measured twice
on record: `seedling-bot-replay-win.py`'s header, `probe-seedling-r5-mobiles.mjs`
:96) against ~18.6 ticks/s on the real-GPU rig. The headless half of
`check-seedling-wasm-pages.mjs` therefore stops at "the tape LOADED and the run
STARTED"; **this** driver is the only arm that can watch a ship reach `finished`
and read its END-STATE VERDICT, which is the one claim the slice exists for.

⛔ IT IS DELIBERATELY DUMB, on `seedling-level-set-win.py`'s precedent. It knows
nothing about stages, verdicts or level sets — it opens ONE page, presses what it
is told to press, waits for the JS expressions it is handed and reads back the
JS expressions it is handed. Every rule and every assertion stays in
`check-seedling-wasm-ship.mjs` on the Linux side, so the ship protocol has
exactly one implementation per side.

⛔ THE ONLY CLICK THAT MATTERS IS ▶ Start, AND IT IS INSIDE THE FRAME. The page
itself may never press it (the WebGPU renderer and the AudioContext consume the
user activation, and a parent-side click latches `started` and hides the button
without ever supplying one). A Playwright click IS a real input event with real
user activation, so a ROW may do what the page must not — the same licence
`verify-seedling-wasm-bridge.mjs` has always used.

Recipe: SWFRecomp-CC `tools/divergence/perf/WINDOWS_PLAYWRIGHT_FROM_WSL.md`
  1. Windows Python, never `python3`: `py.exe -3.12`.
  2. Windows paths only — this script and its JSON live in C:\\playwright\\.
  3. The page itself is served from WSL (`python3 -m http.server 8000`).

Usage:
  py.exe -3.12 <this> --plan C:\\playwright\\plan.json --out C:\\playwright\\out.json

Plan format:
  {"url": "http://localhost:8000/frontend/modules/seedlingDemo/watch.html?...",
   "steps": [{"wait": "<js returning truthy>", "sec": 120, "what": "the arm mounted"},
             {"click": "#loadWasm"},
             {"frame_click": "#btn-start", "frame": "/game.html"},
             {"read": "window.__watch", "as": "watch"}]}
"""

import argparse
import json
import sys
import time

# ⛔ THE WINDOWS CONSOLE IS cp1252 AND THIS SCRIPT PRINTS THE PAGE'S OWN WORDS.
# Measured: the first run died on `UnicodeEncodeError: 'charmap' codec can't
# encode character '\u25b6'` — the ▶ in a step label — BEFORE it had made a
# single claim, so five checks failed for a reason that had nothing to do with
# the page. Anything that forwards a UI's text has to say what encoding it is
# forwarding it in.

# Resolved by the WINDOWS interpreter (py.exe -3.12), not the Linux one — a
# missing-import warning from a Linux type checker here is expected.
from playwright.sync_api import sync_playwright  # type: ignore[import-not-found]


def _utf8_stdout():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:  # pragma: no cover — py<3.7
            pass


def wait_for(page, what, expression, deadline_sec, poll_sec=0.5, abort=None):
    """Poll a JS expression until it is truthy. Returns (seconds, aborted).

    ⛔⛔ R9 SLICE 7b — `abort` EXISTS BECAUSE A REFUSAL USED TO COST THE WHOLE
    DEADLINE. The CAMPAIGN arm waits on `reached.includes('boundary 14/15')`
    and then on a verdict. When the page REFUSES a boundary neither condition
    can ever become true, so the run sat on a dead page for its full 1878
    seconds and then reported `TimeoutError` — a sentence about the clock, with
    the page's own refusal (which was sitting in `__watch.wasm.refusal` within
    seconds) nowhere in it.

    ⇒ a step may name an `abort` expression. When it goes truthy the wait STOPS
    and says so, the caller records it, and every LATER wait is skipped so the
    plan's `read` steps still run against the stopped page. The refusal reaches
    the gate in seconds, by name, instead of a timeout half an hour later.
    """
    start = time.time()
    while True:
        try:
            if page.evaluate(f"() => ({expression})"):
                return round(time.time() - start, 1), False
            if abort and page.evaluate(f"() => ({abort})"):
                return round(time.time() - start, 1), True
        except Exception as exc:  # noqa: BLE001 — a page mid-navigation throws
            last = f"{type(exc).__name__}: {exc}"
            del last
        if time.time() - start > deadline_sec:
            raise TimeoutError(f"timeout after {deadline_sec}s waiting for {what}")
        time.sleep(poll_sec)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--deadline-sec", type=float, default=600.0)
    args = ap.parse_args()

    _utf8_stdout()
    with open(args.plan, "r", encoding="utf-8") as fh:
        plan = json.load(fh)

    record = {"steps": [], "console": [], "crashed": False, "reads": {},
              "bad_responses": [], "aborted": False, "finished": False}

    def flush():
        """⛔⛔ THE RECORD IS ON DISK AFTER EVERY STEP (R9 slice 7b).

        It used to be written ONCE, in the last three lines of `main`. So a run
        that was killed — or that a human stopped after watching it stall — left
        NOTHING, even when every `read` in the plan had already executed and was
        sitting in `record["reads"]`. The diagnostic run that measured the
        CAMPAIGN refusal did exactly that: it had the stage list, the refusal and
        all fifteen window records in memory at step 9 of 13, and the file did
        not exist.

        ⇒ every step flushes. A `kill` at any point leaves everything gathered so
        far, `finished` says whether the plan ran out, and the caller can tell a
        partial record from a complete one instead of guessing.
        """
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(record, fh)

    flush()
    with sync_playwright() as p:
        # Headed on the real Windows desktop: a real GPU adapter, not
        # SwiftShader. This is the whole reason this file exists.
        browser = p.chromium.launch(
            headless=False,
            args=["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
        )
        page = browser.new_page()
        page.on("console", lambda m: record["console"].append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: record["console"].append(f"[pageerror] {e}"))
        # ⛓ A NON-2xx WITH ITS URL. `[error] Failed to load resource: … 404` in
        # the console names no file, so a row reading it can only guess — and
        # the first run's 404 WAS a guess (headed Chrome asks for /favicon.ico;
        # headless does not). The URL turns it into a fact the row can filter
        # on by name instead of tolerating every 404 blindly.
        page.on("response", lambda r: (
            record["bad_responses"].append(f"{r.status} {r.url}")
            if r.status >= 400 else None))
        try:
            adapter = "unknown"
            page.goto(plan["url"], wait_until="domcontentloaded")
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
            print(f"WEBGPU_ADAPTER: {adapter}", flush=True)
            record["webgpu_adapter"] = adapter

            for i, step in enumerate(plan["steps"]):
                label = step.get("what") or json.dumps(step)[:80]
                print(f"STEP {i + 1}/{len(plan['steps'])}: {label}", flush=True)
                if "wait" in step:
                    # ⛓ Once a wait has ABORTED, every later wait is skipped —
                    # the page is not going to progress — but the plan's `read`
                    # steps still run, which is where the refusal is read from.
                    if record["aborted"]:
                        record["steps"].append({"step": i, "skipped": "after an abort",
                                                "what": label})
                        print(f"  SKIPPED (an earlier wait aborted)", flush=True)
                        flush()
                        continue
                    took, aborted = wait_for(page, label, step["wait"],
                                             step.get("sec", args.deadline_sec),
                                             abort=step.get("abort"))
                    record["steps"].append({"step": i, "waited_sec": took, "what": label,
                                            "aborted": aborted})
                    if aborted:
                        record["aborted"] = True
                        print(f"  ABORTED after {took}s — the page raised its abort "
                              f"condition: {step.get('abort')}", flush=True)
                elif "click" in step:
                    page.click(step["click"], timeout=step.get("sec", 60) * 1000)
                    record["steps"].append({"step": i, "clicked": step["click"]})
                elif "frame_click" in step:
                    # ⛔ THE REAL ▶ Start, INSIDE the game frame. Found by URL
                    # substring rather than by index: watch.html has exactly one
                    # iframe today and a row that assumed an ordering would be
                    # asserting about the DOM's shape instead of the game's.
                    needle = step.get("frame", "/game.html")
                    target = None
                    for f in page.frames:
                        if needle in f.url:
                            target = f
                    if target is None:
                        raise RuntimeError(f"no frame whose url contains {needle!r}; "
                                           f"frames: {[f.url for f in page.frames]}")
                    target.click(step["frame_click"], timeout=step.get("sec", 60) * 1000)
                    record["steps"].append({"step": i, "frame_clicked": step["frame_click"]})
                elif "read" in step:
                    value = page.evaluate(f"() => ({step['read']})")
                    record["reads"][step.get("as", f"read{i}")] = value
                    record["steps"].append({"step": i, "read": step.get("as", f"read{i}")})
                elif "sleep_ms" in step:
                    time.sleep(step["sleep_ms"] / 1000.0)
                    record["steps"].append({"step": i, "sleep_ms": step["sleep_ms"]})
                else:
                    raise RuntimeError(f"step {i} names no action: {step!r}")
                flush()
            record["finished"] = True
        except Exception as exc:  # noqa: BLE001 — a dead arm is a RESULT here
            record["crashed"] = True
            record["error"] = f"{type(exc).__name__}: {exc}"
            flush()
            print(f"SHIP_FAIL {record['error']}", flush=True)
            print("PAGE LOGS (last 25):", flush=True)
            for line in record["console"][-25:]:
                print(f"  {line}", flush=True)
        finally:
            try:
                page.close()
            except Exception:  # noqa: BLE001
                pass
            browser.close()

    flush()
    print(f"WROTE {args.out}", flush=True)


if __name__ == "__main__":
    main()
