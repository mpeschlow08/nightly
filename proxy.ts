import { clerkMiddleware } from "@clerk/nextjs/server";

const PROTECTED_PATH_PREFIXES = [
  "/bookings",
  "/select-role",
  "/onboarding",
  "/dj/onboarding",
  "/dj/dashboard",
  "/dj/mixes",
  "/dj/bookings",
  "/dj/availability",
  "/profile",
  "/owner",
  "/owner/bookings",
  "/owner/availability",
  "/tickets",
  "/door",
  "/admin",
  "/admin/bookings",
  "/api/admin/health",
  "/api/feedback",
  "/api/owner/google-places",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedPath(req.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  // /api/live stays in the matcher (it is not a protected prefix) so route-level auth() can
  // resolve an optional actor instead of throwing for anonymous consumers.
  matcher: ["/((?!_next|.*\\..*|favicon.ico|api/discovery/track|api/ready|api/health).*)"],
};