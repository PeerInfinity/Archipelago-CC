/**
 * Vibe Coding Simulator — Simulation Engine (v3)
 *
 * Event-based task execution with minute-by-minute random events.
 * Review/supervision mechanic reveals events progressively.
 * Accept/reject for completed tasks.
 */

// --- Constants ---

const TaskType = Object.freeze({
    WRITE_DOC: 'write_doc',
    EVALUATE_DOC: 'evaluate_doc',
    IMPLEMENT: 'implement',
    WRITE_TESTS: 'write_tests',
    MERGE_CONFLICT: 'merge_conflict',
    TEST_WORKFLOW: 'test_workflow',
    MANUAL_TEST: 'manual_test',
});

const TaskStatus = Object.freeze({
    RUNNING: 'running',
    PENDING_REVIEW: 'pending_review',  // completed but not accepted/rejected
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
    MERGE_CONFLICT: 'merge_conflict',
});

const SubtaskLabel = Object.freeze({
    INVESTIGATING: 'investigating',
    READING_CODE: 'reading code',
    PLANNING: 'planning',
    WRITING: 'writing',
    IMPLEMENTING: 'implementing',
    TESTING: 'testing',
    FIXING: 'fixing regressions',
    RESOLVING: 'resolving conflict',
    MANUAL_TESTING: 'manual testing',
});

const IMPLEMENT_SUBTASKS = [
    SubtaskLabel.INVESTIGATING,
    SubtaskLabel.READING_CODE,
    SubtaskLabel.PLANNING,
    SubtaskLabel.IMPLEMENTING,
    SubtaskLabel.TESTING,
];

const DOC_SUBTASKS = [
    SubtaskLabel.INVESTIGATING,
    SubtaskLabel.READING_CODE,
    SubtaskLabel.WRITING,
];

const MERGE_SUBTASKS = [
    SubtaskLabel.INVESTIGATING,
    SubtaskLabel.RESOLVING,
    SubtaskLabel.TESTING,
];

// --- Seeded PRNG (xoshiro128**) ---

class SeededRandom {
    constructor(seed = Date.now()) {
        this.s = new Uint32Array(4);
        this.s[0] = seed >>> 0;
        this.s[1] = (seed * 1664525 + 1013904223) >>> 0;
        this.s[2] = (this.s[1] * 1664525 + 1013904223) >>> 0;
        this.s[3] = (this.s[2] * 1664525 + 1013904223) >>> 0;
    }

    _next() {
        const s = this.s;
        const result = (s[1] * 5) | 0;
        const t = s[1] << 9;
        s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
        s[2] ^= t;
        s[3] = (s[3] << 11) | (s[3] >>> 21);
        return (result >>> 0) / 4294967296;
    }

    random() { return this._next(); }

    gauss(mean = 0, stddev = 1) {
        let u, v, s;
        do { u = this.random() * 2 - 1; v = this.random() * 2 - 1; s = u * u + v * v; }
        while (s >= 1 || s === 0);
        return mean + stddev * u * Math.sqrt(-2 * Math.log(s) / s);
    }

    uniform(min, max) {
        return min + this.random() * (max - min);
    }
}

// --- Config ---

class SimulationConfig {
    constructor(overrides = {}) {
        this.timeScale = 60.0;
        this.baseTaskDuration = 10.0; // base minutes per subtask

        this.dailyCredits = 960.0; // 16 hours of task execution per day
        this.dayDuration = 24 * 60;
        this.creditRate = 1.0;

        // Event probabilities (per minute)
        this.eventProbability = 0.08;      // chance of any event per minute
        this.eventPositiveWeight = 0.6;    // of events, fraction that are positive
        this.eventQualityDelta = 0.05;     // quality change per event

        // Outcome event (pre-rolled at task start)
        this.outcomeEventQualityRange = 0.15; // max magnitude of outcome quality delta

        // Doc writing
        this.docSuccessRate = 0.5;
        this.docPartialMin = 0.25;
        this.docPartialMax = 0.75;

        // First implementation
        this.firstImplExactMatchRate = 0.25;
        this.firstImplPartialMin = 0.25;
        this.firstImplPartialMax = 0.75;

        // Investigation doc reevaluation chance
        this.investigationDocRevalRate = 0.25;

        // Reported success accuracy
        this.reportAccuracyRate = 0.5;

        // Cross-feature side effects
        this.sideEffectRate = 0.25;
        this.sideEffectMaxChange = 0.25;
        this.sideEffectUpstreamWeight = 0.75;

        // Merge conflicts
        this.mergeConflictRate = 0.25;
        this.mergeTaskDurationScale = 0.5;        // merge/retest subtasks take half base duration

        // Dependencies-not-met slowdown
        this.depsNotMetMultiplier = 2.0;

        // Task duration variance
        this.durationLogSigma = 0.6;

        // Test workflow
        this.testWorkflowDuration = 10.0;

        // Manual test
        this.manualTestDuration = 60.0; // 1 hour

        // Universal outcome formula
        this.outcomeReduceRate = 0.25;           // probability of reduce branch
        this.outcomeNothingRate = 0.25;           // probability of nothing branch (cumulative: 0.50)
        this.outcomeMaxLossFraction = 0.5;        // max fraction of current value lost in reduce
        this.outcomeMaxGainFraction = 0.5;        // max fraction of gap gained in improve
        this.qualityBonusReduceScale = 0.3;       // qualityBonus multiplier in reduce branch
        this.qualityBonusNothingScale = 0.5;      // qualityBonus multiplier in nothing branch
        this.qualityBonusImproveScale = 0.3;      // qualityBonus multiplier in improve branch
        this.qualityBonusFirstImplScale = 0.5;    // qualityBonus multiplier for first impl exact match

        // Doc base quality (for _applyWriteDoc)
        this.docBaseQuality = 0.5;                // base quality before events
        this.docSuccessBonus = 0.5;               // added to base quality on success roll

        // Inline regression (during testing subtask)
        this.regressionCatchRate = 0.6;           // if regression occurs, chance of catching it

        // Review
        this.reviewSpeedMultiplier = 2.0;
        this.dailyReviewBudget = 8 * 60; // 8 hours in minutes

        // Task history
        this.maxTaskHistory = 100;

        Object.assign(this, overrides);
    }
}

// --- Feature ---

class Feature {
    constructor(id, name) {
        this.id = id;
        this.name = name;

        // Hidden state
        this.docCompleteness = 0;
        this.codeCompleteness = 0;
        this.testCompleteness = 0;

        // Visible state
        this.hasDoc = false;
        this.hasCode = false;
        this.hasTests = false;
        this.testResultPercent = null;
        this.testResultUpdated = null;
        this.manualTestResult = null; // null | "incomplete" | "doc" | "code" | "tests" | "pass"

        // Graph
        this.upstreamIds = new Set();
        this.downstreamIds = new Set();
        this.dependsOn = []; // node IDs from the graph (for determining upstream features)
        this._depsAreMet = true;
    }

    get depsAreMet() { return this._depsAreMet; }
    set depsAreMet(val) { this._depsAreMet = val; }
}

// --- Task Event ---

class TaskEvent {
    constructor(minute, type, description, positive, qualityDelta = 0) {
        this.minute = minute;        // simulated minute within the task
        this.type = type;            // 'quality' | 'step' | 'info'
        this.description = description;
        this.positive = positive;    // true = green, false = red, null = neutral
        this.qualityDelta = qualityDelta;
    }
}

// --- Task ---

let _nextTaskId = 1;

class Task {
    constructor(type, targetFeatureId) {
        this.id = `task-${_nextTaskId++}`;
        this.type = type;
        this.targetFeatureId = targetFeatureId;
        this.status = TaskStatus.RUNNING;
        this.createdAt = 0;       // for stable ordering
        this.startedAt = 0;
        this.completedAt = null;
        this.creditsUsed = 0;
        this.reportedSuccess = null;

        // Subtask structure
        this.subtaskDurations = [];  // minutes per subtask
        this.subtaskLabels = [];     // label for each subtask

        // Minute-based progress
        this.elapsedMinutes = 0;     // integer minutes elapsed
        this.fractionalMinute = 0;   // sub-minute accumulator

        // Events
        this.events = [];            // TaskEvent[]
        this.pendingQuality = 0;     // accumulated quality from events (applied on accept)

        // Review state
        this.reviewMinute = 0;       // how far review has progressed
        this.reviewFractional = 0;

        // Accept/reject
        this.accepted = false;
        this.rejected = false;

        // Merge conflict
        this.branchCodeCompleteness = null;
        this._pendingMerge = false;
        this._sourceTaskIds = null;
        this._mergeTaskType = null;

        // Skip testing flag
        this._skipTesting = false;

        // Retry tracking
        this._retried = false;
    }

    get subtasks() {
        switch (this.type) {
            case TaskType.WRITE_DOC:
            case TaskType.EVALUATE_DOC:
            case TaskType.WRITE_TESTS:
                return DOC_SUBTASKS;
            case TaskType.MERGE_CONFLICT:
                return MERGE_SUBTASKS;
            case TaskType.IMPLEMENT:
            default:
                return IMPLEMENT_SUBTASKS;
        }
    }

    get totalDuration() {
        return this.subtaskDurations.reduce((a, b) => a + b, 0);
    }

    get currentSubtaskLabel() {
        let elapsed = 0;
        for (let i = 0; i < this.subtaskDurations.length; i++) {
            elapsed += this.subtaskDurations[i];
            if (this.elapsedMinutes < elapsed) {
                return this.subtaskLabels[i] || 'working';
            }
        }
        return 'finishing';
    }

    get currentSubtaskIndex() {
        let elapsed = 0;
        for (let i = 0; i < this.subtaskDurations.length; i++) {
            elapsed += this.subtaskDurations[i];
            if (this.elapsedMinutes < elapsed) return i;
        }
        return this.subtaskDurations.length;
    }

    get overallProgress() {
        const total = this.totalDuration;
        if (total <= 0) return 0;
        return Math.min((this.elapsedMinutes + this.fractionalMinute) / total, 1.0);
    }

    get reviewProgress() {
        const total = this.totalDuration;
        if (total <= 0) return 0;
        return Math.min((this.reviewMinute + this.reviewFractional) / total, 1.0);
    }

    /** Returns fractional positions (0-1) where each subtask boundary falls. */
    get subtaskBoundaries() {
        const total = this.totalDuration;
        if (total <= 0) return [];
        const boundaries = [];
        let elapsed = 0;
        for (let i = 0; i < this.subtaskDurations.length - 1; i++) {
            elapsed += this.subtaskDurations[i];
            boundaries.push(elapsed / total);
        }
        return boundaries;
    }

    /** Returns event positions as fractions (0-1) for the progress bar. */
    get eventMarkers() {
        const total = this.totalDuration;
        if (total <= 0) return [];
        return this.events
            .filter(e => e.type === 'quality' || e.type === 'outcome')
            .map(e => ({ position: e.minute / total, positive: e.positive, isOutcome: e.type === 'outcome' }));
    }

    get label() {
        const typeLabels = {
            [TaskType.WRITE_DOC]: 'Write Doc',
            [TaskType.EVALUATE_DOC]: 'Evaluate Doc',
            [TaskType.IMPLEMENT]: 'Implement',
            [TaskType.WRITE_TESTS]: 'Write Tests',
            [TaskType.MERGE_CONFLICT]: 'Merge Resolve',
            [TaskType.MANUAL_TEST]: 'Manual Test',
        };
        return `${typeLabels[this.type] || this.type}: ${this.targetFeatureId}`;
    }

    /** Get the step index for a given minute */
    stepIndexAtMinute(minute) {
        let elapsed = 0;
        for (let i = 0; i < this.subtaskDurations.length; i++) {
            elapsed += this.subtaskDurations[i];
            if (minute < elapsed) return i;
        }
        return this.subtaskDurations.length - 1;
    }

    /** Get the start minute of a given step */
    stepStartMinute(stepIndex) {
        let elapsed = 0;
        for (let i = 0; i < stepIndex && i < this.subtaskDurations.length; i++) {
            elapsed += this.subtaskDurations[i];
        }
        return elapsed;
    }
}

// --- Test Workflow ---

class TestWorkflow {
    constructor(startedAt, duration) {
        this.startedAt = startedAt;
        this.duration = duration;
        this.complete = false;
    }
}

// --- Game State ---

class GameState {
    constructor(config) {
        this.config = config || new SimulationConfig();
        this.features = new Map();
        this.tasks = [];
        this.simulatedTime = 0;
        this.creditsRemaining = this.config.dailyCredits;
        this.creditDayStart = 0;
        this.testWorkflow = null;
        this.manualTestFeatureId = null;
        this.manualTestStartedAt = null;
        this.rng = new SeededRandom();
        this.log = [];
        this.paused = true;
        this.speedMultiplier = 1;
        this.autoAccept = false;

        // Review state
        this.activeReviewTaskId = null;   // task being reviewed
        this.reviewUsedToday = 0;         // minutes used today
        this.reviewDayStart = 0;          // when the current day started

        // Index mapping for region graph
        this.indexToFeatureId = {};

        this.onStateChanged = null;
        this.onLogEntry = null;
    }

    // --- Data Loading ---

    loadFromSlotData(slotData) {
        const graphStructure = slotData.graph_structure;
        if (!graphStructure) return;

        const indexToLabel = {};
        for (const [idx, step] of Object.entries(graphStructure)) {
            indexToLabel[parseInt(idx)] = step.label;
        }

        // Each node in the graph becomes a feature
        for (const [idx, step] of Object.entries(graphStructure)) {
            const featureId = step.label;
            this.indexToFeatureId[parseInt(idx)] = featureId;
            const displayName = step.expression || featureId;
            const depNodeIds = (step.dependencies || []).map(i => indexToLabel[i]).filter(Boolean);

            const feature = new Feature(featureId, displayName);
            feature.dependsOn = depNodeIds;
            this.features.set(featureId, feature);
        }

        // Compute upstream/downstream
        for (const [id, feat] of this.features) {
            for (const depId of feat.dependsOn) {
                feat.upstreamIds.add(depId);
                const depFeat = this.features.get(depId);
                if (depFeat) depFeat.downstreamIds.add(id);
            }
        }

        this._updateDepsMetStatus();
    }

    _updateDepsMetStatus() {
        for (const [, feat] of this.features) {
            let met = true;
            for (const upId of feat.upstreamIds) {
                const up = this.features.get(upId);
                if (!up || up.manualTestResult !== 'pass') {
                    met = false;
                    break;
                }
            }
            feat.depsAreMet = met;
        }
    }

    // --- Queries ---

    get isManualTestActive() {
        return this.manualTestFeatureId !== null;
    }

    get reviewBudgetRemaining() {
        return Math.max(0, this.config.dailyReviewBudget - this.reviewUsedToday);
    }

    get isReviewActive() {
        return this.activeReviewTaskId !== null || this.isManualTestActive;
    }

    getRunningTasks() {
        return this.tasks.filter(t => t.status === TaskStatus.RUNNING);
    }

    getPendingReviewTasks() {
        return this.tasks.filter(t => t.status === TaskStatus.PENDING_REVIEW);
    }

    getCompletedTasks() {
        return this.tasks.filter(t =>
            t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CANCELLED ||
            t.status === TaskStatus.FAILED);
    }

    getMergeConflicts() {
        return this.tasks.filter(t => t.status === TaskStatus.MERGE_CONFLICT);
    }

    /** Get all tasks in stable creation order for display. */
    getOrderedTasks() {
        // Merge conflicts at top, then everything else in creation order
        // Merge conflicts at top, then everything else newest-first
        const merges = this.tasks.filter(t => t.status === TaskStatus.MERGE_CONFLICT);
        const rest = this.tasks.filter(t => t.status !== TaskStatus.MERGE_CONFLICT);
        return [...merges, ...rest.reverse()];
    }

    getFeatureActions(featureId) {
        const feat = this.features.get(featureId);
        if (!feat) return [];

        const actions = [];

        if (!feat.hasDoc) {
            actions.push({ type: TaskType.WRITE_DOC, label: 'Write Planning Doc' });
        } else {
            actions.push({ type: TaskType.EVALUATE_DOC, label: 'Evaluate Doc' });
            if (!feat.hasCode) {
                actions.push({ type: TaskType.IMPLEMENT, label: 'Implement' });
            } else {
                actions.push({ type: TaskType.IMPLEMENT, label: 'Debug Code' });
            }

            if (!feat.hasTests) {
                actions.push({ type: TaskType.WRITE_TESTS, label: 'Write Tests' });
            } else {
                actions.push({ type: TaskType.WRITE_TESTS, label: 'Debug Tests' });
            }
        }

        if (feat.hasCode && feat.hasTests && !this.isManualTestActive) {
            actions.push({ type: TaskType.MANUAL_TEST, label: 'Manual Test' });
        }
        return actions;
    }

    // --- Task Assignment ---

    assignTask(featureId, taskType) {
        const feat = this.features.get(featureId);
        if (!feat) return null;

        if (taskType === TaskType.MANUAL_TEST) {
            return this._startManualTest(featureId);
        }

        const task = new Task(taskType, featureId);
        task.createdAt = this.simulatedTime;
        task.startedAt = this.simulatedTime;

        const subtaskList = task.subtasks;
        const durationMult = feat.depsAreMet ? 1 : this.config.depsNotMetMultiplier;

        for (const label of subtaskList) {
            const dur = Math.max(1, Math.round(
                this.config.baseTaskDuration * durationMult *
                Math.exp(this.rng.gauss(0, this.config.durationLogSigma))
            ));
            task.subtaskDurations.push(dur);
            task.subtaskLabels.push(label);
        }

        // Add step start events
        let elapsed = 0;
        for (let i = 0; i < task.subtaskDurations.length; i++) {
            task.events.push(new TaskEvent(
                elapsed, 'step', `Started: ${task.subtaskLabels[i]}`, null
            ));
            elapsed += task.subtaskDurations[i];
        }

        // Roll main outcome event at a random position in the timeline
        this._rollOutcomeEvent(task);

        this.tasks.push(task);

        // Check for merge conflicts
        const mergeableTypes = [TaskType.IMPLEMENT, TaskType.WRITE_DOC, TaskType.EVALUATE_DOC, TaskType.WRITE_TESTS];
        if (mergeableTypes.includes(taskType)) {
            const otherRunning = this.tasks.filter(
                t => t.id !== task.id && t.status === TaskStatus.RUNNING &&
                     t.targetFeatureId === featureId && t.type === taskType
            );
            if (otherRunning.length > 0) {
                // Find any existing merge for this feature/type that hasn't been accepted/rejected
                const existingMerge = this.tasks.find(
                    t => t.targetFeatureId === featureId && t._mergeTaskType === taskType &&
                         (t.status === TaskStatus.MERGE_CONFLICT ||
                          (t.type === TaskType.MERGE_CONFLICT &&
                           (t.status === TaskStatus.RUNNING || t.status === TaskStatus.PENDING_REVIEW)))
                );
                if (existingMerge) {
                    // Reset to pending and add new task as source
                    if (!existingMerge._sourceTaskIds.includes(task.id)) {
                        existingMerge._sourceTaskIds.push(task.id);
                    }
                    existingMerge.status = TaskStatus.MERGE_CONFLICT;
                    existingMerge._pendingMerge = true;
                    existingMerge.createdAt = this.simulatedTime;
                    existingMerge.completedAt = null;
                    existingMerge.reportedSuccess = null;
                    this._addLog(`Merge conflict reset: ${existingMerge._sourceTaskIds.length} agents on ${featureId}`);
                } else {
                    const allSourceIds = [...otherRunning.map(t => t.id), task.id];
                    const mergeTask = new Task(TaskType.MERGE_CONFLICT, featureId);
                    mergeTask.createdAt = this.simulatedTime;
                    mergeTask.startedAt = this.simulatedTime;
                    mergeTask.status = TaskStatus.MERGE_CONFLICT;
                    mergeTask._pendingMerge = true;
                    mergeTask._sourceTaskIds = allSourceIds;
                    mergeTask._mergeTaskType = taskType;
                    this.tasks.push(mergeTask);
                    this._addLog(`Potential merge conflict: ${allSourceIds.length} agents on ${featureId}`);
                }
            }
        }

        this._addLog(`Started: ${task.label}`);
        this._notify();
        return task;
    }

    _startManualTest(featureId) {
        if (this.isManualTestActive) return null;
        // Manual test uses review budget
        if (this.reviewBudgetRemaining <= 0) return null;
        this.manualTestFeatureId = featureId;
        this.manualTestStartedAt = this.simulatedTime;
        // Cancel any active task review
        this.activeReviewTaskId = null;
        this._addLog(`Manual test started: ${featureId}`);
        this._notify();
        return { type: TaskType.MANUAL_TEST, featureId };
    }

    cancelTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || (task.status !== TaskStatus.RUNNING && task.status !== TaskStatus.PENDING_REVIEW)) return false;
        task.status = TaskStatus.CANCELLED;
        task.completedAt = this.simulatedTime;
        this._addLog(`Cancelled: ${task.label}`);
        this._updatePendingMerges();
        this._notify();
        return true;
    }

    discardTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return false;
        task.status = TaskStatus.CANCELLED;
        task.completedAt = this.simulatedTime;
        this._addLog(`Discarded: ${task.label}`);
        this._updatePendingMerges();
        this._notify();
        return true;
    }

    acceptTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status !== TaskStatus.PENDING_REVIEW) return false;
        task.accepted = true;
        task.status = TaskStatus.COMPLETED;
        task.completedAt = this.simulatedTime;
        this._applyTaskResult(task);
        this._addLog(`Accepted: ${task.label}`);
        this._updateDepsMetStatus();
        this._notify();
        return true;
    }

    rejectTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status !== TaskStatus.PENDING_REVIEW) return false;
        task.rejected = true;
        task.status = TaskStatus.CANCELLED;
        task.completedAt = this.simulatedTime;
        this._addLog(`Rejected: ${task.label}`);
        this._notify();
        return true;
    }

    skipTesting(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status !== TaskStatus.RUNNING) return false;
        task._skipTesting = true;
        this._addLog(`Will skip testing: ${task.label}`);
        return true;
    }

    // --- Review ---

    startReview(taskId) {
        if (this.reviewBudgetRemaining <= 0) return false;
        // Cancel current review if any
        this.activeReviewTaskId = taskId;
        return true;
    }

    stopReview() {
        this.activeReviewTaskId = null;
    }

    /** Rewind task to the start of the step containing the first negative event. */
    rewindToFirstNegative(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return false;
        const negEvents = task.events.filter(e => (e.type === 'quality' || e.type === 'outcome') && !e.positive);
        if (negEvents.length === 0) return false;
        const firstNeg = negEvents.reduce((a, b) => a.minute < b.minute ? a : b);
        const stepIdx = task.stepIndexAtMinute(firstNeg.minute);
        return this._rewindTask(task, task.stepStartMinute(stepIdx));
    }

    /** Rewind task one step back. */
    rewindOneStep(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return false;
        const curStep = task.currentSubtaskIndex;
        const targetStep = Math.max(0, curStep - 1);
        return this._rewindTask(task, task.stepStartMinute(targetStep));
    }

    /** Rewind task to the beginning. */
    rewindToStart(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return false;
        return this._rewindTask(task, 0);
    }

    _rewindTask(task, toMinute) {
        // Check if the outcome event will be removed
        const hadOutcome = task.events.some(e => e.type === 'outcome' && e.minute >= toMinute);
        // Remove events after the rewind point (keep step events)
        task.events = task.events.filter(e => e.minute < toMinute || e.type === 'step');
        // Re-roll outcome event if it was removed, placing it in the remaining timeline
        if (hadOutcome) {
            this._rollOutcomeEvent(task, toMinute);
        }
        // Reset quality from remaining events
        task.pendingQuality = 0;
        for (const e of task.events) {
            if (e.type === 'quality' || e.type === 'outcome') task.pendingQuality += e.qualityDelta;
        }
        // Add rewind event to the task log
        task.events.push(new TaskEvent(toMinute, 'rewind', `Rewound to minute ${toMinute}`, null));
        // Reset elapsed time
        task.elapsedMinutes = toMinute;
        task.fractionalMinute = 0;
        // Reset review to rewind point
        task.reviewMinute = Math.min(task.reviewMinute, toMinute);
        task.reviewFractional = 0;
        // Re-enable if was pending
        if (task.status === TaskStatus.PENDING_REVIEW) {
            task.status = TaskStatus.RUNNING;
            task.completedAt = null;
            task.reportedSuccess = null;
        }
        this._addLog(`Rewound: ${task.label} to minute ${toMinute}`);
        this._notify();
        return true;
    }

    // --- Merge Conflicts ---

    resolveMergeConflict(conflictTaskId) {
        const conflict = this.tasks.find(t => t.id === conflictTaskId);
        if (!conflict || conflict.status !== TaskStatus.MERGE_CONFLICT) return null;

        const feat = this.features.get(conflict.targetFeatureId);
        if (!feat) return null;

        const task = new Task(TaskType.MERGE_CONFLICT, conflict.targetFeatureId);
        task.createdAt = this.simulatedTime;
        task.startedAt = this.simulatedTime;
        task.branchCodeCompleteness = Math.max(
            feat.codeCompleteness, conflict.branchCodeCompleteness ?? 0);

        const durationMult = feat.depsAreMet ? 1 : this.config.depsNotMetMultiplier;
        for (const label of MERGE_SUBTASKS) {
            const dur = Math.max(1, Math.round(
                this.config.baseTaskDuration * this.config.mergeTaskDurationScale * durationMult *
                Math.exp(this.rng.gauss(0, this.config.durationLogSigma))
            ));
            task.subtaskDurations.push(dur);
            task.subtaskLabels.push(label);
        }

        let elapsed = 0;
        for (let i = 0; i < task.subtaskDurations.length; i++) {
            task.events.push(new TaskEvent(elapsed, 'step', `Started: ${task.subtaskLabels[i]}`, null));
            elapsed += task.subtaskDurations[i];
        }

        this._rollOutcomeEvent(task);
        conflict.status = TaskStatus.FAILED;
        this.tasks.push(task);
        this._addLog(`Resolving merge conflict: ${task.targetFeatureId}`);
        this._notify();
        return task;
    }

    retryMergeResolve(completedMergeTaskId) {
        const prev = this.tasks.find(t => t.id === completedMergeTaskId);
        if (!prev || prev.type !== TaskType.MERGE_CONFLICT) return null;
        const feat = this.features.get(prev.targetFeatureId);
        if (!feat) return null;

        const task = new Task(TaskType.MERGE_CONFLICT, prev.targetFeatureId);
        task.createdAt = this.simulatedTime;
        task.startedAt = this.simulatedTime;
        task.branchCodeCompleteness = prev.branchCodeCompleteness ?? feat.codeCompleteness;

        const durationMult = feat.depsAreMet ? 1 : this.config.depsNotMetMultiplier;
        for (const label of MERGE_SUBTASKS) {
            const dur = Math.max(1, Math.round(
                this.config.baseTaskDuration * this.config.mergeTaskDurationScale * durationMult *
                Math.exp(this.rng.gauss(0, this.config.durationLogSigma))
            ));
            task.subtaskDurations.push(dur);
            task.subtaskLabels.push(label);
        }

        let elapsed = 0;
        for (let i = 0; i < task.subtaskDurations.length; i++) {
            task.events.push(new TaskEvent(elapsed, 'step', `Started: ${task.subtaskLabels[i]}`, null));
            elapsed += task.subtaskDurations[i];
        }

        this._rollOutcomeEvent(task);
        this.tasks.push(task);
        this._addLog(`Retrying merge resolve: ${task.targetFeatureId}`);
        this._notify();
        return task;
    }

    discardMergeConflict(conflictTaskId) {
        const task = this.tasks.find(t => t.id === conflictTaskId);
        if (!task || task.status !== TaskStatus.MERGE_CONFLICT) return false;
        task.status = TaskStatus.CANCELLED;
        task.completedAt = this.simulatedTime;
        this._addLog(`Discarded merge conflict: ${task.targetFeatureId}`);
        this._notify();
        return true;
    }

    _updatePendingMerges() {
        for (const merge of this.tasks) {
            if (merge.status !== TaskStatus.MERGE_CONFLICT) continue;
            if (!merge._sourceTaskIds) continue;

            const sources = merge._sourceTaskIds.map(id => this.tasks.find(t => t.id === id)).filter(Boolean);
            const uncancelled = sources.filter(t => t.status !== TaskStatus.CANCELLED);

            if (uncancelled.length <= 1) {
                merge.status = TaskStatus.CANCELLED;
                merge.completedAt = this.simulatedTime;
                this._addLog(`Merge conflict resolved: only one task remains on ${merge.targetFeatureId}`);
                continue;
            }

            if (merge._pendingMerge) {
                const allDone = uncancelled.every(t => t.status !== TaskStatus.RUNNING);
                if (allDone) {
                    merge._pendingMerge = false;
                }
            }
        }
    }

    // --- Test Workflow ---

    startTestWorkflow() {
        if (this.testWorkflow && !this.testWorkflow.complete) return false;
        this.testWorkflow = new TestWorkflow(this.simulatedTime, this.config.testWorkflowDuration);
        this._addLog('Test workflow started');
        this._notify();
        return true;
    }

    cancelTestWorkflow() {
        if (!this.testWorkflow || this.testWorkflow.complete) return false;
        this.testWorkflow = null;
        this._addLog('Test workflow cancelled');
        this._notify();
        return true;
    }

    // --- Game Loop ---

    tick(dtReal) {
        if (this.paused) return;
        const dt = dtReal * this.config.timeScale * this.speedMultiplier / 60.0;
        this.simulatedTime += dt;

        // Daily credit refresh
        if (this.simulatedTime - this.creditDayStart >= this.config.dayDuration) {
            this.creditsRemaining = this.config.dailyCredits;
            this.creditDayStart = this.simulatedTime;
            this._addLog('Daily credits refreshed!');
        }

        // Daily review budget refresh
        const currentDay = Math.floor(this.simulatedTime / (24 * 60));
        const reviewDay = Math.floor(this.reviewDayStart / (24 * 60));
        if (currentDay > reviewDay) {
            this.reviewUsedToday = 0;
            this.reviewDayStart = currentDay * 24 * 60;
        }

        // Update tasks (minute-by-minute)
        let changed = false;
        for (const task of this.tasks) {
            if (task.status !== TaskStatus.RUNNING) continue;
            if (this._tickTask(task, dt)) changed = true;
        }

        // Update active review
        if (this.activeReviewTaskId && this.reviewBudgetRemaining > 0) {
            this._tickReview(dt);
        }

        // Update pending merges
        this._updatePendingMerges();

        // Update test workflow
        if (this.testWorkflow && !this.testWorkflow.complete) {
            if (this.simulatedTime - this.testWorkflow.startedAt >= this.testWorkflow.duration) {
                this._completeTestWorkflow();
                changed = true;
            }
        }

        // Update manual test
        if (this.isManualTestActive) {
            // Manual test uses review budget
            this.reviewUsedToday += dt;
            if (this.reviewBudgetRemaining <= 0 ||
                this.simulatedTime - this.manualTestStartedAt >= this.config.manualTestDuration) {
                this._completeManualTest();
                changed = true;
            }
        }

        if (changed) {
            this._updateDepsMetStatus();
            this._notify();
        }
    }

    _tickTask(task, dt) {
        if (this.creditsRemaining <= 0) return false;
        const creditCost = dt * this.config.creditRate;
        this.creditsRemaining = Math.max(0, this.creditsRemaining - creditCost);
        task.creditsUsed += creditCost;

        // Advance time in minutes
        task.fractionalMinute += dt;
        let minutesAdvanced = 0;
        while (task.fractionalMinute >= 1) {
            task.fractionalMinute -= 1;
            task.elapsedMinutes += 1;
            minutesAdvanced++;

            // Handle skip testing
            if (task._skipTesting) {
                const testingStartMinute = this._findTestingStartMinute(task);
                if (testingStartMinute !== null && task.elapsedMinutes >= testingStartMinute) {
                    task.elapsedMinutes = task.totalDuration;
                    task._skipTesting = false;
                    break;
                }
            }

            // Roll for random event this minute
            if (task.elapsedMinutes <= task.totalDuration) {
                this._rollMinuteEvent(task);
            }

            // Check if task is done
            if (task.elapsedMinutes >= task.totalDuration) {
                // Roll for whether the agent catches a negative event and rewinds
                if (this._rollInlineRegression()) {
                    const negEvents = task.events.filter(e =>
                        (e.type === 'quality' || e.type === 'outcome') && !e.positive);
                    if (negEvents.length > 0) {
                        const firstNeg = negEvents.reduce((a, b) => a.minute < b.minute ? a : b);
                        const stepIdx = task.stepIndexAtMinute(firstNeg.minute);
                        this._addLog(`${task.label}: agent noticed issue, rewinding to fix`);
                        this._rewindTask(task, task.stepStartMinute(stepIdx));
                        break;
                    }
                }
                this._finishTask(task);
                return true;
            }
        }

        return false;
    }

    _findTestingStartMinute(task) {
        const labels = task.subtaskLabels;
        const testIdx = labels.indexOf(SubtaskLabel.TESTING);
        if (testIdx < 0) return null;
        return task.stepStartMinute(testIdx);
    }

    _rollInlineRegression() {
        // sideEffectRate chance of a regression, and if so, regressionCatchRate chance of catching it
        return this.rng.random() < this.config.sideEffectRate &&
               this.rng.random() < this.config.regressionCatchRate;
    }

    /** Roll the main outcome event and place it at a random position in the timeline. */
    _rollOutcomeEvent(task, fromMinute = 0) {
        const range = this.config.outcomeEventQualityRange;
        const delta = this.rng.uniform(-range, range);
        const positive = delta >= 0;
        const descriptions = positive
            ? ['Key insight led to clean solution', 'Approach aligns well with codebase',
               'Design decision paying off', 'Good pattern match from experience']
            : ['Fundamental approach has a flaw', 'Misunderstanding in requirements',
               'Architectural mismatch discovered', 'Key assumption was wrong'];
        const desc = descriptions[Math.floor(this.rng.random() * descriptions.length)];
        // Place at a random minute between fromMinute and totalDuration
        const totalDur = task.totalDuration;
        const minute = fromMinute + Math.floor(this.rng.random() * Math.max(1, totalDur - fromMinute));
        const event = new TaskEvent(minute, 'outcome', desc, positive, delta);
        task.events.push(event);
        task.pendingQuality += delta;
    }

    _rollMinuteEvent(task) {
        if (this.rng.random() >= this.config.eventProbability) return;

        const positive = this.rng.random() < this.config.eventPositiveWeight;
        const delta = positive ? this.config.eventQualityDelta : -this.config.eventQualityDelta;
        const descriptions = positive
            ? ['Found a cleaner approach', 'Reused existing pattern', 'Good insight from docs',
               'Optimized implementation', 'Caught edge case early']
            : ['Introduced subtle bug', 'Misread specification', 'Wrong assumption about API',
               'Overlooked edge case', 'Used deprecated pattern'];
        const desc = descriptions[Math.floor(this.rng.random() * descriptions.length)];

        const event = new TaskEvent(task.elapsedMinutes, 'quality', desc, positive, delta);
        task.events.push(event);
        task.pendingQuality += delta;
    }

    _finishTask(task) {
        task.status = this.autoAccept ? TaskStatus.COMPLETED : TaskStatus.PENDING_REVIEW;
        task.completedAt = this.simulatedTime;
        // Agent's self-report — may falsely report success
        task.reportedSuccess = this._rollReportedSuccess(task.pendingQuality >= 0);

        if (this.autoAccept) {
            task.accepted = true;
            this._applyTaskResult(task);
            // Clear review if we were reviewing this task
            if (this.activeReviewTaskId === task.id) {
                this.activeReviewTaskId = null;
            }
        }

        this._addLog(`Finished: ${task.label} — ${task.reportedSuccess ? 'reports success' : 'reports issues'}`);
    }

    _tickReview(dt) {
        const task = this.tasks.find(t => t.id === this.activeReviewTaskId);
        if (!task) {
            this.activeReviewTaskId = null;
            return;
        }

        // Don't consume review budget if review is already complete
        const maxMinute = task.elapsedMinutes;
        const maxFrac = task.fractionalMinute;
        if (task.reviewMinute > maxMinute ||
            (task.reviewMinute === maxMinute && task.reviewFractional >= maxFrac)) {
            task.reviewMinute = maxMinute;
            task.reviewFractional = maxFrac;
            return;
        }

        const reviewDt = dt * this.config.reviewSpeedMultiplier;
        this.reviewUsedToday += dt;

        task.reviewFractional += reviewDt;
        while (task.reviewFractional >= 1) {
            task.reviewFractional -= 1;
            task.reviewMinute += 1;
        }

        // Can't pass the main task progress
        if (task.reviewMinute > maxMinute ||
            (task.reviewMinute === maxMinute && task.reviewFractional > maxFrac)) {
            task.reviewMinute = maxMinute;
            task.reviewFractional = maxFrac;
        }
    }

    // --- Task Result Application ---

    _applyTaskResult(task) {
        const feat = this.features.get(task.targetFeatureId);
        if (!feat) return;

        switch (task.type) {
            case TaskType.WRITE_DOC:
                this._applyWriteDoc(task, feat);
                break;
            case TaskType.EVALUATE_DOC:
                this._applyEvaluateDoc(task, feat);
                break;
            case TaskType.IMPLEMENT:
                this._applyImplement(task, feat);
                break;
            case TaskType.WRITE_TESTS:
                this._applyWriteTests(task, feat);
                break;
            case TaskType.MERGE_CONFLICT:
                this._applyMergeConflict(task, feat);
                break;
        }
    }

    _applyWriteDoc(task, feat) {
        // Base quality from events
        const baseQuality = this.config.docBaseQuality + task.pendingQuality;
        if (this.rng.random() < this.config.docSuccessRate) {
            feat.docCompleteness = Math.min(1.0, Math.max(0, baseQuality + this.config.docSuccessBonus));
        } else {
            feat.docCompleteness = Math.max(0, Math.min(1.0,
                this.rng.uniform(this.config.docPartialMin, this.config.docPartialMax) + task.pendingQuality));
        }
        feat.hasDoc = true;
        task.reportedSuccess = this._rollReportedSuccess(feat.docCompleteness >= 1.0);
    }

    _applyEvaluateDoc(task, feat) {
        this._applyUniversalOutcome(feat, 'docCompleteness', 1.0, task.pendingQuality);
        task.reportedSuccess = this._rollReportedSuccess(feat.docCompleteness >= 1.0);
    }

    _applyImplement(task, feat) {
        // Investigation doc reevaluation
        if (this.rng.random() < this.config.investigationDocRevalRate) {
            this._applyUniversalOutcome(feat, 'docCompleteness', 1.0, 0);
        }

        // Store branch completeness for any pending merge conflict
        task.branchCodeCompleteness = this._computeImplementResult(feat);

        const ceiling = feat.docCompleteness;
        if (feat.codeCompleteness === 0) {
            // First implementation
            if (this.rng.random() < this.config.firstImplExactMatchRate) {
                feat.codeCompleteness = Math.min(1.0, ceiling + task.pendingQuality * this.config.qualityBonusFirstImplScale);
            } else {
                feat.codeCompleteness = Math.max(0, Math.min(ceiling,
                    this.rng.uniform(this.config.firstImplPartialMin, this.config.firstImplPartialMax) * ceiling
                    + task.pendingQuality * ceiling));
            }
        } else {
            // Re-implementation
            this._applyUniversalOutcome(feat, 'codeCompleteness', ceiling, task.pendingQuality);
        }

        feat.hasCode = true;
        feat.manualTestResult = null; // invalidate previous manual test
        task.reportedSuccess = this._rollReportedSuccess(feat.codeCompleteness >= ceiling);
        this._rollSideEffect(feat);

        // Check for location check (100% code)
        if (feat.codeCompleteness >= 1.0) {
            this._awardLocationCheck(feat);
        }
    }

    _applyWriteTests(task, feat) {
        if (this.rng.random() < this.config.investigationDocRevalRate) {
            this._applyUniversalOutcome(feat, 'docCompleteness', 1.0, 0);
        }

        const ceiling = feat.docCompleteness;
        if (feat.testCompleteness === 0) {
            // First test writing
            if (this.rng.random() < this.config.firstImplExactMatchRate) {
                feat.testCompleteness = Math.min(1.0, ceiling + task.pendingQuality * this.config.qualityBonusFirstImplScale);
            } else {
                feat.testCompleteness = Math.max(0, Math.min(ceiling,
                    this.rng.uniform(this.config.firstImplPartialMin, this.config.firstImplPartialMax) * ceiling
                    + task.pendingQuality * ceiling));
            }
        } else {
            this._applyUniversalOutcome(feat, 'testCompleteness', ceiling, task.pendingQuality);
        }

        feat.hasTests = true;
        feat.manualTestResult = null; // invalidate
        task.reportedSuccess = this._rollReportedSuccess(feat.testCompleteness >= ceiling);
    }

    _applyMergeConflict(task, feat) {
        const branchCode = task.branchCodeCompleteness ?? 0;
        const current = Math.max(feat.codeCompleteness, branchCode);
        feat.codeCompleteness = current;
        this._applyUniversalOutcome(feat, 'codeCompleteness', feat.docCompleteness, task.pendingQuality);
        feat.hasCode = true;
        feat.manualTestResult = null;
        task.reportedSuccess = this._rollReportedSuccess(feat.codeCompleteness >= feat.docCompleteness);
        this._rollSideEffect(feat);
        if (feat.codeCompleteness >= 1.0) {
            this._awardLocationCheck(feat);
        }
    }

    _computeImplementResult(feat) {
        // Compute what the code completeness would be (for merge conflict branches)
        const ceiling = feat.docCompleteness;
        if (feat.codeCompleteness === 0) {
            if (this.rng.random() < this.config.firstImplExactMatchRate) {
                return ceiling;
            }
            return this.rng.uniform(this.config.firstImplPartialMin, this.config.firstImplPartialMax) * ceiling;
        }
        // Simulate universal outcome without applying
        return this._simulateUniversalOutcome(feat.codeCompleteness, ceiling);
    }

    _simulateUniversalOutcome(current, ceiling) {
        if (ceiling <= 0) return current;
        const cRel = current / ceiling;
        const roll = this.rng.random();
        const reduceThreshold = this.config.outcomeReduceRate;
        const nothingThreshold = reduceThreshold + this.config.outcomeNothingRate;

        if (roll < reduceThreshold) {
            return Math.max(0, current - this.rng.random() * this.config.outcomeMaxLossFraction * current);
        } else if (roll < nothingThreshold) {
            return current;
        } else if (roll < nothingThreshold + (1 - cRel) / 2) {
            const gap = ceiling - current;
            return Math.min(ceiling, current + this.rng.random() * this.config.outcomeMaxGainFraction * gap);
        } else {
            return ceiling;
        }
    }

    _awardLocationCheck(feat) {
        // Location check placeholder — in Archipelago integration this would
        // dispatch a location check event
        if (!feat._locationChecked) {
            feat._locationChecked = true;
            this._addLog(`LOCATION CHECK: ${feat.id} — code at 100%!`);
        }
    }

    // --- Universal Outcome Formula ---

    _applyUniversalOutcome(feat, property, ceiling, qualityBonus = 0) {
        if (ceiling <= 0) return;
        const current = feat[property];
        const cRel = current / ceiling;
        const roll = this.rng.random();
        const reduceThreshold = this.config.outcomeReduceRate;
        const nothingThreshold = reduceThreshold + this.config.outcomeNothingRate;

        if (roll < reduceThreshold) {
            // Reduce: lose up to outcomeMaxLossFraction of current
            const loss = this.rng.random() * this.config.outcomeMaxLossFraction * current;
            feat[property] = Math.max(0, current - loss + qualityBonus * this.config.qualityBonusReduceScale);
        } else if (roll < nothingThreshold) {
            // Nothing (plus quality bonus)
            feat[property] = Math.min(ceiling, current + qualityBonus * this.config.qualityBonusNothingScale);
        } else if (roll < nothingThreshold + (1 - cRel) / 2) {
            // Improve: gain up to outcomeMaxGainFraction of gap to ceiling
            const gap = ceiling - current;
            const gain = this.rng.random() * this.config.outcomeMaxGainFraction * gap;
            feat[property] = Math.min(ceiling, current + gain + qualityBonus * this.config.qualityBonusImproveScale);
        } else {
            // Jump to ceiling
            feat[property] = ceiling;
        }
        feat[property] = Math.max(0, Math.min(1.0, feat[property]));
    }

    // --- Cross-Feature Side Effects ---

    _rollSideEffect(sourceFeat) {
        if (this.rng.random() >= this.config.sideEffectRate) return;
        let target = null;
        if (this.rng.random() < this.config.sideEffectUpstreamWeight && sourceFeat.upstreamIds.size > 0) {
            const upIds = [...sourceFeat.upstreamIds];
            target = this.features.get(upIds[Math.floor(this.rng.random() * upIds.length)]);
        }
        if (!target) {
            const candidates = [...this.features.values()].filter(f => f.id !== sourceFeat.id);
            if (candidates.length > 0) target = candidates[Math.floor(this.rng.random() * candidates.length)];
        }
        if (!target) return;
        const change = this.rng.uniform(-this.config.sideEffectMaxChange, this.config.sideEffectMaxChange);
        target.codeCompleteness = Math.max(0, Math.min(1, target.codeCompleteness + change));
    }

    // --- Reported Success ---

    _rollReportedSuccess(actuallyComplete) {
        if (actuallyComplete) return true;
        // 50% chance of accurately reporting incomplete, 50% false positive
        return this.rng.random() >= this.config.reportAccuracyRate;
    }

    // --- Test Workflow ---

    _completeTestWorkflow() {
        if (!this.testWorkflow) return;
        this.testWorkflow.complete = true;
        for (const [, feat] of this.features) {
            feat.testResultPercent = this._computeTestResult(feat);
            feat.testResultUpdated = this.simulatedTime;
        }
        const passing = [...this.features.values()].filter(f => f.testResultPercent !== null && f.testResultPercent >= 95).length;
        this._addLog(`Tests complete: ${passing}/${this.features.size} passing`);
    }

    _computeTestResult(feat) {
        if (!feat.hasCode || !feat.hasTests) return null;
        const code = feat.codeCompleteness;
        const test = feat.testCompleteness;
        const maxVal = Math.max(code, test);
        const ownResult = maxVal > 0 ? Math.min(code, test) / maxVal : 0;
        let chainResult = ownResult;
        for (const upId of feat.upstreamIds) {
            const up = this.features.get(upId);
            if (up) {
                const upResult = this._computeOwnTestResult(up);
                if (upResult !== null) chainResult *= upResult;
            }
        }
        return Math.round(chainResult * 100);
    }

    _computeOwnTestResult(feat) {
        if (!feat.hasCode || !feat.hasTests) return null;
        const maxVal = Math.max(feat.codeCompleteness, feat.testCompleteness);
        return maxVal > 0 ? Math.min(feat.codeCompleteness, feat.testCompleteness) / maxVal : 0;
    }

    // --- Manual Test ---

    _completeManualTest() {
        const feat = this.features.get(this.manualTestFeatureId);
        if (!feat) {
            this.manualTestFeatureId = null;
            this.manualTestStartedAt = null;
            return;
        }
        const allComplete = feat.docCompleteness >= 1.0 && feat.codeCompleteness >= 1.0 && feat.testCompleteness >= 1.0;
        if (allComplete) {
            feat.manualTestResult = 'pass';
            this._addLog(`Manual test PASSED: ${feat.id}`);
        } else if (feat.manualTestResult === 'incomplete') {
            if (feat.docCompleteness < 1.0) feat.manualTestResult = 'doc';
            else if (feat.codeCompleteness < 1.0) feat.manualTestResult = 'code';
            else feat.manualTestResult = 'tests';
            this._addLog(`Manual test revealed: ${feat.id} — ${feat.manualTestResult} needs work`);
        } else {
            feat.manualTestResult = 'incomplete';
            this._addLog(`Manual test: ${feat.id} — something is incomplete`);
        }
        this.manualTestFeatureId = null;
        this.manualTestStartedAt = null;
        this._updateDepsMetStatus();
    }

    // --- Utilities ---

    get timeStr() {
        const day = Math.floor(this.simulatedTime / (24 * 60)) + 1;
        const dayMin = this.simulatedTime % (24 * 60);
        const h = Math.floor(dayMin / 60);
        const m = Math.floor(dayMin % 60);
        return `Day ${day} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    get creditHours() {
        return this.creditsRemaining / 60;
    }

    get overallProgress() {
        const feats = [...this.features.values()];
        if (feats.length === 0) return 0;
        return feats.filter(f => f.manualTestResult === 'pass').length / feats.length;
    }

    get isComplete() {
        return [...this.features.values()].every(f => f.manualTestResult === 'pass');
    }

    get testWorkflowProgress() {
        if (!this.testWorkflow || this.testWorkflow.complete) return null;
        return Math.min((this.simulatedTime - this.testWorkflow.startedAt) / this.testWorkflow.duration, 1);
    }

    get manualTestProgress() {
        if (!this.isManualTestActive) return null;
        return Math.min((this.simulatedTime - this.manualTestStartedAt) / this.config.manualTestDuration, 1);
    }

    _addLog(message) {
        const entry = `[${this.timeStr}] ${message}`;
        this.log.push(entry);
        if (this.log.length > 200) this.log.shift();
        if (this.onLogEntry) this.onLogEntry(entry);
    }

    _notify() {
        if (this.onStateChanged) this.onStateChanged();
    }

    setSeed(seed) {
        this.rng = new SeededRandom(seed);
    }
}

export {
    GameState,
    SimulationConfig,
    TaskType,
    TaskStatus,
    SubtaskLabel,
    Feature,
    Task,
    TaskEvent,
};
