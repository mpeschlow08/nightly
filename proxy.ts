import { clerkMiddleware } from "@clerk/nextjs/server";

const PROTECTED_PATH_PREFIXES = [
  "/select-role",
  "/onboarding",
  "/dj/onboarding",
  "/dj/dashboard",
  "/dj/mixes",
  "/profile",
  "/owner",
  "/admin",
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
  matcher: ["/((?!_next|.*\\..*|favicon.ico|api/discovery/track).*)"],
};