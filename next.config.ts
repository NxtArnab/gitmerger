import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Self-contained server bundle used by the Windows desktop app (electron/).
  output: "standalone",
}

export default nextConfig
