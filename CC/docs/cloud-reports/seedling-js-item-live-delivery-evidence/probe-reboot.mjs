/**
 * MEASUREMENT-ONLY probe (slice seedling-js-item-reboot-diagnosis). Drives the JS runtime core
 * (`createJsRuntime`, the same core `jsRuntime.html` / flashPanel `?runtime=js` run) on the vanilla map,
 * plays the HOST's part (an AP pickup's own item echoed back through the queue), and dumps the room's
 * objects + the player's position/ctor around the in-place reboot.
 *
 *   node probe-reboot.mjs l40   — the chest (40:13) → Red Key (`hasKeySet(0,true)`) → the death loop
 *   node probe-reboot.mjs l39   — the totem (39, totempart 2) → Seal (`hasSealPartSet`) → the locks come back
 *
 * Writes <case>.json beside itself. Changes no source. (seedling-js-item-live-delivery: copied from the diagnosis'
 * evidence, `delivery` notes added to the kept notes; run at BASE ed92d80127 → base-<case>.*, at the fix → <case>.*.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const R = join(HERE, '../../../../frontend/modules/');
const { createJsRuntime, IN_PLACE_REBOOT_WHY } = await import(join(R, 'seedlingDemo/jsRuntimeCore.js'));
const { tileRoute, routeWalker, cellOf } = await import(join(R, 'seedlingDemo/jsRuntimeTestWalk.js'));
const MAP = JSON.parse(readFileSync(join(R, 'flashPanel/atlases/seedling-map.json'), 'utf8'));

const flag = (p) => ({ class: 'Main', property: p, value: true });
const keyCall = (i) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [i, true] });
const sealCall = (slot, id) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasSealPartSet', args: [slot, id] });
const newGame = (l, x, y) => ({ invocation: 'new_instance', className: 'Game', args: [l, x, y] });

const CASE = process.argv[2] ?? 'l40';
const notes = [];
const rt = createJsRuntime({ log: (m) => notes.push(m) });
rt.setVanilla(MAP);
rt.game.configure({ state_properties: [{ class: 'Game', property: 'pendingCheck' }, { class: 'Main', property: 'level' }] });

const r2 = (v) => Math.round(v * 100) / 100;
function snap(label) {
    const run = rt.run;
    const st = JSON.parse(rt.game.botStatus());
    return {
        label, tick: rt.ticks ?? null, run_id: runIds.get(run) ?? (runIds.set(run, runIds.size + 1), runIds.size),
        level: run.level, pos: { x: r2(run.state.x), y: r2(run.state.y) }, worldCtor: { ...run.worldCtor },
        arrival: rt.arrival, damage: { ...run.damage }, deaths: rt.deaths.length, keys: [...run.keys],
        chasers: run.chasers.map((c) => ({ id: c.id, x: r2(c.x), y: r2(c.y), hits: c.hits, dying: c.dying, destroy: c.destroy })),
        locks: (run.activatorsNow?.responders ?? []).map((r) => ({ id: r.id, open: r.open, alpha: r2(r.alpha) })),
        pushedBlocks: JSON.parse(JSON.stringify(run.pushedBlocks ?? [])),
        burnedTrees: JSON.parse(JSON.stringify(run.burnedTrees ?? [])),
        pressed: (run.activatorsNow?.pressers ?? []).filter((p) => p.down).map((p) => p.id),
        persistence_cleared: st.persistence_cleared.filter((c) => c.level === run.level),
    };
}
const runIds = new Map();
let ticks = 0;
const events = [];
function tick(held) {
    const out = rt.tick(held);
    ticks += 1;
    if (out.death) events.push({ t: ticks, death: out.death, at: { x: r2(rt.run.state.x), y: r2(rt.run.state.y) }, ctor: { ...rt.run.worldCtor } });
    return out;
}
const pendingCheck = () => JSON.parse(rt.game.readState()).pendingCheck;

function walk(to, max = 600, allow = []) {
    const run = rt.run;
    const route = tileRoute(MAP.levels.find((l) => l.level === run.level), cellOf(run.state.x, run.state.y), to, { allow });
    if (!route) throw new Error(`no route to ${JSON.stringify(to)}`);
    const w = routeWalker(route);
    for (let t = 0; t < max && !w.done; t += 1) { const o = tick(w.next(rt.run.state.x, rt.run.state.y)); if (o.death) return o; }
    return { done: w.done };
}

const out = { case: CASE, reboot_why: IN_PLACE_REBOOT_WHY, snaps: [], events, host: [] };
if (CASE === 'l40' || CASE === 'l40-control') {
    const BOOT = (process.env.BOOT ?? '864,848').split(',').map(Number);
    rt.queueItems([flag('hasSword'), flag('hasShield'), flag('hasFire'), flag('hasWand'), keyCall(2), newGame(40, BOOT[0], BOOT[1])]);
    tick();
    out.snaps.push(snap(`booted in the corridor below the chest (new Game(40, ${BOOT}))`));
    const pc0 = pendingCheck();
    // 1. Kill the bobsoldier that guards the chest (closed-loop: approach, face, swing). Deaths on the way are the
    //    room's own (they respawn at the ctor this boot entered with).
    for (let t = 0; t < 3000; t += 1) {
        const p = rt.run.state;
        const b = rt.run.chasers.find((c) => c.id.startsWith('bobsoldier'));
        if (!b || b.destroy) { out.killed = { t: ticks, bobsoldier: 'gone' }; break; }
        const dx = b.x - p.x; const dy = b.y - p.y;
        const face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        tick(Math.hypot(dx, dy) > 18 ? new Set([face]) : (t % 6 < 2 ? new Set(['primary']) : new Set([face])));
    }
    for (let t = 0; t < 20; t += 1) tick(new Set());
    out.snaps.push(snap('the bobsoldier is dead (the room as the player has made it)'));
    // 2. Step under the chest (the bobsoldier's own tile) and hold UP into it until the check fires.
    out.walk = walk({ tx: 55, ty: 52 }, 300, [{ tx: 55, ty: 52 }]);
    let fired = null;
    for (let t = 0; t < 240 && !fired; t += 1) {
        if (pendingCheck() !== pc0) { fired = pendingCheck(); break; }
        tick(new Set(['up']));
    }
    out.host.push({ t: ticks, pendingCheck: fired });
    out.snaps.push(snap('the chest opened (pendingCheck fired), BEFORE the host echoes the item'));
    // The host's echo: Chest (Lacste Main Room) holds the Red Key in seed 1 → `Main.hasKeySet(0, true)`.
    if (CASE === 'l40') {
        rt.queueItems([keyCall(0)]);
        out.host.push({ t: ticks, queued: 'Main.hasKeySet(0, true)  (Red Key — seed 1 Chest (Lacste Main Room))' });
    } else out.host.push({ t: ticks, queued: 'NOTHING (control: the host echoes no item)' });
    tick();
    out.snaps.push(snap('one tick after the delivery (the in-place reboot ran)'));
    // Now stand still and let the room play out: count the deaths and where each respawn lands.
    for (let t = 0; t < 1800; t += 1) {
        const o = tick(new Set());
        if (o.death && out.snaps.filter((x) => x.label.startsWith('after death')).length < 3) out.snaps.push(snap(`after death #${rt.deaths.length}`));
    }
    out.snaps.push(snap('after 1800 idle ticks'));
} else if (CASE === 'l39' || CASE === 'l39-control') {
    // The room is solved by the committed tape `r5-shaft` (three fire blocks on the three lock buttons), which ends
    // one tile from `totempart 2`. Then the player steps left onto it, as Robert did.
    rt.queueItems([newGame(39, 144, 608)]);
    tick();
    out.tape = { load: rt.game.botLoadTape(readFileSync(join(R, 'seedlingDemo/fixtures/tapes/r5-shaft.json'), 'utf8')), start: rt.game.botStart() };
    for (let t = 0; t < 4000 && !JSON.parse(rt.game.botStatus()).finished; t += 1) tick();
    out.snaps.push(snap('tape r5-shaft finished (the three shaft locks held open by the three fire blocks)'));
    const totem = () => rt.run.saveState?.totem_parts?.[2] === true;
    for (let t = 0; t < 120 && !totem(); t += 1) tick(new Set(['left']));
    for (let t = 0; t < 30 && !rt.run.inCeremony; t += 1) tick(new Set());
    out.host.push({ t: ticks, totem_parts_2: totem() });
    out.snaps.push(snap('totempart 2 picked up (`hasTotemPartSet(2)`), BEFORE the host echoes the item'));
    if (CASE === 'l39') {
        // Seed 1: Totem Shard (Three Blocks Puzzle) holds a Seal → the adapter writes the first empty slot.
        rt.queueItems([sealCall(0, 0)]);
        out.host.push({ t: ticks, queued: 'Main.hasSealPartSet(0, 0)  (Seal — seed 1 Totem Shard (Three Blocks Puzzle))' });
    } else out.host.push({ t: ticks, queued: 'NOTHING (control: the host echoes no item)' });
    for (let t = 0; t < 600; t += 1) tick(new Set());
    out.snaps.push(snap('600 ticks after the delivery (the ceremony played; the in-place reboot ran when it ended)'));
}
out.deaths = rt.deaths;
out.notes = notes.filter((m) => /boot level|death|reboot|transition|HALT|delivery/.test(m));
writeFileSync(join(HERE, `${CASE}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ killed: out.killed, walk: out.walk, host: out.host, deaths: rt.deaths.length }));
console.log('respawns', JSON.stringify(rt.deaths.map((d) => [d.t, d.kind, d.respawn])));
for (const s of out.snaps.filter((x, i, a) => i < 5 || i === a.length - 1)) console.log(s.label, '| run', s.run_id, '| pos', s.pos, '| ctor', s.worldCtor, '| deaths', s.deaths,
    '| bobsoldier', JSON.stringify(s.chasers.find((c) => c.id.startsWith('bobsoldier'))), '| hits', s.damage.hits,
    '| locks', s.locks.map((l) => `${l.id}:${l.open ? 'OPEN' : 'shut'}`).join(' '));
