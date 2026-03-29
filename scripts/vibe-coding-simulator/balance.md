# Balance Variables

Variables in `SimulationConfig` that affect game balance. Grouped by what they affect.

## Pacing — How long a playthrough takes

| Variable | Current | Effect |
|---|---|---|
| `time_scale` | 60.0 | Simulated seconds per real second. Higher = faster game. At 60, one real minute = one simulated hour. |
| `base_task_duration` | 10.0 | Base minutes per subtask before variance. With 5 subtasks per task, a typical task takes ~50 simulated minutes (~1 hour). |
| `implement_progress_per_task` | 1.0 | Completion gained per successful implement task. At 1.0, each phase completes in a single task. |

**Derived pacing:** With 20 phases, 1 task each, ~50 min per task, that's ~1000 simulated minutes (~17 hours) for a solo playthrough. At 60x time scale, that's ~17 real minutes. With 2 instances in parallel, roughly 10-12 real minutes depending on blocking and regressions.

## Task Duration Variance — Unpredictability

| Variable | Current | Effect |
|---|---|---|
| `duration_log_sigma` | 0.6 | Standard deviation of the log-normal distribution for subtask durations. At 0.6, most tasks are 0.5x–2x the base duration, but outliers can be 0.2x or 5x. |

**Tuning guide:**
- 0.3 = mild variance, tasks are fairly predictable
- 0.6 = moderate variance (current), occasional surprises
- 1.0 = high variance, some tasks take 10x longer than others
- 1.5 = extreme, "is Claude stuck?" becomes a real question

This is the core variable for the "cancel and retry" decision. Higher sigma means more value in recognizing stuck tasks.

## Credits — Resource Pressure

| Variable | Current | Effect |
|---|---|---|
| `weekly_credits` | 5040.0 | Credits available per week. Enough for 1 instance × 12 hours/day × 7 days. |
| `week_duration` | 10080.0 | Length of one week in simulated minutes (7 × 24 × 60). |
| `credit_rate` | 1.0 | Credits consumed per simulated minute per running instance. |

**Derived budget:** 5040 credits = 84 hours of single-instance time per week. One instance running 12h/day uses exactly one week's budget. Two instances running 12h/day would exhaust credits in 3.5 days. The strategic tension is how aggressively to run parallel instances early in the week.

**Credit hours display:** The UI shows credits as hours remaining (credits ÷ 60), making the budget intuitive.

## Regressions — Setbacks and Tension

| Variable | Current | Effect |
|---|---|---|
| `regression_rate` | 0.25 | Probability of regression per completed task (commit). 1 in 4. |
| `regression_local_weight` | 0.7 | Probability that a regression hits the phase being worked on. |
| `regression_adjacent_weight` | 0.2 | Probability that it hits a different phase in the same feature. |
| `regression_remote_weight` | 0.1 | Probability that it hits a phase in a different feature. |
| `regression_severity_mean` | 0.15 | Average completion lost from a regression (Gaussian, σ = 0.05). |

**Expected impact:** With `implement_progress_per_task` at 1.0, a regression loses ~15% of a completed phase. Since phases complete in one task, a regression on a "done" phase means it needs a partial re-do. On average, 1 in 4 tasks causes a regression, so roughly every 4th phase completion comes with a setback somewhere.

**Proximity weights must sum to 1.0.**

## Merge Conflicts

| Variable | Current | Effect |
|---|---|---|
| `merge_conflict_rate` | 0.25 | Probability of conflict when a completing instance overlaps with another instance on the same or related feature. 1 in 4. |

**When conflicts trigger:** Same feature = full rate (25%). Shared dependencies = half rate (12.5%). Unrelated features = no conflict.

**Resolution:** The player must assign a Claude instance to resolve the conflict (a separate task). Resolution can also cause regressions. The original progress is applied on successful resolution.

## Inline Testing — Claude's Self-Correction

| Variable | Current | Effect |
|---|---|---|
| `inline_regression_catch_rate` | 0.6 | Probability that Claude catches a regression during its own testing (before committing). Caught regressions add fix cycles to the task. |

**Effective shipped regression rate:** `regression_rate × (1 - inline_regression_catch_rate)` = 0.25 × 0.4 = 0.10 (10% of commits ship regressions). The other 15% are caught and fixed inline, costing time but not progress.

**Player decision:** The "end-testing" command skips inline regression testing, saving time but shipping whatever regressions exist.

## CI Test Workflow

| Variable | Current | Effect |
|---|---|---|
| `test_workflow_duration` | 10.0 | Simulated minutes for the full test suite to run. |

**Strategic impact:** At 10 minutes (10 real seconds at 60x), test workflows are quick enough to run frequently. Increasing this creates more tension around when to run tests vs. keep coding.

## Not Yet Implemented

These variables from the planning doc don't exist yet but would affect balance:

| Variable | Description |
|---|---|
| Task duration scaling by phase complexity | Using LOC estimates to vary base duration per phase |
| Context degradation | Error rate increasing over long conversations |
| Model selection | Different Claude models with different speed/accuracy/cost tradeoffs |
| Human fatigue | Simulating the player's own energy/attention over a work day |
