// Measure-only: replay every captured solve request of a leg file in node, reading the press-kill guard counters.
// argv: <repoRoot> <legs-with-requests.jsonl> <out.jsonl>; the guards follow SEEDLING_PRESS_KILL_*_GUARD in env.
import { appendFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
const [root, file, out] = process.argv.slice(2);
const { replayOnce } = await import(pathToFileURL(`${root}/scripts/procgen/replay-seedling-solve-request.mjs`).href);
const g = await import(pathToFileURL(`${root}/frontend/modules/seedlingDemo/pressKillGuards.js`).href);
for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const leg = JSON.parse(line);
    for (const q of leg.requests) {
        const before = { ...g.PRESS_KILL_GUARD_COUNTS };
        let r;
        try { r = await replayOnce(q.request); } catch (e) { r = { ok: false, kind: 'THREW', answer: null, message: String(e?.message ?? e).slice(0, 300) }; }
        const after = g.PRESS_KILL_GUARD_COUNTS;
        appendFileSync(out, JSON.stringify({ id: leg.id, i: q.i, guards: g.PRESS_KILL_SHAKE_GUARD.enabled && g.PRESS_KILL_REBOOT_GUARD.enabled,
            shakeRefused: after.shakeRefused - before.shakeRefused, rebootRefused: after.rebootRefused - before.rebootRefused,
            ok: r.ok, kind: r.kind, answer: r.answer, work: r.work ?? null, ms: r.ms ?? null, message: r.message ?? null,
            page: { ok: q.result?.ok ?? null, kind: q.result?.kind ?? null, work: q.result?.work ?? null } }) + '\n');
    }
}
