import { NextResponse } from "next/server";

import { getReadinessReport } from "@/lib/platform/readiness";

export async function GET() {
  const report = await getReadinessReport();
  const environment = report.environment;
  const database = report.database;

  const statusCode = database.status === "unavailable" ? 503 : 200;

  return NextResponse.json(
    {
      status: statusCode === 200 ? "healthy" : "unhealthy",
      service: "nightly-web",
      timestamp: new Date().toISOString(),
      checks: {
        environment: {
          ok: environment.ok,
          missingRequired: environment.groups.flatMap((group) => group.missingRequired),
        },
        database,
        providers: report.providers,
        services: report.services,
      },
    },
    {
      status: statusCode,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
