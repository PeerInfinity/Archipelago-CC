/**
 * ⛓ SEEDLING IN THE PIPELINE T3 — **THE TWO ROOM-PLAY GATES' SHARED HANDS.**
 *
 * `check-seedling-spiral-room-play.mjs` (T2/T2b: a placed room as the spiral's
 * START region), `check-seedling-sphere-room-play.mjs` (T3: a placed room as
 * a sphere-growth LEAF behind a maze gate), and the generated-room gates
 * `check-seedling-generated-room-play.mjs` (G2) and
 * `check-seedling-generated-leaf-play.mjs` (G3) drive the same page the same way:
 * the same readouts of the game, the binding, the glue and the maze panel, and
 * the same key recipes. They live here ONCE; each gate keeps only its own
 * phases. Everything was measured on the box by the gate that first needed it
 * (T2 W0-3, T2b), and the notes stay with the helper.
 *
 * Nothing here takes the box or launches a browser: a gate hands in its page.
 */

/** Step off a door by at least a tile (T2's "held until, not held for"). */
export const STEP_OFF_PX = 16;
/** The ceiling on every held key. */
export const HOLD_CEILING_MS = 4000;

/**
 * ⛓ G2, shared at G3 — **A SAFE PATH THROUGH A GENERATED ROOM.** A shortest
 * path of cells in `payload`'s room from `from` to `to`, walking the room's own
 * flood (`walkableCellsFrom`, every solid live) with every door a wall except
 * `to` itself, and every HAZARD a wall — water and lava (lethal without the
 * conch / the dark suit) and pits, read off the room's own collision world
 * (`buildLevelWorld`). ⛔ MEASURED (G2): a first version walked a pit cell and
 * the game respawned the player at the checkpoint mid-walk. `null` when there is
 * none. The two readers are handed in (`seedlingDemo/levelSetExits.js`,
 * `seedlingDemo/levelWorld.js`), so importing these hands loads no game module.
 */
export function roomPath(payload, from, to, { walkableCellsFrom, buildLevelWorld }) {
    const tile = payload.tile_size;
    const flood = walkableCellsFrom(payload.record, payload.start);
    const world = buildLevelWorld(payload.record);
    const walls = new Set(payload.exits.map((e) => `${e.exit_tiles[0][0]},${e.exit_tiles[0][1]}`));
    for (const t of [...world.lethalTerrainTiles, ...world.pitTiles]) walls.add(`${Math.floor(t.x / tile)},${Math.floor(t.y / tile)}`);
    const k = (c) => `${c.tx},${c.ty}`;
    const prev = new Map([[k(from), null]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i += 1) {
        const at = queue[i];
        if (at.tx === to.tx && at.ty === to.ty) break;
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const c = { tx: at.tx + dx, ty: at.ty + dy };
            const isTo = c.tx === to.tx && c.ty === to.ty;
            if (prev.has(k(c)) || !flood.has(k(c)) || (walls.has(k(c)) && !isTo)) continue;
            prev.set(k(c), at);
            queue.push(c);
        }
    }
    if (!prev.has(k(to))) return null;
    const out = [];
    for (let c = to; c; c = prev.get(k(c))) out.unshift(c);
    return out;
}

/**
 * The helpers for one page. `wasmPage` is the preset's own `flash_panel.wasm`;
 * `logs` / `pageErrors` are the gate's console and pageerror collectors; `name`
 * labels the bus subscriptions.
 */
export function createRoomPlay({ page, wasmPage, logs, name }) {
    let failures = 0;
    /** `PASS: ` / `FAIL: ` rows and a last `ALL CHECKS PASSED` / `N CHECK(S) FAILED` (F1's vocabulary). */
    function check(label, ok, detail = '') {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failures += 1;
    }

    async function waitFor(desc, fn, timeoutMs = 60000) {
        const start = Date.now();
        for (;;) {
            // eslint-disable-next-line no-await-in-loop
            const v = await fn();
            if (v) return v;
            if (Date.now() - start > timeoutMs) {
                console.log(`PAGE LOGS (last 40):\n${logs.slice(-40).join('\n')}`);
                throw new Error(`timeout waiting for: ${desc}`);
            }
            // eslint-disable-next-line no-await-in-loop
            await page.waitForTimeout(250);
        }
    }

    function gameFrame() {
        const f = page.frames().find((fr) => fr.url().includes(wasmPage));
        if (!f) throw new Error('seedling wasm iframe not found');
        return f;
    }

    /** readState: `level`, `pendingExit` and the `Main.*` CHECKPOINT (not the live position). */
    async function readGameState() {
        const raw = await gameFrame().evaluate(() => window.__swfBridge.game.readState());
        try { return JSON.parse(raw); } catch { return { __raw: raw }; }
    }

    /** The player's LIVE position (entity centre), off `botMobiles`. */
    async function livePlayer() {
        const raw = await gameFrame().evaluate(() => window.__swfBridge.game.botMobiles());
        let doc;
        try { doc = JSON.parse(raw); } catch { return null; }
        const p = (doc?.mobiles ?? []).find((m) => /player/i.test(m.cls ?? ''));
        return p ? { x: p.x, y: p.y } : null;
    }

    const activeTabTitles = () => page.evaluate(() => [...document.querySelectorAll('.lm_tab.lm_active')]
        .map((t) => t.title));
    const currentRegion = () => page.evaluate(() =>
        window.centralRegistry?.getPublicFunction('gameState', 'getCurrentRegion')?.() ?? null);
    const glueStats = () => page.evaluate(async () => {
        const mod = await import('./modules/flashPanel/index.js');
        return mod.getSeedlingRegionGlue()?.stats ?? null;
    });
    const glueMoves = async () => (await page.evaluate(() => window.__roomMoves ?? []))
        .filter((m) => m.source === 'seedlingRegionGlue');
    const activeSubstrates = () => page.evaluate(() => window.__roomActive ?? []);

    /**
     * What the binding resolved for the region it holds: the arm's own answer, not
     * a log line. `spawnByExitId` resolves the same arrival with its `exit_id`
     * ALONE (no `source_region`), which is what tells arms 1–2 from arm 3 when
     * both would pick the same door (T3: they do for a sphere leaf).
     */
    const arrival = () => page.evaluate(async () => {
        const glue = (await import('./modules/flashPanel/index.js')).getSeedlingRegionGlue();
        const { resolveArrivalSpawn } = await import('./modules/flashPanel/seedlingRegionBinding.js');
        const b = glue.binding;
        return { region: b.region, arrivedFrom: b.arrivedFrom,
            spawn: resolveArrivalSpawn(b.world, b.arrivedFrom, b.returnSpawns),
            spawnByExitId: b.arrivedFrom?.exit_id
                ? resolveArrivalSpawn(b.world, { exit_id: b.arrivedFrom.exit_id }, b.returnSpawns) : null };
    });

    /**
     * Install the independent watchers: every `user:regionMove` the flashPanel
     * dispatcher publishes (`window.__roomMoves`) and every
     * `procgen:activeSubstrateChanged` (`window.__roomActive`). THROWS when the
     * dispatcher cannot be wrapped — a silent watcher would pass every negative.
     */
    async function installWatchers() {
        const wrapped = await page.evaluate(async (label) => {
            const mod = await import('./modules/flashPanel/index.js');
            const d = mod.getDispatcher();
            if (!d || typeof d.publish !== 'function') return false;
            window.__roomMoves = [];
            const publish = d.publish.bind(d);
            d.publish = (event, data, opts) => {
                if (event === 'user:regionMove') window.__roomMoves.push(data);
                return publish(event, data, opts);
            };
            window.__roomActive = [];
            const bus = (await import('./app/core/eventBus.js')).default;
            bus.subscribe('procgen:activeSubstrateChanged',
                (p) => window.__roomActive.push(p ? p.substrate : null), label);
            return true;
        }, name);
        if (!wrapped) throw new Error('could not wrap the flashPanel dispatcher — the watcher would be silent');
    }

    /** A `new Game(level, x, y)` the glue did not ask for: the template's native jump. */
    async function jump(level, x, y) {
        await gameFrame().evaluate(({ l, px, py }) => {
            window.__swfBridge.queueItems({
                invocation: 'new_instance',
                className: 'Game',
                args: [l, px, py],
                assignTo: { class: 'net.flashpunk.FP', property: 'world' },
            });
        }, { l: level, px: x, py: y });
    }

    /**
     * ⛔ GIVE THE GAME REAL FOCUS, THE WAY A PLAYER DOES. The Flash Game and Maze
     * Room tabs share one stack, and walking the maze back brings the maze tab
     * forward; `canvas.focus()` inside the iframe then does NOT move the page's
     * own focus back into it, and held keys went to the maze panel (T2 run 2:
     * the step-off "moved" the wrong way and the door never fired). So the tab is
     * selected again and the canvas CLICKED.
     */
    async function focusGame() {
        await page.evaluate(() => {
            [...document.querySelectorAll('.lm_tab')].find((t) => t.title === 'Flash Game')?.click();
        });
        await page.waitForTimeout(300);
        await gameFrame().click('#canvas');
        // ⛔ …and RELEASE every arrow into it. A door fires mid-hold, and the
        // region move that follows can take the page's focus before the key comes
        // up, so the game never hears the release and walks on with it held.
        for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            // eslint-disable-next-line no-await-in-loop
            await page.keyboard.up(k);
        }
        await page.waitForTimeout(200);
    }

    /**
     * ⛓ T2b U2a — WHERE THE PAGE'S KEYBOARD IS, read without touching it: the
     * page's active element and, when that is the game's frame, the frame's.
     */
    const focusChain = () => page.evaluate((wp) => {
        const a = document.activeElement;
        const frame = [...document.querySelectorAll('iframe')].find((f) => f.src.includes(wp));
        const inner = a === frame ? frame?.contentDocument?.activeElement : null;
        return { page: a?.tagName ?? null, frame: a === frame, inner: inner?.tagName ?? null };
    }, wasmPage);
    const gameHasKeys = (c) => c.frame && c.inner === 'CANVAS';

    /**
     * A key pressed the way a PERSON presses it after an activation: no tab
     * click, no canvas click, no focus() — whatever has the page's focus gets
     * it. `{moved, before, after}`.
     */
    async function keyMovesPlayer(key, minPx = 4, ceilingMs = 1500) {
        const before = await livePlayer();
        const start = Date.now();
        await page.keyboard.down(key);
        let after = before;
        try {
            while (Date.now() - start < ceilingMs) {
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(50);
                // eslint-disable-next-line no-await-in-loop
                after = await livePlayer();
                if (before && after && Math.hypot(after.x - before.x, after.y - before.y) >= minPx) break;
            }
        } finally {
            await page.keyboard.up(key);
        }
        const moved = !!before && !!after && Math.hypot(after.x - before.x, after.y - before.y) >= minPx;
        return { moved, before, after };
    }

    /** Hold `key` until `until()` answers, or the ceiling; `{value, ms}`. */
    async function holdUntil(key, until, ceilingMs = HOLD_CEILING_MS) {
        await gameFrame().evaluate(() => document.getElementById('canvas')?.focus());
        const start = Date.now();
        await page.keyboard.down(key);
        let value = null;
        try {
            while (!value && Date.now() - start < ceilingMs) {
                // eslint-disable-next-line no-await-in-loop
                await page.waitForTimeout(50);
                // eslint-disable-next-line no-await-in-loop
                value = await until();
            }
        } finally {
            await page.keyboard.up(key);
        }
        return { value, ms: Date.now() - start };
    }

    const invoked = (level, spawn) => `[BridgeGeneric] Invoked: new Game(${level},${spawn.x},${spawn.y})`;
    const parsePending = (v) => {
        const parts = String(v ?? '').split('|');
        return parts.length === 6 ? { fromLevel: +parts[1], type: parts[2], x: +parts[3], y: +parts[4], to: +parts[5] } : null;
    };

    /** The maze panel's region, or null before it holds a world. */
    const mazeRegionNow = () => page.evaluate(async () => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        return p?.world && p.state ? p.currentRegionId : null;
    });

    /**
     * ⛓ T2b F2 — the keys of a shortest path from the maze player to `goal`,
     * pressed one by one into whatever holds the page's keyboard (the maze
     * panel's own `_handleKeydown` after F4). `goal` is `{exitTo: <region>}` (the
     * exit into that region; exits are walls to the flood except the goal) or
     * `{tile: {x, y}}`. `ignoreGates` plans THROUGH obstacles: the gate
     * uses it to walk INTO a closed gate and watch the maze refuse. When the
     * player stands ON the exit into the goal region, it steps off onto a floor
     * neighbour and back on. Returns `{keys, from}` or `{error}`.
     */
    const mazeKeyPlan = (goal, { ignoreGates = false } = {}) => page.evaluate(async ({ want, ignore }) => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        const world = p.world;
        const key = (x, y) => `${x},${y}`;
        const exitAt = new Map([...world.exits.values()].map((e) => [key(e.x, e.y), e]));
        const from = { ...p.state.player_pos };
        const isGoal = (x, y) => (want.exitTo
            ? exitAt.get(key(x, y))?.targetRegion === want.exitTo
            : x === want.tile.x && y === want.tile.y);
        const here = exitAt.get(key(from.x, from.y));
        if (want.exitTo && here?.targetRegion === want.exitTo) {
            const dirs = [[0, -1, 'ArrowUp', 'ArrowDown'], [1, 0, 'ArrowRight', 'ArrowLeft'],
                [0, 1, 'ArrowDown', 'ArrowUp'], [-1, 0, 'ArrowLeft', 'ArrowRight']];
            const off = dirs.find(([dx, dy]) => {
                const nx = from.x + dx; const ny = from.y + dy;
                return nx >= 0 && ny >= 0 && nx < world.width && ny < world.height && !exitAt.has(key(nx, ny))
                    && !world.obstacles.has(key(nx, ny)) && world.tiles[ny * world.width + nx] === 0;
            });
            if (off) return { keys: [off[2], off[3]], from: p.currentRegionId };
        }
        const prev = new Map([[key(from.x, from.y), null]]);
        const queue = [from];
        let goalKey = null;
        while (queue.length && !goalKey) {
            const c = queue.shift();
            for (const [dx, dy, k] of [[0, -1, 'ArrowUp'], [1, 0, 'ArrowRight'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft']]) {
                const nx = c.x + dx; const ny = c.y + dy; const kk = key(nx, ny);
                if (prev.has(kk) || nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
                if (isGoal(nx, ny)) { prev.set(kk, { c, k }); goalKey = kk; break; }
                if (exitAt.has(kk)) continue;
                if ((!ignore && world.obstacles.has(kk)) || world.tiles[ny * world.width + nx] !== 0) continue;
                prev.set(kk, { c, k });
                queue.push({ x: nx, y: ny });
            }
        }
        if (!goalKey) return { error: `no key path from ${JSON.stringify(from)} in ${p.currentRegionId} to ${JSON.stringify(want)}` };
        const keys = [];
        let at = goalKey;
        while (prev.get(at)) { const { c, k } = prev.get(at); keys.unshift(k); at = key(c.x, c.y); }
        return { keys, from: p.currentRegionId };
    }, { want: goal, ignore: ignoreGates });

    /** Press `keys` one by one, a person's pace. */
    async function pressKeys(keys) {
        for (const k of keys) {
            // eslint-disable-next-line no-await-in-loop
            await page.keyboard.press(k);
            // eslint-disable-next-line no-await-in-loop
            await page.waitForTimeout(80);
        }
    }

    /** ⛓ G2: the MOUNTED level set, read back out of the game (`botLevelSet`). */
    async function readLevelSet() {
        const raw = await gameFrame().evaluate(() => window.__swfBridge.game.botLevelSet());
        try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return { __raw: raw }; }
    }

    /**
     * ⛓ G2 — WALK A PATH OF TILES with real keys, one tile at a time, the way a
     * person steers: hold the key toward the next cell until the LIVE player's
     * centre stands within `snapPx` of that cell's centre along the way it moves,
     * then let go. `cells` are `{tx, ty}` from the player's cell onward (the first
     * is where it stands). `stopWhen()` ends the walk early (a door fired, a
     * pickup reported). `{ok, at, steps, why}` — `at` the live cell at the end.
     */
    async function walkPath(cells, { tile = 16, snapPx = 3, stepCeilingMs = 2500, stopWhen = null } = {}) {
        const keyFor = (a, b) => (b.tx > a.tx ? 'ArrowRight' : b.tx < a.tx ? 'ArrowLeft'
            : b.ty > a.ty ? 'ArrowDown' : 'ArrowUp');
        const cellOf = (p) => (p ? { tx: Math.floor(p.x / tile), ty: Math.floor(p.y / tile) } : null);
        let steps = 0;
        /** One `[tx,ty]@(x,y)` per step, where the live player stood when the key came up. */
        const trace = [];
        const mark = (p) => (p ? `(${p.x.toFixed(1)},${p.y.toFixed(1)})` : 'null');
        for (let i = 1; i < cells.length; i += 1) {
            const from = cells[i - 1];
            const to = cells[i];
            const k = keyFor(from, to);
            const cx = to.tx * tile + tile / 2;
            const cy = to.ty * tile + tile / 2;
            const arrived = (p) => (k === 'ArrowRight' ? p.x >= cx - snapPx : k === 'ArrowLeft' ? p.x <= cx + snapPx
                : k === 'ArrowDown' ? p.y >= cy - snapPx : p.y <= cy + snapPx);
            // eslint-disable-next-line no-await-in-loop
            const held = await holdUntil(k, async () => {
                if (stopWhen && await stopWhen()) return 'stopped';
                const p = await livePlayer();
                return p && arrived(p) ? 'arrived' : null;
            }, stepCeilingMs);
            steps += 1;
            // eslint-disable-next-line no-await-in-loop
            trace.push(`${to.tx},${to.ty}${held.value === 'arrived' ? '' : `!${held.value ?? 'timeout'}`}@${mark(await livePlayer())}`);
            // eslint-disable-next-line no-await-in-loop
            if (held.value === 'stopped' || (stopWhen && await stopWhen())) {
                return { ok: true, stopped: true, steps, at: cellOf(await livePlayer()), trace };
            }
            if (held.value !== 'arrived') {
                // eslint-disable-next-line no-await-in-loop
                const p = await livePlayer();
                return { ok: false, steps, at: cellOf(p), trace, why: `the step ${JSON.stringify(from)} -> ${JSON.stringify(to)} `
                    + `(${k}) did not arrive in ${held.ms} ms; live ${JSON.stringify(p)}` };
            }
        }
        return { ok: true, steps, at: cellOf(await livePlayer()), trace };
    }

    /** The maze player's tile and the panel's queue. */
    const mazePlayer = () => page.evaluate(async () => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        return p?.world ? { region: p.currentRegionId, pos: { ...p.state.player_pos },
            queue: { cursor: p._mazeQueue?.cursor, length: p._mazeQueue?.length } } : null;
    });

    /** Does the MAZE panel hold the page's keyboard? The active element's class, or null. */
    const mazeHasKeys = () => page.evaluate(async () => {
        const p = (await import('./modules/mazeRoom/index.js')).getPanelInstance();
        return p?.rootElement?.contains(document.activeElement) ? document.activeElement.className : null;
    });

    return {
        check, failures: () => failures, waitFor, gameFrame, readGameState, livePlayer,
        activeTabTitles, currentRegion, glueStats, glueMoves, activeSubstrates, arrival,
        installWatchers, jump, focusGame, focusChain, gameHasKeys, keyMovesPlayer, holdUntil,
        invoked, parsePending, mazeRegionNow, mazeKeyPlan, pressKeys, mazePlayer, mazeHasKeys,
        readLevelSet, walkPath,
    };
}
