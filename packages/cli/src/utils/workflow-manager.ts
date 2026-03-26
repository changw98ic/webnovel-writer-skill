/**
 * 工作流状态管理器
 *
 * 迁移自 Python workflow_manager.py
 * 跟踪 write/review 任务执行状态，检测中断点，提供恢复选项
 */
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { writeJsonAtomic, readJsonSafe } from './security.js';

// ============================================================================
// Constants
// ============================================================================

export const TASK_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const STEP_STATUS = {
  STARTED: 'started',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// ============================================================================
// Types
// ============================================================================

export interface Step {
  id: string;
  name: string;
  status: string;
  startedAt: string;
  runningAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  attempt: number;
  progressNote?: string;
  artifacts?: Record<string, unknown>;
}

export interface Task {
  command: string;
  args: Record<string, unknown>;
  startedAt: string;
  lastHeartbeat: string;
  status: string;
  currentStep: Step | null;
  completedSteps: Step[];
  failedSteps: Step[];
  pendingSteps: string[];
  retryCount: number;
  artifacts: {
    chapterFile?: Record<string, unknown>;
    gitStatus?: Record<string, unknown>;
    stateJsonModified: boolean;
    entitiesAppeared: boolean;
    reviewCompleted: boolean;
  };
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
}

export interface WorkflowState {
  currentTask: Task | null;
  lastStableState: {
    command: string;
    chapterNum?: number;
    completedAt?: string;
    artifacts: Record<string, unknown>;
  } | null;
  history: Array<{
    taskId: string;
    command: string;
    chapter?: number;
    status: string;
    completedAt?: string;
  }>;
}

export interface InterruptionInfo {
  command: string;
  args: Record<string, unknown>;
  taskStatus: string;
  currentStep: Step | null;
  completedSteps: Step[];
  failedSteps: Step[];
  elapsedSeconds: number;
  artifacts: Record<string, unknown>;
  startedAt: string;
  retryCount: number;
}

export interface RecoveryOption {
  option: string;
  label: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
  actions: string[];
}

interface CallTraceEntry {
  timestamp: string;
  event: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Utility Functions
// ============================================================================

function nowIso(): string {
  return new Date().toISOString();
}

// ============================================================================
// Workflow Manager
// ============================================================================

export class WorkflowManager {
  private _projectRoot: string;
  private statePath: string;
  private tracePath: string;

  /** Get the project root directory */
  get projectRoot(): string {
    return this._projectRoot;
  }

  constructor(projectRoot: string) {
    this._projectRoot = projectRoot;
    const webnovelDir = join(projectRoot, '.webnovel');
    if (!existsSync(webnovelDir)) {
      mkdirSync(webnovelDir, { recursive: true });
    }
    this.statePath = join(webnovelDir, 'workflow_state.json');
    this.tracePath = join(webnovelDir, 'observability', 'call_trace.jsonl');

    const traceDir = dirname(this.tracePath);
    if (!existsSync(traceDir)) {
      mkdirSync(traceDir, { recursive: true });
    }
  }

  // ==================== State Management ====================

  loadState(): WorkflowState {
    const state = readJsonSafe<WorkflowState>(this.statePath, {
      currentTask: null,
      lastStableState: null,
      history: [],
    });

    // Ensure defaults
    state.currentTask ??= null;
    state.lastStableState ??= null;
    state.history ??= [];

    if (state.currentTask) {
      state.currentTask.failedSteps ??= [];
      state.currentTask.retryCount ??= 0;
    }

    return state;
  }

  saveState(state: WorkflowState): void {
    writeJsonAtomic(this.statePath, state);
  }

  // ==================== Task Management ====================

  getPendingSteps(command: string): string[] {
    if (command === 'webnovel-write') {
      return ['Step 1', 'Step 2A', 'Step 2B', 'Step 3', 'Step 4', 'Step 5', 'Step 6'];
    }
    if (command === 'webnovel-review') {
      return ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6', 'Step 7', 'Step 8'];
    }
    return [];
  }

  startTask(command: string, args: Record<string, unknown>): void {
    const state = this.loadState();
    const current = state.currentTask;

    if (current && current.status === TASK_STATUS.RUNNING) {
      current.retryCount = (current.retryCount ?? 0) + 1;
      current.lastHeartbeat = nowIso();
      state.currentTask = current;
      this.saveState(state);
      this.appendCallTrace('task_reentered', {
        command: current.command,
        chapter: current.args?.chapter_num,
        retryCount: current.retryCount,
      });
      console.log(`ℹ️ 任务已在运行，执行重入标记: ${current.command}`);
      return;
    }

    const startedAt = nowIso();
    state.currentTask = {
      command,
      args,
      startedAt,
      lastHeartbeat: startedAt,
      status: TASK_STATUS.RUNNING,
      currentStep: null,
      completedSteps: [],
      failedSteps: [],
      pendingSteps: this.getPendingSteps(command),
      retryCount: 0,
      artifacts: {
        stateJsonModified: false,
        entitiesAppeared: false,
        reviewCompleted: false,
      },
    };

    this.saveState(state);
    this.appendCallTrace('task_started', { command, args });
    console.log(`✅ 任务已启动: ${command} ${JSON.stringify(args)}`);
  }

  startStep(stepId: string, stepName: string, progressNote?: string): void {
    const state = this.loadState();
    const task = state.currentTask;
    if (!task) {
      console.log('⚠️ 无活动任务，请先使用 startTask');
      return;
    }

    // Finalize previous step as failed if not completed
    this.finalizeCurrentStepAsFailed(task, 'step_replaced_before_completion');

    const startedAt = nowIso();
    task.currentStep = {
      id: stepId,
      name: stepName,
      status: STEP_STATUS.RUNNING,
      startedAt,
      runningAt: startedAt,
      attempt: (task.retryCount ?? 0) + 1,
      progressNote,
    };
    task.status = TASK_STATUS.RUNNING;
    task.lastHeartbeat = nowIso();

    this.saveState(state);
    this.appendCallTrace('step_started', {
      stepId,
      stepName,
      command: task.command,
      chapter: task.args?.chapter_num,
      progressNote,
    });
    console.log(`▶️ ${stepId} 开始: ${stepName}`);
  }

  completeStep(stepId: string, artifacts?: Record<string, unknown>): void {
    const state = this.loadState();
    const task = state.currentTask;
    if (!task || !task.currentStep) {
      console.log('⚠️ 无活动 Step');
      return;
    }

    const currentStep = task.currentStep;
    if (currentStep.id !== stepId) {
      console.log(`⚠️ 当前 Step 为 ${currentStep.id}，与 ${stepId} 不一致，拒绝完成`);
      this.appendCallTrace('step_complete_rejected', {
        requestedStepId: stepId,
        activeStepId: currentStep.id,
        command: task.command,
      });
      return;
    }

    currentStep.status = STEP_STATUS.COMPLETED;
    currentStep.completedAt = nowIso();

    if (artifacts) {
      currentStep.artifacts = artifacts;
      Object.assign(task.artifacts, artifacts);
    }

    task.completedSteps.push(currentStep);
    task.currentStep = null;
    task.lastHeartbeat = nowIso();

    this.saveState(state);
    this.appendCallTrace('step_completed', {
      stepId,
      command: task.command,
      chapter: task.args?.chapter_num,
    });
    console.log(`✅ ${stepId} 完成`);
  }

  completeTask(finalArtifacts?: Record<string, unknown>): void {
    const state = this.loadState();
    const task = state.currentTask;
    if (!task) {
      console.log('⚠️ 无活动任务');
      return;
    }

    this.finalizeCurrentStepAsFailed(task, 'task_completed_with_active_step');

    task.status = TASK_STATUS.COMPLETED;
    task.completedAt = nowIso();

    if (finalArtifacts) {
      Object.assign(task.artifacts, finalArtifacts);
    }

    state.lastStableState = this.extractStableState(task);
    state.history ??= [];
    state.history.push({
      taskId: `task_${state.history.length + 1}:03d}`,
      command: task.command,
      chapter: task.args?.chapter_num as number | undefined,
      status: TASK_STATUS.COMPLETED,
      completedAt: task.completedAt,
    });

    state.currentTask = null;
    this.saveState(state);
    this.appendCallTrace('task_completed', {
      command: task.command,
      chapter: task.args?.chapter_num,
      completedSteps: task.completedSteps.length,
      failedSteps: task.failedSteps.length,
    });
    console.log('🎀 任务完成');
  }

  failCurrentTask(reason: string): void {
    const state = this.loadState();
    const task = state.currentTask;
    if (!task) {
      console.log('⚠️ 无活动任务');
      return;
    }

    this.finalizeCurrentStepAsFailed(task, reason);
    task.status = TASK_STATUS.FAILED;
    task.failedAt = nowIso();
    task.failureReason = reason;

    this.saveState(state);
    this.appendCallTrace('task_failed', {
      command: task.command,
      chapter: task.args?.chapter_num,
      reason,
    });
    console.log(`⚠️ 任务已标记失败: ${reason}`);
  }

  clearCurrentTask(): void {
    const state = this.loadState();
    const task = state.currentTask;
    if (task) {
      this.appendCallTrace('task_cleared', {
        command: task.command,
        chapter: task.args?.chapter_num,
        status: task.status,
      });
      state.currentTask = null;
      this.saveState(state);
      console.log('✅ 中断任务已清除');
    } else {
      console.log('⚠️ 无中断任务');
    }
  }

  // ==================== Interruption Detection ====================

  detectInterruption(): InterruptionInfo | null {
    const state = this.loadState();
    if (!state || !state.currentTask) {
      return null;
    }

    const task = state.currentTask;
    if (task.status === TASK_STATUS.COMPLETED) {
      return null;
    }

    const lastHeartbeat = new Date(task.lastHeartbeat);
    const elapsed = (Date.now() - lastHeartbeat.getTime()) / 1000;

    const interruptInfo: InterruptionInfo = {
      command: task.command,
      args: task.args,
      taskStatus: task.status,
      currentStep: task.currentStep,
      completedSteps: task.completedSteps,
      failedSteps: task.failedSteps,
      elapsedSeconds: elapsed,
      artifacts: task.artifacts,
      startedAt: task.startedAt,
      retryCount: task.retryCount,
    };

    this.appendCallTrace('interruption_detected', {
      command: task.command,
      chapter: task.args?.chapter_num,
      taskStatus: task.status,
      currentStep: task.currentStep?.id,
      elapsedSeconds: elapsed,
    });

    return interruptInfo;
  }

  analyzeRecoveryOptions(interruptInfo: InterruptionInfo): RecoveryOption[] {
    const currentStep = interruptInfo.currentStep;
    const command = interruptInfo.command;
    const chapterNum = interruptInfo.args?.chapter_num ?? '?';

    if (!currentStep) {
      return [
        {
          option: 'A',
          label: '从头开始',
          risk: 'low',
          description: '重新执行完整流程',
          actions: [
            '删除 workflow_state.json 当前任务',
            `执行 /${command} ${chapterNum}`,
          ],
        },
      ];
    }

    const stepId = currentStep.id;

    // Step 1 or 1.5
    if (['Step 1', 'Step 1.5'].includes(stepId)) {
      return [
        {
          option: 'A',
          label: '从 Step 1 重新开始',
          risk: 'low',
          description: '重新加载上下文',
          actions: ['清理中断状态', `执行 /${command} ${chapterNum}`],
        },
      ];
    }

    // Step 2 variants
    if (['Step 2', 'Step 2A', 'Step 2B'].includes(stepId)) {
      return [
        {
          option: 'A',
          label: '删除半成品，从 Step 1 重启',
          risk: 'low',
          description: `清理章节文件，重新生成章节`,
          actions: [
            `删除章节文件（如存在）`,
            '清理 Git 暂存区',
            '清理中断状态',
            `执行 /${command} ${chapterNum}`,
          ],
        },
        {
          option: 'B',
          label: '回滚到上一章',
          risk: 'medium',
          description: '丢弃当前章节进度',
          actions: [
            `git reset --hard ch${String((chapterNum as number) - 1).padStart(4, '0')}`,
            '清理中断状态',
            `重新决定是否继续 Ch${chapterNum}`,
          ],
        },
      ];
    }

    // Step 3
    if (stepId === 'Step 3') {
      return [
        {
          option: 'A',
          label: '重新执行审查',
          risk: 'medium',
          description: '重新调用审查员并生成报告',
          actions: ['重新执行审查', '生成审查报告', '继续 Step 4 润色'],
        },
        {
          option: 'B',
          label: '跳过审查直接润色',
          risk: 'low',
          description: '后续可用 /webnovel-review 补审',
          actions: ['标记审查已跳过', '继续 Step 4 润色'],
        },
      ];
    }

    // Step 4
    if (stepId === 'Step 4') {
      return [
        {
          option: 'A',
          label: '继续润色',
          risk: 'low',
          description: '继续润色章节文件，完成后进入 Step 5',
          actions: ['继续润色章节文件', '保存文件', '继续 Step 5（Data Agent）'],
        },
        {
          option: 'B',
          label: '删除润色稿，从 Step 2A 重写',
          risk: 'medium',
          description: '删除章节文件并重新生成',
          actions: ['删除章节文件', '清理 Git 暂存区', '清理中断状态', `执行 /${command} ${chapterNum}`],
        },
      ];
    }

    // Step 5
    if (stepId === 'Step 5') {
      return [
        {
          option: 'A',
          label: '从 Step 5 重新开始',
          risk: 'low',
          description: '重新运行 Data Agent（幂等）',
          actions: ['重新调用 Data Agent', '继续 Step 6（Git 备份）'],
        },
      ];
    }

    // Step 6
    if (stepId === 'Step 6') {
      return [
        {
          option: 'A',
          label: '继续 Git 提交',
          risk: 'low',
          description: '完成未完成的 Git commit + tag',
          actions: ['检查 Git 暂存区', '重新执行备份', '继续 complete-task'],
        },
        {
          option: 'B',
          label: '回滚 Git 改动',
          risk: 'medium',
          description: '丢弃暂存区所有改动',
          actions: ['git reset HEAD .', `删除第${chapterNum}章文件`, '清理中断状态'],
        },
      ];
    }

    // Default
    return [
      {
        option: 'A',
        label: '从头开始',
        risk: 'low',
        description: '重新执行完整流程',
        actions: ['清理所有中断 artifacts', `执行 /${command} ${chapterNum}`],
      },
    ];
  }

  // ==================== Helpers ====================

  private finalizeCurrentStepAsFailed(task: Task, reason: string): void {
    const currentStep = task.currentStep;
    if (!currentStep) return;
    if ([STEP_STATUS.COMPLETED, STEP_STATUS.FAILED].includes(currentStep.status as typeof STEP_STATUS.COMPLETED | typeof STEP_STATUS.FAILED)) return;

    currentStep.status = STEP_STATUS.FAILED;
    currentStep.failedAt = nowIso();
    currentStep.failureReason = reason;
    task.failedSteps.push(currentStep);
    task.currentStep = null;
  }

  private extractStableState(task: Task): WorkflowState['lastStableState'] {
    return {
      command: task.command,
      chapterNum: task.args?.chapter_num as number | undefined,
      completedAt: task.completedAt,
      artifacts: task.artifacts,
    };
  }

  private appendCallTrace(event: string, payload: Record<string, unknown>): void {
    try {
      const entry: CallTraceEntry = {
        timestamp: nowIso(),
        event,
        payload,
      };
      appendFileSync(this.tracePath, JSON.stringify(entry, null, 2) + '\n', 'utf-8');
    } catch {
      // Best effort
    }
  }
}
