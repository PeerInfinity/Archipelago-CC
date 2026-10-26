#!/usr/bin/env node
/**
 * Measure-only (slice FF, from L371's tool + a HAMMER_FIGHT_FALLBACK_TRACE sink). One captured solve request (`--capture-requests` line), replayed in THIS process the
 * worker's way (`solveAnytime`), optionally at another arrival clock (`--seam=<time>`: `atSeamTime`, only
 * `staging.seam.time` moves). Switches are set by env only, before the import. Prints one `RESULT <json>` line:
 * per pass the full refusal text, its code / obstacle / progress kind, the work, and the progress snapshot at the
 * pass's last `done` (tree rejection kinds, `lastWhy`, `frame`); the press-kill guard counters; the answer sha.
 *
 * Run: node l371-solve.mjs --requests=<jsonl> [--id=371] [--i=0] [--seam=<time>] [--tree]
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const arg = (k, d = null) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=') || d;
const flag = (k) => process.argv.includes(`--${k}`);
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const R = 'file:///home/user/Archipelago-CC/';
const rel = (p) => new URL(p, R).href;

const { restoreRequest } = await import(rel('scripts/procgen/seedlingSolveRequestCodec.js'));
const { atSeamTime } = await import(rel('scripts/procgen/replay-seedling-solve-request.mjs'));
const { levelSourceFromAtlas } = await import(rel('frontend/modules/seedlingDemo/atlasSource.js'));
const { solveAnytime, ANYTIME_PASSES } = await import(process.env.DEVJ ?? rel('frontend/modules/seedlingDemo/jsRuntimeSolver.js'));
const { withSolveProgress, progressKind } = await import(rel('frontend/modules/seedlingDemo/solveProgress.js'));
const guards = await import(rel('frontend/modules/seedlingDemo/pressKillGuards.js'));
const sb = await import(rel('frontend/modules/seedlingDemo/solverBot.js'));
const { CONTACT_FIDELITY } = await import(rel('frontend/modules/seedlingDemo/contactFidelity.js'));

const id = Number(arg('id', '371'));
const ii = Number(arg('i', '0'));
const line = readFileSync(arg('requests'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((d) => d.id === id);
let captured = line.requests.find((q) => q.i === ii).request;
const seam0 = captured.staging?.seam?.time;
if (arg('seam') !== null) captured = atSeamTime(captured, Number(arg('seam')));
const req = restoreRequest(captured);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);

const flatKinds = (n, out = {}) => {
    if (!n) return out;
    for (const [k, v] of Object.entries(n.rejectionKinds ?? {})) out[k] = (out[k] ?? 0) + v;
    for (const c of n.children ?? []) flatKinds(c, out);
    return out;
};
const leaves = (n, path = [], out = []) => {
    if (!n) return out;
    const p = [...path, n.label ?? n.key];
    const rj = n.rejections ?? {};
    if (Object.keys(rj).length) out.push({ path: p.join(' / ').slice(-260), attempts: n.attempts, successes: n.successes, rejections: rj });
    for (const c of n.children ?? []) leaves(c, p, out);
    return out;
};

let snap = null;
const snaps = [];
const outPasses = [];
const ffRows = [];
sb.HAMMER_FIGHT_FALLBACK_TRACE.sink = (row) => ffRows.push({ ...row, ms: undefined });
const t0 = Date.now();
const answer = withSolveProgress((site, peek) => {
    if (site === 'done') { snap = peek(); snaps.push(snap); }
}, () => solveAnytime({ ...tape, source, levelSource }, {
    passes,
    onPass: (one) => {
        const s = snaps.at(-1) ?? null;
        outPasses.push({
            pass: one.pass, ok: one.ok, kind: one.kind ?? null,
            ticks: one.ok ? one.plan.solution.length : null,
            code: one.code ?? one.error?.code ?? null,
            obstacle: one.obstacle ?? null,
            progressKind: one.ok ? null : progressKind(one),
            message: one.ok ? null : String(one.message ?? ''),
            answer: one.ok ? sha(JSON.stringify(one.plan.solution.map((k) => [...k]))) : sha(String(one.message ?? '')),
            snapshot: s && {
                outcome: s.segment?.outcome, kinds: flatKinds(s.tree), lastWhy: s.lastWhy, frame: s.frame,
                asks: s.budget?.asks, ...(flag('tree') ? { leaves: leaves(s.tree) } : {}),
            },
        });
        snaps.length = 0;
    },
}));
const text = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : String(answer.message ?? '');
const result = {
    id, i: ii, seamCaptured: seam0, seam: req.staging?.seam?.time ?? null, ok: answer.ok, kind: answer.kind ?? null,
    work: answer.work ?? null, ticks: answer.ok ? answer.plan.solution.length : null, answer: sha(text),
    rows: answer.passes, passes: outPasses, guards: { ...guards.PRESS_KILL_GUARD_COUNTS },
    switches: {
        shakeGuard: guards.PRESS_KILL_SHAKE_GUARD.enabled, rebootGuard: guards.PRESS_KILL_REBOOT_GUARD.enabled,
        strikeEtaFloor: sb.STRIKE_ETA_FLOOR.enabled, hammerEscape: sb.HAMMER_ESCAPE.enabled,
        hammerApproach: sb.HAMMER_APPROACH.enabled, hammerFight: sb.HAMMER_FIGHT.enabled,
        bombBlastBody: CONTACT_FIDELITY.bombBlastBody, movingWait: CONTACT_FIDELITY.movingWait,
    },
    ms: Date.now() - t0, ff: ffRows, expected: answer.ok ? answer.plan.expected.length : null, equips: answer.ok ? [...answer.plan.equipsAt] : null, expectedSha: answer.ok ? sha(JSON.stringify(answer.plan.expected)) : null, equipItemsSha: answer.ok ? sha(JSON.stringify([...answer.plan.equipItems])) : null, ffOn: sb.HAMMER_FIGHT_FALLBACK.enabled,
};
console.log(`RESULT ${JSON.stringify(result)}`);
