// usage: node rep1.mjs <jsonl> <id> <i>
import { readFileSync } from 'node:fs';
const [,, file, id, i] = process.argv;
const { replayOnce } = await import('/home/user/Archipelago-CC/scripts/procgen/replay-seedling-solve-request.mjs');
const leg = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = leg.requests.find((r) => String(r.i) === i);
if (process.env.BUDGET) req.request.budgetWork = Number(process.env.BUDGET);
const out = await replayOnce(req.request);
console.log(JSON.stringify({ ok: out.ok, answer: out.answer, work: out.work, message: out.message, passes: out.passes }));
