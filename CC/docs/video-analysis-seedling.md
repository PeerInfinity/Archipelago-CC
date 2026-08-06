# Video analysis as an independent verification stratum — Seedling crusher rooms

**Date:** 2026-08-06
**Source video:** "Seedling Walkthrough (Both Endings)" (`8P1rDkLVz4g`), 33:01, 720p30
**Scope:** the two crusher rooms at 12:46 and 13:25

This report has two halves. **Part A** is cross-project tooling knowledge — the
Gemini CLI retirement, the Antigravity migration, and a verified frame-extraction
pipeline. **Part B** is the Seedling analysis those tools produced.

The Seedling half is deliberately *not* filed with the procgen docs. Those are
the curated record of the shipped, verified system; this is an observational
stratum with a preserved confident/inferred split. Its value is not quantitative
— the bot model already has crusher positions to the pixel, verified by live
byte-exact differentials. Its value is that it **confirms mechanism from a
stratum that shares nothing with the model**: no source read, no transcription,
no shared derivation. Per-crusher triggering, lure-and-park, and rock-shielding
were all recovered from pure observation before the source was consulted.

---

# Part A — Tooling

## A1. Gemini CLI is dead for individuals

Google **stopped serving Gemini CLI requests for all individual accounts on
2026-06-18** — free tier, Google AI Pro, *and* Google AI Ultra.

**A paid subscription does not exempt you.** gemini-cli issue #28229 is titled
"OAuth login fails for Google AI Pro users." No version pin or re-login
recovers it. The failed attempt also **deletes `~/.gemini/oauth_creds.json`**,
so there is no cached-token grace period.

Surviving auth paths: API key, or Code Assist Standard/Enterprise. Google folded
Developer Program benefits into the AI subscriptions — **$10/mo Cloud credits on
Pro, $100/mo on Ultra**, usable for Gemini API calls — so an API key on the old
binary is partly funded by the existing subscription rather than a double charge.

## A2. Antigravity CLI (`agy`) — measured behaviour

Installed at `~/.local/bin/agy`, version **1.1.10**, via
`curl -fsSL https://antigravity.google/cli/install.sh | bash` (SHA512-verified,
no sudo).

| Finding | Status |
|---|---|
| Non-TTY stdout works; issue #76 does **not** reproduce on Linux | OK |
| **Piped stdin is IGNORED when `-p` is given** | silent wrong answer |
| **Single-argument cap = 131,072 bytes** (131,000 OK / 140,000 E2BIG) | hard limit |
| Agent reading the file itself: absolute path + `--add-dir` + `--dangerously-skip-permissions` | works, ~30s/call |
| Without `--add-dir` + absolute path → `NotFound` (file tools ignore shell cwd) | gotcha |
| **Exit code 0 is NOT a success signal** — auto-denied tool still exits 0, no output | gotcha |
| Without `--dangerously-skip-permissions`, any tool use is auto-denied | gotcha |

The stdin finding is the dangerous one. Piping `"The secret word is platypus."`
and asking for the secret word returned **`None`**; the same content inline in
`-p` returned **`platypus`**. Scripts using `subprocess.run(cmd, input=content)`
send the prompt with no content, get a confident fabrication, and exit 0.

**Quota structure.** Two independent pools (Gemini Flash+Pro; Claude+GPT-OSS),
each with a weekly *and* a 5-hour limit. Quota burns proportionally to token
cost, not per request. **The weekly limit is only ~1.8× the 5-hour limit** —
~8 tiny probes cost 1.19% of weekly and 2.16% of the 5-hour bucket. Two
maxed-out 5-hour windows exhaust the week; the 5-hour bar refilling is not
reassurance.

**Not yet migrated** off the dead binary: `~/nomic/play_turn.sh` (near drop-in)
and three hyperstition scripts that pipe stories on stdin (median 887 KB), which
need the file-read pattern plus `--json-schema`.

## A3. Frame-extraction pipeline

No sudo required:

```bash
python3 -m venv vidvenv
./vidvenv/bin/pip install yt-dlp imageio-ffmpeg Pillow
./vidvenv/bin/python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
```

- **Download:** DASH formats 403 on the default client.
  `--extractor-args "youtube:player_client=android_vr"` worked; `tv` gave a DRM
  error, `web_safari`/`ios` reported format unavailable.
- **Geometry:** capture is pillarboxed — 1280×720 with the real 720×720 game
  content centred → `crop=720:720:280:0`.
- **Room boundaries:** `blackdetect` scans every frame in one pass:
  ```bash
  ffmpeg -ss 740 -t 170 -copyts -i in.mp4 \
    -vf "crop=720:720:280:0,blackdetect=d=0.08:pic_th=0.97:pix_th=0.06" -an -f null -
  ```
  Naive "mean luma < threshold" does **not** work: this game sits at mean luma
  20–40 throughout, so any threshold catching fades catches everything.

### The extraction trap

```bash
# WRONG — timestamps silently shifted
ffmpeg -ss START -t DUR -i in.mp4 -vf "crop,fps=1,scale" out_%05d.png
# ...then computing time as START + index/fps
```

The fast seek feeds pre-roll frames into the filter graph, so `fps=` counts from
the keyframe, not from START. Its "766s" frame showed a different part of the
room **and a different HUD health state** than a direct seek to 766s.

```bash
# RIGHT — correct by construction, one seek per frame
ffmpeg -ss <exact_t> -i in.mp4 -frames:v 1 -vf "crop,scale" out.png
```

Fast seek is byte-identical to accurate seek for single frames and far faster —
accurate seek re-decodes from file start and blew a 5-minute budget on six frames.

**Three false diagnostics burned before finding it:**
1. `md5sum` on PNG **files** compares compression settings, not pixels.
2. Pixel-exact hashing is too strict when frames land ±1 video frame apart.
3. Mean-absolute-difference nearest-match is useless with a **colour-cycling
   light source** — correct matches scored 6–14, no better than wrong ones.

What settled it: **rendering the two frames side by side and looking**, using the
HUD health pips as an independent clock.

`sheet2.py` (session scratchpad) takes `START END STEP COLS ROWS TILE_PX TAG
[--gray] [--verify]`, extracts, labels, tiles, and self-verifies. ~111 frames in
~50s. Note the static ffmpeg build lacks `drawtext` — label with Pillow.

## A4. Two process lessons

**A wrong frame of reference is not fixable by sampling harder.** I built a
coherent and completely wrong model of "a dozen separate rooms" from footage of
*one large scrolling room*. Every refinement I made — finer sampling, grayscale,
difference metrics — operated inside the wrong reference frame and none could
have escaped it. It took an external correction.

**A capability limit can present as a reasoning failure.** Two Gemini attempts
returned "wildly inaccurate" reports. The cause is sampling rate, not reasoning:
Gemini samples video at ~1 fps, the camera scrolls far enough in one second that
consecutive samples look like unrelated rooms, and the decisive event in room 1
(rocks breaking, 769.95 → 770.05) **falls entirely between two 1 fps samples**.
I made the identical misreading from 1 fps contact sheets until I sampled finer.

---

# Part B — Seedling crusher rooms

## B1. Room boundaries (fade-detected, exact)

| Fade | Event |
|---|---|
| 766.30–766.40 | **enter crusher room 1 (L41)** — 12:46 |
| 803.33–803.50 | leave room 1 — **37s** |
| 805.40–805.53 | **enter crusher room 2** — 13:25 |
| 830.33–830.47 | leave room 2 — **25s** |

A ~2s corridor separates them. Health refills from 2 to 3 immediately after the
entry fade (766.6 → 767.1).

## B2. Mechanism — source-confirmed

These rules come from the game source and the shipped bot arc, not from the
video. They are recorded here because the video observations below were
independently consistent with every one of them.

- **Trigger is per-crusher.** Each crusher independently scans four 64 px
  directional bands with a **line-of-sight requirement — any Solid blocks it**.
- **Travel is until Solid contact, never a fixed distance.** `moveX`/`moveY`
  step 1 px at a time; velocity zeroes only on collision with a Solid.
- **A committed charge is never re-aimed and never released.** It continues to
  the wall regardless of the player. You cannot cancel a charge by breaking
  alignment — only by never triggering it, or by keeping a Solid between you
  and the crusher.
- **The switch is a button.** In L41 the tile the crusher settles on is
  `button@248,232`; `Button.update` counts `Solid` among its pressers, and a
  crusher is one. The pink-framed square below the crusher's start is
  `wandlock@240,96` — the door the button chain opens.
- This is the room's intended mechanism: the bot arc shipped it as a **three-bait
  choreography**, recorded byte-exact against the live game.

### Frame-level state oracle (new, and confirmed)

The video contributed one thing the model side did not have: a **visual predicate
for crusher state**.

> **Clean dashed outline = stationary. Rotated/distorted = charging.**

This is not a heuristic. The sprite's angle increments by **8°/frame while
velocity is nonzero** and snaps to 0 when stationary — so the visual cue is a
direct readout of `v.length > 0`.

## B3. Room 1 (L41) — observations

- The crusher starts top-right behind **two brown rocks stacked vertically**,
  immediately to its left.
- The player arrives from the left along a green-lit ledge at ~769.3.
- **The player breaks the rocks — the crusher does not.** Sword arcs at 769.55
  and 769.75; **upper rock gone by 769.95, lower by 770.05** (~0.1s apart), with
  green debris between.
- **The crusher launches within ~0.05s of the second rock clearing** — displaced
  left and visibly rotated by 770.10.

  This is the rock-shielding rule observed directly: the player stood in the
  crusher's row the whole time, and the rocks were the only thing suppressing
  the trigger. **Breaking them was the arming act.**
- Path: left along the upper ledge (770.1–772.6) → down the left side
  (774.85–775.85) → right along the bottom (776.6–778.35).
- The player drops to a lower level at ~771.1.
- By ~779 the crusher is off-screen. The remaining 779–803 is ordinary combat and
  traversal; the crusher never returns.

### ⚠ A corrected inference

I originally read the player's drop at ~771.1 as *ending the charge by leaving
the row*. **That is wrong.** A committed charge is never released; the crusher
was reaching an obstacle, and the timing with the player's drop is coincidence.

The distinction is load-bearing for anyone reasoning about dodging: **breaking
alignment does not cancel a charge.** The error is recorded rather than deleted
because the frames genuinely underdetermine it — two mechanisms predict the same
picture, and only the source separates them.

## B4. Room 2 — observations

- **Two crushers**, side by side at the top-left, both stationary (808.1–809.6).
- One is triggered and charges down-left by 810.6 **while the other stays put** —
  independent observational confirmation that triggering is per-crusher, not a
  room-wide event.
- Sustained movement 810–818 in separate legs (down, up, left, right).
- By 820.6–824.1 **both crushers are stationary again at different positions**
  than where they started — the lure-and-park pattern.
- The player exits south at ~830.

## B5. Status of the original open questions

| Question | Status |
|---|---|
| Is there a switch, and is it pressed? | **Closed** — `button@248,232`, pressed by the crusher as a `Solid` |
| What is the pink-framed square? | **Closed** — `wandlock@240,96`, the door the chain opens |
| Fixed travel distance or until obstacle? | **Closed** — until `Solid` contact, 1 px steps |
| Per-crusher or room-wide trigger? | **Closed** — per-crusher, four 64 px bands + line-of-sight |
| Does leaving the row cancel a charge? | **Closed — and my inference was wrong.** It does not |

**Declined deliberately:** converting screen positions to room coordinates via
camera-offset tracking. The model already has crusher positions to the pixel,
verified by live byte-exact differentials, so the video stratum cannot improve on
it quantitatively. Revisit only if video is ever wanted as a quantitative oracle
for something the model *cannot* see — e.g. render-layer bugs.

---

## Related

- Memory: `reference_antigravity_cli.md` — CLI retirement, `agy` gotchas, quota
- Memory: `feedback_ffmpeg_fps_filter_shifts_timestamps.md` — the extraction trap
- Bot arc topic file: `project_seedling_bot_r5.md` (model-side record)
