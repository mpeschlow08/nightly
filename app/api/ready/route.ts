import { NextResponse } from "next/server";

import { getReadinessReport } from "@/lib/platform/readiness";

export async function GET() {
  const report = await getReadinessReport();
  const statusCode = report.status === "ready" ? 200 : report.status === "degraded" ? 200 : 503;

  return NextResponse.json(report, {
    status: statusCode,
    headers: {
      "cache-control": "no-store",
    },
  });
}
