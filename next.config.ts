import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Evita che Turbopack risalga fino alla home dell'utente cercando un lockfile.
  turbopack: {
    root: process.cwd(),
  },
  // SQL migrations are read from disk at runtime (Docker/standalone included).
  outputFileTracingIncludes: {
    "/**": ["./db/**/*", "./data/real/**/*"],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js injects a small inline bootstrap script; no third-party scripts are used.
      // In sviluppo React usa eval() per il debug: non abilitarlo in produzione.
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
