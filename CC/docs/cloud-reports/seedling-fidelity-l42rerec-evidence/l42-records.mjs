// The l42-part0 plan's records (verb + tick span) at the defaults vs `dashSpinnerForecast` OFF (the retired pin).
import { join } from 'node:path';
const { l40buttonPlan, L40BUTTON_WITNESSES } = await import(join(process.cwd(), 'scripts/procgen/plan-seedling-l40button-witness.mjs'));
const { withContactFidelity } = await import(join(process.cwd(), 'frontend/modules/seedlingDemo/contactFidelity.js'));
const w = L40BUTTON_WITNESSES.find((x) => x.name === 'l40button-l42-part0');
for (const [arm, run] of [['defaults', (f) => f()], ['dashSpinnerForecast OFF', (f) => withContactFidelity({ dashSpinnerForecast: false }, f)]]) {
    const { solved } = await run(() => l40buttonPlan(w.boot, w.name));
    console.log(`${arm}: ${solved.out.perTick.length} t`);
    for (const r of solved.out.records) {
        const keys = Object.keys(r).filter((k) => /tick|from|to|start|end|at$/i.test(k));
        console.log(`  ${r.strategy} ${r.target ?? r.id ?? ''} ${JSON.stringify(Object.fromEntries(keys.map((k) => [k, r[k]])))}`);
    }
}
