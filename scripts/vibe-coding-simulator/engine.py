"""Vibe Coding Simulator — Core simulation engine.

Models the game state: features, phases, Claude instances, test results,
and the simulation of time, task progress, and regressions.
"""

import json
import math
import random
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


class TaskType(Enum):
    IMPLEMENT = "implement"
    INVESTIGATE = "investigate"
    WRITE_PLAN = "write_plan"
    CHECK_BLOCKED = "check_blocked"
    MERGE_CONFLICT = "merge_conflict"


class SubtaskType(Enum):
    BASELINE_TESTING = "baseline testing"
    READING_CODE = "reading code"
    PLANNING = "planning"
    IMPLEMENTING = "implementing"
    REGRESSION_TESTING = "regression testing"
    FIXING_REGRESSIONS = "fixing regressions"


IMPLEMENT_SUBTASKS = [
    SubtaskType.BASELINE_TESTING,
    SubtaskType.READING_CODE,
    SubtaskType.PLANNING,
    SubtaskType.IMPLEMENTING,
    SubtaskType.REGRESSION_TESTING,
]


@dataclass
class Phase:
    id: str
    name: str
    feature_id: str
    completion: float = 0.0  # 0.0 to 1.0
    depends_on: list[str] = field(default_factory=list)  # node IDs

    @property
    def node_id(self) -> str:
        return f"{self.feature_id}.{self.id}"

    @property
    def is_complete(self) -> bool:
        return self.completion >= 1.0


@dataclass
class Feature:
    id: str
    name: str
    phases: list[Phase] = field(default_factory=list)

    @property
    def completion(self) -> float:
        if not self.phases:
            return 0.0
        return sum(p.completion for p in self.phases) / len(self.phases)


@dataclass
class Task:
    task_type: TaskType
    target_node: str  # node ID (e.g., "DATABASE.2")
    assigned_at: float = 0.0  # simulated time when assigned

    @property
    def label(self) -> str:
        return f"{self.task_type.value}: {self.target_node}"


@dataclass
class ClaudeInstance:
    id: int
    task: Task | None = None
    subtask_index: int = 0
    subtask_progress: float = 0.0  # 0.0 to 1.0 within current subtask
    subtask_durations: list[float] = field(default_factory=list)
    credits_used: float = 0.0
    regression_fix_cycles: int = 0

    @property
    def is_idle(self) -> bool:
        return self.task is None

    @property
    def current_subtask(self) -> SubtaskType | None:
        if self.task is None:
            return None
        subtasks = IMPLEMENT_SUBTASKS
        if self.subtask_index < len(subtasks):
            return subtasks[self.subtask_index]
        # In regression fix cycles
        cycle_offset = self.subtask_index - len(subtasks)
        if cycle_offset % 2 == 0:
            return SubtaskType.FIXING_REGRESSIONS
        return SubtaskType.REGRESSION_TESTING

    @property
    def overall_progress(self) -> float:
        if self.task is None:
            return 0.0
        total = len(self.subtask_durations)
        if total == 0:
            return 0.0
        completed = self.subtask_index + self.subtask_progress
        return min(completed / total, 1.0)

    def status_label(self) -> str:
        if self.is_idle:
            return "idle"
        subtask = self.current_subtask
        if subtask:
            return subtask.value
        return "finishing"


@dataclass
class TestWorkflow:
    """A running CI test workflow."""
    started_at: float
    duration: float  # how long it takes in simulated minutes
    # Snapshot of phase completions when the workflow started
    completion_snapshot: dict[str, float] = field(default_factory=dict)
    results: dict[str, float] | None = None  # populated when done

    @property
    def is_complete(self) -> bool:
        return self.results is not None


class SimulationConfig:
    """Tunable simulation parameters."""

    def __init__(self):
        # Time
        self.time_scale: float = 60.0  # simulated seconds per real second
        self.base_task_duration: float = 10.0  # base minutes per subtask

        # Weekly credits
        # Budget: enough for 1 instance × 12 hours/day × 7 days = 5040 minutes
        # credit_rate is 1 credit per simulated minute per instance
        self.weekly_credits: float = 5040.0
        self.week_duration: float = 7 * 24 * 60.0  # 7 days in minutes
        self.credit_rate: float = 1.0  # credits per simulated minute per instance

        # Regressions
        self.regression_rate: float = 0.25  # 1 in 4 commits
        self.regression_local_weight: float = 0.7
        self.regression_adjacent_weight: float = 0.2
        self.regression_remote_weight: float = 0.1
        self.regression_severity_mean: float = 0.15  # how much completion is lost

        # Task duration variance (log-scale)
        self.duration_log_sigma: float = 0.6  # log-normal std dev

        # Implementation
        self.implement_progress_per_task: float = 1.0  # completion gained on success

        # Test workflow
        self.test_workflow_duration: float = 10.0  # minutes

        # Claude inline regression detection
        self.inline_regression_catch_rate: float = 0.6

        # Merge conflicts
        self.merge_conflict_rate: float = 0.25  # 1 in 4 when parallel instances touch related features


class GameState:
    """Complete game state."""

    def __init__(self, config: SimulationConfig | None = None):
        self.config = config or SimulationConfig()
        self.features: dict[str, Feature] = {}
        self.all_phases: dict[str, Phase] = {}  # node_id -> Phase
        self.claude_instances: list[ClaudeInstance] = []
        self.simulated_time: float = 0.0  # in minutes
        self.credits_remaining: float = self.config.weekly_credits
        self.week_start: float = 0.0
        self.test_workflow: TestWorkflow | None = None
        self.pending_merge_conflicts: list[str] = []  # node IDs needing merge resolution
        self.rng = random.Random()
        self.log: list[str] = []

    def load_depgraph(self, path: str | Path):
        """Load features and phases from a DepGraph JSON file."""
        with open(path) as f:
            data = json.load(f)

        # Group nodes by feature (plan) ID
        feature_phases: dict[str, list[dict]] = {}
        for node_id, node in data["nodes"].items():
            if "." in node_id:
                feat_id, phase_id = node_id.split(".", 1)
            else:
                feat_id, phase_id = node_id, "1"

            if feat_id not in feature_phases:
                feature_phases[feat_id] = []
            feature_phases[feat_id].append({
                "node_id": node_id,
                "phase_id": phase_id,
                "label": node["label"],
                "depends_on": node.get("depends_on", []),
            })

        for feat_id, phase_dicts in feature_phases.items():
            # Use the common prefix of labels as feature name
            first_label = phase_dicts[0]["label"]
            feat_name = first_label.split(":")[0].strip() if ":" in first_label else feat_id

            feature = Feature(id=feat_id, name=feat_name)

            for pd in phase_dicts:
                phase = Phase(
                    id=pd["phase_id"],
                    name=pd["label"],
                    feature_id=feat_id,
                    depends_on=pd["depends_on"],
                )
                feature.phases.append(phase)
                self.all_phases[pd["node_id"]] = phase

            self.features[feat_id] = feature

    def add_claude_instance(self) -> ClaudeInstance:
        """Add a new Claude instance."""
        instance = ClaudeInstance(id=len(self.claude_instances) + 1)
        self.claude_instances.append(instance)
        return instance

    def is_phase_unlocked(self, node_id: str) -> bool:
        """Check if a phase's dependencies are all complete."""
        phase = self.all_phases.get(node_id)
        if not phase:
            return False
        for dep_id in phase.depends_on:
            dep_phase = self.all_phases.get(dep_id)
            if dep_phase is None or not dep_phase.is_complete:
                return False
        return True

    def get_available_phases(self) -> list[Phase]:
        """Get phases that are unlocked, not complete, and not being worked on."""
        in_progress = set()
        for inst in self.claude_instances:
            if inst.task:
                in_progress.add(inst.task.target_node)

        available = []
        for node_id, phase in self.all_phases.items():
            if phase.is_complete:
                continue
            if node_id in in_progress:
                continue
            if self.is_phase_unlocked(node_id):
                available.append(phase)
        return available

    def assign_task(self, instance: ClaudeInstance, task_type: TaskType, target_node: str) -> bool:
        """Assign a task to a Claude instance. Returns False if invalid."""
        if not instance.is_idle:
            return False
        if target_node not in self.all_phases:
            return False
        if task_type == TaskType.IMPLEMENT and not self.is_phase_unlocked(target_node):
            return False

        task = Task(task_type=task_type, target_node=target_node, assigned_at=self.simulated_time)
        instance.task = task
        instance.subtask_index = 0
        instance.subtask_progress = 0.0
        instance.credits_used = 0.0
        instance.regression_fix_cycles = 0

        # Generate random durations for each subtask (log-normal)
        num_subtasks = len(IMPLEMENT_SUBTASKS)
        durations = []
        for _ in range(num_subtasks):
            base = self.config.base_task_duration
            duration = base * math.exp(self.rng.gauss(0, self.config.duration_log_sigma))
            durations.append(duration)
        instance.subtask_durations = durations

        self.log.append(f"[{self._time_str()}] Claude #{instance.id}: started {task.label}")
        return True

    def cancel_task(self, instance: ClaudeInstance):
        """Cancel the current task on a Claude instance."""
        if instance.task:
            self.log.append(f"[{self._time_str()}] Claude #{instance.id}: cancelled {instance.task.label}")
            instance.task = None
            instance.subtask_durations = []

    def start_test_workflow(self) -> bool:
        """Start a CI test workflow. Returns False if one is already running."""
        if self.test_workflow and not self.test_workflow.is_complete:
            return False

        snapshot = {nid: p.completion for nid, p in self.all_phases.items()}
        self.test_workflow = TestWorkflow(
            started_at=self.simulated_time,
            duration=self.config.test_workflow_duration,
            completion_snapshot=snapshot,
        )
        self.log.append(f"[{self._time_str()}] Test workflow started")
        return True

    def cancel_test_workflow(self) -> bool:
        """Cancel the running test workflow."""
        if self.test_workflow and not self.test_workflow.is_complete:
            self.log.append(f"[{self._time_str()}] Test workflow cancelled")
            self.test_workflow = None
            return True
        return False

    def tick(self, dt_real: float):
        """Advance the simulation by dt_real seconds of real time."""
        dt = dt_real * self.config.time_scale / 60.0  # convert to simulated minutes
        self.simulated_time += dt

        # Weekly credit refresh
        if self.simulated_time - self.week_start >= self.config.week_duration:
            self.credits_remaining = self.config.weekly_credits
            self.week_start = self.simulated_time
            self.log.append(f"[{self._time_str()}] Weekly credits refreshed!")

        # Update Claude instances
        for instance in self.claude_instances:
            if instance.is_idle:
                continue
            self._tick_instance(instance, dt)

        # Update test workflow
        if self.test_workflow and not self.test_workflow.is_complete:
            elapsed = self.simulated_time - self.test_workflow.started_at
            if elapsed >= self.test_workflow.duration:
                self._complete_test_workflow()

    def _tick_instance(self, instance: ClaudeInstance, dt: float):
        """Advance a single Claude instance by dt simulated minutes."""
        # Consume credits
        credit_cost = dt * self.config.credit_rate
        if self.credits_remaining <= 0:
            return  # silently paused, UI shows credit count
        self.credits_remaining = max(0, self.credits_remaining - credit_cost)
        instance.credits_used += credit_cost

        # Advance subtask progress
        if instance.subtask_index >= len(instance.subtask_durations):
            # Task complete
            self._complete_task(instance)
            return

        subtask_duration = instance.subtask_durations[instance.subtask_index]
        instance.subtask_progress += dt / subtask_duration

        if instance.subtask_progress >= 1.0:
            instance.subtask_progress = 0.0
            instance.subtask_index += 1

            # Check if we just finished the main subtasks
            if instance.subtask_index >= len(IMPLEMENT_SUBTASKS):
                # Roll for regression during inline testing
                if self._roll_inline_regression(instance):
                    # Add fix cycle: fixing + re-testing
                    fix_duration = self.config.base_task_duration * math.exp(
                        self.rng.gauss(0, self.config.duration_log_sigma)
                    )
                    test_duration = self.config.base_task_duration * 0.5 * math.exp(
                        self.rng.gauss(0, self.config.duration_log_sigma)
                    )
                    instance.subtask_durations.extend([fix_duration, test_duration])
                    instance.regression_fix_cycles += 1
                    self.log.append(
                        f"[{self._time_str()}] Claude #{instance.id}: "
                        f"found regression during testing, attempting fix"
                    )

    def _roll_inline_regression(self, instance: ClaudeInstance) -> bool:
        """Roll for whether Claude's inline regression tests catch an issue."""
        if self.rng.random() < self.config.regression_rate:
            if self.rng.random() < self.config.inline_regression_catch_rate:
                return True  # Caught it, needs fix cycle
        return False

    def _complete_task(self, instance: ClaudeInstance):
        """Handle task completion for a Claude instance."""
        task = instance.task
        if not task:
            return

        target = self.all_phases.get(task.target_node)
        if not target:
            instance.task = None
            return

        if task.task_type == TaskType.IMPLEMENT:
            # Check for merge conflict with other running instances
            if self._check_merge_conflict(instance):
                self.pending_merge_conflicts.append(task.target_node)
                self.log.append(
                    f"[{self._time_str()}] MERGE CONFLICT: Claude #{instance.id}'s "
                    f"work on {task.target_node} conflicts with another instance"
                )
                instance.task = None
                instance.subtask_durations = []
                return

            # Increase completion
            progress = self.config.implement_progress_per_task
            old_completion = target.completion
            target.completion = min(1.0, target.completion + progress)
            self.log.append(
                f"[{self._time_str()}] Claude #{instance.id}: completed {task.label} "
                f"({old_completion:.0%} → {target.completion:.0%})"
            )

            # Roll for regression on commit
            if self.rng.random() < self.config.regression_rate:
                self._apply_regression(task.target_node)

        elif task.task_type == TaskType.MERGE_CONFLICT:
            # Merge conflict resolution
            if task.target_node in self.pending_merge_conflicts:
                self.pending_merge_conflicts.remove(task.target_node)
            # Apply the original progress
            progress = self.config.implement_progress_per_task
            old_completion = target.completion
            target.completion = min(1.0, target.completion + progress)
            self.log.append(
                f"[{self._time_str()}] Claude #{instance.id}: resolved merge conflict "
                f"on {task.target_node} ({old_completion:.0%} → {target.completion:.0%})"
            )
            # Merge conflict resolution can also cause regressions
            if self.rng.random() < self.config.regression_rate:
                self._apply_regression(task.target_node)

        instance.task = None
        instance.subtask_durations = []

    def _check_merge_conflict(self, completing_instance: ClaudeInstance) -> bool:
        """Check if a completing task conflicts with other running instances."""
        task = completing_instance.task
        if not task:
            return False

        completing_feature = task.target_node.split(".")[0]

        for other in self.claude_instances:
            if other.id == completing_instance.id or other.is_idle:
                continue
            if not other.task:
                continue
            other_feature = other.task.target_node.split(".")[0]

            # Conflict if working on same feature or features that share deps
            if other_feature == completing_feature:
                return self.rng.random() < self.config.merge_conflict_rate

            # Check for shared dependencies (features that depend on each other)
            completing_phase = self.all_phases.get(task.target_node)
            other_phase = self.all_phases.get(other.task.target_node)
            if completing_phase and other_phase:
                completing_deps = set(d.split(".")[0] for d in completing_phase.depends_on)
                other_deps = set(d.split(".")[0] for d in other_phase.depends_on)
                if completing_deps & other_deps:
                    return self.rng.random() < self.config.merge_conflict_rate * 0.5

        return False

    def _apply_regression(self, source_node: str):
        """Apply a regression caused by work on source_node."""
        source_phase = self.all_phases.get(source_node)
        if not source_phase:
            return

        # Choose regression target based on proximity
        roll = self.rng.random()
        if roll < self.config.regression_local_weight:
            # Local: regress the source phase itself
            target = source_phase
        elif roll < self.config.regression_local_weight + self.config.regression_adjacent_weight:
            # Adjacent: find a phase in the same feature
            feature = self.features.get(source_phase.feature_id)
            if feature and len(feature.phases) > 1:
                candidates = [p for p in feature.phases if p.node_id != source_node and p.completion > 0]
                target = self.rng.choice(candidates) if candidates else source_phase
            else:
                target = source_phase
        else:
            # Remote: any phase with completion > 0
            candidates = [p for p in self.all_phases.values() if p.completion > 0 and p.node_id != source_node]
            target = self.rng.choice(candidates) if candidates else source_phase

        severity = abs(self.rng.gauss(self.config.regression_severity_mean, 0.05))
        old_completion = target.completion
        target.completion = max(0.0, target.completion - severity)
        self.log.append(
            f"[{self._time_str()}] REGRESSION in {target.node_id}: "
            f"{old_completion:.0%} → {target.completion:.0%}"
        )

    def _complete_test_workflow(self):
        """Generate test results from the workflow's completion snapshot."""
        if not self.test_workflow:
            return
        # Results: simulate pass rate from completion percentages
        results = {}
        for node_id, completion in self.test_workflow.completion_snapshot.items():
            # Simulate line match rate based on completion
            # Some noise so it's not perfectly predictable
            noise = self.rng.gauss(0, 0.05)
            match_rate = max(0.0, min(1.0, completion + noise))
            results[node_id] = match_rate

        self.test_workflow.results = results
        total_phases = len(results)
        passing = sum(1 for r in results.values() if r >= 0.95)
        self.log.append(
            f"[{self._time_str()}] Test workflow complete: "
            f"{passing}/{total_phases} phases passing"
        )

    def get_test_summary(self) -> dict | None:
        """Get the most recent test workflow results."""
        if self.test_workflow and self.test_workflow.is_complete:
            results = self.test_workflow.results or {}
            total = len(results)
            passing = sum(1 for r in results.values() if r >= 0.95)
            return {"total": total, "passing": passing, "results": results}
        return None

    def get_overall_progress(self) -> float:
        """Get overall project completion percentage."""
        if not self.all_phases:
            return 0.0
        return sum(p.completion for p in self.all_phases.values()) / len(self.all_phases)

    def is_complete(self) -> bool:
        """Check if all phases are complete."""
        return all(p.is_complete for p in self.all_phases.values())

    def _time_str(self) -> str:
        """Format simulated time as HH:MM."""
        hours = int(self.simulated_time // 60)
        minutes = int(self.simulated_time % 60)
        return f"{hours:02d}:{minutes:02d}"


def load_game(depgraph_path: str | Path, num_instances: int = 2, seed: int | None = None) -> GameState:
    """Create and initialize a game from a DepGraph JSON file."""
    state = GameState()
    if seed is not None:
        state.rng = random.Random(seed)
    state.load_depgraph(depgraph_path)
    for _ in range(num_instances):
        state.add_claude_instance()
    return state
