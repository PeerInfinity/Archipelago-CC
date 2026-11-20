// rules-lavatrap-neck: dump rule T's derivation per level (the seal pairs, the stamped traps and every arm's verdict).
//   node killArms.mjs [level ...]   (default: every level with a LavaTrap)
const R = new URL('../../../../../', import.meta.url).pathname;
const P = await import(R + 'scripts/procgen/make-seedling-playthrough-rules.mjs');
const want = process.argv.slice(2).map(Number);
for (const level of P.PLAYTHROUGH_MAP.levels) {
    if (want.length ? !want.includes(level.level) : !(level.entities ?? []).some((e) => e.type === 'lavatrap')) continue;
    P.playthroughGridFor(level);
    const t = P.playthroughTrapTongues.get(level.level);
    console.log(`L${level.level}: seals ${JSON.stringify(t?.sealed ?? null)}; stamped ${(t?.traps ?? []).map((r) => `${r.trap} ${JSON.stringify(r.condition)} on ${r.cells.length} cells`).join(' | ') || 'nothing'}`);
    for (const r of P.playthroughTrapKillArms(level)) {
        console.log(`  trap ${r.id}: arms [${r.arms}]`);
        for (const [f, v] of Object.entries(r.perArm)) {
            console.log(`    ${f}: hits ${v.hits}, spots ${v.spots} ${JSON.stringify(v.windows)}, approaches [${v.approaches.join(' ')}], killed from [${v.killedFrom.join(' ')}], order ${JSON.stringify(v.order)}, granted ${v.granted}${v.why ? ` — ${v.why}` : ''}`);
        }
    }
}
