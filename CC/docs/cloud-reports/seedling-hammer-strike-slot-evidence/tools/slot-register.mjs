// MEASUREMENT ONLY. `node --import ./slot-register.mjs <script>`: every PRESS a `strikePolicyFor` policy decides (its
// `decide` returns `primary` in the held set) is counted, with the run's `primaryWeapon` at that tick; a press whose
// weapon is not a blade (`sword` / `ghostsword`) is a row: level, tick, driven or preview, the weapon, the policy's
// trace row (target, dash, planned), the walking stack (12 frames), and, for a DRIVEN press (asked by the drive), what the model did
// with it (the run's `presses` ledger rows of that press tick: weapon, hits). Written at exit to $SLOT_OUT (jsonl).
import { register } from 'node:module';
register(new URL('./slot-loader.mjs', import.meta.url).href);
const BLADES = new Set(['sword', 'ghostsword']);
const S = globalThis.__slotStats = { policies: 0, presses: 0, driven: 0, preview: 0, byWeapon: {}, rows: [] };
const runs = new Set();
const frames = () => (new Error().stack ?? '').split('\n').slice(3)
    .map((l) => l.match(/at (?:Object\.)?([\w$.]+) \(.*\/(solverBot|botDriverV2|pressKillCost|bulbPlacement|[\w]+)\.js:(\d+)/))
    .filter(Boolean).map((m) => `${m[1]}@${m[2]}:${m[3]}`).filter((f) => !f.startsWith('decide@')).slice(0, 12);
globalThis.__slotWrap = (run, policy) => {
    S.policies += 1;
    const inner = policy.decide;
    policy.decide = function decide(state, bodies, tick, walkHeld, opts) {
        const out = inner.call(this, state, bodies, tick, walkHeld, opts);
        if (!out?.held?.has?.('primary') || walkHeld?.has?.('primary')) return out;
        const weapon = run.progress('primaryWeapon');
        const stack = frames();
        // driven = not asked from inside a preview (`previewWalk`'s `combatBefore` is the preview's one call site)
        const driven = !stack.some((f) => /^(previewWalk|combatBefore)@/.test(f));
        S.presses += 1;
        S[driven ? 'driven' : 'preview'] += 1;
        const k = `${driven ? 'driven' : 'preview'}:${weapon}`;
        S.byWeapon[k] = (S.byWeapon[k] ?? 0) + 1;
        if (BLADES.has(weapon)) return out;
        const tr = policy.trace.at(-1) ?? {};
        const row = { level: run.level, tick, now: run.ticksCompleted, driven, weapon,
            primary: run.progress('primary'), slots: run.progress('inventorySlots'),
            x: state.x, y: state.y, decision: out.decision, target: tr.target ?? null, dash: tr.dash ?? null,
            planned: tr.planned ?? false, held: [...out.held].sort().join('+'), stack };
        if (driven) { row._run = run; runs.add(run); }
        S.rows.push(row);
        return out;
    };
};
if (process.env.SLOT_OUT) {
    const { appendFileSync } = await import('node:fs');
    process.on('exit', () => {
        for (const r of S.rows) {
            if (!r._run) continue;
            const led = r._run.ledger?.('presses') ?? [];
            r.game = led.filter((p) => p.t === r.tick).map((p) => ({ weapon: p.weapon, fired: p.fired,
                hits: (p.hits ?? []).map((h) => (typeof h === 'string' ? h : h.id ?? h.as3 ?? JSON.stringify(h).slice(0, 60))) }));
            r.playerHitsAfter = (r._run.ledger?.('playerHits') ?? []).filter((h) => h.t >= r.tick).length;
            delete r._run;
        }
        appendFileSync(process.env.SLOT_OUT, JSON.stringify({ tag: process.env.SLOT_TAG ?? null,
            policies: S.policies, presses: S.presses, driven: S.driven, preview: S.preview, byWeapon: S.byWeapon,
            rows: S.rows }) + '\n');
    });
}
