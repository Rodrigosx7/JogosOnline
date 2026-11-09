import type { NextConfig } from "next";
const config: NextConfig = { distDir: process.env.TRUCO_BUILD_DIR || ".next", poweredByHeader: false, serverExternalPackages: [] };
export default config;
