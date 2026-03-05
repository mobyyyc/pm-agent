"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TaskStatus = "todo" | "in_progress" | "done";

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

export function TaskStatusSelect({ taskId, initialStatus }: { taskId: string; initialStatus: TaskStatus }) {
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onChange = (nextStatus: TaskStatus) => {
    setStatus(nextStatus);
    setError(null);

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
      <select
        value={status}
        disabled={isPending}
        onChange={(event) => onChange(event.target.value as TaskStatus)}
        className="rounded-md bg-white/5 px-2 py-1 text-sm text-white"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
