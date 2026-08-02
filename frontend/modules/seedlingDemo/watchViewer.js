/**
 * seedlingDemo/watchViewer — watch a tape replay, in the browser.
 *
 * ⚠ TOOLING ONLY. This page makes no claims, gates nothing, and nothing
 * that DOES make a claim may depend on it. The gates are vitest (JS stream
 * == the committed oracle recording) and
 * `scripts/procgen/verify-seedling-bot-differential.mjs` (the live game ==
 * those recordings); a viewer is a window onto the same run, not a third
 * opinion about it. Design: `CC/docs/plans/seedling-bot-watch-page.md`.
 *
 *   watch.html?tape=<repo-relative path>&side=js|wasm[&speed=N]
 *
 * `side=js`   steps `tapeRunner.createTapeStepper` on an animation-frame
 *             pacer and draws the level, the player and the model state the
 *             observation stream cannot carry. Works anywhere — it needs
 *             only the committed atlas and a committed tape.
 * `side=wasm` iframes the recompiled game and drives its own bot callbacks.
 *             Local-only BY NATURE: the wasm artifact is gitignored and
 *             there is no CI build in either repo.
 *
 * ⚠ IT RENDERS RAW TRUTH. No position smoothing, no interpolation between
 * ticks, no eliding of dead frames — they are counted and shown. The whole
 * value of watching a replay is seeing what the model actually did, and a
 * viewer that tidies it up is a viewer that hides the next divergence. The
 * terrain readout shows the RAW state and the EFFECTIVE one side by side
 * for the same reason: `noHazards` is exactly the difference between them.
 *
 * ⚠ AND IT DOES NOT OWN A TICK LOOP. `createTapeStepper` is the incremental
 * face of `runTape` — one loop, two faces, pinned in `tapeRunner.test.js`
 * by stepping every committed fixture to completion and comparing byte for
 * byte. A private loop here would be the verifier-shared-assumption trap in
 * tooling clothes.
 */

import { buildLevelWorld, RELAXED_ROLES, ROLES, TILE_SIZE } from './levelWorld.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { createTapeStepper } from './tapeRunner.js';
import { coerceTerrainState, HAZARD_STATES, ITEM_NAMES } from './tapeFormat.js';
import { playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
import { TILE_TYPE_NAMES } from '../flashPanel/seedlingSemantics.js';

/** Paths are resolved against the REPO ROOT — the dev server's cwd. */
const ATLAS_URL = '/frontend/modules/flashPanel/atlases/seedling-map.json';
const WASM_PAGE = '../flashPanel/wasm/seedling_bot_ap/game.html';

const PIT = HAZARD_STATES.pit;

/**
 * Tile colours by TYPE, not by tileset column — the column is a drawing
 * detail and the type is what the physics reads. Anything unlisted falls
 * back to a plain floor colour, which is honest: it walks at 0.8 like the
 * rest.
 */
const TILE_COLOURS = {
    1: '#1d4f7a',   // Water
    6: '#000000',   // Pit — the R1 transport primitive
    10: '#7a6a3a',  // Cliff Stairs
    16: '#4a3f3a',  // Igneous Stone
    17: '#8a2b12',  // Lava
    21: '#c8d6e0',  // Snow
    22: '#8fc7d8',  // Ice
    25: '#2f7fa8',  // Waterfall
    28: '#4b3a63',  // Ghost Tile
    29: '#6b4a2a',  // Bridge — solid until something spears it
    30: '#6a5a83',  // Ghost Tile Step
};
const SOLID_COLOUR = '#3a3a42';
const FLOOR_COLOUR = '#6b6152';

const $ = (id) => document.getElementById(id);
const fmt = (n) => (typeof n === 'number' ? Number(n.toFixed(4)) : n);

function readParams() {
    const q = new URLSearchParams(window.location.search);
    return {
        tape: q.get('tape'),
        side: (q.get('side') || 'js').toLowerCase(),
        speed: Number(q.get('speed') || 1),
    };
}

function fatal(message, detail = '') {
    $('status').className = 'bad';
    $('status').textContent = message;
    $('detail').textContent = detail;
}

async function fetchJson(url, what) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${what}: ${url} — HTTP ${res.status}`);
    return res.json();
}

// ── side=js ──────────────────────────────────────────────────────────────

/**
 * Everything the viewer draws, per level, cached the same way the runner
 * memoises worlds. Built with the census the TAPE implies, exactly as
 * `runTape` picks it — a viewer that consulted a different census could
 * refuse to draw a level the run happily walks through.
 */
function makeRenderer(canvas, tape) {
    const ctx = canvas.getContext('2d');
    const trail = [];
    let scale = 1;
    /**
     * Hazard shapes this renderer does not know how to draw.
     *
     * Collected rather than thrown: a viewer that cannot draw one volume
     * should still draw the level. Surfaced by the caller, so a fourth shape
     * is a line in the detail bar rather than a silently missing rectangle —
     * or, as it was before R4, a dead animation loop.
     */
    const unknownShapes = new Set();

    function fit(world) {
        const w = world.width * TILE_SIZE;
        const h = world.height * TILE_SIZE;
        scale = Math.max(1, Math.min(
            Math.floor((canvas.parentElement.clientWidth - 8) / w),
            Math.floor(560 / h),
        ));
        canvas.width = w * scale;
        canvas.height = h * scale;
    }

    const rect = (r, fill, alpha = 1) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        ctx.fillRect(r.x * scale, r.y * scale,
            (r.right - r.x) * scale, (r.bottom - r.y) * scale);
        ctx.globalAlpha = 1;
    };
    const outline = (r, stroke, width = 1) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.strokeRect(r.x * scale + 0.5, r.y * scale + 0.5,
            (r.right - r.x) * scale - 1, (r.bottom - r.y) * scale - 1);
    };

    return {
        reset() { trail.length = 0; },
        fit,
        draw(world, state, opts) {
            if (canvas.width !== world.width * TILE_SIZE * scale) fit(world);
            ctx.fillStyle = '#101014';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Tiles. A SOLID leaves the getState candidate list, so it is
            // drawn as a wall regardless of its type — that IS the fact the
            // resolver acts on.
            const solidRects = new Set(world.solids.map((s) => `${s.rect.x},${s.rect.y}`));
            for (const t of world.tiles) {
                const isSolid = solidRects.has(`${t.rect.x},${t.rect.y}`);
                rect(t.rect, isSolid ? SOLID_COLOUR : (TILE_COLOURS[t.t] ?? FLOOR_COLOUR));
            }
            // A HOLE is a cell with no tile at all — walkable, and the only
            // place the sticky resolver is observable. Left as background.

            // Object solids (buildings, statues, NPCs...) and pixelmasks.
            for (const s of world.objectSolids) rect(s.rect, '#55506a', 0.85);
            for (const p of world.pixelmasks) outline(p.rect, '#a06060');

            // Volumes. Teleporters and pits are TRANSPORT; the rest are
            // avoid volumes the planner routes around.
            for (const tp of world.teleporters) {
                if (tp.deactivated) continue;
                rect(tp.rect, '#2fa8a0', 0.35);
                outline(tp.rect, '#3fd8ce');
            }
            for (const t of world.tiles) {
                if (t.t === PIT) outline(t.rect, '#c04040', 2);
            }
            // ⚠ THREE SHAPES, and the third one arrived at R4 with a
            // `BossLock`. A hazard is a rect (`collide`), a disc
            // (`FP.distance < r`) or a LINE (`collideLine` over integer
            // probes) — and a `line` entry carries NEITHER `rect` NOR
            // `disc`, both null. This loop used to be `if (h.rect) ... else
            // <disc>`, which dereferenced `h.disc.x` on the first bosslock
            // it met and threw inside the rAF callback, killing the
            // animation with no message at all. Level 12 holds FIVE of them.
            //
            // The `default` arm is the lesson, not decoration: a fourth
            // shape should say so on the canvas rather than stop the clock.
            if (opts.volumes) {
                for (const p of world.pickups) rect(p.rect, '#d8c030', 0.4);
                for (const h of world.proximityHazards) {
                    if (h.rect) {
                        rect(h.rect, '#d05090', 0.35);
                    } else if (h.disc) {
                        ctx.strokeStyle = '#d05090';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(h.disc.x * scale, h.disc.y * scale, h.disc.r * scale, 0, 7);
                        ctx.stroke();
                    } else if (h.line) {
                        // The probes are the INTEGER points `[x0, x1]` on
                        // row `y`, so the drawn band is one pixel tall and
                        // `x1 + 1` wide — never a rect enclosing them, which
                        // is the over-approximation the census refuses.
                        rect({
                            x: h.line.x0, right: h.line.x1 + 1,
                            y: h.line.y, bottom: h.line.y + 1,
                        }, '#ff6fae', 0.9);
                    } else {
                        unknownShapes.add(`${h.tag}@${h.x},${h.y} (${h.kind})`);
                    }
                }
            }

            // The breadcrumb trail — raw sampled positions, one per tick,
            // never interpolated.
            //
            // ⚠ FILTERED TO THE LEVEL BEING DRAWN. Every level is its own
            // coordinate space (`Game.as:1854` rewrites FP.width/height on
            // each load), so a dot recorded at (296,168) in level 94 means
            // nothing at (296,168) in level 0 — carrying the trail across a
            // swap draws a path the player never walked. The points keep
            // their level rather than being cleared, so scrubbing BACK
            // across a crossing restores the old level's trail instead of
            // losing it.
            //
            // ⚠ The DRAW position is rounded to the device pixel. That is a
            // rasterisation detail, not smoothing: a 1x1 rect at a half-pixel
            // offset is anti-aliased across four pixels at ~25% alpha each,
            // which at scale 1 makes the whole trail nearly invisible over
            // the floor colour. The HUD still reports the exact doubles, and
            // nothing about the path itself is adjusted.
            const dot = Math.max(1, scale);
            ctx.fillStyle = '#7fe0ff';
            for (const p of trail) {
                if (p.level !== world.level) continue;
                ctx.fillRect(Math.round(p.x * scale) - (dot >> 1),
                    Math.round(p.y * scale) - (dot >> 1), dot, dot);
            }

            // The player: the collision box and, offset one pixel down, the
            // rect `getState` actually probes with.
            outline(terrainProbeRect(state.x, state.y), '#ffd75f');
            rect(playerBoxAt(state.x, state.y), '#ffffff', 0.9);
        },
        mark(state, level) { trail.push({ x: state.x, y: state.y, level }); },
        /** Shapes met that this renderer has no arm for; empty is the norm. */
        get unknownShapes() { return [...unknownShapes]; },
    };
}

async function runJs(params) {
    const atlas = await fetchJson(ATLAS_URL, 'atlas');
    const tape = await fetchJson(`/${params.tape.replace(/^\/+/, '')}`, 'tape');
    const levelSource = levelSourceFromAtlas(atlas);

    const canvas = $('canvas');
    const renderer = makeRenderer(canvas, tape);
    // The census the TAPE implies — the same rule `runTape` applies, so the
    // viewer can never refuse to draw a level the run walks through.
    const roles = tape.noclip === false ? ROLES : RELAXED_ROLES;
    // ⚠ AND THE TAPE'S CLEARS, for the same reason as the census: a viewer
    // that built a level the run does not have would draw locks the player
    // walks straight through. Grouped BY LEVEL because `buildLevelWorld`'s
    // orphan guard refuses a tag the level does not own — the same rule
    // `levelRun` follows, and the reason it groups too.
    const clearedByLevel = new Map();
    for (const c of tape.persistence ?? []) {
        if (!clearedByLevel.has(c.level)) clearedByLevel.set(c.level, []);
        clearedByLevel.get(c.level).push(c.tag);
    }
    const worlds = new Map();
    const worldFor = (n) => {
        if (!worlds.has(n)) {
            const cleared = clearedByLevel.get(n);
            worlds.set(n, buildLevelWorld(levelSource(n),
                cleared ? { roles, cleared } : { roles }));
        }
        return worlds.get(n);
    };

    let stepper = createTapeStepper(tape, { levelSource });
    let frames = [];           // every yielded step, so scrubbing is exact
    let cursor = 0;
    let playing = true;
    let speed = params.speed;
    let finished = null;

    // Collect eagerly: a tape is at most a few thousand ticks and the whole
    // point of scrubbing is that going BACK costs nothing. This is still the
    // one loop — every frame comes from the stepper.
    try {
        for (let r = stepper.next(); ; r = stepper.next()) {
            if (r.done) { finished = r.value; break; }
            frames.push(r.value);
        }
    } catch (e) {
        fatal('the run threw before finishing — the viewer shows what it got', e.message);
    }

    $('scrub').max = String(Math.max(0, frames.length - 1));
    $('status').className = 'ok';
    $('status').textContent = `${params.tape} — ${frames.length} observations`;

    const hud = () => {
        const f = frames[cursor];
        if (!f) return;
        const world = worldFor(f.observation.level);
        const raw = f.state.terrain ?? 0;
        const eff = coerceTerrainState(raw, tape.noHazards ?? []);
        const fall = f.state.fall;
        $('hud').innerHTML = [
            row('tick', `${f.observation.t} / ${tape.tick_count}`),
            row('level', `${f.observation.level} (${world.width}x${world.height})`),
            row('position', `${fmt(f.observation.x)}, ${fmt(f.observation.y)}`),
            row('velocity', `${fmt(f.state.vx)}, ${fmt(f.state.vy)}`),
            // BOTH values. `noHazards` is exactly their difference, and a
            // viewer that showed one would hide the whole relaxation.
            row('terrain raw', `${raw} ${TILE_TYPE_NAMES[raw] ?? ''}`),
            row('terrain effective', `${eff} ${TILE_TYPE_NAMES[eff] ?? ''}`,
                eff === raw ? '' : 'coerced'),
            row('held', [...f.held].join(' + ') || '—'),
            row('transport', fall
                ? `${fall.phase}${fall.phase === 'out' ? ` alpha ${fmt(fall.alpha)}`
                    : ` yStart ${fall.yStart}${fall.bounced ? ' (bounced)' : ''}`}`
                : '—', fall ? 'transport' : ''),
            row('transitions', f.transitions.length
                ? f.transitions.map((t) => `${t.from_level}→${t.to_level}@${t.t}`).join(' ')
                : '—'),
            row('grants', f.grants.length
                ? f.grants.map((g) => `L${g.level} ${g.items.join('+')}@${g.t}`).join(' ')
                : '—'),
            row('items', f.inventory
                ? (ITEM_NAMES.filter((n) => n !== 'health')
                    .filter((n) => f.inventory[itemProp(n)]).join(' ') || '—')
                    + `  hitsMax=${f.inventory.hitsMax}`
                : '—'),
        ].join('');
        renderer.draw(world, f.state, { volumes: $('volumes').checked });
    };

    const itemProp = (name) => {
        // The property behind an item name, without importing the table's
        // internals: the mirror is keyed by property.
        const map = {
            sword: 'hasSword', darksword: 'hasDarkSword', ghostsword: 'hasGhostSword',
            shield: 'hasShield', darkshield: 'hasDarkShield', wand: 'hasWand',
            firewand: 'hasFireWand', fire: 'hasFire', conch: 'canSwim',
            feather: 'hasFeather', spear: 'hasSpear', darksuit: 'hasDarkSuit',
            torch: 'hasTorch',
        };
        return map[name] ?? name;
    };
    const row = (k, v, cls = '') =>
        `<div class="r ${cls}"><span>${k}</span><b>${v}</b></div>`;

    function seek(i) {
        cursor = Math.max(0, Math.min(frames.length - 1, i));
        renderer.reset();
        for (let j = 0; j <= cursor; j++) renderer.mark(frames[j].state, frames[j].observation.level);
        $('scrub').value = String(cursor);
        hud();
    }

    let acc = 0;
    /**
     * ⚠ A THROW IN HERE USED TO STOP THE CLOCK AND SAY NOTHING.
     *
     * `requestAnimationFrame(frame)` is the LAST statement, so anything that
     * threw above it — a level whose geometry the renderer had no arm for,
     * say — skipped the re-arm and the animation simply froze mid-walk. No
     * status, no detail, no console line the page surfaced: indistinguishable
     * from a slow tape or a paused one.
     *
     * That is exactly how R4's third hazard shape presented: the viewer
     * stopped "near the beginning, when it entered level 12", which holds
     * FIVE bosslocks. So the re-arm is unconditional now and the failure is
     * REPORTED, once, with the tick it happened on — a viewer that cannot
     * draw a frame should say which one.
     */
    let frameError = null;
    function frame() {
        try {
            if (playing && frames.length) {
                acc += speed;
                while (acc >= 1 && cursor < frames.length - 1) {
                    cursor += 1;
                    acc -= 1;
                    renderer.mark(frames[cursor].state, frames[cursor].observation.level);
                }
                if (acc >= 1) acc = 0;
                if (cursor >= frames.length - 1) playing = false;
                $('scrub').value = String(cursor);
                hud();
            }
        } catch (e) {
            playing = false;
            if (!frameError) {
                frameError = e;
                const f = frames[cursor];
                fatal(`the viewer could not draw observation ${f?.observation.t} `
                    + `(level ${f?.observation.level}) — the RUN is unaffected, this is `
                    + 'the drawing side', `${e.message}\n${e.stack ?? ''}`);
            }
        }
        requestAnimationFrame(frame);
    }

    $('play').onclick = () => {
        if (cursor >= frames.length - 1) seek(0);
        playing = !playing;
        $('play').textContent = playing ? 'Pause' : 'Play';
    };
    $('scrub').oninput = (e) => { playing = false; $('play').textContent = 'Play'; seek(Number(e.target.value)); };
    $('speed').oninput = (e) => { speed = Number(e.target.value); $('speedv').textContent = `${speed}x`; };
    $('volumes').onchange = hud;
    $('speed').value = String(speed);
    $('speedv').textContent = `${speed}x`;

    seek(0);
    requestAnimationFrame(frame);

    if (finished) {
        // ⚠ NAMED, NOT SILENT: a hazard shape this renderer has no arm for
        // draws nothing, and "nothing drawn" and "no volume there" look
        // identical on a canvas.
        const unknown = renderer.unknownShapes;
        $('detail').textContent = `finished: ${finished.transitions.length} transition(s), `
            + `${finished.transports.length} pit transport(s), `
            + `${finished.grants.length} grant(s)`
            + (unknown.length
                ? `  ⚠ ${unknown.length} volume(s) NOT DRAWN — no renderer arm for their `
                + `shape: ${unknown.join(', ')}`
                : '');
    }
}

// ── side=wasm ────────────────────────────────────────────────────────────

/**
 * Drive the recompiled game in an iframe.
 *
 * Same origin, so `frame.contentWindow.__swfBridge.game.*` is reachable
 * from here — which is what lets this page add nothing to the gitignored
 * deploy artifact. ZERO changes there, ZERO AS3.
 *
 * ⚠ ONE REAL CLICK IS REQUIRED before starting. The runtime wants user
 * activation, and the existing Playwright driver clicks `#btn-start` for
 * exactly this reason; a page that tried to autostart would hang with no
 * visible cause.
 */
async function runWasm(params) {
    const tape = await fetchJson(`/${params.tape.replace(/^\/+/, '')}`, 'tape');

    // Say WHICH path is missing rather than showing a blank frame — the
    // artifact is gitignored and machine-local, so "nothing happened" is the
    // expected experience on a fresh checkout.
    const probe = await fetch(WASM_PAGE, { method: 'HEAD' }).catch(() => null);
    if (!probe || !probe.ok) {
        fatal('the wasm build is not on this machine',
            `${WASM_PAGE} is missing (HTTP ${probe ? probe.status : 'unreachable'}). `
            + 'It is gitignored and built locally — see '
            + '~/CC/seedling_bot_build/build_bot.sh. Use &side=js meanwhile.');
        return;
    }

    const frame = $('frame');
    frame.src = WASM_PAGE;
    frame.style.display = 'block';
    $('canvas').style.display = 'none';
    $('status').textContent = 'loading the runtime…';

    const win = () => frame.contentWindow;
    const bot = (name, arg) => {
        const g = win() && win().__swfBridge && win().__swfBridge.game;
        if (!g || typeof g[name] !== 'function') return null;
        return arg === undefined ? g[name]() : g[name](arg);
    };
    const botJson = (name, arg) => {
        const raw = bot(name, arg);
        try { return raw ? JSON.parse(raw) : null; } catch { return null; }
    };
    const until = (what, pred, ms = 180000) => new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => {
            let v = null;
            try { v = pred(); } catch { v = null; }
            if (v) return resolve(v);
            if (Date.now() - t0 > ms) return reject(new Error(`timed out waiting for ${what}`));
            return setTimeout(tick, 200);
        };
        tick();
    });

    await until('__runtimeReady', () => win() && win().__runtimeReady);

    // ⚠⚠ THE PARENT MUST NOT START THE GAME. NOT EVEN AS A FALLBACK.
    //
    // The frame's start path is
    //     __swfBridgeStart = function () {
    //         if (started || !__runtimeReady) return false;
    //         started = true;
    //         btn.style.display = 'none';
    //         Module.ccall('runSWF', ...);
    //     }
    // and its own comment says it "MUST run within a user-gesture handler in
    // this document (WebGPU renderer init + AudioContext consume the
    // activation)".
    //
    // A first cut here called `btn.click()` from the parent as a harmless-
    // looking convenience. It is not harmless: it LATCHES `started = true`
    // and HIDES the button, so `runSWF` is invoked with no user activation
    // (the renderer never comes up, `game.botStatus` never appears) AND the
    // user's real click is now impossible — the button is gone and the latch
    // refuses a second start. It burns the one chance it was trying to save.
    // The symptom is maximally unhelpful: `__swfBridge.game` exists, so the
    // shim looks fine, and the wait just spins.
    //
    // So the parent does exactly nothing here except ask, and poll.
    $('play').style.display = 'none';
    $('status').textContent = 'runtime ready — press ▶ Start inside the frame below. '
        + 'One REAL click: the renderer and the audio context consume the user '
        + 'activation, and nothing this page can do substitutes for it.';

    try {
        await until('the game\'s bot callbacks (press Start in the frame)',
            () => bot('botStatus') !== null);
    } catch (e) {
        fatal('the tape never started', `${e.message}. The frame is up but the SWF `
            + 'has not begun, which is what a missed Start looks like.');
        return;
    }

    try {
        const loaded = bot('botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        const started = bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
    } catch (e) {
        fatal('could not start the tape', e.message);
        return;
    }
    $('status').className = 'ok';
    $('status').textContent = `${params.tape} — running in the real game`;
    poll();

    // A function DECLARATION, not a const arrow: `poll()` is called above
    // this line and a `const` would be in its temporal dead zone. Caught by
    // the real-GPU Windows run, which is the only place the wasm path gets
    // far enough to execute it.
    function row(k, v) { return `<div class="r"><span>${k}</span><b>${v}</b></div>`; }
    function poll() {
        const st = botJson('botStatus');
        if (st) {
            const pct = Math.round(100 * (st.tick ?? 0) / Math.max(1, tape.tick_count));
            $('bar').style.width = `${pct}%`;
            const items = st.items || {};
            $('hud').innerHTML = [
                row('tick', `${st.tick ?? '?'} / ${tape.tick_count}`),
                row('level', st.level ?? '?'),
                row('position', `${fmt(st.x)}, ${fmt(st.y)}`),
                // Shown, not elided: the fade frames are real frames the
                // tick counter skips, and how many there were is a fact
                // about the run.
                row('dead frames', st.dead_frames ?? 0),
                row('receive input', String(st.receive_input)),
                row('saw input refused', String(st.saw_input_refused)),
                row('auto advance', st.saw_auto_advance ?? 0),
                row('grants', (st.grants || [])
                    .map((g) => `L${g.level} ${(g.items || []).join('+')}@${g.t}`).join(' ') || '—'),
                row('items', Object.entries(items)
                    .filter(([k, v]) => v === true && k !== 'hitsMax')
                    .map(([k]) => k).join(' ') || '—'),
                row('hitsMax', items.hitsMax ?? '?'),
                row('finished', String(st.finished)),
            ].join('');
            if (st.finished) {
                $('status').textContent += ' — finished';
                return;
            }
        }
        setTimeout(poll, 250);
    }
}

// ── entry ────────────────────────────────────────────────────────────────

/** Where to look for sibling tapes when no `?tape=` names a directory. */
const DEFAULT_TAPE_DIR = 'frontend/modules/seedlingDemo/fixtures/tapes';

/**
 * List the tapes next to the one being watched, and offer them.
 *
 * Read from the dev server's own DIRECTORY LISTING rather than from a
 * committed manifest, deliberately: slice 4 records segment tapes as it
 * goes, and a manifest would be stale between the recording and the
 * regeneration that noticed. The listing is the live truth, and if the
 * server does not emit one (a different static host) the picker says so and
 * the page still works from `?tape=` alone.
 *
 * The directory comes from the CURRENT tape's own path, so a roster kept
 * somewhere other than `fixtures/tapes/` lists its own siblings without a
 * second parameter.
 */
async function populatePicker(params) {
    const sel = $('tapes');
    const dir = params.tape
        ? params.tape.replace(/^\/+/, '').split('/').slice(0, -1).join('/')
        : DEFAULT_TAPE_DIR;
    let names = [];
    try {
        const res = await fetch(`/${dir}/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        names = [...html.matchAll(/href="([^"?/]+\.json)"/g)]
            .map((m) => decodeURIComponent(m[1]))
            .filter((n, i, a) => a.indexOf(n) === i)
            .sort();
    } catch (e) {
        sel.innerHTML = '<option>— no directory listing —</option>';
        sel.disabled = true;
        sel.title = `could not list /${dir}/: ${e.message}. The page still works `
            + 'from ?tape= directly.';
        return;
    }

    // A one-line summary per tape, from the tape itself: what it boots into
    // and how long it runs are the two things you pick on.
    const summarise = async (n) => {
        try {
            const t = await (await fetch(`/${dir}/${n}`)).json();
            const relaxed = (t.noHazards || []);
            const pit = t.tape_version === 2 && !relaxed.includes('pit') ? ' pit-LIVE' : '';
            return `${n.replace(/\.json$/, '')} — L${t.boot?.level ?? '?'}, `
                + `${t.tick_count} ticks, v${t.tape_version}${pit}`;
        } catch { return n.replace(/\.json$/, ''); }
    };
    const labels = await Promise.all(names.map(summarise));

    sel.innerHTML = '';
    names.forEach((n, i) => {
        const o = document.createElement('option');
        o.value = `${dir}/${n}`;
        o.textContent = labels[i];
        if (o.value === (params.tape || '').replace(/^\/+/, '')) o.selected = true;
        sel.appendChild(o);
    });
    sel.disabled = false;
    // Load on select. A full navigation rather than an in-place swap: the
    // wasm side cannot rewind the GAME (`botReset` forgets the tape, not the
    // world — every tape needs a fresh page, which is the same rule the
    // recording harness follows), and reloading keeps both sides on one
    // code path instead of giving the JS side a teardown nobody tests.
    sel.onchange = () => {
        const q = new URLSearchParams(window.location.search);
        q.set('tape', sel.value);
        q.set('side', params.side);
        window.location.search = q.toString();
    };
}

export async function main() {
    const params = readParams();
    $('title').textContent = params.tape || '(no tape)';
    // The picker is populated even with no tape, so the page is a launcher
    // rather than an error when you arrive without one.
    const picking = populatePicker(params);
    if (!params.tape) {
        await picking;
        fatal('no ?tape= given — pick one above',
            'watch.html?tape=frontend/modules/seedlingDemo/fixtures/tapes/'
            + 'pit-fall-chain-85.json&side=js');
        return;
    }
    document.body.dataset.side = params.side;
    try {
        if (params.side === 'wasm') await runWasm(params);
        else await runJs(params);
    } catch (e) {
        fatal(`${params.side} side failed`, e.stack || e.message);
    }
}
