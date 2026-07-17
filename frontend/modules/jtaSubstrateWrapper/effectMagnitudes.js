// Magnitude priors for migrated declarative effect kinds (Phase-D effects
// migration, jta-synthetic-post-v1-design.md §4.3).
//
// Each migrated kind records its VANILLA EXEMPLARS — the magnitudes and
// roster positions the compiled branches carried before migration — and the
// sampling prior the generator draws from when it places the effect freely.
// The prior starts as the vanilla exemplar span; the §4.3 one-knob
// perturbation protocol widens it to a VALIDATED range when novel
// territory is explored (update the `prior` field with the evidence, and
// cite the sweep).
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
      Object.freeze({ roster: "perks", slot: 1, enumName: "Writing", mult: 1.5 }),
      Object.freeze({ roster: "perks", slot: 33, enumName: "GazedBeyondTheVeil", mult: 2 }),
    ]),
    // Sampling prior = the vanilla exemplar span. Not yet widened by a
    // perturbation-ladder sweep.
    prior: Object.freeze({ min: 1.5, max: 2 }),
  }),
});
