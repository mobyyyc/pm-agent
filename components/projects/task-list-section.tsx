"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { TaskListControls } from "./task-list-controls";
import { TaskStatusSelect } from "@/app/projects/[id]/task-status-select";
import type { ProjectMember, Task } from "@/types/models";

type TaskDraft = Pick<Task, "title" | "description" | "deadline" | "suggestedAssignee" | "status">;
type TaskStatusFilter = "all" | "todo" | "in_progress" | "done";
type TaskListMode = "mine" | "all";

type TaskListSectionProps = {
  visibleTasks: Task[];
  editingTaskId: string | null;
  taskDraft: TaskDraft | null;
  taskStatusFilter: TaskStatusFilter;
  taskListMode: TaskListMode;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  taskEditCooldownId: string | null;
  pendingTaskId: string | null;
  isAddingTask: boolean;
  projectMembers: ProjectMember[];
  currentUserMember: ProjectMember | null;
  ownerMember: ProjectMember;
  isGuest: boolean;
  statusCardStyles: Record<Task["status"], string>;
  frameEditButtonClass: string;
  framePrimaryActionButtonClass: string;
  onTaskEditStart: (task: Task) => void;
  onTaskDraftChange: (field: keyof TaskDraft, value: string) => void;
  onSaveTask: () => Promise<void>;
  onRemoveTask: (taskId: string) => Promise<void>;
  onAddTask: () => Promise<void>;
  onClaimTask: (task: Task) => Promise<void>;
  onTaskStatusFilterChange: (filter: TaskStatusFilter) => void;
  onTaskListModeChange: (mode: TaskListMode) => void;
  getMemberLabel: (member: ProjectMember) => string;
  getAssigneeLabel: (value?: string | null) => string;
  isTaskAssignedToCurrentUser: (task: Task) => boolean;
  onStatusChange: (taskId: string, status: Task["status"]) => void;
};

export function TaskListSection({
  visibleTasks,
  editingTaskId,
  taskDraft,
  taskStatusFilter,
  taskListMode,
  todoCount,
  inProgressCount,
  doneCount,
  taskEditCooldownId,
  pendingTaskId,
  isAddingTask,
  projectMembers,
  currentUserMember,
  ownerMember,
  isGuest,
  statusCardStyles,
  frameEditButtonClass,
  framePrimaryActionButtonClass,
  onTaskEditStart,
  onTaskDraftChange,
  onSaveTask,
  onRemoveTask,
  onAddTask,
  onClaimTask,
  onTaskStatusFilterChange,
  onTaskListModeChange,
  getAssigneeLabel,
  getMemberLabel,
  isTaskAssignedToCurrentUser,
  onStatusChange,
}: TaskListSectionProps) {
  return (
    <section className="app-frame rounded-2xl bg-white/5 p-4 sm:p-5 md:p-6">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Task List</h2>
      
      <div className="mb-4">
        <TaskListControls
          taskStatusFilter={taskStatusFilter}
          taskListMode={taskListMode}
          todoCount={todoCount}
          inProgressCount={inProgressCount}
          doneCount={doneCount}
          onTaskStatusFilterChange={onTaskStatusFilterChange}
          onTaskListModeChange={onTaskListModeChange}
        />
      </div>
      {visibleTasks.length === 0 ? (
        <p className="text-sm text-neutral-400">No tasks generated.</p>
      ) : (
        <ul className="space-y-3">
          {visibleTasks.map((task, index) => {
            const isEditing = editingTaskId === task.id;
            const isPending = pendingTaskId === task.id;
            const taskView = isEditing && taskDraft ? { ...task, ...taskDraft } : task;

            return (
              <li
                key={task.id}
                className={`app-frame-item app-frame-hover group relative rounded-xl p-4 transition-all duration-300 ease-in-out ${
                  statusCardStyles[taskView.status]
                } ${isEditing ? "ring-1 ring-white/20" : "hover:bg-white/10"}`}
              >
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-black/25 px-2 py-0.5 text-xs font-medium text-neutral-300">
                        Task {index + 1}
                      </span>
                      <p className="text-lg font-medium text-white">{taskView.title}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-neutral-400">{taskView.description}</p>
                  </div>

                  <div className="w-full pt-1 sm:w-auto sm:shrink-0">
                    {!isEditing ? (
                      <TaskStatusSelect
                        taskId={task.id}
                        initialStatus={task.status}
                        isGuest={isGuest}
                        onStatusChange={onStatusChange}
                      />
                    ) : (
                      <div aria-hidden="true" className="w-full rounded-xl p-1 opacity-0 sm:min-w-70 sm:w-auto">
                        <div className="grid grid-cols-3 gap-1">
                          <span className="h-8 rounded-lg" />
                          <span className="h-8 rounded-lg" />
                          <span className="h-8 rounded-lg" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <span className="inline-flex h-7 items-center rounded-md bg-white/5 px-2 text-xs text-neutral-500">
                      Deadline: {taskView.deadline}
                    </span>
                    <span className="inline-flex h-7 items-center rounded-md bg-white/5 px-2 text-xs text-neutral-500">
                      {getAssigneeLabel(taskView.suggestedAssignee)}
                      {currentUserMember && isTaskAssignedToCurrentUser(taskView) ? (
                        <span className="ml-2 task-assignee-you-badge inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold leading-none text-emerald-300">
                          You
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex h-7 shrink-0 items-end justify-end gap-2">
                    {!isEditing ? (
                      <>
                        {!isTaskAssignedToCurrentUser(task) ? (
                          <button
                            type="button"
                            onClick={() => void onClaimTask(task)}
                            disabled={isPending || !currentUserMember}
                            className={frameEditButtonClass}
                          >
                            Claim
                          </button>
                        ) : null}
                        {taskEditCooldownId !== task.id ? (
                          <button
                            type="button"
                            onClick={() => onTaskEditStart(task)}
                            disabled={isPending}
                            className={frameEditButtonClass}
                          >
                            Edit
                          </button>
                        ) : (
                          <span aria-hidden="true" className="inline-flex h-7 w-16" />
                        )}
                      </>
                    ) : (
                      <span aria-hidden="true" className="inline-flex h-7 w-full" />
                    )}
                  </div>
                </div>

                <div
                  className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-in-out ${
                    isEditing ? "mt-4 max-h-140 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs text-neutral-400 sm:col-span-2">
                        <span>Title</span>
                        <input
                          type="text"
                          value={taskDraft?.title || ""}
                          onChange={(event) => onTaskDraftChange("title", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400 sm:col-span-2">
                        <span>Description</span>
                        <textarea
                          value={taskDraft?.description || ""}
                          onChange={(event) => onTaskDraftChange("description", event.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Deadline</span>
                        <input
                          type="date"
                          value={taskDraft?.deadline || ""}
                          onChange={(event) => onTaskDraftChange("deadline", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Assignee</span>
                        <div className="relative">
                          <select
                            value={taskDraft?.suggestedAssignee || ownerMember.userId}
                            onChange={(event) => onTaskDraftChange("suggestedAssignee", event.target.value)}
                            className="w-full appearance-none rounded-xl border border-white/15 bg-black/25 px-3 py-2 pr-10 text-sm text-white outline-none transition-colors focus:border-white/40"
                          >
                            {projectMembers.map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {getMemberLabel(member)}
                              </option>
                            ))}
                          </select>
                          <ChevronDownIcon
                            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                            aria-hidden="true"
                          />
                        </div>
                      </label>
                      <label className="space-y-1 text-xs text-neutral-400">
                        <span>Status</span>
                        <select
                          value={taskDraft?.status || "todo"}
                          onChange={(event) => onTaskDraftChange("status", event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/40"
                        >
                          <option value="todo">To do</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => void onRemoveTask(task.id)}
                        disabled={isPending}
                        className="app-destructive-button rounded-full px-4 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => void onSaveTask()}
                        disabled={isPending}
                        className="key-button rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-5 flex items-center justify-start">
        <button
          type="button"
          onClick={() => void onAddTask()}
          disabled={isAddingTask || pendingTaskId !== null}
          className={framePrimaryActionButtonClass}
        >
          {isAddingTask ? "Adding task..." : "Add Task"}
        </button>
      </div>
    </section>
  );
}
