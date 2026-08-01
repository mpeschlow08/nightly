import { config } from "dotenv";

config({ path: ".env.local" });

const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://localhost:3000";

const routes: Array<{ path: string; expected: number[] }> = [
  { path: "/", expected: [200] },
  { path: "/home", expected: [200] },
  { path: "/discover", expected: [200] },
  { path: "/concierge", expected: [200, 307] },
  { path: "/live", expected: [200] },
  { path: "/profile", expected: [200, 307] },
  { path: "/dj/dashboard", expected: [200, 307] },
  { path: "/owner/dashboard", expected: [200, 307] },
  { path: "/owner/intelligence", expected: [200, 307] },
  { path: "/tickets", expected: [200, 307] },
  { path: "/door", expected: [200, 307] },
  { path: "/admin/overview", expected: [200, 307] },
  { path: "/admin/feature-flags", expected: [200, 307] },
  { path: "/admin/launch-readiness", expected: [200, 307] },
  { path: "/api/health/live", expected: [200] },
  { path: "/api/health/ready", expected: [200, 503] },
  { path: "/api/health", expected: [200, 503] },
];

async function main() {
  const output: Array<{ path: string; status: number; ok: boolean }> = [];

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route.path}`, {
      redirect: "manual",
    });

    output.push({
      path: route.path,
      status: response.status,
      ok: route.expected.includes(response.status),
    });
  }

  const failed = output.filter((item) => !item.ok);

  console.log(
    JSON.stringify(
      {
        baseUrl,
        results: output,
        failedCount: failed.length,
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "smoke-routes failed");
  process.exitCode = 1;
});
