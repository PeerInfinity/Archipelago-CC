import all from './play.mjs';
const base = all.find((s) => s.name === 'b_bot_leg').eval;
const helpers = base.slice(0, base.indexOf("bus.publish('ui:activatePanel'"));
const PLAY_MS = Number(process.env.PLAY_MS || 1200000);
const setup = `
bus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' }, 'probe');
const botMod = await import('/frontend/modules/playbackBot/index.js');
await until(() => !!botMod.getActivePanel()?.getBot?.(), 10000);
bus.publish('ui:activatePanel', { panelId: 'flashPanel' }, 'probe');
await sleep(1500);
const bot = botMod.getActivePanel().getBot(); bot.refresh?.();
const before = await checkedNow();
const startRegion = bot.getCurrentRegion?.() ?? null;
`;
export default [
  all.find((s) => s.name === 'a_sphere_and_costs_loop_off'),
  { name: 'b_bot_leg_sword', wait: 2000, eval: `${helpers}${setup}
const target = 'Level 010 - Sword';
const t0 = Date.now();
bot.walkToLocation(target);
const got = await until(async () => (await checkedNow()).has(target), 180000, 500);
return { startRegion, target, ms: Date.now() - t0, checkedInState: got, substrate: bot._resolveSubstrateId?.(startRegion), status: bot.getStatus?.(), log: (bot.getLog?.() ?? []).slice(-15), newlyChecked: [...(await checkedNow())].filter((n) => !before.has(n)), runLevel: rt.run?.level ?? null, halted: rt.halted?.message ?? null };` },
  { name: 'g_bot_play', wait: 2000, eval: `${helpers}${setup}
const t0 = Date.now();
const total = Object.values(sm.getLastRawJsonData().rawJsonData.regions[String(sm.stateManagerProxySingleton.getStaticData().playerId)]).reduce((n, r) => n + (r.locations ?? []).filter((l) => l.id !== null && l.id !== undefined).length, 0);
const progress = [];
let last = before.size; let lastT = Date.now();
bot.play();
const goal = () => (window.__lines || []).some((m) => /goal|Goal/.test(m)) ;
await until(async () => { const n = (await checkedNow()).size; if (n !== last) { progress.push([Math.round((Date.now() - t0) / 1000), n]); last = n; lastT = Date.now(); }
  return n >= total || !!rt.halted || (Date.now() - lastT > 300000); }, ${PLAY_MS}, 2000);
bot.stop?.();
const after = await checkedNow();
return { startRegion, total, checked: after.size, ms: Date.now() - t0, progress, status: bot.getStatus?.(), log: (bot.getLog?.() ?? []).slice(-25), halted: rt.halted?.message ?? null, runLevel: rt.run?.level ?? null,
  unchecked: Object.values(sm.getLastRawJsonData().rawJsonData.regions[String(sm.stateManagerProxySingleton.getStaticData().playerId)]).flatMap((r) => (r.locations ?? []).filter((l) => l.id !== null && l.id !== undefined).map((l) => l.name)).filter((n) => !after.has(n)) };` },
];
