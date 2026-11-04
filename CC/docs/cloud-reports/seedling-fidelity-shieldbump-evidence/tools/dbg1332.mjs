const D = '/tmp/claude-0/sbwt/frontend/modules/seedlingDemo/';
const { loadTape } = await import(D + 'fixtures/index.js');
const { createTapeStepper } = await import(D + 'tapeRunner.js');
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { playerShieldRect, shieldBumpTouches } = await import(D + 'bobBossFight.js');
const { spinnerRect } = await import(D + 'spinner.js');
let run = null;
const st = createTapeStepper(loadTape('l40button-l42-part0'), { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) {
  if (run && run.ticksCompleted >= 1316 && run.ticksCompleted <= 1334) {
    const s = run.state; const si = run.slashInfo ?? null;
    const b = (run.entities('spinnerBodies') ?? []).find((x) => x.id === 'spinner@192,160');
    console.log(run.ticksCompleted, JSON.stringify({ x: +s.x.toFixed(2), y: +s.y.toFixed(2), vx: +s.vx.toFixed(3), vy: +s.vy.toFixed(3), dir: s.direction,
      slashing: si?.state?.slashing, endsAt: si?.endsAt, held: [...(r.value.held ?? [])].join('+'), body: b && [b.rect.x, b.rect.y].map((v) => +v.toFixed(2)),
      hits: run.playerHits.filter((h) => h.t >= 1310).map((h) => h.t) }));
  }
  r = st.next();
}
