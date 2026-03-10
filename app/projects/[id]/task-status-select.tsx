"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useGuest } from "@/components/GuestContext";

type TaskStatus = "todo" | "in_progress" | "done";

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export function TaskStatusSelect({ taskId, initialStatus, isGuest }: { taskId: string; initialStatus: TaskStatus; isGuest?: boolean }) {
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { updateGuestTaskStatus } = useGuest();

  const onChange = (nextStatus: TaskStatus) => {
    setStatus(nextStatus);
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
        setStatus(initialStatus);
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <select
          value={status}
          disabled={isPending}
          onChange={(event) => onChange(event.target.value as TaskStatus)}
          className="w-full appearance-none rounded-md bg-white px-3 py-1.5 pr-8 text-sm text-neutral-900 shadow-sm outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:border-indigo-400 dark:focus-visible:ring-indigo-400/30 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-400"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-neutral-500 dark:text-neutral-400" aria-hidden="true">
          ▾
        </span>
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
