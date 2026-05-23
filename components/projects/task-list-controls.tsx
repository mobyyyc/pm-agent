type TaskStatusFilter = "all" | "todo" | "in_progress" | "done";
type TaskListMode = "mine" | "all";

type TaskListControlsProps = {
  taskStatusFilter: TaskStatusFilter;
  taskListMode: TaskListMode;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  onTaskStatusFilterChange: (filter: TaskStatusFilter) => void;
  onTaskListModeChange: (mode: TaskListMode) => void;
};

export function TaskListControls({
  taskStatusFilter,
  taskListMode,
  todoCount,
  inProgressCount,
  doneCount,
  onTaskStatusFilterChange,
  onTaskListModeChange,
}: TaskListControlsProps) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4">
      <div className="flex min-w-0 justify-start">
        <div
          className="relative flex w-full min-w-0 max-w-full flex-nowrap overflow-hidden rounded-full bg-(--surface-soft) p-1"
          role="tablist"
          aria-label="Task status filter"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 rounded-full bg-(--frame-surface-hover) shadow-sm transition-[left,right,background-color] duration-150 ease-out ${
              taskStatusFilter === "all"
                ? "left-1 right-[calc(75%+0.125rem)]"
                : taskStatusFilter === "todo"
                  ? "left-[calc(25%+0.125rem)] right-[calc(50%+0.125rem)]"
                  : taskStatusFilter === "in_progress"
                    ? "left-[calc(50%+0.125rem)] right-[calc(25%+0.125rem)]"
                    : "left-[calc(75%+0.125rem)] right-1"
            }`}
          />
          <button
            type="button"
            role="tab"
            aria-selected={taskStatusFilter === "all"}
            onClick={() => onTaskStatusFilterChange("all")}
            className={`relative z-10 h-8 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors duration-150 ${
              taskStatusFilter === "all" ? "text-(--foreground)" : "text-neutral-400 hover:text-(--foreground)"
            }`}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={taskStatusFilter === "todo"}
            onClick={() => onTaskStatusFilterChange("todo")}
            className={`relative z-10 h-8 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors duration-150 ${
              taskStatusFilter === "todo" ? "text-(--foreground)" : "text-neutral-400 hover:text-(--foreground)"
            }`}
          >
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-sky-300" aria-hidden="true" />
              TD ({todoCount})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={taskStatusFilter === "in_progress"}
            onClick={() => onTaskStatusFilterChange("in_progress")}
            className={`relative z-10 h-8 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors duration-150 ${
              taskStatusFilter === "in_progress" ? "text-(--foreground)" : "text-neutral-400 hover:text-(--foreground)"
            }`}
          >
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden="true" />
              IP ({inProgressCount})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={taskStatusFilter === "done"}
            onClick={() => onTaskStatusFilterChange("done")}
            className={`relative z-10 h-8 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors duration-150 ${
              taskStatusFilter === "done" ? "text-(--foreground)" : "text-neutral-400 hover:text-(--foreground)"
            }`}
          >
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
              D ({doneCount})
            </span>
          </button>
        </div>
      </div>

      <div className="flex min-w-0 justify-start sm:justify-end">
        <div
          className="relative flex w-full min-w-0 max-w-full overflow-hidden rounded-full bg-(--surface-soft) p-1 sm:max-w-64"
          role="tablist"
          aria-label="Task list filter"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 rounded-full bg-(--frame-surface-hover) shadow-sm transition-[left,right,background-color] duration-150 ease-out ${
              taskListMode === "all"
                ? "left-[calc(50%+0.125rem)] right-1"
                : "left-1 right-[calc(50%+0.125rem)]"
            }`}
          />
          <button
            type="button"
            role="tab"
            aria-selected={taskListMode === "mine"}
            onClick={() => onTaskListModeChange("mine")}
            className={`relative z-10 h-8 flex-1 rounded-full px-3 text-sm font-medium transition-colors duration-150 ${
              taskListMode === "mine" ? "text-(--foreground)" : "text-neutral-400 hover:text-(--foreground)"
            }`}
          >
            Your task
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={taskListMode === "all"}
            onClick={() => onTaskListModeChange("all")}
            className={`relative z-10 h-8 flex-1 rounded-full px-3 text-sm font-medium transition-colors duration-150 ${
              taskListMode === "all" ? "text-(--foreground)" : "text-neutral-400 hover:text-(--foreground)"
            }`}
          >
            All task
          </button>
        </div>
      </div>
    </div>
  );
}
