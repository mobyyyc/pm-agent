import { NextResponse } from "next/server";

import { getTaskReminders } from "@/lib/reminders";
import { getTasks } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const parsedDays = Number(daysParam ?? "3");
    const days = Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : 3;

    const tasks = await getTasks();
    const reminders = getTaskReminders(tasks, days);

    return NextResponse.json({ reminders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch reminders.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
