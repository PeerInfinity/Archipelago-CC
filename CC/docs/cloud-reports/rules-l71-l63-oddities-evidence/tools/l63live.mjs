#!/usr/bin/env node
// rules-l71-l63-oddities: L63 r6c9 -> r0c1, CLOSED LOOP ON THE GAME (wasm p4g, headless logic-only, the box lock).
//   node l63live.mjs [--arm=A-spear-only,B-control-flag1] [--damage]
// The model does not move a PushableBlockSpear, so the tape is driven on the GAME itself: one page per arm carries a
// chain of short continuation windows with the same boot (Bot.as botStart rebuilds the world only when the boot level
// or position differs from the live one — the killlock-arms probe's mechanism), each window's keys chosen from the
// game's own player position. Booted at cell (9,6) of L63 (r6c9), granted only the Spear; noDamage true unless --damage
// (the jellyfish knock the player into pits otherwise, which resets the room). Every window's tape is concatenated into
// <arm>.tape.json (the inputs as played) and every 5th tick sampled into <arm>.live.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const { parseTape, PIN_NAMES, gameVisibleTape } = await import(join(R, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const T = 16; const C = (c) => c * T + 8;
const NO_DAMAGE = !process.argv.includes('--damage');
const out = join(R, 'CC/docs/cloud-reports/rules-l71-l63-oddities-evidence/witness'); mkdirSync(out, { recursive: true });
const header = (name, persistence, ticks, inputs, seed) => ({
  tape_version: 8, game: 'seedling', name: `l63-live-${name}`, description: 'rules-l71-l63-oddities l63live (closed loop on the game)',
  boot: { level: 63, x: 9 * T, y: 6 * T }, noclip: false, noDamage: NO_DAMAGE, noHazards: [],
  grants: [{ level: 63, items: ['spear'] }], persistence, equips: [], pins: [...PIN_NAMES],
  save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed, split: false }, seam: {}, tick_count: ticks, inputs,
});
const { chromium } = await import('playwright');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;
takeBoxLockOrExit({ name: 'rules-l71-l63-oddities l63live', kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const ent = (mob) => mob.filter((r) => /PushableBlock|DarkTrap/.test(r.cls)).map((r) => `${r.cls.split('::').pop()}(${Math.round(r.x)},${Math.round(r.y)})${r.destroy ? 'X' : ''}`).join(' ');
async function session(name, persistence) {
  const page = await browser.newPage();
  const bot = (n, a) => page.evaluate(([nn, x]) => String(x === undefined ? window.__swfBridge.game[nn]() : window.__swfBridge.game[nn](x)), [n, a]);
  const J = async (n, a) => JSON.parse(await bot(n, a));
  await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 720 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
  await page.click('#btn-start');
  for (let i = 0; i < 720 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
  await assertLogicOnlyChannel(page);
  const played = []; const samples = []; let first = true; let now = { x: C(9), y: C(6) }; let tick = 0; const log = [];
  const win = async (keys, n) => {   // keys: array of key names held for n ticks
    const inputs = keys.map((k) => ({ key: k, from: 0, to: n }));
    const tape = parseTape(header(name, persistence, n, inputs, first ? 1 : 0));
    first = false;
    if (await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
    if (await bot('botStart') !== 'ok') throw new Error('botStart');
    for (const dl = Date.now() + 120000; ;) { const st = await J('botStatus'); if (st.error) throw new Error(st.error); if (st.finished) break; if (Date.now() > dl) throw new Error('deadline'); await page.waitForTimeout(15); }
    const st = await J('botStatus'); const mob = (await J('botMobiles')).mobiles ?? [];
    for (const k of keys) played.push({ key: k, from: tick, to: tick + n });
    tick += n; now = { x: st.x, y: st.y, level: st.level };
    const s = { t: tick, level: st.level, x: +st.x.toFixed(2), y: +st.y.toFixed(2), hits: st.hits, ents: ent(mob), cleared: (st.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`).join(',') };
    samples.push(s); return s;
  };
  const a = {
    get x() { return now.x; }, get y() { return now.y; },
    hold: async (k, n) => win(k ? [k] : [], n),
    go: async (axis, target, max = 60) => { for (let i = 0; i < max; i++) { const v = axis === 'x' ? now.x : now.y; const d = target - v; if (Math.abs(d) <= 0.75) return true; await win([axis === 'x' ? (d > 0 ? 'right' : 'left') : (d > 0 ? 'down' : 'up')], Math.max(1, Math.min(8, Math.floor(Math.abs(d) / 1.6)))); } return false; },
    thrust: async (dir, gap = 50) => { await win([dir], 1); await win(['primary'], 1); return win([], gap); },
    note: (m) => { log.push(`t${tick} ${m}`); console.log(`  ${name} t${tick} ${m} @(${now.x.toFixed(1)},${now.y.toFixed(1)}) L${now.level}`); },
  };
  return { a, done: async () => { await page.close(); return { played, samples, log, tick }; } };
}
const ARMS = {
  'A-spear-only': [],
  'B-control-flag1': [{ level: 63, tag: 1 }],
};
const names = arg('arm') ? arg('arm').split(',') : Object.keys(ARMS);
try {
  for (const name of names) {
    const { a, done } = await session(name, ARMS[name]);
    let s = await a.hold(null, 1); a.note(`boot ${s.ents} cleared[${s.cleared}]`);
    s = await a.thrust('left'); a.note(`thrust W from (9,6): ${s.ents}`);
    await a.go('y', C(8)); await a.go('x', C(7)); a.note('at (7,8)');
    await a.go('y', C(6)); a.note('north up column 7 (stops at the block or enters (7,6))');
    s = await a.thrust('left'); a.note(`thrust W from column 7: ${s.ents}`);
    await a.go('x', C(6)); a.note('west into (6,6)');
    await a.hold('up', 12); s = await a.thrust('left'); a.note(`thrust W hugging north wall: ${s.ents} cleared[${s.cleared}]`);
    s = await a.thrust('left', 80); a.note(`thrust W again: ${s.ents} cleared[${s.cleared}]`);
    await a.hold('down', 12); s = await a.thrust('left', 80); a.note(`thrust W hugging south wall: ${s.ents} cleared[${s.cleared}]`);
    // walk on to r0c1: (4,6) [the trap's cell], then south to (4,7), then west to (3,7) — r0c1's own tiles.
    await a.go('x', C(4)); a.note('west toward (4,6)');
    await a.go('y', C(7)); a.note('south toward (4,7)');
    await a.go('x', C(3)); a.note('west toward (3,7) = r0c1');
    await a.hold(null, 30); a.note('settle');
    const r = await done();
    const end = r.samples.at(-1);
    const row = { arm: name, persistence: ARMS[name], noDamage: NO_DAMAGE, ticks: r.tick, end: { level: end.level, x: end.x, y: end.y, cell: [Math.floor(end.x / T), Math.floor(end.y / T)] },
      minX: Math.min(...r.samples.map((q) => q.x)), cleared: end.cleared, ents: end.ents };
    console.log('ROW', JSON.stringify(row));
    writeFileSync(join(out, `${name}.live.json`), JSON.stringify({ row, log: r.log, samples: r.samples }, null, 0).replace(/},{/g, '},\n{'));
    writeFileSync(join(out, `${name}.tape.json`), JSON.stringify(parseTape(header(name, ARMS[name], r.tick, r.played, 1))));
  }
} finally { await browser.close(); }
