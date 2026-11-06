import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Self-contained server bundle used by the Windows desktop app (electron/).
  output: "standalone",
  // The git code builds paths like `<workspace>/.git/...` at runtime, which
  // output tracing mistakes for this project's own files. Keep them out.
  outputFileTracingExcludes: {
    "/*": [".git/**", "app/**", ".merger-data/**"],
  },
}

export default nextConfig
