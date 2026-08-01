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
  matcher: ["/((?!_next|.*\\..*|favicon.ico|api/discovery/track|api/live|api/ready|api/health).*)"],
};