#!/usr/bin/env python3
"""Drive level-set deliveries into the Seedling wasm on real-GPU Windows Chrome.

⛔ WSL'S OWN CHROMIUM IS SWIFTSHADER AND MUST NOT BE USED HERE. The number is
already on record twice: `seedling-bot-replay-win.py`'s header measured ~0.5 fps
headless against the ~3.6 fps the real-GPU rig reports, and
`probe-seedling-r5-mobiles.mjs:96` says the same. Anything that waits for a
world to be built — which every arm of the level-set probe does — is then
waiting on a software rasteriser, and any comparison of what a room BUILT
becomes a race against machine load rather than a fact.

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
          {"press": "2"},
          {"eval": "async (a) => {...}", "arg": <json>, "label": "..."},
          {"click": "<css selector in the TOP document>"},
          {"frame_click": {"contains": "<substring of the frame url>",
                           "selector": "#btn-start"}},
          {"wait_js": "() => <boolean>", "deadline_sec": 60, "label": "...",
           "soft": true}   # soft: record the timeout and CONTINUE
      ]}]}

⛓⛓ **THE BOOT IS PER-ARM AND DECLARATIVE** (EDITOR INTEGRATION slice P1-e), and
it is additive for the same reason the `eval` step was: every existing caller
omits it and gets the behaviour this file always had.

    "boot": {"kind": "wasm-page"}   the default — `__runtimeReady`, click
                                    `#btn-start`, wait for `game.botStatus`
    "boot": {"kind": "app", "ready_js": "() => <boolean>",
             "settle_ms": 0}        just the page: poll `ready_js`, then run the
                                    steps. ⛔ The APP page has no
                                    `__runtimeReady` and no `#btn-start` of its
                                    own — the game is in an IFRAME the panel
                                    mounts, so pressing ▶ is a `frame_click`
                                    STEP rather than part of the boot, and when
                                    it happens is the caller's business.

Every rule and every verdict still lives on the Linux side; this file gained
four dumb verbs, not an opinion.
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


def frame_for(page, contains):
    """The first frame whose url contains `contains`, or None."""
    for fr in page.frames:
        if contains in (fr.url or ""):
            return fr
    return None


def run_arm(browser, url, arm, boot_deadline):
    """One arm on its own page. Returns the arm's record, never raises."""
    record = {"name": arm["name"], "results": [], "console": [], "crashed": False}
    page = browser.new_page()
    page.on("console", lambda m: record["console"].append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: record["console"].append(f"[pageerror] {e}"))
    boot = arm.get("boot") or {"kind": "wasm-page"}
    try:
        started = time.time()
        page.goto(arm.get("url") or url, wait_until="domcontentloaded")
        if boot.get("kind") == "app":
            # ⛔ NO `#btn-start` HERE. On the app page the game lives in an
            # iframe the panel mounts, so ▶ is a `frame_click` step and the
            # caller decides when it happens.
            wait_for("app ready", lambda: bool(page.evaluate(boot["ready_js"])),
                     boot.get("deadline_sec", boot_deadline))
            if boot.get("settle_ms"):
                time.sleep(boot["settle_ms"] / 1000.0)
        else:
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
            if "click" in step:
                page.click(step["click"], timeout=step.get("timeout_ms", 30000))
                record["results"].append({"step": i, "click": step["click"]})
                continue
            if "frame_click" in step:
                spec = step["frame_click"]
                # ⛓ A REAL CLICK INSIDE THE FRAME. The wasm page consumes the
                # user activation for WebGPU and the AudioContext, and an
                # activation granted to the parent document does not travel
                # into a child frame.
                #
                # ⛔⛔ PREFER `iframe`, A SELECTOR IN THE TOP DOCUMENT, over
                # `contains`, a match on `page.frames`. The frame list is a
                # SNAPSHOT of Playwright's bookkeeping: a host that mounts,
                # tears down and remounts its iframe — which the flash panel
                # does on every rules change — can leave a poll over that list
                # never matching while the element is plainly there and the
                # frame's own console lines are already in the log. A
                # `frame_locator` resolves lazily at click time and auto-waits
                # through re-attachment. `contains` stays for callers that have
                # no stable selector, and its failure now NAMES every frame url
                # it did see rather than only the one it wanted.
                if spec.get("iframe"):
                    page.frame_locator(spec["iframe"]).locator(
                        spec["selector"]).click(timeout=spec.get("timeout_ms", 180000))
                    record["results"].append({"step": i, "frame_click": spec["selector"],
                                              "via": spec["iframe"]})
                    continue
                t0 = time.time()
                fr = None
                while fr is None:
                    fr = frame_for(page, spec["contains"])
                    if fr is not None:
                        break
                    if time.time() - t0 > spec.get("deadline_sec", 120):
                        seen = [f.url for f in page.frames]
                        raise TimeoutError(
                            f"no frame whose url contains {spec['contains']!r}; saw {seen}")
                    time.sleep(0.25)
                fr.click(spec["selector"], timeout=spec.get("timeout_ms", 120000))
                record["results"].append({"step": i, "frame_click": spec["selector"],
                                          "frame_url": fr.url})
                continue
            if "wait_js" in step:
                # ⛓ `soft` — a wait that times out RECORDS the timeout and lets
                # the arm continue, so the observation step still runs and the
                # rows read a real page instead of an exception. A hard wait
                # that dies takes every later step's evidence with it, which is
                # exactly the diagnosis you need when it dies.
                t0 = time.time()
                timed_out = False
                try:
                    wait_for(step.get("label", "wait_js"),
                             lambda: bool(page.evaluate(step["wait_js"])),
                             step.get("deadline_sec", 120))
                except TimeoutError:
                    if not step.get("soft"):
                        raise
                    timed_out = True
                record["results"].append({"step": i, "eval": step.get("label", f"wait{i}"),
                                          "value": {"waited_sec": round(time.time() - t0, 2),
                                                    "timed_out": timed_out}})
                continue
            if "eval" in step:
                # ⛓ ADDITIVE, AND IT KEEPS THE SPLIT THIS FILE ARGUES FOR
                # (EDITOR INTEGRATION M1b). `{"call": …}` can only reach the
                # game's own bot verbs, and the AP placement rows also have to
                # import a host module into the page, drive a delivery and poll
                # `botStatus` to `finished`. The JS for all of that is AUTHORED
                # ON THE LINUX SIDE and arrives here as a string: this driver
                # still knows nothing about level sets, placements or verdicts,
                # which is the property the docstring is defending. Playwright
                # invokes a string expression that evaluates to a function with
                # `arg`, exactly as the node side does, so ONE source serves
                # both channels and they cannot drift.
                value = page.evaluate(step["eval"], step.get("arg"))
                record["results"].append(
                    {"step": i, "eval": step.get("label", str(i)), "value": value})
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
