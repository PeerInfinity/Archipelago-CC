// W0 instrument: preloaded with --import. Logs (1) every OPP decision inside execKillByPressOnce taken on a tick the
// freeze forecast marks refused, and every OPP ask on such a tick; (2) every FROZEN_TICK_PRESS throw with its stack.
import { appendFileSync } from 'node:fs';
Error.stackTraceLimit = 80;
const OUT = process.env.OPPF_W0_OUT;
const tag = process.env.OPPF_W0_TAG ?? '';
const cnt = { asked: 0, askedRefused: 0, tookOnRefused: 0, froz: 0, frozInPressKill: 0 };
globalThis.__OPPF_W0 = (run, d, offered) => {
  cnt.asked++;
  const ff = run.progress('freezeForecast');
  if (!ff?.refusedNext) return;
  cnt.askedRefused++;
  const row = { tag, kind: 'ask-refused', t: run.ticksCompleted, decision: d.decision, target: d.target?.id ?? d.target ?? null,
    offered: offered.length, ff };
  if (d.decision !== 'none') { cnt.tookOnRefused++; row.kind = 'took-on-refused'; row.stack = new Error('cap').stack.split('\n').slice(2, 14).join('\n'); }
  appendFileSync(OUT, JSON.stringify(row) + '\n');
};
const oa = Object.assign;
Object.assign = function (t, ...s) {
  if (t instanceof Error && s[0]?.code === 'FROZEN_TICK_PRESS') {
    cnt.froz++;
    const st = new Error('cap').stack;
    const pk = st.includes('execKillByPressOnce');
    if (pk) cnt.frozInPressKill++;
    appendFileSync(OUT, JSON.stringify({ tag, kind: 'froz', inPressKill: pk, msg: t.message.slice(0, 300), stack: st.split('\n').slice(2, 40).join('\n') }) + '\n');
  }
  return oa.call(Object, t, ...s);
};
process.on('exit', () => appendFileSync(OUT, JSON.stringify({ tag, kind: 'summary', pid: process.pid, ...cnt }) + '\n'));
