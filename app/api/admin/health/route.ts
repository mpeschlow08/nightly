import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/app/admin/lib/permissions";
import { getReadinessReport } from "@/lib/platform/readiness";

export async function GET() {
  await requireAdminPermission("health:view");

  const report = await getReadinessReport();

  return NextResponse.json(
    {
      status: report.status,
      generatedAt: report.generatedAt,
      checks: report.checks,
      environment: report.environment,
      database: report.database,
      providers: report.providers,
      services: report.services,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
