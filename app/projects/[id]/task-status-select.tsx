"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useGuest } from "@/components/GuestContext";

type TaskStatus = "todo" | "in_progress" | "done";

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const statusStyles: Record<
  TaskStatus,
  {
    dot: string;
    active: string;
    inactive: string;
  }
> = {
  todo: {
    dot: "bg-sky-300",
    active: "bg-sky-500/20 text-white",
    inactive: "text-neutral-300 hover:bg-white/10",
  },
  in_progress: {
    dot: "bg-amber-300",
    active: "bg-amber-500/20 text-white",
    inactive: "text-neutral-300 hover:bg-white/10",
  },
  done: {
    dot: "bg-emerald-300",
    active: "bg-emerald-500/20 text-white",
    inactive: "text-neutral-300 hover:bg-white/10",
  },
};

export function TaskStatusSelect({
  taskId,
  initialStatus,
  isGuest,
  onStatusChange,
}: {
  taskId: string;
  initialStatus: TaskStatus;
  isGuest?: boolean;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
}) {
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { updateGuestTaskStatus } = useGuest();

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const onChange = (nextStatus: TaskStatus) => {
    const previousStatus = status;

    setStatus(nextStatus);
    onStatusChange?.(taskId, nextStatus);
    setError(null);

    if (isGuest) {
      updateGuestTaskStatus(taskId, nextStatus);
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setError("Failed to update.");
        setStatus(previousStatus);
        onStatusChange?.(taskId, previousStatus);
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="flex min-w-70 flex-col gap-1">
      <div className="rounded-xl bg-linear-to-l from-(--status-frame-gradient-from) to-transparent p-1">
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Task status">
          {statusOptions.map((option) => {
            const isActive = status === option.value;
            const theme = statusStyles[option.value];

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={isPending}
                onClick={() => onChange(option.value)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive ? theme.active : theme.inactive
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${theme.dot}`} aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      {isPending ? <span className="text-xs text-neutral-400">Saving status...</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
