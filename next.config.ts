import type { NextConfig } from "next";

// Pages must not be framed by other sites (clickjacking); camera stays limited to this origin.
const security = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const config: NextConfig = {
  distDir: process.env.TRUCO_BUILD_DIR || ".next",
  poweredByHeader: false,
  serverExternalPackages: [],
  async headers() { return [{ source: "/:path*", headers: security }]; },
};
export default config;
