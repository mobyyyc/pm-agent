import { NextResponse } from "next/server";

import { getAgentCatalog } from "@/lib/agents";

export async function GET() {
  return NextResponse.json({ agents: getAgentCatalog() });
}
