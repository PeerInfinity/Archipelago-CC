// sdc-bot-connected-check: the full Playback Bot run to the goal on a real room.
// q_pre: the other slot (Questy) checks its locations holding Sprout's items, except the goal's (The Seed).
// g_full: bot.play() until every Sprout location is checked, or no progress for 300 s; traces status changes,
//         awaited/confirmed lines, and the INACCESSIBLE alarms. f_goal: Questy checks the goal location.
import all from './play.mjs';
import bot from './steps_bot.mjs';
const PORT = process.env.PORT; const OTHER = process.env.OTHER || 'Questy';
const PRE = (process.env.PRE || 'Bottom Left Chest|Bottom Right Room Left Chest|Bottom Right Room Right Chest|Top Middle Chest').split('|');
const PLAY_MS = Number(process.env.PLAY_MS || 2700000);
const base = bot.find((s) => s.name === 'g_bot_play').eval;
const helpers = base.slice(0, base.indexOf("bus.publish('ui:activatePanel'"));
const otherSends = (locs) => `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ws = new WebSocket('ws://localhost:${PORT}');
const log = [];
const done = new Promise((resolve) => {
  ws.onmessage = (ev) => { for (const c of JSON.parse(ev.data)) {
    log.push(c.cmd + (c.cmd === 'PrintJSON' ? ': ' + (c.data || []).map((d) => d.text).join('') : ''));
    if (c.cmd === 'RoomInfo') ws.send(JSON.stringify([{ cmd: 'Connect', password: '', game: 'APQuest', name: ${JSON.stringify(OTHER)}, uuid: 'probe-other-slot', version: { major: 0, minor: 6, build: 9, class: 'Version' }, items_handling: 0, tags: [], slot_data: false }]));
    if (c.cmd === 'Connected') ws.send(JSON.stringify([{ cmd: 'GetDataPackage', games: ['APQuest'] }]));
    if (c.cmd === 'DataPackage') { const m = c.data.games.APQuest.location_name_to_id; const ids = ${JSON.stringify(locs)}.map((n) => m[n]); log.push('ids ' + JSON.stringify(ids)); ws.send(JSON.stringify([{ cmd: 'LocationChecks', locations: ids }])); setTimeout(() => resolve(), 3000); }
    if (c.cmd === 'ConnectionRefused') { log.push('refused ' + JSON.stringify(c.errors)); resolve(); }
  } };
});
await Promise.race([done, sleep(20000)]);
ws.close();
return { otherClient: log };`;
export default [
  all.find((s) => s.name === 'a_sphere_and_costs_loop_off'),
  { name: 'q_pre', wait: 4000, eval: otherSends(PRE) },
  { name: 'g_full', wait: 3000, eval: `${helpers}
bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'probe');
const botMod = await import('/frontend/modules/playbackBot/index.js');
await until(() => !!botMod.getActivePanel()?.getBot?.(), 10000);
bus.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'probe');
await sleep(1500);
const bot = botMod.getActivePanel().getBot(); bot.refresh?.();
const pid = String(sm.stateManagerProxySingleton.getStaticData().playerId);
const all = Object.values(sm.getLastRawJsonData().rawJsonData.regions[pid]).flatMap((r) => (r.locations ?? []).filter((l) => l.id !== null && l.id !== undefined).map((l) => l.name));
const T = []; const t0 = Date.now();
const oS = bot._setStatus.bind(bot);
bot._setStatus = (s) => { if (/waiting for the server|did not land|blocked|finished|error/.test(String(s))) T.push([Math.round((Date.now() - t0) / 100) / 10, String(s).slice(0, 140)]); return oS(s); };
const before = await checkedNow();
const progress = []; let last = before.size; let lastT = Date.now();
bot.play();
await until(async () => { const n = (await checkedNow()).size; if (n !== last) { progress.push([Math.round((Date.now() - t0) / 1000), n]); last = n; lastT = Date.now(); }
  return n >= all.length || !!rt.halted || (Date.now() - lastT > 300000); }, ${PLAY_MS}, 2000);
await sleep(3000);
const statusAtEnd = bot.getStatus?.();
bot.stop?.();
const after = await checkedNow();
const lg = bot.getLog?.() ?? [];
return { pid, total: all.length, checkedBefore: before.size, checked: after.size, ms: Date.now() - t0, statusAtEnd, halted: rt.halted?.message ?? null,
  awaitedLines: lg.filter((l) => /^waiting for the server/.test(l)).length, confirmedLines: lg.filter((l) => /confirmed by the server/.test(l)).length,
  didNotLand: lg.filter((l) => /did not land/.test(l)), statusTrace: T.slice(-60), progress, unchecked: all.filter((n) => !after.has(n)), logTail: lg.slice(-25),
  inaccessible: (window.__lines || []).filter((m) => /INACCESSIBLE/.test(m)).length };` },
  { name: 'f_goal', wait: 6000, eval: otherSends([process.env.GOAL_LOC || 'Right Room Enemy Drop']) },
];
