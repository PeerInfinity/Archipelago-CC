// Steps for probe.mjs: the rest of the list on a room where the Seedling slot loads (slot 1).
// Env: PORT (the room's server port), OTHER (the other slot's name), GOAL_LOC (the other game's location holding The Seed),
// OWN (an own pickup "level|tag|location"), FOREIGN (a foreign pickup "level|tag|location").
const PORT = process.env.PORT; const OTHER = process.env.OTHER || 'Questy';
const GOAL_LOC = process.env.GOAL_LOC || 'Right Room Enemy Drop';
const OWN = (process.env.OWN || '17|0|Level 017 - Chest').split('|');
const FOREIGN = (process.env.FOREIGN || '41|3|Level 041 - Totem Part 240,144').split('|');

const helpers = `
const reg = (await import('/frontend/app/core/centralRegistry.js')).centralRegistry;
const g = (m, f) => { const fn = reg.getPublicFunction?.(m, f); return fn ? (...a) => { try { return fn(...a); } catch (e) { return 'threw: ' + e.message; } } : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms, every = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch {} await sleep(every); } return false; };
const checkedNow = async () => { await sm.stateManagerProxySingleton.pingWorker?.('probe', 3000)?.catch?.(() => {}); const s = sm.stateManagerProxySingleton.getLatestStateSnapshot(); return new Set(s?.checkedLocations ? [...s.checkedLocations] : []); };
const sphere = () => ({ origin: (window.__sphereMod?.getSphereStateSingleton?.() ?? null)?.logOrigin ?? null, header: g('sphereState', 'getLogHeader')?.() ?? null, spheres: (g('sphereState', 'getSphereData')?.() || []).length, first: (g('sphereState', 'getSphereData')?.() || []).slice(0, 3).map((s) => s.locations ?? s.sphere_locations ?? null) });
const costs = () => { const c = g('loops', 'getCostDataManager')?.(); const d = c?.getCostData?.() ?? null; return c ? { loaded: c.isLoaded?.(), from: c.loadedFrom ?? null, regions: d?.regions ? Object.keys(d.regions).length : null, locations: d?.locations ? Object.keys(d.locations).length : null, sampleLoc: d?.locations ? Object.entries(d.locations).slice(0, 4) : null, status: c.getStatus?.() } : null; };
const teleportTo = async (level) => { const raw = sm.getLastRawJsonData(); const pid = String(sm.stateManagerProxySingleton.getStaticData().playerId); const sc = raw.rawJsonData.preset_sidecars?.[pid] ?? {};
  for (const [region, v] of Object.entries(sc)) { const pl = v?.playable_payload; if (pl?.level !== level) continue; const sp = pl.exits?.find((e) => e.entrance_spawn)?.entrance_spawn; if (!sp) continue;
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [pl.level, sp.x, sp.y] }]); const ok = await until(() => rt.run?.level === level, 15000, 100); return { region, spawn: sp, ok }; }
  return { region: null, ok: false }; };
`;

const walkPickup = ([level, tag, location]) => `${helpers}
await window.__settings.updateSetting('moduleSettings.flashPanel.seedlingSolverWalk', true, { persist: false });
const before = await checkedNow();
const tp = await teleportTo(${Number(level)});
if (!tp.ok) return { tp, error: 'teleport failed' };
await sleep(1000);
const answers = {};
let answer = null;
for (const entityType of ['apitem', 'chest', 'totempart', undefined]) { answer = rt.playback.walkTo({ kind: 'location', level: ${Number(level)}, tag: ${Number(tag)}, ...(entityType ? { entityType } : {}) }); answers[String(entityType)] = answer?.ok ?? answer; if (answer?.ok) break; }
rt.playback.play();
const settled = await until(() => ['done', 'failed'].includes(rt.playback.state) || !!rt.halted, 90000, 200);
const got = await until(async () => (await checkedNow()).has(${JSON.stringify(location)}), 15000, 300);
return { tp, answers, settled, state: rt.playback.state, describe: rt.playback.describe?.(), halted: rt.halted?.message ?? null, solver: { solves: rt.playback.solverStats?.solves, declines: rt.playback.solverStats?.declines, goal: rt.playback.solverStats?.lastSolve?.goal?.kind ?? null },
  checkedInState: got, newlyChecked: [...(await checkedNow())].filter((n) => !before.has(n)) };`;

export default [
  { name: 'a_sphere_and_costs_loop_off', wait: 500, eval: `${helpers}
window.__sphereMod = await import('/frontend/modules/sphereState/singleton.js');
return { sphere: sphere(), costs: costs(), loop: g('loops', 'isLoopModeActive')?.() };` },

  { name: 'b_bot_leg', wait: 2000, eval: `${helpers}
bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'probe');
const botMod = await import('/frontend/modules/playbackBot/index.js');
await until(() => !!botMod.getActivePanel()?.getBot?.(), 10000);
bus.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'probe');
await sleep(1500);
const bot = botMod.getActivePanel().getBot(); bot.refresh?.();
const data = g('sphereState', 'getSphereData')?.() || [];
const before = await checkedNow();
const queue = data.flatMap((s) => s.locations ?? []).filter((n) => !before.has(n));
const target = queue[0] ?? null;
const startRegion = bot.getCurrentRegion?.() ?? null;
if (!target) return { error: 'no sphere-log location to walk', startRegion };
bot.walkToLocation(target);
const got = await until(async () => (await checkedNow()).has(target), 150000, 500);
return { startRegion, target, firstFive: queue.slice(0, 5), checkedInState: got, status: bot.getStatus?.(), log: (bot.getLog?.() ?? []).slice(-12), newlyChecked: [...(await checkedNow())].filter((n) => !before.has(n)), runLevel: rt.run?.level ?? null };` },

  { name: 'c_own_pickup', wait: 3000, eval: walkPickup(OWN) },
  { name: 'd_foreign_pickup', wait: 3000, eval: walkPickup(FOREIGN) },

  { name: 'e_loop_mode_on', wait: 2000, eval: `${helpers}
bus.publish('loops:setLoopMode', { action: 'enable', activatePanel: false }, 'probe');
await until(() => g('loops', 'isLoopModeActive')?.() === true && costs()?.loaded, 20000);
return { loop: g('loops', 'isLoopModeActive')?.(), sphere: sphere(), costs: costs() };` },

  { name: 'f_goal_from_other_slot', wait: 6000, eval: `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ws = new WebSocket('ws://localhost:${PORT}');
const log = [];
const done = new Promise((resolve) => {
  ws.onmessage = (ev) => { for (const c of JSON.parse(ev.data)) {
    log.push(c.cmd + (c.cmd === 'PrintJSON' ? ': ' + (c.data || []).map((d) => d.text).join('') : ''));
    if (c.cmd === 'RoomInfo') ws.send(JSON.stringify([{ cmd: 'Connect', password: '', game: 'APQuest', name: ${JSON.stringify(OTHER)}, uuid: 'probe-other-slot', version: { major: 0, minor: 6, build: 9, class: 'Version' }, items_handling: 0, tags: [], slot_data: false }]));
    if (c.cmd === 'Connected') ws.send(JSON.stringify([{ cmd: 'GetDataPackage', games: ['APQuest'] }]));
    if (c.cmd === 'DataPackage') { const id = c.data.games.APQuest.location_name_to_id[${JSON.stringify(GOAL_LOC)}]; log.push('goal location id ' + id); ws.send(JSON.stringify([{ cmd: 'LocationChecks', locations: [id] }])); setTimeout(() => resolve(), 3000); }
    if (c.cmd === 'ConnectionRefused') { log.push('refused ' + JSON.stringify(c.errors)); resolve(); }
  } };
});
await Promise.race([done, sleep(20000)]);
ws.close();
return { otherClient: log };` },
];
