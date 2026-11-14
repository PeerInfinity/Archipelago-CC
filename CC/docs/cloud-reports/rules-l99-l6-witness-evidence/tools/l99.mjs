#!/usr/bin/env node
// rules-l99-l6-witness: L99 `lock@80,96` (tset -1, tag 0: opens when `Game.totalEnemies()` is 0, i.e. all three
// lavarunners are dead) — from which arrival, with which arm, ON THE GAME (wasm p4g, headless logic-only).
//
//   node l99.mjs --model                      the solver from each (arrival, arm) staging, two goals each
//   node l99.mjs --build=<dir> [--arm=a,b]    the hand tapes (open-loop key scripts; the model only advances the clock)
//   node l99.mjs --play=<dir>  [--arm=a,b]    plays each tape on the game; samples the player, every LavaRunner and the
//                                             lock every 5 ticks; prints one ROW per arm (hits, runners alive, 99:0)
//
// Staging: the route survey's post-sword latch (`probe-seedling-er-landings.landingStaging`, base r8-solve-11)
// re-pointed at the arrival. West = the L100 stairs' landing (32,96) (seedling_er survey step 39); east = the L98
// stairs' landing (96,112) (vanilla survey step 222). Arms: `sword` (hasSword, the latch's own), `spear` (hasSpear
// only, hasSword false). Nothing else staged: no flag, no removed body, no game value. Keys/seals the survey held
// (Green Key, 4 seals) are not read by anything in L99 and are not staged.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const { landingStaging, POST_SWORD_BASE, spansOf, solveFrom, keysToward } = await import(join(R, 'scripts/procgen/probe-seedling-er-landings.mjs'));
const { requiredTapeVersion, inventorySlotsFor } = await M('tapeFormat.js');

export const ARRIVALS = { west: { level: 99, x: 32, y: 96 }, east: { level: 99, x: 96, y: 112 } };
export async function staging(arrival, arm) {
    const s = await landingStaging({ base: POST_SWORD_BASE, boot: ARRIVALS[arrival], items: [], keys: [] });
    if (arm === 'spear') s.seam.items = { ...s.seam.items, hasSword: false, hasSpear: true };
    s.seam.primary = 0;
    return s;
}
const LOCK = { level: 99, tag: 0 };
const GOALS = {
    west: [{ kind: 'reach-exit', exit: { x: 112, y: 112 } }, { kind: 'clear-tag', tag: LOCK, at: { x: 80, y: 96 }, obstacle: 'lock@80,96' }],
    east: [{ kind: 'reach-exit', exit: { x: 48, y: 96 } }, { kind: 'clear-tag', tag: LOCK, at: { x: 80, y: 96 }, obstacle: 'lock@80,96' }],
};

// ── The hand scripts. `to` walks on one axis then the other (y first unless noted); `face d` taps a direction for one
// tick (a 1-tick tap turns the player without moving it a full step); `atk n gap` presses primary n times.
// The stances are chosen from the source (see the report §2): the plateau's reachable points nearest each runner.
const W = {
    // West plateau, NE strip (rows 36-60, x <= 92, against the wall at column 6): runner@160,32 (at 168,40) is 76 px
    // away (< Bob.runRange 80) — the only runner any plateau point wakes.
    nePocket: [['to', 40, 88], ['to', 72, 88], ['to', 72, 56], ['to', 92, 56], ['to', 92, 40], ['face', 'right'], ['atk', 40, 12]],
    // West plateau, row 5's east end (x 100, the cliffside band (6,5) at x 104-112): face east.
    row5: [['to', 40, 88], ['to', 100, 88], ['face', 'right'], ['atk', 40, 12]],
    // Above the lock (row 5, column 5), facing down at the lock / the stairs.
    overLock: [['to', 40, 88], ['to', 88, 88], ['to', 88, 92], ['face', 'down'], ['atk', 30, 12]],
    // The plateau's row 7 (y 116-124) at its east end x 68, beside cliffside (4,7): face east at the lower floor.
    // The pocket's nearest point to runner@176,64 (l99-pocket.mjs: (102,82), 82.6 px): walk there, then HOLD right
    // (and right+up) into the cliffside band to find the game's own x limit; idle so a woken runner would arrive.
    corner: [['to', 40, 88], ['to', 100, 84], ['keys', 'right', 60], ['keys', 'right+up', 60], ['face', 'right'], ['atk', 20, 12]],
    se: [['to', 40, 88], ['to', 68, 88], ['to', 68, 120], ['face', 'right'], ['atk', 30, 12]],
};
// East (lower floor, the L98 landing): three stances that wake runners (Bob.runRange 80) and let them come to the
// blade on one side. Each presses primary every `gap` ticks while standing.
const E = {
    // The corridor (x 148-172, y 96-112) north of the lower floor, facing up: all three runners are within 80 px.
    corridor: [['to', 96, 136], ['to', 160, 136], ['to', 160, 104], ['face', 'up']],
    // Its foot (y 124): only the two at y 72 wake; they come down the corridor in a file.
    foot: [['to', 96, 136], ['to', 160, 136], ['to', 160, 124], ['face', 'up']],
    // The igneous shelf's west end (124,80), facing east across the lava: all three wake and come west.
    shelf: [['to', 96, 136], ['to', 160, 136], ['to', 160, 84], ['to', 124, 80], ['face', 'right']],
};
export const ARMS = {};
// West: one tape per stance (each from the arrival), so no tape outlives the model's camera-shake band (tick ≈ 1405).
for (const arm of ['sword', 'spear']) {
    for (const [k, sc] of Object.entries(W)) ARMS[`west-${arm}-${k}`] = { arrival: 'west', arm, script: [...sc, ['wait', 200]] };
    for (const [k, sc] of Object.entries(E)) ARMS[`east-${arm}-${k}`] = { arrival: 'east', arm, script: [...sc, ['atk', 75, 8], ['wait', 30]] };
    // pin: the LINE stance under wall tile (8,7) (x 128-144, y 112-128). The player stands at (134,y) just below the
    // wall's bottom edge, facing east. A runner chasing it (Bob.update: straight at the player, no pathfinding;
    // Mobile.moveX/moveY stop at the first solid pixel per axis) comes down the corridor, its 12 px box (LavaRunner
    // setHitbox 12) hits the wall's east face at x 144 while its top edge is above y 128, slides down until its y
    // matches the player's, and stops: centre (150,y), 16 px from the player — inside the blade's 16 px rect reach
    // (Player.slash: distanceRectPoint <= 16) and outside contact (|dx| >= 8); the line between the centres runs
    // under the wall, so collideLine("Solid") is clear. Runners are woken one at a time (Bob.runRange 80), each
    // from a point it reaches only after the player is back at the stance.
    // (y < 132 walks the player's box into the L98 stairs at (112,112) on the way east; the lane is y 136.)
    for (const y of [132, 133]) {
        const at = [['to', 122, y], ['to', 134, y]];
        ARMS[`east-${arm}-pin-y${y}`] = { arrival: 'east', arm, script: [['to', 104, 136], ['to', 122, 136], ...at, ['atk', 8, 21],
            ['to', 146, y], ...at, ['atk', 8, 21],
            ['to', 158, y], ['to', 158, 118], ['to', 158, y], ...at, ['atk', 10, 21],
            ['to', 158, y], ['to', 158, 106], ['to', 158, y], ...at, ['atk', 12, 21], ['wait', 30]] };
    }
    // foot2: the foot stance, primary every 21 ticks (> Player.slashTimerMax 20, so no dash-slash moves the player),
    // started at phase p; once the two y-72 runners are dead, up the corridor to (160,104) to wake runner@160,32.
    for (const p of [0, 5, 10, 15]) ARMS[`east-${arm}-foot2-p${p}`] = { arrival: 'east', arm, script: [...E.foot, ['wait', p],
        ['atk', 12, 21], ['to', 160, 104], ['face', 'up'], ['atk', 16, 21], ['wait', 30]] };
}

async function author(st, script) {
    const { createRunForStaging } = await M('tapeRunner.js');
    const { atlasLevelSource } = await M('levelSource.js');
    // AUTHOR-ONLY: the model advances a copy with the three runners despawned at t 0, so it only moves the player (its
    // camera-shake band refuses to say whether a runner near the screen edge is on screen). The PLAYED tape keeps them.
    const authorSt = { ...JSON.parse(JSON.stringify(st)), despawn: ['lavarunner@192,64', 'lavarunner@160,32', 'lavarunner@176,64']
        .map((id) => ({ level: 99, id, at: 0, note: 'author-only: the key script never reads a runner' })) };
    const run = createRunForStaging(authorSt, atlasLevelSource(), { scratchPersistence: true });
    const perTick = [];
    const dropped = [];
    const step = (k) => {
        // A press on a tick the MODEL holds frozen is dropped (the game's Player.input returns while frozenTimer > 0,
        // so it would be ignored there too); the drop is logged.
        if (k.includes('primary') && (run.frozenTimer ?? 0) > 0) { dropped.push(perTick.length); k = k.filter((x) => x !== 'primary'); }
        perTick.push([...k]); run.advance(new Set(k));
    };
    for (let i = 0; i < 5; i++) step([]);
    for (const w of script) {
        if (w[0] === 'wait') { for (let i = 0; i < w[1]; i++) step([]); continue; }
        if (w[0] === 'keys') { for (let i = 0; i < w[2]; i++) step(w[1].split('+')); continue; }
        if (w[0] === 'face') { step([w[1]]); step([]); continue; }
        if (w[0] === 'atk') { for (let i = 0; i < w[1]; i++) { step(['primary']); for (let j = 1; j < w[2]; j++) step([]); } continue; }
        if (w[0] === 'to') {
            const [, tx, ty] = w;
            for (let n = 0; n < 600; n++) {
                const k = keysToward(run.state.x, run.state.y, tx, ty, 1);
                if (!k.length) break;
                step(k);
            }
            if (process.env.L99_TRACE) console.error('TO', JSON.stringify(w), '->', run.state.x.toFixed(1), run.state.y.toFixed(1), 't', perTick.length);
        }
    }
    for (let i = 0; i < 20; i++) step([]);
    return { perTick, model: { end: { level: run.level, x: run.state.x, y: run.state.y }, hits: run.playerHits.length, droppedPresses: dropped.length } };
}

if (process.argv.includes('--model')) {
    for (const arrival of ['west', 'east']) for (const arm of ['sword', 'spear']) for (const goal of GOALS[arrival]) {
        const t0 = Date.now();
        let row;
        try {
            const s = await solveFrom(await staging(arrival, arm), [goal], `l99-${arrival}-${arm}`);
            const verbs = (s.out.trace?.rows ?? []).map((r) => `${r.strategy?.verb ?? '?'}${r.obstacle?.id ? `(${r.obstacle.id})` : ''}`);
            row = { verdict: 'SOLVED', ticks: s.out.perTick.length, verbs };
        } catch (e) { row = { verdict: 'REFUSED', refusal: String(e.message).split('\n')[0].slice(0, 500) }; }
        console.log('MODEL', JSON.stringify({ arrival, arm, goal: goal.kind, ...row, ms: Date.now() - t0 }));
    }
}

if (arg('build')) {
    const dir = arg('build'); mkdirSync(dir, { recursive: true });
    const names = arg('arm') ? arg('arm').split(',') : Object.keys(ARMS);
    for (const name of names) {
        const a = ARMS[name];
        const st = await staging(a.arrival, a.arm);
        const { perTick, model } = await author(st, a.script);
        const t = { ...st, game: 'seedling', name: `l99-${name}`, description: `rules-l99-l6-witness: ${name} (hand script)`,
            noclip: false, noDamage: false, noHazards: [], grants: [], equips: [], tick_count: perTick.length, inputs: spansOf(perTick) };
        const tape = { ...t, tape_version: requiredTapeVersion(t, 8) };
        writeFileSync(join(dir, `${name}.tape.json`), JSON.stringify(tape));
        console.log('BUILT', name, JSON.stringify({ ticks: perTick.length, slots: inventorySlotsFor(st.seam.items), model }));
    }
}

if (arg('play')) await play(arg('play'), arg('arm') ? arg('arm').split(',') : Object.keys(ARMS));

export async function play(dir, names, { onSample } = {}) {
    const { chromium } = await import('playwright');
    const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
    const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
    const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { parseTape, gameVisibleTape } = await M('tapeFormat.js');
    const { vanillaRecordSet } = await M('levelSetExporter.js');
    const readJson = (rel) => JSON.parse(readFileSync(join(R, rel), 'utf8'));
    const set = vanillaRecordSet(readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'),
        readJson('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
    takeBoxLockOrExit({ name: 'rules-l99-l6-witness', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, a) => page.evaluate(([name, x]) => String(x === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
    const until = async (page, fn, ms) => { for (const t0 = Date.now(); ;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100); } };
    let proved = false;
    const rows = [];
    for (const name of names) {
        const tape = parseTape(readFileSync(join(dir, `${name}.tape.json`), 'utf8'));
        const page = await browser.newPage();
        try {
            await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
            await until(page, () => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await until(page, () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; console.log('CHANNEL: headless logic-only (asserted)'); }
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const samples = [];
            let lastT = -1; let status; let firstCleared = null; let maxHits = 0; let minRunners = 99;
            for (const t0 = Date.now(); Date.now() - t0 < 20 * 60 * 1000;) {
                const [s, m] = await page.evaluate(() => [String(window.__swfBridge.game.botStatus()), String(window.__swfBridge.game.botMobiles())]);
                status = JSON.parse(s);
                if (status.error) throw new Error(status.error);
                const mob = JSON.parse(m);
                const clr = (status.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`);
                if (Number.isInteger(status.tick) && firstCleared === null) firstCleared = clr;
                if (Number.isInteger(status.tick) && status.tick >= lastT + 5) {
                    lastT = status.tick;
                    const runners = (mob.mobiles ?? []).filter((r) => /LavaRunner/.test(r.cls)).map((r) => ({ x: +r.x.toFixed(1), y: +r.y.toFixed(1), d: !!r.destroy, a: r.anim ?? r.currentAnim ?? null }));
                    const alive = runners.filter((r) => !r.d && r.a !== 'die').length;
                    if (status.level === 99) minRunners = Math.min(minRunners, alive);
                    maxHits = Math.max(maxHits, status.hits ?? 0);
                    const sm = { t: status.tick, level: status.level, x: status.x, y: status.y, hits: status.hits, runners, lock: clr.includes('99:0') };
                    samples.push(sm); onSample?.(sm);
                }
                if (status.finished) break;
                await page.waitForTimeout(15);
            }
            const drained = JSON.parse(await call(page, 'botDrain'));
            const ticks = drained?.ticks ?? [];
            const lastCleared = (status.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`);
            const row = { arm: name, finished: !!status.finished, obs: ticks.length, tick_count: tape.tick_count,
                end: ticks.at(-1) ? { level: ticks.at(-1).level, x: ticks.at(-1).x, y: ticks.at(-1).y } : null,
                hits: status.hits ?? null, maxHits, minRunnersAlive: minRunners === 99 ? null : minRunners,
                lockOpened: lastCleared.includes('99:0'), wrote: lastCleared.filter((c) => !(firstCleared ?? []).includes(c)),
                levels: [...new Set(ticks.map((o) => o.level))] };
            console.log('ROW', JSON.stringify(row));
            rows.push(row);
            writeFileSync(join(dir, `${name}.game.json`), JSON.stringify({ row, samples, ticks: ticks.map((o) => [o.level, o.x, o.y]) }));
        } catch (e) {
            console.log('ROW', JSON.stringify({ arm: name, error: String(e.message).split('\n')[0] }));
        } finally { await page.close(); }
    }
    await browser.close();
    return rows;
}
