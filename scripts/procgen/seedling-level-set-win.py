#!/usr/bin/env python3
"""Drive level-set deliveries into the Seedling wasm on real-GPU Windows Chrome.

⛔ WSL'S OWN CHROMIUM IS SWIFTSHADER AND MUST NOT BE USED HERE. Measured on this
box while writing this: the recompiled game takes TWO bot steps in five seconds
under headless WSL Playwright (~0.4 fps), against the ~3.6 fps the real-GPU rig
reports. Anything that waits for the world to be built — which every arm of the
level-set probe does — is then waiting on a software rasteriser, and any
comparison of what a room BUILT becomes a race against machine load rather than
a fact. (`probe-seedling-r5-mobiles.mjs` recorded the same ~0.5 fps.)

Same split, and the same recipe, as `seedling-bot-replay-win.py`: this script is
deliberately DUMB. It knows nothing about level sets, chunk envelopes or
verdicts — it opens a fresh page per ARM, makes the calls it is handed in order,
and writes what each returned. Every rule and every assertion stays in
`probe-seedling-level-set-transport.mjs` on the Linux side, so the delivery
protocol still has exactly one implementation per side.

⛔ ONE ARM = ONE FRESH PAGE, and that is load-bearing rather than tidy. The build
has no stack cookie (`checkStackCookie`/`writeStackCookie` absent, ASSERTIONS
off), so after a single abort the wasm throws `memory access out of bounds`,
`botStatus()` returns null, and every later reading in that page is fiction while
still looking like data (plan §8.1). An arm that kills its page is recorded as
`crashed` and the next arm starts a new one.

Recipe: SWFRecomp-CC `tools/divergence/perf/WINDOWS_PLAYWRIGHT_FROM_WSL.md`
  1. Windows Python, never `python3`: `py.exe -3.12`.
  2. Windows paths only — this script and its JSON live in C:\\playwright\\.
  3. The page itself is served from WSL (`python3 -m http.server 8000`).

Usage:
  py.exe -3.12 <this> --plan C:\\playwright\\plan.json
                      --out  C:\\playwright\\results.json

Plan format:
  {"url": "http://localhost:8000/...", "arms": [
      {"name": "...", "steps": [
          {"call": "botLoadLevels", "arg": "<json string>"},
          {"call": "botLevelSet"},
          {"sleep_ms": 2500},
          {"press": "2"}
      ]}]}
"""

import argparse
import json
import time

# Resolved by the WINDOWS interpreter (py.exe -3.12), not the Linux one — a
# missing-import warning from a Linux type checker here is expected.
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


def wait_for(desc, fn, deadline_sec, poll_sec=0.25):
    start = time.time()
    while True:
        if fn():
            return True
        if time.time() - start > deadline_sec:
            raise TimeoutError(f"timeout waiting for {desc} after {deadline_sec}s")
        time.sleep(poll_sec)


def run_arm(browser, url, arm, boot_deadline):
    """One arm on its own page. Returns the arm's record, never raises."""
    record = {"name": arm["name"], "results": [], "console": [], "crashed": False}
    page = browser.new_page()
    page.on("console", lambda m: record["console"].append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: record["console"].append(f"[pageerror] {e}"))
    try:
        started = time.time()
        page.goto(url, wait_until="domcontentloaded")
        wait_for("runtime ready",
                 lambda: page.evaluate("() => !!window.__runtimeReady"), boot_deadline)
        # A real click supplies the user gesture the page requires (WebGPU init
        # and the AudioContext both consume the activation).
        page.click("#btn-start")
        wait_for("bot callbacks",
                 lambda: page.evaluate(
                     "() => !!(window.__swfBridge && window.__swfBridge.game"
                     " && window.__swfBridge.game.botStatus)"), boot_deadline)
        record["boot_sec"] = round(time.time() - started, 2)

        for i, step in enumerate(arm["steps"]):
            if "sleep_ms" in step:
                time.sleep(step["sleep_ms"] / 1000.0)
                record["results"].append({"step": i, "sleep_ms": step["sleep_ms"]})
                continue
            if "press" in step:
                page.keyboard.press(step["press"])
                record["results"].append({"step": i, "press": step["press"]})
                continue
            value = evaluate_bot(page, step["call"], step.get("arg"))
            record["results"].append({"step": i, "call": step["call"], "value": value})
    except Exception as exc:  # noqa: BLE001 — an arm that dies is a RESULT here
        record["crashed"] = True
        record["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        try:
            page.close()
        except Exception:  # noqa: BLE001
            pass
    return record


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", required=True, help="Windows path to the plan JSON")
    ap.add_argument("--out", required=True, help="Windows path for the results JSON")
    ap.add_argument("--boot-deadline-sec", type=float, default=180.0)
    args = ap.parse_args()

    with open(args.plan, "r", encoding="utf-8") as fh:
        plan = json.load(fh)

    with sync_playwright() as p:
        # Headed on the real Windows desktop: a real GPU adapter, not
        # SwiftShader. This is the whole reason this file exists.
        browser = p.chromium.launch(
            headless=False,
            args=["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
        )
        arms = []
        try:
            probe = browser.new_page()
            probe.goto(plan["url"], wait_until="domcontentloaded")
            adapter = probe.evaluate(
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
            probe.close()
            # Printed so a run that silently fell back to software rendering is
            # visible in the log rather than just mysteriously slow.
            print(f"WEBGPU_ADAPTER: {adapter}", flush=True)

            for i, arm in enumerate(plan["arms"]):
                print(f"ARM {i + 1}/{len(plan['arms'])}: {arm['name']}", flush=True)
                rec = run_arm(browser, plan["url"], arm, args.boot_deadline_sec)
                if rec["crashed"]:
                    print(f"  CRASHED: {rec.get('error')}", flush=True)
                arms.append(rec)
        finally:
            browser.close()

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump({"webgpu_adapter": adapter, "arms": arms}, fh)
    print(f"WROTE {args.out}", flush=True)


if __name__ == "__main__":
    main()
