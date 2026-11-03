import { appendFileSync } from 'node:fs';
Error.stackTraceLimit = 60;
const oa = Object.assign;
Object.assign = function (t, ...s) { if (t instanceof Error && s[0]?.code === 'FROZEN_TICK_PRESS') appendFileSync('/tmp/claude-0/-home-user-Archipelago-CC/2426a707-22a9-5989-869e-3a7c058a09aa/scratchpad/w0/froz-stacks.txt', t.message.slice(0, 200) + '\n' + new Error('cap').stack.split('\n').slice(2, 30).join('\n') + '\n----\n'); return oa.call(Object, t, ...s); };
