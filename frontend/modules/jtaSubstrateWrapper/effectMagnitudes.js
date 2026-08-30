// Magnitude priors for migrated declarative effect kinds (Phase-D effects
// migration, jta-synthetic-post-v1-design.md §4.3).
//
// Each migrated kind records its VANILLA EXEMPLARS — the magnitudes and
// roster positions the compiled branches carried before migration — and the
// sampling priors the generator draws from when it places the effect freely.
// Priors start as the vanilla exemplar span; the §4.3 one-knob perturbation
// protocol widens them to a VALIDATED range when novel territory is
// explored (update the `priors` field with the evidence, and cite the
// sweep).
//
// Shape (generalized for multi-param kinds at rung 2):
//   exemplars[].params — the effect entry's payload fields verbatim (the
//     exporter emits `{kind, ...params, scope}`);
//   priors — per numeric field the generator may re-sample when it
//     re-places an entry of this kind; fields absent here (e.g. `curve`)
//     are preserved verbatim on re-placement.
//
// Companion to datasetBehaviors.js (the not-yet-migrated slot keys): when a
// behavior key migrates, its slot entry moves here as exemplars. The
// exporter (export-vanilla-dataset.mjs) re-expresses the vanilla fixture
// from `exemplars`, so this table is cross-checked against engine behavior
// by the dataset-lockstep parity gate every time the fixture regenerates —
// a wrong magnitude here fails tick-identity, which is why no separate
// build-introspection cross-check exists.

export const EFFECT_MAGNITUDES = Object.freeze({
  // All-skill XP multiplier while the carrying perk is held (scope "run";
  // fork EFFECTS.xp_all_mult_run, single calcSkillXp site). Migrated from
  // perk behavior keys xp_all_mult_a/_b (Fork 1.9).
  xp_all_mult: Object.freeze({
    scope: "run",
    exemplars: Object.freeze([
      Object.freeze({ roster: "perks", slot: 1, enumName: "Writing", params: Object.freeze({ mult: 1.5 }) }),
      Object.freeze({ roster: "perks", slot: 33, enumName: "GazedBeyondTheVeil", params: Object.freeze({ mult: 2 }) }),
    ]),
    // Sampling prior = the vanilla exemplar span. Not yet widened by a
    // perturbation-ladder sweep.
    priors: Object.freeze({ mult: Object.freeze({ min: 1.5, max: 2 }) }),
  }),
  // Perk-granted starting-energy bonus (scope "run"; fork
  // EFFECTS.starting_energy_flat_run / starting_energy_growth_run).
  // Migrated from perk behavior keys starting_energy_flat /
  // starting_energy_growth (Fork 1.10). Two variants — flat (once on perk
  // grant) and per_reset + curve "linear" (per-energy-reset growth) — each
  // with a single vanilla exemplar, so both priors are degenerate spans
  // until a perturbation-ladder sweep widens them.
  starting_energy: Object.freeze({
    scope: "run",
    exemplars: Object.freeze([
      Object.freeze({ roster: "perks", slot: 4, enumName: "EnergySpell", params: Object.freeze({ flat: 50 }) }),
      Object.freeze({ roster: "perks", slot: 19, enumName: "EnergeticMemory", params: Object.freeze({ per_reset: 0.1, curve: "linear" }) }),
    ]),
    priors: Object.freeze({
      flat: Object.freeze({ min: 50, max: 50 }),
      per_reset: Object.freeze({ min: 0.1, max: 0.1 }),
    }),
  }),
  // Perk-granted time compression (scope "run"; fork
  // EFFECTS.time_compression_scale_run / time_compression_single_tick_run).
  // Migrated from perk behavior keys time_compression_major /
  // time_compression_minor (Fork 1.11). Two variants discriminated by field
  // presence — `mult` (scale: task speed & zone drain ×mult, single-tick
  // compensated, single-tick tasks complete all reps in one tick) and
  // `single_tick_drain_mult` (single-tick drain ×value, free zones
  // auto-skipped) — each with a single vanilla exemplar, so both priors are
  // degenerate spans until a §4.3 perturbation-ladder sweep widens them
  // (the scale mult is THE pacing lever §4.3 names: a 10× scale collapses
  // the reset economy — sweep before the generator varies it).
  time_compression: Object.freeze({
    scope: "run",
    exemplars: Object.freeze([
      Object.freeze({ roster: "perks", slot: 23, enumName: "MajorTimeCompression", params: Object.freeze({ mult: 1.5 }) }),
      Object.freeze({ roster: "perks", slot: 7, enumName: "MinorTimeCompression", params: Object.freeze({ single_tick_drain_mult: 0.2 }) }),
    ]),
    priors: Object.freeze({
      mult: Object.freeze({ min: 1.5, max: 1.5 }),
      single_tick_drain_mult: Object.freeze({ min: 0.2, max: 0.2 }),
    }),
  }),
});
