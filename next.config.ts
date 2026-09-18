import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "places.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "maps.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      `script-src 'self' 'unsafe-inline' ${isProduction ? "" : "'unsafe-eval' "}https://*.clerk.accounts.dev`,
      `worker-src 'self' ${isProduction ? "" : "blob:"}`.trim(),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://places.googleapis.com https://maps.gstatic.com https://*.basemaps.cartocdn.com https://*.public.blob.vercel-storage.com https://img.clerk.com",
      "font-src 'self' data:",
      `connect-src 'self' https://api.clerk.com https://*.clerk.accounts.dev https://places.googleapis.com https://maps.googleapis.com https://maps.gstatic.com https://*.public.blob.vercel-storage.com https://stream.mux.com https://*.mux.com https://*.cloudflarestream.com ${isProduction ? "" : "https://clerk-telemetry.com"}`.trim(),
      // Mux serves manifests from stream.mux.com but redirects renditions/segments to regional *.mux.com CDN hosts.
      "media-src 'self' blob: https://stream.mux.com https://*.mux.com https://*.cloudflarestream.com",
      "frame-src 'self' https://*.clerk.accounts.dev",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self)",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
