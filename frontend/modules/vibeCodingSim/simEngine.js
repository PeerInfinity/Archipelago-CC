/**
 * Vibe Coding Simulator — Simulation Engine (v2)
 *
 * Three hidden completeness values per feature (doc, code, test).
 * Information is revealed through Claw reports (unreliable), test results
 * (ambiguous), and manual testing (ground truth but costly).
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
        this.baseTaskDuration = 10.0;

        this.weeklyCredits = 5040.0;
        this.weekDuration = 7 * 24 * 60;
        this.creditRate = 1.0;

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

        // Dependencies-not-met slowdown
        this.depsNotMetMultiplier = 2.0;

        // Task duration variance
        this.durationLogSigma = 0.6;

        // Test workflow
        this.testWorkflowDuration = 10.0;

        // Manual test
        this.manualTestDuration = 60.0; // 1 hour

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
    }

    get depsAreMet() {
        // Checked externally by GameState
        return this._depsAreMet;
    }
    set depsAreMet(val) {
        this._depsAreMet = val;
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
        this.progress = 0;
        this.subtaskIndex = 0;
        this.subtaskProgress = 0;
        this.subtaskDurations = [];
        this.subtaskLabel = '';
        this.startedAt = 0;
        this.completedAt = null;
        this.creditsUsed = 0;
        this.reportedSuccess = null; // set on completion

        // For merge conflicts: the code completeness of the branch
        this.branchCodeCompleteness = null;
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

    get currentSubtaskLabel() {
        if (this.status !== TaskStatus.RUNNING) return null;
        const subs = this.subtasks;
        if (this.subtaskIndex < subs.length) return subs[this.subtaskIndex];
        // In fix cycles
        const offset = this.subtaskIndex - subs.length;
        return offset % 2 === 0 ? SubtaskLabel.FIXING : SubtaskLabel.TESTING;
    }

    get overallProgress() {
        if (this.subtaskDurations.length === 0) return 0;
        return Math.min((this.subtaskIndex + this.subtaskProgress) / this.subtaskDurations.length, 1.0);
    }

    /** Returns fractional positions (0-1) where each subtask boundary falls. */
    get subtaskBoundaries() {
        const n = this.subtaskDurations.length;
        if (n <= 1) return [];
        const boundaries = [];
        for (let i = 1; i < n; i++) {
            boundaries.push(i / n);
        }
        return boundaries;
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
        this.creditsRemaining = this.config.weeklyCredits;
        this.weekStart = 0;
        this.testWorkflow = null;
        this.manualTestFeatureId = null;
        this.manualTestStartedAt = null;
        this.rng = new SeededRandom();
        this.log = [];
        this.paused = true;
        this.speedMultiplier = 1;

        this.onStateChanged = null;
        this.onLogEntry = null;

        // Map from graph node index to feature ID (for Region Graph integration)
        this.indexToFeatureId = {};
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

    getRunningTasks() {
        return this.tasks.filter(t => t.status === TaskStatus.RUNNING);
    }

    getCompletedTasks() {
        return this.tasks
            .filter(t => t.status !== TaskStatus.RUNNING)
            .slice(-this.config.maxTaskHistory);
    }

    getMergeConflicts() {
        return this.tasks.filter(t => t.status === TaskStatus.MERGE_CONFLICT);
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
        task.startedAt = this.simulatedTime;

        const subtasks = task.subtasks;
        const durationMult = feat.depsAreMet ? 1 : this.config.depsNotMetMultiplier;

        for (let i = 0; i < subtasks.length; i++) {
            const dur = this.config.baseTaskDuration * durationMult *
                Math.exp(this.rng.gauss(0, this.config.durationLogSigma));
            task.subtaskDurations.push(dur);
        }

        task.subtaskLabel = subtasks[0];
        this.tasks.push(task);

        // Check if this creates a potential merge conflict
        // (another running task of the same type on the same feature)
        if (taskType === TaskType.IMPLEMENT) {
            const otherRunning = this.tasks.filter(
                t => t.id !== task.id && t.status === TaskStatus.RUNNING &&
                     t.targetFeatureId === featureId && t.type === TaskType.IMPLEMENT
            );
            if (otherRunning.length > 0) {
                // Create a pending merge conflict entry
                const mergeTask = new Task(TaskType.MERGE_CONFLICT, featureId);
                mergeTask.startedAt = this.simulatedTime;
                mergeTask.status = TaskStatus.MERGE_CONFLICT;
                mergeTask._pendingMerge = true; // waiting for source tasks to finish
                mergeTask._sourceTaskIds = [otherRunning[0].id, task.id];
                this.tasks.push(mergeTask);
                this._addLog(`Potential merge conflict: two agents on ${featureId}`);
            }
        }

        this._addLog(`Started: ${task.label}`);
        this._notify();
        return task;
    }

    _startManualTest(featureId) {
        if (this.isManualTestActive) return null;
        this.manualTestFeatureId = featureId;
        this.manualTestStartedAt = this.simulatedTime;
        this._addLog(`Manual test started: ${featureId}`);
        this._notify();
        return { type: TaskType.MANUAL_TEST, featureId };
    }

    cancelTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status !== TaskStatus.RUNNING) return false;
        task.status = TaskStatus.CANCELLED;
        task.completedAt = this.simulatedTime;
        this._addLog(`Cancelled: ${task.label}`);
        this._notify();
        return true;
    }

    skipTesting(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status !== TaskStatus.RUNNING) return false;
        // Mark task to skip to just past the testing subtask
        task._skipTesting = true;
        this._addLog(`Will skip testing: ${task.label}`);
        return true;
    }

    _updatePendingMerges() {
        for (const merge of this.tasks) {
            if (merge.status !== TaskStatus.MERGE_CONFLICT || !merge._pendingMerge) continue;

            const sourceIds = merge._sourceTaskIds || [];
            const sources = sourceIds.map(id => this.tasks.find(t => t.id === id)).filter(Boolean);
            const uncancelled = sources.filter(t => t.status !== TaskStatus.CANCELLED);

            // If only one source remains uncancelled, remove the merge entry
            if (uncancelled.length <= 1) {
                merge.status = TaskStatus.CANCELLED;
                merge.completedAt = this.simulatedTime;
                this._addLog(`Merge conflict resolved: only one task remains on ${merge.targetFeatureId}`);
                continue;
            }

            // If all source tasks are done (completed/failed), enable the merge for resolution
            const allDone = uncancelled.every(t => t.status !== TaskStatus.RUNNING);
            if (allDone) {
                merge._pendingMerge = false;
            }
        }
    }

    resolveMergeConflict(conflictTaskId) {
        const conflict = this.tasks.find(t => t.id === conflictTaskId);
        if (!conflict || conflict.status !== TaskStatus.MERGE_CONFLICT) return null;

        const feat = this.features.get(conflict.targetFeatureId);
        if (!feat) return null;

        const task = new Task(TaskType.MERGE_CONFLICT, conflict.targetFeatureId);
        task.startedAt = this.simulatedTime;
        // Store the higher of current code and branch code
        task.branchCodeCompleteness = Math.max(
            feat.codeCompleteness,
            conflict.branchCodeCompleteness ?? 0
        );

        const durationMult = feat.depsAreMet ? 1 : this.config.depsNotMetMultiplier;
        for (let i = 0; i < MERGE_SUBTASKS.length; i++) {
            const dur = this.config.baseTaskDuration * 0.5 * durationMult *
                Math.exp(this.rng.gauss(0, this.config.durationLogSigma));
            task.subtaskDurations.push(dur);
        }

        task.subtaskLabel = MERGE_SUBTASKS[0];
        conflict.status = TaskStatus.FAILED;
        this.tasks.push(task);
        this._addLog(`Resolving merge conflict: ${task.targetFeatureId}`);
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

        // Weekly credit refresh
        if (this.simulatedTime - this.weekStart >= this.config.weekDuration) {
            this.creditsRemaining = this.config.weeklyCredits;
            this.weekStart = this.simulatedTime;
            this._addLog('Weekly credits refreshed!');
        }

        // Update tasks
        let changed = false;
        for (const task of this.tasks) {
            if (task.status !== TaskStatus.RUNNING) continue;
            if (this._tickTask(task, dt)) changed = true;
        }

        // Update pending merge conflicts
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
            if (this.simulatedTime - this.manualTestStartedAt >= this.config.manualTestDuration) {
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

        if (task.subtaskIndex >= task.subtaskDurations.length) {
            this._completeTask(task);
            return true;
        }

        // Handle skip testing: if flagged and we've reached the testing step, jump past it
        if (task._skipTesting) {
            const baseSubtasks = task.subtasks;
            const testingIndex = baseSubtasks.indexOf(SubtaskLabel.TESTING);
            if (testingIndex >= 0 && task.subtaskIndex >= testingIndex) {
                // Skip all remaining subtasks (testing + any fix cycles)
                task.subtaskIndex = task.subtaskDurations.length;
                task._skipTesting = false;
                task.progress = task.overallProgress;
                // Complete immediately on next tick
                return false;
            }
        }

        const dur = task.subtaskDurations[task.subtaskIndex];
        task.subtaskProgress += dt / dur;
        task.subtaskLabel = task.currentSubtaskLabel || 'finishing';

        if (task.subtaskProgress >= 1.0) {
            task.subtaskProgress = 0;
            task.subtaskIndex++;

            // Check if we just finished the main testing subtask — roll for inline regression
            const baseSubtasks = task.subtasks;
            const testingIndex = baseSubtasks.indexOf(SubtaskLabel.TESTING);
            if (testingIndex >= 0 && task.subtaskIndex === baseSubtasks.length) {
                // Just finished the last base subtask (testing)
                if (this._rollInlineRegression()) {
                    // Add fix + retest cycle
                    const feat = this.features.get(task.targetFeatureId);
                    const durationMult = (feat && !feat.depsAreMet) ? this.config.depsNotMetMultiplier : 1;
                    const fixDur = this.config.baseTaskDuration * durationMult *
                        Math.exp(this.rng.gauss(0, this.config.durationLogSigma));
                    const retestDur = this.config.baseTaskDuration * 0.5 * durationMult *
                        Math.exp(this.rng.gauss(0, this.config.durationLogSigma));
                    task.subtaskDurations.push(fixDur, retestDur);
                    this._addLog(`${task.label}: found issue during testing, fixing`);
                }
            }

            task.subtaskLabel = task.currentSubtaskLabel || 'finishing';
        }

        task.progress = task.overallProgress;
        return false;
    }

    _rollInlineRegression() {
        // 25% chance of a regression, and if so, 60% chance of catching it during testing
        return this.rng.random() < this.config.sideEffectRate &&
               this.rng.random() < 0.6;
    }

    // --- Task Completion ---

    _completeTask(task) {
        const feat = this.features.get(task.targetFeatureId);
        if (!feat) {
            task.status = TaskStatus.FAILED;
            task.completedAt = this.simulatedTime;
            return;
        }

        switch (task.type) {
            case TaskType.WRITE_DOC:
                this._completeWriteDoc(task, feat);
                break;
            case TaskType.EVALUATE_DOC:
                this._completeEvaluateDoc(task, feat);
                break;
            case TaskType.IMPLEMENT:
                this._completeImplement(task, feat);
                break;
            case TaskType.WRITE_TESTS:
                this._completeWriteTests(task, feat);
                break;
            case TaskType.MERGE_CONFLICT:
                this._completeMergeConflict(task, feat);
                break;
        }
    }

    _completeWriteDoc(task, feat) {
        if (this.rng.random() < this.config.docSuccessRate) {
            feat.docCompleteness = 1.0;
        } else {
            feat.docCompleteness = this.rng.uniform(this.config.docPartialMin, this.config.docPartialMax);
        }
        feat.hasDoc = true;
        task.status = TaskStatus.COMPLETED;
        task.completedAt = this.simulatedTime;
        task.reportedSuccess = this._rollReportedSuccess(feat.docCompleteness >= 1.0);
        this._addLog(`Completed: ${task.label} — ${task.reportedSuccess ? 'reports success' : 'reports issues found'}`);
    }

    _completeEvaluateDoc(task, feat) {
        this._applyUniversalOutcome(feat, 'docCompleteness', 1.0);
        task.status = TaskStatus.COMPLETED;
        task.completedAt = this.simulatedTime;
        task.reportedSuccess = this._rollReportedSuccess(feat.docCompleteness >= 1.0);
        this._addLog(`Completed: ${task.label} — ${task.reportedSuccess ? 'reports doc looks good' : 'reports issues found'}`);
    }

    _completeImplement(task, feat) {
        // 25% chance of free doc reevaluation during investigation
        if (this.rng.random() < this.config.investigationDocRevalRate) {
            this._applyUniversalOutcome(feat, 'docCompleteness', 1.0);
            this._addLog(`${task.label}: noticed doc issue during investigation`);
        }

        // Store branch completeness for any pending merge conflict
        task.branchCodeCompleteness = this._computeImplementResult(feat);

        const ceiling = feat.docCompleteness;
        if (feat.codeCompleteness === 0) {
            // First implementation
            if (this.rng.random() < this.config.firstImplExactMatchRate) {
                feat.codeCompleteness = ceiling;
            } else {
                feat.codeCompleteness = this.rng.uniform(
                    this.config.firstImplPartialMin,
                    this.config.firstImplPartialMax
                ) * ceiling;
            }
        } else {
            // Re-implementation
            this._applyUniversalOutcome(feat, 'codeCompleteness', ceiling);
        }

        feat.hasCode = true;
        feat.manualTestResult = null; // invalidate previous manual test
        task.status = TaskStatus.COMPLETED;
        task.completedAt = this.simulatedTime;
        task.reportedSuccess = this._rollReportedSuccess(feat.codeCompleteness >= ceiling);
        this._addLog(`Completed: ${task.label} — ${task.reportedSuccess ? 'reports success' : 'reports issues found'}`);

        // Cross-feature side effects
        this._rollSideEffect(feat);
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

    _completeWriteTests(task, feat) {
        // 25% chance of free doc reevaluation
        if (this.rng.random() < this.config.investigationDocRevalRate) {
            this._applyUniversalOutcome(feat, 'docCompleteness', 1.0);
            this._addLog(`${task.label}: noticed doc issue during investigation`);
        }

        const ceiling = feat.docCompleteness;
        if (feat.testCompleteness === 0) {
            // First test writing
            if (this.rng.random() < this.config.firstImplExactMatchRate) {
                feat.testCompleteness = ceiling;
            } else {
                feat.testCompleteness = this.rng.uniform(
                    this.config.firstImplPartialMin,
                    this.config.firstImplPartialMax
                ) * ceiling;
            }
        } else {
            // Re-implementation of tests
            this._applyUniversalOutcome(feat, 'testCompleteness', ceiling);
        }

        feat.hasTests = true;
        feat.manualTestResult = null; // invalidate
        task.status = TaskStatus.COMPLETED;
        task.completedAt = this.simulatedTime;
        task.reportedSuccess = this._rollReportedSuccess(feat.testCompleteness >= ceiling);
        this._addLog(`Completed: ${task.label} — ${task.reportedSuccess ? 'reports success' : 'reports issues found'}`);
    }

    _completeMergeConflict(task, feat) {
        const branchCode = task.branchCodeCompleteness ?? 0;
        const current = Math.max(feat.codeCompleteness, branchCode);
        const ceiling = feat.docCompleteness;

        // Apply universal outcome starting from the higher value
        feat.codeCompleteness = current;
        this._applyUniversalOutcome(feat, 'codeCompleteness', ceiling);

        feat.hasCode = true;
        feat.manualTestResult = null;
        task.status = TaskStatus.COMPLETED;
        task.completedAt = this.simulatedTime;
        task.reportedSuccess = this._rollReportedSuccess(feat.codeCompleteness >= ceiling);
        this._addLog(`Merge resolved: ${task.targetFeatureId} — ${task.reportedSuccess ? 'reports success' : 'reports issues'}`);

        this._rollSideEffect(feat);
    }

    // --- Universal Outcome Formula ---

    _applyUniversalOutcome(feat, property, ceiling) {
        if (ceiling <= 0) return;
        const current = feat[property];
        const cRel = current / ceiling;
        const roll = this.rng.random();

        if (roll < 0.25) {
            // Reduce: lose up to 50% of current
            const loss = this.rng.random() * 0.5 * current;
            feat[property] = Math.max(0, current - loss);
        } else if (roll < 0.5) {
            // Nothing
        } else if (roll < 0.5 + (1 - cRel) / 2) {
            // Improve: gain up to 50% of gap to ceiling
            const gap = ceiling - current;
            const gain = this.rng.random() * 0.5 * gap;
            feat[property] = Math.min(ceiling, current + gain);
        } else {
            // Jump to ceiling
            feat[property] = ceiling;
        }
    }

    _simulateUniversalOutcome(current, ceiling) {
        if (ceiling <= 0) return current;
        const cRel = current / ceiling;
        const roll = this.rng.random();

        if (roll < 0.25) {
            return Math.max(0, current - this.rng.random() * 0.5 * current);
        } else if (roll < 0.5) {
            return current;
        } else if (roll < 0.5 + (1 - cRel) / 2) {
            const gap = ceiling - current;
            return Math.min(ceiling, current + this.rng.random() * 0.5 * gap);
        } else {
            return ceiling;
        }
    }

    // --- Cross-Feature Side Effects ---

    _rollSideEffect(sourceFeat) {
        if (this.rng.random() >= this.config.sideEffectRate) return;

        // Pick target
        let target = null;
        if (this.rng.random() < this.config.sideEffectUpstreamWeight && sourceFeat.upstreamIds.size > 0) {
            // Upstream feature
            const upIds = [...sourceFeat.upstreamIds];
            target = this.features.get(upIds[Math.floor(this.rng.random() * upIds.length)]);
        }
        if (!target) {
            // Unrelated feature
            const candidates = [...this.features.values()].filter(f => f.id !== sourceFeat.id);
            if (candidates.length > 0) {
                target = candidates[Math.floor(this.rng.random() * candidates.length)];
            }
        }
        if (!target) return;

        const change = this.rng.uniform(-this.config.sideEffectMaxChange, this.config.sideEffectMaxChange);
        target.codeCompleteness = Math.max(0, Math.min(1, target.codeCompleteness + change));
        // Note: NOT capped by doc completeness, and NOT logged (hidden)
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

        // Own result: min(code, test) / max(code, test)
        const code = feat.codeCompleteness;
        const test = feat.testCompleteness;
        const maxVal = Math.max(code, test);
        const ownResult = maxVal > 0 ? Math.min(code, test) / maxVal : 0;

        // Product with upstream results
        let chainResult = ownResult;
        for (const upId of feat.upstreamIds) {
            const up = this.features.get(upId);
            if (!up) continue;
            const upResult = this._computeOwnTestResult(up);
            if (upResult !== null) {
                chainResult *= upResult;
            }
        }

        return Math.round(chainResult * 100);
    }

    _computeOwnTestResult(feat) {
        if (!feat.hasCode || !feat.hasTests) return null;
        const code = feat.codeCompleteness;
        const test = feat.testCompleteness;
        const maxVal = Math.max(code, test);
        return maxVal > 0 ? Math.min(code, test) / maxVal : 0;
    }

    // --- Manual Test ---

    _completeManualTest() {
        const feat = this.features.get(this.manualTestFeatureId);
        if (!feat) {
            this.manualTestFeatureId = null;
            this.manualTestStartedAt = null;
            return;
        }

        const allComplete = feat.docCompleteness >= 1.0 &&
                            feat.codeCompleteness >= 1.0 &&
                            feat.testCompleteness >= 1.0;

        if (allComplete) {
            feat.manualTestResult = 'pass';
            this._addLog(`Manual test PASSED: ${feat.id}`);
        } else if (feat.manualTestResult === 'incomplete') {
            // Follow-up test: reveal which area is the problem
            if (feat.docCompleteness < 1.0) {
                feat.manualTestResult = 'doc';
            } else if (feat.codeCompleteness < 1.0) {
                feat.manualTestResult = 'code';
            } else {
                feat.manualTestResult = 'tests';
            }
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
};
